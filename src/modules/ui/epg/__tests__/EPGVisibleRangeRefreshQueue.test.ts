import { EPGVisibleRangeRefreshQueue } from '../EPGVisibleRangeRefreshQueue';
import type { EpgVisibleRange } from '../types';

describe('EPGVisibleRangeRefreshQueue', () => {
    const range = (id: number): EpgVisibleRange => ({
        channelStart: id,
        channelEnd: id + 1,
        timeStartMs: id * 1000,
        timeEndMs: (id * 1000) + 500,
    });

    const deferred = (): { promise: Promise<void>; resolve: () => void } => {
        let resolve!: () => void;
        const promise = new Promise<void>((innerResolve) => {
            resolve = innerResolve;
        });
        return { promise, resolve };
    };

    afterEach(() => {
        jest.useRealTimers();
    });

    it('runs immediate refresh when debounce is zero', async () => {
        const refreshFn = jest.fn().mockResolvedValue(undefined);
        const queue = new EPGVisibleRangeRefreshQueue(refreshFn);

        await queue.request(range(1), { debounceMs: 0, reason: 'manual' });

        expect(refreshFn).toHaveBeenCalledTimes(1);
        expect(refreshFn).toHaveBeenCalledWith(range(1), 'manual');
    });

    it('coalesces debounced requests and shares one pending promise', async () => {
        jest.useFakeTimers();
        const refreshFn = jest.fn().mockResolvedValue(undefined);
        const queue = new EPGVisibleRangeRefreshQueue(refreshFn);

        const first = queue.request(range(1), { debounceMs: 50, reason: 'visible-range' });
        const second = queue.request(range(2), { debounceMs: 50, reason: 'library-filter' });

        expect(first).toBe(second);
        expect(refreshFn).not.toHaveBeenCalled();

        jest.advanceTimersByTime(50);
        await Promise.all([first, second]);

        expect(refreshFn).toHaveBeenCalledTimes(1);
        expect(refreshFn).toHaveBeenCalledWith(range(2), 'library-filter');
    });

    it('immediate refresh preempts armed debounce and settles pending debounced promise', async () => {
        jest.useFakeTimers();
        const refreshFn = jest.fn().mockResolvedValue(undefined);

        const queue = new EPGVisibleRangeRefreshQueue(refreshFn);

        const debounced = queue.request(range(1), { debounceMs: 75, reason: 'visible-range' });
        const secondDebounced = queue.request(range(2), { debounceMs: 75, reason: 'visible-range' });
        expect(debounced).toBe(secondDebounced);

        const immediate = queue.request(range(3), { debounceMs: 0, reason: 'library-filter' });
        expect(refreshFn).toHaveBeenCalledTimes(1);
        expect(refreshFn).toHaveBeenCalledWith(range(3), 'library-filter');

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
        expect(refreshFn).toHaveBeenCalledWith(range(2), 'manual');

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
        expect(refreshFn).toHaveBeenNthCalledWith(2, range(3), 'visible-range');

        queuedRefresh.resolve();
        await expect(queued).resolves.toBeUndefined();
        await expect(immediate).resolves.toBeUndefined();
        await expect(debounced).resolves.toBeUndefined();
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
        expect(refreshFn).toHaveBeenNthCalledWith(1, range(1), 'visible-range');
        expect(refreshFn).toHaveBeenNthCalledWith(2, range(2), 'manual');

        let immediateSettled = false;
        void immediate.then(() => {
            immediateSettled = true;
        });

        debouncedRefresh.resolve();
        await Promise.resolve();
        expect(immediateSettled).toBe(false);

        immediateRefresh.resolve();
        await expect(immediate).resolves.toBeUndefined();
        await expect(debounced).resolves.toBeUndefined();
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

        expect(refreshFn).toHaveBeenNthCalledWith(1, range(1), 'visible-range');
        expect(refreshFn).toHaveBeenNthCalledWith(2, range(2), 'library-filter');

        firstRefresh.resolve();
        await expect(first).resolves.toBeUndefined();

        secondRefresh.resolve();
        await expect(second).resolves.toBeUndefined();
    });

    it('cancelPendingRefresh() resolves the queued promise and suppresses the scheduled refresh', async () => {
        jest.useFakeTimers();
        const refreshFn = jest.fn().mockResolvedValue(undefined);
        const queue = new EPGVisibleRangeRefreshQueue(refreshFn);

        const pending = queue.request(range(1), { debounceMs: 50, reason: 'visible-range' });
        queue.cancelPendingRefresh();

        jest.advanceTimersByTime(50);

        await expect(pending).resolves.toBeUndefined();
        expect(refreshFn).not.toHaveBeenCalled();
    });
});
