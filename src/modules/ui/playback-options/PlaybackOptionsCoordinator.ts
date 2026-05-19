import type { INavigationManager, FocusableElement } from '../../navigation';
import type { IPlaybackOptionsModal } from './interfaces';
import type {
    PlaybackOptionsViewModel,
    PlaybackOptionsItem,
    PlaybackOptionsSectionId,
} from './types';
import type { IVideoPlayer } from '../../player';
import type { BurnInSubtitleRecoveryResult } from '../../player/PlaybackRecoveryManager';
import type { ScheduledProgram } from '../../scheduler/scheduler';
import type {
    StreamDescriptor,
    SubtitleTrack,
} from '../../player/types';
import { BURN_IN_SUBTITLE_FORMATS } from '../../../shared/subtitle-formats';
import {
    subtitleModeAllowsBurnIn,
    subtitleModeIsDirectOnly,
} from '../../../shared/subtitle-mode';
import { SubtitlePreferencesStore } from '../../settings/SubtitlePreferencesStore';
import type { ToastInput } from '../toast/types';
import { formatAudioLabel } from '../../../utils/formatAudioLabel';
import {
    PlaybackSubtitleProbePolicy,
    SUBTITLE_PROBE_TOTAL_TIMEOUT_MS,
} from './PlaybackSubtitleProbePolicy';

export { SUBTITLE_PROBE_TOTAL_TIMEOUT_MS };

interface PlaybackOptionsCoordinatorDeps {
    playbackOptionsModalId: string;
    getNavigation: () => INavigationManager | null;
    getPlaybackOptionsModal: () => IPlaybackOptionsModal | null;
    getVideoPlayer: () => IVideoPlayer | null;
    getCurrentStreamDescriptor?: () => StreamDescriptor | null;
    getCurrentProgram: () => ScheduledProgram | null;
    requestBurnInSubtitle?: (
        trackId: string,
        reason: string
    ) => BurnInSubtitleRecoveryResult | Promise<BurnInSubtitleRecoveryResult>;
    notifyToast?: (toast: ToastInput) => void;
    subtitlePreferencesStore?: SubtitlePreferencesStore;
}

export class PlaybackOptionsCoordinator {
    private readonly subtitlePreferencesStore: SubtitlePreferencesStore;
    private pendingViewModel: PlaybackOptionsViewModel | null = null;
    private pendingFocusableIds: string[] = [];
    private pendingPreferredFocusId: string | null = null;
    private registeredFocusableIds: string[] = [];
    private preferredSection: PlaybackOptionsSectionId = 'subtitles';
    private readonly subtitleProbePolicy = new PlaybackSubtitleProbePolicy();
    private subtitleSelectToken = 0;
    private lifecycleToken = 0;

    constructor(private readonly deps: PlaybackOptionsCoordinatorDeps) {
        this.subtitlePreferencesStore = deps.subtitlePreferencesStore ?? new SubtitlePreferencesStore();
    }

    prepareModal(
        preferredSection: PlaybackOptionsSectionId = 'subtitles'
    ): { focusableIds: string[]; preferredFocusId: string | null } {
        const viewModel = this.buildViewModel();
        this.pendingViewModel = viewModel;
        this.pendingFocusableIds = this.collectFocusableIds(viewModel);
        this.preferredSection = preferredSection;
        this.pendingPreferredFocusId = this.resolvePreferredFocusId(viewModel, preferredSection);
        return {
            focusableIds: [...this.pendingFocusableIds],
            preferredFocusId: this.pendingPreferredFocusId,
        };
    }

    handleModalOpen(modalId: string): void {
        if (modalId !== this.deps.playbackOptionsModalId) return;
        const modal = this.deps.getPlaybackOptionsModal();
        const navigation = this.deps.getNavigation();
        if (!modal || !navigation) return;

        const viewModel = this.pendingViewModel ?? this.buildViewModel();
        modal.show(viewModel);
        this.registerFocusables(viewModel, this.pendingPreferredFocusId);

        this.pendingViewModel = null;
        this.pendingFocusableIds = [];
        this.pendingPreferredFocusId = null;
    }

    handleModalClose(modalId: string): void {
        if (modalId !== this.deps.playbackOptionsModalId) return;
        const modal = this.deps.getPlaybackOptionsModal();
        modal?.hide();
        this.unregisterFocusables();
    }

