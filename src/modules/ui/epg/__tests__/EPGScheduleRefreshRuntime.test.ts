import { EPGScheduleRefreshRuntime, type EPGScheduleRefreshRuntimeDeps } from '../EPGScheduleRefreshRuntime';
import type {
    ChannelConfig,
    IChannelManager,
    PlaybackMode,
    ResolvedChannelContent,
} from '../../../scheduler/channel-manager';
import type { IChannelScheduler, ScheduleConfig, ScheduleWindow } from '../../../scheduler/scheduler';
import type { IEPGComponent } from '../interfaces';
import { LINEUP_STORAGE_KEYS } from '../../../../config/storageKeys';

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

const createResolvedContent = (channelId: string): ResolvedChannelContent => {
    const items = makeResolvedItems(channelId);
    return {
        channelId,
        resolvedAt: Date.now(),
        items,
        totalDurationMs: items.reduce((sum, item) => sum + item.durationMs, 0),
        orderedItems: [...items],
    };
};

const createLocalStorageMock = (): Storage => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string): string | null => (
            Object.prototype.hasOwnProperty.call(store, key) ? (store[key] ?? null) : null
        ),
        setItem: (key: string, value: string): void => {
            store[key] = String(value);
        },
        removeItem: (key: string): void => {
            delete store[key];
        },
        clear: (): void => {
            store = {};
        },
        key: (index: number): string | null => Object.keys(store)[index] ?? null,
        get length(): number {
            return Object.keys(store).length;
        },
    } as Storage;
};

const createRuntime = (
    overrides: Partial<EPGScheduleRefreshRuntimeDeps> & {
        channelManager?: Partial<IChannelManager>;
        epg?: Partial<IEPGComponent>;
    } = {}
): {
    runtime: EPGScheduleRefreshRuntime;
    deps: EPGScheduleRefreshRuntimeDeps;
    epg: IEPGComponent;
    channelManager: IChannelManager;
} => {
    const channel = makeChannel('c1', 1);

    const epg: IEPGComponent = {
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
        setGridAnchorTime: jest.fn(),
        loadScheduleForChannel: jest.fn(),
        getFocusedProgram: jest.fn().mockReturnValue(null),
        isVisible: jest.fn().mockReturnValue(true),
        focusNow: jest.fn(),
    } as unknown as IEPGComponent;

    const channelManager: IChannelManager = {
        getAllChannels: jest.fn(() => [channel]),
        getCurrentChannel: jest.fn(() => null),
        resolveChannelContent: jest.fn(async (channelId: string) => ({
            ...createResolvedContent(channelId),
        })),
        resolveChannelItemsForSchedule: jest.fn(async (channelId: string) => makeResolvedItems(channelId)),
    } as unknown as IChannelManager;

    const scheduler: IChannelScheduler = {
        getState: jest.fn(() => ({ isActive: false, channelId: null })),
        getScheduleWindow: jest.fn((): ScheduleWindow => ({
            startTime: 0,
            endTime: 60_000,
            programs: [],
        })),
    } as unknown as IChannelScheduler;

    const deps: EPGScheduleRefreshRuntimeDeps = {
        getEpg: () => epg,
        getChannelManager: () => channelManager,
        getScheduler: () => scheduler,
        getEpgUiStatus: () => 'ready',
        getEpgScheduleRangeMs: () => ({ startTime: 0, endTime: 60_000 }),
        getLibraryFilterState: () => ({ selectedId: null, shouldFilter: false }),
        getVisibleChannels: (all) => all,
        buildDailyScheduleConfig: (
            selectedChannel: ChannelConfig,
            items: ResolvedChannelContent['items']
        ): ScheduleConfig =>
            ({
                channelId: selectedChannel.id,
                anchorTime: 0,
                content: items,
                playbackMode: 'loop' as PlaybackMode,
                shuffleSeed: 1,
                loopSchedule: true,
            } satisfies ScheduleConfig),
        computeScheduleCacheLimit: () => 64,
        getScheduleLoadConcurrency: () => 1,
        cloneScheduleWindow: (window: ScheduleWindow): ScheduleWindow => ({
            ...window,
            programs: [...window.programs],
        }),
        isAggressivePreloadEnabled: () => false,
        isDebugEnabled: () => false,
        appendDebugLog: jest.fn(),
        ...(overrides as Partial<EPGScheduleRefreshRuntimeDeps>),
    };

    Object.assign(epg, overrides.epg);
    Object.assign(channelManager, overrides.channelManager);

    return {
        runtime: new EPGScheduleRefreshRuntime(deps),
        deps,
        epg,
        channelManager,
    };
};

