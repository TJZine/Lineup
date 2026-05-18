import { createFacetCountRecoveryLimiter } from '../planning/ChannelSetupFacetCountRecoveryLimiter';
import { createDeferred } from './ChannelSetupFacetPlanningTestHelpers';

const flushMicrotasks = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
};

describe('createFacetCountRecoveryLimiter', () => {
    it('runs tasks up to the max concurrency and starts queued work in FIFO order', async () => {
        const limiter = createFacetCountRecoveryLimiter(2);
        const first = createDeferred<string>();
        const second = createDeferred<string>();
        const third = createDeferred<string>();
        const fourth = createDeferred<string>();
        const started: number[] = [];
        const activeCounts: number[] = [];
        let active = 0;

        const runLimited = (index: number, deferred: typeof first): Promise<string> => limiter(async () => {
            started.push(index);
            active++;
            activeCounts.push(active);
            try {
                return await deferred.promise;
            } finally {
                active--;
            }
        });

        const firstResult = runLimited(1, first);
        const secondResult = runLimited(2, second);
        const thirdResult = runLimited(3, third);
        const fourthResult = runLimited(4, fourth);

        await flushMicrotasks();
        expect(started).toEqual([1, 2]);
        expect(Math.max(...activeCounts)).toBe(2);

        first.resolve('first');
        await expect(firstResult).resolves.toBe('first');
        await flushMicrotasks();
        expect(started).toEqual([1, 2, 3]);

        second.resolve('second');
        await expect(secondResult).resolves.toBe('second');
        await flushMicrotasks();
        expect(started).toEqual([1, 2, 3, 4]);

        third.resolve('third');
        fourth.resolve('fourth');
        await expect(thirdResult).resolves.toBe('third');
        await expect(fourthResult).resolves.toBe('fourth');
        expect(Math.max(...activeCounts)).toBe(2);
    });

    it('forwards rejections and releases capacity when a task settles', async () => {
        const limiter = createFacetCountRecoveryLimiter(1);
        const first = createDeferred<string>();
        const second = createDeferred<string>();
        const started: number[] = [];

        const firstResult = limiter(async () => {
            started.push(1);
            return first.promise;
        });
        const secondResult = limiter(async () => {
            started.push(2);
            return second.promise;
        });

        await flushMicrotasks();
        expect(started).toEqual([1]);

        first.reject(new Error('first failed'));
        await expect(firstResult).rejects.toThrow('first failed');
        await flushMicrotasks();
        expect(started).toEqual([1, 2]);

        second.resolve('second');
        await expect(secondResult).resolves.toBe('second');
    });
});
