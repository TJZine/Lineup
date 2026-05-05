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

export type PlexTagDirectoryUnsupportedReason = 'unavailable' | 'empty';

export type PlexLibraryRequestIntent = 'preview' | 'background';

export interface PlexTagDirectoryQueryOptions {
    type: number;
    signal?: AbortSignal | null;
    onUnsupported?: (reason: PlexTagDirectoryUnsupportedReason) => void;
    requireEntries?: boolean;
    requestIntent?: PlexLibraryRequestIntent;
}

/**
 * Plex Library Interface.
 * Provides access to Plex media libraries and content.
 *
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

    /**
     * Get actors for a library section (tag directory).
     * @param libraryId - Library section ID
     * @param options - Query options (type required)
     * @returns Promise resolving to list of tag directory entries
     */
    getActors(
        libraryId: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]>;

    /**
     * Get studios for a library section (tag directory).
     * @param libraryId - Library section ID
     * @param options - Query options (type required)
     * @returns Promise resolving to list of tag directory entries
     */
    getStudios(
        libraryId: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]>;

    /**
     * Get genres for a library section (tag directory).
     * @param libraryId - Library section ID
     * @param options - Query options (type required)
     * @returns Promise resolving to list of tag directory entries
     */
    getGenres(
        libraryId: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]>;

    /**
     * Get directors for a library section (tag directory).
     * @param libraryId - Library section ID
     * @param options - Query options (type required)
     * @returns Promise resolving to list of tag directory entries
     */
    getDirectors(
        libraryId: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]>;

    /**
     * Get years for a library section (tag directory).
     * @param libraryId - Library section ID
     * @param options - Query options (type required)
     * @returns Promise resolving to list of tag directory entries
     */
    getYears(
        libraryId: string,
        options: PlexTagDirectoryQueryOptions
    ): Promise<PlexTagDirectoryItem[]>;

    /**
     * Generate authenticated URL for Plex images.
     * @returns Full URL with authentication token, or null when no image URL can be built
     */
    getImageUrl(imagePath: string, width?: number, height?: number): string | null;

    /**
     * Refresh cached library data.
     * Invalidates cache and emits libraryRefreshed event.
     */
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
    /**
     * Function to get auth headers for Plex API requests.
     * Should return headers including X-Plex-Token when authenticated.
     */
    getAuthHeaders: () => Record<string, string>;

    /**
     * Function to get the current server URI.
     * Should return the active Plex server connection URI.
     */
    getServerUri: () => string | null;

    /**
     * Function to get the current auth token.
     * Used for appending to image URLs.
     */
    getAuthToken: () => string | null;

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
