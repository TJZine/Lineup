import { AppErrorCode } from '../../types/app-errors';
import { createDeferred } from '../../__tests__/helpers';
import {
    type PlaybackError,
    type PlaybackState,
    type TimeRange,
} from '../../modules/player';
import type { StreamDecision } from '../../modules/plex/stream';
import {
    PlaybackRuntimeController,
    type PlaybackRuntimeControllerDeps,
} from '../orchestrator/priority-one/PlaybackRuntimeController';
import type { OrchestratorPlaybackStateAccessors } from '../orchestrator/runtime/OrchestratorPlaybackStateAccessors';
import type { PlaybackStartOutcome } from '../../types/playbackStart';

const requiredPlaybackPreparationStubs = {
    resolveStreamForProgram: jest.fn(),
    discardPreparedStream: jest.fn(),
};

const makePlaybackState = (
    overrides: Partial<jest.Mocked<OrchestratorPlaybackStateAccessors>> = {}
): jest.Mocked<OrchestratorPlaybackStateAccessors> => ({
    getCurrentProgramForPlayback: jest.fn().mockReturnValue(null),
    setCurrentProgramForPlayback: jest.fn(),
    getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
    setCurrentStreamDescriptor: jest.fn(),
    getCurrentStreamDecision: jest.fn<StreamDecision | null, []>().mockReturnValue({
        isTranscoding: true,
        sessionId: 'session-123',
    } as StreamDecision),
    setCurrentStreamDecision: jest.fn(),
    getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
    setPendingNowPlayingChannelId: jest.fn(),
    getShouldAutoShowInfoBannerOnNextPlay: jest.fn().mockReturnValue(false),
    setShouldAutoShowInfoBannerOnNextPlay: jest.fn(),
    ...overrides,
});

const makePlaybackMocks = (
    callOrder: string[],
    playbackState = makePlaybackState()
): jest.Mocked<PlaybackRuntimeControllerDeps['playback']> => ({
    playbackState,
    playbackRecovery: {
        ...requiredPlaybackPreparationStubs,
        isStreamRecoveryInProgress: jest.fn<boolean, []>().mockReturnValue(false),
        attemptTranscodeFallbackForCurrentProgram: jest.fn().mockResolvedValue(false),
        handlePlaybackFailure: jest.fn(),
    },
    stopPlayback: jest.fn(),
    unloadCurrentChannel: jest.fn(),
    stopTranscodeSessionById: jest.fn<void, [string]>((sessionId: string) => {
        callOrder.push(`stop:${sessionId}`);
    }),
    skipToNextProgram: jest.fn<void, []>(() => {
        callOrder.push('skip');
    }),
    pausePlayer: jest.fn<void, []>(() => {
        callOrder.push('pause-player');
    }),
    playPlayer: jest.fn<Promise<void>, []>(async () => {
        callOrder.push('play-player');
    }),
});

const makeSchedulerRuntimeMocks = (
    callOrder: string[]
): jest.Mocked<PlaybackRuntimeControllerDeps['schedulerRuntime']> => ({
    cancelPendingDayRollover: jest.fn(),
    pauseSchedulerSync: jest.fn<void, []>(() => {
        callOrder.push('pause-scheduler');
    }),
    resumeSchedulerSync: jest.fn<void, []>(() => {
        callOrder.push('resume-scheduler');
    }),
    syncSchedulerToCurrentTime: jest.fn<void, []>(() => {
        callOrder.push('sync-scheduler');
    }),
});

const makeSetup = (
    overrides: Partial<PlaybackRuntimeControllerDeps> | ((
        callOrder: string[]
    ) => Partial<PlaybackRuntimeControllerDeps>) = {}
): {
    controller: PlaybackRuntimeController;
    deps: jest.Mocked<PlaybackRuntimeControllerDeps>;
    callOrder: string[];
} => {
    const callOrder: string[] = [];
    const playbackState = makePlaybackState();
    const resolvedOverrides =
        typeof overrides === 'function' ? overrides(callOrder) : overrides;
    const deps = {
        playback: makePlaybackMocks(callOrder, playbackState),
        schedulerRuntime: makeSchedulerRuntimeMocks(callOrder),
        playerEvents: {
            onPlayerStateChange: jest.fn(),
            onPlayerTimeUpdate: jest.fn(),
            onPlayerBufferUpdate: jest.fn(),
        },
        uiRuntime: {
            handleGlobalError: jest.fn(),
            showInfoBanner: jest.fn(),
        },
        saveLifecycleState: jest.fn<Promise<void>, []>(async () => {
            callOrder.push('save-lifecycle-state');
        }),
        reportRecoverableAsyncFailure: jest.fn(),
        ...resolvedOverrides,
    } as jest.Mocked<PlaybackRuntimeControllerDeps>;

    return {
        controller: new PlaybackRuntimeController(deps),
        deps,
        callOrder,
    };
};

