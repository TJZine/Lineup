import { AppErrorCode } from '../../types/app-errors';
import { createDeferred } from '../../__tests__/helpers';
import {
    type PlaybackError,
    type PlaybackState,
    type TimeRange,
} from '../../modules/player';
import {
    PlaybackRuntimeController,
    type PlaybackRuntimeControllerDeps,
} from '../orchestrator/priority-one/PlaybackRuntimeController';

const makeSetup = (
    overrides: Partial<PlaybackRuntimeControllerDeps> = {}
): {
    controller: PlaybackRuntimeController;
    deps: jest.Mocked<PlaybackRuntimeControllerDeps>;
    callOrder: string[];
} => {
    const callOrder: string[] = [];
    const deps = {
        isStreamRecoveryInProgress: jest.fn<boolean, []>().mockReturnValue(false),
        getActiveTranscodeSessionId: jest.fn<string | null, []>().mockReturnValue('session-123'),
        stopTranscodeSession: jest.fn<void, [string]>((sessionId: string) => {
            callOrder.push(`stop:${sessionId}`);
        }),
        skipToNextProgram: jest.fn<void, []>(() => {
            callOrder.push('skip');
        }),
        handleGlobalError: jest.fn<void, Parameters<PlaybackRuntimeControllerDeps['handleGlobalError']>>(),
        handlePlaybackFailure: jest.fn<void, Parameters<PlaybackRuntimeControllerDeps['handlePlaybackFailure']>>(),
        onPlayerStateChange: jest.fn<void, Parameters<PlaybackRuntimeControllerDeps['onPlayerStateChange']>>(),
        shouldAutoShowInfoBannerOnNextPlay: jest.fn<boolean, []>().mockReturnValue(false),
        clearAutoShowInfoBannerOnNextPlay: jest.fn<void, []>(),
        showInfoBanner: jest.fn<void, []>(),
        onPlayerTimeUpdate: jest.fn<void, Parameters<PlaybackRuntimeControllerDeps['onPlayerTimeUpdate']>>(),
        onPlayerBufferUpdate: jest.fn<void, Parameters<PlaybackRuntimeControllerDeps['onPlayerBufferUpdate']>>(),
        pausePlayer: jest.fn<void, []>(() => {
            callOrder.push('pause-player');
        }),
        playPlayer: jest.fn<Promise<void>, []>(async () => {
            callOrder.push('play-player');
        }),
        pauseSchedulerSync: jest.fn<void, []>(() => {
            callOrder.push('pause-scheduler');
        }),
        resumeSchedulerSync: jest.fn<void, []>(() => {
            callOrder.push('resume-scheduler');
        }),
        syncSchedulerToCurrentTime: jest.fn<void, []>(() => {
            callOrder.push('sync-scheduler');
        }),
        saveLifecycleState: jest.fn<Promise<void>, []>(async () => {
            callOrder.push('save-lifecycle-state');
        }),
        ...overrides,
    } as jest.Mocked<PlaybackRuntimeControllerDeps>;

    return {
        controller: new PlaybackRuntimeController(deps),
        deps,
        callOrder,
    };
};

