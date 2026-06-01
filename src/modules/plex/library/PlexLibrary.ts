import { EventEmitter } from '../../../utils/EventEmitter';
import type { IDisposable } from '../../../utils/interfaces';
import { AppErrorCode } from '../../../types/app-errors';
import { fnv1a32Hex } from '../../../utils/hash';
import type {
    IPlexLibrary,
    PlexLibraryConfig,
    PlexLibraryRequestIntent,
    PlexTagDirectoryQueryOptions,
    PlexTagDirectoryUnsupportedReason,
} from './interfaces';
import type {
    PlexLibrarySection,
    PlexMediaItem,
    PlexSeason,
    PlexCollection,
    PlexPlaylist,
    PlexTagDirectoryItem,
    LibraryQueryOptions,
    SearchOptions,
    PlexLibraryState,
    PlexLibraryEvents,
    PlexMediaContainer,
    RawLibrarySection,
    RawMediaItem,
    RawSeason,
    RawCollection,
    RawPlaylist,
    RawDirectoryTag,
} from './types';
import { PlexLibraryError } from './PlexLibraryError';
import {
    parseLibrarySections,
    parseMediaItems,
    parseMediaItem,
    parseSeasons,
    parseCollections,
    parsePlaylists,
    parseDirectoryTags,
} from './parsing/ResponseParser';
import {
    extractLibrarySectionDirectories,
    extractMediaContainer,
    extractMetadataArray,
    extractSearchHubMetadata,
    extractSearchHubs,
} from './parsing/libraryResponsePayload';
import { extractTagDirectoryEntries } from './parsing/tagDirectoryPayload';
import { PLEX_LIBRARY_CONSTANTS, PLEX_ENDPOINTS, PLEX_MEDIA_TYPES } from './constants';
import {
    applyXPlexTokenQueryParam,
    classifyPlexUrlOrigin,
    buildPlexUrlFromKey,
} from '../shared/plexUrl';
import { createPlexConsoleLogger } from '../shared/plexLogging';
import { enrichLibrarySectionCounts } from './LibraryCountEnrichment';
import {
    PlexLibraryRequestClient,
    resolveRequestProfileForIntent,
    type PlexLibraryRequestProfile,
} from './PlexLibraryRequestClient';

// Re-export for consumers
export { PlexLibraryError } from './PlexLibraryError';

type LibrarySectionsLookupSource =
    | { kind: 'available'; libraries: PlexLibrarySection[] }
    | { kind: 'unavailable'; error: PlexLibraryError };

interface MediaPaginationState {
    fetched: number;
    offset: number;
    pageSize: number;
}

interface MediaPaginationContinueContext {
    pageItems: PlexMediaItem[];
    accumulatedItems: PlexMediaItem[];
    nextOffset: number;
    pageSize: number;
    totalSize: number | null;
}

interface MediaPaginationPage {
    items: PlexMediaItem[];
    totalSize?: number | null;
}

interface MediaPaginationOptions<TResponse> {
    operationName: string;
    initialOffset: number;
    pageSize: number;
    signal?: AbortSignal | null;
    buildUrl: (offset: number, pageSize: number) => string;
    parsePage: (response: TResponse) => MediaPaginationPage;
    shouldContinue: (context: MediaPaginationContinueContext) => boolean;
    formatGuardContext: (state: MediaPaginationState) => string;
}

export class PlexLibrary implements IPlexLibrary {
    private readonly _config: PlexLibraryConfig;
    private readonly _emitter: EventEmitter<PlexLibraryEvents>;
    private readonly _state: PlexLibraryState;
    private readonly _logger: NonNullable<PlexLibraryConfig['logger']>;
    private readonly _requestClient: PlexLibraryRequestClient;

    constructor(config: PlexLibraryConfig) {
        this._config = config;
        this._logger = config.logger ?? createPlexConsoleLogger();
        this._emitter = new EventEmitter<PlexLibraryEvents>();
        this._state = {
            libraryCache: new Map(),
            isRefreshing: false,
            cacheScope: null,
        };
        this._requestClient = new PlexLibraryRequestClient({
            config,
            logger: this._logger,
            emitAuthExpired: (): void => this._emitter.emit('authExpired', undefined),
        });
    }

