import type {
    PlaybackOptionsViewModel,
    PlaybackOptionsItem,
    PlaybackOptionsSectionId,
} from './types';
import type { BurnInSubtitleRecoveryResult, IVideoPlayer, StreamDescriptor, SubtitleTrack } from '../../player';
import { SubtitlePreferencesStore } from '../../settings/SubtitlePreferencesStore';
import type { ToastInput } from '../../../shared/toast';
import { formatAudioLabel } from '../../player';
import { SUBTITLE_MODES } from '../../../shared/subtitle-mode';
import {
    classifyPlaybackSubtitleOption,
    isBurnInSubtitleTrack,
} from './PlaybackSubtitleOptionPolicy';

interface PlaybackOptionsCoordinatorDeps {
    getVideoPlayer: () => IVideoPlayer | null;
    requestBurnInSubtitle?: (
        trackId: string,
        reason: string
    ) => BurnInSubtitleRecoveryResult | Promise<BurnInSubtitleRecoveryResult>;
    notifyToast?: (toast: ToastInput) => void;
    subtitlePreferencesStore?: SubtitlePreferencesStore;
    getMediaIdentity?: () => unknown;
    getMediaDescriptor?: () => StreamDescriptor | null;
    getConfirmedBurnedInTrackId?: () => string | null;
    onSelectionChange?: () => void;
}

export class PlaybackOptionsCoordinator {
    private readonly subtitlePreferencesStore: SubtitlePreferencesStore;
    private subtitleSelectToken = 0;
    private audioSelectToken = 0;
    private lifecycleToken = 0;
    private pendingSelection: { section: PlaybackOptionsSectionId; id: string; token: number; identity: unknown; descriptor: StreamDescriptor | null } | null = null;
    private failedSelection: { section: PlaybackOptionsSectionId; id: string; identity: unknown; descriptor: StreamDescriptor | null } | null = null;
    private lastMediaIdentity: unknown;
    private lastMediaDescriptor: StreamDescriptor | null = null;

    constructor(private readonly deps: PlaybackOptionsCoordinatorDeps) {
        this.subtitlePreferencesStore = deps.subtitlePreferencesStore ?? new SubtitlePreferencesStore();
    }

    /** Presentation reads this policy projection; it owns drawer visibility and focus. */
    getViewModel(): PlaybackOptionsViewModel {
        return this.buildViewModel();
    }

    dispose(): void {
        this.lifecycleToken += 1;
        this.subtitleSelectToken += 1;
        this.audioSelectToken += 1;
        this.pendingSelection = null;
        this.failedSelection = null;
    }