    dispose(): void {
        this.lifecycleToken += 1;
        this.subtitleSelectToken += 1;
        this.unregisterFocusables();
        this.pendingViewModel = null;
        this.pendingFocusableIds = [];
        this.pendingPreferredFocusId = null;
        this.subtitleProbePolicy.clearCache();
    }

    refreshIfOpen(): void {
        const modal = this.deps.getPlaybackOptionsModal();
        const navigation = this.deps.getNavigation();
        if (!modal || !navigation?.isModalOpen(this.deps.playbackOptionsModalId)) {
            return;
        }
        const viewModel = this.buildViewModel();
        modal.update(viewModel);
        this.unregisterFocusables();
        this.registerFocusables(
            viewModel,
            this.resolvePreferredFocusId(viewModel, this.preferredSection)
        );
    }

    private buildViewModel(): PlaybackOptionsViewModel {
        const player = this.deps.getVideoPlayer();
        const subtitleMode = this.subtitlePreferencesStore.readSubtitleModeAndClean('full');
        const externalOnly = subtitleModeIsDirectOnly(subtitleMode);
        const allowBurnIn = subtitleModeAllowsBurnIn(subtitleMode);
        const subtitleTracks = player?.getAvailableSubtitles() ?? [];
        const enabledSubtitleTracks = subtitleTracks;
        const audioTracks = player?.getAvailableAudio() ?? [];
        const state = player?.getState();
        const effectiveActiveSubtitleId = state?.activeSubtitleId ?? null;
        const activeAudioId = state?.activeAudioId ?? null;

        const subtitleOptions: PlaybackOptionsItem[] = [
            {
                id: 'playback-subtitle-off',
                label: 'Off',
                selected: effectiveActiveSubtitleId === null,
                onSelect: (): void => {
                    this.handleSubtitleSelect(null);
                },
            },
        ];

        const textTracks = enabledSubtitleTracks.filter(
            (track) => track.isTextCandidate && (track.fetchableViaKey || track.id)
        );
        const visibleTextTracks = externalOnly
            ? textTracks.filter((track) => track.fetchableViaKey)
            : textTracks;
        const burnInTracks = allowBurnIn && !externalOnly
            ? enabledSubtitleTracks.filter((track) => this.isBurnInTrack(track))
            : [];

        for (const track of visibleTextTracks) {
            subtitleOptions.push({
                id: `playback-subtitle-${track.id}`,
                label: track.label,
                meta: track.fetchableViaKey ? 'Direct' : 'Extract',
                selected: effectiveActiveSubtitleId === track.id,
                onSelect: (): void => {
                    this.handleSubtitleSelect(track.id);
                },
            });
        }

        for (const track of burnInTracks) {
            subtitleOptions.push({
                id: `playback-subtitle-${track.id}`,
                label: track.label,
                meta: 'Burn-in',
                selected: effectiveActiveSubtitleId === track.id,
                onSelect: (): void => {
                    this.handleSubtitleSelect(track.id);
                },
            });
        }

        const hasAnyTracks = subtitleTracks.length > 0;
        const hasVisibleTracks = visibleTextTracks.length > 0 || burnInTracks.length > 0;
        const subtitleEmptyMessage = !hasAnyTracks
            ? 'No subtitles available'
            : (!hasVisibleTracks
                ? (externalOnly ? 'No direct subtitles available' : 'No compatible subtitles available')
                : undefined);

        const audioOptions = audioTracks.map((track) => ({
            id: `playback-audio-${track.id}`,
            label: formatAudioLabel(track),
            selected: activeAudioId === track.id,
            onSelect: (): void => {
                this.handleAudioSelect(track.id);
            },
        }));

        return {
            title: 'Playback Options',
            subtitles: {
                title: 'Subtitles',
                options: subtitleOptions,
                helperText: 'Direct is fastest. Extract uses the server. Full mode can use Burn-in (transcodes) when needed.',
                ...(subtitleEmptyMessage ? { emptyMessage: subtitleEmptyMessage } : {}),
            },
            audio: {
                title: 'Audio',
                options: audioOptions,
                ...(audioTracks.length === 0 ? { emptyMessage: 'No alternate audio tracks available' } : {}),
            },
        };
    }

    private collectFocusableIds(viewModel: PlaybackOptionsViewModel): string[] {
        return [
            ...viewModel.subtitles.options.map((option) => option.id),
            ...viewModel.audio.options.map((option) => option.id),
        ];
    }