    /**
     * Derive the current cache scope. Do not include raw tokens in keys; use a stable hash.
     */
    private _getCacheScope(): string | null {
        const serverUri = this._config.getServerUri();
        if (!serverUri) {
            return null;
        }
        const token = this._config.getAuthToken() ?? '';
        const tokenHash = token ? fnv1a32Hex(token) : 'no-token';
        return `${serverUri}::${tokenHash}`;
    }

    /**
     * Ensure caches are scoped to the active server/account. Clear on scope change.
     */
    private _ensureCacheScope(): void {
        const nextScope = this._getCacheScope();
        if (this._state.cacheScope === nextScope) {
            return;
        }
        this._state.libraryCache.clear();
        this._state.cacheScope = nextScope;
    }

    private async _fetchLibrarySectionsForLookup(
        libraryId: string,
        options?: { signal?: AbortSignal | null }
    ): Promise<LibrarySectionsLookupSource> {
        const url = this._buildUrl(PLEX_ENDPOINTS.LIBRARY_SECTIONS);
        const response = await this._fetchWithRetry<PlexMediaContainer<RawLibrarySection>>(url, {
            signal: options?.signal ?? null,
        });

        if (!response) {
            return {
                kind: 'unavailable',
                error: new PlexLibraryError(
                    AppErrorCode.SERVER_ERROR,
                    `Library section lookup unavailable while resolving ${libraryId}`
                ),
            };
        }

        try {
            const directories = extractLibrarySectionDirectories(
                response,
                `library sections payload for library lookup ${libraryId}`
            );
            return {
                kind: 'available',
                libraries: parseLibrarySections(directories),
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                kind: 'unavailable',
                error: error instanceof PlexLibraryError
                    ? error
                    : new PlexLibraryError(
                        AppErrorCode.PARSE_ERROR,
                        `Invalid library section payload while resolving ${libraryId}: ${message}`,
                        undefined,
                        { cause: error, context: { libraryId } }
                    ),
            };
        }
    }


    async getLibraries(options?: {
        signal?: AbortSignal | null;
        includeItemCounts?: boolean;
        itemCountConcurrency?: number;
    }): Promise<PlexLibrarySection[]> {
        this._ensureCacheScope();
        const url = this._buildUrl(PLEX_ENDPOINTS.LIBRARY_SECTIONS);
        const response = await this._fetchWithRetry<PlexMediaContainer<RawLibrarySection>>(url, { signal: options?.signal ?? null });

        if (!response) {
            throw new PlexLibraryError(
                AppErrorCode.SERVER_ERROR,
                'Library sections unavailable'
            );
        }

        const directories = extractLibrarySectionDirectories(response, 'library sections payload for getLibraries');
        const libraries = parseLibrarySections(directories);

        if (options?.includeItemCounts) {
            await enrichLibrarySectionCounts(libraries, {
                signal: options.signal ?? null,
                ...(options.itemCountConcurrency !== undefined
                    ? { itemCountConcurrency: options.itemCountConcurrency }
                    : {}),
                getLibraryItemCount: (libraryId, countOptions) =>
                    this.getLibraryItemCount(libraryId, countOptions),
                logger: this._logger,
            });
        }

        // Cache all libraries
        const now = Date.now();
        for (const lib of libraries) {
            this._state.libraryCache.set(lib.id, { library: lib, cachedAt: now });
        }

        return libraries;
    }

    /**
     * Get a specific library by ID.
     * @param libraryId - Library section ID
     * @returns Promise resolving to library or null when not found in a valid section list
     */
    async getLibrary(
        libraryId: string,
        options?: { signal?: AbortSignal | null }
    ): Promise<PlexLibrarySection | null> {
        this._ensureCacheScope();
        // Check cache first
        const cached = this._state.libraryCache.get(libraryId);
        if (cached && Date.now() - cached.cachedAt < PLEX_LIBRARY_CONSTANTS.CACHE_TTL_MS) {
            return cached.library;
        }

        const lookupSource = await this._fetchLibrarySectionsForLookup(libraryId, options);
        if (lookupSource.kind === 'unavailable') {
            throw lookupSource.error;
        }

        const now = Date.now();
        for (const library of lookupSource.libraries) {
            this._state.libraryCache.set(library.id, { library, cachedAt: now });
        }

        return lookupSource.libraries.find((lib) => lib.id === libraryId) ?? null;
    }


