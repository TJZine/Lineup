import { EPGVisibleRangeRefreshQueue } from '../runtime/EPGVisibleRangeRefreshQueue';
import type { EpgScheduleRefreshResult } from '../coordinator/EPGCoordinatorContracts';
import type { EpgVisibleRange } from '../types';
import { createEpgRetainedOperationContext } from '../runtime/EPGRetainedOperationContext';

describe('EPGVisibleRangeRefreshQueue', () => {
    const SKIPPED_REFRESH_RESULT: EpgScheduleRefreshResult = {
        readiness: 'skipped',
        attemptedChannelCount: 0,
        immediateReadyChannelCount: 0,
        backgroundQueuedChannelCount: 0,
        failedChannelCount: 0,
        staleCacheChannelCount: 0,
        firstVisibleScheduleReady: false,
    };

    const range = (id: number): EpgVisibleRange => ({
        channelStart: id,
        channelEnd: id + 1,
        timeStartMs: id * 1000,
        timeEndMs: (id * 1000) + 500,
    });

    const deferred = (): { promise: Promise<EpgScheduleRefreshResult>; resolve: () => void } => {
        let resolve!: () => void;
        const promise = new Promise<EpgScheduleRefreshResult>((innerResolve) => {
            resolve = (): void => {
                innerResolve(SKIPPED_REFRESH_RESULT);
            };
        });
        return { promise, resolve };
    };

    afterEach(() => {
        jest.useRealTimers();
    });

    it('runs immediate refresh when debounce is zero', async () => {
        const refreshFn = jest.fn().mockResolvedValue(SKIPPED_REFRESH_RESULT);
        const queue = new EPGVisibleRangeRefreshQueue(refreshFn);

        await queue.request(range(1), { debounceMs: 0, reason: 'manual' });

        expect(refreshFn).toHaveBeenCalledTimes(1);
        expect(refreshFn).toHaveBeenCalledWith(range(1), 'manual', expect.any(AbortSignal));
    });

    it('coalesces debounced requests while giving each caller an isolated promise', async () => {
        jest.useFakeTimers();
        const refreshFn = jest.fn().mockResolvedValue(SKIPPED_REFRESH_RESULT);
        const queue = new EPGVisibleRangeRefreshQueue(refreshFn);

        const first = queue.request(range(1), { debounceMs: 50, reason: 'visible-range' });
        const second = queue.request(range(2), { debounceMs: 50, reason: 'library-filter' });

        expect(first).not.toBe(second);
        expect(refreshFn).not.toHaveBeenCalled();

        jest.advanceTimersByTime(50);
        await Promise.all([first, second]);

        expect(refreshFn).toHaveBeenCalledTimes(1);
        expect(refreshFn).toHaveBeenCalledWith(range(2), 'library-filter', expect.any(AbortSignal));
    });

    it('isolates abort handling when a debounced request is coalesced', async () => {
        jest.useFakeTimers();
        const refreshFn = jest.fn().mockResolvedValue(SKIPPED_REFRESH_RESULT);
        const queue = new EPGVisibleRangeRefreshQueue(refreshFn);
        const firstController = new AbortController();
        const secondController = new AbortController();
        const firstReason = new DOMException('first request hidden', 'AbortError');
        const secondReason = new DOMException('second request hidden', 'AbortError');

        const first = queue.request(range(1), {
            debounceMs: 50,
            reason: 'visible-range',
            signal: firstController.signal,
        });
        const second = queue.request(range(2), {
            debounceMs: 50,
            reason: 'library-filter',
            signal: secondController.signal,
        });

        firstController.abort(firstReason);
        await expect(first).rejects.toBe(firstReason);

        jest.advanceTimersByTime(50);
        await expect(second).resolves.toEqual(SKIPPED_REFRESH_RESULT);
        expect(refreshFn).toHaveBeenCalledTimes(1);
        expect(refreshFn).toHaveBeenCalledWith(range(2), 'library-filter', expect.any(AbortSignal));

        secondController.abort(secondReason);
    });

    it('cancels a debounced refresh when every queued caller aborts', async () => {
        jest.useFakeTimers();
        const refreshFn = jest.fn().mockResolvedValue(SKIPPED_REFRESH_RESULT);
        const queue = new EPGVisibleRangeRefreshQueue(refreshFn);
        const firstController = new AbortController();
        const secondController = new AbortController();
        const firstReason = new DOMException('first request hidden', 'AbortError');
        const secondReason = new DOMException('second request hidden', 'AbortError');

        const first = queue.request(range(1), {
            debounceMs: 50,
            reason: 'visible-range',
            signal: firstController.signal,
        });
        const second = queue.request(range(2), {
            debounceMs: 50,
            reason: 'library-filter',
            signal: secondController.signal,
        });

        firstController.abort(firstReason);
        secondController.abort(secondReason);

        await expect(first).rejects.toBe(firstReason);
        await expect(second).rejects.toBe(secondReason);
        jest.advanceTimersByTime(50);
        expect(refreshFn).not.toHaveBeenCalled();
    });

    it('does not cancel an in-flight debounced refresh until every caller aborts', async () => {
        jest.useFakeTimers();
        const refresh = deferred();
        const refreshFn = jest.fn().mockReturnValue(refresh.promise);
        const queue = new EPGVisibleRangeRefreshQueue(refreshFn);
        const firstController = new AbortController();
        const secondController = new AbortController();
        const firstReason = new DOMException('first request hidden', 'AbortError');

        const first = queue.request(range(1), {
            debounceMs: 50,
            reason: 'visible-range',
            signal: firstController.signal,
        });
        const second = queue.request(range(2), {
            debounceMs: 50,
            reason: 'library-filter',
            signal: secondController.signal,
        });

        jest.advanceTimersByTime(50);
        await Promise.resolve();
        const refreshSignal = refreshFn.mock.calls[0]?.[2] as AbortSignal;

        firstController.abort(firstReason);

        await expect(first).rejects.toBe(firstReason);
        expect(refreshSignal.aborted).toBe(false);

        refresh.resolve();
        await expect(second).resolves.toEqual(SKIPPED_REFRESH_RESULT);
    });

    it('immediate refresh preempts armed debounce and settles pending debounced promise', async () => {
        jest.useFakeTimers();
        const refreshFn = jest.fn().mockResolvedValue(SKIPPED_REFRESH_RESULT);

        const queue = new EPGVisibleRangeRefreshQueue(refreshFn);

        const debounced = queue.request(range(1), { debounceMs: 75, reason: 'visible-range' });
        const secondDebounced = queue.request(range(2), { debounceMs: 75, reason: 'visible-range' });
        expect(debounced).not.toBe(secondDebounced);

        const immediate = queue.request(range(3), { debounceMs: 0, reason: 'library-filter' });
        expect(refreshFn).toHaveBeenCalledTimes(1);
        expect(refreshFn).toHaveBeenCalledWith(range(3), 'library-filter', expect.any(AbortSignal));

        jest.advanceTimersByTime(100);
        expect(refreshFn).toHaveBeenCalledTimes(1);

        await Promise.all([immediate, debounced, secondDebounced]);
    });

    it('immediate preemption does not reuse the debounced promise for newly queued refreshes', async () => {
        jest.useFakeTimers();
        const immediateRefresh = deferred();
        const queuedRefresh = deferred();
        const refreshFn = jest
            .fn()
            .mockImplementationOnce(() => immediateRefresh.promise)
            .mockImplementationOnce(() => queuedRefresh.promise);

        const queue = new EPGVisibleRangeRefreshQueue(refreshFn);

        const debounced = queue.request(range(1), { debounceMs: 75, reason: 'visible-range' });
        const immediate = queue.request(range(2), { debounceMs: 0, reason: 'manual' });
        expect(refreshFn).toHaveBeenCalledTimes(1);
        expect(refreshFn).toHaveBeenCalledWith(range(2), 'manual', expect.any(AbortSignal));

        const queued = queue.request(range(3), { debounceMs: 50, reason: 'visible-range' });

        let queuedResolved = false;
        void queued.then(() => {
            queuedResolved = true;
        });

        immediateRefresh.resolve();
        await Promise.resolve();
        await Promise.resolve();
        expect(queuedResolved).toBe(false);

        jest.advanceTimersByTime(50);
        await Promise.resolve();
        expect(refreshFn).toHaveBeenCalledTimes(2);
        expect(refreshFn).toHaveBeenNthCalledWith(2, range(3), 'visible-range', expect.any(AbortSignal));

        queuedRefresh.resolve();
        await expect(queued).resolves.toEqual(SKIPPED_REFRESH_RESULT);
        await expect(immediate).resolves.toEqual(SKIPPED_REFRESH_RESULT);
        await expect(debounced).resolves.toEqual(SKIPPED_REFRESH_RESULT);
    });

    it('awaits the immediate refresh when a debounced refresh is already in flight', async () => {
        jest.useFakeTimers();
        const debouncedRefresh = deferred();
        const immediateRefresh = deferred();
        const refreshFn = jest
            .fn()
            .mockImplementationOnce(() => debouncedRefresh.promise)
            .mockImplementationOnce(() => immediateRefresh.promise);

        const queue = new EPGVisibleRangeRefreshQueue(refreshFn);

        const debounced = queue.request(range(1), { debounceMs: 50, reason: 'visible-range' });
        jest.advanceTimersByTime(50);
        await Promise.resolve();

        const immediate = queue.request(range(2), { debounceMs: 0, reason: 'manual' });
        expect(immediate).not.toBe(debounced);
        expect(refreshFn).toHaveBeenNthCalledWith(1, range(1), 'visible-range', expect.any(AbortSignal));
        expect(refreshFn).toHaveBeenNthCalledWith(2, range(2), 'manual', expect.any(AbortSignal));

        let immediateSettled = false;
        void immediate.then(() => {
            immediateSettled = true;
        });

        debouncedRefresh.resolve();
        await Promise.resolve();
        expect(immediateSettled).toBe(false);

        immediateRefresh.resolve();
        await expect(immediate).resolves.toEqual(SKIPPED_REFRESH_RESULT);
        await expect(debounced).resolves.toEqual(SKIPPED_REFRESH_RESULT);
    });

    it('creates a fresh promise for debounced requests queued while a refresh is already running', async () => {
        jest.useFakeTimers();
        const firstRefresh = deferred();
        const secondRefresh = deferred();
        const refreshFn = jest
            .fn()
            .mockImplementationOnce(() => firstRefresh.promise)
            .mockImplementationOnce(() => secondRefresh.promise);

        const queue = new EPGVisibleRangeRefreshQueue(refreshFn);

        const first = queue.request(range(1), { debounceMs: 50, reason: 'visible-range' });
        jest.advanceTimersByTime(50);
        await Promise.resolve();

        const second = queue.request(range(2), { debounceMs: 50, reason: 'library-filter' });
        expect(second).not.toBe(first);

        jest.advanceTimersByTime(50);
        await Promise.resolve();

        expect(refreshFn).toHaveBeenNthCalledWith(1, range(1), 'visible-range', expect.any(AbortSignal));
        expect(refreshFn).toHaveBeenNthCalledWith(2, range(2), 'library-filter', expect.any(AbortSignal));

        firstRefresh.resolve();
        await expect(first).resolves.toEqual(SKIPPED_REFRESH_RESULT);

        secondRefresh.resolve();
        await expect(second).resolves.toEqual(SKIPPED_REFRESH_RESULT);
    });

    it('cancelPendingRefresh() resolves the queued promise and suppresses the scheduled refresh', async () => {
        jest.useFakeTimers();
        const refreshFn = jest.fn().mockResolvedValue(SKIPPED_REFRESH_RESULT);
        const queue = new EPGVisibleRangeRefreshQueue(refreshFn);

        const pending = queue.request(range(1), { debounceMs: 50, reason: 'visible-range' });
        queue.cancelPendingRefresh();

        jest.advanceTimersByTime(50);

        await expect(pending).resolves.toEqual(SKIPPED_REFRESH_RESULT);
        expect(refreshFn).not.toHaveBeenCalled();
    });

    it('cancelPendingRefresh() aborts an active debounced refresh batch', async () => {
        jest.useFakeTimers();
        let refreshSignal: AbortSignal | null = null;
        const refreshFn = jest.fn(
            (_range: EpgVisibleRange, _reason: string, signal?: AbortSignal | null) =>
                new Promise<EpgScheduleRefreshResult>((_resolve, reject) => {
                    refreshSignal = signal ?? null;
                    signal?.addEventListener(
                        'abort',
                        () => reject(signal.reason),
                        { once: true }
                    );
                })
        );
        const queue = new EPGVisibleRangeRefreshQueue(refreshFn);

        const pending = queue.request(range(1), { debounceMs: 50, reason: 'visible-range' });
        jest.advanceTimersByTime(50);
        await Promise.resolve();

        queue.cancelPendingRefresh();

        const observedSignal = refreshSignal as AbortSignal | null;
        expect(observedSignal?.aborted).toBe(true);
        await expect(pending).resolves.toEqual(SKIPPED_REFRESH_RESULT);
    });

    it('cancelPendingRefresh() aborts every overlapping active debounced refresh batch', async () => {
        jest.useFakeTimers();
        const refreshSignals: AbortSignal[] = [];
        const refreshFn = jest.fn(
            (_range: EpgVisibleRange, _reason: string, signal?: AbortSignal | null) =>
                new Promise<EpgScheduleRefreshResult>((_resolve, reject) => {
                    if (signal) {
                        refreshSignals.push(signal);
                        signal.addEventListener(
                            'abort',
                            () => reject(signal.reason),
                            { once: true }
                        );
                    }
                })
        );
        const queue = new EPGVisibleRangeRefreshQueue(refreshFn);

        const first = queue.request(range(1), { debounceMs: 50, reason: 'visible-range' });
        jest.advanceTimersByTime(50);
        await Promise.resolve();

        const second = queue.request(range(2), { debounceMs: 50, reason: 'library-filter' });
        jest.advanceTimersByTime(50);
        await Promise.resolve();

        expect(refreshFn).toHaveBeenCalledTimes(2);

        queue.cancelPendingRefresh();

        expect(refreshSignals).toHaveLength(2);
        expect(refreshSignals.every((signal) => signal.aborted)).toBe(true);
        await expect(first).resolves.toEqual(SKIPPED_REFRESH_RESULT);
        await expect(second).resolves.toEqual(SKIPPED_REFRESH_RESULT);
    });

    it('cancelPendingRefresh() aborts an active immediate refresh batch', async () => {
        let refreshSignal: AbortSignal | null = null;
        const refreshFn = jest.fn(
            (_range: EpgVisibleRange, _reason: string, signal?: AbortSignal | null) =>
                new Promise<EpgScheduleRefreshResult>((_resolve, reject) => {
                    refreshSignal = signal ?? null;
                    signal?.addEventListener(
                        'abort',
                        () => reject(signal.reason),
                        { once: true }
                    );
                })
        );
        const queue = new EPGVisibleRangeRefreshQueue(refreshFn);

        const immediate = queue.request(range(1), { debounceMs: 0, reason: 'manual' });
        await Promise.resolve();

        queue.cancelPendingRefresh();

        const observedSignal = refreshSignal as AbortSignal | null;
        expect(observedSignal?.aborted).toBe(true);
        await expect(immediate).resolves.toEqual(SKIPPED_REFRESH_RESULT);
    });

    it('coalesces guarded requests only when they share the same authority', async () => {
        jest.useFakeTimers();
        const guardedRefresh = jest.fn().mockResolvedValue(SKIPPED_REFRESH_RESULT);
        const queue = new EPGVisibleRangeRefreshQueue(jest.fn(), guardedRefresh);
        const firstAuthority = createEpgRetainedOperationContext([]);
        const secondAuthority = createEpgRetainedOperationContext([]);

        const first = queue.request(range(1), { debounceMs: 40, operationContext: firstAuthority });
        const coalesced = queue.request(range(2), { debounceMs: 40, operationContext: firstAuthority });
        const independent = queue.request(range(3), { debounceMs: 40, operationContext: secondAuthority });
        jest.advanceTimersByTime(40);
        await Promise.all([first, coalesced, independent]);

        expect(guardedRefresh).toHaveBeenCalledTimes(2);
        expect(guardedRefresh).toHaveBeenCalledWith(
            range(2),
            'visible-range',
            expect.objectContaining({ operationContext: expect.objectContaining({ authority: firstAuthority.authority }) })
        );
        expect(guardedRefresh).toHaveBeenCalledWith(
            range(3),
            'visible-range',
            expect.objectContaining({ operationContext: expect.objectContaining({ authority: secondAuthority.authority }) })
        );
        firstAuthority.release();
        secondAuthority.release();
    });

    it('cancels one guarded waiter without aborting another waiter in the same batch', async () => {
        jest.useFakeTimers();
        const batch = deferred();
        let batchSignal: AbortSignal | null = null;
        const guardedRefresh = jest.fn((_range, _reason, options) => {
            batchSignal = options?.signal ?? null;
            return batch.promise;
        });
        const queue = new EPGVisibleRangeRefreshQueue(jest.fn(), guardedRefresh);
        const authority = createEpgRetainedOperationContext([]);
        const firstController = new AbortController();
        const firstReason = new DOMException('caller moved on', 'AbortError');
        const first = queue.request(range(1), {
            debounceMs: 10,
            signal: firstController.signal,
            operationContext: authority,
        });
        const second = queue.request(range(2), { debounceMs: 10, operationContext: authority });
        jest.advanceTimersByTime(10);
        await Promise.resolve();

        firstController.abort(firstReason);
        await expect(first).rejects.toBe(firstReason);
        expect((batchSignal as AbortSignal | null)?.aborted).toBe(false);
        batch.resolve();
        await expect(second).resolves.toEqual(SKIPPED_REFRESH_RESULT);
        authority.release();
    });
});
