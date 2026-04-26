import type {
    ScheduleConfig,
    ScheduledProgram,
    ScheduleWindow,
    SchedulerState,
    ScheduleIndex,
} from './types';

/**
 * Uses Mulberry32 PRNG for reproducible shuffles.
 */
export interface IShuffleGenerator {
    /**
     * Same seed always produces the same order.
     */
    shuffle<T>(items: T[], seed: number): T[];

    shuffleIndices(count: number, seed: number): number[];

    generateSeed(channelId: string, anchorTime: number): number;
}

/**
 * Manages deterministic schedule generation and time-based queries.
 */
export interface IChannelScheduler {
    /**
     * Starts the sync timer and emits initial programStart event.
     * @throws Error if config.content is empty
     */
    loadChannel(config: ScheduleConfig): void;

    unloadChannel(): void;

    /**
     * Pause the sync timer without unloading the channel.
     * This preserves loaded channel state (config/index/current/next).
     *
     * Idempotent: calling when already paused or before loadChannel() is a no-op.
     */
    pauseSyncTimer(): void;

    /**
     * Resume the sync timer without re-loading the channel.
     *
     * Idempotent: calling when already running or before loadChannel() is a no-op.
     */
    resumeSyncTimer(): void;

    /**
     * Uses O(log n) binary search for efficient lookup.
     * @throws Error if no channel is loaded
     */
    getProgramAtTime(time: number): ScheduledProgram;

    /**
     * @throws Error if no channel is loaded
     */
    getCurrentProgram(): ScheduledProgram;

    /**
     * @throws Error if no channel is loaded
     */
    getNextProgram(): ScheduledProgram;

    /**
     * @throws Error if no channel is loaded
     */
    getPreviousProgram(): ScheduledProgram;

    /**
     * Includes partial programs at boundaries.
     * @throws Error if no channel is loaded or invalid range
     */
    getScheduleWindow(
        startTime: number,
        endTime: number,
        output?: ScheduledProgram[]
    ): ScheduleWindow;

    /**
     * @throws Error if no channel is loaded
     */
    getUpcoming(count: number, output?: ScheduledProgram[]): ScheduledProgram[];

    /**
     * Emits programEnd/programStart events if program changed.
     * Always emits scheduleSync event.
     */
    syncToCurrentTime(): void;

    isScheduleStale(currentTime: number): boolean;

    recalculateFromTime(time: number): void;

    jumpToProgram(program: ScheduledProgram): void;

    /**
     * Emits programEnd for current and programStart for next.
     */
    skipToNext(): void;

    /**
     * Emits programEnd for current and programStart for previous.
     */
    skipToPrevious(): void;

    getState(): SchedulerState;

    /**
     * @throws Error if no channel is loaded
     */
    getScheduleIndex(): ScheduleIndex;

    on(event: 'programStart', handler: (program: ScheduledProgram) => void): void;

    on(event: 'programEnd', handler: (program: ScheduledProgram) => void): void;

    on(event: 'scheduleSync', handler: (state: SchedulerState) => void): void;

    off(event: 'programStart', handler: (program: ScheduledProgram) => void): void;

    off(event: 'programEnd', handler: (program: ScheduledProgram) => void): void;

    off(event: 'scheduleSync', handler: (state: SchedulerState) => void): void;
}
