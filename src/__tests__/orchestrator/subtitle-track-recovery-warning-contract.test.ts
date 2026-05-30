import { SubtitleTrackRecoveryController, type SubtitleTrackRecoveryControllerDeps } from '../../core/orchestrator/controllers/SubtitleTrackRecoveryController';
import type { IVideoPlayer, StreamDescriptor } from '../../modules/player';
import type { PlaybackRecoveryManager } from '../../modules/player';
import type { StreamDecision } from '../../modules/plex/stream';
import { flushPromises } from '../helpers';

const createDeps = (
    overrides: Partial<SubtitleTrackRecoveryControllerDeps> = {}
): SubtitleTrackRecoveryControllerDeps => ({
    getVideoPlayer: () => null,
    getPlaybackRecovery: () => null,
    readSubtitleMode: () => 'standard',
    setSubtitleTrack: jest.fn(async () => undefined),
    nowPlayingWarn: jest.fn(),
    getCurrentStreamDecision: () => null,
    getCurrentStreamDescriptor: () => null,
    appendIssueDiagnostic: jest.fn(),
    ...overrides,
});

describe('SubtitleTrackRecoveryController warn contract', () => {
    it('warns when audio reload resolves to failure value', async () => {
        const nowPlayingWarn = jest.fn();
        const playbackRecovery = {
            attemptAudioTrackReloadForCurrentProgram: jest.fn(async () => ({ outcome: 'failed' })),
        } as unknown as PlaybackRecoveryManager;

        const controller = new SubtitleTrackRecoveryController(
            createDeps({
                nowPlayingWarn,
                getCurrentStreamDescriptor: () => ({ protocol: 'direct' } as StreamDescriptor),
                getPlaybackRecovery: () => playbackRecovery,
            })
        );

        controller.handleTrackChange({ type: 'audio', trackId: '1' });
        await flushPromises();

        expect(nowPlayingWarn).toHaveBeenCalledWith('Failed to apply audio track change');
    });

    it('warns when audio reload rejects', async () => {
        const nowPlayingWarn = jest.fn();
        const playbackRecovery = {
            attemptAudioTrackReloadForCurrentProgram: jest.fn(async () => {
                throw new Error('resolver down');
            }),
        } as unknown as PlaybackRecoveryManager;

        const controller = new SubtitleTrackRecoveryController(
            createDeps({
                nowPlayingWarn,
                getCurrentStreamDescriptor: () => ({ protocol: 'direct' } as StreamDescriptor),
                getPlaybackRecovery: () => playbackRecovery,
            })
        );

        controller.handleTrackChange({ type: 'audio', trackId: '1' });
        await flushPromises();

        expect(nowPlayingWarn).toHaveBeenCalledWith('Failed to apply audio track change');
    });

    it('warns when burn-in disable resolves to failed outcome', async () => {
        const nowPlayingWarn = jest.fn();
        const playbackRecovery = {
            attemptDisableBurnInSubtitlesForCurrentProgram: jest.fn(async () => ({ outcome: 'failed' })),
        } as unknown as PlaybackRecoveryManager;

        const controller = new SubtitleTrackRecoveryController(
            createDeps({
                nowPlayingWarn,
                getVideoPlayer: () => ({} as IVideoPlayer),
                getCurrentStreamDecision: () =>
                    ({ transcodeRequest: { subtitleMode: 'burn' } } as StreamDecision),
                getPlaybackRecovery: () => playbackRecovery,
            })
        );

        controller.handleTrackChange({ type: 'subtitle', trackId: null });
        await flushPromises();

        expect(nowPlayingWarn).toHaveBeenCalledWith('Failed to disable burn-in subtitles');
    });

    it('does not warn when audio reload is ignored', async () => {
        const nowPlayingWarn = jest.fn();
        const playbackRecovery = {
            attemptAudioTrackReloadForCurrentProgram: jest.fn(async () => ({ outcome: 'ignored', reason: 'program_changed' })),
        } as unknown as PlaybackRecoveryManager;

        const controller = new SubtitleTrackRecoveryController(
            createDeps({
                nowPlayingWarn,
                getCurrentStreamDescriptor: () => ({ protocol: 'direct' } as StreamDescriptor),
                getPlaybackRecovery: () => playbackRecovery,
            })
        );

        controller.handleTrackChange({ type: 'audio', trackId: '1' });
        await flushPromises();

        expect(nowPlayingWarn).not.toHaveBeenCalled();
    });

    it('warns when burn-in disable rejects', async () => {
        const nowPlayingWarn = jest.fn();
        const playbackRecovery = {
            attemptDisableBurnInSubtitlesForCurrentProgram: jest.fn(async () => {
                throw new Error('network down');
            }),
        } as unknown as PlaybackRecoveryManager;

        const controller = new SubtitleTrackRecoveryController(
            createDeps({
                nowPlayingWarn,
                getVideoPlayer: () => ({} as IVideoPlayer),
                getCurrentStreamDecision: () =>
                    ({ transcodeRequest: { subtitleMode: 'burn' } } as StreamDecision),
                getPlaybackRecovery: () => playbackRecovery,
            })
        );

        controller.handleTrackChange({ type: 'subtitle', trackId: null });
        await flushPromises();

        expect(nowPlayingWarn).toHaveBeenCalledWith('Failed to disable burn-in subtitles');
    });

    it('does nothing on subtitle-off when playback recovery is unavailable', () => {
        const nowPlayingWarn = jest.fn();
        const controller = new SubtitleTrackRecoveryController(
            createDeps({
                nowPlayingWarn,
                getVideoPlayer: () => ({} as IVideoPlayer),
                getCurrentStreamDecision: () =>
                    ({ transcodeRequest: { subtitleMode: 'burn' } } as StreamDecision),
                getPlaybackRecovery: () => null,
            })
        );

        expect(() => {
            controller.handleTrackChange({ type: 'subtitle', trackId: null });
        }).not.toThrow();
        expect(nowPlayingWarn).not.toHaveBeenCalled();
    });

    it('records a diagnostic when burn-in reload reports a failed outcome', async () => {
        const appendIssueDiagnostic = jest.fn();
        const playbackRecovery = {
            attemptBurnInSubtitleForCurrentProgram: jest.fn(async () => ({ outcome: 'failed' })),
        } as unknown as PlaybackRecoveryManager;

        const controller = new SubtitleTrackRecoveryController(
            createDeps({
                appendIssueDiagnostic,
                getVideoPlayer: () =>
                    ({
                        getAvailableSubtitles: () => [{ id: 'sub-1', format: 'ass' }],
                    } as unknown as IVideoPlayer),
                readSubtitleMode: () => 'full',
                getPlaybackRecovery: () => playbackRecovery,
                getCurrentStreamDecision: () => null,
            })
        );

        controller.handleTrackChange({ type: 'subtitle', trackId: 'sub-1' });
        await flushPromises();

        expect(appendIssueDiagnostic).toHaveBeenCalledWith({
            key: 'orchestrator.subtitleTrackChange.burnInAttempt',
            data: {
                trackId: 'sub-1',
                format: 'ass',
            },
        });
        expect(appendIssueDiagnostic).toHaveBeenCalledWith({
            key: 'orchestrator.subtitleTrackChange.burnInFailure',
            data: {
                trackId: 'sub-1',
                format: 'ass',
            },
        });
    });

    it('does not record a failure diagnostic when burn-in reload is ignored', async () => {
        const appendIssueDiagnostic = jest.fn();
        const playbackRecovery = {
            attemptBurnInSubtitleForCurrentProgram: jest.fn(async () => ({ outcome: 'ignored', reason: 'already_burned_in' })),
        } as unknown as PlaybackRecoveryManager;

        const controller = new SubtitleTrackRecoveryController(
            createDeps({
                appendIssueDiagnostic,
                getVideoPlayer: () =>
                    ({
                        getAvailableSubtitles: () => [{ id: 'sub-1', format: 'ass' }],
                    } as unknown as IVideoPlayer),
                readSubtitleMode: () => 'full',
                getPlaybackRecovery: () => playbackRecovery,
                getCurrentStreamDecision: () => null,
            })
        );

        controller.handleTrackChange({ type: 'subtitle', trackId: 'sub-1' });
        await flushPromises();

        const failureDiagnostics = appendIssueDiagnostic.mock.calls.filter(
            ([payload]: [{ key?: string }]) => payload?.key === 'orchestrator.subtitleTrackChange.burnInFailure'
        );
        const attemptDiagnostics = appendIssueDiagnostic.mock.calls.filter(
            ([payload]: [{ key?: string }]) => payload?.key === 'orchestrator.subtitleTrackChange.burnInAttempt'
        );

        expect(failureDiagnostics).toHaveLength(0);
        expect(attemptDiagnostics).toHaveLength(0);
    });

    it('does not record burn-in attempt diagnostics when playback recovery is unavailable', async () => {
        const appendIssueDiagnostic = jest.fn();
        const nowPlayingWarn = jest.fn();

        const controller = new SubtitleTrackRecoveryController(
            createDeps({
                appendIssueDiagnostic,
                nowPlayingWarn,
                getVideoPlayer: () =>
                    ({
                        getAvailableSubtitles: () => [{ id: 'sub-1', format: 'ass' }],
                    } as unknown as IVideoPlayer),
                readSubtitleMode: () => 'full',
                getPlaybackRecovery: () => null,
                getCurrentStreamDecision: () => null,
            })
        );

        controller.handleTrackChange({ type: 'subtitle', trackId: 'sub-1' });
        await flushPromises();

        expect(nowPlayingWarn).not.toHaveBeenCalled();
        const burnInDiagnostics = appendIssueDiagnostic.mock.calls.filter(
            ([payload]: [{ key?: string }]) =>
                payload?.key === 'orchestrator.subtitleTrackChange.burnInAttempt' ||
                payload?.key === 'orchestrator.subtitleTrackChange.burnInFailure'
        );

        expect(burnInDiagnostics).toHaveLength(0);
    });

    it('records a diagnostic when burn-in reload rejects', async () => {
        const appendIssueDiagnostic = jest.fn();
        const playbackRecovery = {
            attemptBurnInSubtitleForCurrentProgram: jest.fn(async () => {
                throw new Error('resolver down');
            }),
        } as unknown as PlaybackRecoveryManager;

        const controller = new SubtitleTrackRecoveryController(
            createDeps({
                appendIssueDiagnostic,
                getVideoPlayer: () =>
                    ({
                        getAvailableSubtitles: () => [{ id: 'sub-1', format: 'ass' }],
                    } as unknown as IVideoPlayer),
                readSubtitleMode: () => 'full',
                getPlaybackRecovery: () => playbackRecovery,
                getCurrentStreamDecision: () => null,
            })
        );

        controller.handleTrackChange({ type: 'subtitle', trackId: 'sub-1' });
        await flushPromises();

        expect(appendIssueDiagnostic).toHaveBeenCalledWith({
            key: 'orchestrator.subtitleTrackChange.burnInAttempt',
            data: {
                trackId: 'sub-1',
                format: 'ass',
            },
        });
        expect(appendIssueDiagnostic).toHaveBeenCalledWith({
            key: 'orchestrator.subtitleTrackChange.burnInFailure',
            data: {
                trackId: 'sub-1',
                format: 'ass',
                error: 'Error: resolver down',
            },
        });
    });
});
