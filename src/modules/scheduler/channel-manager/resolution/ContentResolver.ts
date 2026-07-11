import type { IPlexLibraryMinimal, PlexMediaItemMinimal } from '../contracts/interfaces';
import type {
    ChannelContentSource,
    LibraryContentSource,
    CollectionContentSource,
    ShowContentSource,
    PlaylistContentSource,
    ManualContentSource,
    MixedContentSource,
    ResolvedContentItem,
    ContentFilter,
    SortOrder,
    PlaybackMode,
} from '../contracts/types';
import { PLEX_MEDIA_TYPES } from '../../../plex/library/constants';
import { isPlexLibraryScopeSupersededError } from '../../../plex/library';
import { ContentItemMapper } from './ContentItemMapper';
import { ContentSelectionPolicy } from './ContentSelectionPolicy';
import { SourceResolutionCache } from './SourceResolutionCache';
import { isAbortLikeError } from '../../../../utils/errors';


const CONTENT_RESOLVER_CACHE_TTL_MS = 5 * 60_000;
const SHOW_CACHE_TTL_MS = CONTENT_RESOLVER_CACHE_TTL_MS;

/**
 * Resolves content from various Plex sources.
 */
export class ContentResolver {
    private readonly _library: IPlexLibraryMinimal;
    private readonly _logger: {
        warn: (message: string, ...args: unknown[]) => void;
    };
    private readonly _showCacheByLibraryId = new Map<
        string,
        { items: PlexMediaItemMinimal[]; cachedAt: number }
    >();
    private readonly _sourceCache = new SourceResolutionCache();
    private readonly _mapper = new ContentItemMapper();
    private readonly _selectionPolicy = new ContentSelectionPolicy();

    constructor(
        library: IPlexLibraryMinimal,
        logger?: { warn: (message: string, ...args: unknown[]) => void }
    ) {
        this._library = library;
        this._logger = logger || { warn: console.warn.bind(console) };
    }

    clearCaches(): void {
        this._showCacheByLibraryId.clear();
        this._sourceCache.clear();
    }

    invalidateSource(source: ChannelContentSource): void {
        this._sourceCache.invalidate(source);
        this._invalidateShowListCache(source);
    }

    private _invalidateShowListCache(source: ChannelContentSource): void {
        if (source.type === 'library' && source.libraryType === 'show') {
            this._showCacheByLibraryId.delete(source.libraryId);
        }

        if (source.type === 'mixed') {
            for (const subSource of source.sources) {
                this._invalidateShowListCache(subSource);
            }
        }
    }

    /**
     * Resolve content from any source type.
     * @param source - Content source configuration
     * @returns Promise resolving to content items
     * @throws Error if resolution fails (for cached fallback handling by caller)
     */
    async resolveSource(
        source: ChannelContentSource,
        options?: { signal?: AbortSignal | null }
    ): Promise<ResolvedContentItem[]> {
        return this._sourceCache.resolve(
            source,
            (sourceToResolve, resolveOptions) => this._resolveSourceUncached(sourceToResolve, resolveOptions),
            options
        );
    }

    private async _resolveSourceUncached(
        source: ChannelContentSource,
        options?: { signal?: AbortSignal | null }
    ): Promise<ResolvedContentItem[]> {
        let items: ResolvedContentItem[];

        switch (source.type) {
            case 'library':
                items = await this._resolveLibrarySource(source, options);
                break;
            case 'collection':
                items = await this._resolveCollectionSource(source, options);
                break;
            case 'show':
                items = await this._resolveShowSource(source, options);
                break;
            case 'playlist':
                items = await this._resolvePlaylistSource(source, options);
                break;
            case 'manual':
                items = await this._resolveManualSource(source, options);
                break;
            case 'mixed':
                items = await this._resolveMixedSource(source, options);
                break;
            default: {
                const type = (source as { type: string }).type;
                this._logger.warn(`Unknown source type: ${type}`);
                items = [];
            }
        }

        // Defensive expansion: Shows are containers, not playable items.
        // Expand any that slipped through (common in Collections containing shows).
        const expanded = await this._expandShowContainers(items, options);

        // Final defensive filter: if any shows remain, drop them and warn.
        const playable = expanded.filter((item) => item.type !== 'show');
        if (playable.length < expanded.length) {
            const skipped = expanded.length - playable.length;
            this._logger.warn(`Filtered out ${skipped} unexpanded show(s) from resolved content`);
        }

        // Normalize scheduledIndex to the final playable list.
        return playable.map((item, index) => ({ ...item, scheduledIndex: index }));
    }

