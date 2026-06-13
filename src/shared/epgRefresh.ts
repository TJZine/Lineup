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
