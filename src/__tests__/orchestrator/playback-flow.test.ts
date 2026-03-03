import { AppOrchestrator } from '../../Orchestrator';
import { PlaybackStartController } from '../../core';
import type { ScheduledProgram } from '../../modules/scheduler/scheduler';
import { flushPromises } from '../helpers';

const makeProgram = (): ScheduledProgram =>
    ({
        item: {
            ratingKey: 'item-1',
            title: 'Test Item',
            durationMs: 60_000,
            type: 'movie',
        } as ScheduledProgram['item'],
        elapsedMs: 0,
        scheduledStartTime: 0,
        scheduledEndTime: 0,
        remainingMs: 0,
        scheduleIndex: 0,
    } as ScheduledProgram);

describe('AppOrchestrator playback flow suite', () => {
    it('returns safely when channel tuning modules are not initialized', async () => {
        const orchestrator = new AppOrchestrator();
        await expect(orchestrator.switchToChannel('channel-1')).resolves.toBeUndefined();
        await expect(orchestrator.switchToChannelByNumber(101)).resolves.toBeUndefined();
    });

    it('stops the video player during shutdown even before priority1 controllers are initialized', async () => {
        const orchestrator = new AppOrchestrator();
        const stop = jest.fn();
        const destroy = jest.fn();

        const orchestratorAny = orchestrator as unknown as {
            _videoPlayer: { stop: () => void; destroy: () => void } | null;
        };
        orchestratorAny._videoPlayer = {
            stop,
            destroy,
        };

        await orchestrator.shutdown();

        expect(stop).toHaveBeenCalledTimes(1);
        expect(destroy).toHaveBeenCalledTimes(1);
    });

    it('shows a toast when setSubtitleTrack fails', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const toastSpy = jest.fn();

        const orchestrator = new AppOrchestrator();
        orchestrator.setNowPlayingHandler(toastSpy);

        const orchestratorAny = orchestrator as unknown as {
            _videoPlayer: { setSubtitleTrack: (trackId: string | null) => Promise<void> } | null;
        };
        orchestratorAny._videoPlayer = {
            setSubtitleTrack: jest.fn().mockRejectedValue(new Error('boom')),
        };

        await orchestrator.setSubtitleTrack(null);

        expect(warnSpy).toHaveBeenCalled();
        expect(toastSpy).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.any(String), type: 'warning' })
        );
    });

    it('reloads stream when audio track changes during direct play', () => {
        const orchestrator = new AppOrchestrator();
        const attemptAudioTrackReloadForCurrentProgram = jest.fn().mockResolvedValue(true);

        const orchestratorAny = orchestrator as unknown as {
            _currentStreamDescriptor: { protocol: 'direct' | 'hls' } | null;
            _playbackRecovery: { attemptAudioTrackReloadForCurrentProgram: (trackId: string, reason: string) => Promise<boolean> } | null;
            _handlePlayerTrackChange: (event: { type: 'audio' | 'subtitle'; trackId: string | null }) => void;
        };
        orchestratorAny._currentStreamDescriptor = { protocol: 'direct' };
        orchestratorAny._playbackRecovery = {
            attemptAudioTrackReloadForCurrentProgram,
        };

        orchestratorAny._handlePlayerTrackChange({ type: 'audio', trackId: 'audio-2' });

        expect(attemptAudioTrackReloadForCurrentProgram).toHaveBeenCalledWith('audio-2', 'audio_track_change');
    });

    it('does not route permission-denied stream errors into playback-failure guard', async () => {
        const tryHandleStreamResolverAuthError = jest.fn().mockReturnValue(false);
        const tryHandleStreamResolverPermissionError = jest.fn().mockReturnValue(true);
        const handlePlaybackFailure = jest.fn();
        const permissionError = { code: 'ACCESS_DENIED', message: 'no access' };
        const videoPlayer = {
            loadStream: jest.fn().mockResolvedValue(undefined),
            play: jest.fn().mockResolvedValue(undefined),
        };
        let currentProgram: ScheduledProgram | null = null;

        const playbackStartController = new PlaybackStartController({
            getVideoPlayer: (): typeof videoPlayer => videoPlayer,
            resolveStreamForProgram: async (): Promise<never> => {
                throw permissionError;
            },
            resetPlaybackFailureGuard: jest.fn(),
            tryHandleStreamResolverAuthError,
            tryHandleStreamResolverPermissionError,
            handlePlaybackFailure,
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

        await playbackStartController.handleProgramStart(makeProgram());

        expect(tryHandleStreamResolverAuthError).toHaveBeenCalledWith(permissionError);
        expect(tryHandleStreamResolverPermissionError).toHaveBeenCalledWith(permissionError);
        expect(handlePlaybackFailure).not.toHaveBeenCalled();
    });

    it('does not route permission-denied errors into playback-failure guard when triggered via binder wiring', async () => {
        const orchestrator = new AppOrchestrator();
        const permissionError = { code: 'ACCESS_DENIED', message: 'no access' };
        const tryHandleStreamResolverAuthError = jest.fn().mockReturnValue(false);
        const tryHandleStreamResolverPermissionError = jest.fn().mockReturnValue(true);
        const handlePlaybackFailure = jest.fn();

        let programStartHandler: ((program: ScheduledProgram) => void) | null = null;
        const scheduler = {
            on: jest.fn((event: 'programStart' | 'scheduleSync', handler: unknown) => {
                if (event === 'programStart') {
                    programStartHandler = handler as (program: ScheduledProgram) => void;
                }
            }),
            off: jest.fn(),
        };
        const videoPlayer = {
            on: jest.fn(),
            off: jest.fn(),
            loadStream: jest.fn(),
            play: jest.fn(),
            pause: jest.fn(),
        };
        const lifecycle = {
            onPause: jest.fn(() => ({ dispose: jest.fn() })),
            onResume: jest.fn(() => ({ dispose: jest.fn() })),
        };

        const orchestratorAny = orchestrator as unknown as {
            _scheduler: unknown;
            _videoPlayer: unknown;
            _lifecycle: unknown;
            _playbackRecovery: unknown;
            _eventBinder: { bind: () => void } | null;
            _initializePriorityOneControllers: () => void;
        };
        orchestratorAny._scheduler = scheduler;
        orchestratorAny._videoPlayer = videoPlayer;
        orchestratorAny._lifecycle = lifecycle;
        orchestratorAny._playbackRecovery = {
            resolveStreamForProgram: async (): Promise<never> => {
                throw permissionError;
            },
            resetPlaybackFailureGuard: jest.fn(),
            tryHandleStreamResolverAuthError,
            tryHandleStreamResolverPermissionError,
            handlePlaybackFailure,
        };

        orchestratorAny._initializePriorityOneControllers();
        orchestratorAny._eventBinder!.bind();

        programStartHandler!(makeProgram());
        await flushPromises(1);

        expect(tryHandleStreamResolverAuthError).toHaveBeenCalledWith(permissionError);
        expect(tryHandleStreamResolverPermissionError).toHaveBeenCalledWith(permissionError);
        expect(handlePlaybackFailure).not.toHaveBeenCalled();
    });
});