    private async _expandShowContainers(
        items: ResolvedContentItem[],
        options?: { signal?: AbortSignal | null; strict?: boolean }
    ): Promise<ResolvedContentItem[]> {
        const expanded: ResolvedContentItem[] = [];

        for (const item of items) {
            if (item.type !== 'show') {
                expanded.push(item);
                continue;
            }

            try {
                const episodes = await this._library.getShowEpisodes(item.ratingKey, {
                    signal: options?.signal ?? null,
                });
                if (episodes.length === 0) {
                    if (options?.strict) {
                        throw new Error(`Show item returned no episodes during strict expansion (${item.ratingKey})`);
                    }
                    this._logger.warn('Show item returned no episodes during expansion', item.ratingKey);
                    continue;
                }

                for (let i = 0; i < episodes.length; i++) {
                    const episode = episodes[i];
                    if (!episode) continue;

                    const showThumb = item.showThumb ?? item.thumb ?? null;
                    const merged = this._mapper.decorateEpisodeFromParent(episode, {
                        genres: item.genres,
                        directors: item.directors,
                        contentRating: item.contentRating,
                        rating: item.rating,
                        year: item.year,
                        grandparentTitle: item.title,
                        grandparentThumb: showThumb,
                        art: item.art,
                        clearLogo: item.clearLogo,
                    });

                    expanded.push(this._mapper.toResolvedItem(merged, 0));
                }
            } catch (error) {
                if (isPlexLibraryScopeSupersededError(error)) {
                    throw error;
                }
                if (options?.strict || isAbortLikeError(error, options?.signal ?? undefined)) {
                    throw error;
                }
                this._logger.warn('Failed to expand show item', item.ratingKey, error);
            }
        }

        return expanded;
    }

    /**
     * Apply filters to content items.
     * @param items - Items to filter
     * @param filters - Filters to apply (AND logic)
     * @returns Filtered items
     */
    applyFilters(items: ResolvedContentItem[], filters: ContentFilter[]): ResolvedContentItem[] {
        return this._selectionPolicy.applyFilters(items, filters);
    }

    /**
     * Apply sort order to content items.
     * @param items - Items to sort
     * @param order - Sort order
     * @returns Sorted items (new array)
     */
    applySort(items: ResolvedContentItem[], order: SortOrder): ResolvedContentItem[] {
        return this._selectionPolicy.applySort(items, order);
    }

    /**
     * Apply playback mode to order items.
     * @param items - Items to order
     * @param mode - Playback mode
     * @param seed - Shuffle seed (used for 'shuffle' mode)
     * @returns Ordered items
     */
    applyPlaybackMode(
        items: ResolvedContentItem[],
        mode: PlaybackMode,
        seed: number,
        blockSize?: number
    ): ResolvedContentItem[] {
        return this._selectionPolicy.applyPlaybackMode(items, mode, seed, blockSize);
    }


