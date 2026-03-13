import type { EpgVisibleRange } from './types';

interface QueueOptions {
    reason?: string;
    debounceMs?: number;
}

type RefreshFn = (range: EpgVisibleRange, reason: string) => Promise<void>;

export class EPGVisibleRangeRefreshQueue {
    private _timer: ReturnType<typeof setTimeout> | null = null;
    private _pendingRange: EpgVisibleRange | null = null;
    private _pendingReason: string | null = null;
    private _pendingPromise: Promise<void> | null = null;
    private _pendingResolve: (() => void) | null = null;
    private _pendingReject: ((error: unknown) => void) | null = null;

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

        const resolvePending = this._pendingResolve;
        this._pendingRange = null;
        this._pendingReason = null;
        this._pendingPromise = null;
        this._pendingResolve = null;
        this._pendingReject = null;

        resolvePending?.();
    }

    request(range: EpgVisibleRange, options?: QueueOptions): Promise<void> {
        const debounceMs = Math.max(0, options?.debounceMs ?? 80);
        const reason = options?.reason ?? 'visible-range';

        if (debounceMs === 0) {
            return this._runImmediateAndPreemptQueued(range, reason);
        }

        this._pendingRange = range;
        this._pendingReason = reason;

        if (this._timer) {
            return this._pendingPromise ?? Promise.resolve();
        }

        if (!this._pendingPromise) {
            this._pendingPromise = new Promise<void>((resolve, reject) => {
                this._pendingResolve = resolve;
                this._pendingReject = reject;
            });
        }

        this._timer = setTimeout(() => {
            this._timer = null;
            const pending = this._pendingRange;
            const pendingReason = this._pendingReason;
            this._pendingRange = null;
            this._pendingReason = null;
            this._pendingPromise = null;
            const resolvePending = this._pendingResolve;
            const rejectPending = this._pendingReject;
            this._pendingResolve = null;
            this._pendingReject = null;

            if (!pending) {
                resolvePending?.();
                return;
            }

            this._refreshFn(pending, pendingReason ?? 'visible-range')
                .then(() => resolvePending?.())
                .catch((error: unknown) => rejectPending?.(error));
        }, debounceMs);

        return this._pendingPromise ?? Promise.resolve();
    }

    private _runImmediateAndPreemptQueued(range: EpgVisibleRange, reason: string): Promise<void> {
        const hadArmedDebounce = this._timer !== null;
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }

        const resolvePending = this._pendingResolve;
        const rejectPending = this._pendingReject;
        const pendingPromise = this._pendingPromise;
        this._pendingRange = null;
        this._pendingReason = null;
        if (hadArmedDebounce) {
            this._pendingResolve = null;
            this._pendingReject = null;
        }

        const immediatePromise = this._refreshFn(range, reason);
        if (!pendingPromise || !hadArmedDebounce) {
            return immediatePromise;
        }

        void immediatePromise
            .then(() => resolvePending?.())
            .catch((error: unknown) => rejectPending?.(error))
            .finally(() => {
                if (this._pendingPromise === pendingPromise) {
                    this._pendingPromise = null;
                }
            });

        return immediatePromise;
    }
}
