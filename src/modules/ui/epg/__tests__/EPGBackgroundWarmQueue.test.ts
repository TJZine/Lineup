import {
    EPGBackgroundWarmQueue,
    type EPGBackgroundWarmQueueDeps,
} from '../EPGBackgroundWarmQueue';
import type { ChannelConfig, PlaybackMode } from '../../../scheduler/channel-manager';

const makeChannel = (id: string, number: number): ChannelConfig => ({
    id,
    name: `Channel ${number}`,
    number,
    contentSource: { type: 'manual', items: [] },
    playbackMode: 'loop' as PlaybackMode,
    startTimeAnchor: 0,
    skipIntros: false,
    skipCredits: false,
    createdAt: 0,
    updatedAt: 0,
    lastContentRefresh: 0,
    itemCount: 0,
    totalDurationMs: 0,
});

const flushPromises = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
};

describe('EPGBackgroundWarmQueue', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('runs queued channels and cancels with warm-queue-complete', async () => {
        let activeRefreshId = 1;
        const onCancel = jest.fn();
        const runForChannel = jest.fn().mockResolvedValue(undefined);

        const queue = new EPGBackgroundWarmQueue({
            getActiveRefreshId: (): number => activeRefreshId,
            getCacheSize: (): number => 0,
            getCacheLimit: (): number => 500,
            getInFlightCount: (): number => 0,
            onCancel,
        });

        queue.start({
            refreshId: 1,
            reason: 'visible-range',
            channels: [makeChannel('c1', 1), makeChannel('c2', 2)],
            runForChannel,
            concurrency: 1,
        });

        jest.advanceTimersByTime(1_000);
        await flushPromises();

        expect(runForChannel).toHaveBeenCalledTimes(2);
        expect(onCancel).toHaveBeenCalledWith('replace-background-warm-queue', null);
    });

    it('cancels stale refresh queues before any channel work starts', async () => {
        let activeRefreshId = 2;
        const onCancel = jest.fn();
        const runForChannel = jest.fn().mockResolvedValue(undefined);

        const queue = new EPGBackgroundWarmQueue({
            getActiveRefreshId: (): number => activeRefreshId,
            getCacheSize: (): number => 0,
            getCacheLimit: (): number => 500,
            getInFlightCount: (): number => 0,
            onCancel,
        });

        queue.start({
            refreshId: 1,
            reason: 'visible-range',
            channels: [makeChannel('c1', 1)],
            runForChannel,
            concurrency: 1,
        });

        jest.advanceTimersByTime(200);
        await flushPromises();

        expect(runForChannel).not.toHaveBeenCalled();
        expect(onCancel).toHaveBeenCalledWith('stale-refresh-token', expect.any(Object));
    });

    it('backs off when warm-queue policy reports backpressure', async () => {
        let activeRefreshId = 1;
        let calls = 0;
        const runForChannel = jest.fn().mockResolvedValue(undefined);

        const queue = new EPGBackgroundWarmQueue({
            getActiveRefreshId: (): number => activeRefreshId,
            getCacheSize: (): number => 0,
            getCacheLimit: (): number => 500,
            getInFlightCount: (): number => 0,
            getWarmQueueAction: (
                inputs
            ): ReturnType<NonNullable<EPGBackgroundWarmQueueDeps['getWarmQueueAction']>> => {
                calls += 1;
                if (calls === 1) {
                    return { kind: 'backpressure' };
                }
                if (inputs.cursor >= inputs.totalChannels) {
                    return { kind: 'cancel', reason: 'warm-queue-complete' };
                }
                return { kind: 'runBatch' };
            },
        });

        queue.start({
            refreshId: 1,
            reason: 'visible-range',
            channels: [makeChannel('c1', 1)],
            runForChannel,
            concurrency: 1,
        });

        jest.advanceTimersByTime(100);
        await flushPromises();
        expect(runForChannel).not.toHaveBeenCalled();

        jest.advanceTimersByTime(200);
        await flushPromises();
        expect(runForChannel).toHaveBeenCalledTimes(1);
    });
});
