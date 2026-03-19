import type { ResolvedContentItem } from '../../modules/scheduler/channel-manager';

export type GuideSelectionSnapshotSource =
    | 'live-scheduler'
    | 'resolved-immediate'
    | 'on-demand-materialized';

export interface GuideSelectionSnapshot {
    channelId: string;
    ratingKey: string;
    scheduledStartTime: number;
    scheduledEndTime: number;
    source: GuideSelectionSnapshotSource;
    referenceTimeMs: number;
    dayKey: number;
    orderedItems: ResolvedContentItem[];
}
