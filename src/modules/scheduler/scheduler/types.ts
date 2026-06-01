export type {
    PlaybackMode,
    ResolvedContentItem,
    ResolvedChannelContent,
} from '../channel-manager/contracts/types';

export type SchedulerPlaybackMode = Exclude<
    import('../channel-manager/contracts/types').PlaybackMode,
    'random'
>;

export interface ScheduleConfig {
    channelId: string;
    anchorTime: number;
    /** Scheduler timelines continuously loop through this indexed content. */
    content: import('../channel-manager/contracts/types').ResolvedContentItem[];
    playbackMode: SchedulerPlaybackMode;
    shuffleSeed: number;
    blockSize?: number;
}

export interface ScheduledProgram {
    item: import('../channel-manager/contracts/types').ResolvedContentItem;
    scheduledStartTime: number;
    scheduledEndTime: number;
    elapsedMs: number;
    remainingMs: number;
    scheduleIndex: number;
    loopNumber: number;
    isCurrent: boolean;
}

export interface ScheduleWindow {
    startTime: number;
    endTime: number;
    programs: ScheduledProgram[];
}

export interface ScheduleIndex {
    channelId: string;
    generatedAt: number;
    totalLoopDurationMs: number;
    itemStartOffsets: number[];
    orderedItems: import('../channel-manager/contracts/types').ResolvedContentItem[];
}

export interface SchedulerState {
    channelId: string;
    isActive: boolean;
    currentProgram: ScheduledProgram | null;
    nextProgram: ScheduledProgram | null;
    schedulePosition: {
        loopNumber: number;
        itemIndex: number;
        offsetMs: number;
    };
    lastSyncTime: number;
    /** Whether this state resulted from a hard resync */
    wasHardResync?: boolean;
    /** Detected drift in ms (if hard resync) */
    detectedDriftMs?: number;
}

export interface SyncTimerState {
    expectedNextTick: number;
    maxDriftMs: number;
    resyncThreshold: number;
    interval: ReturnType<typeof setInterval> | null;
}

export interface SchedulerEventMap {
    programStart: ScheduledProgram;
    programEnd: ScheduledProgram;
    scheduleSync: SchedulerState;
}
