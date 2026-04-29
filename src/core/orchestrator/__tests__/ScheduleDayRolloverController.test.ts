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
} from '../ScheduleDayRolloverController';

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
            (channelId: string) => Promise<ResolvedChannelContent>
        >;
    };
    epgCoordinator: {
        clearSelectedChannelScheduleSnapshot: jest.MockedFunction<() => void>;
        refreshEpgSchedules: jest.MockedFunction<() => Promise<void>>;
    };
    deps: jest.Mocked<ScheduleDayRolloverControllerDeps>;
};

const DAY_1_START = Date.UTC(2026, 2, 18, 0, 0, 0, 0);
const DAY_2_START = Date.UTC(2026, 2, 19, 0, 0, 0, 0);

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
    streamDescriptor: null,
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
        resolveChannelContent: jest.fn(async (channelId: string) => ({
            channelId,
            items: [],
            orderedItems: [],
            totalDurationMs: 0,
            resolvedAt: nowRef.value,
        })),
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
});
