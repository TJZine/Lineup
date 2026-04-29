import { EventEmitter } from '../../../utils/EventEmitter';
import type { IChannelScheduler, IShuffleGenerator } from './interfaces';
import type {
    ScheduleConfig,
    ScheduledProgram,
    ScheduleWindow,
    SchedulerState,
    ScheduleIndex,
    SchedulerEventMap,
    SyncTimerState,
} from './types';
import { ShuffleGenerator } from './ShuffleGenerator';
import {
    buildScheduleIndex,
    calculateProgramAtTime,
    calculateNextProgram,
    calculatePreviousProgram,
    generateScheduleWindow,
} from './ScheduleCalculator';
import {
    SYNC_INTERVAL_MS,
    MAX_DRIFT_MS,
    RESYNC_THRESHOLD_MS,
    SCHEDULER_ERROR_MESSAGES,
} from './constants';

export class ChannelScheduler implements IChannelScheduler {

    private readonly _emitter: EventEmitter<SchedulerEventMap>;
    private readonly _shuffler: IShuffleGenerator;

    private _config: ScheduleConfig | null = null;
    private _index: ScheduleIndex | null = null;
    private _isActive = false;
    private _currentProgram: ScheduledProgram | null = null;
    private _nextProgram: ScheduledProgram | null = null;
    private _lastSyncTime = 0;

    private _syncTimerState: SyncTimerState = {
        expectedNextTick: 0,
        maxDriftMs: MAX_DRIFT_MS,
        resyncThreshold: RESYNC_THRESHOLD_MS,
        interval: null,
    };

    constructor(shuffler?: IShuffleGenerator) {
        this._emitter = new EventEmitter<SchedulerEventMap>();
        this._shuffler = shuffler || new ShuffleGenerator();
    }


    public loadChannel(config: ScheduleConfig): void {
        if (!config.content || config.content.length === 0) {
            throw new Error(SCHEDULER_ERROR_MESSAGES.EMPTY_CHANNEL);
        }

        this._stopSyncTimer();

        // Zero (epoch) and negative timestamps are valid deterministic anchors.
        // Fall back only for non-finite input.
        let anchorTime = config.anchorTime;
        if (!Number.isFinite(anchorTime)) {
            anchorTime = Date.now();
        }

        this._config = { ...config, anchorTime };

        this._index = buildScheduleIndex(this._config, this._shuffler);

        this._isActive = true;
        this._lastSyncTime = Date.now();

        this._currentProgram = this.getProgramAtTime(Date.now());
        this._nextProgram = calculateNextProgram(
            this._currentProgram,
            this._index,
            this._config.anchorTime
        );

        this._startSyncTimer();

        this._emitter.emit('programStart', this._currentProgram);
    }

    public unloadChannel(): void {
        this._stopSyncTimer();
        this._config = null;
        this._index = null;
        this._isActive = false;
        this._currentProgram = null;
        this._nextProgram = null;
        this._lastSyncTime = 0;
    }

    public pauseSyncTimer(): void {
        this._stopSyncTimer();
    }

    public resumeSyncTimer(): void {
        if (!this._isActive || !this._config || !this._index) {
            return;
        }
        if (this._syncTimerState.interval !== null) {
            return;
        }
        this._startSyncTimer();
    }

    public getProgramAtTime(time: number): ScheduledProgram {
        this._ensureLoaded();
        return calculateProgramAtTime(time, this._index!, this._config!.anchorTime);
    }

    public getCurrentProgram(): ScheduledProgram {
        this._ensureLoaded();
        return this.getProgramAtTime(Date.now());
    }

    public getNextProgram(): ScheduledProgram {
        this._ensureLoaded();
        const current = this.getCurrentProgram();
        return calculateNextProgram(current, this._index!, this._config!.anchorTime);
    }

    public getPreviousProgram(): ScheduledProgram {
        this._ensureLoaded();
        const current = this.getCurrentProgram();
        return calculatePreviousProgram(current, this._index!, this._config!.anchorTime);
    }