    private buildViewModel(): PlaybackOptionsViewModel {
        const identity = this.deps.getMediaIdentity?.();
        const descriptor = this.deps.getMediaDescriptor?.() ?? null;
        if (identity !== this.lastMediaIdentity || descriptor !== this.lastMediaDescriptor) {
            this.lastMediaIdentity = identity;
            this.lastMediaDescriptor = descriptor;
            this.pendingSelection = null;
            this.failedSelection = null;
            this.subtitleSelectToken += 1;
            this.audioSelectToken += 1;
        }
        const player = this.deps.getVideoPlayer();
        const subtitleMode = this.subtitlePreferencesStore.readSubtitleModeAndClean('full');
        const subtitleTracks = player?.getAvailableSubtitles() ?? [];
        const enabledSubtitleTracks = subtitleTracks;
        const audioTracks = player?.getAvailableAudio() ?? [];
        const state = player?.getState();
        const effectiveActiveSubtitleId = state?.activeSubtitleId ?? this.deps.getConfirmedBurnedInTrackId?.() ?? null;
        const activeAudioId = state?.activeAudioId ?? null;
        const subtitlePending = this.pendingSelection?.section === 'subtitles' &&
            this.pendingSelection.identity === identity && this.pendingSelection.descriptor === descriptor
            ? this.pendingSelection.id : null;
        const audioPending = this.pendingSelection?.section === 'audio' &&
            this.pendingSelection.identity === identity && this.pendingSelection.descriptor === descriptor
            ? this.pendingSelection.id : null;
        const subtitleFailed = this.failedSelection?.section === 'subtitles' &&
            this.failedSelection.identity === identity && this.failedSelection.descriptor === descriptor
            ? this.failedSelection.id : null;
        const audioFailed = this.failedSelection?.section === 'audio' &&
            this.failedSelection.identity === identity && this.failedSelection.descriptor === descriptor
            ? this.failedSelection.id : null;

        const subtitleOptions: PlaybackOptionsItem[] = [
            {
                id: 'playback-subtitle-off',
                label: 'Off',
                selected: effectiveActiveSubtitleId === null,
                ...(subtitlePending === 'playback-subtitle-off' ? { state: 'Applying…' } : {}),
                ...(subtitleFailed === 'playback-subtitle-off' ? { state: 'Failed' } : {}),
                onSelect: (): void => {
                    this.handleSubtitleSelect(null);
                },
            },
        ];

        let visibleTrackCount = 0;
        for (const track of enabledSubtitleTracks) {
            const kind = classifyPlaybackSubtitleOption({
                track,
                subtitleMode,
                canRequestBurnIn: Boolean(this.deps.requestBurnInSubtitle),
            });
            if (kind === 'hidden') {
                if (effectiveActiveSubtitleId === track.id) {
                    subtitleOptions.push({
                        id: `playback-subtitle-${track.id}`,
                        label: track.label,
                        state: 'Selected · unavailable in this mode',
                        selected: true,
                        disabled: true,
                        onSelect: (): void => undefined,
                    });
                }
                continue;
            }
            visibleTrackCount += 1;
            subtitleOptions.push({
                id: `playback-subtitle-${track.id}`,
                label: track.label,
                meta: kind === 'direct' ? 'Direct' : kind === 'extract' ? 'Extract' : 'Burn-in',
                selected: effectiveActiveSubtitleId === track.id,
                ...(subtitlePending === `playback-subtitle-${track.id}` ? { state: 'Applying…' } : {}),
                ...(subtitleFailed === `playback-subtitle-${track.id}` ? { state: 'Failed' } : {}),
                ...(kind === 'disabled' ? { disabled: true, state: 'Unavailable' } : {}),
                onSelect: (): void => {
                    if (kind === 'disabled') {
                        this.deps.notifyToast?.({ message: 'Burn-in subtitles unavailable', type: 'warning' });
                        return;
                    }
                    if (kind === 'burn_in') {
                        this.handleBurnInSubtitleSelect(track.id, track);
                        return;
                    }
                    this.handleSubtitleSelect(track.id);
                },
            });
        }

        const hasAnyTracks = subtitleTracks.length > 0;
        const hasVisibleTracks = visibleTrackCount > 0;
        const subtitleEmptyMessage = !hasAnyTracks
            ? 'No subtitles available'
            : (!hasVisibleTracks
                ? (subtitleMode === 'direct' ? 'No direct subtitles available' : 'No compatible subtitles available')
                : undefined);

        const audioOptions: PlaybackOptionsItem[] = audioTracks.map((track) => ({
            id: `playback-audio-${track.id}`,
            label: formatAudioLabel(track),
            selected: activeAudioId === track.id,
            ...(audioPending === `playback-audio-${track.id}` ? { state: 'Applying…' } : {}),
            ...(audioFailed === `playback-audio-${track.id}` ? { state: 'Failed' } : {}),
            onSelect: (): void => {
                this.handleAudioSelect(track.id);
            },
        }));

        if (effectiveActiveSubtitleId && !subtitleTracks.some((track) => track.id === effectiveActiveSubtitleId)) {
            subtitleOptions.push({
                id: `playback-subtitle-retired-${effectiveActiveSubtitleId}`,
                label: 'Previous subtitle track',
                state: 'No longer available',
                selected: true,
                disabled: true,
                onSelect: (): void => undefined,
            });
        }
        if (activeAudioId && !audioTracks.some((track) => track.id === activeAudioId)) {
            audioOptions.push({
                id: `playback-audio-retired-${activeAudioId}`,
                label: 'Previous audio track',
                state: 'No longer available',
                selected: true,
                disabled: true,
                onSelect: (): void => undefined,
            });
        }

        return {
            title: 'Playback Options',
            subtitles: {
                title: 'Subtitles',
                options: subtitleOptions,
                helperText: 'Direct is fastest. Extract uses the server. Full mode can use Burn-in (transcodes) when needed.',
                modeOptions: SUBTITLE_MODES.map((mode) => ({
                    id: `playback-subtitle-mode-${mode}`,
                    label: mode.charAt(0).toUpperCase() + mode.slice(1),
                    selected: subtitleMode === mode,
                    onSelect: (): void => {
                        if (mode === 'off') {
                            this.handleSubtitleSelect(null);
                        } else {
                            this.subtitlePreferencesStore.writeSubtitleMode(mode);
                            this.deps.onSelectionChange?.();
                        }
                    },
                })),
                ...(subtitleEmptyMessage ? { emptyMessage: state?.status === 'loading' ? 'Loading subtitles…' : subtitleEmptyMessage } : {}),
            },
            audio: {
                title: 'Audio',
                options: audioOptions,
                ...(audioTracks.length === 0 ? { emptyMessage: state?.status === 'loading' ? 'Loading audio tracks…' : 'No alternate audio tracks available' } : {}),
            },
        };
    }

