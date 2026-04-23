import {
    EPGBackgroundWarmQueue,
    type EPGBackgroundWarmQueueDeps,
} from '../runtime/EPGBackgroundWarmQueue';
import type { ChannelConfig, PlaybackMode } from '../../../scheduler/channel-manager';
import { flushPromises } from '../../../../__tests__/helpers';

const makeChannel = (id: string, number: number): ChannelConfig => ({
    id,
    name: `Channel ${number}`,
    number,
    contentSource: { type: 'manual', items: [] },
    playbackMode: 'sequential' as PlaybackMode,
    startTimeAnchor: 0,
    skipIntros: false,
    skipCredits: false,
    createdAt: 0,
    updatedAt: 0,
    lastContentRefresh: 0,
    itemCount: 0,
    totalDurationMs: 0,
});

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
        const refreshChannelSchedule = jest.fn().mockResolvedValue(undefined);

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
            refreshChannelSchedule,
            concurrency: 1,
        });

        expect(onCancel).toHaveBeenCalledWith('replace-background-warm-queue', null);

        jest.advanceTimersByTime(1_000);
        await flushPromises();
        await flushPromises();

        expect(refreshChannelSchedule).toHaveBeenCalledTimes(2);
        expect(onCancel).toHaveBeenCalledWith('warm-queue-complete', expect.any(Object));
    });

    it('cancels stale refresh queues before any channel work starts', async () => {
        let activeRefreshId = 2;
        const onCancel = jest.fn();
        const refreshChannelSchedule = jest.fn().mockResolvedValue(undefined);

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
            refreshChannelSchedule,
            concurrency: 1,
        });

        jest.advanceTimersByTime(200);
        await flushPromises();

        expect(refreshChannelSchedule).not.toHaveBeenCalled();
        expect(onCancel).toHaveBeenCalledWith('stale-refresh-token', expect.any(Object));
    });

    it('backs off when warm-queue policy reports backpressure', async () => {
        let activeRefreshId = 1;
        let calls = 0;
        const refreshChannelSchedule = jest.fn().mockResolvedValue(undefined);

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
            refreshChannelSchedule,
            concurrency: 1,
        });

        jest.advanceTimersByTime(100);
        await flushPromises();
        expect(refreshChannelSchedule).not.toHaveBeenCalled();

        jest.advanceTimersByTime(200);
        await flushPromises();
        expect(refreshChannelSchedule).toHaveBeenCalledTimes(1);
    });

    describe('when requestIdleCallback is unavailable', () => {
        type IdleGlobals = {
            requestIdleCallback?: typeof globalThis.requestIdleCallback | undefined;
            cancelIdleCallback?: typeof globalThis.cancelIdleCallback | undefined;
        };
        const idleScheduler = globalThis as unknown as IdleGlobals;
        let hadRequestIdleCallback = false;
        let hadCancelIdleCallback = false;
        let priorRequestIdleCallback: typeof globalThis.requestIdleCallback | undefined;
        let priorCancelIdleCallback: typeof globalThis.cancelIdleCallback | undefined;

        beforeEach(() => {
            hadRequestIdleCallback = Object.prototype.hasOwnProperty.call(idleScheduler, 'requestIdleCallback');
            hadCancelIdleCallback = Object.prototype.hasOwnProperty.call(idleScheduler, 'cancelIdleCallback');
            priorRequestIdleCallback = idleScheduler.requestIdleCallback;
            priorCancelIdleCallback = idleScheduler.cancelIdleCallback;
            delete idleScheduler.requestIdleCallback;
            delete idleScheduler.cancelIdleCallback;
        });

        afterEach(() => {
            if (hadRequestIdleCallback) {
                idleScheduler.requestIdleCallback = priorRequestIdleCallback;
            } else {
                delete idleScheduler.requestIdleCallback;
            }

            if (hadCancelIdleCallback) {
                idleScheduler.cancelIdleCallback = priorCancelIdleCallback;
            } else {
                delete idleScheduler.cancelIdleCallback;
            }
        });

        it('continues warming later channels when one channel load fails', async () => {
            let activeRefreshId = 1;
            const onCancel = jest.fn();
            const onError = jest.fn();
            const failure = new Error('warm failed');
            const refreshChannelSchedule = jest.fn().mockImplementation(async (channel: ChannelConfig) => {
                if (channel.id === 'c1') {
                    throw failure;
                }
            });

            const queue = new EPGBackgroundWarmQueue({
                getActiveRefreshId: (): number => activeRefreshId,
                getCacheSize: (): number => 0,
                getCacheLimit: (): number => 500,
                getInFlightCount: (): number => 0,
                onCancel,
                onError,
            });

            queue.start({
                refreshId: 1,
                reason: 'visible-range',
                channels: [makeChannel('c1', 1), makeChannel('c2', 2), makeChannel('c3', 3)],
                refreshChannelSchedule,
                concurrency: 1,
            });

            for (let i = 0; i < 20; i += 1) {
                jest.advanceTimersByTime(50);
                await flushPromises();
            }

            expect(refreshChannelSchedule).toHaveBeenCalledTimes(3);
            expect(onError).toHaveBeenCalledWith(failure);
            expect(onCancel).toHaveBeenCalledWith('warm-queue-complete', expect.any(Object));
        });
    });

    it('cancels the prior queue when replacement channels are empty', async () => {
        let activeRefreshId = 1;
        const onCancel = jest.fn();
        const refreshChannelSchedule = jest.fn().mockResolvedValue(undefined);

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
            refreshChannelSchedule,
            concurrency: 1,
        });

        onCancel.mockClear();

        queue.start({
            refreshId: 2,
            reason: 'visible-range',
            channels: [],
            refreshChannelSchedule,
            concurrency: 1,
        });

        jest.advanceTimersByTime(1_000);
        await flushPromises();

        expect(onCancel).toHaveBeenCalledWith('replace-background-warm-queue', expect.any(Object));
        expect(refreshChannelSchedule).not.toHaveBeenCalled();
    });
});
