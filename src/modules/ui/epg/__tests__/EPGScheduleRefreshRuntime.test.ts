import { EPGScheduleRefreshRuntime, type EPGScheduleRefreshRuntimeDeps } from '../runtime/EPGScheduleRefreshRuntime';
import type {
    ChannelConfig,
    IChannelManager,
    PlaybackMode,
    ResolvedChannelContent,
} from '../../../scheduler/channel-manager';
import type { IChannelScheduler, ScheduleConfig, ScheduleWindow } from '../../../scheduler/scheduler';
import type { IEPGComponent } from '../interfaces';
import { createEpgRetainedOperationContext } from '../runtime/EPGRetainedOperationContext';

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

describe('EPGScheduleRefreshRuntime', () => {
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
        const { runtime, epg, deps } = createRuntime({
            channelManager: {
                resolveChannelContent: jest.fn(() => new Promise<ResolvedChannelContent>((resolve) => {
                    resolveContent = resolve;
                })),
            },
        });

        const refresh = runtime.refreshForRange(
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'server-swap',
            { operationContext: operation }
        );
        await Promise.resolve();
        authorityController.abort(superseded);
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
        const { runtime, deps } = createRuntime();

        await runtime.refreshForRange(
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleApplied',
            expect.objectContaining({
                source: 'resolved-immediate',
            })
        );
    });

    it('counts stale cache plus fresh resolution as one ready immediate channel', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(0);
        try {
            const { runtime, epg } = createRuntime();
            await runtime.refreshForRange(
                { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );

            runtime.clearLoadedScheduleMarkers();
            jest.setSystemTime(3 * 60_000);
            const result = await runtime.refreshForRange(
                { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
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
                { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );

            await settleBackgroundRefresh(runtime);

            runtime.clearLoadedScheduleMarkers();
            (deps.appendIssueDiagnostic as jest.Mock).mockClear();
            failCachedClone = true;

            await runtime.refreshForRange(
                { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );

            await settleBackgroundRefresh(runtime);

            expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
                'QA-003b',
                'epg.backgroundWarmQueueFailed',
                expect.objectContaining({
                    channelId: 'c8',
                    phase: 'background',
                    safeError: expect.objectContaining({
                        message: expect.stringContaining('cache clone failed'),
                    }),
                })
            );
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
            channelManager: {
                getAllChannels: jest.fn(() => [channel]),
                getChannel: jest.fn((channelId: string) => (channelId === channel.id ? channel : null)),
                resolveChannelContent: jest.fn(async () => {
                    throw failure;
                }),
            },
        });

        const result = await runtime.refreshForRange(
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
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
            'epg.scheduleLoadFailed',
            expect.objectContaining({
                channelId: 'c1',
                phase: 'immediate',
                safeError: expect.objectContaining({
                    message: expect.stringContaining('resolve failed'),
                }),
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
                        endChannelIndex: 1,
                    },
                    currentTime: 0,
                }),
            },
        });

        const result = await runtime.refreshForRange(
            { channelStart: 0, channelEnd: 1, timeStartMs: 0, timeEndMs: 60_000 },
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
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
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

    it('reports non-abort channel load failures that race with caller cancellation', async () => {
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
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'server-swap',
            { signal: controller.signal }
        );
        await Promise.resolve();

        controller.abort(abortReason);
        (rejectContent as unknown as (reason?: unknown) => void)(loadError);

        await expect(refresh).rejects.toBe(abortReason);
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleLoadFailed',
            expect.objectContaining({
                channelId: 'c1',
                phase: 'immediate',
                safeError: expect.objectContaining({
                    message: 'resolver failed after abort',
                }),
            })
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
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
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
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );
        await Promise.resolve();

        visibleChannels = [];
        await runtime.refreshForRange(
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
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
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );
        await runtime.refreshForRange(
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(channelManager.resolveChannelContent).toHaveBeenCalledTimes(1);
    });

    it('counts already-loaded visible channels as ready refresh results', async () => {
        const { runtime } = createRuntime();

        await runtime.refreshForRange(
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );
        const result = await runtime.refreshForRange(
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
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
            nextRange: { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
        },
        {
            label: 'different-range',
            nextRange: { channelStart: 0, channelEnd: 0, timeStartMs: 60_000, timeEndMs: 120_000 },
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
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
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
        const { runtime, epg } = createRuntime({
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
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(epg.loadScheduleForChannel).not.toHaveBeenCalled();
        expect(epg.focusNow).not.toHaveBeenCalled();
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
                        endChannelIndex: 0,
                    },
                    currentTime: 0,
                }),
            },
        });
        try {
            await runtime.refreshForRange(
                { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
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
                        endChannelIndex: 0,
                    },
                    currentTime: now,
                }),
            },
        });

        try {
            await runtime.refreshForRange(
                { channelStart: 0, channelEnd: 0, timeStartMs: priorDayRangeStart, timeEndMs: rangeEnd },
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
                        endChannelIndex: 1,
                    },
                    currentTime: 0,
                }),
            },
        });
        try {
            await runtime.refreshForRange(
                { channelStart: 0, channelEnd: 1, timeStartMs: 0, timeEndMs: 60_000 },
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
                        endChannelIndex: 2,
                    },
                    currentTime: 0,
                }),
            },
        });

        await runtime.refreshForRange(
            { channelStart: 0, channelEnd: 2, timeStartMs: 0, timeEndMs: 60_000 },
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
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
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
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );
        (deps.appendIssueDiagnostic as jest.Mock).mockClear();
        (epg.loadScheduleForChannel as jest.Mock).mockClear();
        schedulerState.isActive = true;
        schedulerState.channelId = channel.id;

        await runtime.refreshForRange(
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleApplied',
            expect.objectContaining({
                channelId: channel.id,
                source: 'live-scheduler',
                sampleRatingKeys: ['live-program'],
            })
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
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        schedulerState.isActive = false;
        schedulerState.channelId = null;
        (deps.appendIssueDiagnostic as jest.Mock).mockClear();
        (epg.loadScheduleForChannel as jest.Mock).mockClear();
        resolveChannelContent.mockClear();

        await runtime.refreshForRange(
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

        expect(resolveChannelContent).toHaveBeenCalledTimes(1);
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'epg.scheduleApplied',
            expect.objectContaining({
                channelId: channel.id,
                source: 'resolved-immediate',
            })
        );
        expect(epg.loadScheduleForChannel).toHaveBeenCalledTimes(1);
        expect(getScheduleWindow).toHaveBeenCalledTimes(1);
    });
});