const flushPlaybackErrorHandling = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
};

describe('PlaybackRuntimeController', () => {
    it('does nothing on ended while stream recovery is in progress', () => {
        const { controller, deps, callOrder } = makeSetup((callOrder) => ({
            playback: {
                ...makePlaybackMocks(callOrder),
                playbackRecovery: {
                    ...requiredPlaybackPreparationStubs,
                    isStreamRecoveryInProgress: jest.fn().mockReturnValue(true),
                },
            },
        }));

        controller.handlePlayerEnded();

        expect(deps.playback.stopTranscodeSessionById).not.toHaveBeenCalled();
        expect(deps.playback.skipToNextProgram).not.toHaveBeenCalled();
        expect(callOrder).toEqual([]);
    });

    it('ignores player errors while stream recovery is in progress', () => {
        const error: PlaybackError = {
            code: AppErrorCode.PLAYBACK_DECODE_ERROR,
            message: 'fatal during stream recovery',
            recoverable: false,
            retryCount: 0,
        };
        const handlePlaybackFailure = jest.fn();
        const { controller, deps } = makeSetup((callOrder) => ({
            playback: {
                ...makePlaybackMocks(callOrder),
                playbackRecovery: {
                    ...requiredPlaybackPreparationStubs,
                    isStreamRecoveryInProgress: jest.fn<boolean, []>().mockReturnValue(true),
                    handlePlaybackFailure,
                },
            },
        }));

        controller.handlePlaybackError(error);

        expect(handlePlaybackFailure).not.toHaveBeenCalled();
        expect(deps.uiRuntime.handleGlobalError).not.toHaveBeenCalled();
        expect(deps.playback.stopTranscodeSessionById).not.toHaveBeenCalled();
        expect(deps.playback.skipToNextProgram).not.toHaveBeenCalled();
    });

    it('stops the active transcode session before skipping to next on ended when recovery is idle', () => {
        const { controller, deps, callOrder } = makeSetup();

        controller.handlePlayerEnded();

        expect(deps.playback.stopTranscodeSessionById).toHaveBeenCalledTimes(1);
        expect(deps.playback.stopTranscodeSessionById).toHaveBeenCalledWith('session-123');
        expect(deps.playback.skipToNextProgram).toHaveBeenCalledTimes(1);
        expect(callOrder).toEqual(['stop:session-123', 'skip']);
    });

    it('no-ops stopActiveTranscodeSession when no active transcode session id exists', () => {
        const { controller, deps } = makeSetup((callOrder) => ({
            playback: {
                ...makePlaybackMocks(callOrder),
                playbackState: makePlaybackState({
                    getCurrentStreamDecision: jest.fn().mockReturnValue(null),
                }),
            },
        }));

        controller.stopActiveTranscodeSession();

        expect(deps.playback.stopTranscodeSessionById).not.toHaveBeenCalled();
    });

    it('routes recoverable player errors through handleGlobalError and skips playback failure handling', () => {
        const error: PlaybackError = {
            code: AppErrorCode.NETWORK_TIMEOUT,
            message: 'recoverable',
            recoverable: true,
            retryCount: 0,
        };
        const { controller, deps } = makeSetup();

        controller.handlePlaybackError(error);

        expect(deps.uiRuntime.handleGlobalError).toHaveBeenCalledTimes(1);
        expect(deps.uiRuntime.handleGlobalError).toHaveBeenCalledWith(
            expect.objectContaining({
                code: AppErrorCode.NETWORK_TIMEOUT,
                message: 'recoverable',
                recoverable: true,
            }),
            'video-player'
        );
        expect(deps.playback.playbackRecovery.handlePlaybackFailure).not.toHaveBeenCalled();
    });

    it('routes non-recoverable player errors through handlePlaybackFailure when transcode fallback does not apply', async () => {
        const error: PlaybackError = {
            code: AppErrorCode.PLAYBACK_DECODE_ERROR,
            message: 'fatal',
            recoverable: false,
            retryCount: 0,
        };
        const { controller, deps } = makeSetup();

        controller.handlePlaybackError(error);
        await flushPlaybackErrorHandling();

        expect(deps.playback.playbackRecovery.attemptTranscodeFallbackForCurrentProgram).toHaveBeenCalledWith('video-player');
        expect(deps.playback.playbackRecovery.handlePlaybackFailure).toHaveBeenCalledTimes(1);
        expect(deps.playback.playbackRecovery.handlePlaybackFailure).toHaveBeenCalledWith('video-player', error);
        expect(deps.uiRuntime.handleGlobalError).not.toHaveBeenCalled();
    });

    it('attempts transcode fallback before surfacing non-recoverable player errors', async () => {
        const error: PlaybackError = {
            code: AppErrorCode.PLAYBACK_DECODE_ERROR,
            message: 'fatal',
            recoverable: false,
            retryCount: 0,
        };
        const { controller, deps } = makeSetup();
        deps.playback.playbackRecovery.attemptTranscodeFallbackForCurrentProgram = jest.fn().mockResolvedValue(true);

        controller.handlePlaybackError(error);
        await flushPlaybackErrorHandling();

        expect(deps.playback.playbackRecovery.attemptTranscodeFallbackForCurrentProgram).toHaveBeenCalledWith('video-player');
        expect(deps.playback.playbackRecovery.handlePlaybackFailure).not.toHaveBeenCalled();
        expect(deps.uiRuntime.handleGlobalError).not.toHaveBeenCalled();
    });

    it('invokes non-recoverable playback failure handling with its recovery object binding', async () => {
        const error: PlaybackError = {
            code: AppErrorCode.PLAYBACK_DECODE_ERROR,
            message: 'fatal',
            recoverable: false,
            retryCount: 0,
        };
        const playbackRecovery = {
            ...requiredPlaybackPreparationStubs,
            handledContext: null as string | null,
            isStreamRecoveryInProgress: jest.fn<boolean, []>().mockReturnValue(false),
            attemptTranscodeFallbackForCurrentProgram: jest.fn().mockResolvedValue(false),
            handlePlaybackFailure(context: string): void {
                this.handledContext = context;
            },
        };
        const { controller, deps } = makeSetup((callOrder) => ({
            playback: {
                ...makePlaybackMocks(callOrder),
                playbackRecovery,
            },
        }));

        controller.handlePlaybackError(error);
        await flushPlaybackErrorHandling();

        expect(playbackRecovery.handledContext).toBe('video-player');
        expect(deps.uiRuntime.handleGlobalError).not.toHaveBeenCalled();
    });

    it('reports playback failure handler errors and still routes fatal playback errors to the UI surface', async () => {
        const error: PlaybackError = {
            code: AppErrorCode.PLAYBACK_DECODE_ERROR,
            message: 'fatal',
            recoverable: false,
            retryCount: 0,
        };
        const handlerError = { code: 'RECOVERY_HANDLER_FAILED', message: 'handler failed' };
        const { controller, deps } = makeSetup((callOrder) => ({
            playback: {
                ...makePlaybackMocks(callOrder),
                playbackRecovery: {
                    ...requiredPlaybackPreparationStubs,
                    isStreamRecoveryInProgress: jest.fn<boolean, []>().mockReturnValue(false),
                    attemptTranscodeFallbackForCurrentProgram: jest.fn().mockResolvedValue(false),
                    handlePlaybackFailure: jest.fn(() => {
                        throw handlerError;
                    }),
                },
            },
        }));

        controller.handlePlaybackError(error);
        await flushPlaybackErrorHandling();

        expect(deps.reportRecoverableAsyncFailure).toHaveBeenCalledTimes(1);
        expect(deps.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'orchestrator.playbackRecovery.handlePlaybackFailure',
            'Playback recovery failure handler threw',
            handlerError,
            {
                context: 'video-player',
                playbackError: {
                    code: AppErrorCode.PLAYBACK_DECODE_ERROR,
                    message: 'fatal',
                },
            }
        );
        expect(deps.uiRuntime.handleGlobalError).toHaveBeenCalledTimes(1);
        expect(deps.uiRuntime.handleGlobalError).toHaveBeenCalledWith(
            {
                code: AppErrorCode.PLAYBACK_DECODE_ERROR,
                message: 'fatal',
                recoverable: false,
            },
            'video-player'
        );
    });

    it('routes non-recoverable player errors through handleGlobalError when playback failure handling is unavailable', async () => {
        const error: PlaybackError = {
            code: AppErrorCode.PLAYBACK_DECODE_ERROR,
            message: 'fatal',
            recoverable: false,
            retryCount: 0,
        };
        const playbackRecovery = {
            ...requiredPlaybackPreparationStubs,
            isStreamRecoveryInProgress: jest.fn<boolean, []>().mockReturnValue(false),
            attemptTranscodeFallbackForCurrentProgram: jest.fn().mockResolvedValue(false),
        };
        const { controller, deps } = makeSetup((callOrder) => ({
            playback: {
                ...makePlaybackMocks(callOrder),
                playbackRecovery,
            },
        }));

        controller.handlePlaybackError(error);
        await flushPlaybackErrorHandling();

        expect(playbackRecovery).not.toHaveProperty('handlePlaybackFailure');
        expect(deps.uiRuntime.handleGlobalError).toHaveBeenCalledTimes(1);
        expect(deps.uiRuntime.handleGlobalError).toHaveBeenCalledWith(
            {
                code: AppErrorCode.PLAYBACK_DECODE_ERROR,
                message: 'fatal',
                recoverable: false,
            },
            'video-player'
        );
    });

    it('forwards every state change to the state-change callback', () => {
        const state: PlaybackState = {
            status: 'paused',
            currentTimeMs: 1000,
            durationMs: 5000,
            bufferPercent: 50,
            volume: 1,
            isMuted: false,
            playbackRate: 1,
            activeSubtitleId: null,
            activeAudioId: 'audio-1',
            errorInfo: null,
        };
        const { controller, deps } = makeSetup();

        controller.handlePlayerStateChange(state);

        expect(deps.playerEvents.onPlayerStateChange).toHaveBeenCalledTimes(1);
        expect(deps.playerEvents.onPlayerStateChange).toHaveBeenCalledWith(state);
        expect(deps.playback.playbackState.setShouldAutoShowInfoBannerOnNextPlay).not.toHaveBeenCalled();
        expect(deps.uiRuntime.showInfoBanner).not.toHaveBeenCalled();
    });

    it('consumes the auto-show info banner flag only when playback reaches playing', () => {
        const state: PlaybackState = {
            status: 'playing',
            currentTimeMs: 1000,
            durationMs: 5000,
            bufferPercent: 75,
            volume: 1,
            isMuted: false,
            playbackRate: 1,
            activeSubtitleId: null,
            activeAudioId: 'audio-1',
            errorInfo: null,
        };
        const { controller, deps } = makeSetup((callOrder) => ({
            playback: {
                ...makePlaybackMocks(callOrder),
                playbackState: makePlaybackState({
                    getShouldAutoShowInfoBannerOnNextPlay: jest.fn().mockReturnValue(true),
                }),
            },
        }));

        controller.handlePlayerStateChange(state);

        const onPlayerStateChange = deps.playerEvents.onPlayerStateChange as jest.Mock;
        const clearAutoShowInfoBanner =
            deps.playback.playbackState.setShouldAutoShowInfoBannerOnNextPlay as jest.Mock;
        const showInfoBanner = deps.uiRuntime.showInfoBanner as jest.Mock;
        const stateChangeCall = onPlayerStateChange.mock.invocationCallOrder[0];
        const clearCall = clearAutoShowInfoBanner.mock.invocationCallOrder[0];
        const showCall = showInfoBanner.mock.invocationCallOrder[0];

        expect(deps.playerEvents.onPlayerStateChange).toHaveBeenCalledTimes(1);
        expect(deps.playerEvents.onPlayerStateChange).toHaveBeenCalledWith(state);
        expect(deps.playback.playbackState.setShouldAutoShowInfoBannerOnNextPlay).toHaveBeenCalledWith(false);
        expect(deps.uiRuntime.showInfoBanner).toHaveBeenCalledTimes(1);
        expect(stateChangeCall).toBeDefined();
        expect(clearCall).toBeDefined();
        expect(showCall).toBeDefined();
        if (stateChangeCall === undefined || clearCall === undefined || showCall === undefined) {
            throw new Error('Expected state-change and info-banner callbacks to run');
        }
        expect(stateChangeCall).toBeLessThan(clearCall);
        expect(clearCall).toBeLessThan(showCall);
    });

    it('does not consume the auto-show info banner flag before playback reaches playing', () => {
        const state: PlaybackState = {
            status: 'paused',
            currentTimeMs: 1000,
            durationMs: 5000,
            bufferPercent: 75,
            volume: 1,
            isMuted: false,
            playbackRate: 1,
            activeSubtitleId: null,
            activeAudioId: 'audio-1',
            errorInfo: null,
        };
        const { controller, deps } = makeSetup((callOrder) => ({
            playback: {
                ...makePlaybackMocks(callOrder),
                playbackState: makePlaybackState({
                    getShouldAutoShowInfoBannerOnNextPlay: jest.fn().mockReturnValue(true),
                }),
            },
        }));

        controller.handlePlayerStateChange(state);

        expect(deps.playerEvents.onPlayerStateChange).toHaveBeenCalledTimes(1);
        expect(deps.playerEvents.onPlayerStateChange).toHaveBeenCalledWith(state);
        expect(deps.playback.playbackState.setShouldAutoShowInfoBannerOnNextPlay).not.toHaveBeenCalled();
        expect(deps.uiRuntime.showInfoBanner).not.toHaveBeenCalled();
    });

    it('forwards time updates to the OSD callback without reshaping the payload', () => {
        const payload = { currentTimeMs: 1234, durationMs: 5678 };
        const { controller, deps } = makeSetup();

        controller.handlePlayerTimeUpdate(payload);

        expect(deps.playerEvents.onPlayerTimeUpdate).toHaveBeenCalledTimes(1);
        expect(deps.playerEvents.onPlayerTimeUpdate).toHaveBeenCalledWith(payload);
    });

    it('forwards buffer updates to the OSD callback without reshaping the payload', () => {
        const bufferedRanges: TimeRange[] = [{ startMs: 0, endMs: 2500 }];
        const payload = { percent: 42, bufferedRanges };
        const { controller, deps } = makeSetup();

        controller.handlePlayerBufferUpdate(payload);

        expect(deps.playerEvents.onPlayerBufferUpdate).toHaveBeenCalledTimes(1);
        expect(deps.playerEvents.onPlayerBufferUpdate).toHaveBeenCalledWith(payload);
    });

    it('trackProgramStart stores and returns the provided promise', async () => {
        const { controller } = makeSetup();
        const deferred = createDeferred<PlaybackStartOutcome>();

        expect(controller.trackProgramStart(deferred.promise)).toBe(deferred.promise);

        deferred.resolve({ kind: 'started' });
        await deferred.promise;
    });

    it('waits for the next tracked program start and returns its settlement', async () => {
        const { controller } = makeSetup();
        const start = createDeferred<PlaybackStartOutcome>();
        let settled = false;
        const wait = controller.waitForNextProgramStart().then((outcome) => {
            settled = true;
            return outcome;
        });

        await Promise.resolve();
        expect(settled).toBe(false);
        controller.trackProgramStart(start.promise);
        start.resolve({ kind: 'started' });

        await expect(wait).resolves.toEqual({ kind: 'started' });
    });

    it('sanitizes a rejected tracked start as failed for its waiter', async () => {
        const { controller } = makeSetup();
        const start = createDeferred<PlaybackStartOutcome>();
        const wait = controller.waitForNextProgramStart();
        controller.trackProgramStart(start.promise);

        start.reject(new Error('private playback failure'));

        await expect(wait).resolves.toEqual({ kind: 'failed' });
        await expect(start.promise).rejects.toThrow('private playback failure');
    });

    it('passes through a sanitized failed start settlement', async () => {
        const { controller } = makeSetup();
        const wait = controller.waitForNextProgramStart();

        controller.trackProgramStart(Promise.resolve({ kind: 'failed' }));

        await expect(wait).resolves.toEqual({ kind: 'failed' });
        await Promise.resolve();
        expect(controller.isOverlayReopenSafe()).toBe(true);
    });

    it('supersedes the prior waiter when a newer caller waits', async () => {
        const { controller } = makeSetup();
        const first = controller.waitForNextProgramStart();
        const second = controller.waitForNextProgramStart();

        await expect(first).resolves.toEqual({ kind: 'superseded' });
        controller.trackProgramStart(Promise.resolve({ kind: 'started' }));
        await expect(second).resolves.toEqual({ kind: 'started' });
    });

    it('settles a pending program-start waiter as superseded on dispose', async () => {
        const { controller } = makeSetup();
        const wait = controller.waitForNextProgramStart();

        controller.dispose();

        await expect(wait).resolves.toEqual({ kind: 'superseded' });
    });

    it('settles a signaled waiter on dispose and tolerates a later abort', async () => {
        const { controller } = makeSetup();
        const aborter = new AbortController();
        const wait = controller.waitForNextProgramStart(aborter.signal);

        controller.dispose();

        await expect(wait).resolves.toEqual({ kind: 'superseded' });
        expect((): void => aborter.abort()).not.toThrow();
        expect((): void => controller.dispose()).not.toThrow();
    });

    it('clears pending overlay readiness and tracked promise when the active program start rejects', async () => {
        const { controller, deps, callOrder } = makeSetup();
        const deferred = createDeferred<PlaybackStartOutcome>();
        const error = new Error('program start failed');

        const tracked = controller.trackProgramStart(deferred.promise);

        expect(controller.isOverlayReopenSafe()).toBe(false);
        expect(controller.getOverlayReadinessSnapshot().pendingReason).toBe('program-start');

        deferred.reject(error);

        await expect(tracked).rejects.toBe(error);
        await Promise.resolve();

        expect(controller.isOverlayReopenSafe()).toBe(true);
        expect(controller.getOverlayReadinessSnapshot()).toEqual({
            pendingReason: 'none',
            pendingSinceMs: null,
            lastReadyAtMs: null,
        });

        await controller.handleLifecycleResume();

        expect(deps.schedulerRuntime.resumeSchedulerSync).toHaveBeenCalledTimes(1);
        expect(deps.schedulerRuntime.syncSchedulerToCurrentTime).toHaveBeenCalledTimes(1);
        expect(deps.playback.playPlayer).toHaveBeenCalledTimes(1);
        expect(callOrder).toEqual([
            'resume-scheduler',
            'sync-scheduler',
            'play-player',
        ]);
    });

    it('ignores rejection cleanup from an older program start after a newer one is tracked', async () => {
        const { controller } = makeSetup();
        const older = createDeferred<PlaybackStartOutcome>();
        const newer = createDeferred<PlaybackStartOutcome>();
        const olderError = new Error('older program start failed');

        controller.trackProgramStart(older.promise);
        controller.trackProgramStart(newer.promise);

        older.reject(olderError);

        await expect(older.promise).rejects.toBe(olderError);
        await Promise.resolve();

        expect(controller.isOverlayReopenSafe()).toBe(false);
        expect(controller.getOverlayReadinessSnapshot().pendingReason).toBe('program-start');

        newer.resolve({ kind: 'started' });
        await newer.promise;

        expect(controller.isOverlayReopenSafe()).toBe(false);

        controller.handlePlayerStateChange({
            status: 'playing',
            currentTimeMs: 0,
            durationMs: 1000,
            bufferPercent: 100,
            volume: 1,
            isMuted: false,
            playbackRate: 1,
            activeSubtitleId: null,
            activeAudioId: null,
            errorInfo: null,
        });

        expect(controller.isOverlayReopenSafe()).toBe(true);
    });

    it('marks overlay reopen as unsafe after a program start until playback returns to playing', () => {
        const { controller } = makeSetup();
        const deferred = createDeferred<PlaybackStartOutcome>();
        const paused: PlaybackState = {
            status: 'paused',
            currentTimeMs: 1000,
            durationMs: 5000,
            bufferPercent: 75,
            volume: 1,
            isMuted: false,
            playbackRate: 1,
            activeSubtitleId: null,
            activeAudioId: 'audio-1',
            errorInfo: null,
        };
        const playing: PlaybackState = {
            ...paused,
            status: 'playing',
        };

        expect(controller.isOverlayReopenSafe()).toBe(true);
        controller.trackProgramStart(deferred.promise);
        expect(controller.isOverlayReopenSafe()).toBe(false);

        controller.handlePlayerStateChange(paused);
        expect(controller.isOverlayReopenSafe()).toBe(false);

        controller.handlePlayerStateChange(playing);
        expect(controller.isOverlayReopenSafe()).toBe(true);
    });

    it('exposes overlay readiness snapshot timing for phase-1 proof instrumentation', () => {
        const { controller } = makeSetup();
        const deferred = createDeferred<PlaybackStartOutcome>();
        const before = controller.getOverlayReadinessSnapshot();
        expect(before.pendingReason).toBe('none');
        expect(before.pendingSinceMs).toBeNull();
        expect(before.lastReadyAtMs).toBeNull();

        controller.trackProgramStart(deferred.promise);
        const pending = controller.getOverlayReadinessSnapshot();
        expect(pending.pendingReason).toBe('program-start');
        expect(typeof pending.pendingSinceMs).toBe('number');
        expect(pending.lastReadyAtMs).toBeNull();

        controller.handlePlayerStateChange({
            status: 'playing',
            currentTimeMs: 0,
            durationMs: 1000,
            bufferPercent: 100,
            volume: 1,
            isMuted: false,
            playbackRate: 1,
            activeSubtitleId: null,
            activeAudioId: null,
            errorInfo: null,
        });
        const ready = controller.getOverlayReadinessSnapshot();
        expect(ready.pendingReason).toBe('none');
        expect(ready.pendingSinceMs).toBeNull();
        expect(typeof ready.lastReadyAtMs).toBe('number');
    });

    it('handleLifecyclePause pauses playback, pauses scheduler sync, and then saves lifecycle state', async () => {
        const { controller, deps, callOrder } = makeSetup();

        await controller.handleLifecyclePause();

        expect(deps.playback.pausePlayer).toHaveBeenCalledTimes(1);
        expect(deps.schedulerRuntime.pauseSchedulerSync).toHaveBeenCalledTimes(1);
        expect(deps.saveLifecycleState).toHaveBeenCalledTimes(1);
        expect(callOrder).toEqual([
            'pause-player',
            'pause-scheduler',
            'save-lifecycle-state',
        ]);
    });

    it('handleLifecycleResume awaits a newer tracked program start triggered during sync and skips play', async () => {
        const originalStart = createDeferred<PlaybackStartOutcome>();
        const replacementStart = createDeferred<PlaybackStartOutcome>();
        const { controller, deps } = makeSetup((callOrder) => ({
            schedulerRuntime: {
                ...makeSchedulerRuntimeMocks(callOrder),
                syncSchedulerToCurrentTime: jest.fn(() => {
                    controller.trackProgramStart(replacementStart.promise);
                }),
            },
        }));

        controller.trackProgramStart(originalStart.promise);

        const resumePromise = controller.handleLifecycleResume();

        expect(deps.schedulerRuntime.resumeSchedulerSync).toHaveBeenCalledTimes(1);
        expect(deps.schedulerRuntime.syncSchedulerToCurrentTime).toHaveBeenCalledTimes(1);
        expect(deps.playback.playPlayer).not.toHaveBeenCalled();

        replacementStart.resolve({ kind: 'started' });
        await resumePromise;

        expect(deps.playback.playPlayer).not.toHaveBeenCalled();

        originalStart.resolve({ kind: 'superseded' });
        await originalStart.promise;
    });

    it('handleLifecycleResume calls play when sync does not install a newer tracked program start', async () => {
        const { controller, deps, callOrder } = makeSetup();

        await controller.handleLifecycleResume();

        expect(deps.schedulerRuntime.resumeSchedulerSync).toHaveBeenCalledTimes(1);
        expect(deps.schedulerRuntime.syncSchedulerToCurrentTime).toHaveBeenCalledTimes(1);
        expect(deps.playback.playPlayer).toHaveBeenCalledTimes(1);
        expect(callOrder).toEqual([
            'resume-scheduler',
            'sync-scheduler',
            'play-player',
        ]);
    });
});
