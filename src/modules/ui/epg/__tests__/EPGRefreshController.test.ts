import { EPGRefreshController, type EPGRefreshControllerDeps } from '../EPGRefreshController';
import type { IEPGComponent } from '../interfaces';
import type { ChannelConfig, IChannelManager, PlaybackMode, ResolvedChannelContent } from '../../../scheduler/channel-manager';
import type { IChannelScheduler, ScheduleConfig } from '../../../scheduler/scheduler';
import { EpgPreferencesStore } from '../../../settings/EpgPreferencesStore';
import type { EPGConfig } from '../types';

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

const makeDeps = (): {
    deps: EPGRefreshControllerDeps;
    epg: IEPGComponent;
    channelManager: IChannelManager;
} => {
    const channels = [makeChannel('c1', 1)];
    const epg: IEPGComponent = {
        isVisible: jest.fn().mockReturnValue(true),
        getState: jest.fn().mockReturnValue({
            isVisible: true,
            focusedCell: null,
            scrollPosition: { channelOffset: 0, timeOffset: 0 },
            viewWindow: {
                startTime: 0,
                endTime: 60_000,
                startChannelIndex: 0,
                endChannelIndex: 0,
            },
            currentTime: 0,
        }),
        clearSchedules: jest.fn(),
        scrollToChannel: jest.fn(),
        focusChannel: jest.fn(),
        setGridAnchorTime: jest.fn(),
        loadScheduleForChannel: jest.fn(),
    } as unknown as IEPGComponent;
    const channelManager: IChannelManager = {
        getAllChannels: jest.fn(() => channels),
        getCurrentChannel: jest.fn(() => channels[0] ?? null),
        resolveChannelContent: jest.fn(async (_id: string) => ({
            channelId: 'c1',
            resolvedAt: Date.now(),
            items: [],
            totalDurationMs: 0,
            orderedItems: [],
        } as ResolvedChannelContent)),
        resolveChannelItemsForSchedule: jest.fn(async () => []),
    } as unknown as IChannelManager;
    const scheduler: IChannelScheduler = {
        getState: jest.fn(() => ({ isActive: true, channelId: 'c1' })),
        getScheduleWindow: jest.fn(() => ({
            startTime: 0,
            endTime: 60_000,
            programs: [],
        })),
    } as unknown as IChannelScheduler;

    const deps: EPGRefreshControllerDeps = {
        getEpg: () => epg,
        getChannelManager: () => channelManager,
        getScheduler: () => scheduler,
        getEpgUiStatus: () => 'ready',
        getEpgConfig: (): EPGConfig => ({
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
        buildDailyScheduleConfig: (
            channel: ChannelConfig,
            items: ResolvedChannelContent['items']
        ): ScheduleConfig =>
            ({
                channelId: channel.id,
                anchorTime: 0,
                content: items,
                playbackMode: 'sequential',
                shuffleSeed: 1,
                loopSchedule: true,
            } satisfies ScheduleConfig),
        epgPreferencesStore: new EpgPreferencesStore(),
        primeEpgChannels: jest.fn(),
    };

    return { deps, epg, channelManager };
};

describe('EPGRefreshController', () => {
    it('runs guide-setting refresh follow-through without owning guide-selection invalidation', async () => {
        const { deps, epg } = makeDeps();
        const controller = new EPGRefreshController(deps);
        const refreshSpy = jest.spyOn(controller, 'refreshEpgSchedules').mockResolvedValue(undefined);

        controller.handleGuideSettingRefreshChange({ key: 'guideDensity', density: 'wide' });
        await Promise.resolve();

        expect(epg.clearSchedules).toHaveBeenCalledTimes(1);
        expect(deps.primeEpgChannels).toHaveBeenCalledTimes(1);
        expect(refreshSpy).toHaveBeenCalledWith({ reason: 'guide-settings', debounceMs: 0 });
    });

    it('resets list position and triggers refresh on library-filter changes', async () => {
        const { deps, epg } = makeDeps();
        const controller = new EPGRefreshController(deps);
        const refreshSpy = jest.spyOn(controller, 'refreshEpgSchedules').mockResolvedValue(undefined);

        controller.handleLibraryFilterRefreshChange();
        await Promise.resolve();

        expect(epg.clearSchedules).toHaveBeenCalledTimes(1);
        expect(deps.primeEpgChannels).toHaveBeenCalledTimes(1);
        expect(epg.scrollToChannel).toHaveBeenCalledWith(0);
        expect(epg.focusChannel).toHaveBeenCalledWith(0);
        expect(refreshSpy).toHaveBeenCalledWith({ reason: 'library-filter', debounceMs: 0 });
    });

    it('keeps guide-selection abort ownership outside the refresh seam API', () => {
        const { deps } = makeDeps();
        const controller = new EPGRefreshController(deps) as unknown as Record<string, unknown>;
        expect('invalidateGuideSelection' in controller).toBe(false);
        expect('_guideSelectionController' in controller).toBe(false);
        expect('_guideSelectionRequestId' in controller).toBe(false);
    });
});
