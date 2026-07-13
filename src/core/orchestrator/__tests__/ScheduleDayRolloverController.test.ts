import type {
    ChannelConfig,
    IChannelManager,
    ResolvedChannelContent,
} from '../../../modules/scheduler/channel-manager';
import type { IChannelScheduler, ScheduleConfig, ScheduledProgram } from '../../../modules/scheduler/scheduler';
import type { EPGCoordinator } from '../../../modules/ui/epg';
import {
    ScheduleDayRolloverController,
    type ScheduleDayRolloverControllerDeps,
} from '../controllers/ScheduleDayRolloverController';

type RolloverHarness = {
    controller: ScheduleDayRolloverController;
    nowRef: { value: number };
    dayStartMs: number;
    channel: ChannelConfig;
    scheduler: {
        getCurrentProgram: jest.MockedFunction<() => ScheduledProgram | null>;
        loadChannel: jest.MockedFunction<(config: ScheduleConfig) => void>;
        syncToCurrentTime: jest.MockedFunction<() => void>;
    };
    channelManager: {
        getCurrentChannel: jest.MockedFunction<() => ChannelConfig | null>;
        resolveChannelContent: jest.MockedFunction<
            (
                channelId: string,
                options?: { signal?: AbortSignal | null }
            ) => Promise<ResolvedChannelContent>
        >;
    };
    epgCoordinator: {
        clearSelectedChannelScheduleSnapshot: jest.MockedFunction<() => void>;
        refreshEpgSchedules: jest.MockedFunction<
            (options?: { signal?: AbortSignal | null; reason?: string }) => Promise<void>
        >;
    };
    deps: jest.Mocked<ScheduleDayRolloverControllerDeps>;
};

const DAY_1_START = Date.UTC(2026, 2, 18, 0, 0, 0, 0);
const DAY_2_START = Date.UTC(2026, 2, 19, 0, 0, 0, 0);

const makeResolvedContent = (
    channelId = 'channel-1',
    resolvedAt = DAY_2_START + 5_000
): ResolvedChannelContent => ({
    channelId,
    items: [],
    orderedItems: [],
    totalDurationMs: 0,
    resolvedAt,
});

const makeDeferred = <T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason: unknown) => void;
} => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
    });
    return { promise, resolve, reject };
};

const makeScheduledProgram = (start: number, end: number): ScheduledProgram => ({
    item: {
        ratingKey: 'item-1',
        title: 'Program',
        fullTitle: 'Program',
        type: 'movie',
        durationMs: Math.max(1, end - start),
        thumb: null,
        year: 2026,
        scheduledIndex: 0,
    },
    scheduledStartTime: start,
    scheduledEndTime: end,
    elapsedMs: 0,
    remainingMs: Math.max(0, end - start),
    scheduleIndex: 0,
    loopNumber: 0,
    isCurrent: true,
});

const makeHarness = (): RolloverHarness => {
    const nowRef = { value: DAY_2_START + 5_000 };

    const channel: ChannelConfig = {
        id: 'channel-1',
        number: 1,
        name: 'Test Channel',
        contentSource: {
            type: 'manual',
            items: [],
        },
        playbackMode: 'sequential',
        startTimeAnchor: DAY_1_START,
        skipIntros: false,
        skipCredits: false,
        createdAt: DAY_1_START,
        updatedAt: DAY_1_START,
        lastContentRefresh: DAY_1_START,
        itemCount: 0,
        totalDurationMs: 0,
    };

    const channelManager = {
        getCurrentChannel: jest.fn(() => channel),
        resolveChannelContent: jest.fn(
            async (channelId: string, _options?: { signal?: AbortSignal | null }) => ({
                channelId,
                items: [],
                orderedItems: [],
                totalDurationMs: 0,
                resolvedAt: nowRef.value,
            })
        ),
    };

    const scheduler = {
        getCurrentProgram: jest.fn(() => null),
        loadChannel: jest.fn(),
        syncToCurrentTime: jest.fn(),
    };

    const epgCoordinator = {
        clearSelectedChannelScheduleSnapshot: jest.fn(),
        refreshEpgSchedules: jest.fn(async () => undefined),
    };

    const buildDailyScheduleConfig = jest.fn(
        (
            selectedChannel: ChannelConfig,
            items: ResolvedChannelContent['items'],
            referenceTimeMs: number
        ): ScheduleConfig => ({
            channelId: selectedChannel.id,
            anchorTime: referenceTimeMs,
            content: items,
            playbackMode: 'sequential',
            shuffleSeed: 0,
        })
    );

    const deps = {
        now: jest.fn(() => nowRef.value),
        getChannelManager: jest.fn(() => channelManager as unknown as IChannelManager),
        getScheduler: jest.fn(() => scheduler as unknown as IChannelScheduler),
        getEpgCoordinator: jest.fn(() => epgCoordinator as unknown as EPGCoordinator),
        getLocalMidnightMs: jest.fn((timeMs: number) => (timeMs >= DAY_2_START ? DAY_2_START : DAY_1_START)),
        getLocalDayKey: jest.fn((timeMs: number) => (timeMs >= DAY_2_START ? 2 : 1)),
        buildDailyScheduleConfig,
        reportError: jest.fn(),
    } as jest.Mocked<ScheduleDayRolloverControllerDeps>;

    const controller = new ScheduleDayRolloverController(deps);
    controller.setActiveScheduleDayKey(1);

    return {
        controller,
        nowRef,
        dayStartMs: DAY_2_START,
        channel,
        scheduler,
        channelManager,
        epgCoordinator,
        deps,
    };
};

