import type { ChannelConfig } from '../../../scheduler/channel-manager';
import { getBackgroundWarmQueueAction } from '../EPGCoordinatorPolicies';

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
}

interface BackgroundWarmQueueState extends EPGBackgroundWarmQueueStartOptions {
    cursor: number;
}

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

        this._deps.onCancel?.(reason, previousState ? {
            refreshId: previousState.refreshId,
            reason: previousState.reason,
            channels: previousState.channels,
            refreshChannelSchedule: previousState.refreshChannelSchedule,
            concurrency: previousState.concurrency,
        } : null);
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

        const resolveAction = this._deps.getWarmQueueAction ?? getBackgroundWarmQueueAction;
        const action = resolveAction({
            refreshId: state.refreshId,
            activeRefreshId: this._deps.getActiveRefreshId(),
            cursor: state.cursor,
            totalChannels: state.channels.length,
            cacheSize: this._deps.getCacheSize(),
            cacheLimit: this._deps.getCacheLimit(),
            inFlightCount: this._deps.getInFlightCount(),
            concurrency: state.concurrency,
        });

        if (action.kind === 'cancel') {
            this._cancelInternal(action.reason);
            return;
        }

        if (action.kind === 'backpressure') {
            if (this._timer) {
                return;
            }

            this._timer = setTimeout(() => {
                this._timer = null;
                this._scheduleNextBatch();
            }, EPG_BACKGROUND_WARM_BACKPRESSURE_DELAY_MS);
            return;
        }

        const runBatch = async (): Promise<void> => {
            if (this._state !== state) {
                return;
            }
            this._activeBatchCount += 1;

            try {
                const batchSize = Math.max(1, state.concurrency * 2);
                const batch = state.channels.slice(state.cursor, state.cursor + batchSize);
                state.cursor += batch.length;

                if (batch.length === 0) {
                    this._cancelInternal('warm-queue-complete');
                    return;
                }

                let cursor = 0;
                const workers = Array.from(
                    { length: Math.min(state.concurrency, batch.length) },
                    async () => {
                        while (true) {
                            const channel = batch[cursor++];
                            if (!channel) return;
                            try {
                                await state.refreshChannelSchedule(channel);
                            } catch (error) {
                                this._reportBatchError(error);
                            }
                        }
                    }
                );
                await Promise.all(workers);
                if (this._state === state) {
                    this._scheduleNextBatch();
                }
            } finally {
                this._activeBatchCount = Math.max(0, this._activeBatchCount - 1);
                this._resolveIdleIfSettled();
            }
        };

        const runBatchSafe = (): void => {
            runBatch().catch((error: unknown) => {
                this._reportBatchError(error);
            });
        };

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
                runBatchSafe();
            }, { timeout: EPG_BACKGROUND_WARM_IDLE_TIMEOUT_MS });
            return;
        }

        this._timer = setTimeout(() => {
            this._timer = null;
            if (this._state !== state) {
                this._resolveIdleIfSettled();
                return;
            }
            runBatchSafe();
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
