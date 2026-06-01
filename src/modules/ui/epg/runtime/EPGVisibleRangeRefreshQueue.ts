import type { EpgVisibleRange } from '../types';
import type { EpgScheduleRefreshOptions } from '../coordinator/EPGCoordinatorContracts';
import { readEpgRefreshAbortReason, throwIfEpgRefreshAborted } from './EPGRefreshAbort';

type RefreshFn = (range: EpgVisibleRange, reason: string, signal?: AbortSignal | null) => Promise<void>;

type PendingRefreshRequest = {
    resolve: () => void;
    reject: (error: unknown) => void;
    signal: AbortSignal | null;
    abortCleanup: (() => void) | null;
    batchController: AbortController | null;
    batchRequests: PendingRefreshRequest[] | null;
    settled: boolean;
};

export class EPGVisibleRangeRefreshQueue {
    private _timer: ReturnType<typeof setTimeout> | null = null;
    private _pendingRange: EpgVisibleRange | null = null;
    private _pendingReason: string | null = null;
    private _pendingRequests: PendingRefreshRequest[] = [];
    private _activeRefreshController: AbortController | null = null;
    private _activePendingRequests: PendingRefreshRequest[] | null = null;

    constructor(private readonly _refreshFn: RefreshFn) { }

    cancelPendingRefresh(): void {
        const hadQueuedRefresh = this._timer !== null || this._pendingRange !== null;
        const activeRefreshController = this._activeRefreshController;
        const activePendingRequests = this._activePendingRequests;
        if (!hadQueuedRefresh && !activeRefreshController && !activePendingRequests) {
            return;
        }

        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }

        const pendingRequests = this._takePendingRequests();
        this._pendingRange = null;
        this._pendingReason = null;

        this._settlePendingRequests(pendingRequests, 'resolve');
        if (activeRefreshController) {
            activeRefreshController.abort();
        }
        if (activePendingRequests) {
            this._settlePendingRequests(activePendingRequests, 'resolve');
        }
        if (this._activeRefreshController === activeRefreshController) {
            this._activeRefreshController = null;
        }
        if (this._activePendingRequests === activePendingRequests) {
            this._activePendingRequests = null;
        }
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
        const pendingPromise = this._createPendingRequest(signal);

        if (this._timer) {
            return pendingPromise;
        }

        this._timer = setTimeout(() => {
            this._timer = null;
            const pending = this._pendingRange;
            const pendingReason = this._pendingReason;
            const pendingRequests = this._takePendingRequests();
            this._pendingRange = null;
            this._pendingReason = null;

            if (!pending) {
                this._settlePendingRequests(pendingRequests, 'resolve');
                return;
            }

            const refreshController = new AbortController();
            for (const request of pendingRequests) {
                request.batchController = refreshController;
                request.batchRequests = pendingRequests;
            }
            this._activeRefreshController = refreshController;
            this._activePendingRequests = pendingRequests;
            this._runRefresh(pending, pendingReason ?? 'visible-range', refreshController.signal)
                .then(() => this._settlePendingRequests(pendingRequests, 'resolve'))
                .catch((error: unknown) => this._settlePendingRequests(pendingRequests, 'reject', error))
                .finally(() => {
                    if (this._activeRefreshController === refreshController) {
                        this._activeRefreshController = null;
                    }
                    if (this._activePendingRequests === pendingRequests) {
                        this._activePendingRequests = null;
                    }
                });
        }, debounceMs);

        return pendingPromise;
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

        const pendingRequests = this._takePendingRequests();
        this._pendingRange = null;
        this._pendingReason = null;

        try {
            await this._runRefresh(range, reason, signal);
            this._settlePendingRequests(pendingRequests, 'resolve');
        } catch (error) {
            this._settlePendingRequests(pendingRequests, 'reject', error);
            throw error;
        }
    }

    private _createPendingRequest(signal: AbortSignal | null): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const request: PendingRefreshRequest = {
                resolve,
                reject,
                signal,
                abortCleanup: null,
                batchController: null,
                batchRequests: null,
                settled: false,
            };
            if (signal) {
                const onAbort = (): void => {
                    const batchController = request.batchController;
                    const batchRequests = request.batchRequests;
                    this._rejectPendingRequest(request, readEpgRefreshAbortReason(signal));
                    if (batchController && batchRequests?.every((pending) => pending.settled)) {
                        batchController.abort(readEpgRefreshAbortReason(signal));
                        return;
                    }
                    const wasQueued = this._pendingRequests.includes(request);
                    this._pendingRequests = this._pendingRequests.filter((pending) => pending !== request);
                    if (wasQueued && this._pendingRequests.length === 0 && this._timer) {
                        clearTimeout(this._timer);
                        this._timer = null;
                        this._pendingRange = null;
                        this._pendingReason = null;
                    }
                };
                signal.addEventListener('abort', onAbort, { once: true });
                request.abortCleanup = (): void => signal.removeEventListener('abort', onAbort);
            }
            this._pendingRequests.push(request);
        });
    }

    private _takePendingRequests(): PendingRefreshRequest[] {
        const pendingRequests = this._pendingRequests;
        this._pendingRequests = [];
        return pendingRequests;
    }

    private _settlePendingRequests(
        pendingRequests: PendingRefreshRequest[],
        action: 'resolve' | 'reject',
        error?: unknown
    ): void {
        for (const request of pendingRequests) {
            if (request.settled) {
                continue;
            }
            request.settled = true;
            request.abortCleanup?.();
            request.abortCleanup = null;
            request.batchController = null;
            request.batchRequests = null;
            if (action === 'resolve') {
                request.resolve();
            } else {
                request.reject(error);
            }
        }
    }

    private _rejectPendingRequest(request: PendingRefreshRequest, error: unknown): void {
        if (request.settled) {
            return;
        }
        request.settled = true;
        request.abortCleanup?.();
        request.abortCleanup = null;
        request.batchController = null;
        request.batchRequests = null;
        request.reject(error);
    }

    private _runRefresh(
        range: EpgVisibleRange,
        reason: string,
        signal: AbortSignal | null
    ): Promise<void> {
        return signal ? this._refreshFn(range, reason, signal) : this._refreshFn(range, reason);
    }
}
