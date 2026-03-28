import { BURN_IN_SUBTITLE_FORMATS } from '../../modules/player/constants';
import type { IVideoPlayer, StreamDescriptor } from '../../modules/player';
import type { PlaybackRecoveryManager } from '../../modules/player/PlaybackRecoveryManager';
import type { StreamDecision } from '../../modules/plex/stream';
import { subtitleModeAllowsBurnIn, type SubtitleMode } from '../../shared/subtitle-mode';

export interface SubtitleTrackRecoveryControllerDeps {
    getVideoPlayer: () => IVideoPlayer | null;
    getPlaybackRecovery: () => PlaybackRecoveryManager | null;
    readSubtitleMode: () => SubtitleMode;
    setSubtitleTrack: (trackId: string | null) => Promise<void>;
    nowPlayingWarn: (message: string) => void;
    getCurrentStreamDecision: () => StreamDecision | null;
    getCurrentStreamDescriptor: () => StreamDescriptor | null;
    appendIssueDiagnostic: (payload: { key: string; data: unknown }) => void;
}

export class SubtitleTrackRecoveryController {
    constructor(private readonly _deps: SubtitleTrackRecoveryControllerDeps) {}

    public handleTrackChange(event: { type: 'audio' | 'subtitle'; trackId: string | null }): void {
        if (event.type === 'audio') {
            this._handleAudioTrackChange(event.trackId);
            return;
        }
        this._handleSubtitleTrackChange(event.trackId);
    }

    private _handleAudioTrackChange(trackId: string | null): void {
        if (!trackId || this._deps.getCurrentStreamDescriptor()?.protocol !== 'direct') {
            return;
        }

        const warnAudioReloadFailed = (): void => {
            this._deps.nowPlayingWarn('Failed to apply audio track change');
        };

        const reloadPromise =
            this._deps.getPlaybackRecovery()?.attemptAudioTrackReloadForCurrentProgram(
                trackId,
                'audio_track_change'
            ) ?? null;
        if (!reloadPromise) {
            return;
        }

        void reloadPromise.then((ok) => {
            if (!ok) {
                warnAudioReloadFailed();
            }
        });
    }

    private _handleSubtitleTrackChange(trackId: string | null): void {
        const videoPlayer = this._deps.getVideoPlayer();
        if (!videoPlayer) {
            return;
        }

        const decision = this._deps.getCurrentStreamDecision();
        this._deps.appendIssueDiagnostic({
            key: 'orchestrator.subtitleTrackChange',
            data: {
                trackId,
                currentSubtitleDelivery: decision?.subtitleDelivery ?? null,
                currentSubtitleMode: decision?.transcodeRequest?.subtitleMode ?? null,
            },
        });

        if (!trackId) {
            if (decision?.transcodeRequest?.subtitleMode === 'burn') {
                this._deps.appendIssueDiagnostic({
                    key: 'orchestrator.subtitleTrackOff.disableBurnInAttempt',
                    data: {
                        trackId: null,
                        subtitleMode: decision.transcodeRequest.subtitleMode,
                    },
                });
                const warnDisableFailed = (): void => {
                    this._deps.nowPlayingWarn('Failed to disable burn-in subtitles');
                };
                void this._deps.getPlaybackRecovery()?.attemptDisableBurnInSubtitlesForCurrentProgram(
                    'subtitle_track_off'
                )
                    .then((result) => {
                        if (result.outcome !== 'failed') return;
                        warnDisableFailed();
                    });
            }
            return;
        }

        const selected = videoPlayer.getAvailableSubtitles()
            .find((track) => track.id === trackId) ?? null;
        if (!selected) {
            return;
        }

        const format = (selected.format || selected.codec || '').toLowerCase();
        const isBurnIn = BURN_IN_SUBTITLE_FORMATS.includes(format);
        if (!isBurnIn) {
            return;
        }

        const subtitleMode = this._deps.readSubtitleMode();
        const allowBurnIn = subtitleModeAllowsBurnIn(subtitleMode);
        if (!allowBurnIn) {
            this._deps.nowPlayingWarn('Burn-in subtitles are disabled in Settings');
            void this._deps.setSubtitleTrack(null);
            return;
        }

        void this._deps.getPlaybackRecovery()?.attemptBurnInSubtitleForCurrentProgram(
            trackId,
            'subtitle_track_change'
        );
        this._deps.appendIssueDiagnostic({
            key: 'orchestrator.subtitleTrackChange.burnInAttempt',
            data: {
                trackId,
                format,
            },
        });
    }
}
