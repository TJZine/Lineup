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

export type EpgReadyScheduleRefreshResult = Omit<EpgScheduleRefreshResult, 'readiness'> & {
    readiness: 'ready';
};

export type EpgDegradedScheduleRefreshResult = Omit<EpgScheduleRefreshResult, 'readiness'> & {
    readiness: Exclude<EpgScheduleRefreshReadiness, 'ready'>;
};

export type EpgScheduleRefreshOutcome =
    | { kind: 'succeeded'; result: EpgReadyScheduleRefreshResult }
    | { kind: 'degraded'; result: EpgDegradedScheduleRefreshResult }
    | { kind: 'failed'; error: unknown };

export function createSkippedEpgScheduleRefreshResult(): EpgScheduleRefreshResult {
    return {
        readiness: 'skipped',
        attemptedChannelCount: 0,
        immediateReadyChannelCount: 0,
        backgroundQueuedChannelCount: 0,
        failedChannelCount: 0,
        staleCacheChannelCount: 0,
        firstVisibleScheduleReady: false,
    };
}
