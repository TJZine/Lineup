import type { EPGRefreshControllerDeps } from '../coordinator/EPGRefreshController';
import { EpgPreferencesStore } from '../../../settings/EpgPreferencesStore';

const runtimeInstances: Array<{
    buildGuideSelectionSnapshot: jest.Mock;
    clearLoadedScheduleMarkers: jest.Mock;
    clearScheduleCaches: jest.Mock;
    clearSelectedChannelScheduleSnapshot: jest.Mock;
    dispose: jest.Mock;
    refreshForRange: jest.Mock;
}> = [];

const mockRuntimeConstructor = jest.fn(() => {
    const runtime = {
        buildGuideSelectionSnapshot: jest.fn().mockResolvedValue(null),
        clearLoadedScheduleMarkers: jest.fn(),
        clearScheduleCaches: jest.fn(),
        clearSelectedChannelScheduleSnapshot: jest.fn(),
        dispose: jest.fn(),
        refreshForRange: jest.fn().mockResolvedValue(undefined),
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

const createDeps = (): EPGRefreshControllerDeps => ({
    getEpg: () => ({
        isVisible: jest.fn(() => true),
        getState: jest.fn(() => ({
            viewWindow: {
                startChannelIndex: 0,
                endChannelIndex: 0,
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
        showCurrentTimeIndicator: true,
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
    });

    it('does not publish a schedule runtime that loads after invalidation', async () => {
        const controller = new EPGRefreshController(createDeps());
        const range = { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 };

        const canceledRefresh = controller.refreshEpgSchedulesForRangeNow(range, 'visible-range');
        controller.cancelScheduledRefreshWork('close-epg');
        await canceledRefresh;
        await flushPromises();

        expect(runtimeInstances).toHaveLength(1);
        expect(runtimeInstances[0]?.dispose).toHaveBeenCalledWith('close-epg');
        expect(runtimeInstances[0]?.refreshForRange).not.toHaveBeenCalled();

        await controller.refreshEpgSchedulesForRangeNow(range, 'visible-range-retry');

        expect(runtimeInstances).toHaveLength(2);
        expect(runtimeInstances[0]?.refreshForRange).not.toHaveBeenCalled();
        expect(runtimeInstances[1]?.refreshForRange).toHaveBeenCalledWith(range, 'visible-range-retry');
    });
});