    private async _resolveLibrarySource(
        source: LibraryContentSource,
        options?: { signal?: AbortSignal | null }
    ): Promise<ResolvedContentItem[]> {
        if (source.libraryType !== 'show') {
            const optionsWithFilter = source.libraryFilter
                ? { ...options, filter: source.libraryFilter }
                : options;
            const items = await this._library.getLibraryItems(source.libraryId, optionsWithFilter);
            return items.map((item, index) => this._mapper.toResolvedItem(item, index));
        }

        const hasGenreLibraryFilter = source.libraryFilter && 'genre' in source.libraryFilter;
        if (hasGenreLibraryFilter) {
            const items = await this._library.getLibraryItems(source.libraryId, {
                ...options,
                filter: { ...source.libraryFilter, type: PLEX_MEDIA_TYPES.SHOW },
            });
            const resolvedShows = items.map((item, index) => this._mapper.toResolvedItem(item, index));
            return this._expandShowContainers(resolvedShows, {
                signal: options?.signal ?? null,
                strict: true,
            });
        }

        // Show libraries fetch playable episodes directly. Parent show metadata is fetched
        // once per library for decoration, reusing the cached show list when available.
        const episodeItems = await this._library.getLibraryItems(source.libraryId, {
            ...options,
            filter: { ...(source.libraryFilter ?? {}), type: PLEX_MEDIA_TYPES.EPISODE },
        });

        const now = Date.now();
        const cached = this._showCacheByLibraryId.get(source.libraryId);
        let shows: PlexMediaItemMinimal[] | null = null;
        if (cached && now - cached.cachedAt < SHOW_CACHE_TTL_MS) {
            shows = cached.items;
        } else {
            try {
                shows = await this._library.getLibraryItems(source.libraryId, options);
                this._showCacheByLibraryId.set(source.libraryId, { items: shows, cachedAt: now });
            } catch (error) {
                if (isPlexLibraryScopeSupersededError(error)) {
                    throw error;
                }
                if (isAbortLikeError(error, options?.signal ?? undefined)) {
                    throw error;
                }
                if (cached) {
                    this._logger.warn('Show list fetch failed, using cached show list', error);
                    shows = cached.items;
                    this._showCacheByLibraryId.set(source.libraryId, { items: cached.items, cachedAt: now });
                } else {
                    this._logger.warn('Show list fetch failed, continuing without decoration', error);
                    shows = null;
                }
            }
        }
        const parentMap = new Map<string, PlexMediaItemMinimal>();
        if (shows) {
            for (const show of shows) {
                // Index by ratingKey or key? Plex grandparents usually refer to show ratingKey.
                parentMap.set(show.ratingKey, show);
            }
        }

        const decorated: PlexMediaItemMinimal[] = [];
        for (const episode of episodeItems) {
            if (episode.durationMs <= 0) continue;

            // Plex usually provides grandparentRatingKey in episode metadata.
            // If not present, we can't decorate, but we still keep the episode.
            const parentKey = episode.grandparentRatingKey || episode.parentRatingKey;
            const parent = parentKey ? parentMap.get(parentKey) : null;

            if (parent) {
                const merged = this._mapper.decorateEpisodeFromParent(episode, {
                    genres: parent.genres,
                    directors: parent.directors,
                    contentRating: parent.contentRating,
                    rating: parent.rating,
                    year: parent.year,
                    grandparentTitle: parent.title,
                    grandparentThumb: parent.thumb,
                    art: parent.art,
                    clearLogo: parent.clearLogo,
                });
                decorated.push(merged);
            } else {
                decorated.push(episode);
            }
        }

        return decorated.map((item, index) => this._mapper.toResolvedItem(item, index));
    }