    public getScheduleWindow(
        startTime: number,
        endTime: number,
        output?: ScheduledProgram[]
    ): ScheduleWindow {
        this._ensureLoaded();

        if (startTime >= endTime) {
            throw new Error(SCHEDULER_ERROR_MESSAGES.INVALID_TIME_RANGE);
        }

        const programsOutput = output ?? [];
        const programs = generateScheduleWindow(
            startTime,
            endTime,
            this._index!,
            this._config!.anchorTime,
            programsOutput
        );

        return {
            startTime,
            endTime,
            programs,
        };
    }

    public getUpcoming(count: number, output?: ScheduledProgram[]): ScheduledProgram[] {
        this._ensureLoaded();

        const programs = output ?? [];
        programs.length = 0;

        if (count <= 0) {
            return programs;
        }

        let current = this.getCurrentProgram();
        programs.push(current);

        for (let i = 1; i < count; i++) {
            current = calculateNextProgram(current, this._index!, this._config!.anchorTime);
            programs.push(current);
        }

        return programs;
    }

    public syncToCurrentTime(): void {
        if (!this._isActive || !this._config || !this._index) {
            return;
        }

        const now = Date.now();
        const newCurrentProgram = this.getProgramAtTime(now);

        this._updateCurrentProgram(newCurrentProgram);

        this._emitter.emit('scheduleSync', this.getState());
    }

    public isScheduleStale(currentTime: number): boolean {
        if (!this._currentProgram) {
            return true;
        }

        // Staleness is based on sync drift, not only program boundaries.
        const drift = Math.abs(currentTime - this._lastSyncTime);
        return drift > RESYNC_THRESHOLD_MS;
    }

    public recalculateFromTime(time: number): void {
        if (!this._isActive || !this._config || !this._index) {
            return;
        }

        const newProgram = this.getProgramAtTime(time);
        this._updateCurrentProgram(newProgram);
    }


    public jumpToProgram(program: ScheduledProgram): void {
        if (!this._isActive || !this._config || !this._index) {
            return;
        }

        const now = Date.now();

        // Shift the anchor so the selected program remains current across sync ticks.
        const programPositionInLoop = this._index.itemStartOffsets[program.scheduleIndex] ?? 0;
        const loopOffset = program.loopNumber * this._index.totalLoopDurationMs;
        const programStartFromAnchor = loopOffset + programPositionInLoop;

        const trueElapsed = now - program.scheduledStartTime;

        // If program is "live" (within duration), preserve schedule (resume).
        // Otherwise (future/past), shift schedule to start from beginning.
        const isLive = trueElapsed >= 0 && trueElapsed < program.item.durationMs;
        const effectiveElapsed = isLive ? trueElapsed : 0;

        const newAnchorTime = now - effectiveElapsed - programStartFromAnchor;

        this._config = { ...this._config, anchorTime: newAnchorTime };

        // Note: No need to rebuild index - orderedItems, itemStartOffsets, and
        // totalLoopDurationMs are independent of anchorTime (same seed = same shuffle).
        // All time calculations use _config.anchorTime, not index data.

        if (this._currentProgram) {
            this._emitter.emit('programEnd', this._currentProgram);
        }

        this._currentProgram = this.getProgramAtTime(now);
        this._nextProgram = calculateNextProgram(this._currentProgram, this._index, this._config.anchorTime);
        this._lastSyncTime = now;

        this._emitter.emit('programStart', this._currentProgram);
    }

    public skipToNext(): void {
        if (!this._isActive || !this._config || !this._index) {
            return;
        }

        const next = this.getNextProgram();
        this.jumpToProgram(next);
    }

    public skipToPrevious(): void {
        if (!this._isActive || !this._config || !this._index) {
            return;
        }

        const previous = this.getPreviousProgram();
        // Skip-back restarts the program instead of resuming at the queried elapsed position.
        const resetProgram = {
            ...previous,
            elapsedMs: 0,
            remainingMs: previous.item.durationMs,
        };
        this.jumpToProgram(resetProgram);
    }


    public getState(): SchedulerState {
        const channelId = this._config?.channelId || '';
        const currentProgram = this._currentProgram;

        return {
            channelId,
            isActive: this._isActive,
            currentProgram,
            nextProgram: this._nextProgram,
            schedulePosition: {
                loopNumber: currentProgram?.loopNumber || 0,
                itemIndex: currentProgram?.scheduleIndex || 0,
                offsetMs: currentProgram?.elapsedMs || 0,
            },
            lastSyncTime: this._lastSyncTime,
        };
    }

