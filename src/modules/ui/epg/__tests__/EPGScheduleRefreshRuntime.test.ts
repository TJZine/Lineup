import { EPGScheduleRefreshRuntime, type EPGScheduleRefreshRuntimeDeps } from '../runtime/EPGScheduleRefreshRuntime';
import type {
    ChannelConfig,
    IChannelManager,
    PlaybackMode,
    ResolvedChannelContent,
} from '../../../scheduler/channel-manager';
import type { IChannelScheduler, ScheduleConfig, ScheduleWindow } from '../../../scheduler/scheduler';
import type { IEPGComponent } from '../interfaces';

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
            streamDescriptor: null,
            isCurrent: false,
        },
    ],
});

const flushPromises = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
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

describe('EPGScheduleRefreshRuntime', () => {
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
                    if (window.programs[0]?.item.ratingKey === 'c8-0') {
                        throw cloneFailure;
                    }
                    return { ...window, programs: [...window.programs] };
                },
            });

            (
                runtime as unknown as {
                    _cacheStore: { storeSchedule: (channelId: string, rangeKey: string, schedule: ScheduleWindow) => void };
                }
            )._cacheStore.storeSchedule('c8', '0-60000', createScheduleWindow('c8'));

            await runtime.refreshForRange(
                { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
                'visible-range'
            );

            for (let i = 0; i < 20; i += 1) {
                jest.advanceTimersByTime(50);
                await flushPromises();
            }

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

        await runtime.refreshForRange(
            { channelStart: 0, channelEnd: 0, timeStartMs: 0, timeEndMs: 60_000 },
            'visible-range'
        );

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
                    loopSchedule: true,
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

        const { runtime, deps, epg } = createRuntime({
            channelManager: {
                getAllChannels: jest.fn(() => [channel]),
                getChannel: jest.fn((channelId: string) => (channelId === channel.id ? channel : null)),
                getCurrentChannel: jest.fn(() => channel),
            },
            getScheduler: () => ({
                getState: jest.fn(() => ({ isActive: true, channelId: channel.id })),
                getScheduleWindow: jest.fn(() => liveSchedule),
            } as unknown as IChannelScheduler),
        });

        runtime.cacheScheduleForRange(channel.id, 0, 60_000, createScheduleWindow(channel.id));
        (deps.appendIssueDiagnostic as jest.Mock).mockClear();
        (epg.loadScheduleForChannel as jest.Mock).mockClear();

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
});