    private resolvePreferredFocusId(
        viewModel: PlaybackOptionsViewModel,
        preferredSection: PlaybackOptionsSectionId
    ): string | null {
        const selectedSubtitle = viewModel.subtitles.options.find((option) => option.selected);
        const selectedAudio = viewModel.audio.options.find((option) => option.selected);

        if (preferredSection === 'audio') {
            if (selectedAudio) return selectedAudio.id;
            const firstAudio = viewModel.audio.options[0];
            if (firstAudio) return firstAudio.id;
            if (selectedSubtitle) return selectedSubtitle.id;
            return viewModel.subtitles.options[0]?.id ?? null;
        }

        if (selectedSubtitle) return selectedSubtitle.id;
        const firstSubtitle = viewModel.subtitles.options[0];
        if (firstSubtitle) return firstSubtitle.id;
        if (selectedAudio) return selectedAudio.id;
        return viewModel.audio.options[0]?.id ?? null;
    }

    private registerFocusables(
        viewModel: PlaybackOptionsViewModel,
        preferredFocusId: string | null
    ): void {
        const navigation = this.deps.getNavigation();
        if (!navigation) return;

        const focusableIds = this.collectFocusableIds(viewModel);
        this.registeredFocusableIds = focusableIds;

        for (let i = 0; i < focusableIds.length; i++) {
            const id = focusableIds[i];
            if (!id) continue;
            const element = document.getElementById(id) as HTMLElement | null;
            if (!element) continue;
            const neighbors: FocusableElement['neighbors'] = {};
            const upId = i > 0 ? focusableIds[i - 1] : undefined;
            const downId = i < focusableIds.length - 1 ? focusableIds[i + 1] : undefined;
            if (upId) neighbors.up = upId;
            if (downId) neighbors.down = downId;

            navigation.registerFocusable({
                id,
                element,
                preventScrollOnFocus: true,
                neighbors,
                onSelect: () => element.click(),
            });
        }

        const initialFocus = preferredFocusId && focusableIds.includes(preferredFocusId)
            ? preferredFocusId
            : focusableIds[0] ?? null;
        if (initialFocus) {
            navigation.setFocus(initialFocus);
        }
    }

    private unregisterFocusables(): void {
        const navigation = this.deps.getNavigation();
        if (!navigation) return;
        for (const id of this.registeredFocusableIds) {
            navigation.unregisterFocusable(id);
        }
        this.registeredFocusableIds = [];
    }

    private refreshAndCloseModal(): void {
        this.refreshIfOpen();
        this.closeModalAndReturnFocus();
    }

    private handleSubtitleSelect(trackId: string | null): void {
        const selectionState = this.beginSubtitleSelection();
        void this.handleSubtitleSelectAsync(trackId, selectionState);
    }

    private async handleSubtitleSelectAsync(
        trackId: string | null,
        selectionState: SubtitleSelectionState
    ): Promise<void> {
        const player = this.deps.getVideoPlayer();
        if (!player) return;
        if (trackId) {
            const mode = this.subtitlePreferencesStore.readSubtitleModeAndClean('full');
            if (mode === 'off') {
                // Selecting a subtitle should implicitly enable subtitle handling.
                this.subtitlePreferencesStore.writeSubtitleMode('standard');
            }
        }
        const track = trackId
            ? player.getAvailableSubtitles().find((t) => t.id === trackId) ?? null
            : null;

        if (trackId && track) {
            const shouldContinue = await this.maybeHandleBurnInSubtitleSelection(
                trackId,
                track,
                selectionState,
                player
            );
            if (!shouldContinue) {
                return;
            }
        }

        if (!this.isSubtitleSelectionStateCurrent(selectionState)) {
            this.handleStaleSubtitleSelection(selectionState);
            return;
        }

        player.setSubtitleTrack(trackId).catch(() => {
            // Subtitle selection errors are handled by SubtitleManager fallback/Toast.
        });
        // Intentionally do not persist subtitle track selections (webOS subtitle reliability concerns).
        this.refreshAndCloseModal();
    }

