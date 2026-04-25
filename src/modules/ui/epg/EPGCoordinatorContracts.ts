import type { ResolvedContentItem } from '../../scheduler/channel-manager';

export type EpgUiStatus = 'pending' | 'initializing' | 'ready' | 'error' | 'disabled' | undefined;

export type EpgGuideSelectionSnapshotSource =
    | 'live-scheduler'
    | 'resolved-immediate'
    | 'on-demand-materialized';

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
