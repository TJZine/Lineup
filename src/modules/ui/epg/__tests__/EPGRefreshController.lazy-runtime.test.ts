/**
 * @jest-environment jsdom
 */

import type { EPGRefreshControllerDeps } from '../coordinator/EPGRefreshController';
import type { IChannelManager } from '../../../scheduler/channel-manager';
import type { IEPGComponent } from '../interfaces';
import { LINEUP_STORAGE_KEYS } from '../../../../config/storageKeys';
import { EpgPreferencesStore } from '../../../settings/EpgPreferencesStore';

const runtimeInstances: Array<{
    buildGuideSelectionSnapshot: jest.Mock;
    clearLoadedScheduleMarkers: jest.Mock;
    clearScheduleCaches: jest.Mock;
    clearSelectedChannelScheduleSnapshot: jest.Mock;
    dispose: jest.Mock;
    refreshForRange: jest.Mock;
    retryChannelSchedule: jest.Mock;
    warmHiddenChannels: jest.Mock;
}> = [];

const mockRuntimeConstructor = jest.fn(() => {
    const runtime = {
        buildGuideSelectionSnapshot: jest.fn().mockResolvedValue(null),
        clearLoadedScheduleMarkers: jest.fn(),
        clearScheduleCaches: jest.fn(),
        clearSelectedChannelScheduleSnapshot: jest.fn(),
        dispose: jest.fn(),
        refreshForRange: jest.fn().mockResolvedValue(undefined),
        retryChannelSchedule: jest.fn().mockResolvedValue(undefined),
        warmHiddenChannels: jest.fn().mockResolvedValue(undefined),
    };
    runtimeInstances.push(runtime);
    return runtime;
});

jest.mock('../runtime/EPGScheduleRefreshRuntime', () => ({
    EPGScheduleRefreshRuntime: mockRuntimeConstructor,
}));

import { EPGRefreshController } from '../coordinator/EPGRefreshController';

const flushPromises = async (rounds = 4): Promise<void> => {
    for (let index = 0; index < rounds; index += 1) {
        await Promise.resolve();
    }
};

const createDeps = (epgVisible = true): EPGRefreshControllerDeps => ({
    getEpg: () => ({
        isVisible: jest.fn(() => epgVisible),
        getState: jest.fn(() => ({
            viewWindow: {
                startChannelIndex: 0,
                endChannelIndexExclusive: 0,
                startTime: 0,
                endTime: 60_000,
            },
        })),
    } as never),
    getChannelManager: () => ({
        getAllChannels: jest.fn(() => []),
        getCurrentChannel: jest.fn(() => null),
    } as never),
    getScheduler: () => null,
    getEpgUiStatus: () => 'ready',
    getEpgConfig: () => ({
        containerId: 'epg',
        visibleChannels: 5,
        visibleHours: 3,
        totalHours: 6,
        timeSlotMinutes: 30,
        pixelsPerMinute: 4,
        rowHeight: 80,
        autoScrollToNow: true,
    }),
    getLocalMidnightMs: () => 0,
    buildDailyScheduleConfig: jest.fn(() => ({
        channelId: 'channel-1',
        anchorTime: 0,
        content: [],
        playbackMode: 'sequential',
        shuffleSeed: 1,
    })),
    appendIssueDiagnostic: jest.fn(),
    epgPreferencesStore: new EpgPreferencesStore(),
    primeEpgChannels: jest.fn(),
});

