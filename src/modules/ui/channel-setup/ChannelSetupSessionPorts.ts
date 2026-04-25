import type { PlexLibrarySection } from '../../plex/library';

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

export interface ChannelBuildProgress {
    task: 'fetch_playlists' | 'fetch_collections' | 'scan_library_items' | 'build_pending' | 'create_channels' | 'apply_channels' | 'refresh_epg' | 'done';
    label: string;
    detail: string;
    current: number;
    total: number | null;
}

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
export type ChannelSetupPreviewFailureReason = 'unsupported' | 'empty' | 'timeout' | 'error';

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

export type ChannelSetupPlannerFacetFamily = 'genres' | 'directors' | 'decades' | 'studios' | 'actors';

export interface ChannelSetupPlannerLibraryCount {
    libraryId: string;
    libraryName: string;
    count: number;
}

export interface ChannelSetupPlannerCountSample {
    title: string;
    count: number;
}

export interface ChannelSetupPlannerFacetCountDiagnostics {
    libraryId: string;
    libraryName: string;
    rawTagCount: number;
    effectiveCandidateCount: number;
    candidatesWithKnownCount: number;
    candidatesWithUnknownCount: number;
    candidatesBelowMinItems: number;
    minKnownCount: number | null;
    maxKnownCount: number | null;
    sampleKnownCounts: ChannelSetupPlannerCountSample[];
    sampleUnknownCountTitles: string[];
    sampleBelowMinItems: ChannelSetupPlannerCountSample[];
}

export interface ChannelSetupPlannerDiagnostics {
    effectiveMaxChannels: number;
    minItems: number;
    fetchedTagsByFamily: Record<ChannelSetupPlannerFacetFamily, ChannelSetupPlannerLibraryCount[]>;
    tagCountDiagnosticsByFamily: Record<ChannelSetupPlannerFacetFamily, ChannelSetupPlannerFacetCountDiagnostics[]>;
    candidatesBeforeMinItems: ChannelSetupEstimates;
    candidatesAfterMinItems: ChannelSetupEstimates;
    strategyBucketSizes: ChannelSetupEstimates;
    afterAlternateLineups: ChannelSetupEstimates;
    afterVariants: ChannelSetupEstimates;
    afterMaxChannels: ChannelSetupEstimates;
    lostToMaxChannels: ChannelSetupEstimates;
}

export interface ChannelSetupPlanDiagnosticsResult {
    status: 'ready' | 'blocked' | 'slow';
    diagnostics: ChannelSetupPlannerDiagnostics | null;
    warnings: string[];
    reachedMaxChannels: boolean;
    message?: string;
    failureReason?: ChannelSetupPreviewFailureReason;
}

export const CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE = 'Channel setup not initialized';

export class ChannelSetupWorkflowUnavailableError extends Error {
    constructor(message: string = CHANNEL_SETUP_WORKFLOW_UNAVAILABLE_MESSAGE) {
        super(message);
        this.name = 'ChannelSetupWorkflowUnavailableError';
    }
}

export function isChannelSetupWorkflowUnavailableError(error: unknown): boolean {
    return (
        error instanceof ChannelSetupWorkflowUnavailableError
        || (
            error instanceof Error
            && error.name === 'ChannelSetupWorkflowUnavailableError'
        )
    );
}

export interface ChannelSetupSessionWorkflowPort {
    invalidateFacetSnapshot(): void;
    getLibrariesForSetup(signal?: AbortSignal | null): Promise<PlexLibrarySection[]>;
    getChannelSetupRecord(serverId: string): ChannelSetupRecord | null;
    getSetupContextForSelectedServer(): ChannelSetupContext;
    getSetupPreview(config: ChannelSetupConfig, options?: { signal?: AbortSignal }): Promise<ChannelSetupPreview>;
    getSetupReview(config: ChannelSetupConfig, options?: { signal?: AbortSignal }): Promise<ChannelSetupReview>;
    getSetupPlanDiagnostics(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSetupPlanDiagnosticsResult>;
    createChannelsFromSetup(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal; onProgress?: (p: ChannelBuildProgress) => void }
    ): Promise<ChannelBuildSummary>;
    markSetupComplete(serverId: string, setupConfig: ChannelSetupConfig): void;
}
