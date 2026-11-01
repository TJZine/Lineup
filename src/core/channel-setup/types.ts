import type { EpgScheduleRefreshResult } from '../../shared/epgRefresh';
import type { ChannelSetupCandidateRow } from './build/ChannelSetupPreparedCandidate';
import type { ChannelSetupInventory } from './planning/ChannelSetupInventory';

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
    basePlaybackMode: 'shuffle' | 'sequential' | 'block' | 'random';
    baseBlockSize: number;
    /** Optional lineup seed; each generated source derives its own stable seed from it. */
    lineupSeed?: number;
    /** Optional epoch milliseconds; omitted keeps the existing anchor policy. */
    startTimeAnchor?: number;
    /** Block playback only. Omitted retains legacy inclusion of specials. */
    includeSpecials?: boolean;
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

export type ChannelSetupRerunRequestResult =
    | { ok: true; serverId: string }
    | { ok: false; reason: 'missing-selected-server' };

export type ChannelSetupGuideRefreshFailureStage =
    | 'prepare'
    | 'ensure_initialized'
    | 'prime_channels'
    | 'refresh_schedules';

export type ChannelSetupGuideRefreshSummary =
    | {
        kind: 'completed';
        result: EpgScheduleRefreshResult;
    }
    | {
        kind: 'failed';
        failure: {
            kind: 'thrown';
            stage: ChannelSetupGuideRefreshFailureStage;
        };
    }
    | {
        kind: 'interrupted';
        interruption: {
            kind: 'aborted';
            stage: ChannelSetupGuideRefreshFailureStage;
        };
    };

export interface ChannelBuildSummary {
    created: number;
    skipped: number;
    reachedMaxChannels: boolean;
    errorCount: number;
    canceled: boolean;
    noChange?: boolean;
    pointerWarning?: boolean;
    warnings?: string[];
    guideRefresh?: ChannelSetupGuideRefreshSummary;
    initialChannelNumber?: number;
    lastTask?: ChannelBuildProgress['task'] | 'init';
}

export type ChannelSetupApplyFailure = 'consent' | 'stale' | 'source' | 'invalid' | 'conflict' | 'storage-failure';

export type ChannelSetupApplyResult =
    | { kind: 'committed'; summary: ChannelBuildSummary }
    | { kind: 'no-change'; summary: ChannelBuildSummary }
    | { kind: 'blocked'; message: string; reason: ChannelSetupApplyFailure }
    | { kind: 'canceled' };

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
    preparedId?: string;
    rows?: readonly ChannelSetupCandidateRow[];
    inventory?: ChannelSetupInventory;
    oldChannelCount?: number | null;
    requiresWholeLineupReplacement?: boolean;
}

export interface ChannelSetupRecord extends ChannelSetupConfig {
    createdAt: number;
    updatedAt: number;
}

export type ChannelSetupCompletionFailureReason =
    | 'quota-exceeded'
    | 'unavailable'
    | 'missing-active-user'
    | 'scope-changed';

export type ChannelSetupCompletionResult =
    | { ok: true; record: ChannelSetupRecord }
    | {
        ok: false;
        reason: ChannelSetupCompletionFailureReason;
        message: string;
    };
