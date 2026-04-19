/**
 * @fileoverview Interface definitions for Plex Library module.
 * @module modules/plex/library/interfaces
 * @version 1.0.0
 */

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

export type PlexTagDirectoryUnsupportedReason = 'unavailable' | 'empty';

export type PlexLibraryRequestIntent = 'preview' | 'background';

export interface PlexTagDirectoryQueryOptions {
    type: number;
    signal?: AbortSignal | null;
    onUnsupported?: (reason: PlexTagDirectoryUnsupportedReason) => void;
    requireEntries?: boolean;
    requestIntent?: PlexLibraryRequestIntent;
}

// ============================================
// Main Interface
// ============================================

/**
 * Plex Library Interface.
 * Provides access to Plex media libraries and content.
 *
 * Semantic absence is represented by `null` or an empty array only for real
 * not-found or empty-success outcomes. Malformed payloads, timeouts, and
 * server failures must reject with `PlexLibraryError`.
 */
export interface IPlexLibrary {
    // Library Sections

    /**
     * Get all libraries.
     * @returns Promise resolving to list of libraries
     */
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

    /**
     * Get a specific library by ID.
     * @param libraryId - Library section ID
     * @returns Promise resolving to library or null when the id is not present in a valid section list
     */
    getLibrary(libraryId: string): Promise<PlexLibrarySection | null>;

    // Content Browsing

    /**
     * Get items from a library with optional filtering.
     * Handles pagination transparently.
     * @param libraryId - Library section ID
     * @param options - Optional query options
     * @returns Promise resolving to list of media items
     */
    getLibraryItems(libraryId: string, options?: LibraryQueryOptions): Promise<PlexMediaItem[]>;

    /**
     * Get total item count for a library without fetching items.
     * @param libraryId - Library section ID
     * @param options - Optional query options (filter/signal)
     * @returns Promise resolving to item count, or `null` only when Plex returns semantic absence
     * (for example an explicit 404) or omits count totals in an otherwise valid payload.
     * Empty 200 bodies and malformed success payload structure reject with `PlexLibraryError`.
     */
    getLibraryItemCount(libraryId: string, options?: LibraryQueryOptions): Promise<number | null>;

    /**
     * Get a specific media item by rating key.
     * @param ratingKey - Item's unique rating key
     * @returns Promise resolving to item or null if not found
     */
    getItem(ratingKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem | null>;

    // TV Show Hierarchy

    /**
     * Get TV shows within a library.
     * @param libraryId - Library section ID (must be a show library)
     * @returns Promise resolving to list of shows
     */
    getShows(libraryId: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]>;

    /**
     * Get seasons for a show.
     * @param showKey - Show's rating key
     * @returns Promise resolving to list of seasons
     */
    getShowSeasons(showKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexSeason[]>;

    /**
     * Get episodes for a season.
     * @param seasonKey - Season's rating key
     * @returns Promise resolving to list of episodes
     */
    getSeasonEpisodes(seasonKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]>;

    /**
     * Get all episodes for a show (flattened across all seasons).
     * @param showKey - Show's rating key
     * @returns Promise resolving to all episodes sorted by season/episode
     */
    getShowEpisodes(showKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]>;

    // Search

    /**
     * Search for content across libraries.
     * @param query - Search query string
     * @param options - Optional search options
     * @returns Promise resolving to matching items
     */
    search(query: string, options?: SearchOptions): Promise<PlexMediaItem[]>;

    // Collections/Playlists

    /**
     * Get collections in a library.
     * @param libraryId - Library section ID
     * @returns Promise resolving to list of collections
     */
    getCollections(libraryId: string, options?: {
        signal?: AbortSignal | null;
        requestIntent?: PlexLibraryRequestIntent;
    }): Promise<PlexCollection[]>;

    /**
     * Get items in a collection.
     * @param collectionKey - Collection's rating key
     * @returns Promise resolving to list of items
     */
    getCollectionItems(collectionKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItem[]>;

    /**
     * Get user playlists.
     * @returns Promise resolving to list of playlists
     */
    getPlaylists(options?: {
        signal?: AbortSignal | null;
        requestIntent?: PlexLibraryRequestIntent;
    }): Promise<PlexPlaylist[]>;

    /**
     * Get items in a playlist.
     * @param playlistKey - Playlist's rating key
     * @returns Promise resolving to list of items
     */
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

    // Image URLs

    /**
     * Generate authenticated URL for Plex images.
     * @param imagePath - Image path from Plex metadata
     * @param width - Optional resize width
     * @param height - Optional resize height (defaults to width)
     * @returns Full URL with authentication token
     */
    getImageUrl(imagePath: string, width?: number, height?: number): string;

    // Refresh

    /**
     * Refresh cached library data.
     * Invalidates cache and emits libraryRefreshed event.
     * @param libraryId - Library section ID to refresh
     */
    refreshLibrary(libraryId: string): Promise<void>;

    /**
     * Register event handler.
     */
    on<K extends keyof PlexLibraryEvents>(
        event: K,
        handler: (payload: PlexLibraryEvents[K]) => void
    ): void;

    /**
     * Remove event handler.
     */
    off<K extends keyof PlexLibraryEvents>(
        event: K,
        handler: (payload: PlexLibraryEvents[K]) => void
    ): void;
}

/**
 * Configuration for PlexLibrary constructor.
 */
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
