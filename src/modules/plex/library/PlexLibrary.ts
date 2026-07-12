import { EventEmitter } from '../../../utils/EventEmitter';
import type { IDisposable } from '../../../utils/interfaces';
import { AppErrorCode } from '../../../types/app-errors';
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
} from './PlexLibraryRequestClient';
import {
    PlexLibraryRequestScope,
    type PlexLibraryRequestScopeSnapshot,
} from './PlexLibraryRequestScope';

// Re-export for consumers
export {
    PlexLibraryError,
    PlexLibraryScopeSupersededError,
    isPlexLibraryScopeSupersededError,
} from './PlexLibraryError';

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
    scope: PlexLibraryRequestScopeSnapshot;
    operationName: string;
    initialOffset: number;
    pageSize: number;
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
    private readonly _requestScope: PlexLibraryRequestScope;

    constructor(config: PlexLibraryConfig) {
        this._config = config;
        this._logger = config.logger ?? createPlexConsoleLogger();
        this._emitter = new EventEmitter<PlexLibraryEvents>();
        this._state = {
            libraryCache: new Map(),
            isRefreshing: false,
        };
        this._requestScope = new PlexLibraryRequestScope({
            config,
            onScopeChange: (): void => {
                this._state.libraryCache.clear();
            },
        });
        this._requestClient = new PlexLibraryRequestClient({
            config,
            logger: this._logger,
            emitAuthExpired: (): void => this._emitter.emit('authExpired', undefined),
            assertCurrent: (scope, signal): void => this._requestScope.assertCurrent(scope, signal),
        });
    }
    async getLibraries(options?: {
        signal?: AbortSignal | null;
        includeItemCounts?: boolean;
        itemCountConcurrency?: number;
    }): Promise<PlexLibrarySection[]> {
        const scope = this._requestScope.capture(options?.signal ?? null);
        const url = this._requestScope.buildUrl(scope, PLEX_ENDPOINTS.LIBRARY_SECTIONS);
        const response = await this._requestClient.fetchWithRetry<PlexMediaContainer<RawLibrarySection>>(scope, url, { signal: scope.signal });
        this._requestScope.assertCurrent(scope, scope.signal);

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
                signal: scope.signal,
                ...(options.itemCountConcurrency !== undefined
                    ? { itemCountConcurrency: options.itemCountConcurrency }
                    : {}),
                getLibraryItemCount: (libraryId, countOptions) =>
                    this._getLibraryItemCount(scope, libraryId, countOptions ?? {}),
                logger: this._logger,
            });
        }

        // Cache all libraries
        const now = Date.now();
        for (const lib of libraries) {
            this._requestScope.assertCurrent(scope, scope.signal);
            this._state.libraryCache.set(lib.id, { library: lib, cachedAt: now });
        }

        this._requestScope.assertCurrent(scope, scope.signal);
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
        const scope = this._requestScope.capture(options?.signal ?? null);
        return this._getLibraryWithScope(scope, libraryId);
    }

    private async _getLibraryWithScope(
        scope: PlexLibraryRequestScopeSnapshot,
        libraryId: string
    ): Promise<PlexLibrarySection | null> {
        // Check cache first
        const cached = this._state.libraryCache.get(libraryId);
        if (cached && Date.now() - cached.cachedAt < PLEX_LIBRARY_CONSTANTS.CACHE_TTL_MS) {
            this._requestScope.assertCurrent(scope, scope.signal);
            return cached.library;
        }

        const url = this._requestScope.buildUrl(scope, PLEX_ENDPOINTS.LIBRARY_SECTIONS);
        const response = await this._requestClient.fetchWithRetry<PlexMediaContainer<RawLibrarySection>>(
            scope,
            url,
            { signal: scope.signal }
        );
        this._requestScope.assertCurrent(scope, scope.signal);
        if (!response) {
            throw new PlexLibraryError(
                AppErrorCode.SERVER_ERROR,
                `Library section lookup unavailable while resolving ${libraryId}`
            );
        }
        let libraries: PlexLibrarySection[];
        try {
            const directories = extractLibrarySectionDirectories(
                response,
                `library sections payload for library lookup ${libraryId}`
            );
            libraries = parseLibrarySections(directories);
        } catch (error) {
            if (error instanceof PlexLibraryError) {
                throw error;
            }
            const message = error instanceof Error ? error.message : String(error);
            throw new PlexLibraryError(
                AppErrorCode.PARSE_ERROR,
                `Invalid library section payload while resolving ${libraryId}: ${message}`,
                undefined,
                { cause: error, context: { libraryId } }
            );
        }

        const now = Date.now();
        for (const library of libraries) {
            this._requestScope.assertCurrent(scope, scope.signal);
            this._state.libraryCache.set(library.id, { library, cachedAt: now });
        }

        this._requestScope.assertCurrent(scope, scope.signal);
        return libraries.find((lib) => lib.id === libraryId) ?? null;
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
        const scope = this._requestScope.capture(options.signal ?? null);
        if (options.limit !== undefined && options.limit <= 0) {
            return [];
        }

        const pageSize = options.limit ?? PLEX_LIBRARY_CONSTANTS.DEFAULT_PAGE_SIZE;
        const items = await this._fetchPagedMediaItems<PlexMediaContainer<RawMediaItem>>({
            scope,
            operationName: 'getLibraryItems',
            initialOffset: options.offset ?? 0,
            pageSize,
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

                return this._requestScope.buildUrl(scope, PLEX_ENDPOINTS.LIBRARY_SECTION_ALL(libraryId), params);
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
            this._requestScope.assertCurrent(scope, scope.signal);
            return items.slice(0, options.limit);
        }

        this._requestScope.assertCurrent(scope, scope.signal);
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
        const scope = this._requestScope.capture(options.signal ?? null);
        return this._getLibraryItemCount(scope, libraryId, options);
    }

    private async _getLibraryItemCount(
        scope: PlexLibraryRequestScopeSnapshot,
        libraryId: string,
        options: LibraryQueryOptions
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

        const url = this._requestScope.buildUrl(scope, PLEX_ENDPOINTS.LIBRARY_SECTION_ALL(libraryId), params);
        const response = await this._requestClient.fetchWithRetry<PlexMediaContainer<RawMediaItem>>(scope, url, { signal: scope.signal });
        if (!response) {
            this._requestScope.assertCurrent(scope, scope.signal);
            return null;
        }
        const mediaContainer = extractMediaContainer(
            response,
            `library item count for section ${libraryId}`
        );
        const total = mediaContainer.totalSize ?? mediaContainer.size;
        this._requestScope.assertCurrent(scope, scope.signal);
        return typeof total === 'number' && Number.isFinite(total) ? total : null;
    }

    /**
     * Get a specific media item by rating key.
     * @param ratingKey - Item's unique rating key
     * @returns Promise resolving to item or null if not found
     */
    async getItem(ratingKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem | null> {
        const scope = this._requestScope.capture(options?.signal ?? null);
        const url = this._requestScope.buildUrl(scope, PLEX_ENDPOINTS.LIBRARY_METADATA(ratingKey));
        const response = await this._requestClient.fetchWithRetry<PlexMediaContainer<RawMediaItem>>(scope, url, { signal: scope.signal });

        if (!response) {
            this._requestScope.assertCurrent(scope, scope.signal);
            return null;
        }

        const metadata = extractMetadataArray(response, `item lookup for ${ratingKey}`);
        const [item] = metadata;
        if (!item) {
            this._requestScope.assertCurrent(scope, scope.signal);
            return null;
        }

        this._requestScope.assertCurrent(scope, scope.signal);
        return parseMediaItem(item);
    }


    /**
     * Get TV shows within a library.
     * @param libraryId - Library section ID (must be a show library)
     * @returns Promise resolving to list of shows
     */
    async getShows(libraryId: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]> {
        const scope = this._requestScope.capture(options?.signal ?? null);
        const params = {
            type: PLEX_MEDIA_TYPES.SHOW,
        };
        const url = this._requestScope.buildUrl(scope, PLEX_ENDPOINTS.LIBRARY_SECTION_ALL(libraryId), params);
        const response = await this._requestClient.fetchWithRetry<PlexMediaContainer<RawMediaItem>>(scope, url, { signal: scope.signal });

        if (!response) {
            this._requestScope.assertCurrent(scope, scope.signal);
            return [];
        }

        const metadata = extractMetadataArray(response, `show list for library ${libraryId}`);
        this._requestScope.assertCurrent(scope, scope.signal);
        return parseMediaItems(metadata);
    }

    /**
     * Get seasons for a show.
     * @param showKey - Show's rating key
     * @returns Promise resolving to list of seasons
     */
    async getShowSeasons(showKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexSeason[]> {
        const scope = this._requestScope.capture(options?.signal ?? null);
        const url = this._requestScope.buildUrl(scope, PLEX_ENDPOINTS.LIBRARY_METADATA_CHILDREN(showKey));
        const response = await this._requestClient.fetchWithRetry<PlexMediaContainer<RawSeason>>(scope, url, { signal: scope.signal });

        if (!response) {
            this._requestScope.assertCurrent(scope, scope.signal);
            return [];
        }

        const metadata = extractMetadataArray(response, `season list for show ${showKey}`);
        this._requestScope.assertCurrent(scope, scope.signal);
        return parseSeasons(metadata);
    }

    /**
     * Get episodes for a season.
     * @param seasonKey - Season's rating key
     * @returns Promise resolving to list of episodes
     */
    async getSeasonEpisodes(seasonKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]> {
        const scope = this._requestScope.capture(options?.signal ?? null);
        const url = this._requestScope.buildUrl(scope, PLEX_ENDPOINTS.LIBRARY_METADATA_CHILDREN(seasonKey));
        const response = await this._requestClient.fetchWithRetry<PlexMediaContainer<RawMediaItem>>(scope, url, { signal: scope.signal });

        if (!response) {
            this._requestScope.assertCurrent(scope, scope.signal);
            return [];
        }

        const metadata = extractMetadataArray(response, `episode list for season ${seasonKey}`);
        this._requestScope.assertCurrent(scope, scope.signal);
        return parseMediaItems(metadata);
    }

    /**
     * Get all episodes for a show (flattened across all seasons).
     * @param showKey - Show's rating key
     * @returns Promise resolving to all episodes sorted by season/episode
     */
    async getShowEpisodes(showKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]> {
        const scope = this._requestScope.capture(options?.signal ?? null);
        const allEpisodes = await this._fetchPagedMediaItems<PlexMediaContainer<RawMediaItem>>({
            scope,
            operationName: 'getShowEpisodes',
            initialOffset: 0,
            pageSize: PLEX_LIBRARY_CONSTANTS.ALL_LEAVES_PAGE_SIZE,
            buildUrl: (offset, pageSize) => this._requestScope.buildUrl(
                scope,
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

        const sortedEpisodes = allEpisodes.sort((a, b) => {
            const aSeason = typeof a.seasonNumber === 'number' ? a.seasonNumber : 0;
            const bSeason = typeof b.seasonNumber === 'number' ? b.seasonNumber : 0;
            const seasonDiff = aSeason - bSeason;
            if (seasonDiff !== 0) return seasonDiff;

            const aEpisode = typeof a.episodeNumber === 'number' ? a.episodeNumber : 0;
            const bEpisode = typeof b.episodeNumber === 'number' ? b.episodeNumber : 0;
            return aEpisode - bEpisode;
        });
        this._requestScope.assertCurrent(scope, scope.signal);
        return sortedEpisodes;
    }


    /**
     * Search for content across libraries.
     * @param query - Search query string
     * @param options - Optional search options
     * @returns Promise resolving to matching items
     */
    async search(query: string, options: SearchOptions = {}): Promise<PlexMediaItem[]> {
        const scope = this._requestScope.capture(options.signal ?? null);
        const params: Record<string, string | number> = {
            query,
        };

        if (options.libraryId) {
            params['sectionId'] = options.libraryId;
        }

        if (options.limit) {
            params['limit'] = options.limit;
        }

        const url = this._requestScope.buildUrl(scope, PLEX_ENDPOINTS.SEARCH, params);
        const response = await this._requestClient.fetchWithRetry<PlexMediaContainer<RawMediaItem>>(scope, url, {
            signal: scope.signal,
        });

        if (!response) {
            this._requestScope.assertCurrent(scope, scope.signal);
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

        this._requestScope.assertCurrent(scope, scope.signal);
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
        const scope = this._requestScope.capture(options?.signal ?? null);
        // Use type=18 (COLLECTION) filter on the library 'all' endpoint
        const params = {
            type: PLEX_MEDIA_TYPES.COLLECTION,
            includeGuids: 1, // Standard metadata
            includeMeta: 1,  // Standard metadata
        };
        const url = this._requestScope.buildUrl(scope, PLEX_ENDPOINTS.LIBRARY_SECTION_ALL(libraryId), params);
        const response = await this._requestClient.fetchWithRetry<PlexMediaContainer<RawCollection>>(
            scope,
            url,
            { signal: scope.signal },
            resolveRequestProfileForIntent(options?.requestIntent)
        );

        if (!response) {
            this._requestScope.assertCurrent(scope, scope.signal);
            return [];
        }

        const metadata = extractMetadataArray(response, `collections for library ${libraryId}`);
        this._requestScope.assertCurrent(scope, scope.signal);
        return parseCollections(metadata);
    }

    /**
     * Get items in a collection.
     * @param collectionKey - Collection's rating key
     * @returns Promise resolving to list of items
     */
    async getCollectionItems(collectionKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]> {
        const scope = this._requestScope.capture(options?.signal ?? null);
        const params = {
            includeGuids: 1,
            includeMeta: 1,
        };
        const url = this._requestScope.buildUrl(scope, PLEX_ENDPOINTS.COLLECTION_CHILDREN(collectionKey), params);
        const response = await this._requestClient.fetchWithRetry<PlexMediaContainer<RawMediaItem>>(scope, url, { signal: scope.signal });

        if (!response) {
            this._requestScope.assertCurrent(scope, scope.signal);
            return [];
        }

        const metadata = extractMetadataArray(response, `collection items for ${collectionKey}`);
        this._requestScope.assertCurrent(scope, scope.signal);
        return parseMediaItems(metadata);
    }

    /**
     * Get user playlists.
     * @returns Promise resolving to list of playlists
     */
    async getPlaylists(
        options?: { signal?: AbortSignal | null; requestIntent?: PlexLibraryRequestIntent }
    ): Promise<PlexPlaylist[]> {
        const scope = this._requestScope.capture(options?.signal ?? null);
        const url = this._requestScope.buildUrl(scope, PLEX_ENDPOINTS.PLAYLISTS);
        const response = await this._requestClient.fetchWithRetry<PlexMediaContainer<RawPlaylist>>(
            scope,
            url,
            { signal: scope.signal },
            resolveRequestProfileForIntent(options?.requestIntent)
        );

        if (!response) {
            this._requestScope.assertCurrent(scope, scope.signal);
            return [];
        }

        const metadata = extractMetadataArray(response, 'playlists');
        this._requestScope.assertCurrent(scope, scope.signal);
        return parsePlaylists(metadata);
    }

    /**
     * Get items in a playlist.
     * @param playlistKey - Playlist's rating key
     * @returns Promise resolving to list of items
     */
    async getPlaylistItems(playlistKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]> {
        const scope = this._requestScope.capture(options?.signal ?? null);
        const url = this._requestScope.buildUrl(scope, PLEX_ENDPOINTS.PLAYLIST_ITEMS(playlistKey));
        const response = await this._requestClient.fetchWithRetry<PlexMediaContainer<RawMediaItem>>(scope, url, { signal: scope.signal });

        if (!response) {
            this._requestScope.assertCurrent(scope, scope.signal);
            return [];
        }

        const metadata = extractMetadataArray(response, `playlist items for ${playlistKey}`);
        this._requestScope.assertCurrent(scope, scope.signal);
        return parseMediaItems(metadata);
    }


    private async _getLibrarySectionTags(
        scope: PlexLibraryRequestScopeSnapshot,
        libraryId: string,
        endpoint: (id: string) => string,
        label: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]> {
        const params: Record<string, string | number> = { type: options.type };
        const url = this._requestScope.buildUrl(scope, endpoint(libraryId), params);
        const response = await this._requestClient.fetchWithRetry<PlexMediaContainer<RawDirectoryTag>>(scope, url, {
            signal: scope.signal,
        }, resolveRequestProfileForIntent(options.requestIntent));
        if (!response) {
            this._requestScope.assertCurrent(scope, scope.signal);
            if (options.requireEntries) {
                this._notifyUnsupportedTagDirectory(scope, options, 'unavailable', label, libraryId);
            }
            return [];
        }
        const directories = extractTagDirectoryEntries(response, `${label.toLowerCase()} tag directory for library ${libraryId}`);
        if (options.requireEntries === true && directories.length === 0) {
            this._notifyUnsupportedTagDirectory(scope, options, 'empty', label, libraryId);
            return [];
        }
        this._requestScope.assertCurrent(scope, scope.signal);
        return parseDirectoryTags(directories);
    }

    private _notifyUnsupportedTagDirectory(
        scope: PlexLibraryRequestScopeSnapshot,
        options: PlexTagDirectoryQueryOptions,
        reason: PlexTagDirectoryUnsupportedReason,
        label: string,
        libraryId: string
    ): void {
        this._requestScope.assertCurrent(scope, options.signal ?? null);
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
            this._requestScope.assertCurrent(options.scope, options.scope.signal);
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
            const response = await this._requestClient.fetchWithRetry<TResponse>(options.scope, url, {
                signal: options.scope.signal,
            });
            this._requestScope.assertCurrent(options.scope, options.scope.signal);

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
            this._requestScope.assertCurrent(options.scope, options.scope.signal);
        }

        this._requestScope.assertCurrent(options.scope, options.scope.signal);
        return items;
    }

    async getActors(
        libraryId: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]> {
        const scope = this._requestScope.capture(options.signal ?? null);
        return this._getLibrarySectionTags(scope, libraryId, PLEX_ENDPOINTS.LIBRARY_SECTION_ACTORS, 'Actors', options);
    }

    async getStudios(
        libraryId: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]> {
        const scope = this._requestScope.capture(options.signal ?? null);
        return this._getLibrarySectionTags(scope, libraryId, PLEX_ENDPOINTS.LIBRARY_SECTION_STUDIOS, 'Studios', options);
    }

    async getGenres(
        libraryId: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]> {
        const scope = this._requestScope.capture(options.signal ?? null);
        return this._getLibrarySectionTags(scope, libraryId, PLEX_ENDPOINTS.LIBRARY_SECTION_GENRES, 'Genres', options);
    }

    async getDirectors(
        libraryId: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]> {
        const scope = this._requestScope.capture(options.signal ?? null);
        return this._getLibrarySectionTags(scope, libraryId, PLEX_ENDPOINTS.LIBRARY_SECTION_DIRECTORS, 'Directors', options);
    }

    async getYears(
        libraryId: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]> {
        const scope = this._requestScope.capture(options.signal ?? null);
        return this._getLibrarySectionTags(scope, libraryId, PLEX_ENDPOINTS.LIBRARY_SECTION_YEARS, 'Years', options);
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
        const scope = this._requestScope.capture();
        this._requestScope.assertCurrent(scope);
        this._state.libraryCache.delete(libraryId);

        await this._getLibraryWithScope(scope, libraryId);

        this._requestScope.assertCurrent(scope);
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