    /**
     * Get items from a library with optional filtering.
     * Handles pagination transparently.
     * @param libraryId - Library section ID
     * @param options - Optional query options
     * @returns Promise resolving to list of media items
     */
    async getLibraryItems(
        libraryId: string,
        options: LibraryQueryOptions = {}
    ): Promise<PlexMediaItem[]> {
        if (options.limit !== undefined && options.limit <= 0) {
            return [];
        }

        const pageSize = options.limit ?? PLEX_LIBRARY_CONSTANTS.DEFAULT_PAGE_SIZE;
        const items = await this._fetchPagedMediaItems<PlexMediaContainer<RawMediaItem>>({
            operationName: 'getLibraryItems',
            initialOffset: options.offset ?? 0,
            pageSize,
            signal: options.signal ?? null,
            buildUrl: (offset, requestedPageSize) => {
                const params: Record<string, string | number> = {
                    'X-Plex-Container-Start': offset,
                    'X-Plex-Container-Size': requestedPageSize,
                };

                if (options.sort) {
                    params['sort'] = options.sort;
                }

                if (options.filter) {
                    Object.assign(params, options.filter);
                }

                if (options.includeCollections) {
                    params['includeCollections'] = 1;
                }

                return this._buildUrl(PLEX_ENDPOINTS.LIBRARY_SECTION_ALL(libraryId), params);
            },
            parsePage: (response) => {
                const metadata = extractMetadataArray(response, `library items for section ${libraryId}`);
                return { items: parseMediaItems(metadata) };
            },
            shouldContinue: ({ pageItems, accumulatedItems }) =>
                pageItems.length === pageSize &&
                (options.limit === undefined || accumulatedItems.length < options.limit),
            formatGuardContext: ({ fetched }) =>
                `(libraryId=${libraryId}, fetched=${fetched}, pageSize=${pageSize}, maxIterations=${PLEX_LIBRARY_CONSTANTS.MAX_PAGINATION_ITERATIONS})`,
        });

        // Trim to exact limit if specified
        if (options.limit !== undefined && items.length > options.limit) {
            return items.slice(0, options.limit);
        }

        return items;
    }

    /**
     * Get total item count for a library without fetching items.
     * Uses X-Plex-Container-Size=0 to avoid payload costs.
     */
    async getLibraryItemCount(
        libraryId: string,
        options: LibraryQueryOptions = {}
    ): Promise<number | null> {
        const params: Record<string, string | number> = {
            'X-Plex-Container-Start': 0,
            'X-Plex-Container-Size': 0,
        };

        if (options.sort) {
            params['sort'] = options.sort;
        }

        if (options.filter) {
            Object.assign(params, options.filter);
        }

        if (options.includeCollections) {
            params['includeCollections'] = 1;
        }

        const url = this._buildUrl(PLEX_ENDPOINTS.LIBRARY_SECTION_ALL(libraryId), params);
        const response = await this._fetchWithRetry<PlexMediaContainer<RawMediaItem>>(url, { signal: options.signal ?? null });
        if (!response) {
            return null;
        }
        const mediaContainer = extractMediaContainer(
            response,
            `library item count for section ${libraryId}`
        );
        const total = mediaContainer.totalSize ?? mediaContainer.size;
        return typeof total === 'number' && Number.isFinite(total) ? total : null;
    }