describe('EPGScheduleRefreshRuntime', () => {
    beforeEach(() => {
        if (!globalThis.localStorage) {
            (globalThis as { localStorage?: Storage }).localStorage = createLocalStorageMock();
        }
        localStorage.clear();
    });

    it('threads server-swap into the aggressive-dependent branches', async () => {
        const computeScheduleCacheLimit = jest.fn(() => 64);
        const getScheduleLoadConcurrency = jest.fn(() => 1);
        const { runtime } = createRuntime({
            isAggressivePreloadEnabled: () => false,
            computeScheduleCacheLimit,
            getScheduleLoadConcurrency,
        });

        await runtime.refreshForRange(
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );
        expect(computeScheduleCacheLimit).toHaveBeenLastCalledWith(1, false);
        expect(getScheduleLoadConcurrency).toHaveBeenLastCalledWith(1, expect.any(Number), false);

        await runtime.refreshForRange(
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'server-swap'
        );
        expect(computeScheduleCacheLimit).toHaveBeenLastCalledWith(1, true);
        expect(getScheduleLoadConcurrency).toHaveBeenLastCalledWith(1, expect.any(Number), true);
    });

    it('records schedule source diagnostics for immediate UI-applied rows when debug logging is enabled', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, '1');
        const { runtime } = createRuntime();

        await runtime.refreshForRange(
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        const stored = JSON.parse(
            localStorage.getItem(LINEUP_STORAGE_KEYS.ISSUE_DIAGNOSTICS_LOG) as string
        ) as Array<{ event: string; data: { source?: string } }>;
        expect(stored).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    event: 'epg.scheduleApplied',
                    data: expect.objectContaining({
                        source: 'resolved-immediate',
                    }),
                }),
            ])
        );
    });

    it('aborts stale in-flight loads when a force-refresh request arrives', async () => {
        const channel = makeChannel('c1', 1);
        const deferred = {
            promise: null as Promise<ResolvedChannelContent> | null,
            reject: null as ((reason?: unknown) => void) | null,
        };
        let firstRequestAborted = false;
        let callCount = 0;

        deferred.promise = new Promise<ResolvedChannelContent>((_resolve, reject) => {
            deferred.reject = reject;
        });

        const { runtime, channelManager, epg } = createRuntime({
            channelManager: {
                getAllChannels: jest.fn(() => [channel]),
                resolveChannelContent: jest.fn((_id: string, options?: { signal?: AbortSignal | null }) => {
                    callCount += 1;
                    if (callCount === 1) {
                        options?.signal?.addEventListener('abort', () => {
                            firstRequestAborted = true;
                            deferred.reject?.(new DOMException('Aborted', 'AbortError'));
                        });
                        return deferred.promise as Promise<ResolvedChannelContent>;
                    }
                    return Promise.resolve(createResolvedContent(channel.id));
                }),
            },
        });

        const firstRefresh = runtime.refreshForRange(
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );
        await Promise.resolve();

        const secondRefresh = runtime.refreshForRange(
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'server-swap'
        );
        await Promise.allSettled([firstRefresh, secondRefresh]);

        expect(firstRequestAborted).toBe(true);
        expect((channelManager.resolveChannelContent as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(epg.loadScheduleForChannel).toHaveBeenCalled();
    });

    it('skips duplicate schedule loads for channels already loaded in range', async () => {
        const { runtime, channelManager } = createRuntime();

        await runtime.refreshForRange(
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );
        await runtime.refreshForRange(
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(channelManager.resolveChannelContent).toHaveBeenCalledTimes(1);
    });
});
