import type { INavigationManager, FocusableElement } from '../../navigation';
import type { IPlaybackOptionsModal } from './interfaces';
import type {
    PlaybackOptionsViewModel,
    PlaybackOptionsItem,
    PlaybackOptionsSectionId,
} from './types';
import type { BurnInSubtitleRecoveryResult, IVideoPlayer, SubtitleTrack } from '../../player';
import { SubtitlePreferencesStore } from '../../settings/SubtitlePreferencesStore';
import type { ToastInput } from '../../../shared/toast';
import { formatAudioLabel } from '../../player';
import {
    classifyPlaybackSubtitleOption,
    isBurnInSubtitleTrack,
} from './PlaybackSubtitleOptionPolicy';

interface PlaybackOptionsCoordinatorDeps {
    playbackOptionsModalId: string;
    getNavigation: () => INavigationManager | null;
    getPlaybackOptionsModal: () => IPlaybackOptionsModal | null;
    getVideoPlayer: () => IVideoPlayer | null;
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

        let visibleTrackCount = 0;
        for (const track of enabledSubtitleTracks) {
            const kind = classifyPlaybackSubtitleOption({
                track,
                subtitleMode,
                canRequestBurnIn: Boolean(this.deps.requestBurnInSubtitle),
            });
            if (kind === 'hidden') continue;
            visibleTrackCount += 1;
            subtitleOptions.push({
                id: `playback-subtitle-${track.id}`,
                label: track.label,
                meta: kind === 'direct' ? 'Direct' : kind === 'extract' ? 'Extract' : 'Burn-in',
                selected: effectiveActiveSubtitleId === track.id,
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
            ...this.getEnabledOptions(viewModel.subtitles.options).map((option) => option.id),
            ...this.getEnabledOptions(viewModel.audio.options).map((option) => option.id),
        ];
    }

    private resolvePreferredFocusId(
        viewModel: PlaybackOptionsViewModel,
        preferredSection: PlaybackOptionsSectionId
    ): string | null {
        const subtitleOptions = this.getEnabledOptions(viewModel.subtitles.options);
        const audioOptions = this.getEnabledOptions(viewModel.audio.options);
        const selectedSubtitle = subtitleOptions.find((option) => option.selected);
        const selectedAudio = audioOptions.find((option) => option.selected);

        if (preferredSection === 'audio') {
            if (selectedAudio) return selectedAudio.id;
            const firstAudio = audioOptions[0];
            if (firstAudio) return firstAudio.id;
            if (selectedSubtitle) return selectedSubtitle.id;
            return subtitleOptions[0]?.id ?? null;
        }

        if (selectedSubtitle) return selectedSubtitle.id;
        const firstSubtitle = subtitleOptions[0];
        if (firstSubtitle) return firstSubtitle.id;
        if (selectedAudio) return selectedAudio.id;
        return audioOptions[0]?.id ?? null;
    }

    private getEnabledOptions(options: PlaybackOptionsItem[]): PlaybackOptionsItem[] {
        return options.filter((option) => !option.disabled);
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

    private handleBurnInSubtitleSelect(trackId: string, track: SubtitleTrack): void {
        const selectionState = this.beginSubtitleSelection();
        this.requestBurnInSubtitle(
            trackId,
            isBurnInSubtitleTrack(track) ? 'user_selected_burn_in_format' : 'user_selected_text_burn_in',
            selectionState
        );
        this.refreshAndCloseModal();
    }

    private async handleSubtitleSelectAsync(
        trackId: string | null,
        selectionState: SubtitleSelectionState
    ): Promise<void> {
        const player = this.deps.getVideoPlayer();
        if (!player) return;
        if (trackId === null) {
            this.subtitlePreferencesStore.writeSubtitleMode('off');
        } else {
            const mode = this.subtitlePreferencesStore.readSubtitleModeAndClean('full');
            if (mode === 'off') {
                // Selecting a subtitle should implicitly enable subtitle handling.
                this.subtitlePreferencesStore.writeSubtitleMode('standard');
            }
        }
        const track = trackId
            ? player.getAvailableSubtitles().find((t) => t.id === trackId) ?? null
            : null;
        if (trackId && !track) return;

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
}

interface SubtitleSelectionState {
    selectionToken: number;
    lifecycleToken: number;
}
