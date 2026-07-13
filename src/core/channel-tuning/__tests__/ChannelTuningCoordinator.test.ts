import { ChannelTuningCoordinator } from '../ChannelTuningCoordinator';
import { AppErrorCode } from '../../../types/app-errors';
import type { IVideoPlayer } from '../../../modules/player';
import type {
    IChannelManager,
    ChannelConfig,
    ResolvedChannelContent,
} from '../../../modules/scheduler/channel-manager';
import type {
    IChannelScheduler,
    ScheduleConfig,
} from '../../../modules/scheduler/scheduler';

const mockChannel = {
    id: 'ch1',
    name: 'Channel 1',
    number: 1,
} as ChannelConfig;

const resolvedContent: ResolvedChannelContent = {
    channelId: 'ch1',
    items: [],
    orderedItems: [],
    totalDurationMs: 0,
    resolvedAt: 0,
};

const createScheduleConfig = (channelId: string, anchorTime: number): ScheduleConfig => ({
    channelId,
    anchorTime,
    content: [],
    playbackMode: 'sequential',
    shuffleSeed: 0,
});

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

type CoordinatorHarness = {
    coordinator: ChannelTuningCoordinator;
    deps: {
        getChannelManager: () => IChannelManager | null;
        getScheduler: () => IChannelScheduler | null;
        getVideoPlayer: () => IVideoPlayer | null;
        buildDailyScheduleConfig: jest.Mock<ScheduleConfig, [ChannelConfig, ResolvedChannelContent['items'], number]>;
        getLocalDayKey: jest.Mock<number, [number]>;
        setActiveScheduleDayKey: jest.Mock<void, [number]>;
        setPendingNowPlayingChannelId: jest.Mock<void, [string | null]>;
        getPendingNowPlayingChannelId: jest.Mock<string | null, []>;
        resetPlaybackGuardsForNewChannel: jest.Mock<void, []>;
        stopActiveTranscodeSession: jest.Mock<void, []>;
        armChannelTransitionForSwitch: jest.Mock<void, [string]>;
        appendIssueDiagnostic: jest.Mock<void, [string, string, unknown]>;
        handleGlobalError: jest.Mock<void, [unknown, string]>;
        saveLifecycleState: jest.Mock<Promise<void>, []>;
    };
    channelManager: jest.Mocked<IChannelManager>;
    scheduler: jest.Mocked<IChannelScheduler>;
    videoPlayer: jest.Mocked<IVideoPlayer>;
    buildDailyScheduleConfig: jest.Mock<ScheduleConfig, [ChannelConfig, ResolvedChannelContent['items'], number]>;
};

