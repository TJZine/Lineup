import type {
    ChannelConfig,
    ChannelCreateInput,
    ResolvedChannelContent,
    ResolvedContentItem,
    ImportResult,
    ChannelManagerEventMap,
    ChannelUpdateInput,
} from './types';
import type { PlexCollection, PlexMediaFile } from '../../../plex/library';
import type { PlexMediaType } from '../../../plex/shared/types';
import type { IDisposable } from '../../../../utils/interfaces';
import type { ObserveSourceResolution } from './SourceResolutionDiagnostic';
import type { ChannelLoadOutcome, ChannelMutationOutcome, ChannelStructuralBase } from './ChannelDurability';

export type ChannelContentResolutionOptions = {
    signal?: AbortSignal | null;
    cacheMode?: 'default' | 'revalidate';
    onSourceDiagnostic?: ObserveSourceResolution;
};

export interface IChannelManager {
    /**
     * Create a new channel with default values for missing fields.
     * @throws ChannelError if content source is missing or non-fallback content resolution fails
     */
    createChannel(config: ChannelCreateInput, options?: ChannelCreateOptions): Promise<ChannelConfig>;
    tryCreateChannel(config: ChannelCreateInput, options?: ChannelCreateOptions): Promise<ChannelMutationOutcome<ChannelConfig>>;

    /**
     * @throws ChannelError if channel not found or a content-affecting update hits a non-fallback resolution failure
     */
    updateChannel(id: string, updates: ChannelUpdateInput, expectedBase?: ChannelStructuralBase): Promise<ChannelConfig>;
    tryUpdateChannel(id: string, updates: ChannelUpdateInput, expectedBase?: ChannelStructuralBase): Promise<ChannelMutationOutcome<ChannelConfig>>;

    /**
     * @throws ChannelError if channel not found
     */
    deleteChannel(id: string, expectedBase?: ChannelStructuralBase): Promise<void>;
    tryDeleteChannel(id: string, expectedBase?: ChannelStructuralBase): Promise<ChannelMutationOutcome<void>>;

    getChannel(id: string): ChannelConfig | null;

    getAllChannels(): ChannelConfig[];

    /**
     * Clears in-memory channel identity and resolver caches without changing the
     * active persistence keys or deleting persisted channel data.
     */
    clearRuntimeState(): void;

    /**
     * Closes general content-resolution admission, cancels retry work, and waits
     * for every tracked resolution to settle. Individual resolution failures are drained.
     */
    supersedeActiveResolutions(): Promise<void>;

    /**
     * Reopens general content-resolution admission after a completed scope transition.
     * Calling while admission is already open is a no-op.
     */
    resumeActiveResolutions(): void;

    /**
     * Supersedes and drains active resolutions before clearing identity-scoped
     * channel and resolver state. Resolution admission remains suspended.
     */
    clearRuntimeStateForScopeTransition(): Promise<void>;

    getChannelByNumber(number: number): ChannelConfig | null;

    /**
     * Resolve content for a channel (uses cache if valid).
     * @throws ChannelError if channel not found
     */
    resolveChannelContent(channelId: string, options?: ChannelContentResolutionOptions): Promise<ResolvedChannelContent>;

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
        options?: ChannelContentResolutionOptions
    ): Promise<ResolvedChannelContent['items']>;

    /**
     * Replace channel ordering with an exact full order.
     * ChannelManager validates before mutating state, so invalid input leaves the
     * existing in-memory order unchanged and does not queue persistence.
     * @throws ChannelError if any existing id is missing, duplicated, or unknown.
     */
    reorderChannels(orderedIds: string[], expectedBase?: ChannelStructuralBase): Promise<void>;
    tryReorderChannels(orderedIds: string[], expectedBase?: ChannelStructuralBase): Promise<ChannelMutationOutcome<void>>;

    setCurrentChannel(channelId: string): void;

    getCurrentChannel(): ChannelConfig | null;

    /**
     * Uses circular navigation when channels exist.
     */
    getNextChannel(): ChannelConfig | null;

    /**
     * Uses circular navigation when channels exist.
     */
    getPreviousChannel(): ChannelConfig | null;

    exportChannels(): string;

    /**
     * @returns Import result with success/error details
     */
    importChannels(data: string): Promise<ImportResult>;

    /**
     * Persists channel state through the persistence boundary.
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
     * Loads channel state through the persistence boundary.
     */
    loadChannels(): Promise<ChannelLoadOutcome>;

    getStructuralBase(): ChannelStructuralBase;
    getLastLoadOutcome(): ChannelLoadOutcome;
    prepareProtectedReplacement(): ChannelLoadOutcome;
    cancelProtectedReplacement(handle: string): void;
    tryReplaceAllChannels(
        channels: ChannelConfig[],
        options?: { currentChannelId?: string | null; expectedBase?: ChannelStructuralBase; protectedReplacementHandle?: string }
    ): Promise<ChannelMutationOutcome<void>>;

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
        options?: { currentChannelId?: string | null; expectedBase?: ChannelStructuralBase; protectedReplacementHandle?: string }
    ): Promise<void>;

    on<K extends keyof ChannelManagerEventMap>(
        event: K,
        handler: (payload: ChannelManagerEventMap[K]) => void
    ): IDisposable;
}

export interface ChannelCreateOptions {
    signal?: AbortSignal | null;
    initialContent?: ReadonlyArray<ResolvedContentItem> | undefined;
    expectedBase?: ChannelStructuralBase;
}

export interface ChannelManagerConfig {
    plexLibrary: IPlexLibraryMinimal;

    logger?: {
        warn: (message: string, ...args: unknown[]) => void;
        error: (message: string, ...args: unknown[]) => void;
    };

    storageKey?: string;

    /**
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
    getCollections(
        libraryId: string,
        options?: { signal?: AbortSignal | null }
    ): Promise<PlexCollection[]>;
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
