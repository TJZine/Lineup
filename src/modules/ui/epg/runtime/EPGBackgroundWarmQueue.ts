import type { ChannelConfig } from '../../../scheduler/channel-manager';
import { getBackgroundWarmQueueAction } from '../coordinator/EPGCoordinatorPolicies';

export const EPG_BACKGROUND_WARM_IDLE_TIMEOUT_MS = 120;
export const EPG_BACKGROUND_WARM_TIMER_DELAY_MS = 24;
export const EPG_BACKGROUND_WARM_BACKPRESSURE_DELAY_MS = 120;

type IdleDeadlineLike = {
    didTimeout: boolean;
    timeRemaining: () => number;
};

type IdleSchedulerLike = typeof globalThis & {
    requestIdleCallback?: (
        callback: (deadline: IdleDeadlineLike) => void,
        options?: { timeout: number }
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
};

export interface EPGBackgroundWarmQueueStartOptions {
    refreshId: number;
    reason: string;
    channels: ChannelConfig[];
    refreshChannelSchedule: (channel: ChannelConfig) => Promise<void>;
    concurrency: number;
    onSettled?: () => void;
    assertCurrent?: () => void;
    shouldContinue?: () => boolean;
}

interface BackgroundWarmQueueState extends EPGBackgroundWarmQueueStartOptions {
    cursor: number;
}

type BackgroundWarmQueueAction = ReturnType<typeof getBackgroundWarmQueueAction>;

export interface EPGBackgroundWarmQueueDeps {
    getActiveRefreshId: () => number;
    getCacheSize: () => number;
    getCacheLimit: () => number;
    getInFlightCount: () => number;
    getWarmQueueAction?: typeof getBackgroundWarmQueueAction;
    onCancel?: (reason: string, state: EPGBackgroundWarmQueueStartOptions | null) => void;
    onError?: (error: unknown) => void;
}

export class EPGBackgroundWarmQueue {
    private _state: BackgroundWarmQueueState | null = null;
    private _timer: ReturnType<typeof setTimeout> | null = null;
    private _idleHandle: number | null = null;
    private _activeBatchCount: number = 0;
    private _idlePromise: Promise<void> = Promise.resolve();
    private _resolveIdlePromise: (() => void) | null = null;

    constructor(private readonly _deps: EPGBackgroundWarmQueueDeps) {}

    start(options: EPGBackgroundWarmQueueStartOptions): void {
        if (options.channels.length === 0) {
            this._cancelInternal('replace-background-warm-queue');
            return;
        }

        this._cancelInternal('replace-background-warm-queue');
        this._state = {
            ...options,
            cursor: 0,
        };
        this._ensureIdlePromise();
        this._scheduleNextBatch();
    }

    async whenIdle(): Promise<void> {
        return this._isIdle() ? Promise.resolve() : this._idlePromise;
    }

    cancel(reason: string): void {
        this._cancelInternal(reason);
    }

    private _cancelInternal(reason: string): void {
        const previousState = this._state;
        this._state = null;

        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }

        if (this._idleHandle !== null) {
            const idleScheduler = globalThis as IdleSchedulerLike;
            if (typeof idleScheduler.cancelIdleCallback === 'function') {
                idleScheduler.cancelIdleCallback(this._idleHandle);
            }
            this._idleHandle = null;
        }

        let canPublishCancellation = true;
        try {
            previousState?.assertCurrent?.();
        } catch {
            canPublishCancellation = false;
        }
        if (canPublishCancellation) this._deps.onCancel?.(reason, previousState ? {
            refreshId: previousState.refreshId,
            reason: previousState.reason,
            channels: previousState.channels,
            refreshChannelSchedule: previousState.refreshChannelSchedule,
            concurrency: previousState.concurrency,
        } : null);
        previousState?.onSettled?.();
        this._resolveIdleIfSettled();
    }

    private _reportBatchError(error: unknown): void {
        this._deps.onError?.(error);
    }

    private _scheduleNextBatch(): void {
        const state = this._state;
        if (!state) {
            return;
        }

        if (state.shouldContinue && !state.shouldContinue()) {
            this._cancelInternal('warmup-playback-stopped');
            return;
        }

        const action = this._resolveWarmQueueAction(state);
        if (this._applyWarmQueueBackpressureOrCancel(action)) {
            return;
        }

        this._scheduleBatchExecution(state);
    }

    private _resolveWarmQueueAction(state: BackgroundWarmQueueState): BackgroundWarmQueueAction {
        const resolveAction = this._deps.getWarmQueueAction ?? getBackgroundWarmQueueAction;
        return resolveAction({
            refreshId: state.refreshId,
            activeRefreshId: this._deps.getActiveRefreshId(),
            cursor: state.cursor,
            totalChannels: state.channels.length,
            cacheSize: this._deps.getCacheSize(),
            cacheLimit: this._deps.getCacheLimit(),
            inFlightCount: this._deps.getInFlightCount(),
            concurrency: state.concurrency,
        });
    }

    private _applyWarmQueueBackpressureOrCancel(action: BackgroundWarmQueueAction): boolean {
        if (action.kind === 'cancel') {
            this._cancelInternal(action.reason);
            return true;
        }

        if (action.kind === 'backpressure') {
            this._scheduleBackpressureRetry();
            return true;
        }

        return false;
    }

    private _scheduleBackpressureRetry(): void {
        if (this._timer) {
            return;
        }

        this._timer = setTimeout(() => {
            this._timer = null;
            this._scheduleNextBatch();
        }, EPG_BACKGROUND_WARM_BACKPRESSURE_DELAY_MS);
    }

    private async _runWarmBatch(state: BackgroundWarmQueueState): Promise<void> {
        if (this._state !== state) {
            return;
        }

        if (state.shouldContinue && !state.shouldContinue()) {
            this._cancelInternal('warmup-playback-stopped');
            return;
        }

        this._activeBatchCount += 1;

        try {
            const batch = this._takeWarmBatch(state);

            if (batch.length === 0) {
                this._cancelInternal('warm-queue-complete');
                return;
            }

            await this._runWarmBatchWorkers(state, batch);
            if (this._state === state) {
                this._scheduleNextBatch();
            }
        } finally {
            this._activeBatchCount = Math.max(0, this._activeBatchCount - 1);
            this._resolveIdleIfSettled();
        }
    }

    private _takeWarmBatch(state: BackgroundWarmQueueState): ChannelConfig[] {
        const batchSize = Math.max(1, state.concurrency * 2);
        const batch = state.channels.slice(state.cursor, state.cursor + batchSize);
        state.cursor += batch.length;
        return batch;
    }

    private async _runWarmBatchWorkers(
        state: BackgroundWarmQueueState,
        batch: ChannelConfig[]
    ): Promise<void> {
        let cursor = 0;
        const workers = Array.from(
            { length: Math.min(state.concurrency, batch.length) },
            async () => {
                while (true) {
                    if (this._state !== state) return;
                    const channel = batch[cursor++];
                    if (this._state !== state) return;
                    if (!channel) return;
                    try {
                        await state.refreshChannelSchedule(channel);
                    } catch (error) {
                        try {
                            state.assertCurrent?.();
                            this._reportBatchError(error);
                        } catch {
                            // Superseded detached work has no publication authority.
                        }
                    }
                    if (this._state !== state) return;
                }
            }
        );
        await Promise.all(workers);
    }

    private _runWarmBatchSafe(state: BackgroundWarmQueueState): void {
        this._runWarmBatch(state).catch((error: unknown) => {
            this._reportBatchError(error);
        });
    }

    private _scheduleBatchExecution(state: BackgroundWarmQueueState): void {
        const idleScheduler = globalThis as IdleSchedulerLike;
        if (typeof idleScheduler.requestIdleCallback === 'function') {
            this._idleHandle = idleScheduler.requestIdleCallback((deadline) => {
                this._idleHandle = null;
                if (this._state !== state) {
                    return;
                }
                if (!deadline.didTimeout && deadline.timeRemaining() < 4) {
                    this._scheduleNextBatch();
                    return;
                }
                this._runWarmBatchSafe(state);
            }, { timeout: EPG_BACKGROUND_WARM_IDLE_TIMEOUT_MS });
            return;
        }

        this._timer = setTimeout(() => {
            this._timer = null;
            if (this._state !== state) {
                this._resolveIdleIfSettled();
                return;
            }
            this._runWarmBatchSafe(state);
        }, EPG_BACKGROUND_WARM_TIMER_DELAY_MS);
    }

    private _isIdle(): boolean {
        return this._state === null
            && this._timer === null
            && this._idleHandle === null
            && this._activeBatchCount === 0;
    }

    private _ensureIdlePromise(): void {
        if (this._resolveIdlePromise) {
            return;
        }

        this._idlePromise = new Promise((resolve) => {
            this._resolveIdlePromise = resolve;
        });
    }

    private _resolveIdleIfSettled(): void {
        if (!this._isIdle() || !this._resolveIdlePromise) {
            return;
        }

        const resolve = this._resolveIdlePromise;
        this._resolveIdlePromise = null;
        resolve();
    }
}
