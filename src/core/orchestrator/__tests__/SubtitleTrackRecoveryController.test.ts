import {
    SubtitleTrackRecoveryController,
    type SubtitleTrackRecoveryControllerDeps,
} from '../controllers/SubtitleTrackRecoveryController';
import type { IVideoPlayer } from '../../../modules/player';
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
    it.each([
        {
            label: 'ignores audio changes without a direct stream descriptor',
            event: { type: 'audio' as const, trackId: 'audio-1' },
        },
        {
            label: 'ignores subtitle changes without a video player',
            event: { type: 'subtitle' as const, trackId: 'subtitle-1' },
        },
    ])('$label', ({ event }) => {
        const deps = createDeps();
        const controller = new SubtitleTrackRecoveryController(deps);

        controller.handleTrackChange(event);

        expect(deps.setSubtitleTrack).not.toHaveBeenCalled();
        expect(deps.nowPlayingWarn).not.toHaveBeenCalled();
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
