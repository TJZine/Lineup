export type {
    PlaybackMode,
    ResolvedContentItem,
    ResolvedChannelContent,
} from '../channel-manager/types';

export type SchedulerPlaybackMode = Exclude<
    import('../channel-manager/types').PlaybackMode,
    'random'
>;

import type { StreamDescriptor } from '../../player/types';
export type { StreamDescriptor };

export interface ScheduleConfig {
    channelId: string;
    /** Schedule anchor timestamp (ms) */
    anchorTime: number;
    /** Resolved content items (scheduler applies playback ordering internally) */
    content: import('../channel-manager/types').ResolvedContentItem[];
    playbackMode: SchedulerPlaybackMode;
    /** Shuffle seed for deterministic ordering */
    shuffleSeed: number;
    /** Optional block size (used when playbackMode === 'block') */
    blockSize?: number;
    /** Whether to loop (always true for linear channels) */
    loopSchedule: boolean;
}

export interface ScheduledProgram {
    item: import('../channel-manager/types').ResolvedContentItem;
    /** Scheduled start time (Unix ms) */
    scheduledStartTime: number;
    /** Scheduled end time (Unix ms) */
    scheduledEndTime: number;
    /** Time elapsed since program started (ms) */
    elapsedMs: number;
    /** Time remaining in program (ms) */
    remainingMs: number;
    scheduleIndex: number;
    loopNumber: number;
    /** Stream info for playback (resolved on demand) */
    streamDescriptor: StreamDescriptor | null;
    isCurrent: boolean;
}

export interface ScheduleWindow {
    /** Window start time (Unix ms) */
    startTime: number;
    /** Window end time (Unix ms) */
    endTime: number;
    programs: ScheduledProgram[];
}

export interface ScheduleIndex {
    channelId: string;
    generatedAt: number;
    /** Total duration of one complete loop (ms) */
    totalLoopDurationMs: number;
    /** Cumulative start offsets for each item within a loop */
    itemStartOffsets: number[];
    /** Ordered items after playback-mode transforms */
    orderedItems: import('../channel-manager/types').ResolvedContentItem[];
}

export interface SchedulerState {
    channelId: string;
    isActive: boolean;
    currentProgram: ScheduledProgram | null;
    nextProgram: ScheduledProgram | null;
    schedulePosition: {
        loopNumber: number;
        itemIndex: number;
        /** Offset within current item (ms) */
        offsetMs: number;
    };
    lastSyncTime: number;
    /** Whether this state resulted from a hard resync */
    wasHardResync?: boolean;
    /** Detected drift in ms (if hard resync) */
    detectedDriftMs?: number;
}

export interface ShuffleResult {
    shuffledIndices: number[];
    seed: number;
}

export interface SyncTimerState {
    /** Expected timestamp of next tick */
    expectedNextTick: number;
    /** Maximum acceptable drift (ms) */
    maxDriftMs: number;
    /** Threshold for hard resync (ms) */
    resyncThreshold: number;
    interval: ReturnType<typeof setInterval> | null;
}

export interface SchedulerEventMap {
    /** Emitted when a new program starts */
    programStart: ScheduledProgram;
    /** Emitted when a program ends */
    programEnd: ScheduledProgram;
    /** Emitted on each sync tick */
    scheduleSync: SchedulerState;
    /** Index for typed EventEmitter */
    [key: string]: unknown;
}