    public getScheduleIndex(): ScheduleIndex {
        this._ensureLoaded();
        return this._index!;
    }

    public on(event: 'programStart', handler: (program: ScheduledProgram) => void): void;
    public on(event: 'programEnd', handler: (program: ScheduledProgram) => void): void;
    public on(event: 'scheduleSync', handler: (state: SchedulerState) => void): void;
    public on(
        event: 'programStart' | 'programEnd' | 'scheduleSync',
        handler: ((program: ScheduledProgram) => void) | ((state: SchedulerState) => void)
    ): void {
        this._emitter.on(event, handler as (payload: unknown) => void);
    }

    public off(
        event: 'programStart' | 'programEnd' | 'scheduleSync',
        handler: ((program: ScheduledProgram) => void) | ((state: SchedulerState) => void)
    ): void {
        this._emitter.off(event, handler as (payload: unknown) => void);
    }

    private _ensureLoaded(): void {
        if (!this._config || !this._index) {
            throw new Error(SCHEDULER_ERROR_MESSAGES.NO_CHANNEL_LOADED);
        }
    }

    private _updateCurrentProgram(newProgram: ScheduledProgram): boolean {
        const programChanged = this._currentProgram && (
            newProgram.scheduledStartTime !== this._currentProgram.scheduledStartTime ||
            newProgram.scheduledEndTime !== this._currentProgram.scheduledEndTime
        );

        if (programChanged) {
            this._emitter.emit('programEnd', this._currentProgram!);
            this._emitter.emit('programStart', newProgram);
        }

        this._currentProgram = newProgram;
        this._nextProgram = calculateNextProgram(newProgram, this._index!, this._config!.anchorTime);
        this._lastSyncTime = Date.now();

        return !!programChanged;
    }

    private _startSyncTimer(): void {
        this._syncTimerState.expectedNextTick = Date.now() + SYNC_INTERVAL_MS;

        this._syncTimerState.interval = globalThis.setInterval(() => {
            const now = Date.now();
            const drift = now - this._syncTimerState.expectedNextTick;

            if (Math.abs(drift) < this._syncTimerState.maxDriftMs) {
                this.syncToCurrentTime();
                this._syncTimerState.expectedNextTick = now + SYNC_INTERVAL_MS;
                return;
            }

            // Large drift indicates suspended/inactive time; hard resync from wall clock.
            if (drift > this._syncTimerState.resyncThreshold) {
                console.warn(
                    '[Scheduler] Timer drift detected: ' + drift + 'ms, performing hard resync'
                );
                this._hardResync();
                this._syncTimerState.expectedNextTick = now + SYNC_INTERVAL_MS;
                return;
            }

            this.syncToCurrentTime();

            // Only compensate for positive drift (timer running late)
            // Negative drift is unusual and shouldn't push expectedNextTick forward
            if (drift > 0) {
                const adjustment = Math.min(drift, 100); // Cap adjustment at 100ms
                this._syncTimerState.expectedNextTick = now + SYNC_INTERVAL_MS - adjustment;
            } else {
                this._syncTimerState.expectedNextTick = now + SYNC_INTERVAL_MS;
            }
        }, SYNC_INTERVAL_MS);
    }

    private _stopSyncTimer(): void {
        if (this._syncTimerState.interval !== null) {
            globalThis.clearInterval(this._syncTimerState.interval);
            this._syncTimerState.interval = null;
        }
    }

    private _hardResync(): void {
        if (!this._config || !this._index) {
            return;
        }

        const now = Date.now();
        const previousCurrent = this._currentProgram;

        const currentProgram = this.getProgramAtTime(now);
        this._updateCurrentProgram(currentProgram);

        const previousEndTime = previousCurrent
            ? previousCurrent.scheduledEndTime
            : now;
        const state: SchedulerState = {
            ...this.getState(),
            wasHardResync: true,
            detectedDriftMs: now - previousEndTime,
        };
        this._emitter.emit('scheduleSync', state);
    }
}
