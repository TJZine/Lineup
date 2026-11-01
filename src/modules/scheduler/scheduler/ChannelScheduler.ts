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
    private _pendingReplacement: { config: ScheduleConfig; index: ScheduleIndex; boundary: number } | null = null;
    private _handoff: {
        boundary: number;
        firstEnd: number;
        previousConfig: ScheduleConfig;
        previousIndex: ScheduleIndex;
    } | null = null;

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
        this._pendingReplacement = null;
        this._handoff = null;

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
        this._pendingReplacement = null;
        this._handoff = null;
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
        const pending = this._pendingReplacement;
        if (pending && time >= pending.boundary) {
            return this._clipHandoffProgram(
                calculateProgramAtTime(time, pending.index, pending.config.anchorTime), pending.boundary
            );
        }
        if (this._handoff && time < this._handoff.boundary) {
            return calculateProgramAtTime(time, this._handoff.previousIndex, this._handoff.previousConfig.anchorTime);
        }
        const program = calculateProgramAtTime(time, this._index!, this._config!.anchorTime);
        return this._handoff && time >= this._handoff.boundary && time < this._handoff.firstEnd
            ? { ...program, scheduledStartTime: this._handoff.boundary }
            : program;
    }

    public stageChannelReplacement(config: ScheduleConfig): void {
        this._ensureLoaded();
        if (config.channelId !== this._config!.channelId) {
            throw new Error('A pending replacement must belong to the loaded channel');
        }
        this.syncToCurrentTime();
        const current = this._currentProgram!;
        const normalized = { ...config, anchorTime: Number.isFinite(config.anchorTime) ? config.anchorTime : Date.now() };
        const index = buildScheduleIndex(normalized, this._shuffler);
        this._pendingReplacement = { config: normalized, index, boundary: current.scheduledEndTime };
        this._nextProgram = this._clipHandoffProgram(
            calculateProgramAtTime(current.scheduledEndTime, index, normalized.anchorTime), current.scheduledEndTime
        );
        this._emitter.emit('scheduleSync', this.getState());
    }

    public cancelChannelReplacement(): void {
        if (!this._pendingReplacement) return;
        this._pendingReplacement = null;
        if (this._currentProgram && this._index && this._config) {
            this._nextProgram = calculateNextProgram(this._currentProgram, this._index, this._config.anchorTime);
        }
    }

    public hasPendingChannelReplacement(): boolean { return this._pendingReplacement !== null; }

    public getCurrentProgram(): ScheduledProgram {
        this._ensureLoaded();
        return this.getProgramAtTime(Date.now());
    }

    public getNextProgram(): ScheduledProgram {
        this._ensureLoaded();
        const current = this.getCurrentProgram();
        return this.getProgramAtTime(current.scheduledEndTime);
    }

    public getPreviousProgram(): ScheduledProgram {
        this._ensureLoaded();
        const current = this.getCurrentProgram();
        return this.getProgramAtTime(current.scheduledStartTime - 1);
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
        const pending = this._pendingReplacement;
        const boundary = pending?.boundary ?? this._handoff?.boundary;
        let programs: ScheduledProgram[];
        if (boundary !== undefined && startTime < boundary && endTime > boundary) {
            const oldIndex = pending ? this._index! : this._handoff!.previousIndex;
            const oldAnchor = pending ? this._config!.anchorTime : this._handoff!.previousConfig.anchorTime;
            programs = generateScheduleWindow(startTime, boundary, oldIndex, oldAnchor, programsOutput);
            const firstExcluded = programs.findIndex(program => program.scheduledStartTime >= boundary);
            if (firstExcluded >= 0) programs.length = firstExcluded;
            const newIndex = pending?.index ?? this._index!;
            const newAnchor = pending?.config.anchorTime ?? this._config!.anchorTime;
            const next = generateScheduleWindow(boundary, endTime, newIndex, newAnchor);
            if (next[0]) next[0] = this._clipHandoffProgram(next[0], boundary);
            programs.push(...next);
        } else if (boundary !== undefined && startTime >= boundary) {
            const newIndex = pending?.index ?? this._index!;
            const newAnchor = pending?.config.anchorTime ?? this._config!.anchorTime;
            programs = generateScheduleWindow(startTime, endTime, newIndex, newAnchor, programsOutput);
            if (programs[0] && programs[0].scheduledStartTime < boundary) {
                programs[0] = this._clipHandoffProgram(programs[0], boundary);
            }
        } else {
            const oldIndex = this._handoff?.previousIndex ?? this._index!;
            const oldAnchor = this._handoff?.previousConfig.anchorTime ?? this._config!.anchorTime;
            programs = generateScheduleWindow(startTime, endTime, oldIndex, oldAnchor, programsOutput);
            if (boundary !== undefined) {
                const firstExcluded = programs.findIndex(program => program.scheduledStartTime >= boundary);
                if (firstExcluded >= 0) programs.length = firstExcluded;
            }
        }

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
            current = this.getProgramAtTime(current.scheduledEndTime);
            programs.push(current);
        }

        return programs;
    }

    public syncToCurrentTime(): void {
        if (!this._isActive || !this._config || !this._index) {
            return;
        }

        const now = Date.now();
        this._activatePendingIfDue(now);
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

        this._activatePendingIfDue(time);
        const newProgram = this.getProgramAtTime(time);
        this._updateCurrentProgram(newProgram);
    }


    public jumpToProgram(program: ScheduledProgram): void {
        if (!this._isActive || !this._config || !this._index) {
            return;
        }

        const now = Date.now();
        this._settleDueReplacement(now);
        const pending = this._pendingReplacement;
        const savedFirst = pending && this._clipHandoffProgram(
            calculateProgramAtTime(pending.boundary, pending.index, pending.config.anchorTime), pending.boundary
        );
        if (pending && savedFirst?.item.ratingKey === program.item.ratingKey
            && savedFirst.scheduleIndex === program.scheduleIndex
            && savedFirst.scheduledStartTime === program.scheduledStartTime) {
            this._activatePendingIfDue(pending.boundary);
        }
        const prior = this._handoff;
        const returningToPrior = prior && program.scheduledEndTime <= prior.boundary
            && calculateProgramAtTime(program.scheduledStartTime, prior.previousIndex, prior.previousConfig.anchorTime)
                .item.ratingKey === program.item.ratingKey;
        const replacement = returningToPrior ? { config: this._config!, index: this._index! } : null;
        if (returningToPrior) {
            this._config = prior.previousConfig;
            this._index = prior.previousIndex;
        }
        this.cancelChannelReplacement();
        this._handoff = null;

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
        if (replacement) {
            this._pendingReplacement = {
                ...replacement,
                boundary: this._currentProgram.scheduledEndTime,
            };
        }
        this._nextProgram = this.getProgramAtTime(this._currentProgram.scheduledEndTime);
        this._lastSyncTime = now;

        this._emitter.emit('programStart', this._currentProgram);
    }

    public skipToNext(): void {
        if (!this._isActive || !this._config || !this._index) {
            return;
        }

        this._settleDueReplacement(Date.now());
        const next = this.getNextProgram();
        this.jumpToProgram(next);
    }

    public skipToPrevious(): void {
        if (!this._isActive || !this._config || !this._index) {
            return;
        }

        this._settleDueReplacement(Date.now());
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
            newProgram.scheduledEndTime !== this._currentProgram.scheduledEndTime ||
            newProgram.item.ratingKey !== this._currentProgram.item.ratingKey ||
            newProgram.scheduleIndex !== this._currentProgram.scheduleIndex ||
            newProgram.loopNumber !== this._currentProgram.loopNumber
        );

        if (programChanged) {
            this._emitter.emit('programEnd', this._currentProgram!);
        }

        this._currentProgram = newProgram;
        const pending = this._pendingReplacement;
        this._nextProgram = pending && newProgram.scheduledEndTime >= pending.boundary
            ? this._clipHandoffProgram(
                calculateProgramAtTime(pending.boundary, pending.index, pending.config.anchorTime), pending.boundary
            )
            : calculateNextProgram(newProgram, this._index!, this._config!.anchorTime);
        this._lastSyncTime = Date.now();

        if (programChanged) {
            this._emitter.emit('programStart', newProgram);
        }

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

        this._activatePendingIfDue(now);
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

    private _activatePendingIfDue(time: number): void {
        const pending = this._pendingReplacement;
        if (!pending || time < pending.boundary) return;
        const previousConfig = this._config!;
        const previousIndex = this._index!;
        this._config = pending.config;
        this._index = pending.index;
        this._pendingReplacement = null;
        const first = calculateProgramAtTime(pending.boundary, pending.index, pending.config.anchorTime);
        this._handoff = { boundary: pending.boundary, firstEnd: first.scheduledEndTime, previousConfig, previousIndex };
    }

    private _settleDueReplacement(time: number): void {
        if (!this._pendingReplacement || time < this._pendingReplacement.boundary) return;
        this._activatePendingIfDue(time);
        this._updateCurrentProgram(this.getProgramAtTime(time));
    }

    private _clipHandoffProgram(program: ScheduledProgram, boundary: number): ScheduledProgram {
        return program.scheduledStartTime < boundary && program.scheduledEndTime > boundary
            ? { ...program, scheduledStartTime: boundary }
            : program;
    }
}
