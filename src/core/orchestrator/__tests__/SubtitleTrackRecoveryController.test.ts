import {
    SubtitleTrackRecoveryController,
    type SubtitleTrackRecoveryControllerDeps,
} from '../controllers/SubtitleTrackRecoveryController';
import type { IVideoPlayer, StreamDescriptor } from '../../../modules/player';
import type { StreamDecision } from '../../../modules/plex/stream';

const createDeps = (
    overrides: Partial<SubtitleTrackRecoveryControllerDeps> = {}
): SubtitleTrackRecoveryControllerDeps => ({
    getVideoPlayer: jest.fn().mockReturnValue(null),
    getPlaybackRecovery: jest.fn().mockReturnValue(null),
    readSubtitleMode: jest.fn().mockReturnValue('full'),
    setSubtitleTrack: jest.fn().mockResolvedValue(undefined),
    nowPlayingWarn: jest.fn(),
    getCurrentStreamDecision: jest.fn().mockReturnValue(null),
    getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
    appendIssueDiagnostic: jest.fn(),
    ...overrides,
});

describe('SubtitleTrackRecoveryController', () => {
    it('does not start audio recovery for a non-direct stream', () => {
        const deps = createDeps({
            getCurrentStreamDescriptor: jest.fn(
                () => ({ protocol: 'hls' } as StreamDescriptor)
            ),
        });

        new SubtitleTrackRecoveryController(deps).handleTrackChange({
            type: 'audio',
            trackId: 'audio-1',
        });

        expect(deps.getCurrentStreamDescriptor).toHaveBeenCalledTimes(1);
        expect(deps.getPlaybackRecovery).not.toHaveBeenCalled();
    });

    it('does not record subtitle changes without a video player', () => {
        const deps = createDeps();

        new SubtitleTrackRecoveryController(deps).handleTrackChange({
            type: 'subtitle',
            trackId: 'subtitle-1',
        });

        expect(deps.getVideoPlayer).toHaveBeenCalledTimes(1);
        expect(deps.appendIssueDiagnostic).not.toHaveBeenCalled();
    });

    it('records subtitle-off changes without starting burn-in recovery when no burn is active', () => {
        const player = {} as IVideoPlayer;
        const deps = createDeps({
            getVideoPlayer: () => player,
            getCurrentStreamDecision: () => null,
        });

        new SubtitleTrackRecoveryController(deps).handleTrackChange({
            type: 'subtitle',
            trackId: null,
        });

        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith({
            key: 'orchestrator.subtitleTrackChange',
            data: {
                trackId: null,
                currentSubtitleDelivery: null,
                currentSubtitleMode: null,
            },
        });
        expect(deps.getPlaybackRecovery).not.toHaveBeenCalled();
    });

    it('warns and clears a disallowed burn-in subtitle selection', () => {
        const player = {
            getAvailableSubtitles: jest.fn().mockReturnValue([
                { id: 'pgs-1', format: 'pgs' },
            ]),
        } as unknown as IVideoPlayer;
        const decision = {
            subtitleDelivery: 'burn',
            transcodeRequest: { subtitleMode: 'burn' },
        } as StreamDecision;
        const deps = createDeps({
            getVideoPlayer: () => player,
            getCurrentStreamDecision: () => decision,
            readSubtitleMode: () => 'standard',
        });

        new SubtitleTrackRecoveryController(deps).handleTrackChange({
            type: 'subtitle',
            trackId: 'pgs-1',
        });

        expect(deps.nowPlayingWarn).toHaveBeenCalledWith(
            'Burn-in subtitles are disabled in Settings'
        );
        expect(deps.setSubtitleTrack).toHaveBeenCalledWith(null);
        expect(deps.getPlaybackRecovery).not.toHaveBeenCalled();
    });
});