const createCoordinator = (): CoordinatorHarness => {
    const channelManager = {
        getChannel: jest.fn().mockReturnValue(mockChannel),
        getChannelByNumber: jest.fn().mockReturnValue(mockChannel),
        resolveChannelContent: jest.fn().mockResolvedValue(resolvedContent),
        resolveChannelContentForInitialTune: jest.fn().mockResolvedValue(resolvedContent),
        createInitialTuneResolutionAuthorization: jest.fn().mockReturnValue({}),
        supersedeActiveResolutions: jest.fn().mockResolvedValue(undefined),
        resumeActiveResolutions: jest.fn(),
        setCurrentChannel: jest.fn(),
    } as unknown as jest.Mocked<IChannelManager>;

    const scheduler = {
        loadChannel: jest.fn(),
        unloadChannel: jest.fn(),
        syncToCurrentTime: jest.fn(),
        getCurrentProgram: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<IChannelScheduler>;

    const videoPlayer = {
        stop: jest.fn(),
    } as unknown as jest.Mocked<IVideoPlayer>;

    const buildDailyScheduleConfig = jest.fn((
        channel: ChannelConfig,
        items: ResolvedChannelContent['items'],
        now: number
    ) => {
        void items;
        return createScheduleConfig(channel.id, now);
    });

    const deps = {
        getChannelManager: (): IChannelManager => channelManager,
        getScheduler: (): IChannelScheduler => scheduler,
        getVideoPlayer: (): IVideoPlayer => videoPlayer,
        buildDailyScheduleConfig,
        getLocalDayKey: jest.fn<number, [number]>().mockReturnValue(123),
        setActiveScheduleDayKey: jest.fn<void, [number]>(),
        setPendingNowPlayingChannelId: jest.fn<void, [string | null]>(),
        getPendingNowPlayingChannelId: jest.fn<string | null, []>().mockReturnValue(null),
        resetPlaybackGuardsForNewChannel: jest.fn<void, []>(),
        stopActiveTranscodeSession: jest.fn<void, []>(),
        armChannelTransitionForSwitch: jest.fn<void, [string]>(),
        appendIssueDiagnostic: jest.fn<void, [string, string, unknown]>(),
        handleGlobalError: jest.fn<void, [unknown, string]>(),
        saveLifecycleState: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    };

    const coordinator = new ChannelTuningCoordinator(deps);

    return { coordinator, deps, channelManager, scheduler, videoPlayer, buildDailyScheduleConfig };
};

describe('ChannelTuningCoordinator', () => {
    beforeEach(() => {
        if (!globalThis.localStorage) {
            (globalThis as { localStorage?: Storage }).localStorage = createLocalStorageMock();
        }
        localStorage.clear();
    });

    it('passes AbortSignal into resolveChannelContent', async () => {
        const { coordinator, channelManager } = createCoordinator();
        const controller = new AbortController();

        await coordinator.switchToChannel('ch1', { signal: controller.signal });

        expect(channelManager.resolveChannelContent).toHaveBeenCalledWith('ch1', { signal: controller.signal });
    });

    it('uses a single now for schedule + dayKey', async () => {
        const { coordinator, deps, buildDailyScheduleConfig } = createCoordinator();
        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);

        await coordinator.switchToChannel('ch1');

        expect(buildDailyScheduleConfig).toHaveBeenCalledWith(mockChannel, resolvedContent.items, 1_000_000);
        expect(deps.getLocalDayKey).toHaveBeenCalledWith(1_000_000);
        expect(deps.setActiveScheduleDayKey).toHaveBeenCalledWith(123);
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'channelTuning.resolveChannelContent',
            expect.objectContaining({
                channelId: 'ch1',
            })
        );
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'channelTuning.schedulerLoaded',
            expect.objectContaining({
                channelId: 'ch1',
            })
        );

        nowSpy.mockRestore();
    });

    it('stops any active transcode session when switching channels', async () => {
        const { coordinator, deps, videoPlayer } = createCoordinator();

        await coordinator.switchToChannel('ch1');

        expect(deps.stopActiveTranscodeSession).toHaveBeenCalledTimes(1);
        expect(videoPlayer.stop).toHaveBeenCalledTimes(1);
    });

    it('uses a guide-selected snapshot to seed scheduler load without resolving channel content again', async () => {
        const { coordinator, channelManager, buildDailyScheduleConfig } = createCoordinator();
        const snapshotItems: ResolvedChannelContent['items'] = [
            {
                ratingKey: 'rk-1',
                type: 'movie',
                title: 'Program 1',
                fullTitle: 'Program 1',
                durationMs: 60_000,
                thumb: null,
                year: 2024,
                scheduledIndex: 0,
            },
        ];
        channelManager.resolveChannelContent.mockClear();

        await coordinator.switchToChannel('ch1', {
            guideSelectionSnapshot: {
                channelId: 'ch1',
                ratingKey: 'rk-1',
                scheduledStartTime: 1_000,
                scheduledEndTime: 61_000,
                source: 'resolved-immediate',
                referenceTimeMs: 10_000,
                dayKey: 123,
                orderedItems: snapshotItems,
            },
        });

        expect(channelManager.resolveChannelContent).not.toHaveBeenCalled();
        expect(buildDailyScheduleConfig).toHaveBeenCalledWith(mockChannel, snapshotItems, expect.any(Number));
    });

    it('falls back to resolveChannelContent when the guide snapshot day key is stale', async () => {
        const { coordinator, deps, channelManager } = createCoordinator();
        deps.getLocalDayKey.mockReturnValue(456);

        await coordinator.switchToChannel('ch1', {
            guideSelectionSnapshot: {
                channelId: 'ch1',
                ratingKey: 'rk-1',
                scheduledStartTime: 1_000,
                scheduledEndTime: 61_000,
                source: 'resolved-immediate',
                referenceTimeMs: 10_000,
                dayKey: 123,
                orderedItems: [
                    {
                        ratingKey: 'rk-1',
                        type: 'movie',
                        title: 'Program 1',
                        fullTitle: 'Program 1',
                        durationMs: 60_000,
                        thumb: null,
                        year: 2024,
                        scheduledIndex: 0,
                    },
                ],
            },
        });

        expect(channelManager.resolveChannelContent).toHaveBeenCalledWith('ch1', { signal: null });
    });

    it.each([
        ['missing', undefined],
        ['object', { ratingKey: 'rk-1' }],
        ['string', 'not-an-item-list'],
    ] as const)(
        'falls back to resolved content when guide snapshot orderedItems is %s',
        async (_label, orderedItems) => {
            const { coordinator, channelManager } = createCoordinator();
            const malformedSnapshot = {
                channelId: 'ch1',
                ratingKey: 'rk-1',
                scheduledStartTime: 1_000,
                scheduledEndTime: 61_000,
                source: 'resolved-immediate',
                referenceTimeMs: 10_000,
                dayKey: 123,
                ...(orderedItems === undefined ? {} : { orderedItems }),
            };

            await expect(coordinator.switchToChannel('ch1', {
                guideSelectionSnapshot: malformedSnapshot as never,
            })).resolves.toEqual({ kind: 'switched' });

            expect(channelManager.resolveChannelContent).toHaveBeenCalledWith('ch1', {
                signal: null,
            });
        }
    );

    it('uses post-resolve current time for non-snapshot schedule build and day-key stamping', async () => {
        const { coordinator, deps, channelManager, buildDailyScheduleConfig } = createCoordinator();
        let nowValue = 1_000_000;
        const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => nowValue);
        deps.getLocalDayKey.mockImplementation((timeMs: number) => timeMs);
        channelManager.resolveChannelContent.mockImplementation(async () => {
            nowValue = 1_500_000;
            return resolvedContent;
        });

        await coordinator.switchToChannel('ch1');

        expect(buildDailyScheduleConfig).toHaveBeenCalledWith(
            mockChannel,
            resolvedContent.items,
            1_500_000
        );
        expect(deps.getLocalDayKey).toHaveBeenCalledWith(1_500_000);
        expect(deps.setActiveScheduleDayKey).toHaveBeenCalledWith(1_500_000);

        nowSpy.mockRestore();
    });

    it('propagates ChannelError code + recoverable', async () => {
        const { coordinator, deps, channelManager, scheduler, videoPlayer } = createCoordinator();

        channelManager.resolveChannelContent.mockRejectedValue({
            name: 'ChannelError',
            code: 'SCHEDULER_EMPTY_CHANNEL',
            message: 'No playable content found after filtering',
            recoverable: false,
        });

        await coordinator.switchToChannel('ch1');

        expect(deps.handleGlobalError).toHaveBeenCalledWith(
            expect.objectContaining({
                code: 'SCHEDULER_EMPTY_CHANNEL',
                message: 'No playable content found after filtering',
                recoverable: false,
                context: expect.objectContaining({
                    channelId: 'ch1',
                    operation: 'switchToChannel',
                    step: 'resolveChannelContent',
                    errorSummary: expect.objectContaining({
                        name: 'ChannelError',
                        code: 'SCHEDULER_EMPTY_CHANNEL',
                        message: 'No playable content found after filtering',
                    }),
                }),
            }),
            'switchToChannel'
        );
        expect(videoPlayer.stop).not.toHaveBeenCalled();
        expect(scheduler.loadChannel).not.toHaveBeenCalled();
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'channelTuning.resolveFailed',
            expect.objectContaining({
                channelId: 'ch1',
                code: 'SCHEDULER_EMPTY_CHANNEL',
                message: 'No playable content found after filtering',
                recoverable: false,
                error: {
                    name: 'ChannelError',
                    code: 'SCHEDULER_EMPTY_CHANNEL',
                    message: 'No playable content found after filtering',
                },
            })
        );
    });

    it('records a safe error summary on resolve failures', async () => {
        const { coordinator, deps, channelManager } = createCoordinator();

        channelManager.resolveChannelContent.mockRejectedValue({
            name: 'ChannelError',
            code: 'CONTENT_UNAVAILABLE',
            message: 'Boom',
            url: 'https://example.com?X-Plex-Token=abc',
        });

        await coordinator.switchToChannel('ch1');

        expect(deps.handleGlobalError).toHaveBeenCalledWith(
            expect.objectContaining({
                code: 'CONTENT_UNAVAILABLE',
                message: 'Boom',
                recoverable: true,
                context: expect.objectContaining({
                    channelId: 'ch1',
                    operation: 'switchToChannel',
                    step: 'resolveChannelContent',
                    errorSummary: expect.objectContaining({
                        name: 'ChannelError',
                        code: 'CONTENT_UNAVAILABLE',
                        message: 'Boom',
                    }),
                }),
            }),
            'switchToChannel'
        );
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'channelTuning.resolveFailed',
            expect.objectContaining({
                channelId: 'ch1',
                code: 'CONTENT_UNAVAILABLE',
                message: 'Boom',
                error: {
                    name: 'ChannelError',
                    code: 'CONTENT_UNAVAILABLE',
                    message: 'Boom',
                },
            })
        );
    });

    it('aborts silently on AbortError', async () => {
        const { coordinator, deps, channelManager, videoPlayer } = createCoordinator();
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

        channelManager.resolveChannelContent.mockRejectedValue({
            name: 'AbortError',
            message: 'cancelled',
        });

        await coordinator.switchToChannel('ch1', { signal: new AbortController().signal });

        expect(deps.handleGlobalError).not.toHaveBeenCalled();
        expect(videoPlayer.stop).not.toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
        expect(consoleWarnSpy).not.toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    it('returns silently when signal is already aborted', async () => {
        const { coordinator, deps, channelManager, scheduler, videoPlayer } = createCoordinator();
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        const controller = new AbortController();
        controller.abort();

        await coordinator.switchToChannel('ch1', { signal: controller.signal });

        expect(channelManager.resolveChannelContent).not.toHaveBeenCalled();
        expect(deps.resetPlaybackGuardsForNewChannel).not.toHaveBeenCalled();
        expect(videoPlayer.stop).not.toHaveBeenCalled();
        expect(scheduler.loadChannel).not.toHaveBeenCalled();
        expect(deps.setPendingNowPlayingChannelId).not.toHaveBeenCalled();
        expect(deps.handleGlobalError).not.toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
        expect(consoleWarnSpy).not.toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    it('honors an already-aborted signal before dependency validation', async () => {
        const controller = new AbortController();
        controller.abort();
        const handleGlobalError = jest.fn();
        const coordinator = new ChannelTuningCoordinator({
            getChannelManager: (): null => null,
            getScheduler: (): null => null,
            getVideoPlayer: (): null => null,
            buildDailyScheduleConfig: jest.fn(),
            getLocalDayKey: jest.fn().mockReturnValue(0),
            setActiveScheduleDayKey: jest.fn(),
            setPendingNowPlayingChannelId: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
            resetPlaybackGuardsForNewChannel: jest.fn(),
            stopActiveTranscodeSession: jest.fn(),
            armChannelTransitionForSwitch: jest.fn(),
            appendIssueDiagnostic: jest.fn(),
            handleGlobalError,
            saveLifecycleState: jest.fn().mockResolvedValue(undefined),
        });

        await expect(coordinator.switchToChannel('ch1', { signal: controller.signal })).resolves.toEqual({ kind: 'aborted' });
        expect(handleGlobalError).not.toHaveBeenCalled();
    });

    it('returns silently when aborted after content resolution', async () => {
        const { coordinator, deps, channelManager, scheduler, videoPlayer } = createCoordinator();
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        const controller = new AbortController();

        channelManager.resolveChannelContent.mockImplementation(async () => {
            controller.abort();
            return resolvedContent;
        });

        await coordinator.switchToChannel('ch1', { signal: controller.signal });

        expect(deps.handleGlobalError).not.toHaveBeenCalled();
        expect(videoPlayer.stop).not.toHaveBeenCalled();
        expect(scheduler.loadChannel).not.toHaveBeenCalled();
        expect(deps.setPendingNowPlayingChannelId).not.toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
        expect(consoleWarnSpy).not.toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    it('queues the latest concurrent channel switch and resolves each caller on its own request completion', async () => {
        const { coordinator, channelManager } = createCoordinator();
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        let resolveDelay: () => void = () => {};

        channelManager.resolveChannelContent.mockImplementation((id) => {
            if (channelManager.resolveChannelContent.mock.calls.length === 1) {
                return new Promise((resolve) => {
                    resolveDelay = (): void => resolve(resolvedContent);
                });
            }
            return Promise.resolve({ ...resolvedContent, channelId: id });
        });

        const switch1 = coordinator.switchToChannel('ch1');
        const switch2 = coordinator.switchToChannel('ch2');

        await Promise.resolve();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('already in progress'));
        expect(channelManager.resolveChannelContent).toHaveBeenCalledTimes(1);

        resolveDelay();
        await switch2;
        await switch1;
        expect(channelManager.resolveChannelContent).toHaveBeenCalledTimes(2);
        expect(channelManager.resolveChannelContent).toHaveBeenNthCalledWith(1, 'ch1', { signal: null });
        expect(channelManager.resolveChannelContent).toHaveBeenNthCalledWith(2, 'ch2', { signal: null });
        expect(channelManager.setCurrentChannel).toHaveBeenLastCalledWith('ch2');

        consoleSpy.mockRestore();
    });

    it('suspends admission, rejects pending work, and drains an abort-ignoring active tune', async () => {
        const { coordinator, channelManager, scheduler, videoPlayer } = createCoordinator();
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        let release: () => void = () => undefined;
        channelManager.resolveChannelContent.mockImplementationOnce(() => new Promise((resolve) => {
            release = (): void => resolve(resolvedContent);
        }));

        const active = coordinator.switchToChannel('ch1');
        const pending = coordinator.switchToChannel('ch2');
        let drainSettled = false;
        const drain = coordinator.suspendAndDrainForScopeTransition().then(() => {
            drainSettled = true;
        });

        await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        await Promise.resolve();
        expect(drainSettled).toBe(false);
        expect(await coordinator.switchToChannel('ch3')).toEqual({ kind: 'aborted' });
        expect(await coordinator.switchToChannelByNumber(3)).toEqual({ kind: 'aborted' });
        expect(channelManager.getChannelByNumber).not.toHaveBeenCalled();
        release();
        await expect(active).resolves.toEqual({ kind: 'aborted' });
        await drain;
        expect(videoPlayer.stop).not.toHaveBeenCalled();
        expect(scheduler.loadChannel).not.toHaveBeenCalled();
        expect(channelManager.supersedeActiveResolutions).toHaveBeenCalledTimes(1);

        coordinator.resumeAfterScopeTransition();
        await expect(coordinator.switchToChannel('ch1')).resolves.toEqual({ kind: 'switched' });
        expect(channelManager.resumeActiveResolutions).toHaveBeenCalledTimes(1);
        consoleSpy.mockRestore();
    });

    it('runs exactly one lineage-bound initial tune while general tuning stays suspended', async () => {
        const { coordinator, channelManager } = createCoordinator();
        await coordinator.suspendAndDrainForScopeTransition();
        const validity = { signal: new AbortController().signal, assertCurrent: jest.fn() };
        const lineage = coordinator.beginInitialTuneLineage([validity]);
        const permit = coordinator.mintInitialTunePermit(lineage);

        await expect(coordinator.switchToInitialChannel('ch1', permit)).resolves.toEqual({
            kind: 'switched',
        });
        await expect(coordinator.switchToInitialChannel('ch1', permit)).rejects.toMatchObject({
            name: 'AbortError',
        });
        expect(channelManager.createInitialTuneResolutionAuthorization).toHaveBeenCalledWith(
            'ch1',
            expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
        expect(channelManager.resolveChannelContentForInitialTune).toHaveBeenCalledTimes(1);
        expect(channelManager.resolveChannelContent).not.toHaveBeenCalled();
        expect(await coordinator.switchToChannel('ch1')).toEqual({ kind: 'aborted' });
        coordinator.completeInitialTuneLineage(lineage);
    });

    it('rejects wrong-lineage and stale initial tune authority without effects', async () => {
        const { coordinator, channelManager, videoPlayer } = createCoordinator();
        await coordinator.suspendAndDrainForScopeTransition();
        const first = coordinator.beginInitialTuneLineage([{ assertCurrent: jest.fn() }]);
        const secondController = new AbortController();
        const second = coordinator.beginInitialTuneLineage([{
            signal: secondController.signal,
            assertCurrent: (): void => {
                if (secondController.signal.aborted) throw secondController.signal.reason;
            },
        }]);
        expect(() => coordinator.mintInitialTunePermit(first)).toThrow(
            expect.objectContaining({ name: 'AbortError' })
        );
        const stalePermit = coordinator.mintInitialTunePermit(second);
        secondController.abort(new DOMException('stale', 'AbortError'));

        await expect(coordinator.switchToInitialChannel('ch1', stalePermit)).rejects.toMatchObject({
            name: 'AbortError',
        });
        expect(channelManager.resolveChannelContentForInitialTune).not.toHaveBeenCalled();
        expect(videoPlayer.stop).not.toHaveBeenCalled();
    });

    it('stops later suffixes when suspension re-enters from a stateful tune callback', async () => {
        const { coordinator, deps, scheduler, videoPlayer, channelManager } = createCoordinator();
        deps.stopActiveTranscodeSession.mockImplementation(() => {
            void coordinator.suspendAndDrainForScopeTransition();
        });

        await expect(coordinator.switchToChannel('ch1')).resolves.toEqual({ kind: 'aborted' });
        expect(videoPlayer.stop).not.toHaveBeenCalled();
        expect(scheduler.loadChannel).not.toHaveBeenCalled();
        expect(channelManager.setCurrentChannel).not.toHaveBeenCalled();
    });

    it('allows the triggering scheduler suffix only and suppresses every later suffix on re-entry', async () => {
        const { coordinator, deps, scheduler, channelManager } = createCoordinator();
        scheduler.loadChannel.mockImplementation(() => {
            void coordinator.suspendAndDrainForScopeTransition();
        });

        await expect(coordinator.switchToChannel('ch1')).resolves.toEqual({ kind: 'aborted' });
        expect(scheduler.loadChannel).toHaveBeenCalledTimes(1);
        expect(deps.setActiveScheduleDayKey).not.toHaveBeenCalled();
        expect(scheduler.syncToCurrentTime).not.toHaveBeenCalled();
        expect(channelManager.setCurrentChannel).not.toHaveBeenCalled();
        expect(deps.saveLifecycleState).not.toHaveBeenCalled();
    });

    it('suppresses the final result when lifecycle persistence re-enters suspension', async () => {
        const { coordinator, deps, channelManager } = createCoordinator();
        deps.saveLifecycleState.mockImplementation(async () => {
            void coordinator.suspendAndDrainForScopeTransition();
        });

        await expect(coordinator.switchToChannel('ch1')).resolves.toEqual({ kind: 'aborted' });
        expect(channelManager.setCurrentChannel).toHaveBeenCalledWith('ch1');
        expect(deps.handleGlobalError).not.toHaveBeenCalledWith(
            expect.objectContaining({ code: AppErrorCode.STORAGE_CORRUPTED }),
            'switchToChannel'
        );
    });

    it('resolves a queued request whose signal was aborted while pending', async () => {
        const { coordinator, channelManager } = createCoordinator();
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        let resolveDelay: () => void = () => {};

        channelManager.resolveChannelContent.mockImplementation((id) => {
            if (channelManager.resolveChannelContent.mock.calls.length === 1) {
                return new Promise((resolve) => {
                    resolveDelay = (): void => resolve(resolvedContent);
                });
            }
            return Promise.resolve({ ...resolvedContent, channelId: id });
        });

        const switch1 = coordinator.switchToChannel('ch1');
        const controller = new AbortController();
        const switch2 = coordinator.switchToChannel('ch2', { signal: controller.signal });

        controller.abort();
        resolveDelay();

        await expect(switch1).resolves.toEqual({ kind: 'switched' });
        await expect(switch2).resolves.toEqual({ kind: 'aborted' });
        expect(channelManager.resolveChannelContent).toHaveBeenCalledTimes(1);
        expect(channelManager.resolveChannelContent).toHaveBeenNthCalledWith(1, 'ch1', { signal: null });
        consoleWarnSpy.mockRestore();
    });

    it('rejects a superseded pending request when a newer request replaces it', async () => {
        const { coordinator, channelManager } = createCoordinator();
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        let resolveDelay: () => void = () => {};

        channelManager.resolveChannelContent.mockImplementation((id) => {
            if (channelManager.resolveChannelContent.mock.calls.length === 1) {
                return new Promise((resolve) => {
                    resolveDelay = (): void => resolve(resolvedContent);
                });
            }
            return Promise.resolve({ ...resolvedContent, channelId: id });
        });

        const switch1 = coordinator.switchToChannel('ch1');
        const switch2 = coordinator.switchToChannel('ch2');
        const switch3 = coordinator.switchToChannel('ch3');

        resolveDelay();

        await expect(switch2).rejects.toMatchObject({ name: 'AbortError' });
        await expect(switch3).resolves.toEqual({ kind: 'switched' });
        await expect(switch1).resolves.toEqual({ kind: 'switched' });
        expect(channelManager.resolveChannelContent).toHaveBeenCalledTimes(2);
        expect(channelManager.resolveChannelContent).toHaveBeenNthCalledWith(1, 'ch1', { signal: null });
        expect(channelManager.resolveChannelContent).toHaveBeenNthCalledWith(2, 'ch3', { signal: null });
        consoleWarnSpy.mockRestore();
    });

    it('reports CHANNEL_NOT_FOUND when switchToChannel misses', async () => {
        const { coordinator, deps, channelManager, videoPlayer, scheduler } = createCoordinator();
        channelManager.getChannel.mockReturnValue(null);

        await coordinator.switchToChannel('missing');

        expect(deps.handleGlobalError).toHaveBeenCalledWith(
            {
                code: AppErrorCode.CHANNEL_NOT_FOUND,
                message: 'Channel missing not found',
                recoverable: true,
            },
            'switchToChannel'
        );
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'channelTuning.channelMissing',
            expect.objectContaining({
                channelId: 'missing',
                code: AppErrorCode.CHANNEL_NOT_FOUND,
                message: 'Channel missing not found',
                recoverable: true,
            })
        );
        expect(videoPlayer.stop).not.toHaveBeenCalled();
        expect(scheduler.loadChannel).not.toHaveBeenCalled();
    });

    it('applies the successful switch contract', async () => {
        const { coordinator, deps, channelManager, scheduler, videoPlayer } = createCoordinator();
        let loadedScheduleChannelId: string | null = null;
        let syncObservedLoadedScheduleChannelId: string | null = null;

        scheduler.loadChannel.mockImplementation((schedule) => {
            loadedScheduleChannelId = schedule.channelId;
        });
        scheduler.syncToCurrentTime.mockImplementation(() => {
            syncObservedLoadedScheduleChannelId = loadedScheduleChannelId;
        });

        await coordinator.switchToChannel('ch1');

        expect(channelManager.resolveChannelContent).toHaveBeenCalledWith('ch1', { signal: null });
        expect(deps.armChannelTransitionForSwitch).toHaveBeenCalledWith('1 Channel 1');
        expect(videoPlayer.stop).toHaveBeenCalledTimes(1);
        expect(scheduler.loadChannel).toHaveBeenCalledWith(expect.objectContaining({
            channelId: 'ch1',
        }));
        expect(scheduler.syncToCurrentTime).toHaveBeenCalledTimes(1);
        expect(syncObservedLoadedScheduleChannelId).toBe('ch1');
        expect(channelManager.setCurrentChannel).toHaveBeenCalledWith('ch1');
        expect(deps.saveLifecycleState).toHaveBeenCalledTimes(1);
    });

    it('clears pending now-playing channel when sync fails', async () => {
        const { coordinator, deps, scheduler } = createCoordinator();
        scheduler.syncToCurrentTime.mockImplementation(() => {
            throw new Error('sync failed');
        });
        deps.getPendingNowPlayingChannelId.mockReturnValue('ch1');

        await expect(coordinator.switchToChannel('ch1')).resolves.toEqual({
            kind: 'failed',
            reason: 'playback_start_failed',
        });

        expect(deps.handleGlobalError).toHaveBeenCalledWith(
            expect.objectContaining({
                code: AppErrorCode.CONTENT_UNAVAILABLE,
                recoverable: true,
            }),
            'switchToChannel'
        );
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'channelTuning.schedulerSyncFailed',
            expect.objectContaining({
                channelId: 'ch1',
                code: AppErrorCode.CONTENT_UNAVAILABLE,
                message: 'Unable to start scheduled playback.',
                recoverable: true,
                error: {
                    name: 'Error',
                    message: 'sync failed',
                },
            })
        );
        expect(scheduler.unloadChannel).toHaveBeenCalledTimes(1);
        expect(deps.setPendingNowPlayingChannelId).toHaveBeenCalledWith(null);
    });

    it('returns switched outcome even when lifecycle save fails', async () => {
        const { coordinator, deps } = createCoordinator();
        deps.saveLifecycleState.mockRejectedValueOnce(new Error('save failed'));

        await expect(coordinator.switchToChannel('ch1')).resolves.toEqual({ kind: 'switched' });
        expect(deps.handleGlobalError).toHaveBeenCalledWith(
            expect.objectContaining({
                code: AppErrorCode.STORAGE_CORRUPTED,
                message: 'save failed',
                recoverable: true,
                context: expect.objectContaining({
                    channelId: 'ch1',
                    operation: 'switchToChannel',
                    step: 'saveLifecycleState',
                    errorSummary: expect.objectContaining({
                        name: 'Error',
                        message: 'save failed',
                    }),
                }),
            }),
            'switchToChannel'
        );
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'channelTuning.lifecycleSaveFailed',
            expect.objectContaining({
                channelId: 'ch1',
                code: AppErrorCode.STORAGE_CORRUPTED,
                message: 'save failed',
                recoverable: true,
                error: {
                    name: 'Error',
                    message: 'save failed',
                },
            })
        );
    });

    it('reports CHANNEL_NOT_FOUND when switchToChannelByNumber misses', async () => {
        const { coordinator, deps, channelManager } = createCoordinator();
        channelManager.getChannelByNumber.mockReturnValue(null);

        await expect(coordinator.switchToChannelByNumber(999)).resolves.toEqual({
            kind: 'failed',
            reason: 'missing_channel',
        });

        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'channelTuning.channelMissingByNumber',
            expect.objectContaining({
                attemptedChannelNumber: 999,
                code: AppErrorCode.CHANNEL_NOT_FOUND,
                message: 'Channel 999 not found',
                recoverable: true,
            })
        );
        expect(deps.handleGlobalError).toHaveBeenCalledWith(
            expect.objectContaining({
                code: AppErrorCode.CHANNEL_NOT_FOUND,
                message: 'Channel 999 not found',
                recoverable: true,
                context: expect.objectContaining({
                    operation: 'switchToChannelByNumber',
                    attemptedChannelNumber: 999,
                }),
            }),
            'switchToChannelByNumber'
        );
    });

    it('returns aborted outcome when switchToChannelByNumber is aborted before execution', async () => {
        const { coordinator } = createCoordinator();
        const controller = new AbortController();
        controller.abort();

        await expect(
            coordinator.switchToChannelByNumber(1, { signal: controller.signal })
        ).resolves.toEqual({ kind: 'aborted' });
    });

    it('still reports the normalized app error when diagnostics append fails', async () => {
        const { coordinator, deps, channelManager } = createCoordinator();
        deps.appendIssueDiagnostic.mockImplementation(() => {
            throw new Error('diagnostic failed');
        });
        channelManager.resolveChannelContent.mockRejectedValue({
            code: 'NOT_A_REAL_CODE',
            message: 'foreign error',
            recoverable: false,
        });

        await expect(coordinator.switchToChannel('ch1')).resolves.toEqual({
            kind: 'failed',
            reason: 'content_unavailable',
        });

        expect(deps.handleGlobalError).toHaveBeenCalledWith(
            expect.objectContaining({
                code: AppErrorCode.CONTENT_UNAVAILABLE,
                message: 'foreign error',
                recoverable: false,
                context: expect.objectContaining({
                    errorSummary: expect.objectContaining({
                        code: 'NOT_A_REAL_CODE',
                        message: 'foreign error',
                    }),
                }),
            }),
            'switchToChannel'
        );
    });

    it('reports switchToChannelByNumber failures through the shared error contract', async () => {
        const { coordinator, deps } = createCoordinator();
        jest.spyOn(coordinator, 'switchToChannel').mockRejectedValueOnce(new Error('switch failed'));

        await expect(coordinator.switchToChannelByNumber(1)).resolves.toEqual({
            kind: 'failed',
            reason: 'content_unavailable',
        });

        expect(deps.handleGlobalError).toHaveBeenCalledWith(
            expect.objectContaining({
                code: AppErrorCode.CONTENT_UNAVAILABLE,
                message: 'switch failed',
                recoverable: true,
                context: expect.objectContaining({
                    attemptedChannelNumber: 1,
                    operation: 'switchToChannelByNumber',
                    errorSummary: expect.objectContaining({
                        name: 'Error',
                        message: 'switch failed',
                    }),
                }),
            }),
            'switchToChannelByNumber'
        );
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'channelTuning.switchByNumberFailed',
            expect.objectContaining({
                attemptedChannelNumber: 1,
                code: AppErrorCode.CONTENT_UNAVAILABLE,
                message: 'switch failed',
                recoverable: true,
                error: {
                    name: 'Error',
                    message: 'switch failed',
                },
            })
        );
    });

    it('records non-fatal channel transition arm failures and still switches', async () => {
        const { coordinator, deps } = createCoordinator();
        deps.armChannelTransitionForSwitch.mockImplementation(() => {
            throw new Error('transition failed');
        });

        await expect(coordinator.switchToChannel('ch1')).resolves.toEqual({ kind: 'switched' });

        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'channelTuning.channelTransitionArmFailed',
            expect.objectContaining({
                channelId: 'ch1',
                channelPrefix: '1 Channel 1',
                code: AppErrorCode.UI_RENDER_ERROR,
                message: 'transition failed',
                recoverable: true,
                error: {
                    name: 'Error',
                    message: 'transition failed',
                },
            })
        );
        expect(deps.handleGlobalError).toHaveBeenCalledWith(
            expect.objectContaining({
                code: AppErrorCode.UI_RENDER_ERROR,
                message: 'transition failed',
                recoverable: true,
                context: expect.objectContaining({
                    channelId: 'ch1',
                    channelPrefix: '1 Channel 1',
                    operation: 'switchToChannel',
                    step: 'armChannelTransitionForSwitch',
                    errorSummary: expect.objectContaining({
                        name: 'Error',
                        message: 'transition failed',
                    }),
                }),
            }),
            'switchToChannel'
        );
    });

    it('reports scheduler cleanup failures through the shared error contract', async () => {
        const { coordinator, deps, scheduler } = createCoordinator();
        scheduler.syncToCurrentTime.mockImplementation(() => {
            throw new Error('sync failed');
        });
        scheduler.unloadChannel.mockImplementation(() => {
            throw new Error('unload failed');
        });

        await expect(coordinator.switchToChannel('ch1')).resolves.toEqual({
            kind: 'failed',
            reason: 'playback_start_failed',
        });

        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'channelTuning.schedulerUnloadFailed',
            expect.objectContaining({
                channelId: 'ch1',
                failedStep: 'scheduler.syncToCurrentTime',
                code: AppErrorCode.PLAYBACK_FAILED,
                message: 'unload failed',
                recoverable: true,
                error: {
                    name: 'Error',
                    message: 'unload failed',
                },
            })
        );
        expect(deps.handleGlobalError).toHaveBeenCalledWith(
            expect.objectContaining({
                code: AppErrorCode.PLAYBACK_FAILED,
                message: 'unload failed',
                recoverable: true,
                context: expect.objectContaining({
                    channelId: 'ch1',
                    failedStep: 'scheduler.syncToCurrentTime',
                    operation: 'switchToChannel',
                    errorSummary: expect.objectContaining({
                        name: 'Error',
                        message: 'unload failed',
                    }),
                }),
            }),
            'switchToChannel'
        );
    });
});