    /**
     * Get a specific media item by rating key.
     * @param ratingKey - Item's unique rating key
     * @returns Promise resolving to item or null if not found
     */
    async getItem(ratingKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem | null> {
        const url = this._buildUrl(PLEX_ENDPOINTS.LIBRARY_METADATA(ratingKey));
        const response = await this._fetchWithRetry<PlexMediaContainer<RawMediaItem>>(url, { signal: options?.signal ?? null });

        if (!response) {
            return null;
        }

        const metadata = extractMetadataArray(response, `item lookup for ${ratingKey}`);
        const [item] = metadata;
        if (!item) {
            return null;
        }

        return parseMediaItem(item);
    }


    /**
     * Get TV shows within a library.
     * @param libraryId - Library section ID (must be a show library)
     * @returns Promise resolving to list of shows
     */
    async getShows(libraryId: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]> {
        const params = {
            type: PLEX_MEDIA_TYPES.SHOW,
        };
        const url = this._buildUrl(PLEX_ENDPOINTS.LIBRARY_SECTION_ALL(libraryId), params);
        const response = await this._fetchWithRetry<PlexMediaContainer<RawMediaItem>>(url, { signal: options?.signal ?? null });

        if (!response) {
            return [];
        }

        const metadata = extractMetadataArray(response, `show list for library ${libraryId}`);
        return parseMediaItems(metadata);
    }

    /**
     * Get seasons for a show.
     * @param showKey - Show's rating key
     * @returns Promise resolving to list of seasons
     */
    async getShowSeasons(showKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexSeason[]> {
        const url = this._buildUrl(PLEX_ENDPOINTS.LIBRARY_METADATA_CHILDREN(showKey));
        const response = await this._fetchWithRetry<PlexMediaContainer<RawSeason>>(url, { signal: options?.signal ?? null });

        if (!response) {
            return [];
        }

        const metadata = extractMetadataArray(response, `season list for show ${showKey}`);
        return parseSeasons(metadata);
    }

    /**
     * Get episodes for a season.
     * @param seasonKey - Season's rating key
     * @returns Promise resolving to list of episodes
     */
    async getSeasonEpisodes(seasonKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]> {
        const url = this._buildUrl(PLEX_ENDPOINTS.LIBRARY_METADATA_CHILDREN(seasonKey));
        const response = await this._fetchWithRetry<PlexMediaContainer<RawMediaItem>>(url, { signal: options?.signal ?? null });

        if (!response) {
            return [];
        }

        const metadata = extractMetadataArray(response, `episode list for season ${seasonKey}`);
        return parseMediaItems(metadata);
    }

    /**
     * Get all episodes for a show (flattened across all seasons).
     * @param showKey - Show's rating key
     * @returns Promise resolving to all episodes sorted by season/episode
     */
    async getShowEpisodes(showKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]> {
        const allEpisodes = await this._fetchPagedMediaItems<PlexMediaContainer<RawMediaItem>>({
            operationName: 'getShowEpisodes',
            initialOffset: 0,
            pageSize: PLEX_LIBRARY_CONSTANTS.ALL_LEAVES_PAGE_SIZE,
            signal: options?.signal ?? null,
            buildUrl: (offset, pageSize) => this._buildUrl(
                PLEX_ENDPOINTS.LIBRARY_METADATA_ALL_LEAVES(showKey),
                {
                    'X-Plex-Container-Start': offset,
                    'X-Plex-Container-Size': pageSize,
                }
            ),
            parsePage: (response) => {
                const mediaContainer = extractMediaContainer(response, `show episodes for ${showKey}`);
                const reportedTotal = mediaContainer.totalSize;

                const metadata = extractMetadataArray(response, `show episodes for ${showKey}`);
                return {
                    items: parseMediaItems(metadata),
                    totalSize: typeof reportedTotal === 'number' && Number.isFinite(reportedTotal)
                        ? reportedTotal
                        : null,
                };
            },
            shouldContinue: ({ pageItems, nextOffset, pageSize, totalSize }) => {
                if (pageItems.length === 0) {
                    return false;
                }

                if (totalSize !== null) {
                    return nextOffset < totalSize;
                }

                return pageItems.length >= pageSize;
            },
            formatGuardContext: ({ fetched, offset, pageSize }) =>
                `(showKey=${showKey}, fetched=${fetched}, offset=${offset}, pageSize=${pageSize}, maxIterations=${PLEX_LIBRARY_CONSTANTS.MAX_PAGINATION_ITERATIONS})`,
        });

        return allEpisodes.sort((a, b) => {
            const aSeason = typeof a.seasonNumber === 'number' ? a.seasonNumber : 0;
            const bSeason = typeof b.seasonNumber === 'number' ? b.seasonNumber : 0;
            const seasonDiff = aSeason - bSeason;
            if (seasonDiff !== 0) return seasonDiff;

            const aEpisode = typeof a.episodeNumber === 'number' ? a.episodeNumber : 0;
            const bEpisode = typeof b.episodeNumber === 'number' ? b.episodeNumber : 0;
            return aEpisode - bEpisode;
        });
    }


    /**
     * Search for content across libraries.
     * @param query - Search query string
     * @param options - Optional search options
     * @returns Promise resolving to matching items
     */
    async search(query: string, options: SearchOptions = {}): Promise<PlexMediaItem[]> {
        const params: Record<string, string | number> = {
            query,
        };

        if (options.libraryId) {
            params['sectionId'] = options.libraryId;
        }

        if (options.limit) {
            params['limit'] = options.limit;
        }

        const url = this._buildUrl(PLEX_ENDPOINTS.SEARCH, params);
        const response = await this._fetchWithRetry<PlexMediaContainer<RawMediaItem>>(url, {
            signal: options.signal ?? null,
        });

        if (!response) {
            return [];
        }

        // Search results come in "Hubs" - extract items from all hubs
        const hubs = extractSearchHubs(response, `search results for query "${query}"`);
        const items: PlexMediaItem[] = [];

        for (const hub of hubs) {
            // Filter by types if specified
            if (options.types && options.types.length > 0) {
                const hubType = this._mapHubTypeToMediaType(hub.type);
                if (hubType && !options.types.includes(hubType)) {
                    continue;
                }
            }

            try {
                const metadata = extractSearchHubMetadata(
                    hub,
                    `search hub "${hub.type}" for query "${query}"`
                );
                items.push(...parseMediaItems(metadata));
            } catch (error) {
                if (error instanceof PlexLibraryError) {
                    throw new PlexLibraryError(
                        error.code,
                        `Invalid search hub "${hub.type}" for query "${query}": ${error.message}`,
                        error.httpStatus,
                        { cause: error, context: { query, hubType: hub.type } }
                    );
                }
                throw error;
            }
        }

        return items;
    }


    /**
     * Get collections in a library.
     * Uses type=18 filter on the 'all' endpoint for standard Plex behavior.
     * @param libraryId - Library section ID
     * @returns Promise resolving to list of collections
     */
    async getCollections(
        libraryId: string,
        options?: { signal?: AbortSignal | null; requestIntent?: PlexLibraryRequestIntent }
    ): Promise<PlexCollection[]> {
        // Use type=18 (COLLECTION) filter on the library 'all' endpoint
        const params = {
            type: PLEX_MEDIA_TYPES.COLLECTION,
            includeGuids: 1, // Standard metadata
            includeMeta: 1,  // Standard metadata
        };
        const url = this._buildUrl(PLEX_ENDPOINTS.LIBRARY_SECTION_ALL(libraryId), params);
        const response = await this._fetchWithRetry<PlexMediaContainer<RawCollection>>(
            url,
            { signal: options?.signal ?? null },
            resolveRequestProfileForIntent(options?.requestIntent)
        );

        if (!response) {
            return [];
        }

        const metadata = extractMetadataArray(response, `collections for library ${libraryId}`);
        return parseCollections(metadata);
    }

    /**
     * Get items in a collection.
     * @param collectionKey - Collection's rating key
     * @returns Promise resolving to list of items
     */
    async getCollectionItems(collectionKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]> {
        const params = {
            includeGuids: 1,
            includeMeta: 1,
        };
        const url = this._buildUrl(PLEX_ENDPOINTS.COLLECTION_CHILDREN(collectionKey), params);
        const response = await this._fetchWithRetry<PlexMediaContainer<RawMediaItem>>(url, { signal: options?.signal ?? null });

        if (!response) {
            return [];
        }

        const metadata = extractMetadataArray(response, `collection items for ${collectionKey}`);
        return parseMediaItems(metadata);
    }

    /**
     * Get user playlists.
     * @returns Promise resolving to list of playlists
     */
    async getPlaylists(
        options?: { signal?: AbortSignal | null; requestIntent?: PlexLibraryRequestIntent }
    ): Promise<PlexPlaylist[]> {
        const url = this._buildUrl(PLEX_ENDPOINTS.PLAYLISTS);
        const response = await this._fetchWithRetry<PlexMediaContainer<RawPlaylist>>(
            url,
            { signal: options?.signal ?? null },
            resolveRequestProfileForIntent(options?.requestIntent)
        );

        if (!response) {
            return [];
        }

        const metadata = extractMetadataArray(response, 'playlists');
        return parsePlaylists(metadata);
    }

    /**
     * Get items in a playlist.
     * @param playlistKey - Playlist's rating key
     * @returns Promise resolving to list of items
     */
    async getPlaylistItems(playlistKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]> {
        const url = this._buildUrl(PLEX_ENDPOINTS.PLAYLIST_ITEMS(playlistKey));
        const response = await this._fetchWithRetry<PlexMediaContainer<RawMediaItem>>(url, { signal: options?.signal ?? null });

        if (!response) {
            return [];
        }

        const metadata = extractMetadataArray(response, `playlist items for ${playlistKey}`);
        return parseMediaItems(metadata);
    }


    private async _getLibrarySectionTags(
        libraryId: string,
        endpoint: (id: string) => string,
        label: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]> {
        const params: Record<string, string | number> = { type: options.type };
        const url = this._buildUrl(endpoint(libraryId), params);
        const response = await this._fetchWithRetry<PlexMediaContainer<RawDirectoryTag>>(url, {
            signal: options.signal ?? null,
        }, resolveRequestProfileForIntent(options.requestIntent));
        if (!response) {
            if (options.requireEntries) {
                this._notifyUnsupportedTagDirectory(options, 'unavailable', label, libraryId);
            }
            return [];
        }
        const directories = extractTagDirectoryEntries(response, `${label.toLowerCase()} tag directory for library ${libraryId}`);
        if (options.requireEntries === true && directories.length === 0) {
            this._notifyUnsupportedTagDirectory(options, 'empty', label, libraryId);
            return [];
        }
        return parseDirectoryTags(directories);
    }

    private _notifyUnsupportedTagDirectory(
        options: PlexTagDirectoryQueryOptions,
        reason: PlexTagDirectoryUnsupportedReason,
        label: string,
        libraryId: string
    ): void {
        const detail = reason === 'empty' ? 'returned no directory entries' : 'endpoint unavailable';
        this._logger.warn(`[PlexLibrary] ${label} ${detail} for library ${libraryId}`);
        options.onUnsupported?.(reason);
    }

    private async _fetchPagedMediaItems<TResponse>(
        options: MediaPaginationOptions<TResponse>
    ): Promise<PlexMediaItem[]> {
        const items: PlexMediaItem[] = [];
        let offset = options.initialOffset;
        let totalSize: number | null = null;
        let pageCounter = 0;

        while (true) {
            if (++pageCounter > PLEX_LIBRARY_CONSTANTS.MAX_PAGINATION_ITERATIONS) {
                const message =
                    `[PlexLibrary] Pagination guard tripped in ${options.operationName} ` +
                    options.formatGuardContext({
                        fetched: items.length,
                        offset,
                        pageSize: options.pageSize,
                    });
                this._logger.error(message);
                throw new PlexLibraryError(AppErrorCode.PAGINATION_LIMIT_EXCEEDED, message);
            }

            const url = options.buildUrl(offset, options.pageSize);
            const response = await this._fetchWithRetry<TResponse>(url, {
                signal: options.signal ?? null,
            });

            if (!response) {
                break;
            }

            const page = options.parsePage(response);
            const pageItems = page.items;
            if (typeof page.totalSize === 'number' && Number.isFinite(page.totalSize)) {
                totalSize = page.totalSize;
            }
            items.push(...pageItems);
            offset += pageItems.length;

            if (!options.shouldContinue({
                pageItems,
                accumulatedItems: items,
                nextOffset: offset,
                pageSize: options.pageSize,
                totalSize,
            })) {
                break;
            }
        }

        return items;
    }

    async getActors(
        libraryId: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]> {
        return this._getLibrarySectionTags(libraryId, PLEX_ENDPOINTS.LIBRARY_SECTION_ACTORS, 'Actors', options);
    }

    async getStudios(
        libraryId: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]> {
        return this._getLibrarySectionTags(libraryId, PLEX_ENDPOINTS.LIBRARY_SECTION_STUDIOS, 'Studios', options);
    }

    async getGenres(
        libraryId: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]> {
        return this._getLibrarySectionTags(libraryId, PLEX_ENDPOINTS.LIBRARY_SECTION_GENRES, 'Genres', options);
    }

    async getDirectors(
        libraryId: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]> {
        return this._getLibrarySectionTags(libraryId, PLEX_ENDPOINTS.LIBRARY_SECTION_DIRECTORS, 'Directors', options);
    }

    async getYears(
        libraryId: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]> {
        return this._getLibrarySectionTags(libraryId, PLEX_ENDPOINTS.LIBRARY_SECTION_YEARS, 'Years', options);
    }

    getImageUrl(imagePath: string, width?: number, height?: number): string | null {
        if (!imagePath) return null;

        const serverUri = this._config.getServerUri();
        if (!serverUri) return null;

        const token = this._config.getAuthToken() || '';
        const originClassification = classifyPlexUrlOrigin(serverUri, imagePath);

        if (originClassification === 'foreign-absolute') {
            return null;
        }

        if (typeof width === 'number' && width > 0) {
            const resizeHeight = typeof height === 'number' ? height : width;
            const url = new URL(PLEX_ENDPOINTS.PHOTO_TRANSCODE, serverUri);
            applyXPlexTokenQueryParam(url.searchParams, token);
            url.searchParams.set('width', String(width));
            url.searchParams.set('height', String(resizeHeight));
            url.searchParams.set('url', buildPlexUrlFromKey(serverUri, imagePath).toString());
            return url.toString();
        }

        // Direct image URL
        if (originClassification === 'server-absolute' || originClassification === 'server-relative') {
            const normalized = buildPlexUrlFromKey(serverUri, imagePath);
            applyXPlexTokenQueryParam(normalized.searchParams, token);
            return normalized.toString();
        }
        const url = buildPlexUrlFromKey(serverUri, imagePath);
        applyXPlexTokenQueryParam(url.searchParams, token);
        return url.toString();
    }

    async refreshLibrary(libraryId: string): Promise<void> {
        this._ensureCacheScope();
        this._state.libraryCache.delete(libraryId);

        await this.getLibrary(libraryId);

        this._emitter.emit('libraryRefreshed', { libraryId });
    }


    on<K extends keyof PlexLibraryEvents>(
        event: K,
        handler: (payload: PlexLibraryEvents[K]) => void
    ): IDisposable {
        return this._emitter.on(event, handler);
    }

    off<K extends keyof PlexLibraryEvents>(
        event: K,
        handler: (payload: PlexLibraryEvents[K]) => void
    ): void {
        this._emitter.off(event, handler);
    }

    private _buildUrl(endpoint: string, params: Record<string, string | number> = {}): string {
        const serverUri = this._config.getServerUri();
        if (!serverUri) {
            throw new PlexLibraryError(
                AppErrorCode.SERVER_UNREACHABLE,
                'No server URI available'
            );
        }

        const url = new URL(endpoint, serverUri);

        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, String(value));
        }

        return url.toString();
    }

