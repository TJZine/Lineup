import type {
    ScheduleConfig,
    ScheduledProgram,
    ScheduleWindow,
    SchedulerState,
    ScheduleIndex,
} from './types';

export interface IShuffleGenerator {
    /** Same seed always produces the same order. */
    shuffle<T>(items: T[], seed: number): T[];

    shuffleIndices(count: number, seed: number): number[];

    generateSeed(channelId: string, anchorTime: number): number;
}

export interface IChannelScheduler {
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

    getProgramAtTime(time: number): ScheduledProgram;

    getCurrentProgram(): ScheduledProgram;

    getNextProgram(): ScheduledProgram;

    getPreviousProgram(): ScheduledProgram;

    getScheduleWindow(
        startTime: number,
        endTime: number,
        output?: ScheduledProgram[]
    ): ScheduleWindow;

    getUpcoming(count: number, output?: ScheduledProgram[]): ScheduledProgram[];

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

    getScheduleIndex(): ScheduleIndex;

    on(event: 'programStart', handler: (program: ScheduledProgram) => void): void;

    on(event: 'programEnd', handler: (program: ScheduledProgram) => void): void;

    on(event: 'scheduleSync', handler: (state: SchedulerState) => void): void;

    off(event: 'programStart', handler: (program: ScheduledProgram) => void): void;

    off(event: 'programEnd', handler: (program: ScheduledProgram) => void): void;

    off(event: 'scheduleSync', handler: (state: SchedulerState) => void): void;
}
