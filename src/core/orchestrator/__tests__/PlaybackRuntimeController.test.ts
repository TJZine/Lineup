import { PlaybackRuntimeController, type PlaybackRuntimeControllerDeps } from '../priority-one/PlaybackRuntimeController';
import { NavigationScreenEffectsHandler } from '../../../modules/navigation/handlers/NavigationScreenEffectsHandler';
import type { Screen } from '../../../modules/navigation/contracts/interfaces';
import type { PlaybackError } from '../../../modules/player';
import { AppErrorCode } from '../../../types/app-errors';
import { SleepTimerManager } from '../../../modules/ui/sleep-timer/SleepTimerManager';
import { createDeferred } from '../../../__tests__/helpers';
import { ChannelScheduler, buildScheduledProgramIdentityFromState, type ScheduledProgramIdentity } from '../../../modules/scheduler/scheduler';

const currentIdentity: ScheduledProgramIdentity = {
    channelId: 'channel-1', itemKey: 'item-1', scheduledStartTime: 0,
    scheduledEndTime: 60_000, scheduleIndex: 0, loopNumber: 0,
};
const currentDescriptor = { url: 'current' };

const requiredPlaybackPreparationStubs = {
    resolveStreamForProgram: jest.fn(),
    discardPreparedStream: jest.fn(),
};

const flushPromises = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const makePlaybackError = (): PlaybackError => ({
    code: AppErrorCode.PLAYBACK_DECODE_ERROR,
    message: 'decode failed',
    recoverable: false,
    retryCount: 0,
});

const makeDeps = (
    overrides: Partial<PlaybackRuntimeControllerDeps> = {}
): PlaybackRuntimeControllerDeps => ({
    playback: {
        pausePlayer: jest.fn(),
        playPlayer: jest.fn().mockResolvedValue(undefined),
        skipToNextProgram: jest.fn(),
        stopTranscodeSessionById: jest.fn(),
        playbackState: {
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
        },
        playbackRecovery: {
            ...requiredPlaybackPreparationStubs,
            isStreamRecoveryInProgress: jest.fn().mockReturnValue(false),
            attemptTranscodeFallbackForCurrentProgram: jest.fn().mockResolvedValue(false),
            handlePlaybackFailure: jest.fn(),
        },
    },
    schedulerRuntime: {
        pauseSchedulerSync: jest.fn(),
        resumeSchedulerSync: jest.fn(),
        syncSchedulerToCurrentTime: jest.fn(),
    },
    playerEvents: {
        onPlayerStateChange: jest.fn(),
        onPlayerTimeUpdate: jest.fn(),
        onPlayerBufferUpdate: jest.fn(),
    },
    uiRuntime: {
        handleGlobalError: jest.fn(),
    },
    saveLifecycleState: jest.fn().mockResolvedValue(undefined),
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
    ...overrides,
} as unknown as PlaybackRuntimeControllerDeps);

const makeRouteHandler = (runtime: PlaybackRuntimeController): NavigationScreenEffectsHandler =>
    new NavigationScreenEffectsHandler({
        navigation: { isModalOpen: () => false },
        epg: null,
        closeEpg: jest.fn(),
        playback: {
            pauseForScreenChange: (): boolean => { runtime.setRouteBlocking(true); return true; },
            resumeForScreenChange: (): null => { runtime.setRouteBlocking(false); return null; },
            requestPlayerOsdIntent: jest.fn(),
        },
        miniGuide: { requestMiniGuideIntent: jest.fn() },
        channelSwitching: { toggleEpg: jest.fn() },
        uiGuards: { shouldRunChannelSetup: () => false, hideChannelTransition: jest.fn() },
        readKeepPlayingInSettings: () => false,
    } as unknown as ConstructorParameters<typeof NavigationScreenEffectsHandler>[0], {
        stopEpgRepeat: jest.fn(), stopMiniGuideRepeat: jest.fn(),
    } as unknown as ConstructorParameters<typeof NavigationScreenEffectsHandler>[1], jest.fn());

