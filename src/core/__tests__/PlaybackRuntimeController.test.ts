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
import type { ScheduledProgramIdentity } from '../../modules/scheduler/scheduler';

const requiredPlaybackPreparationStubs = {
    resolveStreamForProgram: jest.fn(),
    discardPreparedStream: jest.fn(),
};
const currentDescriptor = { url: 'current' };
const currentIdentity: ScheduledProgramIdentity = {
    channelId: 'channel-1', itemKey: 'item-1', scheduledStartTime: 0,
    scheduledEndTime: 60_000, scheduleIndex: 0, loopNumber: 0,
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
    ...overrides,
});

const makePlaybackMocks = (
    callOrder: string[],
    playbackState = makePlaybackState()
): jest.Mocked<PlaybackRuntimeControllerDeps['playback']> => ({
    reconcileSleepExpiration: jest.fn().mockReturnValue(false),
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
        },
        saveLifecycleState: jest.fn<Promise<void>, []>(async () => {
            callOrder.push('save-lifecycle-state');
        }),
        reconcileSleepExpiration: jest.fn().mockReturnValue(false),
        stopPlayback: jest.fn(),
        hasSelectedChannel: jest.fn().mockReturnValue(true),
        getScheduledChannelId: jest.fn().mockReturnValue('channel-1'),
        getScheduledProgramIdentity: jest.fn().mockReturnValue(currentIdentity),
        getCommittedDescriptor: jest.fn().mockReturnValue(currentDescriptor),
        getPlayerStatus: jest.fn().mockReturnValue('paused'),
        getCurrentDescriptor: jest.fn().mockReturnValue(currentDescriptor),
        getDirectoryScopeKey: jest.fn().mockReturnValue('scope-1'),
        unloadCurrentChannel: jest.fn(),
        cancelChannelReplacement: jest.fn(),
        hasPendingChannelReplacement: jest.fn().mockReturnValue(false),
        requestCurrentProgramStart: jest.fn().mockResolvedValue({ kind: 'started' }),
        reportRecoverableAsyncFailure: jest.fn(),
        ...resolvedOverrides,
    } as jest.Mocked<PlaybackRuntimeControllerDeps>;

    return {
        controller: ((): PlaybackRuntimeController => {
            const controller = new PlaybackRuntimeController(deps);
            controller.beginIntentionalTune();
            controller.acceptCommittedSession(currentDescriptor);
            return controller;
        })(),
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

    it('waits through unrelated starts and settles matching start after pending readiness clears', async () => {
        const { controller } = makeSetup();
        const aborter = new AbortController();
        const removeAbortListener = jest.spyOn(aborter.signal, 'removeEventListener');
        const unrelated = createDeferred<PlaybackStartOutcome>();
        const matching = createDeferred<PlaybackStartOutcome>();
        const observed = controller.observeProgramStart(currentIdentity, aborter.signal);
        let settled = false;
        void observed.then(() => { settled = true; });

        controller.trackProgramStart(unrelated.promise, {
            ...currentIdentity, channelId: 'channel-2',
        });
        unrelated.resolve({ kind: 'started' });
        await unrelated.promise;
        await Promise.resolve();
        expect(settled).toBe(false);

        controller.trackProgramStart(matching.promise, currentIdentity);
        matching.resolve({ kind: 'started' });
        expect(settled).toBe(false);
        await expect(observed).resolves.toEqual({ kind: 'started' });
        expect(controller.canActivateRetainedSession()).toBe(true);
        expect(removeAbortListener).toHaveBeenCalledWith('abort', expect.any(Function));
    });

    it.each(['failed', 'rejected'] as const)(
        'reports a matching %s start truthfully', async (settlement) => {
            const { controller } = makeSetup();
            const start = createDeferred<PlaybackStartOutcome>();
            const observed = controller.observeProgramStart(
                currentIdentity, new AbortController().signal
            );
            controller.trackProgramStart(start.promise, currentIdentity);
            if (settlement === 'failed') start.resolve({ kind: 'failed' });
            else start.reject(new Error('private failure'));

            await expect(observed).resolves.toEqual({ kind: 'failed' });
            if (settlement === 'rejected') {
                await expect(start.promise).rejects.toThrow('private failure');
            }
            expect(controller.isOverlayReopenSafe()).toBe(true);
        }
    );

    it.each(['before', 'after'] as const)(
        'retires an observer when its caller aborts %s matching attachment', async (stage) => {
            const { controller } = makeSetup();
            const aborter = new AbortController();
            const start = createDeferred<PlaybackStartOutcome>();
            const observed = controller.observeProgramStart(currentIdentity, aborter.signal);
            if (stage === 'after') controller.trackProgramStart(start.promise, currentIdentity);
            aborter.abort();
            await expect(observed).resolves.toEqual({ kind: 'superseded' });
            if (stage === 'after') {
                start.resolve({ kind: 'started' });
                await start.promise;
            }
        }
    );

    it('retires observation on scope invalidation and rejects a late old start', async () => {
        const { controller } = makeSetup();
        const start = createDeferred<PlaybackStartOutcome>();
        const observed = controller.observeProgramStart(
            currentIdentity, new AbortController().signal
        );
        controller.trackProgramStart(start.promise, currentIdentity);

        controller.invalidateScope();
        await expect(observed).resolves.toEqual({ kind: 'superseded' });
        start.resolve({ kind: 'started' });
        await start.promise;
    });

    it('can register before the first intentional tune in a newly invalidated scope', async () => {
        const { controller } = makeSetup();
        controller.invalidateScope();
        const start = createDeferred<PlaybackStartOutcome>();
        const observed = controller.observeProgramStart(
            currentIdentity, new AbortController().signal
        );

        controller.beginIntentionalTune('channel-1');
        controller.trackProgramStart(start.promise, currentIdentity);
        controller.finishIntentionalTune('channel-1');
        start.resolve({ kind: 'started' });

        await expect(observed).resolves.toEqual({ kind: 'started' });
    });

    it('does not let a late older completion retire a newer observer or start', async () => {
        const { controller } = makeSetup();
        const older = createDeferred<PlaybackStartOutcome>();
        const newer = createDeferred<PlaybackStartOutcome>();
        const first = controller.observeProgramStart(
            currentIdentity, new AbortController().signal
        );
        controller.trackProgramStart(older.promise, currentIdentity);
        const second = controller.observeProgramStart(
            currentIdentity, new AbortController().signal
        );
        await expect(first).resolves.toEqual({ kind: 'superseded' });
        controller.trackProgramStart(newer.promise, currentIdentity);

        older.resolve({ kind: 'started' });
        await older.promise;
        let secondSettled = false;
        void second.then(() => { secondSettled = true; });
        await Promise.resolve();
        expect(secondSettled).toBe(false);
        expect(controller.canActivateRetainedSession()).toBe(false);

        newer.resolve({ kind: 'started' });
        await expect(second).resolves.toEqual({ kind: 'started' });
        expect(controller.canActivateRetainedSession()).toBe(true);
    });

    it('supersedes an observer if another matching start begins before settlement', async () => {
        const { controller } = makeSetup();
        const older = createDeferred<PlaybackStartOutcome>();
        const newer = createDeferred<PlaybackStartOutcome>();
        const observed = controller.observeProgramStart(
            currentIdentity, new AbortController().signal
        );
        controller.trackProgramStart(older.promise, currentIdentity);
        controller.trackProgramStart(newer.promise, currentIdentity);
        await expect(observed).resolves.toEqual({ kind: 'superseded' });
        older.resolve({ kind: 'started' });
        newer.resolve({ kind: 'started' });
        await Promise.all([older.promise, newer.promise]);
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

        await controller.handleLifecyclePause();
        callOrder.length = 0;
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

        await controller.handleLifecyclePause();
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

        await controller.handleLifecyclePause();
        callOrder.length = 0;
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
