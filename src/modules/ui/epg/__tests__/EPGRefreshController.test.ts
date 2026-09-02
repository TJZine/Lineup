import { EPGRefreshController, type EPGRefreshControllerDeps } from '../coordinator/EPGRefreshController';
import type { IEPGComponent } from '../interfaces';
import type { ChannelConfig, IChannelManager, PlaybackMode, ResolvedChannelContent } from '../../../scheduler/channel-manager';
import type { IChannelScheduler, ScheduleConfig, ScheduleWindow, SchedulerState } from '../../../scheduler/scheduler';
import { EpgPreferencesStore } from '../../../settings/EpgPreferencesStore';
import type { EPGConfig } from '../types';
import type { EpgScheduleRefreshResult } from '../coordinator/EPGCoordinatorContracts';
import { flushPromises } from '../../../../__tests__/helpers';

const SKIPPED_REFRESH_RESULT: EpgScheduleRefreshResult = {
    readiness: 'skipped',
    attemptedChannelCount: 0,
    immediateReadyChannelCount: 0,
    backgroundQueuedChannelCount: 0,
    failedChannelCount: 0,
    staleCacheChannelCount: 0,
    firstVisibleScheduleReady: false,
};

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

const makeResolvedItems = (channelId: string): ResolvedChannelContent['items'] => [
    {
        ratingKey: `${channelId}-0`,
        type: 'movie',
        title: `${channelId}-program`,
        fullTitle: `${channelId}-program`,
        durationMs: 60_000,
        thumb: null,
        year: 2024,
        scheduledIndex: 0,
    },
];

const makeScheduleWindow = (ratingKey: string): ScheduleWindow => ({
    startTime: 0,
    endTime: 60_000,
    programs: [
        {
            item: {
                ratingKey,
                type: 'movie',
                title: ratingKey,
                fullTitle: ratingKey,
                durationMs: 60_000,
                thumb: null,
                year: 2024,
                scheduledIndex: 0,
            },
            scheduledStartTime: 0,
            scheduledEndTime: 60_000,
            elapsedMs: 0,
            remainingMs: 60_000,
            scheduleIndex: 0,
            loopNumber: 0,
            isCurrent: false,
        },
    ],
});

const makeSchedulerState = (channelId: string | null, isActive: boolean): SchedulerState => ({
    channelId: channelId ?? 'inactive-channel',
    isActive,
    currentProgram: null,
    nextProgram: null,
    schedulePosition: {
        loopNumber: 0,
        itemIndex: 0,
        offsetMs: 0,
    },
    lastSyncTime: 0,
});

const makeDeps = (
    overrides: Partial<EPGRefreshControllerDeps> & {
        epg?: Partial<IEPGComponent>;
        channelManager?: Partial<IChannelManager>;
        scheduler?: Partial<IChannelScheduler>;
    } = {}
): {
    deps: EPGRefreshControllerDeps;
    epg: IEPGComponent;
    channelManager: IChannelManager;
    scheduler: IChannelScheduler;
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
                endChannelIndexExclusive: 0,
            },
            currentTime: 0,
        }),
        clearSchedules: jest.fn(),
        scrollToChannel: jest.fn(),
        focusChannel: jest.fn(),
        setGridAnchorTime: jest.fn(),
        loadScheduleForChannel: jest.fn(),
        getFocusedProgram: jest.fn().mockReturnValue(null),
        focusNow: jest.fn(),
    } as unknown as IEPGComponent;
    const channelManager: IChannelManager = {
        getAllChannels: jest.fn(() => channels),
        getCurrentChannel: jest.fn(() => channels[0] ?? null),
        resolveChannelContent: jest.fn(async (id: string) => ({
            channelId: id,
            resolvedAt: Date.now(),
            items: makeResolvedItems(id),
            totalDurationMs: 60_000,
            orderedItems: makeResolvedItems(id),
        } as ResolvedChannelContent)),
        resolveChannelItemsForSchedule: jest.fn(async (id: string) => makeResolvedItems(id)),
    } as unknown as IChannelManager;
    const scheduler: IChannelScheduler = {
        getState: jest.fn(() => ({ isActive: true, channelId: 'c1' })),
        getScheduleWindow: jest.fn(() => makeScheduleWindow('live-program')),
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
            } satisfies ScheduleConfig),
        appendIssueDiagnostic: jest.fn(),
        epgPreferencesStore: new EpgPreferencesStore(),
        primeEpgChannels: jest.fn(),
        ...(overrides as Partial<EPGRefreshControllerDeps>),
    };

    Object.assign(epg, overrides.epg);
    Object.assign(channelManager, overrides.channelManager);
    Object.assign(scheduler, overrides.scheduler);

    return { deps, epg, channelManager, scheduler };
};