    private async maybeHandleBurnInSubtitleSelection(
        trackId: string,
        track: SubtitleTrack,
        selectionState: SubtitleSelectionState,
        player: IVideoPlayer
    ): Promise<boolean> {
        const mode = this.subtitlePreferencesStore.readSubtitleModeAndClean('full');
        const allowBurnIn = subtitleModeAllowsBurnIn(mode);
        if (!allowBurnIn) {
            return true;
        }

        // For burn-in formats (PGS/ASS/etc), go straight to the burn-in stream reload.
        if (this.isBurnInTrack(track)) {
            this.requestBurnInSubtitle(
                track.id,
                'user_selected_burn_in_format',
                selectionState
            );
            this.refreshAndCloseModal();
            return false;
        }

        if (!track.isTextCandidate) {
            return true;
        }

        // Direct-fetchable tracks don't need probing – they already have a known-good key.
        if (track.fetchableViaKey && track.key) {
            return true;
        }

        const selectedItemKey = this.getCurrentProgramItemKey();
        const decision = await this.subtitleProbePolicy.probeTextSubtitleExtractability({
            track,
            context: this.deps.getCurrentStreamDescriptor?.()?.subtitleContext ?? null,
            fallbackItemKey: selectedItemKey,
        });
        if (!this.isSubtitleSelectionStateCurrent(selectionState)) {
            this.handleStaleSubtitleSelection(selectionState);
            return false;
        }

        const currentItemKey = this.getCurrentProgramItemKey();
        const currentTrack = player.getAvailableSubtitles().find((candidate) => candidate.id === trackId) ?? null;
        if (currentItemKey !== selectedItemKey || !currentTrack) {
            // Program rollover or track list changes can occur while probing; drop stale results.
            this.refreshIfOpen();
            return false;
        }

        if (decision === 'unsupported') {
            this.requestBurnInSubtitle(
                currentTrack.id,
                'user_selected_text_extract_probe_unsupported',
                selectionState
            );
            this.refreshAndCloseModal();
            return false;
        }

        return true;
    }

    private requestBurnInSubtitle(
        trackId: string,
        reason: string,
        selectionState: SubtitleSelectionState
    ): void {
        const request = this.deps.requestBurnInSubtitle;
        if (!request) {
            if (this.isSubtitleSelectionStateCurrent(selectionState)) {
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
                    if (result.outcome === 'failed') {
                        this.deps.notifyToast?.({ message: 'Failed to load burn-in subtitles', type: 'warning' });
                    }
                })
                .catch(() => {
                    if (this.isSubtitleSelectionStateCurrent(selectionState)) {
                        this.deps.notifyToast?.({ message: 'Failed to load burn-in subtitles', type: 'warning' });
                    }
                });
        } catch {
            if (this.isSubtitleSelectionStateCurrent(selectionState)) {
                this.deps.notifyToast?.({ message: 'Failed to load burn-in subtitles', type: 'warning' });
            }
        }
    }

    private beginSubtitleSelection(): SubtitleSelectionState {
        this.subtitleSelectToken += 1;
        return {
            selectionToken: this.subtitleSelectToken,
            lifecycleToken: this.lifecycleToken,
        };
    }

    private isSubtitleSelectionStateCurrent(selectionState: SubtitleSelectionState): boolean {
        return selectionState.lifecycleToken === this.lifecycleToken
            && selectionState.selectionToken === this.subtitleSelectToken;
    }

    private handleStaleSubtitleSelection(selectionState: SubtitleSelectionState): void {
        if (selectionState.lifecycleToken !== this.lifecycleToken) {
            return;
        }
        this.refreshIfOpen();
    }

    private getCurrentProgramItemKey(): string | null {
        return this.deps.getCurrentProgram()?.item.ratingKey ?? null;
    }

    private handleAudioSelect(trackId: string): void {
        const player = this.deps.getVideoPlayer();
        if (!player) return;
        player.setAudioTrack(trackId)
            .catch(() => {
                this.deps.notifyToast?.({ message: 'Failed to apply audio track change', type: 'warning' });
            })
            .finally(() => {
                this.refreshIfOpen();
            });
        this.closeModalAndReturnFocus();
    }

    private closeModalAndReturnFocus(): void {
        const navigation = this.deps.getNavigation();
        if (!navigation) return;
        if (navigation.isModalOpen(this.deps.playbackOptionsModalId)) {
            navigation.closeModal(this.deps.playbackOptionsModalId);
        }
    }


    private isBurnInTrack(track: SubtitleTrack): boolean {
        const format = (track.format || track.codec || '').toLowerCase();
        return BURN_IN_SUBTITLE_FORMATS.includes(format);
    }
}

interface SubtitleSelectionState {
    selectionToken: number;
    lifecycleToken: number;
}