    private async _resolveCollectionSource(
        source: CollectionContentSource,
        options?: { signal?: AbortSignal | null }
    ): Promise<ResolvedContentItem[]> {
        const items = await this._library.getCollectionItems(source.collectionKey, options);
        const expanded: PlexMediaItemMinimal[] = [];

        for (const item of items) {
            if (
                item.durationMs <= 0 &&
                item.episodeNumber === undefined &&
                item.seasonNumber === undefined
            ) {
                try {
                    const episodes = await this._library.getShowEpisodes(item.ratingKey, options);
                    if (episodes.length > 0) {
                        const decorated = episodes.map((episode) => {
                            return this._mapper.decorateEpisodeFromParent(episode, {
                                genres: item.genres,
                                directors: item.directors,
                                contentRating: item.contentRating,
                                rating: item.rating,
                                year: item.year,
                                grandparentTitle: item.title,
                                grandparentThumb: item.thumb,
                                art: item.art,
                                clearLogo: item.clearLogo,
                            });
                        });
                        expanded.push(...decorated);
                        continue;
                    }
                } catch (error) {
                    if (isPlexLibraryScopeSupersededError(error)) {
                        throw error;
                    }
                    this._logger.warn('Failed to expand show collection item', item.ratingKey, error);
                }
            }
            expanded.push(item);
        }

        return expanded.map((item, index) => this._mapper.toResolvedItem(item, index));
    }

    private async _resolveShowSource(
        source: ShowContentSource,
        options?: { signal?: AbortSignal | null }
    ): Promise<ResolvedContentItem[]> {
        const items = await this._library.getShowEpisodes(source.showKey, options);

        let filtered = items;
        const seasonFilter = source.seasonFilter;
        if (seasonFilter && seasonFilter.length) {
            filtered = items.filter(
                (ep) =>
                    typeof ep.seasonNumber === 'number' &&
                    seasonFilter.indexOf(ep.seasonNumber) !== -1
            );
        }

        return filtered.map((item, index) => this._mapper.toResolvedItem(item, index));
    }

    private async _resolvePlaylistSource(
        source: PlaylistContentSource,
        options?: { signal?: AbortSignal | null }
    ): Promise<ResolvedContentItem[]> {
        const items = await this._library.getPlaylistItems(source.playlistKey, options);
        return items.map((item, index) => this._mapper.toResolvedItem(item, index));
    }

    private _resolveManualSource(
        source: ManualContentSource,
        _options?: { signal?: AbortSignal | null }
    ): Promise<ResolvedContentItem[]> {
        const results: ResolvedContentItem[] = [];

        for (let i = 0; i < source.items.length; i++) {
            const manualItem = source.items[i];
            if (!manualItem) continue;
            if (
                typeof manualItem.ratingKey !== 'string' ||
                manualItem.ratingKey.length === 0 ||
                typeof manualItem.title !== 'string' ||
                manualItem.title.length === 0 ||
                typeof manualItem.durationMs !== 'number' ||
                !Number.isFinite(manualItem.durationMs) ||
                manualItem.durationMs <= 0
            ) {
                continue;
            }

            results.push({
                ratingKey: manualItem.ratingKey,
                type: 'movie', // Default, could be extended in ManualContentItem
                title: manualItem.title,
                fullTitle: manualItem.title,
                durationMs: manualItem.durationMs,
                thumb: null,
                year: 0, // Not cached in manual items
                scheduledIndex: i,
            });
        }

        return Promise.resolve(results);
    }

    private async _resolveMixedSource(
        source: MixedContentSource,
        options?: { signal?: AbortSignal | null }
    ): Promise<ResolvedContentItem[]> {
        const allResolved = await Promise.all(
            source.sources.map((subSource) => this.resolveSource(subSource, options))
        );

        if (source.mixMode === 'sequential') {
            // Append sources in order
            const combined = allResolved.flat();
            return combined.map((item, index) => ({
                ...item,
                scheduledIndex: index,
            }));
        } else {
            // Interleave sources
            return this._interleave(allResolved);
        }
    }


    private _interleave(arrays: ResolvedContentItem[][]): ResolvedContentItem[] {
        const result: ResolvedContentItem[] = [];
        const maxLen = Math.max(...arrays.map((arr) => arr.length));

        for (let i = 0; i < maxLen; i++) {
            for (const arr of arrays) {
                const item = arr[i];
                if (item) {
                    result.push({
                        ...item,
                        scheduledIndex: result.length,
                    });
                }
            }
        }

        return result;
    }
}
