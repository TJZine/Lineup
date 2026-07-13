import type { EpgScheduleRefreshResult } from '../coordinator/EPGCoordinatorContracts';
import type { EpgVisibleRange } from '../types';
import { createSkippedEpgScheduleRefreshResult } from '../../../../shared/epgRefresh';
import { readEpgRefreshAbortReason } from './EPGRefreshAbort';
import type {
    EpgOperationAuthority,
    EpgRetainedOperationContext,
} from './EPGRetainedOperationContext';

export type EpgRefreshInvocationOptions = {
    signal?: AbortSignal | null;
    operationContext?: EpgRetainedOperationContext;
};

export type EpgVisibleRangeRefreshFn = (
    range: EpgVisibleRange,
    reason: string,
    options?: EpgRefreshInvocationOptions
) => Promise<EpgScheduleRefreshResult>;

type Request = {
    operation: EpgRetainedOperationContext;
    resolve: (result: EpgScheduleRefreshResult) => void;
    reject: (error: unknown) => void;
    cleanups: Array<() => void>;
    batch: Batch | null;
    settled: boolean;
};

type Batch = {
    controller: AbortController;
    operation: EpgRetainedOperationContext;
    requests: Request[];
    operationAbortCleanup: () => void;
};

type AuthorityState = {
    timer: ReturnType<typeof setTimeout> | null;
    range: EpgVisibleRange | null;
    reason: string | null;
    requests: Request[];
    batches: Set<Batch>;
};

export class EPGGuardedVisibleRangeRefreshQueue {
    private readonly _states = new Map<EpgOperationAuthority, AuthorityState>();

    constructor(private readonly _refreshFn: EpgVisibleRangeRefreshFn) {}

    request(
        range: EpgVisibleRange,
        reason: string,
        debounceMs: number,
        callerSignal: AbortSignal | null,
        operationContext: EpgRetainedOperationContext
    ): Promise<EpgScheduleRefreshResult> {
        operationContext.assertCurrent();
        const state = this._getState(operationContext.authority);
        const pending = this._createRequest(state, callerSignal, operationContext);
        if (debounceMs === 0) {
            this._runImmediate(state, range, reason, pending.request);
            return pending.promise;
        }

        state.range = range;
        state.reason = reason;
        state.requests.push(pending.request);
        if (!state.timer) {
            state.timer = setTimeout(() => this._flush(state), debounceMs);
        }
        return pending.promise;
    }

    cancel(): void {
        for (const state of this._states.values()) {
            if (state.timer) clearTimeout(state.timer);
            state.timer = null;
            state.range = null;
            state.reason = null;
            this._settle(state.requests.splice(0), 'resolve', createSkippedEpgScheduleRefreshResult());
            for (const batch of Array.from(state.batches)) {
                batch.controller.abort();
                this._settle(batch.requests, 'resolve', createSkippedEpgScheduleRefreshResult());
                this._finishBatch(state, batch);
            }
        }
        this._states.clear();
    }

    private _getState(authority: EpgOperationAuthority): AuthorityState {
        const existing = this._states.get(authority);
        if (existing) return existing;
        const state: AuthorityState = {
            timer: null,
            range: null,
            reason: null,
            requests: [],
            batches: new Set(),
        };
        this._states.set(authority, state);
        return state;
    }

    private _runImmediate(state: AuthorityState, range: EpgVisibleRange, reason: string, request: Request): void {
        if (state.timer) clearTimeout(state.timer);
        state.timer = null;
        state.range = null;
        state.reason = null;
        this._runBatch(state, range, reason, [...state.requests.splice(0), request]);
    }

    private _flush(state: AuthorityState): void {
        state.timer = null;
        const range = state.range;
        const reason = state.reason ?? 'visible-range';
        const requests = state.requests.splice(0);
        state.range = null;
        state.reason = null;
        if (!range || requests.length === 0) {
            this._settle(requests, 'resolve', createSkippedEpgScheduleRefreshResult());
            this._deleteStateIfIdle(state);
            return;
        }
        this._runBatch(state, range, reason, requests);
    }

    private _runBatch(state: AuthorityState, range: EpgVisibleRange, reason: string, requests: Request[]): void {
        const liveRequests = requests.filter((request) => !request.settled);
        if (liveRequests.length === 0) return;
        const operation = liveRequests[0]!.operation.retain('visible-range-refresh-batch');
        const controller = new AbortController();
        const onOperationAbort = (): void => controller.abort(operation.signal.reason);
        operation.signal.addEventListener('abort', onOperationAbort, { once: true });
        const batch: Batch = {
            controller,
            operation,
            requests: liveRequests,
            operationAbortCleanup: () => operation.signal.removeEventListener('abort', onOperationAbort),
        };
        for (const request of liveRequests) request.batch = batch;
        state.batches.add(batch);
        this._refreshFn(range, reason, { signal: batch.controller.signal, operationContext: operation })
            .then((result) => this._settle(liveRequests, 'resolve', result))
            .catch((error: unknown) => this._settle(liveRequests, 'reject', error))
            .finally(() => this._finishBatch(state, batch));
    }

    private _createRequest(
        state: AuthorityState,
        callerSignal: AbortSignal | null,
        operationContext: EpgRetainedOperationContext
    ): { promise: Promise<EpgScheduleRefreshResult>; request: Request } {
        let request!: Request;
        const promise = new Promise<EpgScheduleRefreshResult>((resolve, reject) => {
            request = {
                operation: operationContext.retain('visible-range-refresh-waiter'),
                resolve,
                reject,
                cleanups: [],
                batch: null,
                settled: false,
            };
            this._listenForAbort(state, request, callerSignal);
            this._listenForAbort(state, request, request.operation.signal);
        });
        return { promise, request };
    }

    private _listenForAbort(state: AuthorityState, request: Request, signal: AbortSignal | null): void {
        if (!signal) return;
        const onAbort = (): void => {
            this._settleOne(request, 'reject', readEpgRefreshAbortReason(signal));
            state.requests = state.requests.filter((pending) => pending !== request);
            if (state.requests.length === 0 && state.timer) {
                clearTimeout(state.timer);
                state.timer = null;
                state.range = null;
                state.reason = null;
                this._deleteStateIfIdle(state);
            }
            const batch = request.batch;
            if (batch && batch.requests.every((pending) => pending.settled)) batch.controller.abort(signal.reason);
        };
        signal.addEventListener('abort', onAbort, { once: true });
        request.cleanups.push(() => signal.removeEventListener('abort', onAbort));
    }

    private _finishBatch(state: AuthorityState, batch: Batch): void {
        if (!state.batches.delete(batch)) return;
        batch.operationAbortCleanup();
        batch.operation.release();
        this._deleteStateIfIdle(state);
    }

    private _settle(requests: Request[], action: 'resolve' | 'reject', value: unknown): void {
        for (const request of requests) this._settleOne(request, action, value);
    }

    private _settleOne(request: Request, action: 'resolve' | 'reject', value: unknown): void {
        if (request.settled) return;
        request.settled = true;
        for (const cleanup of request.cleanups) cleanup();
        request.cleanups = [];
        request.operation.release();
        if (action === 'resolve') request.resolve(value as EpgScheduleRefreshResult);
        else request.reject(value);
    }

    private _deleteStateIfIdle(state: AuthorityState): void {
        if (state.timer || state.requests.length > 0 || state.batches.size > 0) return;
        for (const [authority, candidate] of this._states) {
            if (candidate === state) {
                this._states.delete(authority);
                return;
            }
        }
    }
}
