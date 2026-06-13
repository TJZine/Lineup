import type {
    ChannelConfig,
    IChannelManager,
    ResolvedChannelContent,
} from '../../../scheduler/channel-manager';
import type { IChannelScheduler, ShuffleGenerator } from '../../../scheduler/scheduler';
import type { IEPGComponent } from '../interfaces';
import type { EpgVisibleRange } from '../types';

export type BackgroundDebugState = {
    refreshId: number;
    rangeKey: string;
    refreshStartedAt: number;
    logCount: number;
    immediateLoadedCount: number;
    backgroundLoadedCount: number;
    cacheHits: number;
    cacheMisses: number;
    firstVisibleScheduleReadyMs: number | null;
};

export type AppliedScheduleSource =
    | 'live-scheduler'
    | 'schedule-cache'
    | 'schedule-cache-stale'
    | 'resolved-immediate'
    | 'resolved-background';

export type SelectedRowSnapshotSeed = {
    channelId: string;
    source: 'resolved-immediate';
    dayKey: number;
    referenceTimeMs: number;
    orderedItems: ResolvedChannelContent['items'];
};

export type RefreshPhase = 'immediate' | 'background';
export type ScheduleCachePolicy = 'persist' | 'skip';

export type RefreshMetrics = {
    cacheHits: number;
    staleCacheHits: number;
    cacheMisses: number;
    inFlightSkipped: number;
    alreadyLoaded: number;
    liveScheduleHits: number;
    immediateReadyChannelIds: Set<string>;
    immediateFastReadyChannelIds: Set<string>;
    backgroundLoadedChannelIds: Set<string>;
    backgroundFastReadyChannelIds: Set<string>;
    immediateLoadedCount: number;
    backgroundLoadedCount: number;
    failedChannelCount: number;
    firstVisibleScheduleReadyMs: number | null;
};

export type RefreshSession = {
    refreshId: number;
    reason: string;
    refreshStartedAt: number;
    range: EpgVisibleRange;
    signal?: AbortSignal | null;
    epg: IEPGComponent;
    channelManager: IChannelManager;
    scheduler: IChannelScheduler | null;
    startTime: number;
    endTime: number;
    rangeKey: string;
    forceRefresh: boolean;
    debugEnabled: boolean;
    immediateChannels: ChannelConfig[];
    backgroundChannels: ChannelConfig[];
    immediateConcurrency: number;
    backgroundConcurrency: number;
    inFlightKept: number;
    inFlightAborted: number;
    visibleRangeIds: Set<string>;
    liveChannelId: string | null;
    focusedChannelId: string | null;
    bufferedRange: { start: number; end: number };
    backgroundRange: { start: number; end: number };
    overscan: number;
    shuffler: ShuffleGenerator;
};