describe('EPGRefreshController', () => {
    it('runs guide-setting refresh follow-through without owning guide-selection invalidation', async () => {
        const { deps, epg } = makeDeps();
        const controller = new EPGRefreshController(deps);
        const refreshSpy = jest.spyOn(controller, 'refreshEpgSchedules').mockResolvedValue(SKIPPED_REFRESH_RESULT);

        controller.handleGuideSettingRefreshChange({ key: 'guideDensity', density: 'wide' });
        await flushPromises();

        expect(epg.clearSchedules).toHaveBeenCalledTimes(1);
        expect(deps.primeEpgChannels).toHaveBeenCalledTimes(1);
        expect(refreshSpy).toHaveBeenCalledWith({ reason: 'guide-settings', debounceMs: 0 });
    });

    it('diagnoses selected-library filter cleanup persistence failure while resolving live rows', () => {
        const current = { ...makeChannel('c1', 1), sourceLibraryId: 'lib1', sourceLibraryName: 'Movies' };
        const visiblePeer = { ...makeChannel('c2', 2), sourceLibraryId: 'lib2', sourceLibraryName: 'TV' };
        const epgPreferencesStore = new EpgPreferencesStore();
        jest.spyOn(epgPreferencesStore, 'readScheduleRangeSnapshotAndClean').mockReturnValue({
            pastItemsWindowSetting: 'auto',
            tabsEnabled: true,
            selectedLibraryId: 'missing-lib',
        });
        jest.spyOn(epgPreferencesStore, 'writeSelectedLibraryId').mockReturnValue({
            ok: false,
            reason: 'unavailable',
        });
        const { deps, epg } = makeDeps({
            epgPreferencesStore,
            channelManager: {
                getAllChannels: jest.fn(() => [current, visiblePeer]),
                getCurrentChannel: jest.fn(() => current),
            } as Partial<IChannelManager>,
            scheduler: {
                getState: jest.fn(() => makeSchedulerState(current.id, true)),
                getScheduleWindow: jest.fn(() => makeScheduleWindow(`${current.id}-0`)),
            } as Partial<IChannelScheduler>,
        });
        const controller = new EPGRefreshController(deps);

        controller.preseedCurrentChannelSchedule(epg);

        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith('QA-003b', 'epg.libraryFilterPersistenceFailed', {
            reason: 'unavailable',
            requestedLibraryId: null,
            source: 'normalize-invalid-library-filter',
        });
    });

    it('reports best-effort refresh failures through package diagnostics', async () => {
        const { deps } = makeDeps();
        const controller = new EPGRefreshController(deps);
        const error = new Error('refresh failed');
        jest.spyOn(controller, 'refreshEpgSchedules').mockRejectedValue(error);

        controller.handleGuideSettingRefreshChange({ key: 'guideDensity', density: 'wide' });
        await flushPromises();

        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'epg.refreshSchedulesBestEffortFailed',
            expect.objectContaining({
                reason: 'guide-settings',
                debounceMs: 0,
                safeError: expect.objectContaining({
                    message: expect.stringContaining('refresh failed'),
                }),
            })
        );
    });

    it('resets list position and triggers refresh on library-filter changes', async () => {
        const { deps, epg } = makeDeps();
        const controller = new EPGRefreshController(deps);
        const refreshSpy = jest.spyOn(controller, 'refreshEpgSchedules').mockResolvedValue(SKIPPED_REFRESH_RESULT);

        controller.handleLibraryFilterRefreshChange();
        await flushPromises();

        expect(epg.clearSchedules).toHaveBeenCalledTimes(1);
        expect(deps.primeEpgChannels).toHaveBeenCalledTimes(1);
        expect(epg.scrollToChannel).toHaveBeenCalledWith(0);
        expect(epg.focusChannel).toHaveBeenCalledWith(0);
        expect(refreshSpy).toHaveBeenCalledWith({ reason: 'library-filter', debounceMs: 0 });
    });

    it('cancels pending library-filter work even when no epg instance is available', () => {
        const { deps } = makeDeps();
        deps.getEpg = (): IEPGComponent | null => null;

        const controller = new EPGRefreshController(deps);
        const cancelSpy = jest.spyOn(controller, 'cancelScheduledRefreshWork');
        const clearSnapshotSpy = jest.spyOn(controller, 'clearSelectedChannelScheduleSnapshot');
        const clearMarkersSpy = jest.spyOn(controller, 'clearLoadedScheduleMarkers');

        controller.handleLibraryFilterRefreshChange();

        expect(cancelSpy).toHaveBeenCalledWith('library-filter');
        expect(clearSnapshotSpy).toHaveBeenCalledTimes(1);
        expect(clearMarkersSpy).toHaveBeenCalledTimes(1);
    });

    it('does not prime, refocus, or refresh when library-filter changes while epg is hidden', async () => {
        const { deps, epg } = makeDeps();
        (epg.isVisible as jest.Mock).mockReturnValue(false);

        const controller = new EPGRefreshController(deps);
        const refreshSpy = jest.spyOn(controller, 'refreshEpgSchedules').mockResolvedValue(SKIPPED_REFRESH_RESULT);

        controller.handleLibraryFilterRefreshChange();
        await flushPromises();

        expect(epg.clearSchedules).toHaveBeenCalledTimes(1);
        expect(deps.primeEpgChannels).not.toHaveBeenCalled();
        expect(epg.scrollToChannel).not.toHaveBeenCalled();
        expect(epg.focusChannel).not.toHaveBeenCalled();
        expect(refreshSpy).not.toHaveBeenCalled();
    });

    it('keeps guide-selection abort ownership outside the refresh seam API', () => {
        const { deps } = makeDeps();
        const controller = new EPGRefreshController(deps) as unknown as Record<string, unknown>;
        expect('invalidateGuideSelection' in controller).toBe(false);
        expect('_guideSelectionController' in controller).toBe(false);
        expect('_guideSelectionRequestId' in controller).toBe(false);
    });

    it('does not persist a direct live-row overwrite as loaded state for the next non-live range refresh', async () => {
        const liveState: { isActive: boolean; channelId: string | null } = { isActive: true, channelId: 'c1' };
        const resolveChannelContent = jest.fn(async (id: string) => ({
            channelId: id,
            resolvedAt: Date.now(),
            items: makeResolvedItems(id),
            totalDurationMs: 60_000,
            orderedItems: makeResolvedItems(id),
        } as ResolvedChannelContent));
        const { deps, epg } = makeDeps({
            channelManager: {
                resolveChannelContent,
            },
            scheduler: {
                getState: jest.fn(() => makeSchedulerState(liveState.channelId, liveState.isActive)),
                getScheduleWindow: jest.fn(() => makeScheduleWindow('live-program')),
            },
        });
        const controller = new EPGRefreshController(deps);

        controller.refreshEpgScheduleForLiveChannel();

        liveState.isActive = false;
        liveState.channelId = null;
        (epg.loadScheduleForChannel as jest.Mock).mockClear();
        (deps.appendIssueDiagnostic as jest.Mock).mockClear();
        resolveChannelContent.mockClear();

        await controller.refreshEpgSchedulesForRangeNow(
            { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(resolveChannelContent).toHaveBeenCalledTimes(1);
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleApplied',
            expect.objectContaining({
                channelId: 'c1',
                source: 'resolved-immediate',
            })
        );
        expect(epg.loadScheduleForChannel).toHaveBeenCalledTimes(1);
    });

    it('cancels range refresh work while the schedule runtime import is still pending', async () => {
        const resolveChannelContent = jest.fn(async (id: string) => ({
            channelId: id,
            resolvedAt: Date.now(),
            items: makeResolvedItems(id),
            totalDurationMs: 60_000,
            orderedItems: makeResolvedItems(id),
        } as ResolvedChannelContent));
        const { deps, epg } = makeDeps({
            channelManager: {
                resolveChannelContent,
            },
        });
        const controller = new EPGRefreshController(deps);

        const refresh = controller.refreshEpgSchedulesForRangeNow(
            { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );
        controller.cancelScheduledRefreshWork('close-epg');
        await refresh;
        await flushPromises();

        expect(resolveChannelContent).not.toHaveBeenCalled();
        expect(epg.loadScheduleForChannel).not.toHaveBeenCalled();
        expect(deps.appendIssueDiagnostic).not.toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleApplied',
            expect.anything()
        );
    });

    it('does not persist a preseeded live row as loaded state for the next non-live range refresh', async () => {
        const liveState: { isActive: boolean; channelId: string | null } = { isActive: true, channelId: 'c1' };
        const resolveChannelContent = jest.fn(async (id: string) => ({
            channelId: id,
            resolvedAt: Date.now(),
            items: makeResolvedItems(id),
            totalDurationMs: 60_000,
            orderedItems: makeResolvedItems(id),
        } as ResolvedChannelContent));
        const { deps, epg } = makeDeps({
            channelManager: {
                resolveChannelContent,
            },
            scheduler: {
                getState: jest.fn(() => makeSchedulerState(liveState.channelId, liveState.isActive)),
                getScheduleWindow: jest.fn(() => makeScheduleWindow('preseed-live-program')),
            },
        });
        const controller = new EPGRefreshController(deps);

        controller.preseedCurrentChannelSchedule();

        liveState.isActive = false;
        liveState.channelId = null;
        (epg.loadScheduleForChannel as jest.Mock).mockClear();
        (deps.appendIssueDiagnostic as jest.Mock).mockClear();
        resolveChannelContent.mockClear();

        await controller.refreshEpgSchedulesForRangeNow(
            { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(resolveChannelContent).toHaveBeenCalledTimes(1);
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleApplied',
            expect.objectContaining({
                channelId: 'c1',
                source: 'resolved-immediate',
            })
        );
        expect(epg.loadScheduleForChannel).toHaveBeenCalledTimes(1);
    });
});
