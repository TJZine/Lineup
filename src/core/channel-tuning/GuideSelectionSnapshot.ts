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

export type GuideSelectionSnapshotValidation =
    | { valid: true; snapshot: GuideSelectionSnapshot }
    | { valid: false; snapshot: null; reason: string | null };

export function validateGuideSelectionSnapshot(
    snapshot: GuideSelectionSnapshot | undefined,
    channelId: string,
    expectedDayKey: number
): GuideSelectionSnapshotValidation {
    if (!snapshot) return { valid: false, snapshot: null, reason: null };
    if (snapshot.channelId !== channelId) {
        return { valid: false, snapshot: null, reason: 'channel-mismatch' };
    }
    if (snapshot.dayKey !== expectedDayKey) {
        return { valid: false, snapshot: null, reason: 'day-mismatch' };
    }
    if (
        !Number.isFinite(snapshot.scheduledStartTime)
        || !Number.isFinite(snapshot.scheduledEndTime)
        || snapshot.scheduledStartTime >= snapshot.scheduledEndTime
    ) {
        return { valid: false, snapshot: null, reason: 'invalid-program-window' };
    }
    if (!Array.isArray(snapshot.orderedItems) || snapshot.orderedItems.length === 0) {
        return { valid: false, snapshot: null, reason: 'missing-items' };
    }
    if (!snapshot.orderedItems.some((item) => item.ratingKey === snapshot.ratingKey)) {
        return { valid: false, snapshot: null, reason: 'rating-key-mismatch' };
    }
    return { valid: true, snapshot };
}