describe('ScheduleDayRolloverController', () => {
    let setTimeoutSpy: jest.SpiedFunction<typeof globalThis.setTimeout>;

    beforeEach(() => {
        jest.useFakeTimers();
        setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout');
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        setTimeoutSpy.mockRestore();
        jest.useRealTimers();
    });

    it('dedupes repeated deferred rollover scheduling until the pending timer fires', async () => {
        const harness = makeHarness();
        const { controller, scheduler, dayStartMs, nowRef } = harness;
        const endTime = nowRef.value + 5_000;
        scheduler.getCurrentProgram.mockReturnValue(makeScheduledProgram(dayStartMs - 10_000, endTime));

        await controller.handleScheduleDayRollover();
        await controller.handleScheduleDayRollover();

        expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
        expect(scheduler.loadChannel).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(5_050);

        expect(scheduler.loadChannel).toHaveBeenCalledTimes(1);
        expect(scheduler.syncToCurrentTime).toHaveBeenCalledTimes(1);
    });

    it('dedupes repeated direct requests while the apply promise is pending', async () => {
        const harness = makeHarness();
        const content = makeDeferred<ResolvedChannelContent>();
        harness.channelManager.resolveChannelContent.mockReturnValueOnce(content.promise);

        const applyPromise = harness.controller.handleScheduleDayRollover();
        await harness.controller.handleScheduleDayRollover();

        expect(harness.channelManager.resolveChannelContent).toHaveBeenCalledTimes(1);

        content.resolve(makeResolvedContent());
        await applyPromise;

        expect(harness.scheduler.loadChannel).toHaveBeenCalledTimes(1);
    });

    it.each([
        [
            'explicit cancellation',
            (controller: ScheduleDayRolloverController): void =>
                controller.cancelPendingDayRollover(),
        ],
        ['dispose', (controller: ScheduleDayRolloverController): void => controller.dispose()],
    ])(
        '%s aborts content resolution without committing the canceled attempt',
        async (_label, cancel) => {
            const harness = makeHarness();
            const content = makeDeferred<ResolvedChannelContent>();
            let resolutionSignal: AbortSignal | null | undefined;
            harness.channelManager.resolveChannelContent.mockImplementationOnce(
                (_channelId, options) => {
                    resolutionSignal = options?.signal;
                    return content.promise;
                }
            );

            const applyPromise = harness.controller.handleScheduleDayRollover();
            expect(resolutionSignal?.aborted).toBe(false);
            cancel(harness.controller);
            expect(resolutionSignal?.aborted).toBe(true);
            content.resolve(makeResolvedContent());
            await applyPromise;

            expect(harness.scheduler.loadChannel).not.toHaveBeenCalled();
            expect(harness.scheduler.syncToCurrentTime).not.toHaveBeenCalled();
            expect(harness.epgCoordinator.clearSelectedChannelScheduleSnapshot).not.toHaveBeenCalled();
            expect(harness.epgCoordinator.refreshEpgSchedules).not.toHaveBeenCalled();
        }
    );

    it('does not mark a canceled attempt active after EPG refresh settles', async () => {
        const harness = makeHarness();
        const refresh = makeDeferred<void>();
        const refreshStarted = makeDeferred<void>();
        const stalePublication = jest.fn();
        let refreshSignal: AbortSignal | null | undefined;
        harness.epgCoordinator.refreshEpgSchedules.mockImplementationOnce(async (options) => {
            refreshSignal = options?.signal;
            refreshStarted.resolve();
            await refresh.promise;
            if (!options?.signal?.aborted) {
                stalePublication();
            }
        });

        const canceledAttempt = harness.controller.handleScheduleDayRollover();
        await refreshStarted.promise;
        expect(refreshSignal?.aborted).toBe(false);
        harness.controller.cancelPendingDayRollover();
        expect(refreshSignal?.aborted).toBe(true);
        refresh.resolve();
        await canceledAttempt;

        expect(stalePublication).not.toHaveBeenCalled();

        await harness.controller.handleScheduleDayRollover();

        expect(harness.scheduler.loadChannel).toHaveBeenCalledTimes(2);
        expect(harness.epgCoordinator.refreshEpgSchedules).toHaveBeenCalledTimes(2);
    });

    it('retries the same day after content resolution rejects and advances only on success', async () => {
        const harness = makeHarness();
        const error = new Error('resolve failed');
        harness.channelManager.resolveChannelContent.mockRejectedValueOnce(error);

        await expect(harness.controller.handleScheduleDayRollover()).rejects.toBe(error);

        await harness.controller.handleScheduleDayRollover();
        await harness.controller.handleScheduleDayRollover();

        expect(harness.channelManager.resolveChannelContent).toHaveBeenCalledTimes(2);
        expect(harness.scheduler.loadChannel).toHaveBeenCalledTimes(1);
    });

    it('retries the same day after schedule loading throws and advances only on success', async () => {
        const harness = makeHarness();
        const error = new Error('load failed');
        harness.scheduler.loadChannel.mockImplementationOnce(() => {
            throw error;
        });

        await expect(harness.controller.handleScheduleDayRollover()).rejects.toBe(error);

        await harness.controller.handleScheduleDayRollover();
        await harness.controller.handleScheduleDayRollover();

        expect(harness.channelManager.resolveChannelContent).toHaveBeenCalledTimes(2);
        expect(harness.scheduler.loadChannel).toHaveBeenCalledTimes(2);
        expect(harness.scheduler.syncToCurrentTime).toHaveBeenCalledTimes(1);
    });

    it('retries the same day after EPG refresh rejects and advances only on success', async () => {
        const harness = makeHarness();
        const error = new Error('EPG refresh failed');
        harness.epgCoordinator.refreshEpgSchedules.mockRejectedValueOnce(error);

        await expect(harness.controller.handleScheduleDayRollover()).rejects.toBe(error);

        await harness.controller.handleScheduleDayRollover();
        await harness.controller.handleScheduleDayRollover();

        expect(harness.channelManager.resolveChannelContent).toHaveBeenCalledTimes(2);
        expect(harness.epgCoordinator.refreshEpgSchedules).toHaveBeenCalledTimes(2);
    });

    it('reports a deferred failure once and permits a later same-day retry without a loop', async () => {
        const harness = makeHarness();
        const { controller, scheduler, dayStartMs, nowRef } = harness;
        const endTime = nowRef.value + 5_000;
        const error = new Error('deferred resolve failed');
        scheduler.getCurrentProgram.mockReturnValue(
            makeScheduledProgram(dayStartMs - 10_000, endTime)
        );
        harness.channelManager.resolveChannelContent.mockRejectedValueOnce(error);

        await controller.handleScheduleDayRollover();
        await jest.advanceTimersByTimeAsync(5_050);

        expect(harness.deps.reportError).toHaveBeenCalledTimes(1);
        expect(harness.deps.reportError).toHaveBeenCalledWith(
            '[Orchestrator] Failed to apply day rollover:',
            error
        );
        expect(harness.channelManager.resolveChannelContent).toHaveBeenCalledTimes(1);
        expect(setTimeoutSpy).toHaveBeenCalledTimes(1);

        scheduler.getCurrentProgram.mockReturnValue(null);
        await controller.handleScheduleDayRollover();
        await controller.handleScheduleDayRollover();

        expect(harness.channelManager.resolveChannelContent).toHaveBeenCalledTimes(2);
        expect(harness.deps.reportError).toHaveBeenCalledTimes(1);
        expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    });

    it('allows re-scheduling after explicit pending rollover cancellation', async () => {
        const harness = makeHarness();
        const { controller, scheduler, dayStartMs, nowRef } = harness;
        const endTime = nowRef.value + 5_000;
        scheduler.getCurrentProgram.mockReturnValue(makeScheduledProgram(dayStartMs - 10_000, endTime));

        await controller.handleScheduleDayRollover();
        controller.cancelPendingDayRollover();
        await controller.handleScheduleDayRollover();

        expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    });

    it('aborts replaced authority before scheduling a new midnight-spanning attempt', async () => {
        const harness = makeHarness();
        const oldContent = makeDeferred<ResolvedChannelContent>();
        const newContent = makeDeferred<ResolvedChannelContent>();
        let oldSignal: AbortSignal | null | undefined;
        let newSignal: AbortSignal | null | undefined;
        harness.channelManager.resolveChannelContent
            .mockImplementationOnce((_channelId, options) => {
                oldSignal = options?.signal;
                return oldContent.promise;
            })
            .mockImplementationOnce((_channelId, options) => {
                newSignal = options?.signal;
                return newContent.promise;
            });

        const oldAttempt = harness.controller.handleScheduleDayRollover();
        expect(oldSignal?.aborted).toBe(false);

        harness.deps.getLocalDayKey.mockReturnValue(3);
        const endTime = harness.nowRef.value + 5_000;
        harness.scheduler.getCurrentProgram.mockReturnValue(
            makeScheduledProgram(harness.dayStartMs - 10_000, endTime)
        );

        await harness.controller.handleScheduleDayRollover();
        expect(oldSignal?.aborted).toBe(true);

        await jest.advanceTimersByTimeAsync(5_050);
        expect(newSignal?.aborted).toBe(false);

        oldContent.resolve(makeResolvedContent());
        await oldAttempt;
        harness.controller.cancelPendingDayRollover();
        expect(newSignal?.aborted).toBe(true);
        newContent.resolve(makeResolvedContent());
    });

    it.each([
        [
            'explicit cancellation',
            (controller: ScheduleDayRolloverController): void =>
                controller.cancelPendingDayRollover(),
        ],
        ['dispose', (controller: ScheduleDayRolloverController): void => controller.dispose()],
    ])(
        '%s prevents the canceled deferred callback from applying a schedule',
        async (_label, cancel) => {
            const harness = makeHarness();
            const { controller, scheduler, dayStartMs, nowRef } = harness;
            const endTime = nowRef.value + 5_000;
            scheduler.getCurrentProgram.mockReturnValue(
                makeScheduledProgram(dayStartMs - 10_000, endTime)
            );

            await controller.handleScheduleDayRollover();
            cancel(controller);
            await jest.advanceTimersByTimeAsync(5_050);

            expect(harness.channelManager.resolveChannelContent).not.toHaveBeenCalled();
            expect(scheduler.loadChannel).not.toHaveBeenCalled();
        }
    );

    it('does not let an old canceled attempt clear a newer pending attempt for the same day', async () => {
        const harness = makeHarness();
        const oldContent = makeDeferred<ResolvedChannelContent>();
        const newContent = makeDeferred<ResolvedChannelContent>();
        const oldError = new Error('old attempt failed');
        harness.channelManager.resolveChannelContent
            .mockReturnValueOnce(oldContent.promise)
            .mockReturnValueOnce(newContent.promise);

        const oldAttempt = harness.controller.handleScheduleDayRollover();
        harness.controller.cancelPendingDayRollover();
        const newAttempt = harness.controller.handleScheduleDayRollover();

        expect(harness.channelManager.resolveChannelContent).toHaveBeenCalledTimes(2);

        oldContent.reject(oldError);
        await expect(oldAttempt).resolves.toBeUndefined();
        await harness.controller.handleScheduleDayRollover();

        expect(harness.channelManager.resolveChannelContent).toHaveBeenCalledTimes(2);

        newContent.resolve(makeResolvedContent());
        await newAttempt;
        await harness.controller.handleScheduleDayRollover();

        expect(harness.channelManager.resolveChannelContent).toHaveBeenCalledTimes(2);
        expect(harness.scheduler.loadChannel).toHaveBeenCalledTimes(1);
    });
});
