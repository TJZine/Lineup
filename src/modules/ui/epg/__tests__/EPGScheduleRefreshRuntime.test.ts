import { EPGScheduleRefreshRuntime, type EPGScheduleRefreshRuntimeDeps } from '../runtime/EPGScheduleRefreshRuntime';
import { ChannelManager } from '../../../scheduler/channel-manager';
import type {
    ChannelConfig,
    IChannelManager,
    PlaybackMode,
    ResolvedChannelContent,
} from '../../../scheduler/channel-manager';
import type { PlexMediaItemMinimal } from '../../../scheduler/channel-manager/contracts/interfaces';
import {
    createMockItem,
    createMockLibrary,
} from '../../../scheduler/channel-manager/__tests__/channel-manager-test-helpers';
import type { IChannelScheduler, ScheduleConfig, ScheduleWindow } from '../../../scheduler/scheduler';
import type { IEPGComponent } from '../interfaces';
import type {
    EpgHeldScheduleSnapshot,
    EpgRowLifecycleState,
    ScheduleWindow as EpgScheduleWindow,
    EpgScheduleLoadMetadata,
} from '../types';
import { isMatchingEpgChannelSnapshot } from '../types';
import { createEpgRetainedOperationContext } from '../runtime/EPGRetainedOperationContext';
import type { EpgRetainedOperationContext } from '../runtime/EPGRetainedOperationContext';
import {
    EPG_SCHEDULE_CACHE_STALE_TTL_MS,
    EPG_SCHEDULE_CACHE_TTL_MS,
} from '../runtime/EPGScheduleCacheStore';
import { createDeferred } from '../../../../__tests__/helpers';
import {
    installMockLocalStorage,
    resetMockLocalStorage,
    restoreOriginalLocalStorage,
} from '../../../../__tests__/mocks/localStorage';

installMockLocalStorage();

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

const createScheduleWindow = (channelId: string): ScheduleWindow => ({
    startTime: 0,
    endTime: 60_000,
    programs: [
        {
            item: makeResolvedItems(channelId)[0]!,
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
                endChannelIndexExclusive: 0,
            },
            currentTime: 0,
        }),
        setGridAnchorTime: jest.fn(),
        loadScheduleForChannel: jest.fn(),
        hasScheduleForChannelRange: jest.fn().mockReturnValue(false),
        getHeldScheduleForChannel: jest.fn().mockReturnValue(null),
        clearScheduleForChannel: jest.fn(),
        getRowLifecycle: jest.fn().mockReturnValue(null),
        setRowLifecycle: jest.fn(),
        clearRowLifecycle: jest.fn(),
        clearAllRowLifecycles: jest.fn(),
        getFocusedProgram: jest.fn().mockReturnValue(null),
        isVisible: jest.fn().mockReturnValue(true),
        focusNow: jest.fn(),
    } as unknown as IEPGComponent;

    const channelManager: IChannelManager = {
        getAllChannels: jest.fn(() => [channel]),
        getChannel: jest.fn((channelId: string) => (channelId === channel.id ? channel : null)),
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
                playbackMode: 'sequential',
                shuffleSeed: 1,
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
        appendIssueDiagnostic: jest.fn(),
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

const settleBackgroundRefresh = async (runtime: EPGScheduleRefreshRuntime): Promise<void> => {
    const idle = runtime.whenBackgroundRefreshIdle();
    await jest.runAllTimersAsync();
    await idle;
};

const collectDiagnosticKeys = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.flatMap(collectDiagnosticKeys);
    }
    if (typeof value !== 'object' || value === null) {
        return [];
    }
    return Object.entries(value).flatMap(([key, nested]) => [key, ...collectDiagnosticKeys(nested)]);
};

