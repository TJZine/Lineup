import { EPGCoordinator, type EPGCoordinatorDeps } from '../EPGCoordinator';
import type { EPGUiStatus } from '../types';
import type { IEPGComponent } from '../interfaces';
import { EpgPreferencesStore } from '../../../settings/EpgPreferencesStore';
import {
    OverlayRuntimePolicyController,
    type OverlayRuntimePolicyControllerDeps,
} from '../../../../core/orchestrator/OverlayRuntimePolicyController';
import type {
    IChannelManager,
    ChannelConfig,
    ResolvedChannelContent,
    ResolvedContentItem,
    PlaybackMode,
} from '../../../scheduler/channel-manager';
import type { IChannelScheduler, ScheduledProgram, ScheduleConfig } from '../../../scheduler/scheduler';
import type { EPGConfig } from '../types';
import { LINEUP_STORAGE_KEYS } from '../../../../config/storageKeys';
import {
    computeBackgroundWarmQueueCaps,
    computeEpgScheduleRangeMs,
    getBackgroundWarmQueueAction,
    partitionPrefetchChannels,
} from '../EPGCoordinatorPolicies';
import * as EPGCoordinatorPolicies from '../EPGCoordinatorPolicies';

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

const makeResolvedItem = (channelId: string, idx: number): ResolvedContentItem =>
({
    ratingKey: `${channelId}-${idx}`,
    type: 'movie',
    title: `Program ${idx}`,
    fullTitle: `Program ${idx}`,
    durationMs: 10_000,
    thumb: null,
    guid: null,
    parentGuid: null,
    grandparentGuid: null,
    viewOffset: 0,
    year: 0,
    scheduledIndex: idx,
} as ResolvedContentItem);

const makeResolvedItems = (channelId: string): ResolvedContentItem[] => [makeResolvedItem(channelId, 0)];

const baseProgram = (channelId: string, idx: number): ScheduledProgram =>
({
    item: makeResolvedItem(channelId, idx),
    scheduledStartTime: 0,
    scheduledEndTime: 10_000,
    elapsedMs: 0,
    remainingMs: 10_000,
    scheduleIndex: idx,
    loopNumber: 0,
    streamDescriptor: null,
    isCurrent: false,
} as ScheduledProgram);

const flushPromises = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
};

const readScheduleRange = (deps: EPGCoordinatorDeps): { startTime: number; endTime: number } | null =>
    computeEpgScheduleRangeMs(
        deps,
        Date.now(),
        deps.epgPreferencesStore.readScheduleRangeSnapshotAndClean()
    );

const FIXED_FAKE_NOW = new Date('2026-01-01T12:00:00.000Z');

const useDeterministicFakeTimers = (): void => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_FAKE_NOW);
};

const expectPastWindowMinutes = (
    range: { startTime: number; endTime: number } | null,
    nowMs: number,
    expectedMinutes: number,
    slotMinutes: number
): void => {
    expect(range).not.toBeNull();
    if (!range) return;
    const deltaMinutes = (nowMs - range.startTime) / 60_000;
    expect(deltaMinutes).toBeGreaterThanOrEqual(expectedMinutes);
    expect(deltaMinutes).toBeLessThan(expectedMinutes + slotMinutes);
};

const advanceWarmQueueTimers = async (steps = 24): Promise<void> => {
    for (let i = 0; i < steps; i++) {
        jest.advanceTimersByTime(50);
        await flushPromises();
    }
};

const withIdleCallbackDisabled = async (run: () => Promise<void>): Promise<void> => {
    const idleScheduler = globalThis as unknown as Record<string, unknown>;
    const priorRequestIdle = idleScheduler['requestIdleCallback'];
    const priorCancelIdle = idleScheduler['cancelIdleCallback'];
    delete idleScheduler['requestIdleCallback'];
    delete idleScheduler['cancelIdleCallback'];

    try {
        await run();
    } finally {
        if (priorRequestIdle === undefined) {
            delete idleScheduler['requestIdleCallback'];
        } else {
            idleScheduler['requestIdleCallback'] = priorRequestIdle;
        }
        if (priorCancelIdle === undefined) {
            delete idleScheduler['cancelIdleCallback'];
        } else {
            idleScheduler['cancelIdleCallback'] = priorCancelIdle;
        }
    }
};

const makeDeps = (
    overrides: Partial<EPGCoordinatorDeps> = {}
): { deps: EPGCoordinatorDeps; epg: IEPGComponent; channelManager: IChannelManager; scheduler: IChannelScheduler } => {
    const epgPreferencesStore = new EpgPreferencesStore();
    const epg: IEPGComponent = {
        show: jest.fn(),
        hide: jest.fn(),
        isVisible: jest.fn().mockReturnValue(false),
        focusNow: jest.fn(),
        loadChannels: jest.fn(),
        setCategoryColorsEnabled: jest.fn(),
        setLayoutMode: jest.fn(),
        setVisibleHours: jest.fn(),
        setNowWatchingBannerEnabled: jest.fn(),
        setLibraryTabs: jest.fn(),
        loadScheduleForChannel: jest.fn(),
        clearSchedules: jest.fn(),
        getState: jest.fn().mockReturnValue({
            isVisible: false,
            focusedCell: null,
            scrollPosition: { channelOffset: 0, timeOffset: 0 },
            viewWindow: {
                startTime: 0,
                endTime: 0,
                startChannelIndex: 0,
                endChannelIndex: 3,
            },
            currentTime: 0,
        }),
        setGridAnchorTime: jest.fn(),
        getFocusedProgram: jest.fn().mockReturnValue(null),
        focusChannel: jest.fn(),
        scrollToChannel: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
    } as unknown as IEPGComponent;

    const channels: ChannelConfig[] = Array.from({ length: 3 }, (_, i) => makeChannel(`c${i}`, i + 1));
    const channelManager: IChannelManager = {
        getAllChannels: () => channels,
        getCurrentChannel: () => channels[0],
        resolveChannelContent: jest.fn().mockImplementation(async (id: string) => {
            const items: ResolvedChannelContent['items'] = [makeResolvedItem(id, 0)];
            return { items } as ResolvedChannelContent;
        }),
        resolveChannelItemsForSchedule: jest.fn().mockImplementation(async (id: string) => {
            const items: ResolvedChannelContent['items'] = [makeResolvedItem(id, 0)];
            return items;
        }),
    } as unknown as IChannelManager;

    const scheduler: IChannelScheduler = {
        getState: () => ({ isActive: true, channelId: channels[0]!.id }),
        getScheduleWindow: () => ({
            startTime: 0,
            endTime: 1000,
            programs: [baseProgram(channels[0]!.id, 0)],
        }),
    } as unknown as IChannelScheduler;

	    const deps: EPGCoordinatorDeps = {
	        getEpg: () => epg,
	        getChannelManager: () => channelManager,
	        getScheduler: () => scheduler,
	        getEpgUiStatus: () => 'ready',
	        ensureEpgInitialized: jest.fn().mockResolvedValue(undefined),
	        getEpgConfig: () => ({ totalHours: 6, timeSlotMinutes: 30 } as EPGConfig),
	        getLocalMidnightMs: (t: number) => t - (t % (24 * 60 * 60 * 1000)),
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
        getPreserveFocusOnOpen: () => false,
        setLastChannelChangeSourceToGuide: jest.fn(),
        switchToChannel: jest.fn().mockResolvedValue(undefined),
        onVisibilityChange: jest.fn(),
        reportEpgInitWarning: jest.fn(),
        epgPreferencesStore,
        appendIssueDiagnostic: jest.fn(),
        ...overrides,
    };
    return { deps, epg, channelManager, scheduler };
};