    private handleSubtitleSelect(trackId: string | null): void {
        const selectionState = this.beginSubtitleSelection();
        this.setPendingSelection('subtitles', trackId === null ? 'playback-subtitle-off' : `playback-subtitle-${trackId}`, selectionState.selectionToken);
        void this.handleSubtitleSelectAsync(trackId, selectionState);
    }

    private handleBurnInSubtitleSelect(trackId: string, track: SubtitleTrack): void {
        const selectionState = this.beginSubtitleSelection();
        this.setPendingSelection('subtitles', `playback-subtitle-${trackId}`, selectionState.selectionToken);
        this.requestBurnInSubtitle(
            trackId,
            isBurnInSubtitleTrack(track) ? 'user_selected_burn_in_format' : 'user_selected_text_burn_in',
            selectionState
        );
    }

    private async handleSubtitleSelectAsync(
        trackId: string | null,
        selectionState: SubtitleSelectionState
    ): Promise<void> {
        const player = this.deps.getVideoPlayer();
        if (!player) {
            this.finishSelection('subtitles', selectionState.selectionToken, false);
            return;
        }
        const track = trackId
            ? player.getAvailableSubtitles().find((t) => t.id === trackId) ?? null
            : null;
        if (trackId && !track) {
            this.finishSelection('subtitles', selectionState.selectionToken, false);
            return;
        }

        if (!this.isSubtitleSelectionStateCurrent(selectionState)) {
            this.handleStaleSubtitleSelection(selectionState);
            return;
        }

        const previousMode = this.subtitlePreferencesStore.readSubtitleModeAndClean('full');
        if (trackId === null) {
            this.subtitlePreferencesStore.writeSubtitleMode('off');
        } else if (previousMode === 'off') {
            // The track-change recovery listener reads mode synchronously.
            this.subtitlePreferencesStore.writeSubtitleMode('standard');
        }
        try {
            await player.setSubtitleTrack(trackId);
            if (!this.isSubtitleSelectionStateCurrent(selectionState)) return;
            // Track IDs remain session-scoped; never persist them.
            this.finishSelection('subtitles', selectionState.selectionToken, true);
        } catch {
            if (!this.isSubtitleSelectionStateCurrent(selectionState)) return;
            this.subtitlePreferencesStore.writeSubtitleMode(previousMode);
            this.finishSelection('subtitles', selectionState.selectionToken, false);
            this.deps.notifyToast?.({ message: 'Could not apply subtitle track', type: 'warning' });
        }
    }

    private requestBurnInSubtitle(
        trackId: string,
        reason: string,
        selectionState: SubtitleSelectionState
    ): void {
        const request = this.deps.requestBurnInSubtitle;
        if (!request) {
            if (this.isSubtitleSelectionStateCurrent(selectionState)) {
                this.finishSelection('subtitles', selectionState.selectionToken, false);
                this.deps.notifyToast?.({ message: 'Burn-in subtitles unavailable', type: 'warning' });
            }
            return;
        }
        if (this.isSubtitleSelectionStateCurrent(selectionState)) {
            this.deps.notifyToast?.({ message: 'Loading burn-in subtitles…', type: 'info' });
        }
        try {
            void Promise.resolve(request(trackId, reason))
                .then((result) => {
                    if (!this.isSubtitleSelectionStateCurrent(selectionState)) {
                        return;
                    }
                    if (result.outcome === 'burned_in'
                        || (result.outcome === 'ignored' && result.reason === 'already_burned_in')) {
                        this.finishSelection('subtitles', selectionState.selectionToken, true);
                    } else {
                        this.finishSelection('subtitles', selectionState.selectionToken, false);
                        this.deps.notifyToast?.({ message: 'Failed to load burn-in subtitles', type: 'warning' });
                    }
                })
                .catch(() => {
                    if (this.isSubtitleSelectionStateCurrent(selectionState)) {
                        this.finishSelection('subtitles', selectionState.selectionToken, false);
                        this.deps.notifyToast?.({ message: 'Failed to load burn-in subtitles', type: 'warning' });
                    }
                });
        } catch {
            if (this.isSubtitleSelectionStateCurrent(selectionState)) {
                this.finishSelection('subtitles', selectionState.selectionToken, false);
                this.deps.notifyToast?.({ message: 'Failed to load burn-in subtitles', type: 'warning' });
            }
        }
    }

