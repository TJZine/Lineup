import type { ModuleRuntimeStatus } from '../../../../core/module-status';
export type { EpgScheduleRefreshReadiness, EpgScheduleRefreshResult } from '../../../../shared/epgRefresh';
import type { ResolvedContentItem } from '../../../scheduler/channel-manager';
import type { EpgRetainedOperationContext } from '../runtime/EPGRetainedOperationContext';

export type EpgUiStatus = ModuleRuntimeStatus | undefined;

export type EpgGuideSelectionSnapshotSource =
    | 'live-scheduler'
    | 'resolved-immediate'
    | 'on-demand-materialized';

export interface EpgScheduleRefreshOptions {
    reason?: string;
    debounceMs?: number;
    signal?: AbortSignal | null;
    operationContext?: EpgRetainedOperationContext;
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