describe('EPGCoordinator', () => {
    const installLocalStorage = (): void => {
        const store = new Map<string, string>();
        (globalThis as unknown as { localStorage?: Storage }).localStorage = {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => {
                store.set(key, value);
            },
            removeItem: (key: string) => {
                store.delete(key);
            },
        } as Storage;
    };

    const clearLocalStorage = (): void => {
        delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
    };

    beforeEach(() => {
        installLocalStorage();
    });

    afterEach(() => {
        clearLocalStorage();
        jest.useRealTimers();
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    it('logs debug error using injected runtime when live schedule refresh fails', () => {
        const scheduler: IChannelScheduler = {
            getState: () => ({ isActive: true, channelId: 'c0' }),
            getScheduleWindow: jest.fn(() => {
                throw new Error('schedule window failed');
            }),
        } as unknown as IChannelScheduler;
        const debugRuntime = {
            isEnabled: jest.fn().mockReturnValue(true),
            append: jest.fn(),
            destroy: jest.fn(),
        };

        const { deps, epg } = makeDeps({
            getScheduler: () => scheduler,
            debugRuntime,
        });
        const coordinator = new EPGCoordinator(deps);
        (epg.isVisible as jest.Mock).mockReturnValue(true);

        coordinator.refreshEpgScheduleForLiveChannel();

        expect(scheduler.getScheduleWindow).toHaveBeenCalled();
        expect(debugRuntime.isEnabled).toHaveBeenCalledTimes(1);
        expect(debugRuntime.append).toHaveBeenCalledWith(
            'EPG.refreshEpgScheduleForLiveChannel.error',
            expect.objectContaining({
                error: expect.objectContaining({
                    message: expect.stringContaining('schedule window failed'),
                }),
            })
        );
    });

    it('partitions prefetch channels with inclusive channelEnd', () => {
        makeDeps();

        const channels: ChannelConfig[] = Array.from(
            { length: 100 },
            (_, i) => makeChannel(`c${i}`, i + 1)
        );

        const range = { channelStart: 10, channelEnd: 20 };
        const caps = { visibleCount: 11, maxQueuedChannels: 120, aggressive: false };
        const ids = { liveChannelId: null, focusedChannelId: null };

        const partitioned = partitionPrefetchChannels(channels, range, ids, {
            visibleCount: caps.visibleCount,
            maxQueuedChannels: caps.maxQueuedChannels,
            aggressive: caps.aggressive,
        });

        // channelEnd is inclusive; slice end is exclusive. For channelCount=100 and non-aggressive overscan=7:
        // endIndex = 20 + 1 + 7 = 28
        expect(partitioned.bufferedRange).toEqual({ start: 3, end: 28 });
        expect(partitioned.immediateChannels[partitioned.immediateChannels.length - 1]?.id).toBe('c27');
    });

    it('openEPG primes and queues an immediate refresh after show when ready', async () => {
        const { deps, epg } = makeDeps();
        const coordinator = new EPGCoordinator(deps);
        const refreshSpy = jest.spyOn(coordinator, 'refreshEpgSchedulesForRange').mockResolvedValue(undefined);

        coordinator.openEPG();

        expect(epg.loadChannels).toHaveBeenCalled();
        expect(epg.show).toHaveBeenCalledTimes(1);
        expect(refreshSpy).toHaveBeenCalledWith(
            {
                channelStart: 0,
                channelEnd: 3,
                timeStartMs: 0,
                timeEndMs: 0,
            },
            { reason: 'manual', debounceMs: 0 }
        );
        expect((epg.show as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
            refreshSpy.mock.invocationCallOrder[0] as number
        );
        // focusNow called when not preserving focus
        expect(epg.focusNow).toHaveBeenCalled();
    });

    it('openEPG computes the initial refresh range from the post-show view window', async () => {
        const postShowRange = {
            startTime: 60_000,
            endTime: 180_000,
            startChannelIndex: 2,
            endChannelIndex: 6,
        };
        const { deps, epg } = makeDeps();
        (epg.show as jest.Mock).mockImplementation(() => {
            (epg.getState as jest.Mock).mockReturnValue({
                isVisible: true,
                focusedCell: null,
                scrollPosition: { channelOffset: 2, timeOffset: 1 },
                viewWindow: postShowRange,
                currentTime: 60_000,
            });
        });
        const coordinator = new EPGCoordinator(deps);
        const refreshSpy = jest.spyOn(coordinator, 'refreshEpgSchedulesForRange').mockResolvedValue(undefined);

        coordinator.openEPG();

        expect(refreshSpy).toHaveBeenCalledWith(
            {
                channelStart: postShowRange.startChannelIndex,
                channelEnd: postShowRange.endChannelIndex,
                timeStartMs: postShowRange.startTime,
                timeEndMs: postShowRange.endTime,
            },
            { reason: 'manual', debounceMs: 0 }
        );
    });

    it('openEPG handles promise rejection by hiding EPG and reporting warning', async () => {
        const error = new Error('Init failed');
        const ensure = jest.fn().mockRejectedValue(error);
        const { deps, epg } = makeDeps({
            getEpgUiStatus: () => 'pending',
            ensureEpgInitialized: ensure,
        });
        const coordinator = new EPGCoordinator(deps);

        coordinator.openEPG();
        // Await microtasks to let the .catch() trigger
        await new Promise(process.nextTick);

        expect(ensure).toHaveBeenCalled();
        expect(epg.hide).toHaveBeenCalled();
        expect(deps.reportEpgInitWarning).toHaveBeenCalledWith(error);
    });

    it('openEPG reports logical visibility immediately during deferred load and rolls it back on init failure', async () => {
        const error = new Error('Deferred init failed');
        let visible = false;
        const ensure = jest.fn().mockRejectedValue(error);
        const { deps, epg } = makeDeps({
            getEpgUiStatus: () => 'pending',
            ensureEpgInitialized: ensure,
        });
        (epg.show as jest.Mock).mockImplementation(() => {
            visible = true;
        });
        (epg.hide as jest.Mock).mockImplementation(() => {
            visible = false;
        });
        (epg.isVisible as jest.Mock).mockImplementation(() => visible);
        const coordinator = new EPGCoordinator(deps);

        coordinator.openEPG();

        expect(deps.onVisibilityChange).toHaveBeenNthCalledWith(1, true);

        await flushPromises();

        expect(deps.onVisibilityChange).toHaveBeenNthCalledWith(2, false);
        expect(epg.hide).toHaveBeenCalledTimes(1);
        expect(deps.reportEpgInitWarning).toHaveBeenCalledWith(error);
    });

    it('openEPG rolls back visibility against current deps state when deferred init fails after the epg reference clears', async () => {
        const error = new Error('Deferred init failed after epg unmounted');
        let visible = false;
        const ensure = jest.fn().mockRejectedValue(error);
        const { deps, epg } = makeDeps({
            getEpgUiStatus: () => 'pending',
            ensureEpgInitialized: ensure,
        });
        let currentEpg: IEPGComponent | null = epg;
        deps.getEpg = (): IEPGComponent | null => currentEpg;

        (epg.show as jest.Mock).mockImplementation(() => {
            visible = true;
        });
        (epg.hide as jest.Mock).mockImplementation(() => {
            visible = false;
        });
        (epg.isVisible as jest.Mock).mockImplementation(() => visible);

        const coordinator = new EPGCoordinator(deps);

        coordinator.openEPG();
        expect(deps.onVisibilityChange).toHaveBeenNthCalledWith(1, true);

        currentEpg = null;
        await flushPromises();

        expect(deps.onVisibilityChange).toHaveBeenNthCalledWith(2, false);
        expect(epg.hide).not.toHaveBeenCalled();
        expect(deps.reportEpgInitWarning).toHaveBeenCalledWith(error);
    });

    it('closeEPG reports logical visibility even before runtime close events fire', () => {
        let visible = true;
        const { deps, epg } = makeDeps({
            getEpgUiStatus: () => 'pending',
        });
        (epg.hide as jest.Mock).mockImplementation(() => {
            visible = false;
        });
        (epg.isVisible as jest.Mock).mockImplementation(() => visible);
        const coordinator = new EPGCoordinator(deps);

        coordinator.closeEPG();

        expect(epg.hide).toHaveBeenCalledTimes(1);
        expect(deps.onVisibilityChange).toHaveBeenCalledWith(false);
    });

    it('closeEPG cancels queued visible-range refreshes before they start', async () => {
        useDeterministicFakeTimers();
        try {
            const { deps, epg, channelManager } = makeDeps();
            const resolveChannelContent = jest.spyOn(channelManager, 'resolveChannelContent');
            const coordinator = new EPGCoordinator(deps);

            const pending = coordinator.refreshEpgSchedulesForRange(
                { channelStart: 0, channelEnd: 1, timeStartMs: 0, timeEndMs: 0 },
                { debounceMs: 50, reason: 'visible-range' }
            );

            coordinator.closeEPG();
            jest.advanceTimersByTime(50);
            await pending;

            expect(resolveChannelContent).not.toHaveBeenCalled();
            expect(epg.hide).toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });

        it('closeEPG aborts in-flight immediate schedule loads', async () => {
            useDeterministicFakeTimers();
            try {
                let capturedSignal: AbortSignal | undefined;
                let signalRegisteredResolve: (() => void) | null = null;
                const signalRegistered = new Promise<void>((resolve) => {
                    signalRegisteredResolve = resolve;
                });

                const base = makeDeps();
                const { deps, epg } = makeDeps({
                    getScheduler: () =>
                    ({
                        getState: () => ({ isActive: false, channelId: 'other' }),
                        getScheduleWindow: jest.fn(),
                    } as unknown as IChannelScheduler),
                    getChannelManager: () =>
                    ({
                        ...base.channelManager,
                        getAllChannels: () => [makeChannel('c0', 1)],
                        getCurrentChannel: () => makeChannel('c0', 1),
                        resolveChannelContent: jest.fn().mockImplementation(
                            (_id: string, options?: { signal?: AbortSignal }) =>
                                new Promise<ResolvedChannelContent>((_, reject) => {
                                    capturedSignal = options?.signal;
                                    signalRegisteredResolve?.();
                                    options?.signal?.addEventListener(
                                        'abort',
                                        () => {
                                            reject(new DOMException('Aborted', 'AbortError'));
                                        },
                                        { once: true }
                                    );
                                })
                        ),
                    } as IChannelManager),
                });
                const coordinator = new EPGCoordinator(deps);

                const refreshPromise = coordinator.refreshEpgSchedulesForRange(
                    { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 0 },
                    { debounceMs: 0, reason: 'visible-range' }
                );
                await signalRegistered;

                coordinator.closeEPG();
                await refreshPromise;

                expect(capturedSignal).toBeDefined();
                expect(capturedSignal?.aborted).toBe(true);
                expect(epg.hide).toHaveBeenCalled();
            } finally {
                jest.useRealTimers();
            }
        });

    it('primeEpgChannels applies filtering when tabs enabled and selected', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, '1');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER, 'lib1');

        const allChannels: ChannelConfig[] = [
            {
                ...makeChannel('c1', 1),
                sourceLibraryId: 'lib1',
                sourceLibraryName: 'Movies',
            },
            {
                ...makeChannel('c2', 2),
                sourceLibraryId: 'lib2',
                sourceLibraryName: 'TV',
            },
            {
                ...makeChannel('c3', 3),
                contentSource: {
                    type: 'library',
                    libraryId: 'lib1',
                    libraryType: 'movie',
                    includeWatched: true,
                },
            },
        ];

        const { deps, epg } = makeDeps({
            getChannelManager: () =>
            ({
                ...makeDeps().channelManager,
                getAllChannels: () => allChannels,
            } as IChannelManager),
        });

        const coordinator = new EPGCoordinator(deps);
        coordinator.primeEpgChannels();

        expect(epg.loadChannels).toHaveBeenCalledWith([allChannels[0], allChannels[2]]);
    });

    it('primeEpgChannels sets 2h as default guide density when no library filter is active', () => {
        const { deps, epg } = makeDeps();
        const coordinator = new EPGCoordinator(deps);

        coordinator.primeEpgChannels();

        expect(epg.setVisibleHours).toHaveBeenCalledWith(2);
    });

    it('primeEpgChannels forces 3h for movie library filters even when default density is detailed', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, '1');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER, 'movie-lib');

        const allChannels: ChannelConfig[] = [
            {
                ...makeChannel('movie-1', 1),
                sourceLibraryId: 'movie-lib',
                sourceLibraryName: 'Movies',
                contentSource: {
                    type: 'library',
                    libraryId: 'movie-lib',
                    libraryType: 'movie',
                    includeWatched: true,
                },
            },
            {
                ...makeChannel('show-1', 2),
                sourceLibraryId: 'show-lib',
                sourceLibraryName: 'TV Shows',
                contentSource: {
                    type: 'library',
                    libraryId: 'show-lib',
                    libraryType: 'show',
                    includeWatched: true,
                },
            },
        ];

        const { deps, epg } = makeDeps({
            getChannelManager: () =>
            ({
                ...makeDeps().channelManager,
                getAllChannels: () => allChannels,
            } as IChannelManager),
        });
        const coordinator = new EPGCoordinator(deps);

        coordinator.primeEpgChannels();

        expect(epg.setVisibleHours).toHaveBeenCalledWith(3);
    });

    it('primeEpgChannels forces 2h for show library filters even when density is wide', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY, 'wide');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, '1');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER, 'show-lib');

        const allChannels: ChannelConfig[] = [
            {
                ...makeChannel('show-1', 1),
                sourceLibraryId: 'show-lib',
                sourceLibraryName: 'TV Shows',
                contentSource: {
                    type: 'library',
                    libraryId: 'show-lib',
                    libraryType: 'show',
                    includeWatched: true,
                },
            },
            {
                ...makeChannel('movie-1', 2),
                sourceLibraryId: 'movie-lib',
                sourceLibraryName: 'Movies',
                contentSource: {
                    type: 'library',
                    libraryId: 'movie-lib',
                    libraryType: 'movie',
                    includeWatched: true,
                },
            },
        ];

        const { deps, epg } = makeDeps({
            getChannelManager: () =>
            ({
                ...makeDeps().channelManager,
                getAllChannels: () => allChannels,
            } as IChannelManager),
        });
        const coordinator = new EPGCoordinator(deps);

        coordinator.primeEpgChannels();

        expect(epg.setVisibleHours).toHaveBeenCalledWith(2);
    });

    it('uses auto past-window = 0m for show library filter', () => {
        const now = new Date('2026-01-07T10:40:00.000Z').getTime();
        jest.spyOn(Date, 'now').mockReturnValue(now);
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW, 'auto');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, '1');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER, 'show-lib');

        const channels = [
            {
                ...makeChannel('show-1', 1),
                sourceLibraryId: 'show-lib',
                sourceLibraryName: 'Shows',
                contentSource: {
                    type: 'library',
                    libraryId: 'show-lib',
                    libraryType: 'show',
                    includeWatched: true,
                },
            },
            {
                ...makeChannel('movie-1', 2),
                sourceLibraryId: 'movie-lib',
                sourceLibraryName: 'Movies',
                contentSource: {
                    type: 'library',
                    libraryId: 'movie-lib',
                    libraryType: 'movie',
                    includeWatched: true,
                },
            },
        ];

        const base = makeDeps().deps.getChannelManager()!;
        const { deps } = makeDeps({
            getChannelManager: () => ({ ...base, getAllChannels: () => channels } as IChannelManager),
        });
        const range = readScheduleRange(deps);

        expectPastWindowMinutes(range, now, 0, 30);
    });

    it('uses auto past-window = 0m for show-only lineups even when tabs are disabled', () => {
        const now = new Date('2026-01-07T10:40:00.000Z').getTime();
        jest.spyOn(Date, 'now').mockReturnValue(now);
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW, 'auto');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, '0');

        const channels: ChannelConfig[] = [
            {
                ...makeChannel('show-1', 1),
                sourceLibraryId: 'show-lib',
                sourceLibraryName: 'Shows',
                contentSource: {
                    type: 'library',
                    libraryId: 'show-lib',
                    libraryType: 'show',
                    includeWatched: true,
                },
            },
        ];

        const base = makeDeps().deps.getChannelManager()!;
        const { deps } = makeDeps({
            getChannelManager: () => ({ ...base, getAllChannels: () => channels } as IChannelManager),
        });
        const range = readScheduleRange(deps);

        expectPastWindowMinutes(range, now, 0, 30);
    });

    it('uses auto past-window = 15m for mixed show/movie lineups when no library filter is active', () => {
        const now = new Date('2026-01-07T10:40:00.000Z').getTime();
        jest.spyOn(Date, 'now').mockReturnValue(now);
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW, 'auto');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, '0');

        const channels: ChannelConfig[] = [
            {
                ...makeChannel('show-1', 1),
                sourceLibraryId: 'show-lib',
                sourceLibraryName: 'Shows',
                contentSource: {
                    type: 'library',
                    libraryId: 'show-lib',
                    libraryType: 'show',
                    includeWatched: true,
                },
            },
            {
                ...makeChannel('movie-1', 2),
                sourceLibraryId: 'movie-lib',
                sourceLibraryName: 'Movies',
                contentSource: {
                    type: 'library',
                    libraryId: 'movie-lib',
                    libraryType: 'movie',
                    includeWatched: true,
                },
            },
        ];

        const base = makeDeps().deps.getChannelManager()!;
        const { deps } = makeDeps({
            getChannelManager: () => ({ ...base, getAllChannels: () => channels } as IChannelManager),
        });
        const range = readScheduleRange(deps);

        expectPastWindowMinutes(range, now, 15, 30);
    });

    it('uses auto past-window = 15m when lineup content sources are not reliably inferable', () => {
        const now = new Date('2026-01-07T10:40:00.000Z').getTime();
        jest.spyOn(Date, 'now').mockReturnValue(now);
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW, 'auto');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, '0');

        const channels: ChannelConfig[] = [
            {
                ...makeChannel('manual-1', 1),
                sourceLibraryId: 'unknown-lib',
                sourceLibraryName: 'Unknown',
                contentSource: { type: 'manual', items: [] },
            },
        ];

        const base = makeDeps().deps.getChannelManager()!;
        const { deps } = makeDeps({
            getChannelManager: () => ({ ...base, getAllChannels: () => channels } as IChannelManager),
        });
        const range = readScheduleRange(deps);

        expectPastWindowMinutes(range, now, 15, 30);
    });

    it('uses auto past-window = 15m for movie-only, mixed, and unknown library mixes', () => {
        const now = new Date('2026-01-07T10:40:00.000Z').getTime();
        jest.spyOn(Date, 'now').mockReturnValue(now);
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW, 'auto');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, '1');
        const getRange = (selectedLibraryId: string, channels: ChannelConfig[]): { startTime: number; endTime: number } | null => {
            localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER, selectedLibraryId);
            const base = makeDeps().deps.getChannelManager()!;
            const { deps } = makeDeps({
                getChannelManager: () => ({ ...base, getAllChannels: () => channels } as IChannelManager),
            });
            return readScheduleRange(deps);
        };

        const movieOnlyRange = getRange('movie-lib', [
            {
                ...makeChannel('movie-1', 1),
                sourceLibraryId: 'movie-lib',
                sourceLibraryName: 'Movies',
                contentSource: {
                    type: 'library',
                    libraryId: 'movie-lib',
                    libraryType: 'movie',
                    includeWatched: true,
                },
            },
            {
                ...makeChannel('show-1', 2),
                sourceLibraryId: 'show-lib',
                sourceLibraryName: 'Shows',
                contentSource: {
                    type: 'library',
                    libraryId: 'show-lib',
                    libraryType: 'show',
                    includeWatched: true,
                },
            },
        ]);
        expectPastWindowMinutes(movieOnlyRange, now, 15, 30);

        const mixedRange = getRange('mixed-lib', [
            {
                ...makeChannel('mixed-show', 1),
                sourceLibraryId: 'mixed-lib',
                sourceLibraryName: 'Mixed',
                contentSource: {
                    type: 'library',
                    libraryId: 'mixed-lib',
                    libraryType: 'show',
                    includeWatched: true,
                },
            },
            {
                ...makeChannel('mixed-movie', 2),
                sourceLibraryId: 'mixed-lib',
                sourceLibraryName: 'Mixed',
                contentSource: {
                    type: 'library',
                    libraryId: 'mixed-lib',
                    libraryType: 'movie',
                    includeWatched: true,
                },
            },
            {
                ...makeChannel('show-2', 3),
                sourceLibraryId: 'show-lib',
                sourceLibraryName: 'Shows',
                contentSource: {
                    type: 'library',
                    libraryId: 'show-lib',
                    libraryType: 'show',
                    includeWatched: true,
                },
            },
        ]);
        expectPastWindowMinutes(mixedRange, now, 15, 30);

        const unknownRange = getRange('unknown-lib', [
            {
                ...makeChannel('unknown-manual', 1),
                sourceLibraryId: 'unknown-lib',
                sourceLibraryName: 'Unknown',
                contentSource: { type: 'manual', items: [] },
            },
            {
                ...makeChannel('movie-2', 2),
                sourceLibraryId: 'movie-lib',
                sourceLibraryName: 'Movies',
                contentSource: {
                    type: 'library',
                    libraryId: 'movie-lib',
                    libraryType: 'movie',
                    includeWatched: true,
                },
            },
        ]);
        expectPastWindowMinutes(unknownRange, now, 15, 30);
    });

    it('respects manual past-window overrides 0/15/30', () => {
        const now = new Date('2026-01-07T10:40:00.000Z').getTime();
        jest.spyOn(Date, 'now').mockReturnValue(now);
        const { deps } = makeDeps();

        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW, '0');
        const range0 = readScheduleRange(deps);
        expectPastWindowMinutes(range0, now, 0, 30);

        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW, '15');
        const range15 = readScheduleRange(deps);
        expectPastWindowMinutes(range15, now, 15, 30);

        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW, '30');
        const range30 = readScheduleRange(deps);
        expectPastWindowMinutes(range30, now, 30, 30);
    });

    it('primeEpgChannels preserves a valid persisted filter when tabs are disabled', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, '0');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER, 'lib1');

        const allChannels: ChannelConfig[] = [
            { ...makeChannel('c1', 1), sourceLibraryId: 'lib1', sourceLibraryName: 'Movies' },
            { ...makeChannel('c2', 2), sourceLibraryId: 'lib2', sourceLibraryName: 'TV' },
        ];

        const { deps, epg } = makeDeps({
            getChannelManager: () =>
            ({
                ...makeDeps().channelManager,
                getAllChannels: () => allChannels,
            } as IChannelManager),
        });
        const coordinator = new EPGCoordinator(deps);

        coordinator.primeEpgChannels();

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER)).toBe('lib1');
        expect(epg.loadChannels).toHaveBeenCalledWith(allChannels);
    });

    it('primeEpgChannels preserves a valid persisted filter when only one library remains', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, '1');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER, 'lib1');

        const allChannels: ChannelConfig[] = [
            { ...makeChannel('c1', 1), sourceLibraryId: 'lib1', sourceLibraryName: 'Movies' },
            { ...makeChannel('c2', 2), sourceLibraryId: 'lib1', sourceLibraryName: 'Movies' },
        ];

        const { deps, epg } = makeDeps({
            getChannelManager: () =>
            ({
                ...makeDeps().channelManager,
                getAllChannels: () => allChannels,
            } as IChannelManager),
        });
        const coordinator = new EPGCoordinator(deps);

        coordinator.primeEpgChannels();

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER)).toBe('lib1');
        expect(epg.loadChannels).toHaveBeenCalledWith(allChannels);
    });

    it('primeEpgChannels clears an invalid persisted filter through explicit runtime-owner cleanup', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, '1');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER, 'missing-lib');

        const allChannels: ChannelConfig[] = [
            { ...makeChannel('c1', 1), sourceLibraryId: 'lib1', sourceLibraryName: 'Movies' },
            { ...makeChannel('c2', 2), sourceLibraryId: 'lib2', sourceLibraryName: 'TV' },
        ];

        const { deps, epg } = makeDeps({
            getChannelManager: () =>
            ({
                ...makeDeps().channelManager,
                getAllChannels: () => allChannels,
            } as IChannelManager),
        });
        const computeNormalizedLibraryFilterStateSpy = jest.spyOn(EPGCoordinatorPolicies, 'computeNormalizedLibraryFilterState');
        const epgPreferencesStore = deps.epgPreferencesStore as EpgPreferencesStore;
        const writeSelectedLibraryIdSpy = jest.spyOn(epgPreferencesStore, 'writeSelectedLibraryId');
        const coordinator = new EPGCoordinator(deps);

        coordinator.primeEpgChannels();

        expect(computeNormalizedLibraryFilterStateSpy).toHaveBeenCalledWith(
            allChannels,
            {
                pastItemsWindowSetting: 'auto',
                tabsEnabled: true,
                selectedLibraryId: 'missing-lib',
            }
        );
        expect(writeSelectedLibraryIdSpy).toHaveBeenCalledTimes(1);
        expect(writeSelectedLibraryIdSpy).toHaveBeenCalledWith(null);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER)).toBeNull();
        expect(epg.loadChannels).toHaveBeenCalledWith(allChannels);
    });

    it('primeEpgChannels preserves a valid persisted filter when tabs are enabled and multiple libraries remain', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, '1');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER, 'lib1');

        const allChannels: ChannelConfig[] = [
            { ...makeChannel('c1', 1), sourceLibraryId: 'lib1', sourceLibraryName: 'Movies' },
            { ...makeChannel('c2', 2), sourceLibraryId: 'lib2', sourceLibraryName: 'TV' },
        ];

        const { deps, epg } = makeDeps({
            getChannelManager: () =>
            ({
                ...makeDeps().channelManager,
                getAllChannels: () => allChannels,
            } as IChannelManager),
        });
        const coordinator = new EPGCoordinator(deps);

        coordinator.primeEpgChannels();

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER)).toBe('lib1');
        expect(epg.loadChannels).toHaveBeenCalledWith([
            expect.objectContaining({ id: 'c1' }),
        ]);
    });

    it('does not clear stored library filter during schedule range computations', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW, 'auto');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, '0');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER, 'lib1');

        const allChannels: ChannelConfig[] = [
            { ...makeChannel('c1', 1), sourceLibraryId: 'lib1', sourceLibraryName: 'Movies' },
            { ...makeChannel('c2', 2), sourceLibraryId: 'lib2', sourceLibraryName: 'TV' },
        ];

        const { deps } = makeDeps({
            getChannelManager: () =>
            ({
                ...makeDeps().channelManager,
                getAllChannels: () => allChannels,
            } as IChannelManager),
        });
        readScheduleRange(deps);

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER)).toBe('lib1');
    });

    it('primeEpgChannels applies layout mode and now watching settings from storage', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE, 'classic');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED, '0');

        const { deps, epg } = makeDeps();
        const coordinator = new EPGCoordinator(deps);

        coordinator.primeEpgChannels();

        expect(epg.setLayoutMode).toHaveBeenCalledWith('classic');
        expect(epg.setNowWatchingBannerEnabled).toHaveBeenCalledWith(false);
    });

    it('primeEpgChannels defaults to classic layout when no layout is stored', () => {
        const { deps, epg } = makeDeps();
        const coordinator = new EPGCoordinator(deps);

        coordinator.primeEpgChannels();

        expect(epg.setLayoutMode).toHaveBeenCalledWith('classic');
    });

    it('openEPG shows immediately when not ready then initializes and shows again', async () => {
        let status: EPGUiStatus = 'initializing';
        const ensure = jest.fn().mockImplementation(async () => {
            status = 'ready';
        });
        const { deps, epg } = makeDeps({
            getEpgUiStatus: () => status,
            ensureEpgInitialized: ensure,
        });
        const coordinator = new EPGCoordinator(deps);

        coordinator.openEPG();
        await Promise.resolve();
        await Promise.resolve();

        expect(epg.show).toHaveBeenCalledTimes(2);
        expect(epg.focusNow).toHaveBeenCalledTimes(1);
        expect(epg.focusChannel).toHaveBeenCalledTimes(1);
        expect(ensure).toHaveBeenCalled();
        expect(epg.loadChannels).toHaveBeenCalled();
    });

    it('openEPG deferred follow-up preserves focus semantics when preserveFocus is true', async () => {
        let status: EPGUiStatus = 'initializing';
        const ensure = jest.fn().mockImplementation(async () => {
            status = 'ready';
        });
        const { deps, epg } = makeDeps({
            getEpgUiStatus: () => status,
            ensureEpgInitialized: ensure,
            getPreserveFocusOnOpen: () => true,
        });
        const coordinator = new EPGCoordinator(deps);

        coordinator.openEPG();
        await Promise.resolve();
        await Promise.resolve();

        expect(epg.show).toHaveBeenCalledTimes(2);
        expect(epg.show).toHaveBeenNthCalledWith(1, { preserveFocus: true });
        expect(epg.show).toHaveBeenNthCalledWith(2, { preserveFocus: true });
        expect(epg.focusNow).not.toHaveBeenCalled();
        expect(epg.focusChannel).not.toHaveBeenCalled();
        expect(ensure).toHaveBeenCalled();
    });

    it('openEPG does not reopen the guide after closeEPG runs while initialization is pending', async () => {
        let resolveEnsure!: () => void;
        const ensure = jest.fn().mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    resolveEnsure = resolve;
                })
        );
        const { deps, epg } = makeDeps({
            getEpgUiStatus: () => 'initializing',
            ensureEpgInitialized: ensure,
        });
        const coordinator = new EPGCoordinator(deps);

        coordinator.openEPG();
        expect(epg.show).toHaveBeenCalledTimes(1);

        coordinator.closeEPG();
        resolveEnsure();
        await flushPromises();

        expect(epg.hide).toHaveBeenCalledTimes(1);
        expect(epg.show).toHaveBeenCalledTimes(1);
        expect(epg.loadChannels).not.toHaveBeenCalled();
    });

    it('ignores stale initialization rejections after a newer open request starts', async () => {
        let rejectFirst!: (error: unknown) => void;
        const ensure = jest
            .fn()
            .mockImplementationOnce(
                () =>
                    new Promise<void>((_, reject) => {
                        rejectFirst = reject;
                    })
            )
            .mockResolvedValueOnce(undefined);
        const { deps, epg } = makeDeps({
            getEpgUiStatus: () => 'initializing',
            ensureEpgInitialized: ensure,
        });
        const coordinator = new EPGCoordinator(deps);

        coordinator.openEPG();
        coordinator.openEPG();
        rejectFirst(new Error('stale init failed'));
        await flushPromises();

        expect(epg.hide).not.toHaveBeenCalled();
        expect(deps.reportEpgInitWarning).not.toHaveBeenCalled();
    });

	    it('preseeds current channel schedule when scheduler is active and channel is visible', () => {
	        const { deps, epg } = makeDeps();
	        const coordinator = new EPGCoordinator(deps);
	        const refreshSpy = jest.spyOn(coordinator, 'refreshEpgSchedules').mockResolvedValue(undefined);

	        coordinator.openEPG();

	        expect(epg.loadScheduleForChannel).toHaveBeenCalledWith('c0', expect.any(Object));
	        expect(refreshSpy).toHaveBeenCalled();
	    });

	    it('does not preseed when scheduler is inactive', () => {
        const scheduler: IChannelScheduler = {
            getState: () => ({ isActive: false, channelId: 'c0' }),
            getScheduleWindow: jest.fn(),
        } as unknown as IChannelScheduler;
	        const { deps, epg } = makeDeps({
	            getScheduler: () => scheduler,
	        });
	        const coordinator = new EPGCoordinator(deps);
	        const refreshSpy = jest.spyOn(coordinator, 'refreshEpgSchedules').mockResolvedValue(undefined);

        coordinator.openEPG();

        expect(epg.loadScheduleForChannel).not.toHaveBeenCalled();
        expect(refreshSpy).toHaveBeenCalled();
    });

	    it('does not preseed when current channel is filtered out', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, '1');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER, 'lib2');

        const channels: ChannelConfig[] = [
            { ...makeChannel('c1', 1), sourceLibraryId: 'lib1', sourceLibraryName: 'Movies' },
            { ...makeChannel('c2', 2), sourceLibraryId: 'lib2', sourceLibraryName: 'TV' },
        ];
        const base = makeDeps().deps.getChannelManager()!;
        const { deps, epg } = makeDeps({
            getChannelManager: () =>
            ({
                ...base,
                getAllChannels: () => channels,
                getCurrentChannel: () => channels[0],
                resolveChannelContent: base.resolveChannelContent,
            } as IChannelManager),
	        });
	        const coordinator = new EPGCoordinator(deps);
	        const refreshSpy = jest.spyOn(coordinator, 'refreshEpgSchedules').mockResolvedValue(undefined);

        coordinator.openEPG();

        expect(epg.loadScheduleForChannel).not.toHaveBeenCalled();
        expect(refreshSpy).toHaveBeenCalled();
    });

    it('refreshEpgSchedules loads visible range and focuses when visible with no focus', async () => {
        const manyChannels = Array.from({ length: 105 }, (_, i) => makeChannel(`c${i}`, i + 1));
        const base = makeDeps().deps.getChannelManager()!;
        const { deps, epg } = makeDeps({
            getChannelManager: () =>
            ({
                ...base,
                getAllChannels: () => manyChannels,
                getCurrentChannel: () => manyChannels[0],
                resolveChannelContent: base.resolveChannelContent,
            } as IChannelManager),
        });
        const coordinator = new EPGCoordinator(deps);
        (epg.isVisible as jest.Mock).mockReturnValue(true);
        (epg.getFocusedProgram as jest.Mock).mockReturnValue(null);

        await coordinator.refreshEpgSchedules();

        expect((epg.loadScheduleForChannel as jest.Mock).mock.calls.length).toBeLessThanOrEqual(11);
        expect(epg.focusNow).toHaveBeenCalled();
    });

    it('refreshEpgSchedulesForRange loads schedules for scrolled-into channels', async () => {
        const manyChannels = Array.from({ length: 120 }, (_, i) => makeChannel(`c${i}`, i + 1));
        const base = makeDeps().deps.getChannelManager()!;
        const { deps, epg } = makeDeps({
            getChannelManager: () =>
            ({
                ...base,
                getAllChannels: () => manyChannels,
                getCurrentChannel: () => manyChannels[0],
                resolveChannelContent: base.resolveChannelContent,
            } as IChannelManager),
        });
        const coordinator = new EPGCoordinator(deps);

        await coordinator.refreshEpgSchedulesForRange(
            { channelStart: 100, channelEnd: 103, timeStartMs: 0, timeEndMs: 0 },
            { debounceMs: 0, reason: 'visible-range' }
        );

        const loadedIds = (epg.loadScheduleForChannel as jest.Mock).mock.calls.map((call) => call[0]);
        expect(loadedIds).toContain('c100');
        expect(loadedIds).toContain('c102');
        expect(epg.setGridAnchorTime).toHaveBeenCalled();
    });

    it('refreshEpgSchedulesForRange prioritizes focused/visible channels and keeps warm queue cache-only', async () => {
        useDeterministicFakeTimers();
        try {
            await withIdleCallbackDisabled(async () => {
                const manyChannels = Array.from({ length: 240 }, (_, i) => makeChannel(`c${i}`, i + 1));
                const resolveChannelContent = jest.fn().mockImplementation(async (id: string) => {
                    const items: ResolvedChannelContent['items'] = [makeResolvedItem(id, 0)];
                    return { items } as ResolvedChannelContent;
                });
                const resolveChannelItemsForSchedule = jest
                    .fn()
                    .mockImplementation(async (id: string) => [makeResolvedItem(id, 0)] as ResolvedChannelContent['items']);

                const base = makeDeps().deps.getChannelManager()!;
                const { deps, epg } = makeDeps({
                    getChannelManager: () =>
                    ({
                        ...base,
                        getAllChannels: () => manyChannels,
                        getCurrentChannel: () => manyChannels[100],
                        resolveChannelContent,
                        resolveChannelItemsForSchedule,
                    } as IChannelManager),
                });

                (epg.getState as jest.Mock).mockReturnValue({
                    isVisible: true,
                    focusedCell: { channelIndex: 101, timeSlotIndex: 0, kind: 'program' },
                    scrollPosition: { channelOffset: 0, timeOffset: 0 },
                    viewWindow: {
                        startTime: 0,
                        endTime: 0,
                        startChannelIndex: 100,
                        endChannelIndex: 119,
                    },
                    currentTime: 0,
                });

                const coordinator = new EPGCoordinator(deps);
                await coordinator.refreshEpgSchedulesForRange(
                    { channelStart: 100, channelEnd: 119, timeStartMs: 0, timeEndMs: 0 },
                    { debounceMs: 0, reason: 'visible-range' }
                );

                const immediateLoadedIds = (epg.loadScheduleForChannel as jest.Mock).mock.calls.map((call) => call[0]);
                expect(immediateLoadedIds).toContain('c100');
                expect(immediateLoadedIds).toContain('c101');
                expect(immediateLoadedIds).not.toContain('c130');

                await advanceWarmQueueTimers();

                const loadedAfterWarmTick = (epg.loadScheduleForChannel as jest.Mock).mock.calls.map((call) => call[0]);
                expect(loadedAfterWarmTick).not.toContain('c130');
                expect(resolveChannelItemsForSchedule).toHaveBeenCalledWith('c130', expect.anything());

                (epg.loadScheduleForChannel as jest.Mock).mockClear();
                resolveChannelContent.mockClear();

                await coordinator.refreshEpgSchedulesForRange(
                    { channelStart: 130, channelEnd: 130, timeStartMs: 0, timeEndMs: 0 },
                    { debounceMs: 0, reason: 'visible-range' }
                );

                const loadedAfterScroll = (epg.loadScheduleForChannel as jest.Mock).mock.calls.map((call) => call[0]);
                expect(loadedAfterScroll).toContain('c130');
                const didResolveFromNetwork = resolveChannelContent.mock.calls.some((call) => call[0] === 'c130');
                expect(didResolveFromNetwork).toBe(false);
            });
        } finally {
            jest.useRealTimers();
        }
    });

    it('new visible-range request cancels stale background warm queue and prevents stale cache writes', async () => {
        useDeterministicFakeTimers();
        try {
            await withIdleCallbackDisabled(async () => {
                const manyChannels = Array.from({ length: 240 }, (_, i) => makeChannel(`c${i}`, i + 1));
                const resolveChannelContent = jest.fn().mockImplementation(async (id: string) => {
                    const items: ResolvedChannelContent['items'] = [makeResolvedItem(id, 0)];
                    return { items } as ResolvedChannelContent;
                });
                const pendingWarmResolves = new Map<string, (items: ResolvedChannelContent['items']) => void>();
                const resolveChannelItemsForSchedule = jest.fn().mockImplementation((id: string) => {
                    if (id !== 'c130') {
                        return Promise.resolve([makeResolvedItem(id, 0)] as ResolvedChannelContent['items']);
                    }
                    return new Promise<ResolvedChannelContent['items']>((resolve) => {
                        pendingWarmResolves.set(id, resolve);
                    });
                });

                const base = makeDeps().deps.getChannelManager()!;
                const { deps, epg } = makeDeps({
                    getChannelManager: () =>
                    ({
                        ...base,
                        getAllChannels: () => manyChannels,
                        getCurrentChannel: () => manyChannels[100],
                        resolveChannelContent,
                        resolveChannelItemsForSchedule,
                    } as IChannelManager),
                });

                (epg.getState as jest.Mock).mockReturnValue({
                    isVisible: true,
                    focusedCell: { channelIndex: 101, timeSlotIndex: 0, kind: 'program' },
                    scrollPosition: { channelOffset: 0, timeOffset: 0 },
                    viewWindow: {
                        startTime: 0,
                        endTime: 0,
                        startChannelIndex: 100,
                        endChannelIndex: 119,
                    },
                    currentTime: 0,
                });

                const coordinator = new EPGCoordinator(deps);
                await coordinator.refreshEpgSchedulesForRange(
                    { channelStart: 100, channelEnd: 119, timeStartMs: 0, timeEndMs: 0 },
                    { debounceMs: 0, reason: 'visible-range' }
                );

                await advanceWarmQueueTimers();
                expect(pendingWarmResolves.has('c130')).toBe(true);

                await coordinator.refreshEpgSchedulesForRange(
                    { channelStart: 10, channelEnd: 13, timeStartMs: 0, timeEndMs: 0 },
                    { debounceMs: 0, reason: 'visible-range' }
                );

                pendingWarmResolves.get('c130')?.([makeResolvedItem('c130', 0)] as ResolvedChannelContent['items']);
                await advanceWarmQueueTimers(4);

                resolveChannelContent.mockClear();
                await coordinator.refreshEpgSchedulesForRange(
                    { channelStart: 130, channelEnd: 130, timeStartMs: 0, timeEndMs: 0 },
                    { debounceMs: 0, reason: 'visible-range' }
                );
                const didResolveFromNetwork = resolveChannelContent.mock.calls.some((call) => call[0] === 'c130');
                expect(didResolveFromNetwork).toBe(true);
            });
        } finally {
            jest.useRealTimers();
        }
    });

    it('staged loading assertions are deterministic with deferred resolver gates', async () => {
        useDeterministicFakeTimers();
        try {
            await withIdleCallbackDisabled(async () => {
                const manyChannels = Array.from({ length: 240 }, (_, i) => makeChannel(`c${i}`, i + 1));
                const resolveChannelContent = jest.fn().mockImplementation(async (id: string) => {
                    const items: ResolvedChannelContent['items'] = [makeResolvedItem(id, 0)];
                    return { items } as ResolvedChannelContent;
                });
                const pendingWarmResolves = new Map<string, (items: ResolvedChannelContent['items']) => void>();
                const resolveChannelItemsForSchedule = jest.fn().mockImplementation((id: string) => {
                    if (id !== 'c130') {
                        return Promise.resolve([makeResolvedItem(id, 0)] as ResolvedChannelContent['items']);
                    }
                    return new Promise<ResolvedChannelContent['items']>((resolve) => {
                        pendingWarmResolves.set(id, resolve);
                    });
                });
                const base = makeDeps().deps.getChannelManager()!;
                const { deps, epg } = makeDeps({
                    getChannelManager: () =>
                    ({
                        ...base,
                        getAllChannels: () => manyChannels,
                        getCurrentChannel: () => manyChannels[100],
                        resolveChannelContent,
                        resolveChannelItemsForSchedule,
                    } as IChannelManager),
                });

                (epg.getState as jest.Mock).mockReturnValue({
                    isVisible: true,
                    focusedCell: { channelIndex: 101, timeSlotIndex: 0, kind: 'program' },
                    scrollPosition: { channelOffset: 0, timeOffset: 0 },
                    viewWindow: {
                        startTime: 0,
                        endTime: 0,
                        startChannelIndex: 100,
                        endChannelIndex: 119,
                    },
                    currentTime: 0,
                });

                const coordinator = new EPGCoordinator(deps);
                const refreshPromise = coordinator.refreshEpgSchedulesForRange(
                    { channelStart: 100, channelEnd: 119, timeStartMs: 0, timeEndMs: 0 },
                    { debounceMs: 0, reason: 'visible-range' }
                );

                await flushPromises();
                await refreshPromise;

                const loadedAfterImmediate = (epg.loadScheduleForChannel as jest.Mock).mock.calls.map((call) => call[0]);
                expect(loadedAfterImmediate).toContain('c100');
                expect(loadedAfterImmediate).toContain('c101');
                expect(loadedAfterImmediate).not.toContain('c130');
                expect(pendingWarmResolves.has('c130')).toBe(false);

                await advanceWarmQueueTimers();

                expect(pendingWarmResolves.has('c130')).toBe(true);
                const afterWarmTick = (epg.loadScheduleForChannel as jest.Mock).mock.calls.map((call) => call[0]);
                expect(afterWarmTick).not.toContain('c130');
                pendingWarmResolves.get('c130')?.([makeResolvedItem('c130', 0)] as ResolvedChannelContent['items']);
                await advanceWarmQueueTimers(4);

                const afterGateRelease = (epg.loadScheduleForChannel as jest.Mock).mock.calls.map((call) => call[0]);
                expect(afterGateRelease).not.toContain('c130');

                (epg.loadScheduleForChannel as jest.Mock).mockClear();
                resolveChannelContent.mockClear();
                await coordinator.refreshEpgSchedulesForRange(
                    { channelStart: 130, channelEnd: 130, timeStartMs: 0, timeEndMs: 0 },
                    { debounceMs: 0, reason: 'visible-range' }
                );
                const loadedAfterScroll = (epg.loadScheduleForChannel as jest.Mock).mock.calls.map((call) => call[0]);
                expect(loadedAfterScroll).toContain('c130');
                const didResolveFromNetwork = resolveChannelContent.mock.calls.some((call) => call[0] === 'c130');
                expect(didResolveFromNetwork).toBe(false);
            });
        } finally {
            jest.useRealTimers();
        }
    });

    it('background warm queue backs off instead of canceling when in-flight pressure is high', () => {
        expect(getBackgroundWarmQueueAction({
            refreshId: 42,
            activeRefreshId: 42,
            cursor: 0,
            totalChannels: 2,
            cacheSize: 0,
            cacheLimit: 32,
            inFlightCount: 10,
            concurrency: 2,
        })).toEqual({ kind: 'backpressure' });

        expect(getBackgroundWarmQueueAction({
            refreshId: 42,
            activeRefreshId: 42,
            cursor: 0,
            totalChannels: 2,
            cacheSize: 0,
            cacheLimit: 32,
            inFlightCount: 0,
            concurrency: 2,
        })).toEqual({ kind: 'runBatch' });
    });

    it('aggressive preload mode widens background candidate set compared to default mode', async () => {
        useDeterministicFakeTimers();
        try {
            await withIdleCallbackDisabled(async () => {
                const manyChannels = Array.from({ length: 240 }, (_, i) => makeChannel(`c${i}`, i + 1));
                const runRefresh = async (aggressive: boolean): Promise<string[]> => {
                    if (aggressive) {
                        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_AGGRESSIVE_PRELOAD_ENABLED, '1');
                    } else {
                        localStorage.removeItem(LINEUP_STORAGE_KEYS.EPG_AGGRESSIVE_PRELOAD_ENABLED);
                    }

                    const resolveChannelContent = jest.fn().mockImplementation(async (id: string) => {
                        const items: ResolvedChannelContent['items'] = [makeResolvedItem(id, 0)];
                        return { items } as ResolvedChannelContent;
                    });
                    const resolveChannelItemsForSchedule = jest
                        .fn()
                        .mockImplementation(async (id: string) => [makeResolvedItem(id, 0)] as ResolvedChannelContent['items']);

                    const base = makeDeps().deps.getChannelManager()!;
                    const { deps, epg } = makeDeps({
                        getChannelManager: () =>
                        ({
                            ...base,
                            getAllChannels: () => manyChannels,
                            getCurrentChannel: () => manyChannels[100],
                            resolveChannelContent,
                            resolveChannelItemsForSchedule,
                        } as IChannelManager),
                    });

                    (epg.getState as jest.Mock).mockReturnValue({
                        isVisible: true,
                        focusedCell: { channelIndex: 101, timeSlotIndex: 0, kind: 'program' },
                        scrollPosition: { channelOffset: 0, timeOffset: 0 },
                        viewWindow: {
                            startTime: 0,
                            endTime: 0,
                            startChannelIndex: 100,
                            endChannelIndex: 100,
                        },
                        currentTime: 0,
                    });

                    const coordinator = new EPGCoordinator(deps);
                    await coordinator.refreshEpgSchedulesForRange(
                        { channelStart: 100, channelEnd: 100, timeStartMs: 0, timeEndMs: 0 },
                        { debounceMs: 0, reason: 'visible-range' }
                    );
                    await advanceWarmQueueTimers(40);
                    return resolveChannelItemsForSchedule.mock.calls.map((call) => call[0]);
                };

                const defaultLoaded = await runRefresh(false);
                const aggressiveLoaded = await runRefresh(true);

                expect(defaultLoaded).not.toContain('c200');
                expect(aggressiveLoaded).toContain('c200');
            });
        } finally {
            jest.useRealTimers();
        }
    });

    it('server-swap refresh bypasses loaded-range short-circuit after schedules were previously loaded', async () => {
        const { deps, epg } = makeDeps();
        const coordinator = new EPGCoordinator(deps);
        const range = { channelStart: 0, channelEnd: 3, timeStartMs: 0, timeEndMs: 0 };

        await coordinator.refreshEpgSchedulesForRange(range, { debounceMs: 0, reason: 'visible-range' });
        expect((epg.loadScheduleForChannel as jest.Mock).mock.calls.length).toBeGreaterThan(0);

        (epg.loadScheduleForChannel as jest.Mock).mockClear();
        await coordinator.refreshEpgSchedulesForRange(range, { debounceMs: 0, reason: 'visible-range' });
        expect((epg.loadScheduleForChannel as jest.Mock).mock.calls.length).toBe(0);

        (epg.loadScheduleForChannel as jest.Mock).mockClear();
        await coordinator.refreshEpgSchedulesForRange(range, { debounceMs: 0, reason: 'server-swap' });
        expect((epg.loadScheduleForChannel as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    });

    it('refreshEpgSchedules uses filtered channels', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, '1');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER, 'lib1');

        const channels: ChannelConfig[] = [
            { ...makeChannel('c1', 1), sourceLibraryId: 'lib1', sourceLibraryName: 'Movies' },
            { ...makeChannel('c2', 2), sourceLibraryId: 'lib2', sourceLibraryName: 'TV' },
        ];
        const base = makeDeps().deps.getChannelManager()!;
        const { deps, epg } = makeDeps({
            getChannelManager: () =>
            ({
                ...base,
                getAllChannels: () => channels,
                getCurrentChannel: () => channels[0],
                resolveChannelContent: base.resolveChannelContent,
            } as IChannelManager),
        });
        const coordinator = new EPGCoordinator(deps);

        await coordinator.refreshEpgSchedules();

        const loadedIds = (epg.loadScheduleForChannel as jest.Mock).mock.calls.map((call) => call[0]);
        expect(loadedIds).toContain('c1');
        expect(loadedIds).not.toContain('c2');
    });

    it('refreshEpgSchedulesForRange uses filtered channels', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, '1');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER, 'lib1');

        const channels: ChannelConfig[] = [
            { ...makeChannel('c1', 1), sourceLibraryId: 'lib1', sourceLibraryName: 'Movies' },
            { ...makeChannel('c2', 2), sourceLibraryId: 'lib2', sourceLibraryName: 'TV' },
        ];
        const base = makeDeps().deps.getChannelManager()!;
        const { deps, epg } = makeDeps({
            getChannelManager: () =>
            ({
                ...base,
                getAllChannels: () => channels,
                getCurrentChannel: () => channels[0],
                resolveChannelContent: base.resolveChannelContent,
            } as IChannelManager),
        });
        const coordinator = new EPGCoordinator(deps);

        await coordinator.refreshEpgSchedulesForRange(
            { channelStart: 0, channelEnd: 1, timeStartMs: 0, timeEndMs: 0 },
            { debounceMs: 0, reason: 'visible-range' }
        );

        const loadedIds = (epg.loadScheduleForChannel as jest.Mock).mock.calls.map((call) => call[0]);
        expect(loadedIds).toContain('c1');
        expect(loadedIds).not.toContain('c2');
    });

    it('refreshEpgSchedulesForRange resolves after debounce completes', async () => {
        useDeterministicFakeTimers();
        try {
            const { deps, epg } = makeDeps();
            const coordinator = new EPGCoordinator(deps);

            const promise = coordinator.refreshEpgSchedulesForRange(
                { channelStart: 0, channelEnd: 1, timeStartMs: 0, timeEndMs: 0 },
                { debounceMs: 50, reason: 'visible-range' }
            );
            const secondPromise = coordinator.refreshEpgSchedulesForRange(
                { channelStart: 0, channelEnd: 1, timeStartMs: 0, timeEndMs: 0 },
                { debounceMs: 50, reason: 'visible-range' }
            );
            expect(epg.loadScheduleForChannel).not.toHaveBeenCalled();

            jest.advanceTimersByTime(50);
            await Promise.all([promise, secondPromise]);

            expect(epg.loadScheduleForChannel).toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });

    it('refreshEpgSchedulesForRange immediate call preempts armed debounce and settles pending promise', async () => {
        useDeterministicFakeTimers();
        try {
            const { deps, epg } = makeDeps();
            const coordinator = new EPGCoordinator(deps);

            const debouncedPromise = coordinator.refreshEpgSchedulesForRange(
                { channelStart: 0, channelEnd: 1, timeStartMs: 0, timeEndMs: 0 },
                { debounceMs: 75, reason: 'visible-range' }
            );
            const secondDebouncedPromise = coordinator.refreshEpgSchedulesForRange(
                { channelStart: 1, channelEnd: 2, timeStartMs: 60_000, timeEndMs: 120_000 },
                { debounceMs: 75, reason: 'visible-range' }
            );

            const immediatePromise = coordinator.refreshEpgSchedulesForRange(
                { channelStart: 2, channelEnd: 3, timeStartMs: 120_000, timeEndMs: 180_000 },
                { debounceMs: 0, reason: 'library-filter' }
            );

            await Promise.all([immediatePromise, debouncedPromise, secondDebouncedPromise]);
            const callCountAfterImmediate = (epg.loadScheduleForChannel as jest.Mock).mock.calls.length;
            expect(callCountAfterImmediate).toBeGreaterThan(0);

            jest.advanceTimersByTime(100);
            await flushPromises();
            expect(epg.loadScheduleForChannel).toHaveBeenCalledTimes(callCountAfterImmediate);
        } finally {
            jest.useRealTimers();
        }
    });

    it('refreshEpgScheduleForLiveChannel uses scheduler window for current channel', () => {
        const windowPrograms = [baseProgram('c0', 5)];
        const scheduler: IChannelScheduler = {
            getState: () => ({ isActive: true, channelId: 'c0' }),
            getScheduleWindow: () => ({ startTime: 10, endTime: 20, programs: windowPrograms }),
        } as unknown as IChannelScheduler;
        const { deps, epg } = makeDeps({
            getScheduler: () => scheduler,
        });
        const coordinator = new EPGCoordinator(deps);
        (epg.isVisible as jest.Mock).mockReturnValue(true);

        coordinator.refreshEpgScheduleForLiveChannel();

        expect(epg.loadScheduleForChannel).toHaveBeenCalledWith('c0', {
            startTime: 10,
            endTime: 20,
            programs: windowPrograms,
        });
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'epg.liveRowOverwrite',
            expect.objectContaining({
                channelId: 'c0',
                source: 'live-scheduler',
            })
        );
    });

    it('uses conservative warm-queue caps only at very-large-guide threshold (260+)', () => {
        const getCaps = (
            channelCount: number,
            aggressive: boolean
        ): { maxQueuedChannels: number; maxConcurrency: number } =>
            computeBackgroundWarmQueueCaps(channelCount, 10, aggressive);

        expect(getCaps(240, false)).toEqual({ maxQueuedChannels: 120, maxConcurrency: 2 });
        expect(getCaps(240, true)).toEqual({ maxQueuedChannels: 200, maxConcurrency: 3 });

        expect(getCaps(260, false)).toEqual({ maxQueuedChannels: 96, maxConcurrency: 1 });
        expect(getCaps(260, true)).toEqual({ maxQueuedChannels: 140, maxConcurrency: 2 });
    });

    it('keeps loaded-range short-circuit unchanged across overlay/classic layout mode flips', async () => {
        const range = { channelStart: 0, channelEnd: 2, timeStartMs: 0, timeEndMs: 0 };
        const resolveChannelContent = jest.fn().mockImplementation(async (id: string) => {
            const items: ResolvedChannelContent['items'] = [makeResolvedItem(id, 0)];
            return { items } as ResolvedChannelContent;
        });

        const base = makeDeps().deps.getChannelManager()!;
        const { deps, epg } = makeDeps({
            getChannelManager: () => ({ ...base, resolveChannelContent } as IChannelManager),
        });

        const coordinator = new EPGCoordinator(deps);

        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE, 'overlay');
        await coordinator.refreshEpgSchedulesForRange(range, { debounceMs: 0, reason: 'visible-range' });
        const firstResolveCount = resolveChannelContent.mock.calls.length;
        expect(firstResolveCount).toBeGreaterThan(0);

        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE, 'classic');
        (epg.loadScheduleForChannel as jest.Mock).mockClear();
        await coordinator.refreshEpgSchedulesForRange(range, { debounceMs: 0, reason: 'visible-range' });

        expect(resolveChannelContent.mock.calls.length).toBe(firstResolveCount);
        expect((epg.loadScheduleForChannel as jest.Mock).mock.calls.length).toBe(0);
    });

    it('wireEpgEvents returns unsubscribers, forwards visibility changes, and triggers switch when program eligible', async () => {
        const hide = jest.fn();
        let epgVisible = false;
        const onVisibilityChange = jest.fn();
        const epg: IEPGComponent = {
            on: jest.fn(),
            off: jest.fn(),
            hide,
            isVisible: jest.fn().mockImplementation(() => epgVisible),
            getState: jest.fn().mockReturnValue({
                isVisible: false,
                focusedCell: null,
                scrollPosition: { channelOffset: 0, timeOffset: 0 },
                viewWindow: {
                    startTime: 0,
                    endTime: 0,
                    startChannelIndex: 0,
                    endChannelIndex: 0,
                },
                currentTime: 0,
            }),
            clearSchedules: jest.fn(),
            setCategoryColorsEnabled: jest.fn(),
            setVisibleHours: jest.fn(),
            setLibraryTabs: jest.fn(),
            scrollToChannel: jest.fn(),
            focusChannel: jest.fn(),
        } as unknown as IEPGComponent;
        const switchToChannel = jest.fn().mockResolvedValue(undefined);
        const setSource = jest.fn();
        const deps = makeDeps({
            getEpg: () => epg,
            onVisibilityChange,
            setLastChannelChangeSourceToGuide: setSource,
            switchToChannel,
        }).deps;
        const coordinator = new EPGCoordinator(deps);
        jest.spyOn(Date, 'now').mockReturnValue(5_000);

        const [unsubChannel, unsubFilter, unsubOpen, unsubClose] = coordinator.wireEpgEvents();
        expect(typeof unsubChannel).toBe('function');
        expect(typeof unsubFilter).toBe('function');
        expect(typeof unsubOpen).toBe('function');
        expect(typeof unsubClose).toBe('function');

        const handlerCall = (epg.on as jest.Mock).mock.calls.find((call) => call[0] === 'channelSelected');
        expect(handlerCall).toBeDefined();
        const openHandler = (epg.on as jest.Mock).mock.calls.find((call) => call[0] === 'open')?.[1];
        const closeHandler = (epg.on as jest.Mock).mock.calls.find((call) => call[0] === 'close')?.[1];
        epgVisible = true;
        openHandler?.();
        epgVisible = false;
        closeHandler?.();
        expect(onVisibilityChange).toHaveBeenNthCalledWith(1, true);
        expect(onVisibilityChange).toHaveBeenNthCalledWith(2, false);

        const handler = handlerCall?.[1];
        handler({
            channel: makeChannel('c1', 1),
            program: {
                ...baseProgram('c1', 0),
                scheduledStartTime: 4_000,
                scheduledEndTime: 6_000,
            } as ScheduledProgram,
        });
        await flushPromises();

        expect(setSource).toHaveBeenCalled();
        expect(hide).toHaveBeenCalled();
        expect(switchToChannel).toHaveBeenCalledWith(
            'c1',
            expect.objectContaining({
                guideSelectionSnapshot: expect.objectContaining({
                    channelId: 'c1',
                    ratingKey: 'c1-0',
                }),
            })
        );
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'epg.channelSelected',
            expect.objectContaining({
                channelId: 'c1',
                ratingKey: 'c1-0',
            })
        );

        unsubChannel!();
        expect(epg.off).toHaveBeenCalledWith('channelSelected', handler);

        const filterHandler = (epg.on as jest.Mock).mock.calls.find((call) => call[0] === 'libraryFilterChanged')?.[1];
        unsubFilter!();
        if (filterHandler) {
            expect(epg.off).toHaveBeenCalledWith('libraryFilterChanged', filterHandler);
        }
        unsubOpen!();
        unsubClose!();
        if (openHandler) {
            expect(epg.off).toHaveBeenCalledWith('open', openHandler);
        }
        if (closeHandler) {
            expect(epg.off).toHaveBeenCalledWith('close', closeHandler);
        }
    });

    it('resyncs channel badge visibility immediately on EPG open and close through the coordinator callback path', () => {
        let epgVisible = false;
        const epg: IEPGComponent = {
            on: jest.fn(),
            off: jest.fn(),
            hide: jest.fn(),
            isVisible: jest.fn().mockImplementation(() => epgVisible),
            getState: jest.fn().mockReturnValue({
                isVisible: false,
                focusedCell: null,
                scrollPosition: { channelOffset: 0, timeOffset: 0 },
                viewWindow: {
                    startTime: 0,
                    endTime: 0,
                    startChannelIndex: 0,
                    endChannelIndex: 0,
                },
                currentTime: 0,
            }),
            clearSchedules: jest.fn(),
            setCategoryColorsEnabled: jest.fn(),
            setVisibleHours: jest.fn(),
            setLibraryTabs: jest.fn(),
            scrollToChannel: jest.fn(),
            focusChannel: jest.fn(),
        } as unknown as IEPGComponent;
        const overlayDeps: jest.Mocked<OverlayRuntimePolicyControllerDeps> = {
            hasChannelBadgeOverlay: jest.fn().mockReturnValue(true),
            getPlayerOsdVisible: jest.fn().mockReturnValue(true),
            getNowPlayingInfoVisible: jest.fn().mockReturnValue(false),
            getEpgVisible: jest.fn().mockImplementation(() => epgVisible),
            getCurrentChannel: jest.fn().mockReturnValue({ number: 55, name: 'Drama' }),
            showChannelBadge: jest.fn(),
            hideChannelBadge: jest.fn(),
            hasNavigation: jest.fn().mockReturnValue(true),
            hasNowPlayingInfoOverlay: jest.fn().mockReturnValue(true),
            getCurrentScreen: jest.fn().mockReturnValue('player'),
            hasCurrentProgramForPlayback: jest.fn().mockReturnValue(true),
            isModalOpen: jest.fn().mockReturnValue(false),
            openModal: jest.fn(),
            closeModal: jest.fn(),
            nowPlayingModalId: 'now-playing-info',
        };
        const overlayController = new OverlayRuntimePolicyController(overlayDeps);
        const deps = makeDeps({
            getEpg: () => epg,
            onVisibilityChange: (visible: boolean): void => {
                overlayController.handleOverlayVisibilityChange(visible);
            },
        }).deps;
        const coordinator = new EPGCoordinator(deps);

        coordinator.wireEpgEvents();

        overlayController.syncChannelBadgeOverlay();
        expect(overlayDeps.showChannelBadge).toHaveBeenCalledTimes(1);
        expect(overlayDeps.hideChannelBadge).not.toHaveBeenCalled();

        const openHandler = (epg.on as jest.Mock).mock.calls.find((call) => call[0] === 'open')?.[1];
        const closeHandler = (epg.on as jest.Mock).mock.calls.find((call) => call[0] === 'close')?.[1];

        epgVisible = true;
        openHandler?.();
        expect(overlayDeps.hideChannelBadge).toHaveBeenCalledTimes(1);
        expect(overlayDeps.showChannelBadge).toHaveBeenCalledTimes(1);

        epgVisible = false;
        closeHandler?.();
        expect(overlayDeps.showChannelBadge).toHaveBeenCalledTimes(2);
        expect(overlayDeps.showChannelBadge).toHaveBeenLastCalledWith({
            channelNumber: 55,
            channelName: 'Drama',
        });
    });

    it('wireEpgEvents does not switch when selected program already ended', () => {
        const hide = jest.fn();
        const epg: IEPGComponent = {
            on: jest.fn(),
            off: jest.fn(),
            hide,
            getState: jest.fn().mockReturnValue({
                isVisible: false,
                focusedCell: null,
                scrollPosition: { channelOffset: 0, timeOffset: 0 },
                viewWindow: {
                    startTime: 0,
                    endTime: 0,
                    startChannelIndex: 0,
                    endChannelIndex: 0,
                },
                currentTime: 0,
            }),
            clearSchedules: jest.fn(),
            setCategoryColorsEnabled: jest.fn(),
            setVisibleHours: jest.fn(),
            setLibraryTabs: jest.fn(),
            scrollToChannel: jest.fn(),
            focusChannel: jest.fn(),
        } as unknown as IEPGComponent;
        const switchToChannel = jest.fn().mockResolvedValue(undefined);
        const setSource = jest.fn();
        const deps = makeDeps({
            getEpg: () => epg,
            setLastChannelChangeSourceToGuide: setSource,
            switchToChannel,
        }).deps;
        const coordinator = new EPGCoordinator(deps);
        jest.spyOn(Date, 'now').mockReturnValue(5_000);

        coordinator.wireEpgEvents();
        const handler = (epg.on as jest.Mock).mock.calls[0][1];
        handler({
            channel: makeChannel('c1', 1),
            program: {
                ...baseProgram('c1', 0),
                scheduledStartTime: 1_000,
                scheduledEndTime: 4_000,
            } as ScheduledProgram,
        });

        expect(setSource).not.toHaveBeenCalled();
        expect(hide).not.toHaveBeenCalled();
        expect(switchToChannel).not.toHaveBeenCalled();
    });

    it('passes a resolved-immediate selected-row snapshot into guide-initiated tune', async () => {
        const switchToChannel = jest.fn().mockResolvedValue(undefined);
        const { deps, epg } = makeDeps({ switchToChannel });
        const coordinator = new EPGCoordinator(deps);
        jest.spyOn(Date, 'now').mockReturnValue(5_000);
        (epg.getState as jest.Mock).mockReturnValue({
            isVisible: true,
            focusedCell: {
                kind: 'program',
                channelIndex: 1,
                programIndex: 0,
                program: null,
                focusTimeMs: 5_000,
                cellElement: null,
            },
            scrollPosition: { channelOffset: 0, timeOffset: 0 },
            viewWindow: {
                startTime: 0,
                endTime: 10_000,
                startChannelIndex: 0,
                endChannelIndex: 2,
            },
            currentTime: 5_000,
        });

        await coordinator.refreshEpgSchedulesForRange(
            { channelStart: 0, channelEnd: 2, timeStartMs: 0, timeEndMs: 10_000 },
            { debounceMs: 0, reason: 'visible-range' }
        );

        coordinator.wireEpgEvents();
        const handler = (epg.on as jest.Mock).mock.calls.find((call) => call[0] === 'channelSelected')?.[1];
        handler?.({
            channel: makeChannel('c1', 1),
            program: {
                ...baseProgram('c1', 0),
                scheduledStartTime: 4_000,
                scheduledEndTime: 6_000,
            } as ScheduledProgram,
        });

        await flushPromises();

        expect(switchToChannel).toHaveBeenCalledWith(
            'c1',
            expect.objectContaining({
                guideSelectionSnapshot: expect.objectContaining({
                    channelId: 'c1',
                    ratingKey: 'c1-0',
                    source: 'resolved-immediate',
                }),
            })
        );
    });

    it('re-materializes a cache-only selected row before guide-initiated tune', async () => {
        const switchToChannel = jest.fn().mockResolvedValue(undefined);
        const resolveChannelItemsForSchedule = jest.fn(async (channelId: string) => [makeResolvedItem(channelId, 0)]);
        const channels = Array.from({ length: 20 }, (_, index) => makeChannel(`c${index}`, index + 1));
        const base = makeDeps().deps.getChannelManager()!;
        const { deps, epg } = makeDeps({
            switchToChannel,
            getChannelManager: () => ({
                ...base,
                getAllChannels: () => channels,
                resolveChannelItemsForSchedule,
            } as IChannelManager),
        });
        (epg.getState as jest.Mock).mockReturnValue({
            isVisible: true,
            focusedCell: null,
            scrollPosition: { channelOffset: 0, timeOffset: 0 },
            viewWindow: {
                startTime: 0,
                endTime: 10_000,
                startChannelIndex: 0,
                endChannelIndex: 0,
            },
            currentTime: 0,
        });

        const coordinator = new EPGCoordinator(deps);
        jest.spyOn(Date, 'now').mockReturnValue(5_000);

        await coordinator.refreshEpgSchedulesForRange(
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 10_000 },
            { debounceMs: 0, reason: 'visible-range' }
        );

        coordinator.wireEpgEvents();
        const handler = (epg.on as jest.Mock).mock.calls.find((call) => call[0] === 'channelSelected')?.[1];
        handler?.({
            channel: makeChannel('c19', 20),
            program: {
                ...baseProgram('c19', 0),
                scheduledStartTime: 4_000,
                scheduledEndTime: 6_000,
            } as ScheduledProgram,
        });

        await flushPromises();

        expect(resolveChannelItemsForSchedule).toHaveBeenCalledWith(
            'c19',
            expect.objectContaining({
                signal: expect.objectContaining({ aborted: false }),
            })
        );
        expect(switchToChannel).toHaveBeenCalledWith(
            'c19',
            expect.objectContaining({
                guideSelectionSnapshot: expect.objectContaining({
                    source: 'on-demand-materialized',
                }),
            })
        );
    });

    it('falls back to direct tune when guide snapshot materialization fails', async () => {
        const switchToChannel = jest.fn().mockResolvedValue(undefined);
        const resolveChannelItemsForSchedule = jest.fn(async () => {
            throw new Error('snapshot materialization failed');
        });
        const { deps, epg } = makeDeps({
            switchToChannel,
            getChannelManager: () => ({
                ...(makeDeps().deps.getChannelManager() as IChannelManager),
                resolveChannelItemsForSchedule,
            } as IChannelManager),
        });
        (epg.getState as jest.Mock).mockReturnValue({
            isVisible: true,
            focusedCell: null,
            scrollPosition: { channelOffset: 0, timeOffset: 0 },
            viewWindow: {
                startTime: 0,
                endTime: 10_000,
                startChannelIndex: 0,
                endChannelIndex: 0,
            },
            currentTime: 5_000,
        });

        const coordinator = new EPGCoordinator(deps);
        jest.spyOn(Date, 'now').mockReturnValue(5_000);

        coordinator.wireEpgEvents();
        const handler = (epg.on as jest.Mock).mock.calls.find((call) => call[0] === 'channelSelected')?.[1];
        handler?.({
            channel: makeChannel('c0', 1),
            program: {
                ...baseProgram('c0', 0),
                scheduledStartTime: 4_000,
                scheduledEndTime: 6_000,
            } as ScheduledProgram,
        });

        await flushPromises();

        expect(resolveChannelItemsForSchedule).toHaveBeenCalledWith(
            'c0',
            expect.objectContaining({
                signal: expect.objectContaining({ aborted: false }),
            })
        );
        expect(epg.hide).toHaveBeenCalled();
        expect(switchToChannel).toHaveBeenCalledWith('c0', undefined);
    });

    it('ignores stale guide selection work after a newer selection starts', async () => {
        let resolveFirstSelection: (items: ResolvedContentItem[]) => void = () => undefined;
        let firstSelectionPending = false;
        let firstSelectionSignal: AbortSignal | null | undefined;
        const resolveChannelItemsForSchedule = jest
            .fn<Promise<ResolvedChannelContent['items']>, [string, { signal?: AbortSignal | null }?]>()
            .mockImplementationOnce(
                (_channelId, options) => new Promise<ResolvedChannelContent['items']>((resolve) => {
                    firstSelectionPending = true;
                    firstSelectionSignal = options?.signal;
                    resolveFirstSelection = resolve;
                })
            )
            .mockImplementationOnce(async (channelId: string) => makeResolvedItems(channelId));
        const switchToChannel = jest.fn().mockResolvedValue(undefined);
        const channels = [makeChannel('c0', 1), makeChannel('c1', 2)];
        const { deps, epg } = makeDeps({
            switchToChannel,
            getChannelManager: () => ({
                ...(makeDeps().deps.getChannelManager() as IChannelManager),
                getAllChannels: () => channels,
                getChannel: (channelId: string) => channels.find((channel) => channel.id === channelId) ?? null,
                resolveChannelItemsForSchedule,
            } as IChannelManager),
        });
        (epg.getState as jest.Mock).mockReturnValue({
            isVisible: true,
            focusedCell: null,
            scrollPosition: { channelOffset: 0, timeOffset: 0 },
            viewWindow: {
                startTime: 0,
                endTime: 10_000,
                startChannelIndex: 0,
                endChannelIndex: 1,
            },
            currentTime: 5_000,
        });

        const coordinator = new EPGCoordinator(deps);
        jest.spyOn(Date, 'now').mockReturnValue(5_000);

        coordinator.wireEpgEvents();
        const handler = (epg.on as jest.Mock).mock.calls.find((call) => call[0] === 'channelSelected')?.[1];

        handler?.({
            channel: makeChannel('c0', 1),
            program: {
                ...baseProgram('c0', 0),
                scheduledStartTime: 4_000,
                scheduledEndTime: 6_000,
            } as ScheduledProgram,
        });
        await flushPromises();

        handler?.({
            channel: makeChannel('c1', 2),
            program: {
                ...baseProgram('c1', 0),
                scheduledStartTime: 4_000,
                scheduledEndTime: 6_000,
            } as ScheduledProgram,
        });
        await flushPromises();

        expect(firstSelectionSignal).toBeDefined();
        expect(firstSelectionSignal?.aborted).toBe(true);
        expect(switchToChannel).toHaveBeenCalledTimes(1);
        expect(switchToChannel).toHaveBeenLastCalledWith(
            'c1',
            expect.objectContaining({
                guideSelectionSnapshot: expect.objectContaining({
                    channelId: 'c1',
                }),
            })
        );

        if (firstSelectionPending) {
            resolveFirstSelection(makeResolvedItems('c0'));
        }
        await flushPromises();

        expect(switchToChannel).toHaveBeenCalledTimes(1);
    });

    it('guide setting changes abort pending guide selection work and prevent stale tunes', async () => {
        let resolveSelection: (items: ResolvedContentItem[]) => void = () => undefined;
        let selectionSignal: AbortSignal | null | undefined;
        const resolveChannelItemsForSchedule = jest
            .fn<Promise<ResolvedChannelContent['items']>, [string, { signal?: AbortSignal | null }?]>()
            .mockImplementation(
                (_channelId, options) => new Promise<ResolvedChannelContent['items']>((resolve) => {
                    selectionSignal = options?.signal;
                    resolveSelection = resolve;
                })
            );
        const switchToChannel = jest.fn().mockResolvedValue(undefined);
        const { deps, epg } = makeDeps({
            switchToChannel,
            getChannelManager: () => ({
                ...(makeDeps().deps.getChannelManager() as IChannelManager),
                resolveChannelItemsForSchedule,
            } as IChannelManager),
        });
        const coordinator = new EPGCoordinator(deps);
        jest.spyOn(Date, 'now').mockReturnValue(5_000);

        coordinator.wireEpgEvents();
        const handler = (epg.on as jest.Mock).mock.calls.find((call) => call[0] === 'channelSelected')?.[1];

        handler?.({
            channel: makeChannel('c0', 1),
            program: {
                ...baseProgram('c0', 0),
                scheduledStartTime: 4_000,
                scheduledEndTime: 6_000,
            } as ScheduledProgram,
        });
        await flushPromises();

        coordinator.handleGuideSettingChange({ key: 'guideDensity', density: 'wide' });
        resolveSelection(makeResolvedItems('c0'));
        await flushPromises();

        expect(selectionSignal).toBeDefined();
        expect(selectionSignal?.aborted).toBe(true);
        expect(switchToChannel).not.toHaveBeenCalled();
    });

    it('library filter changes abort pending guide selection work and prevent stale tunes', async () => {
        let resolveSelection: (items: ResolvedContentItem[]) => void = () => undefined;
        let selectionSignal: AbortSignal | null | undefined;
        const resolveChannelItemsForSchedule = jest
            .fn<Promise<ResolvedChannelContent['items']>, [string, { signal?: AbortSignal | null }?]>()
            .mockImplementation(
                (_channelId, options) => new Promise<ResolvedChannelContent['items']>((resolve) => {
                    selectionSignal = options?.signal;
                    resolveSelection = resolve;
                })
            );
        const switchToChannel = jest.fn().mockResolvedValue(undefined);
        const { deps, epg } = makeDeps({
            switchToChannel,
            getChannelManager: () => ({
                ...(makeDeps().deps.getChannelManager() as IChannelManager),
                resolveChannelItemsForSchedule,
            } as IChannelManager),
        });
        const coordinator = new EPGCoordinator(deps);
        jest.spyOn(Date, 'now').mockReturnValue(5_000);

        coordinator.wireEpgEvents();
        const handler = (epg.on as jest.Mock).mock.calls.find((call) => call[0] === 'channelSelected')?.[1];
        const filterHandler = (epg.on as jest.Mock).mock.calls.find((call) => call[0] === 'libraryFilterChanged')?.[1];

        handler?.({
            channel: makeChannel('c0', 1),
            program: {
                ...baseProgram('c0', 0),
                scheduledStartTime: 4_000,
                scheduledEndTime: 6_000,
            } as ScheduledProgram,
        });
        await flushPromises();

        filterHandler?.({ libraryId: 'lib-1' });
        resolveSelection(makeResolvedItems('c0'));
        await flushPromises();

        expect(selectionSignal).toBeDefined();
        expect(selectionSignal?.aborted).toBe(true);
        expect(switchToChannel).not.toHaveBeenCalled();
    });

    it('library filter change clears schedules, primes, and refreshes', async () => {
        const { deps, epg } = makeDeps();
        const coordinator = new EPGCoordinator(deps);
        (epg.isVisible as jest.Mock).mockReturnValue(true);

        coordinator.wireEpgEvents();

        const filterHandler = (epg.on as jest.Mock).mock.calls.find((call) => call[0] === 'libraryFilterChanged')?.[1];
        filterHandler?.({ libraryId: 'lib1' });
        await flushPromises();

        expect(epg.clearSchedules).toHaveBeenCalled();
        expect(epg.loadChannels).toHaveBeenCalled();
        expect(epg.scrollToChannel).toHaveBeenCalledWith(0);
        expect(epg.focusChannel).toHaveBeenCalledWith(0);
        expect(epg.loadScheduleForChannel).toHaveBeenCalled();
    });

    it('handleVisibleRangeChange delegates refresh with visible-range reason', async () => {
        const { deps, epg } = makeDeps();
        const coordinator = new EPGCoordinator(deps);
        const refreshSpy = jest
            .spyOn(coordinator, 'refreshEpgSchedulesForRange')
            .mockResolvedValue(undefined);
        const range = {
            channelStart: 1,
            channelEnd: 4,
            timeStartMs: 1000,
            timeEndMs: 2000,
        };

        (epg.isVisible as jest.Mock).mockReturnValue(true);

        coordinator.handleVisibleRangeChange(range);
        await flushPromises();

        expect(refreshSpy).toHaveBeenCalledWith(range, { reason: 'visible-range' });
    });

    it('handleVisibleRangeChange does not enqueue refresh work when the guide is hidden', async () => {
        const { deps, epg } = makeDeps();
        const coordinator = new EPGCoordinator(deps);
        const refreshSpy = jest
            .spyOn(coordinator, 'refreshEpgSchedulesForRange')
            .mockResolvedValue(undefined);
        const range = {
            channelStart: 1,
            channelEnd: 4,
            timeStartMs: 1000,
            timeEndMs: 2000,
        };

        (epg.isVisible as jest.Mock).mockReturnValue(false);

        coordinator.handleVisibleRangeChange(range);
        await flushPromises();

        expect(refreshSpy).not.toHaveBeenCalled();
    });

    it('handleGuideSettingChange delegates guide-setting policy when EPG is visible', () => {
        const { deps, epg } = makeDeps();
        const coordinator = new EPGCoordinator(deps);
        (epg.isVisible as jest.Mock).mockReturnValue(true);

        coordinator.handleGuideSettingChange({ key: 'aggressivePreload', enabled: true });

        expect(epg.clearSchedules).toHaveBeenCalledTimes(1);
    });

    it('handleGuideSettingChange refreshes schedules after invalidation when EPG is visible', async () => {
        const { deps, epg } = makeDeps();
        const coordinator = new EPGCoordinator(deps);
        (epg.isVisible as jest.Mock).mockReturnValue(true);

        coordinator.handleGuideSettingChange({ key: 'aggressivePreload', enabled: true });
        await flushPromises();

        expect(epg.clearSchedules).toHaveBeenCalledTimes(1);
        expect(epg.loadChannels).toHaveBeenCalled();
        expect(epg.loadScheduleForChannel).toHaveBeenCalled();
    });

    it('handleGuideSettingChange invalidates guideDensity changes before visible refresh', async () => {
        const { deps, epg } = makeDeps();
        const coordinator = new EPGCoordinator(deps);
        (epg.isVisible as jest.Mock).mockReturnValue(true);

        coordinator.handleGuideSettingChange({ key: 'guideDensity', density: 'wide' });
        await flushPromises();

        expect(epg.clearSchedules).toHaveBeenCalledTimes(1);
        expect(epg.loadChannels).toHaveBeenCalled();
        expect(epg.loadScheduleForChannel).toHaveBeenCalled();
    });

        it('handleGuideSettingChange still invalidates cached schedules while the guide is hidden', async () => {
            const { deps, epg } = makeDeps();
            const coordinator = new EPGCoordinator(deps);
            (epg.isVisible as jest.Mock).mockReturnValue(false);

            coordinator.handleGuideSettingChange({ key: 'aggressivePreload', enabled: true });
            await flushPromises();

            expect(epg.clearSchedules).toHaveBeenCalledTimes(1);
            expect(epg.loadChannels).not.toHaveBeenCalled();
            expect(epg.loadScheduleForChannel).not.toHaveBeenCalled();
        });

        it('handleGuideSettingChange cancels queued and in-flight schedule work even when EPG is unmounted', () => {
            const { deps, epg } = makeDeps({
                getEpg: () => null,
            });
            const coordinator = new EPGCoordinator(deps);

            coordinator.handleGuideSettingChange({ key: 'aggressivePreload', enabled: true });

            expect(epg.clearSchedules).not.toHaveBeenCalled();
        });
    });