describe('EPGRefreshController lazy schedule runtime', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        runtimeInstances.length = 0;
        localStorage.clear();
    });

    it('does not publish a schedule runtime that loads after invalidation', async () => {
        const controller = new EPGRefreshController(createDeps());
        const range = { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 };

        const canceledRefresh = controller.refreshEpgSchedulesForRangeNow(range, 'visible-range');
        controller.cancelScheduledRefreshWork('close-epg');
        await canceledRefresh;
        await flushPromises();

        expect(runtimeInstances).toHaveLength(1);
        expect(runtimeInstances[0]?.dispose).toHaveBeenCalledWith('close-epg');
        expect(runtimeInstances[0]?.dispose).toHaveBeenCalledTimes(1);
        expect(runtimeInstances[0]?.refreshForRange).not.toHaveBeenCalled();

        await controller.refreshEpgSchedulesForRangeNow(range, 'visible-range-retry');

        expect(runtimeInstances).toHaveLength(2);
        expect(runtimeInstances[0]?.refreshForRange).not.toHaveBeenCalled();
        expect(runtimeInstances[1]?.refreshForRange).toHaveBeenCalledWith(range, 'visible-range-retry');
    });

    it('delegates a row retry to one targeted channel schedule retry', async () => {
        const controller = new EPGRefreshController(createDeps());

        await controller.retryRowSchedule('channel-1');

        expect(runtimeInstances).toHaveLength(1);
        expect(runtimeInstances[0]?.retryChannelSchedule).toHaveBeenCalledTimes(1);
        expect(runtimeInstances[0]?.retryChannelSchedule).toHaveBeenCalledWith('channel-1');
        expect(runtimeInstances[0]?.refreshForRange).not.toHaveBeenCalled();
    });

    it('warms the viewport around the current channel without a visible-range refresh', async () => {
        const channels = Array.from({ length: 10 }, (_, index) => ({
            id: `c${index + 1}`,
            number: index + 1,
            name: `Channel ${index + 1}`,
            contentSource: { type: 'manual', items: [] },
            playbackMode: 'sequential',
            startTimeAnchor: 0,
            skipIntros: false,
            skipCredits: false,
            createdAt: 0,
            updatedAt: 0,
            lastContentRefresh: 0,
            itemCount: 0,
            totalDurationMs: 0,
        }));
        const deps = {
            ...createDeps(false),
            getChannelManager: (): IChannelManager => ({
                getAllChannels: jest.fn(() => channels),
                getCurrentChannel: jest.fn(() => channels[4]),
            } as unknown as IChannelManager),
        };
        const controller = new EPGRefreshController(deps);

        await controller.warmCurrentViewportForStartup();

        expect(runtimeInstances).toHaveLength(1);
        const warmed = runtimeInstances[0]?.warmHiddenChannels as jest.Mock;
        expect(warmed).toHaveBeenCalledTimes(1);
        const warmedChannels = warmed.mock.calls[0]?.[0] as Array<{ id: string }>;
        expect(warmedChannels[0]?.id).toBe('c5');
        expect(warmedChannels.map((channel) => channel.id)).toContain('c9');
        // Viewport-bounded immediate tier only, far below the background ceiling.
        expect(warmedChannels.length).toBeLessThanOrEqual(12);
        expect(runtimeInstances[0]?.refreshForRange).not.toHaveBeenCalled();
    });

    it('does not start startup warmup when the Guide becomes visible during lazy loading', async () => {
        const visibleState = { value: false };
        const epg = {
            isVisible: jest.fn(() => visibleState.value),
            getState: jest.fn(() => ({
                viewWindow: {
                    startChannelIndex: 0,
                    endChannelIndexExclusive: 0,
                    startTime: 0,
                    endTime: 60_000,
                },
            })),
        };
        const deps = {
            ...createDeps(false),
            getEpg: (): IEPGComponent => epg as never,
        };
        const controller = new EPGRefreshController(deps);

        const warming = controller.warmCurrentViewportForStartup();
        visibleState.value = true;
        await warming;

        expect(runtimeInstances).toHaveLength(1);
        expect(runtimeInstances[0]?.warmHiddenChannels).not.toHaveBeenCalled();
    });

    it('stops an already-started startup warmup when the Guide becomes visible', async () => {
        const visibleState = { value: false };
        const epg = {
            isVisible: jest.fn(() => visibleState.value),
            getState: jest.fn(() => ({
                viewWindow: {
                    startChannelIndex: 0,
                    endChannelIndexExclusive: 0,
                    startTime: 0,
                    endTime: 60_000,
                },
            })),
        };
        const deps = {
            ...createDeps(false),
            getEpg: (): IEPGComponent => epg as never,
            getChannelManager: (): IChannelManager => ({
                getAllChannels: jest.fn(() => [{
                    id: 'c1',
                    number: 1,
                    name: 'Channel 1',
                    contentSource: { type: 'manual', items: [] },
                    playbackMode: 'sequential',
                    startTimeAnchor: 0,
                    skipIntros: false,
                    skipCredits: false,
                    createdAt: 0,
                    updatedAt: 0,
                    lastContentRefresh: 0,
                    itemCount: 0,
                    totalDurationMs: 0,
                }]),
                getCurrentChannel: jest.fn(() => null),
            } as unknown as IChannelManager),
        };
        const controller = new EPGRefreshController(deps);
        const warming = controller.warmCurrentViewportForStartup();
        await warming;
        const runtime = runtimeInstances[0];
        if (!runtime) throw new Error('Expected lazy runtime instance.');
        expect(runtime.warmHiddenChannels).toHaveBeenCalledTimes(1);
        visibleState.value = true;
        const warmOptions = runtime.warmHiddenChannels.mock.calls[0]?.[1] as { shouldContinue: () => boolean };
        expect(warmOptions.shouldContinue()).toBe(false);
    });

    it('uses a read-only storage snapshot for startup warmup selection', async () => {
        const deps = createDeps(false);
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW, 'invalid');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, 'invalid');
        const removeSpy = jest.spyOn(Storage.prototype, 'removeItem');
        const controller = new EPGRefreshController(deps);

        await controller.warmCurrentViewportForStartup();

        expect(removeSpy).not.toHaveBeenCalled();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW)).toBe('invalid');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED)).toBe('invalid');
    });

    it('does not build a guide snapshot with a runtime invalidated during the await boundary', async () => {
        const controller = new EPGRefreshController(createDeps());
        const range = { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 };

        await controller.refreshEpgSchedulesForRangeNow(range, 'visible-range');
        expect(runtimeInstances).toHaveLength(1);

        const snapshot = controller.buildGuideSelectionSnapshot({
            channelId: 'channel-1',
            ratingKey: 'rating-1',
            scheduledStartTime: 0,
            scheduledEndTime: 60_000,
            selectedAt: 1,
        });
        controller.cancelScheduledRefreshWork('close-epg');

        await expect(snapshot).resolves.toBeNull();
        expect(runtimeInstances[0]?.dispose).toHaveBeenCalledWith('close-epg');
        expect(runtimeInstances[0]?.dispose).toHaveBeenCalledTimes(1);
        expect(runtimeInstances[0]?.buildGuideSelectionSnapshot).not.toHaveBeenCalled();
    });
});
