import type { StreamDescriptor } from '../../modules/player';
import type { ScheduledProgram } from '../../modules/scheduler/scheduler';
import type { IAppLifecycle } from '../../modules/lifecycle';
import type { IVideoPlayer } from '../../modules/player';
import type { IChannelScheduler } from '../../modules/scheduler/scheduler';
import { OrchestratorEventBinder } from '../../core/orchestrator/events/OrchestratorEventBinder';
import { PlaybackRuntimeController } from '../../core/orchestrator/priority-one/PlaybackRuntimeController';
import { PlaybackStartController } from '../../core/orchestrator/priority-one/PlaybackStartController';
import { createDeferred, flushPromises } from '../helpers';

const wireLifecycleResumeHarness = (overrides: {
    scheduler: {
        on: (event: 'programStart' | 'programEnd' | 'scheduleSync', handler: unknown) => void;
        off: (event: 'programStart' | 'programEnd' | 'scheduleSync', handler: unknown) => void;
        resumeSyncTimer: () => void;
        syncToCurrentTime: () => void;
    };
    videoPlayer: {
        on: (event: string, handler: unknown) => void;
        off: (event: string, handler: unknown) => void;
        loadStream: (stream: StreamDescriptor) => Promise<void>;
        play: () => Promise<void>;
    };
    lifecycle: Pick<IAppLifecycle, 'onPause' | 'onResume'>;
    playbackRecovery: {
        resolveStreamForProgram: (program: ScheduledProgram) => Promise<StreamDescriptor | null | undefined>;
        resetPlaybackFailureGuard: () => void;
        tryHandleStreamResolverAuthError: (error: unknown) => boolean;
        handlePlaybackFailure: (context: string, error: unknown) => void;
    };
}): void => {
    let currentProgram: ScheduledProgram | null = null;

    const playbackStartController = new PlaybackStartController({
        getVideoPlayer: (): typeof overrides.videoPlayer => overrides.videoPlayer,
        resolveStreamForProgram: (program): Promise<StreamDescriptor | null | undefined> =>
            overrides.playbackRecovery.resolveStreamForProgram(program),
        resetPlaybackFailureGuard: (): void => overrides.playbackRecovery.resetPlaybackFailureGuard(),
        tryHandleStreamResolverAuthError: (error): boolean =>
            overrides.playbackRecovery.tryHandleStreamResolverAuthError(error),
        tryHandleStreamResolverPermissionError: (): boolean => false,
        handlePlaybackFailure: (context, error): void =>
            overrides.playbackRecovery.handlePlaybackFailure(context, error),
        logPlaybackStartFailure: (): void => undefined,
        markProgramStarting: (program): {
            programAtStart: ScheduledProgram;
            shouldResetAutoShowInfoBannerOnAbort: boolean;
        } => {
            currentProgram = program;
            return {
                programAtStart: program,
                shouldResetAutoShowInfoBannerOnAbort: false,
            };
        },
        isProgramStillCurrent: (program): boolean => currentProgram === program,
        handleProgramStartUiSideEffects: (): void => undefined,
        handleStreamResolved: (): void => undefined,
        clearAutoShowInfoBannerAfterAbortedStart: (): void => undefined,
    });

    const playbackRuntimeController = new PlaybackRuntimeController({
        isStreamRecoveryInProgress: (): boolean => false,
        getActiveTranscodeSessionId: (): string | null => null,
        stopTranscodeSession: (): void => undefined,
        skipToNextProgram: (): void => undefined,
        pausePlayer: (): void => undefined,
        playPlayer: (): Promise<void> => overrides.videoPlayer.play(),
        pauseSchedulerSync: (): void => undefined,
        resumeSchedulerSync: (): void => overrides.scheduler.resumeSyncTimer(),
        syncSchedulerToCurrentTime: (): void => overrides.scheduler.syncToCurrentTime(),
        saveLifecycleState: async (): Promise<void> => undefined,
        handleGlobalError: (): void => undefined,
        handlePlaybackFailure: (): void => undefined,
        onPlayerStateChange: (): void => undefined,
        shouldAutoShowInfoBannerOnNextPlay: (): boolean => false,
        clearAutoShowInfoBannerOnNextPlay: (): void => undefined,
        showInfoBanner: (): void => undefined,
        onPlayerTimeUpdate: (): void => undefined,
        onPlayerBufferUpdate: (): void => undefined,
    });

    const binder = new OrchestratorEventBinder({
        cleanupReporter: (): void => undefined,
        getScheduler: (): IChannelScheduler => overrides.scheduler as unknown as IChannelScheduler,
        getVideoPlayer: (): IVideoPlayer => overrides.videoPlayer as unknown as IVideoPlayer,
        getPlexLibrary: (): null => null,
        getPlexStreamResolver: (): null => null,
        getNavigation: (): null => null,
        getLifecycle: (): IAppLifecycle => overrides.lifecycle as unknown as IAppLifecycle,
        getChannelManager: (): null => null,
        wireNavigationCoordinatorEvents: (): Array<() => void> => [],
        wireEpgCoordinatorEvents: (): Array<() => void> => [],
        handleProgramStartTracked: (program): Promise<void> => {
            const promise = playbackStartController.handleProgramStart(program);
            return playbackRuntimeController.trackProgramStart(promise);
        },
        handleScheduleDayRollover: async (): Promise<void> => undefined,
        handlePlayerEnded: (): void => undefined,
        handlePlayerTrackChange: (): void => undefined,
        handlePlaybackError: (): void => undefined,
        handlePlayerStateChange: (): void => undefined,
        handlePlayerTimeUpdate: (): void => undefined,
        handlePlayerBufferUpdate: (): void => undefined,
        handlePlexLibraryAuthExpired: (): void => undefined,
        handlePlexStreamError: (): void => undefined,
        handleScreenChange: (): void => undefined,
        handleLifecyclePause: (): Promise<void> => playbackRuntimeController.handleLifecyclePause(),
        handleLifecycleResume: (): Promise<void> => playbackRuntimeController.handleLifecycleResume(),
        reportPersistenceWarning: (): void => undefined,
        reportRecoverableAsyncFailure: (): void => undefined,
    });

    binder.bind();
};