    /**
     * Fetch with retry and error handling per spec requirements.
     * 
     * Error handling:
     * - Network timeout: NETWORK_TIMEOUT, retry with exponential backoff (max 3)
     * - 401 Unauthorized: AUTH_EXPIRED, emit event, no retry
     * - 404 Not Found: return null, log warning
     * - 429 Rate Limited: backoff per Retry-After header
     * - 500+ Server Error: retry once after 2s delay
     * - Empty response: throw PARSE_ERROR
     * - Parse error: throw PARSE_ERROR and log the response body snippet
     * - Server unreachable: trigger re-discovery hook
     * 
     * @param url - URL to fetch
     * @param options - Optional fetch options
     * @returns Parsed JSON response, or `null` only for semantic-not-found outcomes such as 404.
     * Empty 200 bodies and malformed success payloads throw `PlexLibraryError(PARSE_ERROR)`.
     */
    private async _fetchWithRetry<T>(
        url: string,
        options: RequestInit = {},
        requestProfile: PlexLibraryRequestProfile = 'default'
    ): Promise<T | null> {
        return this._requestClient.fetchWithRetry<T>(url, options, requestProfile);
    }

    /**
     * Map hub type to media type.
     * @param hubType - Hub type string from search results
     * @returns Corresponding media type or undefined
     */
    private _mapHubTypeToMediaType(hubType: string): PlexMediaItem['type'] | undefined {
        switch (hubType) {
            case 'movie':
                return 'movie';
            case 'episode':
            case 'show':
                return 'episode';
            case 'track':
            case 'artist':
            case 'album':
                return 'track';
            case 'clip':
                return 'clip';
            default:
                return undefined;
        }
    }
}
