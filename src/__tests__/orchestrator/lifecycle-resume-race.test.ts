/* eslint-disable @typescript-eslint/explicit-function-return-type */
import type { StreamDescriptor } from '../../modules/player';
import type { ScheduledProgram } from '../../modules/scheduler/scheduler';
import type { IAppLifecycle } from '../../modules/lifecycle';
import type { IVideoPlayer } from '../../modules/player';
import type { IChannelScheduler } from '../../modules/scheduler/scheduler';
import {
    OrchestratorEventBinder,
    PlaybackRuntimeController,
    PlaybackStartController,
} from '../../core';
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
        getVideoPlayer: () => overrides.videoPlayer,
        resolveStreamForProgram: (program) => overrides.playbackRecovery.resolveStreamForProgram(program),
        resetPlaybackFailureGuard: () => overrides.playbackRecovery.resetPlaybackFailureGuard(),
        tryHandleStreamResolverAuthError: (error) => overrides.playbackRecovery.tryHandleStreamResolverAuthError(error),
        tryHandleStreamResolverPermissionError: () => false,
        handlePlaybackFailure: (context, error) => overrides.playbackRecovery.handlePlaybackFailure(context, error),
        logPlaybackStartFailure: () => undefined,
        markProgramStarting: (program) => {
            currentProgram = program;
            return {
                programAtStart: program,
                shouldResetAutoShowInfoBannerOnAbort: false,
            };
        },
        isProgramStillCurrent: (program) => currentProgram === program,
        handleProgramStartUiSideEffects: () => undefined,
        handleStreamResolved: () => undefined,
        clearAutoShowInfoBannerAfterAbortedStart: () => undefined,
    });

    const playbackRuntimeController = new PlaybackRuntimeController({
        isStreamRecoveryInProgress: () => false,
        getActiveTranscodeSessionId: () => null,
        stopTranscodeSession: () => undefined,
        skipToNextProgram: () => undefined,
        pausePlayer: () => undefined,
        playPlayer: () => overrides.videoPlayer.play(),
        pauseSchedulerSync: () => undefined,
        resumeSchedulerSync: () => overrides.scheduler.resumeSyncTimer(),
        syncSchedulerToCurrentTime: () => overrides.scheduler.syncToCurrentTime(),
        saveLifecycleState: async () => undefined,
        handleGlobalError: () => undefined,
        handlePlaybackFailure: () => undefined,
        onPlayerStateChange: () => undefined,
        shouldAutoShowInfoBannerOnNextPlay: () => false,
        clearAutoShowInfoBannerOnNextPlay: () => undefined,
        showInfoBanner: () => undefined,
        onPlayerTimeUpdate: () => undefined,
        onPlayerBufferUpdate: () => undefined,
    });

    const binder = new OrchestratorEventBinder({
        getScheduler: () => overrides.scheduler as unknown as IChannelScheduler,
        getVideoPlayer: () => overrides.videoPlayer as unknown as IVideoPlayer,
        getPlexLibrary: () => null,
        getPlexStreamResolver: () => null,
        getNavigation: () => null,
        getLifecycle: () => overrides.lifecycle as unknown as IAppLifecycle,
        getChannelManager: () => null,
        wireNavigationCoordinatorEvents: () => [],
        wireEpgCoordinatorEvents: () => [],
        handleProgramStartTracked: (program): Promise<void> => {
            const promise = playbackStartController.handleProgramStart(program);
            return playbackRuntimeController.trackProgramStart(promise);
        },
        handleScheduleDayRollover: async () => undefined,
        handlePlayerEnded: () => undefined,
        handlePlayerTrackChange: () => undefined,
        handlePlaybackError: () => undefined,
        handlePlayerStateChange: () => undefined,
        handlePlayerTimeUpdate: () => undefined,
        handlePlayerBufferUpdate: () => undefined,
        handlePlexLibraryAuthExpired: () => undefined,
        handlePlexStreamError: () => undefined,
        handleScreenChange: () => undefined,
        handleLifecyclePause: () => playbackRuntimeController.handleLifecyclePause(),
        handleLifecycleResume: () => playbackRuntimeController.handleLifecycleResume(),
        reportPersistenceWarning: () => undefined,
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
        let programStartHandler: (p: ScheduledProgram) => void = () => {
            throw new Error('Expected scheduler programStart handler to be registered');
        };
        const scheduler: SchedulerLike = {
            on: jest.fn((event: 'programStart' | 'programEnd' | 'scheduleSync', handler: unknown) => {
                if (event !== 'programStart') return;
                registeredProgramStart = true;
                programStartHandler = handler as (program: ScheduledProgram) => void;
            }),
            off: jest.fn(),
            resumeSyncTimer: jest.fn(),
            syncToCurrentTime: jest.fn(() => {
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
        let resumeCallback: () => Promise<void> = () => {
            throw new Error('Expected lifecycle onResume callback to be registered');
        };
        const lifecycle = {
            onPause: jest.fn(() => ({ dispose: (): void => undefined })),
            onResume: jest.fn((callback: () => Promise<void>) => {
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
        let programStartHandler: (p: ScheduledProgram) => void = () => {
            throw new Error('Expected scheduler programStart handler to be registered');
        };
        const scheduler: SchedulerLike = {
            on: jest.fn((event: 'programStart' | 'programEnd' | 'scheduleSync', handler: unknown) => {
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
                .mockImplementationOnce(() => loadA.promise)
                .mockResolvedValueOnce(undefined),
            play: jest.fn().mockResolvedValue(undefined),
        };

        const lifecycle = {
            onPause: jest.fn(() => ({ dispose: (): void => undefined })),
            onResume: jest.fn(() => ({ dispose: (): void => undefined })),
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
