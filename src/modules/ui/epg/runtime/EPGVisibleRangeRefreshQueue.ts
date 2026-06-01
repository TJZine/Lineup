import type { EpgVisibleRange } from '../types';
import type { EpgScheduleRefreshOptions } from '../coordinator/EPGCoordinatorContracts';
import { readEpgRefreshAbortReason, throwIfEpgRefreshAborted } from './EPGRefreshAbort';

type RefreshFn = (range: EpgVisibleRange, reason: string, signal?: AbortSignal | null) => Promise<void>;

export class EPGVisibleRangeRefreshQueue {
    private _timer: ReturnType<typeof setTimeout> | null = null;
    private _pendingRange: EpgVisibleRange | null = null;
    private _pendingReason: string | null = null;
    private _pendingSignal: AbortSignal | null = null;
    private _pendingPromise: Promise<void> | null = null;
    private _pendingResolve: (() => void) | null = null;
    private _pendingReject: ((error: unknown) => void) | null = null;
    private _pendingAbortCleanup: (() => void) | null = null;

    constructor(private readonly _refreshFn: RefreshFn) { }

    cancelPendingRefresh(): void {
        const hadQueuedRefresh = this._timer !== null || this._pendingRange !== null;
        if (!hadQueuedRefresh) {
            return;
        }

        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }

        this._clearPendingAbortListener();
        const resolvePending = this._pendingResolve;
        this._pendingRange = null;
        this._pendingReason = null;
        this._pendingSignal = null;
        this._pendingPromise = null;
        this._pendingResolve = null;
        this._pendingReject = null;

        resolvePending?.();
    }

    request(range: EpgVisibleRange, options?: EpgScheduleRefreshOptions): Promise<void> {
        const signal = options?.signal ?? null;
        throwIfEpgRefreshAborted(signal);
        const debounceMs = Math.max(0, options?.debounceMs ?? 80);
        const reason = options?.reason ?? 'visible-range';

        if (debounceMs === 0) {
            return this._runImmediateAndPreemptQueued(range, reason, signal);
        }

        this._pendingRange = range;
        this._pendingReason = reason;
        this._pendingSignal = signal;

        if (this._timer) {
            return this._pendingPromise ?? Promise.resolve();
        }

        if (!this._pendingPromise) {
            this._pendingPromise = new Promise<void>((resolve, reject) => {
                this._pendingResolve = resolve;
                this._pendingReject = reject;
            });
        }
        this._bindPendingAbort(signal);

        this._timer = setTimeout(() => {
            this._timer = null;
            const pending = this._pendingRange;
            const pendingReason = this._pendingReason;
            const pendingSignal = this._pendingSignal;
            this._pendingRange = null;
            this._pendingReason = null;
            this._pendingSignal = null;
            this._pendingPromise = null;
            const resolvePending = this._pendingResolve;
            const rejectPending = this._pendingReject;
            this._pendingResolve = null;
            this._pendingReject = null;
            this._clearPendingAbortListener();

            if (!pending) {
                resolvePending?.();
                return;
            }

            this._runRefresh(pending, pendingReason ?? 'visible-range', pendingSignal)
                .then(() => resolvePending?.())
                .catch((error: unknown) => rejectPending?.(error));
        }, debounceMs);

        return this._pendingPromise ?? Promise.resolve();
    }

    private async _runImmediateAndPreemptQueued(
        range: EpgVisibleRange,
        reason: string,
        signal: AbortSignal | null
    ): Promise<void> {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }

        const pendingPromise = this._pendingPromise;
        const resolvePending = this._pendingResolve;
        const rejectPending = this._pendingReject;
        this._clearPendingAbortListener();
        this._pendingPromise = null;
        this._pendingResolve = null;
        this._pendingReject = null;
        this._pendingRange = null;
        this._pendingReason = null;
        this._pendingSignal = null;

        try {
            await this._runRefresh(range, reason, signal);
            resolvePending?.();
        } catch (error) {
            if (pendingPromise) {
                rejectPending?.(error);
            }
            throw error;
        }
    }

    private _bindPendingAbort(signal: AbortSignal | null): void {
        this._clearPendingAbortListener();
        if (!signal) return;
        const onAbort = (): void => {
            if (this._timer) {
                clearTimeout(this._timer);
                this._timer = null;
            }
            const rejectPending = this._pendingReject;
            this._pendingRange = null;
            this._pendingReason = null;
            this._pendingSignal = null;
            this._pendingPromise = null;
            this._pendingResolve = null;
            this._pendingReject = null;
            this._clearPendingAbortListener();
            rejectPending?.(readEpgRefreshAbortReason(signal));
        };
        signal.addEventListener('abort', onAbort, { once: true });
        this._pendingAbortCleanup = (): void => signal.removeEventListener('abort', onAbort);
    }

    private _clearPendingAbortListener(): void {
        this._pendingAbortCleanup?.();
        this._pendingAbortCleanup = null;
    }

    private _runRefresh(
        range: EpgVisibleRange,
        reason: string,
        signal: AbortSignal | null
    ): Promise<void> {
        return signal ? this._refreshFn(range, reason, signal) : this._refreshFn(range, reason);
    }
}