describe('PlaybackRuntimeController', () => {
    it('does nothing on ended while stream recovery is in progress', () => {
        const { controller, deps, callOrder } = makeSetup({
            isStreamRecoveryInProgress: jest.fn().mockReturnValue(true),
        });

        controller.handlePlayerEnded();

        expect(deps.stopTranscodeSession).not.toHaveBeenCalled();
        expect(deps.skipToNextProgram).not.toHaveBeenCalled();
        expect(callOrder).toEqual([]);
    });

    it('stops the active transcode session before skipping to next on ended when recovery is idle', () => {
        const { controller, deps, callOrder } = makeSetup();

        controller.handlePlayerEnded();

        expect(deps.stopTranscodeSession).toHaveBeenCalledTimes(1);
        expect(deps.stopTranscodeSession).toHaveBeenCalledWith('session-123');
        expect(deps.skipToNextProgram).toHaveBeenCalledTimes(1);
        expect(callOrder).toEqual(['stop:session-123', 'skip']);
    });

    it('no-ops stopActiveTranscodeSession when no active transcode session id exists', () => {
        const { controller, deps } = makeSetup({
            getActiveTranscodeSessionId: jest.fn().mockReturnValue(null),
        });

        controller.stopActiveTranscodeSession();

        expect(deps.stopTranscodeSession).not.toHaveBeenCalled();
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

        expect(deps.handleGlobalError).toHaveBeenCalledTimes(1);
        expect(deps.handleGlobalError).toHaveBeenCalledWith(
            expect.objectContaining({
                code: AppErrorCode.NETWORK_TIMEOUT,
                message: 'recoverable',
                recoverable: true,
            }),
            'video-player'
        );
        expect(deps.handlePlaybackFailure).not.toHaveBeenCalled();
    });

    it('routes non-recoverable player errors through handlePlaybackFailure', () => {
        const error: PlaybackError = {
            code: AppErrorCode.PLAYBACK_DECODE_ERROR,
            message: 'fatal',
            recoverable: false,
            retryCount: 0,
        };
        const { controller, deps } = makeSetup();

        controller.handlePlaybackError(error);

        expect(deps.handlePlaybackFailure).toHaveBeenCalledTimes(1);
        expect(deps.handlePlaybackFailure).toHaveBeenCalledWith('video-player', error);
        expect(deps.handleGlobalError).not.toHaveBeenCalled();
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

        expect(deps.onPlayerStateChange).toHaveBeenCalledTimes(1);
        expect(deps.onPlayerStateChange).toHaveBeenCalledWith(state);
        expect(deps.clearAutoShowInfoBannerOnNextPlay).not.toHaveBeenCalled();
        expect(deps.showInfoBanner).not.toHaveBeenCalled();
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
        const { controller, deps } = makeSetup({
            shouldAutoShowInfoBannerOnNextPlay: jest.fn().mockReturnValue(true),
        });

        controller.handlePlayerStateChange(state);

        const stateChangeCall = deps.onPlayerStateChange.mock.invocationCallOrder[0];
        const clearCall = deps.clearAutoShowInfoBannerOnNextPlay.mock.invocationCallOrder[0];
        const showCall = deps.showInfoBanner.mock.invocationCallOrder[0];

        expect(deps.onPlayerStateChange).toHaveBeenCalledTimes(1);
        expect(deps.onPlayerStateChange).toHaveBeenCalledWith(state);
        expect(deps.clearAutoShowInfoBannerOnNextPlay).toHaveBeenCalledTimes(1);
        expect(deps.showInfoBanner).toHaveBeenCalledTimes(1);
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
        const { controller, deps } = makeSetup({
            shouldAutoShowInfoBannerOnNextPlay: jest.fn().mockReturnValue(true),
        });

        controller.handlePlayerStateChange(state);

        expect(deps.onPlayerStateChange).toHaveBeenCalledTimes(1);
        expect(deps.onPlayerStateChange).toHaveBeenCalledWith(state);
        expect(deps.clearAutoShowInfoBannerOnNextPlay).not.toHaveBeenCalled();
        expect(deps.showInfoBanner).not.toHaveBeenCalled();
    });

    it('forwards time updates to the OSD callback without reshaping the payload', () => {
        const payload = { currentTimeMs: 1234, durationMs: 5678 };
        const { controller, deps } = makeSetup();

        controller.handlePlayerTimeUpdate(payload);

        expect(deps.onPlayerTimeUpdate).toHaveBeenCalledTimes(1);
        expect(deps.onPlayerTimeUpdate).toHaveBeenCalledWith(payload);
    });

    it('forwards buffer updates to the OSD callback without reshaping the payload', () => {
        const bufferedRanges: TimeRange[] = [{ startMs: 0, endMs: 2500 }];
        const payload = { percent: 42, bufferedRanges };
        const { controller, deps } = makeSetup();

        controller.handlePlayerBufferUpdate(payload);

        expect(deps.onPlayerBufferUpdate).toHaveBeenCalledTimes(1);
        expect(deps.onPlayerBufferUpdate).toHaveBeenCalledWith(payload);
    });

    it('trackProgramStart stores and returns the provided promise', async () => {
        const { controller } = makeSetup();
        const deferred = createDeferred<void>();

        expect(controller.trackProgramStart(deferred.promise)).toBe(deferred.promise);

        deferred.resolve(undefined);
        await deferred.promise;
    });

    it('clears pending overlay readiness and tracked promise when the active program start rejects', async () => {
        const { controller, deps, callOrder } = makeSetup();
        const deferred = createDeferred<void>();
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

        expect(deps.resumeSchedulerSync).toHaveBeenCalledTimes(1);
        expect(deps.syncSchedulerToCurrentTime).toHaveBeenCalledTimes(1);
        expect(deps.playPlayer).toHaveBeenCalledTimes(1);
        expect(callOrder).toEqual([
            'resume-scheduler',
            'sync-scheduler',
            'play-player',
        ]);
    });

    it('ignores rejection cleanup from an older program start after a newer one is tracked', async () => {
        const { controller } = makeSetup();
        const older = createDeferred<void>();
        const newer = createDeferred<void>();
        const olderError = new Error('older program start failed');

        controller.trackProgramStart(older.promise);
        controller.trackProgramStart(newer.promise);

        older.reject(olderError);

        await expect(older.promise).rejects.toBe(olderError);
        await Promise.resolve();

        expect(controller.isOverlayReopenSafe()).toBe(false);
        expect(controller.getOverlayReadinessSnapshot().pendingReason).toBe('program-start');

        newer.resolve(undefined);
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
        const deferred = createDeferred<void>();
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
        const deferred = createDeferred<void>();
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

        expect(deps.pausePlayer).toHaveBeenCalledTimes(1);
        expect(deps.pauseSchedulerSync).toHaveBeenCalledTimes(1);
        expect(deps.saveLifecycleState).toHaveBeenCalledTimes(1);
        expect(callOrder).toEqual([
            'pause-player',
            'pause-scheduler',
            'save-lifecycle-state',
        ]);
    });

    it('handleLifecycleResume awaits a newer tracked program start triggered during sync and skips play', async () => {
        const originalStart = createDeferred<void>();
        const replacementStart = createDeferred<void>();
        const { controller, deps } = makeSetup({
            syncSchedulerToCurrentTime: jest.fn(() => {
                controller.trackProgramStart(replacementStart.promise);
            }),
        });

        controller.trackProgramStart(originalStart.promise);

        const resumePromise = controller.handleLifecycleResume();

        expect(deps.resumeSchedulerSync).toHaveBeenCalledTimes(1);
        expect(deps.syncSchedulerToCurrentTime).toHaveBeenCalledTimes(1);
        expect(deps.playPlayer).not.toHaveBeenCalled();

        replacementStart.resolve(undefined);
        await resumePromise;

        expect(deps.playPlayer).not.toHaveBeenCalled();

        originalStart.resolve(undefined);
        await originalStart.promise;
    });

    it('handleLifecycleResume calls play when sync does not install a newer tracked program start', async () => {
        const { controller, deps, callOrder } = makeSetup();

        await controller.handleLifecycleResume();

        expect(deps.resumeSchedulerSync).toHaveBeenCalledTimes(1);
        expect(deps.syncSchedulerToCurrentTime).toHaveBeenCalledTimes(1);
        expect(deps.playPlayer).toHaveBeenCalledTimes(1);
        expect(callOrder).toEqual([
            'resume-scheduler',
            'sync-scheduler',
            'play-player',
        ]);
    });
});