describe('PlaybackRuntimeController', () => {
    it.each([
        ['guide', 'channels', 'channel-setup', 'guide'],
        ['player', 'settings', 'profile-select', 'player'],
        ['guide', 'settings', 'server-select', 'guide'],
    ] as const)('keeps route playback blocked through %s → %s → %s until %s',
        async (origin, protectedRoute, intermediate, destination) => {
            const deps = makeDeps();
            const runtime = new PlaybackRuntimeController(deps);
            runtime.acceptCommittedSession(currentDescriptor);
            runtime.setIntent('playing');
            await flushPromises();
            (deps.playback.playPlayer as jest.Mock).mockClear();
            const handler = makeRouteHandler(runtime);

            handler.handleScreenChange(origin as Screen, protectedRoute as Screen);
            expect(runtime.captureAdmission()).toBeNull();
            handler.handleScreenChange(protectedRoute as Screen, intermediate as Screen);
            expect(runtime.captureAdmission()).toBeNull();
            expect(deps.playback.playPlayer).not.toHaveBeenCalled();

            handler.handleScreenChange(intermediate as Screen, destination as Screen);
            expect(runtime.captureAdmission()).not.toBeNull();
            await flushPromises();
            expect(deps.playback.playPlayer).toHaveBeenCalledTimes(1);
        });

    it('releases only the route hold while lifecycle hold and explicit pause remain', async () => {
        const deps = makeDeps();
        const runtime = new PlaybackRuntimeController(deps);
        runtime.acceptCommittedSession(currentDescriptor);
        runtime.setIntent('playing');
        await flushPromises();
        (deps.playback.playPlayer as jest.Mock).mockClear();
        const handler = makeRouteHandler(runtime);

        handler.handleScreenChange('guide', 'settings');
        const lifecycle = runtime.acquireHold('lifecycle');
        handler.handleScreenChange('settings', 'profile-select');
        handler.handleScreenChange('profile-select', 'guide');
        expect(runtime.captureAdmission()).toBeNull();
        expect(deps.playback.playPlayer).not.toHaveBeenCalled();

        runtime.setIntent('paused');
        runtime.releaseHold(lifecycle);
        expect(runtime.getIntent()).toBe('paused');
        expect(deps.playback.playPlayer).not.toHaveBeenCalled();
    });
    it.each(['stop', 'sleep'] as const)('allows %s then Play and physical deletion cleanup in the same scope', (kind) => {
        let descriptor: object | null = currentDescriptor;
        let runtime!: PlaybackRuntimeController;
        const deps = makeDeps({
            getCurrentDescriptor: () => descriptor,
            getCommittedDescriptor: () => descriptor,
            stopPlayback: jest.fn(() => { runtime.noteNativeStop(); descriptor = null; }),
        });
        runtime = new PlaybackRuntimeController(deps);
        runtime.beginIntentionalTune('channel-1');
        runtime.acceptCommittedSession(currentDescriptor);
        runtime.finishIntentionalTune('channel-1');
        if (kind === 'stop') runtime.setIntent('stopped');
        else runtime.expireSleep();
        expect(runtime.getActiveMediaIdentity()).toBeNull();
        expect(runtime.setIntent('playing')).toBe(true);
        descriptor = { url: 'resumed' };
        runtime.acceptCommittedSession(descriptor);
        const identity = runtime.getActiveMediaIdentity()!;
        expect(identity.channelId).toBe('channel-1');
        expect(runtime.stopDeletedMediaIfCurrent(identity)).toBe('stopped');
        expect(deps.unloadCurrentChannel).toHaveBeenCalledTimes(1);
    });

    it('keeps a retired identity scope closed to ordinary Play and Retry', async () => {
        const runtime = new PlaybackRuntimeController(makeDeps());
        runtime.invalidateScope();
        expect(runtime.setIntent('playing')).toBe(false);
        await expect(runtime.retryCurrentProgram()).rejects.toThrow('unavailable');
    });

    it('activates the saved first program when native ended arrives before the sync tick', () => {
        jest.useFakeTimers();
        jest.setSystemTime(1_000_000);
        const scheduler = new ChannelScheduler();
        const old = { ratingKey: 'old', title: 'Old', fullTitle: 'Old', type: 'movie' as const,
            durationMs: 10_000, thumb: null, year: 2026, scheduledIndex: 0 };
        const next = { ...old, ratingKey: 'saved', title: 'Saved', fullTitle: 'Saved' };
        scheduler.loadChannel({ channelId: 'channel-1', anchorTime: 1_000_000,
            content: [old], playbackMode: 'sequential', shuffleSeed: 1 });
        const deps = makeDeps({
            getScheduledProgramIdentity: () => buildScheduledProgramIdentityFromState(scheduler.getState()),
            hasPendingChannelReplacement: () => scheduler.hasPendingChannelReplacement(),
            schedulerRuntime: { ...makeDeps().schedulerRuntime,
                syncSchedulerToCurrentTime: () => scheduler.syncToCurrentTime() },
            playback: { ...makeDeps().playback,
                skipToNextProgram: jest.fn(() => scheduler.skipToNext()) },
        });
        const runtime = new PlaybackRuntimeController(deps);
        runtime.beginIntentionalTune('channel-1');
        runtime.acceptCommittedSession(currentDescriptor);
        runtime.finishIntentionalTune('channel-1');
        const starts = jest.fn(), ends = jest.fn();
        scheduler.on('programStart', starts);
        scheduler.on('programEnd', ends);
        scheduler.stageChannelReplacement({ channelId: 'channel-1', anchorTime: 1_000_000,
            content: [next], playbackMode: 'sequential', shuffleSeed: 1 });
        jest.setSystemTime(1_009_999);
        runtime.handlePlayerEnded();
        runtime.handlePlayerEnded();
        expect(scheduler.getState().currentProgram?.item.ratingKey).toBe('old');
        expect(starts).not.toHaveBeenCalled();
        jest.setSystemTime(1_010_000);
        scheduler.syncToCurrentTime();
        expect(scheduler.getState().currentProgram?.item.ratingKey).toBe('saved');
        expect(starts).toHaveBeenCalledTimes(1);
        expect(ends).toHaveBeenCalledTimes(1);
        runtime.handlePlayerEnded();
        expect(starts).toHaveBeenCalledTimes(1);
        expect(deps.playback.skipToNextProgram).not.toHaveBeenCalled();
        scheduler.unloadChannel();
        jest.useRealTimers();
    });

    it('activates a pending replacement directly from native ended at its boundary', () => {
        jest.useFakeTimers();
        jest.setSystemTime(1_000_000);
        const scheduler = new ChannelScheduler();
        const old = { ratingKey: 'old', title: 'Old', fullTitle: 'Old', type: 'movie' as const,
            durationMs: 10_000, thumb: null, year: 2026, scheduledIndex: 0 };
        scheduler.loadChannel({ channelId: 'channel-1', anchorTime: 1_000_000,
            content: [old], playbackMode: 'sequential', shuffleSeed: 1 });
        const deps = makeDeps({
            getScheduledProgramIdentity: () => buildScheduledProgramIdentityFromState(scheduler.getState()),
            hasPendingChannelReplacement: () => scheduler.hasPendingChannelReplacement(),
            schedulerRuntime: { ...makeDeps().schedulerRuntime,
                syncSchedulerToCurrentTime: () => scheduler.syncToCurrentTime() },
        });
        const runtime = new PlaybackRuntimeController(deps);
        runtime.beginIntentionalTune('channel-1');
        runtime.acceptCommittedSession(currentDescriptor);
        runtime.finishIntentionalTune('channel-1');
        const starts = jest.fn(), ends = jest.fn();
        scheduler.on('programStart', starts);
        scheduler.on('programEnd', ends);
        scheduler.stageChannelReplacement({ channelId: 'channel-1', anchorTime: 1_000_000,
            content: [{ ...old, ratingKey: 'saved' }], playbackMode: 'sequential', shuffleSeed: 1 });
        jest.setSystemTime(1_010_000);
        runtime.handlePlayerEnded();
        expect(scheduler.getState().currentProgram?.item.ratingKey).toBe('saved');
        expect(starts).toHaveBeenCalledTimes(1);
        expect(ends).toHaveBeenCalledTimes(1);
        expect(deps.playback.skipToNextProgram).not.toHaveBeenCalled();
        scheduler.syncToCurrentTime();
        expect(starts).toHaveBeenCalledTimes(1);
        scheduler.unloadChannel();
        jest.useRealTimers();
    });
    it('stops only the same physical session after a committed deletion', () => {
        const deps = makeDeps();
        const runtime = new PlaybackRuntimeController(deps);
        runtime.acceptCommittedSession(currentDescriptor);
        const identity = runtime.getActiveMediaIdentity()!;
        expect(identity).toEqual({ sessionId: expect.any(String), scopeKey: 'scope-1', channelId: 'channel-1' });
        expect(runtime.stopDeletedMediaIfCurrent({ ...identity, sessionId: 'stale' })).toBe('superseded');
        expect(deps.stopPlayback).not.toHaveBeenCalled();
        expect(runtime.stopDeletedMediaIfCurrent(identity)).toBe('stopped');
        expect(deps.stopPlayback).toHaveBeenCalledTimes(1);
        expect(deps.unloadCurrentChannel).toHaveBeenCalledTimes(1);
    });

    it('does not stop a newer tune or descriptor for an old delete effect', () => {
        const deps = makeDeps();
        const runtime = new PlaybackRuntimeController(deps);
        runtime.acceptCommittedSession(currentDescriptor);
        const old = runtime.getActiveMediaIdentity()!;
        runtime.beginIntentionalTune('channel-2');
        expect(runtime.stopDeletedMediaIfCurrent(old)).toBe('superseded');
        runtime.finishIntentionalTune('channel-2');
        (deps.getCurrentDescriptor as jest.Mock).mockReturnValue({ url: 'new' });
        expect(runtime.stopDeletedMediaIfCurrent(old)).toBe('superseded');
        expect(deps.stopPlayback).not.toHaveBeenCalled();
    });
    it('keeps explicit pause through overlapping route and lifecycle holds', async () => {
        const deps = makeDeps();
        const runtime = new PlaybackRuntimeController(deps);
        runtime.beginIntentionalTune();
        const route = runtime.acquireHold('route');
        await runtime.handleLifecyclePause();
        await runtime.handleLifecycleResume();
        expect(deps.playback.playPlayer).not.toHaveBeenCalled();
        runtime.setIntent('paused');
        runtime.releaseHold(route);
        expect(runtime.getIntent()).toBe('paused');
        expect(deps.playback.playPlayer).not.toHaveBeenCalled();
    });

    it('applies a live Settings policy change only to the route hold', async () => {
        const deps = makeDeps();
        const runtime = new PlaybackRuntimeController(deps);
        runtime.beginIntentionalTune();
        runtime.setRouteBlocking(true);
        await runtime.handleLifecyclePause();
        runtime.setRouteBlocking(false);
        expect(runtime.captureAdmission()).toBeNull();
        await runtime.handleLifecycleResume();
        expect(runtime.captureAdmission()).not.toBeNull();
    });

    it('rejects a stale owner release and an expired deadline before admission', () => {
        const deps = makeDeps();
        const runtime = new PlaybackRuntimeController(deps);
        runtime.beginIntentionalTune();
        const stale = runtime.acquireHold('route');
        runtime.acquireHold('route');
        runtime.releaseHold(stale);
        expect(runtime.captureAdmission()).toBeNull();
        (deps.reconcileSleepExpiration as jest.Mock).mockImplementation(() => {
            runtime.expireSleep();
            return true;
        });
        expect(runtime.captureAdmission()).toBeNull();
        expect(runtime.getIntent()).toBe('stopped');
        expect(deps.stopPlayback).toHaveBeenCalledTimes(1);
    });

    it('does not pause a newer descriptor when old Play resolves after Stop', async () => {
        let resolvePlay!: () => void;
        const oldDescriptor = {};
        const newDescriptor = {};
        const deps = makeDeps({
            playback: { ...makeDeps().playback,
                playPlayer: jest.fn(() => new Promise<void>((resolve) => { resolvePlay = resolve; })),
            },
            getCommittedDescriptor: jest.fn().mockReturnValue(oldDescriptor),
            getCurrentDescriptor: jest.fn().mockReturnValueOnce(oldDescriptor)
                .mockReturnValueOnce(oldDescriptor).mockReturnValue(newDescriptor),
        });
        const runtime = new PlaybackRuntimeController(deps);
        runtime.acceptCommittedSession(oldDescriptor);
        runtime.setIntent('playing');
        runtime.setIntent('stopped');
        resolvePlay();
        await flushPromises();
        expect(deps.playback.pausePlayer).not.toHaveBeenCalled();
    });

    it('pauses an owned late Play after scope invalidation during resume', async () => {
        const play = createDeferred<void>();
        const deps = makeDeps({
            playback: {
                ...makeDeps().playback,
                playPlayer: jest.fn().mockReturnValue(play.promise),
            },
        });
        const runtime = new PlaybackRuntimeController(deps);
        runtime.beginIntentionalTune('channel-1');
        runtime.acceptCommittedSession(currentDescriptor);
        runtime.finishIntentionalTune('channel-1');
        await runtime.handleLifecyclePause();
        (deps.playback.pausePlayer as jest.Mock).mockClear();
        await runtime.handleLifecycleResume();
        expect(deps.playback.playPlayer).toHaveBeenCalledTimes(1);

        runtime.invalidateScope();
        play.resolve();
        await flushPromises();
        expect(deps.playback.pausePlayer).toHaveBeenCalledTimes(1);
        expect(runtime.canActivateRetainedSession()).toBe(false);
    });

    it('resolves current schedule on explicit Play when the retained session is stale', () => {
        const deps = makeDeps({ getPlayerStatus: jest.fn().mockReturnValue('idle') });
        const runtime = new PlaybackRuntimeController(deps);
        expect(runtime.setIntent('playing')).toBe(true);
        expect(deps.schedulerRuntime.syncSchedulerToCurrentTime).toHaveBeenCalledTimes(1);
        expect(deps.requestCurrentProgramStart).toHaveBeenCalledTimes(1);
        expect(deps.playback.playPlayer).not.toHaveBeenCalled();
    });

    it('rejects Retry while held and after its start is superseded by Stop', async () => {
        const start = createDeferred<{ kind: 'started' }>();
        const deps = makeDeps({ requestCurrentProgramStart: jest.fn().mockReturnValue(start.promise) });
        const runtime = new PlaybackRuntimeController(deps);
        runtime.beginIntentionalTune();
        const hold = runtime.acquireHold('route');
        await expect(runtime.retryCurrentProgram()).rejects.toThrow('unavailable');
        expect(deps.requestCurrentProgramStart).not.toHaveBeenCalled();

        runtime.setIntent('paused');
        runtime.releaseHold(hold);
        const retry = runtime.retryCurrentProgram();
        runtime.setIntent('stopped');
        start.resolve({ kind: 'started' });
        await expect(retry).rejects.toThrow('started');
    });

    it('allows explicit Retry after reconciling an elapsed Sleep deadline', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2020-01-01T00:00:00Z'));
        try {
            let runtime!: PlaybackRuntimeController;
            const timer = new SleepTimerManager({
                onWarning: jest.fn(), onCancel: jest.fn(), onTick: jest.fn(),
                onSleep: (): void => runtime.expireSleep(),
            });
            const deps = makeDeps({ reconcileSleepExpiration: () => timer.reconcileExpiration() });
            runtime = new PlaybackRuntimeController(deps);
            timer.start(1);
            jest.setSystemTime(new Date('2020-01-01T00:02:00Z'));

            await expect(runtime.retryCurrentProgram()).resolves.toEqual({ kind: 'started' });
            expect(deps.stopPlayback).toHaveBeenCalledTimes(1);
            expect(deps.requestCurrentProgramStart).toHaveBeenCalledTimes(1);
            expect(runtime.getIntent()).toBe('playing');
            expect(timer.reconcileExpiration()).toBe(false);
            timer.destroy();
        } finally {
            jest.useRealTimers();
        }
    });

    it('rejects an in-flight Retry when a new Sleep expiry stops playback', async () => {
        const start = createDeferred<{ kind: 'started' }>();
        const deps = makeDeps({ requestCurrentProgramStart: jest.fn().mockReturnValue(start.promise) });
        const runtime = new PlaybackRuntimeController(deps);
        const retry = runtime.retryCurrentProgram();
        runtime.expireSleep();
        start.resolve({ kind: 'started' });

        await expect(retry).rejects.toThrow('started');
        expect(runtime.getIntent()).toBe('stopped');
        expect(deps.stopPlayback).toHaveBeenCalledTimes(1);
    });

    it('binds intentional tune admission to its requested channel', () => {
        const deps = makeDeps();
        const runtime = new PlaybackRuntimeController(deps);
        runtime.beginIntentionalTune('channel-2');
        expect(runtime.captureTuneAdmission()).not.toBeNull();
        expect(runtime.captureAdmission()).toBeNull();
        (deps.getScheduledChannelId as jest.Mock).mockReturnValue('channel-2');
        expect(runtime.captureAdmission()).not.toBeNull();
    });

    it('stops once for a Sleep deadline crossed while backgrounded', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2020-01-01T00:00:00Z'));
        try {
            let runtime!: PlaybackRuntimeController;
            const timer = new SleepTimerManager({
                onWarning: jest.fn(), onCancel: jest.fn(), onTick: jest.fn(),
                onSleep: (): void => runtime.expireSleep(),
            });
            const deps = makeDeps({ reconcileSleepExpiration: () => timer.reconcileExpiration() });
            runtime = new PlaybackRuntimeController(deps);
            runtime.beginIntentionalTune();
            timer.start(1);
            await runtime.handleLifecyclePause();
            jest.setSystemTime(new Date('2020-01-01T00:02:00Z'));
            await runtime.handleLifecycleResume();
            expect(runtime.getIntent()).toBe('stopped');
            expect(deps.stopPlayback).toHaveBeenCalledTimes(1);
            expect(deps.playback.playPlayer).not.toHaveBeenCalled();
            expect(timer.reconcileExpiration()).toBe(false);
            timer.destroy();
        } finally {
            jest.useRealTimers();
        }
    });
    it('reports async failures when non-recoverable playback error surfacing rejects', async () => {
        const globalErrorFailure = new Error('global error failed');
        const deps = makeDeps({
            playback: {
                ...makeDeps().playback,
                playbackRecovery: {
                    ...requiredPlaybackPreparationStubs,
                    isStreamRecoveryInProgress: jest.fn().mockReturnValue(false),
                    attemptTranscodeFallbackForCurrentProgram: jest.fn().mockResolvedValue(false),
                },
            },
            uiRuntime: {
                handleGlobalError: jest.fn(() => {
                    throw globalErrorFailure;
                }),
            },
        });

        const runtime = new PlaybackRuntimeController(deps);
        runtime.beginIntentionalTune();
        runtime.handlePlaybackError(makePlaybackError());
        await flushPromises();

        expect(deps.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'orchestrator.playbackRuntime.handleNonRecoverablePlaybackError',
            'Non-recoverable playback error handler rejected',
            globalErrorFailure,
            expect.objectContaining({
                context: 'video-player',
                playbackError: expect.objectContaining({
                    message: 'decode failed',
                }),
            })
        );
    });

    it('keeps fatal playback surfacing alive when the recoverable failure reporter throws', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const reporterFailure = new Error('reporter failed');
        const deps = makeDeps({
            playback: {
                ...makeDeps().playback,
                playbackRecovery: {
                    ...requiredPlaybackPreparationStubs,
                    isStreamRecoveryInProgress: jest.fn().mockReturnValue(false),
                    attemptTranscodeFallbackForCurrentProgram: jest.fn().mockRejectedValue(new Error('fallback failed')),
                    handlePlaybackFailure: jest.fn(() => {
                        throw new Error('handler failed');
                    }),
                },
            },
            reportRecoverableAsyncFailure: jest.fn(() => {
                throw reporterFailure;
            }),
        });

        const runtime = new PlaybackRuntimeController(deps);
        runtime.beginIntentionalTune();
        runtime.handlePlaybackError(makePlaybackError());
        await flushPromises();

        expect(deps.uiRuntime.handleGlobalError).toHaveBeenCalledWith(
            expect.objectContaining({
                code: AppErrorCode.PLAYBACK_DECODE_ERROR,
                recoverable: false,
            }),
            'video-player'
        );
        expect(warn).toHaveBeenCalledWith(
            'Recoverable failure reporter threw',
            expect.objectContaining({
                subsystem: 'playback-runtime',
                event: 'orchestrator.playbackRecovery.attemptTranscodeFallbackForCurrentProgram',
            })
        );
        warn.mockRestore();
    });
});