describe('EPGScheduleRefreshRuntime', () => {
    beforeEach(() => {
        resetMockLocalStorage();
    });

    afterAll(() => {
        restoreOriginalLocalStorage();
    });

    it('uses a deterministic schedule identity for equivalent sources and all schedule inputs', () => {
        const source = {
            type: 'library' as const,
            libraryId: 'library-1',
            libraryType: 'movie' as const,
            includeWatched: false,
            libraryFilter: { year: 2024, rating: 'PG' },
        };
        const base: ChannelConfig = {
            ...makeChannel('identity', 1),
            contentSource: source,
            sourceLibraryId: 'library-1',
            playbackMode: 'shuffle',
            shuffleSeed: 7,
            blockSize: 2,
            phaseSeed: 3,
            startTimeAnchor: 10,
            contentFilters: [{ field: 'year', operator: 'gte', value: 2020 }],
            sortOrder: 'title_asc',
            skipIntros: false,
            skipCredits: false,
            maxEpisodeRunTimeMs: 3_600_000,
            minEpisodeRunTimeMs: 600_000,
            updatedAt: 42,
        };
        const reorderedSource: ChannelConfig = {
            ...base,
            contentSource: {
                type: 'library',
                libraryId: 'library-1',
                libraryType: 'movie',
                includeWatched: false,
                libraryFilter: { rating: 'PG', year: 2024 },
            },
        };

        expect(isMatchingEpgChannelSnapshot(base, reorderedSource)).toBe(true);

        const variants: Array<[string, (channel: ChannelConfig) => ChannelConfig]> = [
            ['contentSource', (channel: ChannelConfig): ChannelConfig => ({
                ...channel,
                contentSource: { ...source, libraryId: 'library-2' },
            })],
            ['playbackMode', (channel: ChannelConfig): ChannelConfig => ({ ...channel, playbackMode: 'sequential' })],
            ['shuffleSeed', (channel: ChannelConfig): ChannelConfig => ({ ...channel, shuffleSeed: 8 })],
            ['phaseSeed', (channel: ChannelConfig): ChannelConfig => ({ ...channel, phaseSeed: 4 })],
            ['blockSize', (channel: ChannelConfig): ChannelConfig => ({ ...channel, blockSize: 3 })],
            ['startTimeAnchor', (channel: ChannelConfig): ChannelConfig => ({ ...channel, startTimeAnchor: 11 })],
            ['contentFilters', (channel: ChannelConfig): ChannelConfig => ({
                ...channel,
                contentFilters: [{ field: 'year', operator: 'gte', value: 2021 }],
            })],
            ['sortOrder', (channel: ChannelConfig): ChannelConfig => ({ ...channel, sortOrder: 'title_desc' })],
            ['skipIntros', (channel: ChannelConfig): ChannelConfig => ({ ...channel, skipIntros: true })],
            ['skipCredits', (channel: ChannelConfig): ChannelConfig => ({ ...channel, skipCredits: true })],
            ['maxEpisodeRunTimeMs', (channel: ChannelConfig): ChannelConfig => ({ ...channel, maxEpisodeRunTimeMs: 3_600_001 })],
            ['minEpisodeRunTimeMs', (channel: ChannelConfig): ChannelConfig => ({ ...channel, minEpisodeRunTimeMs: 600_001 })],
        ];

        for (const [, makeVariant] of variants) {
            expect(isMatchingEpgChannelSnapshot(base, makeVariant(base))).toBe(false);
        }
    });

    it('does not renew the originating loadedAt across stale cache republishes and failures', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(0);
        try {
            const channel = makeChannel('c1', 1);
            let heldSchedule: EpgHeldScheduleSnapshot | null = null;
            const loadScheduleForChannel = jest.fn((
                _channelId: string,
                schedule: EpgScheduleWindow,
                metadata?: EpgScheduleLoadMetadata
            ) => {
                heldSchedule = {
                    schedule,
                    loadedAt: metadata?.loadedAt ?? Date.now(),
                    channelSnapshot: metadata?.channelSnapshot ?? channel,
                };
            });
            const { runtime, epg, channelManager } = createRuntime({
                epg: {
                    getHeldScheduleForChannel: jest.fn(() => heldSchedule),
                    loadScheduleForChannel,
                    clearScheduleForChannel: jest.fn(() => {
                        heldSchedule = null;
                    }),
                },
                channelManager: {
                    getAllChannels: jest.fn(() => [channel]),
                    getChannel: jest.fn((channelId: string) => (channelId === channel.id ? channel : null)),
                },
            });
            const range = { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 };

            await runtime.refreshForRange(range, 'visible-range');
            expect((heldSchedule as EpgHeldScheduleSnapshot | null)?.loadedAt).toBe(0);
            runtime.clearLoadedScheduleMarkers();

            (channelManager.resolveChannelContent as jest.Mock).mockRejectedValueOnce(new Error('first failure'));
            jest.setSystemTime(EPG_SCHEDULE_CACHE_TTL_MS + 1);
            await runtime.refreshForRange(range, 'visible-range');
            expect((heldSchedule as EpgHeldScheduleSnapshot | null)?.loadedAt).toBe(0);

            (channelManager.resolveChannelContent as jest.Mock).mockRejectedValueOnce(new Error('second failure'));
            jest.setSystemTime(6 * 60_000);
            await runtime.refreshForRange(range, 'visible-range');
            expect((heldSchedule as EpgHeldScheduleSnapshot | null)?.loadedAt).toBe(0);
            expect(loadScheduleForChannel.mock.calls.slice(1).map(([, , metadata]) => metadata?.loadedAt))
                .toEqual([0, 0]);

            (channelManager.resolveChannelContent as jest.Mock).mockRejectedValueOnce(new Error('expired failure'));
            jest.setSystemTime(EPG_SCHEDULE_CACHE_STALE_TTL_MS + 1);
            const result = await runtime.refreshForRange(range, 'visible-range');

            expect(heldSchedule).toBeNull();
            expect(epg.clearScheduleForChannel).toHaveBeenCalledWith(channel.id);
            expect(epg.setRowLifecycle).toHaveBeenCalledWith(
                channel.id,
                expect.objectContaining({ kind: 'unavailable' })
            );
            expect(result.readiness).toBe('failed');
        } finally {
            jest.useRealTimers();
        }
    });

    const createObservedRetainedOperation = (
        assertCurrent: () => void
    ): {
        operationContext: EpgRetainedOperationContext;
        release: jest.Mock;
        dispose(): void;
    } => {
        const root = createEpgRetainedOperationContext([]);
        const release = jest.fn();
        const retained: EpgRetainedOperationContext = {
            authority: root.authority,
            signal: root.signal,
            assertCurrent,
            retain: (label): EpgRetainedOperationContext => root.retain(label),
            release,
        };
        return {
            operationContext: {
                ...root,
                retain: (): EpgRetainedOperationContext => retained,
            },
            release,
            dispose: (): void => root.release(),
        };
    };

    it('allows the selected-channel snapshot to be cleared before one exists', () => {
        const { runtime } = createRuntime();

        expect(() => runtime.clearSelectedChannelScheduleSnapshot()).not.toThrow();
    });

    it('releases retained authority when pre-session validation fails', async () => {
        const reason = new DOMException('refresh authority superseded', 'AbortError');
        const observed = createObservedRetainedOperation(() => { throw reason; });
        const { runtime } = createRuntime();

        try {
            await expect(runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
                'server-swap',
                { operationContext: observed.operationContext }
            )).rejects.toBe(reason);
            expect(observed.release).toHaveBeenCalledTimes(1);
        } finally {
            observed.dispose();
        }
    });

    it('releases retained authority when refresh-session construction fails', async () => {
        const reason = new Error('EPG dependency failed');
        const observed = createObservedRetainedOperation(() => undefined);
        const { runtime } = createRuntime({
            getEpg: (): never => { throw reason; },
        });

        try {
            await expect(runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
                'server-swap',
                { operationContext: observed.operationContext }
            )).rejects.toBe(reason);
            expect(observed.release).toHaveBeenCalledTimes(1);
        } finally {
            observed.dispose();
        }
    });

    it('releases retained authority when abort-listener cleanup throws', async () => {
        const cleanupError = new Error('listener cleanup failed');
        const caller = new AbortController();
        const remove = jest.spyOn(caller.signal, 'removeEventListener')
            .mockImplementation(() => { throw cleanupError; });
        const observed = createObservedRetainedOperation(() => undefined);
        const { runtime } = createRuntime();

        try {
            await expect(runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
                'server-swap',
                {
                    signal: caller.signal,
                    operationContext: observed.operationContext,
                }
            )).rejects.toBe(cleanupError);
            expect(observed.release).toHaveBeenCalledTimes(1);
        } finally {
            remove.mockRestore();
            observed.dispose();
        }
    });

    it('makes the stateful publication suffix inert when transaction authority is superseded', async () => {
        const authorityController = new AbortController();
        const superseded = new DOMException('server transaction superseded', 'AbortError');
        const operation = createEpgRetainedOperationContext([{
            signal: authorityController.signal,
            assertCurrent: (): void => {
                if (authorityController.signal.aborted) throw authorityController.signal.reason;
            },
        }]);
        let resolveContent: ((value: ResolvedChannelContent) => void) | null = null;
        let contentSignal: AbortSignal | null = null;
        const { runtime, epg, deps } = createRuntime({
            channelManager: {
                resolveChannelContent: jest.fn((_channelId, options) => new Promise<ResolvedChannelContent>((resolve) => {
                    contentSignal = options?.signal ?? null;
                    resolveContent = resolve;
                })),
            },
        });

        const refresh = runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'server-swap',
            { operationContext: operation }
        );
        await Promise.resolve();
        authorityController.abort(superseded);
        expect((contentSignal as AbortSignal | null)?.aborted).toBe(true);
        (resolveContent as unknown as (value: ResolvedChannelContent) => void)(createResolvedContent('c1'));

        await expect(refresh).rejects.toBe(superseded);
        expect(epg.loadScheduleForChannel).not.toHaveBeenCalled();
        expect(deps.appendIssueDiagnostic).not.toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleApplied',
            expect.anything()
        );
        operation.release();
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
            { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );
        expect(computeScheduleCacheLimit).toHaveBeenLastCalledWith(1, false);
        expect(getScheduleLoadConcurrency).toHaveBeenLastCalledWith(1, expect.any(Number), false);

        await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'server-swap'
        );
        expect(computeScheduleCacheLimit).toHaveBeenLastCalledWith(1, true);
        expect(getScheduleLoadConcurrency).toHaveBeenLastCalledWith(1, expect.any(Number), true);
    });

    it('records a bounded sanitized lifecycle for a successful visible row', async () => {
        const { runtime, deps } = createRuntime({ isDebugEnabled: () => true });

        await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleRow.requestStarted',
            expect.objectContaining({
                refreshId: 1,
                phase: 'immediate',
                rowOrdinal: 0,
                attemptCount: 1,
                cacheOutcome: 'miss',
            })
        );
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleRefresh.settled',
            expect.objectContaining({
                visibleChannelCount: 1,
                immediateReadyChannelCount: 1,
                resolutionAttemptCount: 1,
                focusKind: 'absent',
            })
        );
        expect(deps.appendIssueDiagnostic).not.toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleRow.settled',
            expect.anything()
        );
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledTimes(4);

        const diagnosticJson = JSON.stringify((deps.appendIssueDiagnostic as jest.Mock).mock.calls);
        const debugJson = JSON.stringify((deps.appendDebugLog as jest.Mock).mock.calls);
        expect(diagnosticJson).not.toContain('c1');
        expect(diagnosticJson).not.toContain('Channel 1');
        expect(diagnosticJson).not.toContain('c1-program');
        expect(diagnosticJson).not.toContain('c1-0');
        expect(debugJson).not.toContain('c1');
        expect(debugJson).not.toContain('Channel 1');
        expect(debugJson).not.toContain('c1-program');
        expect(debugJson).not.toContain('c1-0');
        const diagnosticKeys = collectDiagnosticKeys(
            (deps.appendIssueDiagnostic as jest.Mock).mock.calls.map((call) => call[2])
        );
        expect(diagnosticKeys).toEqual(expect.not.arrayContaining([
            'channelId',
            'channelName',
            'title',
            'fullTitle',
            'ratingKey',
            'token',
            'url',
            'headers',
            'rangeKey',
            'safeError',
            'error',
            'message',
        ]));
    });

    it('counts stale cache plus fresh resolution as one ready immediate channel', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(0);
        try {
            const { runtime, epg } = createRuntime();
            await runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );

            runtime.clearLoadedScheduleMarkers();
            jest.setSystemTime(3 * 60_000);
            const result = await runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );

            expect(result).toEqual({
                readiness: 'ready',
                attemptedChannelCount: 1,
                immediateReadyChannelCount: 1,
                backgroundQueuedChannelCount: 0,
                failedChannelCount: 0,
                staleCacheChannelCount: 1,
                firstVisibleScheduleReady: true,
            });
            expect(epg.loadScheduleForChannel).toHaveBeenCalledTimes(3);
        } finally {
            jest.useRealTimers();
        }
    });

    it('reports background warm queue batch failures through issue diagnostics', async () => {
        jest.useFakeTimers();
        const idleScheduler = globalThis as unknown as {
            requestIdleCallback?: typeof globalThis.requestIdleCallback;
            cancelIdleCallback?: typeof globalThis.cancelIdleCallback;
        };
        const priorRequestIdleCallback = idleScheduler.requestIdleCallback;
        const priorCancelIdleCallback = idleScheduler.cancelIdleCallback;
        try {
            delete idleScheduler.requestIdleCallback;
            delete idleScheduler.cancelIdleCallback;

            const channels = Array.from({ length: 20 }, (_, index) => makeChannel(`c${index + 1}`, index + 1));
            const cloneFailure = new Error('cache clone failed');
            let failCachedClone = false;
            const { runtime, deps } = createRuntime({
                isDebugEnabled: () => true,
                channelManager: {
                    getAllChannels: jest.fn(() => channels),
                    getChannel: jest.fn((channelId: string) => (
                        channels.find((channel) => channel.id === channelId) ?? null
                    )),
                    resolveChannelContent: jest.fn(async (channelId: string) => createResolvedContent(channelId)),
                    resolveChannelItemsForSchedule: jest.fn(async (channelId: string) => makeResolvedItems(channelId)),
                },
                getScheduleLoadConcurrency: () => 1,
                cloneScheduleWindow: (window: ScheduleWindow): ScheduleWindow => {
                    if (failCachedClone && window.programs[0]?.item.ratingKey === 'c8-0') {
                        throw cloneFailure;
                    }
                    return { ...window, programs: [...window.programs] };
                },
            });

            await runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );

            await settleBackgroundRefresh(runtime);

            runtime.clearLoadedScheduleMarkers();
            (deps.appendIssueDiagnostic as jest.Mock).mockClear();
            failCachedClone = true;

            await runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );

            await settleBackgroundRefresh(runtime);

            expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
                'QA-003b',
                'epg.scheduleRow.settled',
                expect.objectContaining({
                    rowOrdinal: 7,
                    phase: 'background',
                    resolutionStarted: false,
                    status: 'failure',
                    cacheOutcome: 'fresh-hit',
                    attemptCount: 0,
                    failureStage: 'cache',
                    errorKind: 'non-abort',
                })
            );
            expect(JSON.stringify([
                ...(deps.appendIssueDiagnostic as jest.Mock).mock.calls,
                ...(deps.appendDebugLog as jest.Mock).mock.calls,
            ])).not.toContain('cache clone failed');
        } finally {
            jest.useRealTimers();
            if (priorRequestIdleCallback) {
                idleScheduler.requestIdleCallback = priorRequestIdleCallback;
            } else {
                delete idleScheduler.requestIdleCallback;
            }
            if (priorCancelIdleCallback) {
                idleScheduler.cancelIdleCallback = priorCancelIdleCallback;
            } else {
                delete idleScheduler.cancelIdleCallback;
            }
        }
    });

    it('reports immediate schedule load failures through issue diagnostics', async () => {
        const channel = makeChannel('c1', 1);
        const failure = new Error('resolve failed');
        const { runtime, deps } = createRuntime({
            isDebugEnabled: () => true,
            channelManager: {
                getAllChannels: jest.fn(() => [channel]),
                getChannel: jest.fn((channelId: string) => (channelId === channel.id ? channel : null)),
                resolveChannelContent: jest.fn(async () => {
                    throw failure;
                }),
            },
        });

        const result = await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(result).toEqual({
            readiness: 'failed',
            attemptedChannelCount: 1,
            immediateReadyChannelCount: 0,
            backgroundQueuedChannelCount: 0,
            failedChannelCount: 1,
            staleCacheChannelCount: 0,
            firstVisibleScheduleReady: false,
        });
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleRow.settled',
            expect.objectContaining({
                rowOrdinal: 0,
                phase: 'immediate',
                attemptCount: 1,
                resolutionStarted: true,
                status: 'failure',
                cacheOutcome: 'miss',
                failureStage: 'resolution',
                errorKind: 'non-abort',
                failure: expect.objectContaining({
                    errorClass: 'Error',
                    errorCode: null,
                }),
            })
        );
        expect(JSON.stringify([
            ...(deps.appendIssueDiagnostic as jest.Mock).mock.calls,
            ...(deps.appendDebugLog as jest.Mock).mock.calls,
        ])).not.toContain('resolve failed');
    });

    it('classifies a live-scheduler failure before cache or network work', async () => {
        const channel = makeChannel('c1', 1);
        const { runtime, deps } = createRuntime({
            channelManager: {
                getAllChannels: jest.fn(() => [channel]),
                getCurrentChannel: jest.fn(() => channel),
            },
            getScheduler: () => ({
                getState: jest.fn(() => ({ isActive: true, channelId: channel.id })),
                getScheduleWindow: jest.fn(() => createScheduleWindow(channel.id)),
            } as unknown as IChannelScheduler),
            cloneScheduleWindow: (): never => {
                throw new Error('live clone failed');
            },
        });

        await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleRow.settled',
            expect.objectContaining({
                rowOrdinal: 0,
                attemptCount: 0,
                resolutionStarted: false,
                cacheOutcome: 'not-checked',
                failureStage: 'live-scheduler',
            })
        );
    });

    it('classifies a cached schedule UI publication failure without a network attempt', async () => {
        const { runtime, deps, epg } = createRuntime();
        const range = { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 };
        await runtime.refreshForRange(range, 'visible-range');
        runtime.clearLoadedScheduleMarkers();
        (epg.loadScheduleForChannel as jest.Mock).mockImplementation(() => {
            throw new Error('publication failed');
        });

        await runtime.refreshForRange(range, 'visible-range');

        expect(deps.appendIssueDiagnostic).toHaveBeenLastCalledWith(
            'QA-003b',
            'epg.scheduleRefresh.settled',
            expect.anything()
        );
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleRow.settled',
            expect.objectContaining({
                rowOrdinal: 0,
                attemptCount: 0,
                resolutionStarted: false,
                cacheOutcome: 'fresh-hit',
                failureStage: 'publication',
            })
        );
    });

    it('returns partial readiness when only some immediate channel schedules load', async () => {
        const first = makeChannel('c1', 1);
        const second = makeChannel('c2', 2);
        const { runtime } = createRuntime({
            channelManager: {
                getAllChannels: jest.fn(() => [first, second]),
                getChannel: jest.fn((channelId: string) => (
                    channelId === first.id ? first : channelId === second.id ? second : null
                )),
                resolveChannelContent: jest.fn(async (channelId: string) => {
                    if (channelId === second.id) {
                        throw new Error('second failed');
                    }
                    return createResolvedContent(channelId);
                }),
            },
            epg: {
                getState: jest.fn().mockReturnValue({
                    isVisible: true,
                    focusedCell: null,
                    scrollPosition: { channelOffset: 0, timeOffset: 0 },
                    viewWindow: {
                        startTime: 0,
                        endTime: 60_000,
                        startChannelIndex: 0,
                        endChannelIndexExclusive: 1,
                    },
                    currentTime: 0,
                }),
            },
        });

        const result = await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(result).toEqual({
            readiness: 'partial',
            attemptedChannelCount: 2,
            immediateReadyChannelCount: 1,
            backgroundQueuedChannelCount: 0,
            failedChannelCount: 1,
            staleCacheChannelCount: 0,
            firstVisibleScheduleReady: true,
        });
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
            { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );
        await Promise.resolve();

        const secondRefresh = runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'server-swap'
        );
        await Promise.allSettled([firstRefresh, secondRefresh]);

        expect(firstRequestAborted).toBe(true);
        expect((channelManager.resolveChannelContent as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(epg.loadScheduleForChannel).toHaveBeenCalled();
    });

    it('aborts caller-canceled server-swap refreshes before schedules are applied', async () => {
        const abortReason = new DOMException('server selection hidden', 'AbortError');
        const controller = new AbortController();
        let capturedSignal: AbortSignal | null | undefined;
        let resolveContent: ((value: ResolvedChannelContent) => void) | null = null;
        const { runtime, channelManager, epg, deps } = createRuntime({
            channelManager: {
                resolveChannelContent: jest.fn((_id: string, options?: { signal?: AbortSignal | null }) => {
                    capturedSignal = options?.signal;
                    return new Promise<ResolvedChannelContent>((resolve) => {
                        resolveContent = resolve;
                    });
                }),
            },
        });

        const refresh = runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'server-swap',
            { signal: controller.signal }
        );
        await Promise.resolve();

        expect(capturedSignal?.aborted).toBe(false);
        controller.abort(abortReason);
        (resolveContent as unknown as (value: ResolvedChannelContent) => void)(createResolvedContent('c1'));

        await expect(refresh).rejects.toBe(abortReason);
        expect(capturedSignal?.aborted).toBe(true);
        expect(epg.loadScheduleForChannel).not.toHaveBeenCalled();
        expect(deps.appendIssueDiagnostic).not.toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleApplied',
            expect.anything()
        );
        expect(channelManager.resolveChannelContent).toHaveBeenCalledTimes(1);
    });

    it('ignores a stale external abort after a newer refresh session owns the active token', async () => {
        jest.useFakeTimers();
        const firstController = new AbortController();
        const firstAbortReason = new DOMException('stale caller canceled', 'AbortError');
        let resolveFirst: ((value: ResolvedChannelContent) => void) | null = null;
        let resolveSecond: ((value: ResolvedChannelContent) => void) | null = null;
        let firstLoadSignal: AbortSignal | null = null;
        let secondLoadSignal: AbortSignal | null = null;
        let callCount = 0;
        const channels = Array.from({ length: 20 }, (_, index) => makeChannel(`c${index + 1}`, index + 1));
        const resolveChannelItemsForSchedule = jest.fn(async (channelId: string) => makeResolvedItems(channelId));
        const { runtime, epg, deps } = createRuntime({
            isDebugEnabled: () => true,
            epg: {
                getState: jest.fn().mockReturnValue({
                    isVisible: true,
                    focusedCell: { kind: 'placeholder', channelIndex: 0 },
                    scrollPosition: { channelOffset: 0, timeOffset: 0 },
                    viewWindow: {
                        startTime: 0,
                        endTime: 60_000,
                        startChannelIndex: 0,
                        endChannelIndexExclusive: 1,
                    },
                    currentTime: 0,
                }),
            },
            channelManager: {
                getAllChannels: jest.fn(() => channels),
                getChannel: jest.fn((channelId: string) => (
                    channels.find((channel) => channel.id === channelId) ?? null
                )),
                resolveChannelContent: jest.fn((channelId: string, options?: { signal?: AbortSignal | null }) => {
                    callCount += 1;
                    if (callCount > 2) {
                        return Promise.resolve(createResolvedContent(channelId));
                    }
                    return new Promise<ResolvedChannelContent>((resolve) => {
                        if (callCount === 1) {
                            firstLoadSignal = options?.signal ?? null;
                            resolveFirst = resolve;
                            return;
                        }
                        secondLoadSignal = options?.signal ?? null;
                        resolveSecond = resolve;
                    });
                }),
                resolveChannelItemsForSchedule,
            },
        });
        try {
            const firstRefresh = runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range',
                { signal: firstController.signal }
            );
            await Promise.resolve();

            const secondRefresh = runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
                'server-swap'
            );
            await Promise.resolve();

            expect((firstLoadSignal as AbortSignal | null)?.aborted).toBe(true);
            expect((secondLoadSignal as AbortSignal | null)?.aborted).toBe(false);

            firstController.abort(firstAbortReason);

            expect((secondLoadSignal as AbortSignal | null)?.aborted).toBe(false);
            (resolveSecond as unknown as (value: ResolvedChannelContent) => void)(createResolvedContent('c1'));

            await expect(secondRefresh).resolves.toEqual(expect.objectContaining({
                readiness: 'ready',
                immediateReadyChannelCount: 9,
                backgroundQueuedChannelCount: 11,
                firstVisibleScheduleReady: true,
            }));
            expect(epg.loadScheduleForChannel).toHaveBeenCalledWith('c1', expect.any(Object));

            const snapshot = await runtime.buildGuideSelectionSnapshot({
                channelId: 'c1',
                ratingKey: 'c1-0',
                scheduledStartTime: 0,
                scheduledEndTime: 60_000,
                selectedAt: Date.now(),
            });
            expect(snapshot?.source).toBe('resolved-immediate');

            await settleBackgroundRefresh(runtime);
            expect(resolveChannelItemsForSchedule).toHaveBeenCalledWith('c10', expect.anything());
            expect(deps.appendDebugLog).toHaveBeenCalledWith(
                'EPG.refreshEpgSchedulesForRange.background',
                expect.objectContaining({ refreshId: 2 })
            );
            expect((secondLoadSignal as AbortSignal | null)?.aborted).toBe(false);

            (resolveFirst as unknown as (value: ResolvedChannelContent) => void)(createResolvedContent('c1'));
            await expect(firstRefresh).rejects.toBe(firstAbortReason);
        } finally {
            jest.useRealTimers();
        }
    });

    it('records caller invalidation but suppresses a later non-abort settlement', async () => {
        const abortReason = new DOMException('server selection hidden', 'AbortError');
        const loadError = new Error('resolver failed after abort');
        const controller = new AbortController();
        let rejectContent: ((reason?: unknown) => void) | null = null;
        const { runtime, deps } = createRuntime({
            channelManager: {
                resolveChannelContent: jest.fn(() =>
                    new Promise<ResolvedChannelContent>((_resolve, reject) => {
                        rejectContent = reject;
                    })
                ),
            },
        });

        const refresh = runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
            'server-swap',
            { signal: controller.signal }
        );
        await Promise.resolve();

        controller.abort(abortReason);
        (rejectContent as unknown as (reason?: unknown) => void)(loadError);

        await expect(refresh).rejects.toBe(abortReason);
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleRow.invalidated',
            expect.objectContaining({
                refreshId: 1,
                rowOrdinal: 0,
                resolutionStarted: true,
                invalidation: 'caller-abort',
            })
        );
        expect(JSON.stringify((deps.appendIssueDiagnostic as jest.Mock).mock.calls))
            .not.toContain('resolver failed after abort');
    });

    it('suppresses a delayed non-abort failure after a newer refresh takes ownership', async () => {
        let signalFirstLoadStarted: () => void = () => undefined;
        let signalSecondLoadStarted: () => void = () => undefined;
        const firstLoadStarted = new Promise<void>((resolve) => {
            signalFirstLoadStarted = resolve;
        });
        const secondLoadStarted = new Promise<void>((resolve) => {
            signalSecondLoadStarted = resolve;
        });
        const pendingLoads: Array<{
            resolve: (value: ResolvedChannelContent) => void;
            reject: (reason?: unknown) => void;
            signal: AbortSignal | null | undefined;
        }> = [];
        const staleFailure = new Error('late stale resolver failure');
        const { runtime, deps } = createRuntime({
            isDebugEnabled: () => true,
            channelManager: {
                resolveChannelContent: jest.fn(
                    (_channelId: string, options?: { signal?: AbortSignal | null }) =>
                        new Promise<ResolvedChannelContent>((resolve, reject) => {
                            pendingLoads.push({ resolve, reject, signal: options?.signal });
                            if (pendingLoads.length === 1) {
                                signalFirstLoadStarted();
                            } else if (pendingLoads.length === 2) {
                                signalSecondLoadStarted();
                            }
                        })
                ),
            },
        });

        const firstRefresh = runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );
        await firstLoadStarted;

        const secondRefresh = runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 60_000, timeEndMs: 120_000 },
            'visible-range'
        );
        await secondLoadStarted;

        expect(pendingLoads[0]?.signal?.aborted).toBe(true);
        pendingLoads[0]?.reject(staleFailure);
        pendingLoads[1]?.resolve(createResolvedContent('c1'));

        await expect(firstRefresh).resolves.toEqual(expect.objectContaining({
            readiness: 'superseded',
            failedChannelCount: 0,
        }));
        await expect(secondRefresh).resolves.toEqual(expect.objectContaining({
            readiness: 'ready',
            failedChannelCount: 0,
        }));
        expect(deps.appendDebugLog).not.toHaveBeenCalledWith(
            'EPG.refreshEpgSchedulesForRange.channelLoad.error',
            expect.anything()
        );
        expect(deps.appendIssueDiagnostic).not.toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleRow.settled',
            expect.objectContaining({ refreshId: 1, status: 'failure' })
        );
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleRow.invalidated',
            expect.objectContaining({
                refreshId: 1,
                rowOrdinal: 0,
                invalidation: 'newer-session',
            })
        );
    });

    it('revokes caller-cancellation failure publication when a newer refresh starts', async () => {
        const callerController = new AbortController();
        const callerAbortReason = new DOMException('caller canceled', 'AbortError');
        const firstLoad = createDeferred<ResolvedChannelContent>();
        const secondLoad = createDeferred<ResolvedChannelContent>();
        const { runtime, deps } = createRuntime({
            isDebugEnabled: () => true,
            channelManager: {
                resolveChannelContent: jest.fn()
                    .mockReturnValueOnce(firstLoad.promise)
                    .mockReturnValueOnce(secondLoad.promise),
            },
        });

        const firstRefresh = runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range',
            { signal: callerController.signal }
        );
        await Promise.resolve();
        callerController.abort(callerAbortReason);

        const secondRefresh = runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 60_000, timeEndMs: 120_000 },
            'visible-range'
        );
        await Promise.resolve();

        firstLoad.reject(new Error('late failure after caller cancellation'));
        secondLoad.resolve(createResolvedContent('c1'));

        await expect(firstRefresh).rejects.toBe(callerAbortReason);
        await expect(secondRefresh).resolves.toEqual(expect.objectContaining({
            readiness: 'ready',
            failedChannelCount: 0,
        }));
        expect(deps.appendDebugLog).not.toHaveBeenCalledWith(
            'EPG.refreshEpgSchedulesForRange.channelLoad.error',
            expect.anything()
        );
        expect(deps.appendIssueDiagnostic).not.toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleLoadFailed',
            expect.anything()
        );
    });

    it('suppresses channel load failures caused by the internal invalidation abort reason', async () => {
        const controller = new AbortController();
        let capturedSignal: AbortSignal | null | undefined;
        let rejectContent: ((reason?: unknown) => void) | null = null;
        const { runtime, deps } = createRuntime({
            channelManager: {
                resolveChannelContent: jest.fn((_id: string, options?: { signal?: AbortSignal | null }) => {
                    capturedSignal = options?.signal;
                    return new Promise<ResolvedChannelContent>((_resolve, reject) => {
                        rejectContent = reject;
                    });
                }),
            },
        });

        const refresh = runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'server-swap',
            { signal: controller.signal }
        );
        await Promise.resolve();

        controller.abort(new DOMException('server selection hidden', 'AbortError'));
        (rejectContent as unknown as (reason?: unknown) => void)(capturedSignal?.reason);

        await expect(refresh).rejects.toThrow('server selection hidden');
        expect(deps.appendIssueDiagnostic).not.toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleLoadFailed',
            expect.anything()
        );
    });

    it('invalidates in-flight refresh work when no visible channels remain', async () => {
        const channel = makeChannel('c1', 1);
        let visibleChannels: ChannelConfig[] = [channel];
        let resolveFirstRequest: ((value: ResolvedChannelContent) => void) | null = null;

        const { runtime, epg } = createRuntime({
            channelManager: {
                getAllChannels: jest.fn(() => [channel]),
                getChannel: jest.fn((channelId: string) => (channelId === channel.id ? channel : null)),
                resolveChannelContent: jest.fn(async () => new Promise<ResolvedChannelContent>((resolve) => {
                    resolveFirstRequest = resolve;
                })),
            },
            getVisibleChannels: () => visibleChannels,
        });

        const firstRefresh = runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );
        await Promise.resolve();

        visibleChannels = [];
        await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        if (!resolveFirstRequest) {
            throw new Error('Expected the first refresh request to remain in flight');
        }
        const releaseFirstRequest = resolveFirstRequest as (value: ResolvedChannelContent) => void;
        releaseFirstRequest(createResolvedContent(channel.id));
        await firstRefresh;

        expect(epg.loadScheduleForChannel).not.toHaveBeenCalled();
    });

    it('skips duplicate schedule loads for channels already loaded in range', async () => {
        const { runtime, channelManager } = createRuntime();

        await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );
        await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(channelManager.resolveChannelContent).toHaveBeenCalledTimes(1);
    });

    it('counts already-loaded visible channels as ready refresh results', async () => {
        const { runtime } = createRuntime();

        await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );
        const result = await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(result).toEqual({
            readiness: 'ready',
            attemptedChannelCount: 1,
            immediateReadyChannelCount: 1,
            backgroundQueuedChannelCount: 0,
            failedChannelCount: 0,
            staleCacheChannelCount: 0,
            firstVisibleScheduleReady: true,
        });
    });

    it.each([
        {
            label: 'same-range',
            nextRange: { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
        },
        {
            label: 'different-range',
            nextRange: { channelStart: 0, channelEndExclusive: 1, timeStartMs: 60_000, timeEndMs: 120_000 },
        },
    ])('reports a superseded $label load and only applies the current schedule', async ({ nextRange }) => {
        let signalFirstLoadStarted: () => void = () => undefined;
        let signalSecondLoadStarted: () => void = () => undefined;
        const firstLoadStarted = new Promise<void>((resolve) => {
            signalFirstLoadStarted = resolve;
        });
        const secondLoadStarted = new Promise<void>((resolve) => {
            signalSecondLoadStarted = resolve;
        });
        const pendingLoads: Array<{
            resolve: (value: ResolvedChannelContent) => void;
            signal: AbortSignal | null | undefined;
        }> = [];
        const { runtime, channelManager, epg } = createRuntime({
            channelManager: {
                resolveChannelContent: jest.fn((_channelId: string, options?: { signal?: AbortSignal | null }) =>
                    new Promise<ResolvedChannelContent>((resolve, reject) => {
                        pendingLoads.push({ resolve, signal: options?.signal });
                        if (pendingLoads.length === 1) {
                            signalFirstLoadStarted();
                        } else if (pendingLoads.length === 2) {
                            signalSecondLoadStarted();
                        }
                        options?.signal?.addEventListener('abort', () => {
                            reject(new DOMException('Superseded', 'AbortError'));
                        }, { once: true });
                    })
                ),
            },
        });

        const firstRefresh = runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );
        await firstLoadStarted;
        const secondRefresh = runtime.refreshForRange(
            nextRange,
            'visible-range'
        );
        await secondLoadStarted;

        expect(channelManager.resolveChannelContent).toHaveBeenCalledTimes(2);
        expect(pendingLoads).toHaveLength(2);
        expect(pendingLoads[0]?.signal?.aborted).toBe(true);
        expect(epg.loadScheduleForChannel).not.toHaveBeenCalled();
        expect(epg.focusNow).not.toHaveBeenCalled();

        const firstResult = await firstRefresh;
        expect(firstResult).toEqual({
            readiness: 'superseded',
            attemptedChannelCount: 0,
            immediateReadyChannelCount: 0,
            backgroundQueuedChannelCount: 0,
            failedChannelCount: 0,
            staleCacheChannelCount: 0,
            firstVisibleScheduleReady: false,
        });
        expect(epg.loadScheduleForChannel).not.toHaveBeenCalled();

        pendingLoads[1]?.resolve(createResolvedContent('c1'));
        const currentResult = await secondRefresh;

        expect(currentResult).toEqual({
            readiness: 'ready',
            attemptedChannelCount: 1,
            immediateReadyChannelCount: 1,
            backgroundQueuedChannelCount: 0,
            failedChannelCount: 0,
            staleCacheChannelCount: 0,
            firstVisibleScheduleReady: true,
        });
        expect(epg.loadScheduleForChannel).toHaveBeenCalledTimes(1);
        expect(epg.focusNow).toHaveBeenCalledTimes(1);

        await runtime.refreshForRange(
            nextRange,
            'visible-range'
        );
        expect(channelManager.resolveChannelContent).toHaveBeenCalledTimes(2);
        expect(epg.loadScheduleForChannel).toHaveBeenCalledTimes(1);
    });

    it('does not apply schedules or refocus after aborting an active refresh', async () => {
        let runtimeUnderTest: EPGScheduleRefreshRuntime | null = null;
        const { runtime, epg, deps } = createRuntime({
            buildDailyScheduleConfig: (
                selectedChannel: ChannelConfig,
                items: ResolvedChannelContent['items']
            ): ScheduleConfig => {
                runtimeUnderTest?.abortAllInFlightSchedules('shutdown');
                return {
                    channelId: selectedChannel.id,
                    anchorTime: 0,
                    content: items,
                    playbackMode: 'sequential',
                    shuffleSeed: 1,
                };
            },
        });
        runtimeUnderTest = runtime;

        await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(epg.loadScheduleForChannel).not.toHaveBeenCalled();
        expect(epg.focusNow).not.toHaveBeenCalled();
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleRow.invalidated',
            expect.objectContaining({ invalidation: 'shutdown' })
        );
    });

    it('uses resolved-immediate selected-row seed as a one-shot handoff', async () => {
        const now = new Date('2026-03-20T12:00:00-04:00').getTime();
        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
        const resolveChannelItemsForSchedule = jest.fn(async (channelId: string) => makeResolvedItems(channelId));
        const { runtime } = createRuntime({
            channelManager: {
                resolveChannelItemsForSchedule,
            },
            epg: {
                getState: jest.fn().mockReturnValue({
                    isVisible: true,
                    focusedCell: {
                        kind: 'program',
                        channelIndex: 0,
                        programIndex: 0,
                        program: null,
                        focusTimeMs: 0,
                        cellElement: null,
                    },
                    scrollPosition: { channelOffset: 0, timeOffset: 0 },
                    viewWindow: {
                        startTime: 0,
                        endTime: 60_000,
                        startChannelIndex: 0,
                        endChannelIndexExclusive: 0,
                    },
                    currentTime: 0,
                }),
            },
        });
        try {
            await runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );

            const snapshotRequest = {
                channelId: 'c1',
                ratingKey: 'c1-0',
                scheduledStartTime: 0,
                scheduledEndTime: 60_000,
                selectedAt: now,
            };

            const firstSnapshot = await runtime.buildGuideSelectionSnapshot(snapshotRequest);
            const secondSnapshot = await runtime.buildGuideSelectionSnapshot(snapshotRequest);

            expect(firstSnapshot?.source).toBe('resolved-immediate');
            expect(secondSnapshot?.source).toBe('on-demand-materialized');
            expect(resolveChannelItemsForSchedule).toHaveBeenCalledTimes(1);
            expect(resolveChannelItemsForSchedule).toHaveBeenCalledWith('c1', { signal: null });
        } finally {
            nowSpy.mockRestore();
        }
    });

    it('threads an AbortSignal through on-demand guide snapshot materialization', async () => {
        const capturedSignals: Array<AbortSignal | null | undefined> = [];
        const resolveChannelItemsForSchedule = jest.fn(async (_channelId: string, options?: { signal?: AbortSignal | null }) => {
            capturedSignals.push(options?.signal);
            return makeResolvedItems('c1');
        });
        const { runtime } = createRuntime({
            channelManager: {
                resolveChannelItemsForSchedule,
            },
        });
        const controller = new AbortController();

        const snapshot = await runtime.buildGuideSelectionSnapshot({
            channelId: 'c1',
            ratingKey: 'c1-0',
            scheduledStartTime: 0,
            scheduledEndTime: 60_000,
            selectedAt: 1_000,
        }, controller.signal);

        expect(snapshot?.source).toBe('on-demand-materialized');
        expect(capturedSignals).toHaveLength(1);
        expect(capturedSignals[0]).toBe(controller.signal);
    });

    it('returns null when on-demand guide snapshot materialization is aborted', async () => {
        const resolveChannelItemsForSchedule = jest.fn(async () => {
            throw new DOMException('Aborted', 'AbortError');
        });
        const { runtime } = createRuntime({
            channelManager: {
                resolveChannelItemsForSchedule,
            },
        });
        const controller = new AbortController();

        const snapshot = await runtime.buildGuideSelectionSnapshot({
            channelId: 'c1',
            ratingKey: 'c1-0',
            scheduledStartTime: 0,
            scheduledEndTime: 60_000,
            selectedAt: 1_000,
        }, controller.signal);

        expect(snapshot).toBeNull();
    });

    it('uses current wall-clock time for focused-row seed day key and reference time', async () => {
        const now = new Date('2026-03-20T00:05:00-04:00').getTime();
        const priorDayRangeStart = new Date('2026-03-19T23:00:00-04:00').getTime();
        const rangeEnd = new Date('2026-03-20T01:00:00-04:00').getTime();
        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
        const resolveChannelItemsForSchedule = jest.fn(async (channelId: string) => makeResolvedItems(channelId));
        const { runtime } = createRuntime({
            getEpgScheduleRangeMs: () => ({ startTime: priorDayRangeStart, endTime: rangeEnd }),
            channelManager: {
                resolveChannelItemsForSchedule,
            },
            epg: {
                getState: jest.fn().mockReturnValue({
                    isVisible: true,
                    focusedCell: {
                        kind: 'program',
                        channelIndex: 0,
                        programIndex: 0,
                        program: null,
                        focusTimeMs: now,
                        cellElement: null,
                    },
                    scrollPosition: { channelOffset: 0, timeOffset: 0 },
                    viewWindow: {
                        startTime: priorDayRangeStart,
                        endTime: rangeEnd,
                        startChannelIndex: 0,
                        endChannelIndexExclusive: 0,
                    },
                    currentTime: now,
                }),
            },
        });

        try {
            await runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 0, timeStartMs: priorDayRangeStart, timeEndMs: rangeEnd },
                'visible-range'
            );

            const snapshot = await runtime.buildGuideSelectionSnapshot({
                channelId: 'c1',
                ratingKey: 'c1-0',
                scheduledStartTime: priorDayRangeStart,
                scheduledEndTime: rangeEnd,
                selectedAt: now,
            });

            expect(snapshot?.source).toBe('resolved-immediate');
            expect(snapshot?.referenceTimeMs).toBe(now);
            const expectedDate = new Date(now);
            const expectedDayKey =
                (expectedDate.getFullYear() * 10000) +
                ((expectedDate.getMonth() + 1) * 100) +
                expectedDate.getDate();
            expect(snapshot?.dayKey).toBe(expectedDayKey);
            expect(resolveChannelItemsForSchedule).not.toHaveBeenCalled();
        } finally {
            nowSpy.mockRestore();
        }
    });

    it('retains the focused-row seed when a mismatched snapshot request does not use it', async () => {
        const now = new Date('2026-03-20T12:00:00-04:00').getTime();
        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
        const channels = [makeChannel('c1', 1), makeChannel('c2', 2)];
        const resolveChannelItemsForSchedule = jest.fn(async (channelId: string) => makeResolvedItems(channelId));
        const { runtime } = createRuntime({
            channelManager: {
                getAllChannels: jest.fn(() => channels),
                getChannel: jest.fn((channelId: string) => (
                    channels.find((channel) => channel.id === channelId) ?? null
                )),
                resolveChannelItemsForSchedule,
            },
            epg: {
                getState: jest.fn().mockReturnValue({
                    isVisible: true,
                    focusedCell: {
                        kind: 'program',
                        channelIndex: 0,
                        programIndex: 0,
                        program: null,
                        focusTimeMs: 0,
                        cellElement: null,
                    },
                    scrollPosition: { channelOffset: 0, timeOffset: 0 },
                    viewWindow: {
                        startTime: 0,
                        endTime: 60_000,
                        startChannelIndex: 0,
                        endChannelIndexExclusive: 1,
                    },
                    currentTime: 0,
                }),
            },
        });
        try {
            await runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );

            const mismatchSnapshot = await runtime.buildGuideSelectionSnapshot({
                channelId: 'c2',
                ratingKey: 'c2-0',
                scheduledStartTime: 0,
                scheduledEndTime: 60_000,
                selectedAt: now,
            });
            const focusedSnapshot = await runtime.buildGuideSelectionSnapshot({
                channelId: 'c1',
                ratingKey: 'c1-0',
                scheduledStartTime: 0,
                scheduledEndTime: 60_000,
                selectedAt: now,
            });

            expect(mismatchSnapshot?.source).toBe('on-demand-materialized');
            expect(focusedSnapshot?.source).toBe('resolved-immediate');
            expect(resolveChannelItemsForSchedule).toHaveBeenCalledTimes(1);
            expect(resolveChannelItemsForSchedule).toHaveBeenCalledWith('c2', { signal: null });
        } finally {
            nowSpy.mockRestore();
        }
    });

    it('does not retain resolved-immediate seeds for non-focused immediate rows', async () => {
        const channels = [makeChannel('c1', 1), makeChannel('c2', 2), makeChannel('c3', 3)];
        const resolveChannelItemsForSchedule = jest.fn(async (channelId: string) => makeResolvedItems(channelId));
        const { runtime } = createRuntime({
            channelManager: {
                getAllChannels: jest.fn(() => channels),
                getChannel: jest.fn((channelId: string) => (
                    channels.find((channel) => channel.id === channelId) ?? null
                )),
                resolveChannelItemsForSchedule,
            },
            epg: {
                getState: jest.fn().mockReturnValue({
                    isVisible: true,
                    focusedCell: {
                        kind: 'program',
                        channelIndex: 0,
                        programIndex: 0,
                        program: null,
                        focusTimeMs: 0,
                        cellElement: null,
                    },
                    scrollPosition: { channelOffset: 0, timeOffset: 0 },
                    viewWindow: {
                        startTime: 0,
                        endTime: 60_000,
                        startChannelIndex: 0,
                        endChannelIndexExclusive: 2,
                    },
                    currentTime: 0,
                }),
            },
        });

        await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 2, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        const snapshot = await runtime.buildGuideSelectionSnapshot({
            channelId: 'c2',
            ratingKey: 'c2-0',
            scheduledStartTime: 0,
            scheduledEndTime: 60_000,
            selectedAt: 1_000,
        });

        expect(snapshot?.source).toBe('on-demand-materialized');
        expect(resolveChannelItemsForSchedule).toHaveBeenCalledWith('c2', { signal: null });
    });

    it('does not retain background preload rows as selected-row snapshot seeds', async () => {
        const channels = Array.from({ length: 20 }, (_, index) => makeChannel(`c${index + 1}`, index + 1));
        const resolveChannelContent = jest.fn(async (channelId: string) => createResolvedContent(channelId));
        const resolveChannelItemsForSchedule = jest.fn(async (channelId: string) => makeResolvedItems(channelId));
        const { runtime } = createRuntime({
            channelManager: {
                getAllChannels: jest.fn(() => channels),
                getChannel: jest.fn((channelId: string) => (
                    channels.find((channel) => channel.id === channelId) ?? null
                )),
                resolveChannelContent,
                resolveChannelItemsForSchedule,
            },
            getScheduleLoadConcurrency: () => 1,
        });

        await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        const snapshot = await runtime.buildGuideSelectionSnapshot({
            channelId: 'c20',
            ratingKey: 'c20-0',
            scheduledStartTime: 0,
            scheduledEndTime: 60_000,
            selectedAt: 1_000,
        });

        expect(snapshot?.source).toBe('on-demand-materialized');
        expect(resolveChannelItemsForSchedule).toHaveBeenCalledWith('c20', { signal: null });
    });

    it('prefers the live scheduler over the loaded-range short-circuit for the active live channel', async () => {
        const channel = makeChannel('c1', 1);
        const liveSchedule: ScheduleWindow = {
            startTime: 0,
            endTime: 60_000,
            programs: [
                {
                    ...createScheduleWindow(channel.id).programs[0]!,
                    item: {
                        ...makeResolvedItems(channel.id)[0]!,
                        ratingKey: 'live-program',
                    },
                },
            ],
        };
        const schedulerState = { isActive: false, channelId: null as string | null };
        const scheduler = {
            getState: jest.fn(() => schedulerState),
            getScheduleWindow: jest.fn(() => liveSchedule),
        } as unknown as IChannelScheduler;

        const { runtime, deps, epg } = createRuntime({
            channelManager: {
                getAllChannels: jest.fn(() => [channel]),
                getChannel: jest.fn((channelId: string) => (channelId === channel.id ? channel : null)),
                getCurrentChannel: jest.fn(() => channel),
            },
            getScheduler: () => scheduler,
        });

        await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );
        (deps.appendIssueDiagnostic as jest.Mock).mockClear();
        (epg.loadScheduleForChannel as jest.Mock).mockClear();
        schedulerState.isActive = true;
        schedulerState.channelId = channel.id;

        await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleRefresh.settled',
            expect.objectContaining({ liveSchedulerHitCount: 1 })
        );
        expect(epg.loadScheduleForChannel).toHaveBeenCalledTimes(1);
    });

    it('does not let a live-scheduler apply mark the row loaded for a later non-live refresh', async () => {
        const channel = makeChannel('c1', 1);
        const liveSchedule: ScheduleWindow = {
            startTime: 0,
            endTime: 60_000,
            programs: [
                {
                    ...createScheduleWindow(channel.id).programs[0]!,
                    item: {
                        ...makeResolvedItems(channel.id)[0]!,
                        ratingKey: 'live-program',
                    },
                },
            ],
        };
        const schedulerState: { isActive: boolean; channelId: string | null } = { isActive: true, channelId: channel.id };
        const getScheduleWindow = jest.fn(() => liveSchedule);
        const resolveChannelContent = jest.fn(async (channelId: string) => createResolvedContent(channelId));
        const { runtime, deps, epg } = createRuntime({
            channelManager: {
                getAllChannels: jest.fn(() => [channel]),
                getChannel: jest.fn((channelId: string) => (channelId === channel.id ? channel : null)),
                getCurrentChannel: jest.fn(() => channel),
                resolveChannelContent,
            },
            getScheduler: () => ({
                getState: jest.fn(() => schedulerState),
                getScheduleWindow,
            } as unknown as IChannelScheduler),
        });

        await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        schedulerState.isActive = false;
        schedulerState.channelId = null;
        (deps.appendIssueDiagnostic as jest.Mock).mockClear();
        (epg.loadScheduleForChannel as jest.Mock).mockClear();
        resolveChannelContent.mockClear();

        await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(resolveChannelContent).toHaveBeenCalledTimes(1);
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleRefresh.settled',
            expect.objectContaining({ resolutionAttemptCount: 1 })
        );
        expect(epg.loadScheduleForChannel).toHaveBeenCalledTimes(1);
        expect(getScheduleWindow).toHaveBeenCalledTimes(1);
    });

    it('publishes an unavailable row when the current immediate attempt settles unsuccessfully', async () => {
        const channel = makeChannel('c1', 1);
        const { runtime, epg } = createRuntime({
            channelManager: {
                getAllChannels: jest.fn(() => [channel]),
                getChannel: jest.fn((channelId: string) => (channelId === channel.id ? channel : null)),
                resolveChannelContent: jest.fn(async () => {
                    throw new Error('schedule resolution failed');
                }),
            },
        });

        const result = await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(result.failedChannelCount).toBe(1);
        expect(epg.loadScheduleForChannel).not.toHaveBeenCalled();
        expect(epg.setRowLifecycle).toHaveBeenCalledWith('c1', {
            kind: 'unavailable',
            rangeKey: '0-60000',
        });
        expect(JSON.stringify((epg.setRowLifecycle as jest.Mock).mock.calls)).not.toContain('c1-0');
    });

    it('does not automatically retry a same-range unavailable row on reopen or scroll', async () => {
        const channel = makeChannel('c1', 1);
        let lifecycle: EpgRowLifecycleState | null = null;
        const resolveChannelContent = jest.fn(async () => {
            throw new Error('schedule resolution failed');
        });
        const { runtime, epg } = createRuntime({
            epg: {
                getRowLifecycle: jest.fn(() => lifecycle),
                setRowLifecycle: jest.fn((_channelId: string, next: EpgRowLifecycleState) => {
                    lifecycle = next;
                }),
                clearRowLifecycle: jest.fn((_channelId: string) => {
                    lifecycle = null;
                }),
            },
            channelManager: {
                getAllChannels: jest.fn(() => [channel]),
                getChannel: jest.fn((channelId: string) => (channelId === channel.id ? channel : null)),
                resolveChannelContent,
            },
        });

        await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );
        await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(resolveChannelContent).toHaveBeenCalledTimes(1);
        expect(epg.setRowLifecycle).toHaveBeenCalledTimes(1);
        expect(lifecycle).toEqual({ kind: 'unavailable', rangeKey: '0-60000' });
    });

    it('clears a mismatched terminal row before a new automatic attempt', async () => {
        const channel = makeChannel('c1', 1);
        let lifecycle: EpgRowLifecycleState | null = { kind: 'unavailable', rangeKey: 'old-range' };
        const resolveChannelContent = jest.fn(async (channelId: string) => createResolvedContent(channelId));
        const { runtime, epg } = createRuntime({
            epg: {
                getRowLifecycle: jest.fn(() => lifecycle),
                clearRowLifecycle: jest.fn((_channelId: string) => {
                    lifecycle = null;
                }),
            },
            channelManager: {
                getAllChannels: jest.fn(() => [channel]),
                getChannel: jest.fn((channelId: string) => (channelId === channel.id ? channel : null)),
                resolveChannelContent,
            },
        });

        await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(epg.clearRowLifecycle).toHaveBeenCalledWith('c1', 'old-range');
        expect(resolveChannelContent).toHaveBeenCalledTimes(1);
        expect(epg.loadScheduleForChannel).toHaveBeenCalledTimes(1);
    });

    it('reports all visible rows settled with ready and unavailable counts', async () => {
        const channels = [makeChannel('c1', 1), makeChannel('c2', 2)];
        const { runtime, deps } = createRuntime({
            channelManager: {
                getAllChannels: jest.fn(() => channels),
                getChannel: jest.fn((channelId: string) => channels.find((channel) => channel.id === channelId) ?? null),
                resolveChannelContent: jest.fn(async (channelId: string) => {
                    if (channelId === 'c2') {
                        throw new Error('second row failed');
                    }
                    return createResolvedContent(channelId);
                }),
            },
        });

        await runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 2, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleRefresh.settled',
            expect.objectContaining({
                allVisibleRowsSettledMs: expect.any(Number),
                visibleReadyChannelCount: 1,
                visibleUnavailableChannelCount: 1,
            })
        );
    });

    it('preserves a usable stale schedule instead of publishing unavailable on failed revalidation', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(0);
        try {
            const channel = makeChannel('c1', 1);
            let heldSchedule: EpgHeldScheduleSnapshot | null = null;
            const { runtime, epg, channelManager } = createRuntime({
                epg: {
                    getHeldScheduleForChannel: jest.fn(() => heldSchedule),
                    loadScheduleForChannel: jest.fn((_channelId: string, schedule: EpgScheduleWindow) => {
                        heldSchedule = { schedule, loadedAt: Date.now(), channelSnapshot: channel };
                    }),
                },
                channelManager: {
                    getAllChannels: jest.fn(() => [channel]),
                    getChannel: jest.fn((channelId: string) => (channelId === channel.id ? channel : null)),
                },
            });

            await runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );
            expect(epg.loadScheduleForChannel).toHaveBeenCalledTimes(1);

            runtime.clearLoadedScheduleMarkers();
            jest.setSystemTime(3 * 60_000);
            (channelManager.resolveChannelContent as jest.Mock).mockRejectedValueOnce(
                new Error('revalidation failed')
            );
            (epg.setRowLifecycle as jest.Mock).mockClear();

            const result = await runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );

            expect(result.staleCacheChannelCount).toBe(1);
            expect(epg.loadScheduleForChannel).toHaveBeenCalledTimes(2);
            expect(epg.setRowLifecycle).not.toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });

    it('reuses a fresh component-held schedule after reopen without re-resolving', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(0);
        try {
            const channel = makeChannel('c1', 1);
            let heldSchedule: EpgHeldScheduleSnapshot | null = null;
            const { runtime, epg, channelManager } = createRuntime({
                epg: {
                    getHeldScheduleForChannel: jest.fn(() => heldSchedule),
                    loadScheduleForChannel: jest.fn((_channelId: string, schedule: EpgScheduleWindow) => {
                        heldSchedule = { schedule, loadedAt: Date.now(), channelSnapshot: channel };
                    }),
                },
                channelManager: {
                    getAllChannels: jest.fn(() => [channel]),
                    getChannel: jest.fn((channelId: string) => (channelId === channel.id ? channel : null)),
                },
            });
            const range = { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 };

            await runtime.refreshForRange(range, 'visible-range');
            runtime.clearLoadedScheduleMarkers();
            jest.advanceTimersByTime(EPG_SCHEDULE_CACHE_TTL_MS - 1);
            (channelManager.resolveChannelContent as jest.Mock).mockClear();
            (epg.loadScheduleForChannel as jest.Mock).mockClear();

            const result = await runtime.refreshForRange(range, 'visible-range');

            expect(channelManager.resolveChannelContent).not.toHaveBeenCalled();
            expect(epg.loadScheduleForChannel).not.toHaveBeenCalled();
            expect(result).toEqual(expect.objectContaining({
                readiness: 'ready',
                immediateReadyChannelCount: 1,
            }));
        } finally {
            jest.useRealTimers();
        }
    });

    it('marks a stale held row ready before failed direct revalidation', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(0);
        try {
            const channel = makeChannel('c1', 1);
            let heldSchedule: EpgHeldScheduleSnapshot | null = null;
            const { runtime, epg, channelManager, deps } = createRuntime({
                epg: {
                    getHeldScheduleForChannel: jest.fn(() => heldSchedule),
                    loadScheduleForChannel: jest.fn((_channelId: string, schedule: EpgScheduleWindow) => {
                        heldSchedule = { schedule, loadedAt: Date.now(), channelSnapshot: channel };
                    }),
                },
                channelManager: {
                    getAllChannels: jest.fn(() => [channel]),
                    getChannel: jest.fn((channelId: string) => (channelId === channel.id ? channel : null)),
                },
                isDebugEnabled: () => true,
            });
            const range = { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 };

            await runtime.refreshForRange(range, 'visible-range');
            runtime.clearScheduleCaches();
            jest.advanceTimersByTime(EPG_SCHEDULE_CACHE_TTL_MS + 1);
            (channelManager.resolveChannelContent as jest.Mock).mockRejectedValueOnce(
                new Error('direct stale revalidation failed')
            );
            (epg.setRowLifecycle as jest.Mock).mockClear();
            (deps.appendIssueDiagnostic as jest.Mock).mockClear();

            const result = await runtime.refreshForRange(range, 'visible-range');
            const settled = (deps.appendIssueDiagnostic as jest.Mock).mock.calls.find(
                ([, event]) => event === 'epg.scheduleRefresh.settled'
            )?.[2] as Record<string, unknown> | undefined;

            expect(result.readiness).toBe('partial');
            expect(result.immediateReadyChannelCount).toBe(1);
            expect(epg.setRowLifecycle).not.toHaveBeenCalled();
            expect(settled).toEqual(expect.objectContaining({
                allVisibleRowsSettledMs: expect.any(Number),
                visibleReadyChannelCount: 1,
                visibleUnavailableChannelCount: 0,
            }));
        } finally {
            jest.useRealTimers();
        }
    });

    it('treats an expired held schedule as unusable and publishes unavailable on failure', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(0);
        try {
            const channel = makeChannel('c1', 1);
            let heldSchedule: EpgHeldScheduleSnapshot | null = null;
            const { runtime, epg, channelManager } = createRuntime({
                epg: {
                    getHeldScheduleForChannel: jest.fn(() => heldSchedule),
                    loadScheduleForChannel: jest.fn((_channelId: string, schedule: EpgScheduleWindow) => {
                        heldSchedule = { schedule, loadedAt: Date.now(), channelSnapshot: channel };
                    }),
                    clearScheduleForChannel: jest.fn(() => {
                        heldSchedule = null;
                    }),
                },
                channelManager: {
                    getAllChannels: jest.fn(() => [channel]),
                    getChannel: jest.fn((channelId: string) => (channelId === channel.id ? channel : null)),
                },
            });
            const range = { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 };

            await runtime.refreshForRange(range, 'visible-range');
            runtime.clearLoadedScheduleMarkers();
            jest.advanceTimersByTime(EPG_SCHEDULE_CACHE_STALE_TTL_MS + 1);
            (channelManager.resolveChannelContent as jest.Mock).mockRejectedValueOnce(
                new Error('expired revalidation failed')
            );
            (epg.setRowLifecycle as jest.Mock).mockClear();

            await runtime.refreshForRange(range, 'visible-range');

            expect(epg.clearScheduleForChannel).toHaveBeenCalledWith(channel.id);
            expect(heldSchedule).toBeNull();
            expect(epg.setRowLifecycle).toHaveBeenCalledWith(
                channel.id,
                expect.objectContaining({ kind: 'unavailable' })
            );
        } finally {
            jest.useRealTimers();
        }
    });

    it('rejects a same-ID source replacement and never preserves its old held schedule', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(0);
        try {
            const original = makeChannel('c1', 1);
            const replacement: ChannelConfig = {
                ...original,
                updatedAt: original.updatedAt + 1,
                contentSource: {
                    type: 'collection',
                    collectionKey: 'replacement-source',
                    collectionName: 'Replacement',
                },
            };
            let currentChannel = original;
            let heldSchedule: EpgHeldScheduleSnapshot | null = null;
            const { runtime, epg, channelManager } = createRuntime({
                epg: {
                    getHeldScheduleForChannel: jest.fn(() => heldSchedule),
                    loadScheduleForChannel: jest.fn((_channelId: string, schedule: EpgScheduleWindow) => {
                        heldSchedule = { schedule, loadedAt: Date.now(), channelSnapshot: currentChannel };
                    }),
                    clearScheduleForChannel: jest.fn(() => {
                        heldSchedule = null;
                    }),
                },
                channelManager: {
                    getAllChannels: jest.fn(() => [currentChannel]),
                    getChannel: jest.fn((channelId: string) => (
                        channelId === currentChannel.id ? currentChannel : null
                    )),
                },
            });
            const range = { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 };

            await runtime.refreshForRange(range, 'visible-range');
            runtime.clearLoadedScheduleMarkers();
            currentChannel = replacement;
            (channelManager.resolveChannelContent as jest.Mock).mockRejectedValueOnce(
                new Error('replacement source failed')
            );
            (epg.setRowLifecycle as jest.Mock).mockClear();

            await runtime.refreshForRange(range, 'visible-range');

            expect(epg.clearScheduleForChannel).toHaveBeenCalledWith(original.id);
            expect(heldSchedule).toBeNull();
            expect(epg.setRowLifecycle).toHaveBeenCalledWith(
                original.id,
                expect.objectContaining({ kind: 'unavailable' })
            );
        } finally {
            jest.useRealTimers();
        }
    });

    it('never publishes row state for hidden-only background failures', async () => {
        jest.useFakeTimers();
        const idleScheduler = globalThis as unknown as {
            requestIdleCallback?: typeof globalThis.requestIdleCallback;
            cancelIdleCallback?: typeof globalThis.cancelIdleCallback;
        };
        const priorRequestIdleCallback = idleScheduler.requestIdleCallback;
        const priorCancelIdleCallback = idleScheduler.cancelIdleCallback;
        try {
            delete idleScheduler.requestIdleCallback;
            delete idleScheduler.cancelIdleCallback;

            const channels = Array.from({ length: 20 }, (_, index) => makeChannel(`c${index + 1}`, index + 1));
            const { runtime, epg, deps } = createRuntime({
                isDebugEnabled: () => true,
                channelManager: {
                    getAllChannels: jest.fn(() => channels),
                    getChannel: jest.fn((channelId: string) => (
                        channels.find((channel) => channel.id === channelId) ?? null
                    )),
                    resolveChannelContent: jest.fn(async (channelId: string) => createResolvedContent(channelId)),
                    resolveChannelItemsForSchedule: jest.fn(async (channelId: string) => {
                        if (channelId === 'c8') {
                            throw new Error('hidden resolution failed');
                        }
                        return makeResolvedItems(channelId);
                    }),
                },
            });

            await runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );
            await settleBackgroundRefresh(runtime);

            expect(epg.setRowLifecycle).not.toHaveBeenCalled();
            expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
                'QA-003b',
                'epg.scheduleRow.settled',
                expect.objectContaining({
                    phase: 'background',
                    status: 'failure',
                    errorKind: 'non-abort',
                })
            );
        } finally {
            if (priorRequestIdleCallback) {
                idleScheduler.requestIdleCallback = priorRequestIdleCallback;
            }
            if (priorCancelIdleCallback) {
                idleScheduler.cancelIdleCallback = priorCancelIdleCallback;
            }
            jest.useRealTimers();
        }
    });

    it('publishes no stale unavailable after a caller-aborted attempt settles', async () => {
        const controller = new AbortController();
        const abortReason = new DOMException('caller went away', 'AbortError');
        let rejectContent!: (reason?: unknown) => void;
        const { runtime, epg } = createRuntime({
            channelManager: {
                resolveChannelContent: jest.fn(
                    () => new Promise<ResolvedChannelContent>((_resolve, reject) => {
                        rejectContent = reject;
                    })
                ),
            },
        });

        const refresh = runtime.refreshForRange(
            { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
            'server-swap',
            { signal: controller.signal }
        );
        await Promise.resolve();
        controller.abort(abortReason);
        rejectContent(new Error('late non-abort failure'));
        await refresh.then(
            () => undefined,
            () => undefined
        );

        expect(epg.loadScheduleForChannel).not.toHaveBeenCalled();
        expect(epg.setRowLifecycle).not.toHaveBeenCalled();
    });

    it('coalesces rapid targeted retries into one network attempt', async () => {
        const channel = makeChannel('c1', 1);
        let resolveContent!: (value: ResolvedChannelContent) => void;
        const resolveChannelContent = jest.fn(
            () => new Promise<ResolvedChannelContent>((resolve) => {
                resolveContent = resolve;
            })
        );
        const { runtime, epg } = createRuntime({
            channelManager: {
                getAllChannels: jest.fn(() => [channel]),
                getChannel: jest.fn((channelId: string) => (channelId === channel.id ? channel : null)),
                resolveChannelContent,
            },
        });

        const first = runtime.retryChannelSchedule('c1');
        const second = runtime.retryChannelSchedule('c1');
        resolveContent(createResolvedContent('c1'));
        await first;
        await second;

        expect(resolveChannelContent).toHaveBeenCalledTimes(1);
        expect(resolveChannelContent).toHaveBeenCalledWith('c1', expect.objectContaining({
            cacheMode: 'revalidate',
        }));
        expect(epg.setRowLifecycle).toHaveBeenCalledWith('c1', expect.objectContaining({ kind: 'retrying' }));
        expect(epg.loadScheduleForChannel).toHaveBeenCalledWith('c1', expect.anything());
    });

    it('promotes matching hidden work for an explicit retry', async () => {
        jest.useFakeTimers();
        const idleScheduler = globalThis as unknown as {
            requestIdleCallback?: typeof globalThis.requestIdleCallback;
            cancelIdleCallback?: typeof globalThis.cancelIdleCallback;
        };
        const priorRequestIdleCallback = idleScheduler.requestIdleCallback;
        const priorCancelIdleCallback = idleScheduler.cancelIdleCallback;
        try {
            delete idleScheduler.requestIdleCallback;
            delete idleScheduler.cancelIdleCallback;

            const channels = Array.from({ length: 20 }, (_, index) => makeChannel(`c${index + 1}`, index + 1));
            let resolveBackgroundItems!: (value: ResolvedChannelContent['items']) => void;
            const resolveChannelContent = jest.fn(async (channelId: string) => createResolvedContent(channelId));
            const resolveChannelItemsForSchedule = jest.fn(async (channelId: string) => {
                if (channelId !== 'c8') {
                    return makeResolvedItems(channelId);
                }
                return new Promise<ResolvedChannelContent['items']>((resolve) => {
                    resolveBackgroundItems = resolve;
                });
            });
            const { runtime, epg, channelManager } = createRuntime({
                channelManager: {
                    getAllChannels: jest.fn(() => channels),
                    getChannel: jest.fn((channelId: string) => (
                        channels.find((channel) => channel.id === channelId) ?? null
                    )),
                    resolveChannelContent,
                    resolveChannelItemsForSchedule,
                },
            });

            await runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );
            await jest.advanceTimersByTimeAsync(200);
            expect(resolveChannelItemsForSchedule).toHaveBeenCalledWith('c8', expect.anything());

            const retry = runtime.retryChannelSchedule('c8');
            resolveBackgroundItems(makeResolvedItems('c8'));
            await retry;
            await settleBackgroundRefresh(runtime);

            expect(resolveChannelContent).not.toHaveBeenCalledWith('c8', expect.anything());
            expect(epg.loadScheduleForChannel).toHaveBeenCalledWith('c8', expect.anything());
            expect((channelManager.resolveChannelItemsForSchedule as jest.Mock).mock.calls.filter(
                ([channelId]) => channelId === 'c8'
            )).toHaveLength(1);
        } finally {
            if (priorRequestIdleCallback) {
                idleScheduler.requestIdleCallback = priorRequestIdleCallback;
            }
            if (priorCancelIdleCallback) {
                idleScheduler.cancelIdleCallback = priorCancelIdleCallback;
            }
            jest.useRealTimers();
        }
    });

    it('settles a failed targeted retry as unavailable', async () => {
        const channel = makeChannel('c1', 1);
        const { runtime, epg } = createRuntime({
            channelManager: {
                getAllChannels: jest.fn(() => [channel]),
                getChannel: jest.fn((channelId: string) => (channelId === channel.id ? channel : null)),
                resolveChannelContent: jest.fn(async () => {
                    throw new Error('retry resolution failed');
                }),
            },
        });

        await runtime.retryChannelSchedule('c1');

        expect(epg.loadScheduleForChannel).not.toHaveBeenCalled();
        expect(epg.setRowLifecycle).toHaveBeenNthCalledWith(1, 'c1', {
            kind: 'retrying',
            rangeKey: '0-60000',
        });
        expect(epg.setRowLifecycle).toHaveBeenLastCalledWith('c1', {
            kind: 'unavailable',
            rangeKey: '0-60000',
        });
    });

    it('warms hidden channels at concurrency one without publishing rows to the UI', async () => {
        jest.useFakeTimers();
        const idleScheduler = globalThis as unknown as {
            requestIdleCallback?: typeof globalThis.requestIdleCallback;
            cancelIdleCallback?: typeof globalThis.cancelIdleCallback;
        };
        const priorRequestIdleCallback = idleScheduler.requestIdleCallback;
        const priorCancelIdleCallback = idleScheduler.cancelIdleCallback;
        try {
            delete idleScheduler.requestIdleCallback;
            delete idleScheduler.cancelIdleCallback;

            const channels = Array.from({ length: 3 }, (_, index) => makeChannel(`w${index + 1}`, index + 1));
            let activeResolutions = 0;
            let maxConcurrentResolutions = 0;
            const { runtime, epg, deps } = createRuntime({
                channelManager: {
                    getAllChannels: jest.fn(() => channels),
                    getChannel: jest.fn((channelId: string) => (
                        channels.find((channel) => channel.id === channelId) ?? null
                    )),
                    resolveChannelItemsForSchedule: jest.fn(async (channelId: string) => {
                        activeResolutions += 1;
                        maxConcurrentResolutions = Math.max(maxConcurrentResolutions, activeResolutions);
                        try {
                            return makeResolvedItems(channelId);
                        } finally {
                            activeResolutions -= 1;
                        }
                    }),
                },
            });

            const warming = runtime.warmHiddenChannels(channels);
            await jest.runAllTimersAsync();
            await warming;

            expect(maxConcurrentResolutions).toBe(1);
            expect(epg.loadScheduleForChannel).not.toHaveBeenCalled();
            expect(epg.setRowLifecycle).not.toHaveBeenCalled();
            expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
                'QA-003b',
                'epg.warmup.started',
                expect.objectContaining({ backgroundChannelCount: 3 })
            );
            expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
                'QA-003b',
                'epg.warmup.settled',
                expect.objectContaining({ backgroundChannelCount: 3, failedChannelCount: 0 })
            );
        } finally {
            if (priorRequestIdleCallback) {
                idleScheduler.requestIdleCallback = priorRequestIdleCallback;
            }
            if (priorCancelIdleCallback) {
                idleScheduler.cancelIdleCallback = priorCancelIdleCallback;
            }
            jest.useRealTimers();
        }
    });

    it('skips hidden warming entirely when playback is already stopped', async () => {
        const channels = [makeChannel('w1', 1)];
        const resolveChannelItemsForSchedule = jest.fn(async (channelId: string) => makeResolvedItems(channelId));
        const { runtime, deps } = createRuntime({
            channelManager: {
                getAllChannels: jest.fn(() => channels),
                getChannel: jest.fn((channelId: string) => (
                    channels.find((channel) => channel.id === channelId) ?? null
                )),
                resolveChannelItemsForSchedule,
            },
        });

        await runtime.warmHiddenChannels(channels, { shouldContinue: () => false });

        expect(resolveChannelItemsForSchedule).not.toHaveBeenCalled();
        expect(deps.appendIssueDiagnostic).not.toHaveBeenCalledWith(
            'QA-003b',
            'epg.warmup.started',
            expect.anything()
        );
    });

    it('cancels queued hidden work when playback stops before a batch runs', async () => {
        jest.useFakeTimers();
        const idleScheduler = globalThis as unknown as {
            requestIdleCallback?: typeof globalThis.requestIdleCallback;
            cancelIdleCallback?: typeof globalThis.cancelIdleCallback;
        };
        const priorRequestIdleCallback = idleScheduler.requestIdleCallback;
        const priorCancelIdleCallback = idleScheduler.cancelIdleCallback;
        try {
            delete idleScheduler.requestIdleCallback;
            delete idleScheduler.cancelIdleCallback;

            const channels = Array.from({ length: 3 }, (_, index) => makeChannel(`w${index + 1}`, index + 1));
            let playing = true;
            const resolveChannelItemsForSchedule = jest.fn(async (channelId: string) => makeResolvedItems(channelId));
            const { runtime, deps } = createRuntime({
                channelManager: {
                    getAllChannels: jest.fn(() => channels),
                    getChannel: jest.fn((channelId: string) => (
                        channels.find((channel) => channel.id === channelId) ?? null
                    )),
                    resolveChannelItemsForSchedule,
                },
            });

            const warming = runtime.warmHiddenChannels(channels, { shouldContinue: () => playing });
            playing = false;
            await jest.runAllTimersAsync();
            await warming;

            expect(resolveChannelItemsForSchedule).not.toHaveBeenCalled();
            expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
                'QA-003b',
                'epg.warmup.settled',
                expect.objectContaining({ backgroundChannelCount: 3, resolutionAttemptCount: 0 })
            );
        } finally {
            if (priorRequestIdleCallback) {
                idleScheduler.requestIdleCallback = priorRequestIdleCallback;
            }
            if (priorCancelIdleCallback) {
                idleScheduler.cancelIdleCallback = priorCancelIdleCallback;
            }
            jest.useRealTimers();
        }
    });

    it('discards in-flight hidden results without UI publication when the warmup signal fires', async () => {
        jest.useFakeTimers();
        const idleScheduler = globalThis as unknown as {
            requestIdleCallback?: typeof globalThis.requestIdleCallback;
            cancelIdleCallback?: typeof globalThis.cancelIdleCallback;
        };
        const priorRequestIdleCallback = idleScheduler.requestIdleCallback;
        const priorCancelIdleCallback = idleScheduler.cancelIdleCallback;
        try {
            delete idleScheduler.requestIdleCallback;
            delete idleScheduler.cancelIdleCallback;

            const channels = [makeChannel('w1', 1)];
            let hiddenSignal: AbortSignal | null = null;
            let resolverObservedAbort = false;
            const resolveChannelContent = jest.fn(async (channelId: string) => createResolvedContent(channelId));
            const { runtime, epg, deps } = createRuntime({
                channelManager: {
                    getAllChannels: jest.fn(() => channels),
                    getChannel: jest.fn((channelId: string) => (
                        channels.find((channel) => channel.id === channelId) ?? null
                    )),
                    resolveChannelContent,
                    resolveChannelItemsForSchedule: jest.fn(
                        (_channelId: string, options?: { signal?: AbortSignal | null }) =>
                            new Promise<ResolvedChannelContent['items']>((_resolve, reject) => {
                                hiddenSignal = options?.signal ?? null;
                                options?.signal?.addEventListener('abort', () => {
                                    resolverObservedAbort = true;
                                    reject(options.signal?.reason ?? new DOMException('aborted', 'AbortError'));
                                }, { once: true });
                        })
                    ),
                },
            });

            const aborter = new AbortController();
            const warming = runtime.warmHiddenChannels(channels, { signal: aborter.signal });
            await jest.advanceTimersByTimeAsync(200);
            aborter.abort(new DOMException('shutdown', 'AbortError'));
            await jest.runAllTimersAsync();
            await warming;

            expect((hiddenSignal as AbortSignal | null)?.aborted).toBe(true);
            expect(resolverObservedAbort).toBe(true);
            expect(epg.loadScheduleForChannel).not.toHaveBeenCalled();
            expect(epg.setRowLifecycle).not.toHaveBeenCalled();
            expect(deps.appendIssueDiagnostic).not.toHaveBeenCalledWith(
                'QA-003b',
                'epg.warmup.settled',
                expect.anything()
            );

            await runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );
            expect(resolveChannelContent).toHaveBeenCalledWith('w1', expect.anything());
        } finally {
            if (priorRequestIdleCallback) {
                idleScheduler.requestIdleCallback = priorRequestIdleCallback;
            }
            if (priorCancelIdleCallback) {
                idleScheduler.cancelIdleCallback = priorCancelIdleCallback;
            }
            jest.useRealTimers();
        }
    });

    it('lets a foreground row adopt matching in-flight background work without a duplicate resolution', async () => {
        jest.useFakeTimers();
        const idleScheduler = globalThis as unknown as {
            requestIdleCallback?: typeof globalThis.requestIdleCallback;
            cancelIdleCallback?: typeof globalThis.cancelIdleCallback;
        };
        const priorRequestIdleCallback = idleScheduler.requestIdleCallback;
        const priorCancelIdleCallback = idleScheduler.cancelIdleCallback;
        try {
            delete idleScheduler.requestIdleCallback;
            delete idleScheduler.cancelIdleCallback;

            const channels = Array.from({ length: 20 }, (_, index) => makeChannel(`c${index + 1}`, index + 1));
            let resolveBackgroundItems!: (value: ResolvedChannelContent['items']) => void;
            let backgroundItemsCalls = 0;
            const resolveChannelContent = jest.fn(async (channelId: string) => createResolvedContent(channelId));
            const { runtime, epg, deps } = createRuntime({
                isDebugEnabled: () => true,
                channelManager: {
                    getAllChannels: jest.fn(() => channels),
                    getChannel: jest.fn((channelId: string) => (
                        channels.find((channel) => channel.id === channelId) ?? null
                    )),
                    resolveChannelContent,
                    resolveChannelItemsForSchedule: jest.fn(async (channelId: string) => {
                        if (channelId !== 'c8') {
                            return makeResolvedItems(channelId);
                        }
                        backgroundItemsCalls += 1;
                        return new Promise<ResolvedChannelContent['items']>((resolve) => {
                            resolveBackgroundItems = resolve;
                        });
                    }),
                },
            });

            await runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );
            await jest.advanceTimersByTimeAsync(200);
            expect(backgroundItemsCalls).toBe(1);

            const foreground = runtime.refreshForRange(
                { channelStart: 7, channelEndExclusive: 8, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );
            await jest.advanceTimersByTimeAsync(10);
            resolveBackgroundItems(makeResolvedItems('c8'));
            const result = await foreground;
            await settleBackgroundRefresh(runtime);

            expect(backgroundItemsCalls).toBe(1);
            expect(resolveChannelContent).not.toHaveBeenCalledWith('c8');
            expect(epg.loadScheduleForChannel).toHaveBeenCalledWith('c8', expect.anything());
            expect(result.failedChannelCount).toBe(0);
            expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
                'QA-003b',
                'epg.scheduleRow.adopted',
                expect.objectContaining({
                    phase: 'immediate',
                    adoptedPhase: 'background',
                })
            );
            expect(JSON.stringify((deps.appendIssueDiagnostic as jest.Mock).mock.calls)).not.toContain('c8');
        } finally {
            if (priorRequestIdleCallback) {
                idleScheduler.requestIdleCallback = priorRequestIdleCallback;
            }
            if (priorCancelIdleCallback) {
                idleScheduler.cancelIdleCallback = priorCancelIdleCallback;
            }
            jest.useRealTimers();
        }
    });

    it('replaces a superseded adopter while one background attempt remains retained', async () => {
        jest.useFakeTimers();
        const idleScheduler = globalThis as unknown as {
            requestIdleCallback?: typeof globalThis.requestIdleCallback;
            cancelIdleCallback?: typeof globalThis.cancelIdleCallback;
        };
        const priorRequestIdleCallback = idleScheduler.requestIdleCallback;
        const priorCancelIdleCallback = idleScheduler.cancelIdleCallback;
        try {
            delete idleScheduler.requestIdleCallback;
            delete idleScheduler.cancelIdleCallback;

            const channels = Array.from({ length: 20 }, (_, index) => makeChannel(`c${index + 1}`, index + 1));
            let resolveBackgroundItems!: (value: ResolvedChannelContent['items']) => void;
            let backgroundItemsCalls = 0;
            const { runtime, epg, channelManager } = createRuntime({
                channelManager: {
                    getAllChannels: jest.fn(() => channels),
                    getChannel: jest.fn((channelId: string) => (
                        channels.find((channel) => channel.id === channelId) ?? null
                    )),
                    resolveChannelContent: jest.fn(async (channelId: string) => createResolvedContent(channelId)),
                    resolveChannelItemsForSchedule: jest.fn(async (channelId: string) => {
                        if (channelId !== 'c8') {
                            return makeResolvedItems(channelId);
                        }
                        backgroundItemsCalls += 1;
                        return new Promise<ResolvedChannelContent['items']>((resolve) => {
                            resolveBackgroundItems = resolve;
                        });
                    }),
                },
            });

            await runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );
            await jest.advanceTimersByTimeAsync(200);
            expect(backgroundItemsCalls).toBe(1);

            const firstForeground = runtime.refreshForRange(
                { channelStart: 7, channelEndExclusive: 8, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );
            const secondForeground = runtime.refreshForRange(
                { channelStart: 7, channelEndExclusive: 8, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );
            await jest.advanceTimersByTimeAsync(10);
            resolveBackgroundItems(makeResolvedItems('c8'));

            const [firstResult, secondResult] = await Promise.all([firstForeground, secondForeground]);
            await settleBackgroundRefresh(runtime);

            expect(firstResult.readiness).toBe('superseded');
            expect(secondResult.readiness).toBe('ready');
            expect(backgroundItemsCalls).toBe(1);
            expect((channelManager.resolveChannelContent as jest.Mock).mock.calls.filter(
                ([channelId]) => channelId === 'c8'
            )).toHaveLength(0);
            expect((epg.loadScheduleForChannel as jest.Mock).mock.calls.filter(
                ([channelId]) => channelId === 'c8'
            )).toHaveLength(1);
        } finally {
            if (priorRequestIdleCallback) {
                idleScheduler.requestIdleCallback = priorRequestIdleCallback;
            }
            if (priorCancelIdleCallback) {
                idleScheduler.cancelIdleCallback = priorCancelIdleCallback;
            }
            jest.useRealTimers();
        }
    });

    it('preserves a component-held stale schedule when adopted revalidation fails', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(0);
        const idleScheduler = globalThis as unknown as {
            requestIdleCallback?: typeof globalThis.requestIdleCallback;
            cancelIdleCallback?: typeof globalThis.cancelIdleCallback;
        };
        const priorRequestIdleCallback = idleScheduler.requestIdleCallback;
        const priorCancelIdleCallback = idleScheduler.cancelIdleCallback;
        try {
            delete idleScheduler.requestIdleCallback;
            delete idleScheduler.cancelIdleCallback;

            const channel = makeChannel('c8', 8);
            let componentHasSchedule = false;
            let heldSchedule: EpgHeldScheduleSnapshot | null = null;
            let rejectBackgroundItems!: (reason?: unknown) => void;
            const resolveChannelItemsForSchedule = jest.fn(
                () => new Promise<ResolvedChannelContent['items']>((_resolve, reject) => {
                    rejectBackgroundItems = reject;
                })
            );
            const { runtime, epg, deps } = createRuntime({
                epg: {
                    hasScheduleForChannelRange: jest.fn(() => componentHasSchedule),
                    getHeldScheduleForChannel: jest.fn(() => heldSchedule),
                    clearScheduleForChannel: jest.fn(() => {
                        heldSchedule = null;
                        componentHasSchedule = false;
                    }),
                    loadScheduleForChannel: jest.fn((_channelId, schedule) => {
                        componentHasSchedule = true;
                        heldSchedule = {
                            schedule,
                            loadedAt: Date.now(),
                            channelSnapshot: channel,
                        };
                    }),
                },
                channelManager: {
                    getAllChannels: jest.fn(() => [channel]),
                    getChannel: jest.fn((channelId: string) => (channelId === channel.id ? channel : null)),
                    resolveChannelItemsForSchedule,
                },
            });
            const range = { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 };

            await runtime.refreshForRange(range, 'visible-range');
            expect(componentHasSchedule).toBe(true);

            runtime.clearScheduleCaches();
            jest.setSystemTime(3 * 60_000);
            const warming = runtime.warmHiddenChannels([channel]);
            await jest.advanceTimersByTimeAsync(200);
            expect(resolveChannelItemsForSchedule).toHaveBeenCalledTimes(1);

            const foreground = runtime.refreshForRange(range, 'visible-range');
            (deps.appendIssueDiagnostic as jest.Mock).mockClear();
            rejectBackgroundItems(new Error('hidden revalidation failed'));
            const foregroundResult = await foreground;
            await warming;

            const settled = (deps.appendIssueDiagnostic as jest.Mock).mock.calls.find(
                ([, event]) => event === 'epg.scheduleRefresh.settled'
            )?.[2] as Record<string, unknown> | undefined;

            expect(epg.setRowLifecycle).not.toHaveBeenCalled();
            expect(foregroundResult.immediateReadyChannelCount).toBe(1);
            expect(epg.loadScheduleForChannel).toHaveBeenCalledTimes(1);
            expect(settled).toEqual(expect.objectContaining({
                allVisibleRowsSettledMs: expect.any(Number),
                visibleReadyChannelCount: 1,
                visibleUnavailableChannelCount: 0,
            }));
        } finally {
            if (priorRequestIdleCallback) {
                idleScheduler.requestIdleCallback = priorRequestIdleCallback;
            }
            if (priorCancelIdleCallback) {
                idleScheduler.cancelIdleCallback = priorCancelIdleCallback;
            }
            jest.useRealTimers();
        }
    });

    it('cancels adopted foreground work without publishing the retained background result', async () => {
        jest.useFakeTimers();
        const idleScheduler = globalThis as unknown as {
            requestIdleCallback?: typeof globalThis.requestIdleCallback;
            cancelIdleCallback?: typeof globalThis.cancelIdleCallback;
        };
        const priorRequestIdleCallback = idleScheduler.requestIdleCallback;
        const priorCancelIdleCallback = idleScheduler.cancelIdleCallback;
        try {
            delete idleScheduler.requestIdleCallback;
            delete idleScheduler.cancelIdleCallback;

            const channels = Array.from({ length: 20 }, (_, index) => makeChannel(`c${index + 1}`, index + 1));
            let hiddenSignal: AbortSignal | null = null;
            let resolverObservedAbort = false;
            const resolveChannelContent = jest.fn(async (channelId: string) => createResolvedContent(channelId));
            const resolveChannelItemsForSchedule = jest.fn(
                (channelId: string, options?: { signal?: AbortSignal | null }) => {
                    if (channelId !== 'c8') {
                        return Promise.resolve(makeResolvedItems(channelId));
                    }
                    hiddenSignal = options?.signal ?? null;
                    return new Promise<ResolvedChannelContent['items']>((_resolve, reject) => {
                        options?.signal?.addEventListener('abort', () => {
                            resolverObservedAbort = true;
                            reject(options.signal?.reason ?? new DOMException('aborted', 'AbortError'));
                        }, { once: true });
                    });
                }
            );
            const { runtime, epg } = createRuntime({
                channelManager: {
                    getAllChannels: jest.fn(() => channels),
                    getChannel: jest.fn((channelId: string) => (
                        channels.find((channel) => channel.id === channelId) ?? null
                    )),
                    resolveChannelContent,
                    resolveChannelItemsForSchedule,
                },
            });

            await runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 0, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );
            await jest.advanceTimersByTimeAsync(200);
            expect((hiddenSignal as AbortSignal | null)?.aborted).toBe(false);

            const controller = new AbortController();
            const foreground = runtime.refreshForRange(
                { channelStart: 7, channelEndExclusive: 8, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range',
                { signal: controller.signal }
            );
            controller.abort(new DOMException('foreground canceled', 'AbortError'));
            await expect(foreground).rejects.toThrow('foreground canceled');
            await settleBackgroundRefresh(runtime);

            expect((hiddenSignal as AbortSignal | null)?.aborted).toBe(true);
            expect(resolverObservedAbort).toBe(true);
            expect(epg.loadScheduleForChannel).not.toHaveBeenCalledWith('c8', expect.anything());
            await runtime.refreshForRange(
                { channelStart: 7, channelEndExclusive: 8, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );
            expect(resolveChannelContent).toHaveBeenCalledWith('c8', expect.anything());
        } finally {
            if (priorRequestIdleCallback) {
                idleScheduler.requestIdleCallback = priorRequestIdleCallback;
            }
            if (priorCancelIdleCallback) {
                idleScheduler.cancelIdleCallback = priorCancelIdleCallback;
            }
            jest.useRealTimers();
        }
    });

    it('keeps a current foreground row ready when another real manager consumer cancels shared source work', async () => {
        const library = createMockLibrary();
        const sourceResult = createDeferred<PlexMediaItemMinimal[]>();
        library.getLibraryItems.mockReturnValue(sourceResult.promise);
        const manager = new ChannelManager({ plexLibrary: library });
        const sharedSource = {
            type: 'library' as const,
            libraryId: 'shared-library',
            libraryType: 'movie' as const,
            includeWatched: true,
        };
        const channelA = { ...makeChannel('external', 1), contentSource: sharedSource };
        const channelB = { ...makeChannel('guide', 2), contentSource: sharedSource };
        await manager.replaceAllChannels([channelA, channelB]);
        const external = new AbortController();
        const externalResolution = manager.resolveChannelContent(channelA.id, {
            signal: external.signal,
        });
        await Promise.resolve();
        const { runtime, epg } = createRuntime({
            getChannelManager: () => manager,
            getVisibleChannels: () => [channelB],
        });

        try {
            const foreground = runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );
            await Promise.resolve();
            external.abort('request-replaced');
            sourceResult.resolve([createMockItem({ ratingKey: 'shared-result', durationMs: 60_000 })]);

            await expect(externalResolution).rejects.toBe('request-replaced');
            await expect(foreground).resolves.toEqual(expect.objectContaining({
                readiness: 'ready',
                failedChannelCount: 0,
            }));
            expect(epg.loadScheduleForChannel).toHaveBeenCalledWith(channelB.id, expect.anything());
            expect(epg.setRowLifecycle).not.toHaveBeenCalledWith(
                channelB.id,
                expect.objectContaining({ kind: 'unavailable' })
            );
            expect(library.getLibraryItems).toHaveBeenCalledTimes(1);
        } finally {
            manager.dispose();
        }
    });

    it('recovers a real manager row from completed empty source cache on targeted retry', async () => {
        const library = createMockLibrary();
        library.getLibraryItems
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([createMockItem({ ratingKey: 'restored-result', durationMs: 60_000 })]);
        const manager = new ChannelManager({ plexLibrary: library });
        const channel = {
            ...makeChannel('guide', 1),
            contentSource: {
                type: 'library' as const,
                libraryId: 'recovering-library',
                libraryType: 'movie' as const,
                includeWatched: true,
            },
        };
        await manager.replaceAllChannels([channel]);
        await expect(manager.resolveChannelContent(channel.id)).rejects.toMatchObject({
            code: 'CONTENT_UNAVAILABLE',
        });
        const { runtime, epg, deps } = createRuntime({
            getChannelManager: () => manager,
            getVisibleChannels: () => [channel],
            isDebugEnabled: () => true,
        });

        try {
            await runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );
            expect(epg.setRowLifecycle).toHaveBeenCalledWith(
                channel.id,
                expect.objectContaining({ kind: 'unavailable' })
            );
            const rowFailure = (deps.appendIssueDiagnostic as jest.Mock).mock.calls.find(
                (call) => call[1] === 'epg.scheduleRow.settled'
            )?.[2];
            expect(rowFailure).toEqual(expect.objectContaining({
                failure: expect.objectContaining({
                    errorClass: 'ChannelError',
                    errorCode: 'CONTENT_UNAVAILABLE',
                }),
            }));
            const initialCompletion = (deps.appendIssueDiagnostic as jest.Mock).mock.calls.find(
                (call) => call[1] === 'epg.scheduleRow.requestCompleted'
            )?.[2];
            expect(initialCompletion).toEqual(expect.objectContaining({
                sourceEvents: expect.arrayContaining([
                    expect.objectContaining({
                        event: 'result',
                        outcome: 'success',
                        itemCount: 0,
                    }),
                ]),
                sourceEventsDropped: 0,
            }));
            expect(JSON.stringify(rowFailure)).not.toContain('No content available');

            await runtime.retryChannelSchedule(channel.id);

            expect(epg.loadScheduleForChannel).toHaveBeenCalledWith(channel.id, expect.anything());
            expect(library.getLibraryItems).toHaveBeenCalledTimes(2);
            expect(manager.getAllChannels()).toEqual([expect.objectContaining({ id: channel.id })]);
        } finally {
            manager.dispose();
        }
    });

    it('caps nested source diagnostics within one row completion record', async () => {
        const manager = new ChannelManager({ plexLibrary: createMockLibrary() });
        const channel = {
            ...makeChannel('guide', 1),
            contentSource: {
                type: 'mixed' as const,
                mixMode: 'sequential' as const,
                sources: Array.from({ length: 5 }, (_, index) => ({
                    type: 'manual' as const,
                    items: [{
                        ratingKey: `private-item-${index}`,
                        title: `Private title ${index}`,
                        durationMs: 60_000,
                    }],
                })),
            },
        };
        await manager.replaceAllChannels([channel]);
        const { runtime, deps } = createRuntime({
            getChannelManager: () => manager,
            getVisibleChannels: () => [channel],
            isDebugEnabled: () => true,
        });

        try {
            await runtime.refreshForRange(
                { channelStart: 0, channelEndExclusive: 1, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );
            const completion = (deps.appendIssueDiagnostic as jest.Mock).mock.calls.find(
                (call) => call[1] === 'epg.scheduleRow.requestCompleted'
            )?.[2];
            expect(completion).toEqual(expect.objectContaining({
                sourceEvents: expect.any(Array),
                sourceEventsDropped: 4,
            }));
            expect(completion.sourceEvents).toHaveLength(8);
            const diagnosticJson = JSON.stringify(completion);
            expect(diagnosticJson).not.toContain('private-item');
            expect(diagnosticJson).not.toContain('Private title');
        } finally {
            manager.dispose();
        }
    });
});