    private beginSubtitleSelection(): SubtitleSelectionState {
        this.subtitleSelectToken += 1;
        return {
            selectionToken: this.subtitleSelectToken,
            lifecycleToken: this.lifecycleToken,
            mediaIdentity: this.deps.getMediaIdentity?.(),
            descriptor: this.deps.getMediaDescriptor?.() ?? null,
            player: this.deps.getVideoPlayer(),
        };
    }

    private isSubtitleSelectionStateCurrent(selectionState: SubtitleSelectionState): boolean {
        return selectionState.lifecycleToken === this.lifecycleToken
            && selectionState.selectionToken === this.subtitleSelectToken
            && selectionState.mediaIdentity === this.deps.getMediaIdentity?.()
            && selectionState.descriptor === (this.deps.getMediaDescriptor?.() ?? null)
            && selectionState.player === this.deps.getVideoPlayer();
    }

    private handleStaleSubtitleSelection(selectionState: SubtitleSelectionState): void {
        if (selectionState.lifecycleToken !== this.lifecycleToken) {
            return;
        }
    }

    private handleAudioSelect(trackId: string): void {
        const player = this.deps.getVideoPlayer();
        if (!player) return;
        const token = ++this.audioSelectToken;
        const lifecycleToken = this.lifecycleToken;
        this.setPendingSelection('audio', `playback-audio-${trackId}`, token);
        const identity = this.deps.getMediaIdentity?.();
        const descriptor = this.deps.getMediaDescriptor?.() ?? null;
        player.setAudioTrack(trackId)
            .then(() => {
                if (token !== this.audioSelectToken || lifecycleToken !== this.lifecycleToken ||
                    this.deps.getMediaIdentity?.() !== identity ||
                    (this.deps.getMediaDescriptor?.() ?? null) !== descriptor || this.deps.getVideoPlayer() !== player) return;
                this.finishSelection('audio', token, true);
            })
            .catch(() => {
                if (token !== this.audioSelectToken || lifecycleToken !== this.lifecycleToken ||
                    this.deps.getMediaIdentity?.() !== identity ||
                    (this.deps.getMediaDescriptor?.() ?? null) !== descriptor || this.deps.getVideoPlayer() !== player) return;
                this.finishSelection('audio', token, false);
                this.deps.notifyToast?.({ message: 'Failed to apply audio track change', type: 'warning' });
            });
    }

    private setPendingSelection(section: PlaybackOptionsSectionId, id: string, token: number): void {
        this.pendingSelection = {
            section, id, token,
            identity: this.deps.getMediaIdentity?.(),
            descriptor: this.deps.getMediaDescriptor?.() ?? null,
        };
        this.failedSelection = null;
        this.deps.onSelectionChange?.();
    }

    private finishSelection(section: PlaybackOptionsSectionId, token: number, ok: boolean): void {
        const pending = this.pendingSelection;
        if (!pending || pending.section !== section || pending.token !== token ||
            pending.identity !== this.deps.getMediaIdentity?.() ||
            pending.descriptor !== (this.deps.getMediaDescriptor?.() ?? null)) return;
        this.pendingSelection = null;
        this.failedSelection = ok ? null : {
            section, id: pending.id, identity: pending.identity, descriptor: pending.descriptor,
        };
        this.deps.onSelectionChange?.();
    }


}

interface SubtitleSelectionState {
    selectionToken: number;
    lifecycleToken: number;
    mediaIdentity: unknown;
    descriptor: StreamDescriptor | null;
    player: IVideoPlayer | null;
}
