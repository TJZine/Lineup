import { SubtitleTrackRecoveryController, type SubtitleTrackRecoveryControllerDeps } from '../../core/orchestrator/SubtitleTrackRecoveryController';
import type { IVideoPlayer, StreamDescriptor } from '../../modules/player';
import type { PlaybackRecoveryManager } from '../../modules/player/PlaybackRecoveryManager';
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
            attemptAudioTrackReloadForCurrentProgram: jest.fn(async () => false),
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
});
