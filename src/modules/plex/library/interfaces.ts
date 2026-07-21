import type {
    PlexLibrarySection,
    PlexMediaItem,
    PlexSeason,
    PlexCollection,
    PlexPlaylist,
    PlexTagDirectoryItem,
    LibraryQueryOptions,
    SearchOptions,
    PlexLibraryEvents,
} from './types';
import type { IDisposable } from '../../../utils/interfaces';
import type { PlexCurrentCredentialValidity } from '../auth';

export type PlexTagDirectoryUnsupportedReason = 'unavailable' | 'empty';

export type PlexLibraryRequestIntent = 'preview' | 'background';

export type PlexLibrarySelectedServerAccessTokenRefreshResult =
    | { kind: 'updated' }
    | { kind: 'unchanged' }
    | { kind: 'selected_server_unavailable' };

export interface PlexTagDirectoryQueryOptions {
    type: number;
    signal?: AbortSignal | null;
    onUnsupported?: (reason: PlexTagDirectoryUnsupportedReason) => void;
    requireEntries?: boolean;
    requestIntent?: PlexLibraryRequestIntent;
}

/**
 * Semantic absence is represented by `null` or an empty array only for real
 * not-found or empty-success outcomes. Malformed payloads, timeouts, and
 * server failures must reject with `PlexLibraryError`.
 */
export interface IPlexLibrary {
    getLibraries(options?: {
        signal?: AbortSignal | null;
        /**
         * When true, fetch and populate `contentCount` for each library section.
         * Leaves `contentCount` as `null` when the count request fails.
         * Uses a lightweight count query (X-Plex-Container-Size=0) per library.
         */
        includeItemCounts?: boolean;
        /**
         * Concurrency for item count queries when `includeItemCounts` is true.
         * Defaults to 4.
         */
        itemCountConcurrency?: number;
    }): Promise<PlexLibrarySection[]>;

    getLibrary(
        libraryId: string,
        options?: { signal?: AbortSignal | null }
    ): Promise<PlexLibrarySection | null>;

    /**
     * Handles pagination transparently.
     */
    getLibraryItems(libraryId: string, options?: LibraryQueryOptions): Promise<PlexMediaItem[]>;

    /**
     * Get total item count for a library without fetching items.
     * @returns Promise resolving to item count, or `null` only when Plex returns semantic absence
     * (for example an explicit 404) or omits count totals in an otherwise valid payload.
     * Empty 200 bodies and malformed success payload structure reject with `PlexLibraryError`.
     */
    getLibraryItemCount(libraryId: string, options?: LibraryQueryOptions): Promise<number | null>;

    getItem(ratingKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem | null>;

    getShows(libraryId: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]>;

    getShowSeasons(showKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexSeason[]>;

    getSeasonEpisodes(seasonKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]>;

    /**
     * Get all episodes for a show (flattened across all seasons).
     * @returns Promise resolving to all episodes sorted by season/episode
     */
    getShowEpisodes(showKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]>;

    search(query: string, options?: SearchOptions): Promise<PlexMediaItem[]>;

    getCollections(libraryId: string, options?: {
        signal?: AbortSignal | null;
        requestIntent?: PlexLibraryRequestIntent;
    }): Promise<PlexCollection[]>;

    getCollectionItems(collectionKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]>;

    getPlaylists(options?: {
        signal?: AbortSignal | null;
        requestIntent?: PlexLibraryRequestIntent;
    }): Promise<PlexPlaylist[]>;

    getPlaylistItems(playlistKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]>;

    getActors(
        libraryId: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]>;

    getStudios(
        libraryId: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]>;

    getGenres(
        libraryId: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]>;

    getDirectors(
        libraryId: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]>;

    getYears(
        libraryId: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]>;

    getImageUrl(imagePath: string, width?: number, height?: number): string | null;

    refreshLibrary(libraryId: string): Promise<void>;

    on<K extends keyof PlexLibraryEvents>(
        event: K,
        handler: (payload: PlexLibraryEvents[K]) => void
    ): IDisposable;

    off<K extends keyof PlexLibraryEvents>(
        event: K,
        handler: (payload: PlexLibraryEvents[K]) => void
    ): void;
}

export interface PlexLibraryConfig {
    /** Should include the canonical Plex token header when authenticated. */
    getAuthHeaders: () => Record<string, string>;

    /** Active Plex server connection URI. */
    getServerUri: () => string | null;

    /** Used for appending auth to active-server-owned image URLs. */
    getAuthToken: () => string | null;

    /** Refreshes the selected server resource under the active plex.tv credential. */
    refreshSelectedServerAccessToken: (
        expectedAccessToken: string,
        options?: { signal?: AbortSignal | null }
    ) => Promise<PlexLibrarySelectedServerAccessTokenRefreshResult>;

    /** Classifies the current Plex credential against Plex cloud after a PMS 401. */
    probeCurrentCredentialValidity: (options?: {
        signal?: AbortSignal | null;
    }) => Promise<PlexCurrentCredentialValidity>;

    /**
     * Optional callback to trigger server re-discovery.
     * Called when SERVER_UNREACHABLE is encountered.
     */
    onServerUnreachable?: () => void;

    /**
     * Optional logger for warnings and errors.
     * Defaults to Plex-safe console logging when not provided.
     */
    logger?: {
        warn: (message: string, ...args: unknown[]) => void;
        error: (message: string, ...args: unknown[]) => void;
    };
}
