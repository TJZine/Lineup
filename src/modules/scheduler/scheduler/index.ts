export { ChannelScheduler } from './ChannelScheduler';
export { ShuffleGenerator } from './ShuffleGenerator';
export {
    buildScheduleIndex,
    binarySearchForItem,
    calculateProgramAtTime,
    calculateNextProgram,
    calculatePreviousProgram,
    applyPlaybackMode,
    generateScheduleWindow,
} from './ScheduleCalculator';

export type { IChannelScheduler, IShuffleGenerator } from './interfaces';

export type {
    ScheduleConfig,
    ScheduledProgram,
    ScheduleWindow,
    SchedulerState,
    ScheduleIndex,
    SchedulerEventMap,
    PlaybackMode,
    ResolvedContentItem,
} from './types';

export {
    buildScheduledProgramIdentity,
    buildScheduledProgramIdentityFromState,
    createScheduledProgramIdentityKey,
    scheduledProgramIdentitiesMatch,
} from './programIdentity';

export type { ScheduledProgramIdentity } from './programIdentity';

export {
    SYNC_INTERVAL_MS,
    MAX_DRIFT_MS,
    RESYNC_THRESHOLD_MS,
    SCHEDULER_ERROR_MESSAGES,
} from './constants';
