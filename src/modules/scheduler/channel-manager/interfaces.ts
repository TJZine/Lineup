import type {
    ChannelConfig,
    ChannelCreateInput,
    ResolvedChannelContent,
    ImportResult,
    ChannelManagerEventMap,
    ChannelUpdateInput,
} from './types';
import type { PlexMediaFile } from '../../plex/library';
import type { PlexMediaType } from '../../plex/shared/types';
import type { IDisposable } from '../../../utils/interfaces';

export interface IChannelManager {
    /**
     * Create a new channel with default values for missing fields.
     * @throws ChannelError if content source is missing or non-fallback content resolution fails
     */
    createChannel(config: ChannelCreateInput, options?: { signal?: AbortSignal | null }): Promise<ChannelConfig>;

    /**
     * @throws ChannelError if channel not found or a content-affecting update hits a non-fallback resolution failure
     */
    updateChannel(id: string, updates: ChannelUpdateInput): Promise<ChannelConfig>;

    /**
     * @throws ChannelError if channel not found
     */
    deleteChannel(id: string): Promise<void>;

    getChannel(id: string): ChannelConfig | null;

    getAllChannels(): ChannelConfig[];

    /**
     * Get a channel by its display number.
     * @param number - Channel number (1-999)
     * @returns Channel config or null if not found
     */
    getChannelByNumber(number: number): ChannelConfig | null;

    /**
     * Resolve content for a channel (uses cache if valid).
     * @throws ChannelError if channel not found
     */
    resolveChannelContent(channelId: string, options?: { signal?: AbortSignal | null }): Promise<ResolvedChannelContent>;

    /**
     * Force refresh content for a channel (bypasses cache).
     * @throws ChannelError if channel not found
     */
    refreshChannelContent(channelId: string, options?: { signal?: AbortSignal | null }): Promise<ResolvedChannelContent>;

    /**
     * Resolve channel items for schedule generation without mutating ChannelManager state.
     * Used by guide prefetchers that want to avoid caching/persisting channel metadata.
     * @throws ChannelError if channel not found
     */
    resolveChannelItemsForSchedule(
        channelId: string,
        options?: { signal?: AbortSignal | null }
    ): Promise<ResolvedChannelContent['items']>;

    /**
     * Replace channel ordering with an exact full order.
     * ChannelManager validates before mutating state, so invalid input leaves the
     * existing in-memory order unchanged and does not queue persistence.
     * @throws ChannelError if any existing id is missing, duplicated, or unknown.
     */
    reorderChannels(orderedIds: string[]): Promise<void>;

    setCurrentChannel(channelId: string): void;

    /**
     * Get the current active channel.
     * @returns Current channel or null if none selected
     */
    getCurrentChannel(): ChannelConfig | null;

    /**
     * Get the next channel in order.
     * Uses circular navigation when channels exist.
     * @returns Next channel in order, or null when no current channel is selected or channel order is empty
     */
    getNextChannel(): ChannelConfig | null;

    /**
     * Get the previous channel in order.
     * Uses circular navigation when channels exist.
     * @returns Previous channel in order, or null when no current channel is selected or channel order is empty
     */
    getPreviousChannel(): ChannelConfig | null;

    exportChannels(): string;

    /**
     * @returns Import result with success/error details
     */
    importChannels(data: string): Promise<ImportResult>;

    /**
     * Persist channels to storage (via persistence boundary).
     */
    saveChannels(): Promise<void>;

    /**
     * Flush any pending debounced channel save immediately.
     */
    flushSaves(): Promise<void>;

    /**
     * Release timers and pending async work for teardown.
     */
    dispose(): void;

    /**
     * Load channels from storage (via persistence boundary).
     */
    loadChannels(): Promise<void>;

    /**
     * Update persistence keys for multi-server/multi-mode support.
     * Implementations should NOT throw if storage is unavailable.
     * Typically followed by loadChannels().
     * @throws ChannelError if storage keys are empty.
     */
    setStorageKeys(storageKey: string, currentChannelKey: string): void;

    /**
     * Replace the entire channel lineup atomically.
     * Used to avoid partial destructive builds when generating many channels.
     */
    replaceAllChannels(
        channels: ChannelConfig[],
        options?: { currentChannelId?: string | null }
    ): Promise<void>;

    on<K extends keyof ChannelManagerEventMap>(
        event: K,
        handler: (payload: ChannelManagerEventMap[K]) => void
    ): IDisposable;
}

export interface ChannelManagerConfig {
    /**
     * PlexLibrary instance for content resolution.
     */
    plexLibrary: IPlexLibraryMinimal;

    /**
     * Optional logger for warnings and errors.
     */
    logger?: {
        warn: (message: string, ...args: unknown[]) => void;
        error: (message: string, ...args: unknown[]) => void;
    };

    /**
     * Storage key to use for channel persistence.
     */
    storageKey?: string;

    /**
     * Storage key to use for persisting the current channel ID.
     * If omitted, a per-storage-key namespaced default is used.
     */
    currentChannelKey?: string;
}

export interface IPlexLibraryMinimal {
    getLibraryItems(
        libraryId: string,
        options?: {
            includeCollections?: boolean;
            filter?: Record<string, string | number>;
            signal?: AbortSignal | null;
        }
    ): Promise<PlexMediaItemMinimal[]>;
    getCollectionItems(collectionKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItemMinimal[]>;
    getShowEpisodes(showKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItemMinimal[]>;
    getPlaylistItems(playlistKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItemMinimal[]>;
    getItem(ratingKey: string, options?: { signal?: AbortSignal | null }): Promise<PlexMediaItemMinimal | null>;
}

export interface PlexMediaItemMinimal {
    ratingKey: string;
    type: PlexMediaType;
    title: string;
    year: number;
    durationMs: number;
    thumb: string | null;
    art?: string | null;
    grandparentThumb?: string | null;
    summary?: string;
    media?: PlexMediaFile[];
    grandparentTitle?: string;
    parentTitle?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    rating?: number;
    contentRating?: string;
    genres?: string[];
    directors?: string[];
    addedAt: Date;
    viewCount?: number;
    clearLogo?: string | null;
    grandparentRatingKey?: string;
    parentRatingKey?: string;
}
