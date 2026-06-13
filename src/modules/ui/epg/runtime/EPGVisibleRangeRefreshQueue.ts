import type { EpgVisibleRange } from '../types';
import type { EpgScheduleRefreshOptions, EpgScheduleRefreshResult } from '../coordinator/EPGCoordinatorContracts';
import { readEpgRefreshAbortReason, throwIfEpgRefreshAborted } from './EPGRefreshAbort';

type RefreshFn = (range: EpgVisibleRange, reason: string, signal?: AbortSignal | null) => Promise<EpgScheduleRefreshResult>;

type PendingRefreshRequest = {
    resolve: (result: EpgScheduleRefreshResult) => void;
    reject: (error: unknown) => void;
    signal: AbortSignal | null;
    abortCleanup: (() => void) | null;
    batchController: AbortController | null;
    batchRequests: PendingRefreshRequest[] | null;
    settled: boolean;
};

type ActiveRefreshBatch = {
    controller: AbortController;
    requests: PendingRefreshRequest[];
};

export class EPGVisibleRangeRefreshQueue {
    private _timer: ReturnType<typeof setTimeout> | null = null;
    private _pendingRange: EpgVisibleRange | null = null;
    private _pendingReason: string | null = null;
    private _pendingRequests: PendingRefreshRequest[] = [];
    private _activeRefreshBatches = new Set<ActiveRefreshBatch>();

    constructor(private readonly _refreshFn: RefreshFn) { }

    cancelPendingRefresh(): void {
        const hadQueuedRefresh = this._timer !== null || this._pendingRange !== null;
        if (!hadQueuedRefresh && this._activeRefreshBatches.size === 0) {
            return;
        }

        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }

        const pendingRequests = this._takePendingRequests();
        this._pendingRange = null;
        this._pendingReason = null;

        this._settlePendingRequests(pendingRequests, 'resolve', skippedEpgScheduleRefreshResult());
        for (const batch of Array.from(this._activeRefreshBatches)) {
            this._cancelActiveBatch(batch);
        }
    }

    request(range: EpgVisibleRange, options?: EpgScheduleRefreshOptions): Promise<EpgScheduleRefreshResult> {
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
                this._settlePendingRequests(pendingRequests, 'resolve', skippedEpgScheduleRefreshResult());
                return;
            }

            const batch = this._createActiveBatch(pendingRequests);
            this._runRefresh(pending, pendingReason ?? 'visible-range', batch.controller.signal)
                .then((result) => this._settlePendingRequests(pendingRequests, 'resolve', result))
                .catch((error: unknown) => this._settlePendingRequests(pendingRequests, 'reject', error))
                .finally(() => this._finishActiveBatch(batch));
        }, debounceMs);

        return pendingPromise;
    }

    private _runImmediateAndPreemptQueued(
        range: EpgVisibleRange,
        reason: string,
        signal: AbortSignal | null
    ): Promise<EpgScheduleRefreshResult> {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }

        const pendingRequests = this._takePendingRequests();
        this._pendingRange = null;
        this._pendingReason = null;
        const immediate = this._createRefreshRequest(signal);
        const batchRequests = [...pendingRequests, immediate.request];
        const batch = this._createActiveBatch(batchRequests);

        this._runRefresh(range, reason, batch.controller.signal)
            .then((result) => this._settlePendingRequests(batchRequests, 'resolve', result))
            .catch((error: unknown) => this._settlePendingRequests(batchRequests, 'reject', error))
            .finally(() => this._finishActiveBatch(batch));

        return immediate.promise;
    }

    private _createPendingRequest(signal: AbortSignal | null): Promise<EpgScheduleRefreshResult> {
        const { promise, request } = this._createRefreshRequest(signal);
        this._pendingRequests.push(request);
        return promise;
    }

    private _createRefreshRequest(signal: AbortSignal | null): {
        promise: Promise<EpgScheduleRefreshResult>;
        request: PendingRefreshRequest;
    } {
        let request!: PendingRefreshRequest;
        const promise = new Promise<EpgScheduleRefreshResult>((resolve, reject) => {
            request = {
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
        });
        return { promise, request };
    }

    private _takePendingRequests(): PendingRefreshRequest[] {
        const pendingRequests = this._pendingRequests;
        this._pendingRequests = [];
        return pendingRequests;
    }

    private _createActiveBatch(requests: PendingRefreshRequest[]): ActiveRefreshBatch {
        const controller = new AbortController();
        const batch: ActiveRefreshBatch = {
            controller,
            requests,
        };

        for (const request of requests) {
            request.batchController = controller;
            request.batchRequests = requests;
        }

        this._activeRefreshBatches.add(batch);
        return batch;
    }

    private _finishActiveBatch(batch: ActiveRefreshBatch): void {
        if (!this._activeRefreshBatches.delete(batch)) {
            return;
        }
    }

    private _cancelActiveBatch(batch: ActiveRefreshBatch): void {
        batch.controller.abort();
        this._settlePendingRequests(batch.requests, 'resolve', skippedEpgScheduleRefreshResult());
        this._finishActiveBatch(batch);
    }

    private _settlePendingRequests(
        pendingRequests: PendingRefreshRequest[],
        action: 'resolve' | 'reject',
        value?: EpgScheduleRefreshResult | unknown
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
                request.resolve(value as EpgScheduleRefreshResult);
            } else {
                request.reject(value);
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
    ): Promise<EpgScheduleRefreshResult> {
        return signal ? this._refreshFn(range, reason, signal) : this._refreshFn(range, reason);
    }
}

function skippedEpgScheduleRefreshResult(): EpgScheduleRefreshResult {
    return {
        readiness: 'skipped',
        attemptedChannelCount: 0,
        immediateReadyChannelCount: 0,
        backgroundQueuedChannelCount: 0,
        failedChannelCount: 0,
        staleCacheChannelCount: 0,
        firstVisibleScheduleReady: false,
    };
}
