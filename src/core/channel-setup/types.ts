export type SetupStrategyKey =
    | 'collections'
    | 'playlists'
    | 'genres'
    | 'directors'
    | 'decades'
    | 'recentlyAdded'
    | 'studios'
    | 'actors';

export interface SetupStrategyConfig {
    enabled: boolean;
    priority: number;
    scope: 'per-library' | 'cross-library';
}

export interface ChannelExpansionConfig {
    addAlternateLineups: boolean;
    /** Number of extra copies per generated channel (clamped to 1–3 at plan time). */
    alternateLineupCopies: number;
    variantType: 'none' | 'sequential' | 'block';
    variantBlockSize: number;
}

export interface SeriesOrderingConfig {
    basePlaybackMode: 'shuffle' | 'sequential' | 'block';
    baseBlockSize: number;
}

export interface ChannelSetupConfig {
    serverId: string;
    selectedLibraryIds: string[];
    maxChannels: number;
    buildMode: 'replace' | 'append' | 'merge';
    strategyConfig: Record<SetupStrategyKey, SetupStrategyConfig>;
    channelExpansion?: ChannelExpansionConfig;
    seriesOrdering?: SeriesOrderingConfig;
    actorStudioCombineMode: 'separate' | 'combined';
    minItemsPerChannel: number;
}

export type ChannelSetupContext = 'first-time' | 'existing' | 'unknown';

export interface ChannelBuildSummary {
    created: number;
    skipped: number;
    reachedMaxChannels: boolean;
    errorCount: number;
    canceled: boolean;
    blockedMessage?: string;
    warnings?: string[];
    lastTask?: ChannelBuildProgress['task'] | 'init';
}

export interface ChannelBuildProgress {
    task: 'fetch_playlists' | 'fetch_collections' | 'scan_library_items' | 'build_pending' | 'create_channels' | 'apply_channels' | 'refresh_epg' | 'done';
    label: string;              // “Fetching collections…”
    detail: string;             // “Library: Movies” / “Channel 12 of 80”
    current: number;            // units completed in this task
    total: number | null;       // null = indeterminate
}

export interface ChannelSetupEstimates {
    total: number;
    collections: number;
    playlists: number;
    genres: number;
    directors: number;
    decades: number;
    recentlyAdded: number;
    studios: number;
    actors: number;
}

export type ChannelSetupPreviewStatus = 'ready' | 'blocked' | 'slow';

export type ChannelSetupPreviewFailureReason =
    | 'unsupported'
    | 'empty'
    | 'timeout'
    | 'error'
    | 'transient';

export interface ChannelSetupPreview {
    estimates: ChannelSetupEstimates;
    warnings: string[];
    reachedMaxChannels: boolean;
    status?: ChannelSetupPreviewStatus;
    message?: string;
    failureReason?: ChannelSetupPreviewFailureReason;
}

interface ChannelSetupDiffSummary {
    created: number;
    removed: number;
    unchanged: number;
}

interface ChannelSetupDiffSample {
    created: string[];
    removed: string[];
    unchanged: string[];
}

interface ChannelSetupDiff {
    summary: ChannelSetupDiffSummary;
    samples: ChannelSetupDiffSample;
}

export interface ChannelSetupReview {
    preview: ChannelSetupPreview;
    diff: ChannelSetupDiff;
}

export interface ChannelSetupRecord extends ChannelSetupConfig {
    createdAt: number;
    updatedAt: number;
}

export type ChannelSetupCompletionFailureReason =
    | 'quota-exceeded'
    | 'unavailable'
    | 'missing-active-user';

export type ChannelSetupCompletionResult =
    | { ok: true; record: ChannelSetupRecord }
    | {
        ok: false;
        reason: ChannelSetupCompletionFailureReason;
        message: string;
    };
