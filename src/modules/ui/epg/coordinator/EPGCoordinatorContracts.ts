import type { ModuleRuntimeStatus } from '../../../../core/module-status';
import type { ResolvedContentItem } from '../../../scheduler/channel-manager';

export type EpgUiStatus = ModuleRuntimeStatus | undefined;

export type EpgGuideSelectionSnapshotSource =
    | 'live-scheduler'
    | 'resolved-immediate'
    | 'on-demand-materialized';

export interface EpgScheduleRefreshOptions {
    reason?: string;
    debounceMs?: number;
    signal?: AbortSignal | null;
}

export type EpgScheduleRefreshReadiness = 'skipped' | 'ready' | 'partial' | 'failed';

export interface EpgScheduleRefreshResult {
    readiness: EpgScheduleRefreshReadiness;
    attemptedChannelCount: number;
    immediateReadyChannelCount: number;
    backgroundQueuedChannelCount: number;
    failedChannelCount: number;
    staleCacheChannelCount: number;
    firstVisibleScheduleReady: boolean;
}

export interface GuideSelectionSnapshotRequest {
    channelId: string;
    ratingKey: string;
    scheduledStartTime: number;
    scheduledEndTime: number;
    selectedAt: number;
}

export interface EpgGuideSelectionSnapshot {
    channelId: string;
    ratingKey: string;
    scheduledStartTime: number;
    scheduledEndTime: number;
    source: EpgGuideSelectionSnapshotSource;
    referenceTimeMs: number;
    dayKey: number;
    orderedItems: ResolvedContentItem[];
}

export interface EpgChannelSwitchOptions {
    guideSelectionSnapshot?: EpgGuideSelectionSnapshot;
}