describe('AppOrchestrator lifecycle resume', () => {
    it('does not call videoPlayer.play() on resume when sync triggers programStart handling', async () => {
        const program = {
            scheduleIndex: 0,
            loopNumber: 0,
            scheduledStartTime: 0,
            scheduledEndTime: 1,
            elapsedMs: 0,
            remainingMs: 1,
            item: { durationMs: 1 },
        } as unknown as ScheduledProgram;

        const stream = { url: 'https://example.invalid/stream.m3u8' } as unknown as StreamDescriptor;

        type SchedulerLike = {
            on: jest.Mock<void, [event: 'programStart' | 'programEnd' | 'scheduleSync', handler: unknown]>;
            off: jest.Mock;
            resumeSyncTimer: jest.Mock;
            syncToCurrentTime: jest.Mock;
        };

        let registeredProgramStart = false;
        let programStartHandler: (p: ScheduledProgram) => void = (): void => {
            throw new Error('Expected scheduler programStart handler to be registered');
        };
        const scheduler: SchedulerLike = {
            on: jest.fn((event: 'programStart' | 'programEnd' | 'scheduleSync', handler: unknown): void => {
                if (event !== 'programStart') return;
                registeredProgramStart = true;
                programStartHandler = handler as (program: ScheduledProgram) => void;
            }),
            off: jest.fn(),
            resumeSyncTimer: jest.fn(),
            syncToCurrentTime: jest.fn((): void => {
                programStartHandler(program);
            }),
        };

        const loadDeferred = createDeferred<void>();
        const videoPlayer = {
            on: jest.fn(),
            off: jest.fn(),
            loadStream: jest.fn(() => loadDeferred.promise),
            play: jest.fn().mockResolvedValue(undefined),
        };

        let registeredResume = false;
        let resumeCallback: () => Promise<void> = async (): Promise<void> => {
            throw new Error('Expected lifecycle onResume callback to be registered');
        };
        const lifecycle = {
            onPause: jest.fn((): { dispose: () => void } => ({ dispose: (): void => undefined })),
            onResume: jest.fn((callback: () => Promise<void>): { dispose: () => void } => {
                registeredResume = true;
                resumeCallback = callback;
                return { dispose: (): void => undefined };
            }),
        };

        const playbackRecovery = {
            resolveStreamForProgram: jest.fn().mockResolvedValue(stream),
            resetPlaybackFailureGuard: jest.fn(),
            tryHandleStreamResolverAuthError: jest.fn().mockReturnValue(false),
            handlePlaybackFailure: jest.fn(),
        };

        wireLifecycleResumeHarness({ scheduler, videoPlayer, lifecycle, playbackRecovery });

        expect(registeredProgramStart).toBe(true);
        expect(registeredResume).toBe(true);
        const resumePromise = resumeCallback();

        // With the fix, resume waits for the in-flight programStart handling and does not issue a separate play().
        expect(videoPlayer.play).toHaveBeenCalledTimes(0);

        loadDeferred.resolve(undefined);
        await resumePromise;

        expect(videoPlayer.play).toHaveBeenCalledTimes(1);
    });

    it('suppresses stale programStart play() when a newer programStart arrives during loadStream', async () => {
        const programA = {
            scheduleIndex: 0,
            loopNumber: 0,
            scheduledStartTime: 0,
            scheduledEndTime: 1,
            elapsedMs: 0,
            remainingMs: 1,
            item: { durationMs: 1 },
        } as unknown as ScheduledProgram;

        const programB = {
            scheduleIndex: 1,
            loopNumber: 0,
            scheduledStartTime: 1,
            scheduledEndTime: 2,
            elapsedMs: 0,
            remainingMs: 1,
            item: { durationMs: 1 },
        } as unknown as ScheduledProgram;

        const streamA = { url: 'https://example.invalid/stream-a.m3u8' } as unknown as StreamDescriptor;
        const streamB = { url: 'https://example.invalid/stream-b.m3u8' } as unknown as StreamDescriptor;

        type SchedulerLike = {
            on: jest.Mock<void, [event: 'programStart' | 'programEnd' | 'scheduleSync', handler: unknown]>;
            off: jest.Mock;
            resumeSyncTimer: jest.Mock;
            syncToCurrentTime: jest.Mock;
        };

        let registeredProgramStart = false;
        let programStartHandler: (p: ScheduledProgram) => void = (): void => {
            throw new Error('Expected scheduler programStart handler to be registered');
        };
        const scheduler: SchedulerLike = {
            on: jest.fn((event: 'programStart' | 'programEnd' | 'scheduleSync', handler: unknown): void => {
                if (event !== 'programStart') return;
                registeredProgramStart = true;
                programStartHandler = handler as (program: ScheduledProgram) => void;
            }),
            off: jest.fn(),
            resumeSyncTimer: jest.fn(),
            syncToCurrentTime: jest.fn(),
        };

        const loadA = createDeferred<void>();
        const videoPlayer = {
            on: jest.fn(),
            off: jest.fn(),
            loadStream: jest.fn()
                .mockImplementationOnce((): Promise<void> => loadA.promise)
                .mockResolvedValueOnce(undefined),
            play: jest.fn().mockResolvedValue(undefined),
        };

        const lifecycle = {
            onPause: jest.fn((): { dispose: () => void } => ({ dispose: (): void => undefined })),
            onResume: jest.fn((): { dispose: () => void } => ({ dispose: (): void => undefined })),
        };

        const playbackRecovery = {
            resolveStreamForProgram: jest.fn()
                .mockResolvedValueOnce(streamA)
                .mockResolvedValueOnce(streamB),
            resetPlaybackFailureGuard: jest.fn(),
            tryHandleStreamResolverAuthError: jest.fn().mockReturnValue(false),
            handlePlaybackFailure: jest.fn(),
        };

        wireLifecycleResumeHarness({ scheduler, videoPlayer, lifecycle, playbackRecovery });

        expect(registeredProgramStart).toBe(true);

        // First program starts, but loadStream is still in-flight.
        programStartHandler(programA);
        await flushPromises(6);
        expect(videoPlayer.loadStream).toHaveBeenCalledTimes(1);
        expect(videoPlayer.play).toHaveBeenCalledTimes(0);

        // Second program starts before the first finishes loading.
        programStartHandler(programB);
        await flushPromises(6);
        expect(videoPlayer.loadStream).toHaveBeenCalledTimes(2);

        // Allow program B to complete its load+play first.
        await flushPromises(6);
        expect(videoPlayer.play).toHaveBeenCalledTimes(1);

        // Now resolve the first load; stale handler must not play.
        loadA.resolve(undefined);
        await flushPromises(6);

        expect(videoPlayer.play).toHaveBeenCalledTimes(1);
    });
});
