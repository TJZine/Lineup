import { AppOrchestrator } from '../../Orchestrator';
import type { ScheduledProgram } from '../../modules/scheduler/scheduler';

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
        const orchestrator = new AppOrchestrator();
        const tryHandleStreamResolverAuthError = jest.fn().mockReturnValue(false);
        const tryHandleStreamResolverPermissionError = jest.fn().mockReturnValue(true);
        const handlePlaybackFailure = jest.fn();

        const orchestratorAny = orchestrator as unknown as {
            _scheduler: {
                skipToNext: () => void;
                pauseSyncTimer: () => void;
                resumeSyncTimer: () => void;
                syncToCurrentTime: () => void;
            } | null;
            _lifecycle: { saveState: () => Promise<void> } | null;
            _videoPlayer: { loadStream: (stream: unknown) => Promise<void>; play: () => Promise<void> } | null;
            _playbackRecovery: {
                resolveStreamForProgram: (program: ScheduledProgram) => Promise<unknown>;
                resetPlaybackFailureGuard: () => void;
                tryHandleStreamResolverAuthError: (error: unknown) => boolean;
                tryHandleStreamResolverPermissionError: (error: unknown) => boolean;
                handlePlaybackFailure: (context: string, error: unknown) => void;
            } | null;
            _initializePriorityOneControllers: () => void;
            _playbackStartController: { handleProgramStart: (program: ScheduledProgram) => Promise<void> } | null;
        };
        orchestratorAny._scheduler = {
            skipToNext: jest.fn(),
            pauseSyncTimer: jest.fn(),
            resumeSyncTimer: jest.fn(),
            syncToCurrentTime: jest.fn(),
        };
        orchestratorAny._lifecycle = {
            saveState: jest.fn().mockResolvedValue(undefined),
        };
        orchestratorAny._videoPlayer = {
            loadStream: jest.fn().mockResolvedValue(undefined),
            play: jest.fn().mockResolvedValue(undefined),
        };
        orchestratorAny._playbackRecovery = {
            resolveStreamForProgram: jest.fn().mockRejectedValue({ code: 'ACCESS_DENIED', message: 'no access' }),
            resetPlaybackFailureGuard: jest.fn(),
            tryHandleStreamResolverAuthError,
            tryHandleStreamResolverPermissionError,
            handlePlaybackFailure,
        };
        orchestratorAny._initializePriorityOneControllers();

        await orchestratorAny._playbackStartController!.handleProgramStart(makeProgram());

        expect(tryHandleStreamResolverAuthError).toHaveBeenCalledWith({ code: 'ACCESS_DENIED', message: 'no access' });
        expect(tryHandleStreamResolverPermissionError).toHaveBeenCalledWith({ code: 'ACCESS_DENIED', message: 'no access' });
        expect(handlePlaybackFailure).not.toHaveBeenCalled();
    });
});
