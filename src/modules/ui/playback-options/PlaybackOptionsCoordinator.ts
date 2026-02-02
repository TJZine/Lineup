/**
 * @fileoverview Playback Options modal coordinator.
 * @module modules/ui/playback-options/PlaybackOptionsCoordinator
 */

import type { INavigationManager, FocusableElement } from '../../navigation';
import type { IPlaybackOptionsModal } from './interfaces';
import type {
    PlaybackOptionsViewModel,
    PlaybackOptionsItem,
    PlaybackOptionsSectionId,
} from './types';
import type { IVideoPlayer } from '../../player';
import type { ScheduledProgram } from '../../scheduler/scheduler';
import type { SubtitleTrack } from '../../player/types';
import { BURN_IN_SUBTITLE_FORMATS } from '../../player/constants';
import { RETUNE_STORAGE_KEYS } from '../../../config/storageKeys';
import { getSubtitleMode, setSubtitleMode, subtitleModeAllowsBurnIn, subtitleModeIsDirectOnly } from '../../../shared/subtitle-mode';
import type { ToastType } from '../toast/types';
import { formatAudioLabel } from '../../../utils/formatAudioLabel';
import {
    isStoredTrue,
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSet,
} from '../../../utils/storage';

export interface PlaybackOptionsCoordinatorDeps {
    playbackOptionsModalId: string;
    getNavigation: () => INavigationManager | null;
    getPlaybackOptionsModal: () => IPlaybackOptionsModal | null;
    getVideoPlayer: () => IVideoPlayer | null;
    getCurrentProgram: () => ScheduledProgram | null;
    notifyToast?: (message: string, type?: ToastType) => void;
}

export class PlaybackOptionsCoordinator {
    private pendingViewModel: PlaybackOptionsViewModel | null = null;
    private pendingFocusableIds: string[] = [];
    private pendingPreferredFocusId: string | null = null;
    private registeredFocusableIds: string[] = [];
    private preferredSection: PlaybackOptionsSectionId = 'subtitles';

    constructor(private readonly deps: PlaybackOptionsCoordinatorDeps) { }

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
        const subtitleMode = getSubtitleMode();
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
                helperText: 'Direct is fastest. Extract uses the server. Burn-in transcodes the video.',
                ...(subtitleEmptyMessage ? { emptyMessage: subtitleEmptyMessage } : {}),
            },
            audio: {
                title: 'Audio',
                options: audioOptions,
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

    private handleSubtitleSelect(trackId: string | null): void {
        const player = this.deps.getVideoPlayer();
        if (!player) return;
        if (trackId) {
            const mode = getSubtitleMode();
            if (mode === 'off') {
                // Selecting a subtitle should implicitly enable subtitle handling.
                setSubtitleMode('standard');
            }
        }
        const track = trackId
            ? player.getAvailableSubtitles().find((t) => t.id === trackId) ?? null
            : null;
        player.setSubtitleTrack(trackId).catch(() => {
            // Subtitle selection errors are handled by SubtitleManager fallback/Toast.
        });
        this.persistSubtitlePreference(track);
        this.refreshIfOpen();
        this.closeModalAndReturnFocus();
    }

    private handleAudioSelect(trackId: string): void {
        const player = this.deps.getVideoPlayer();
        if (!player) return;
        player.setAudioTrack(trackId).catch((error) => {
            console.error('[PlaybackOptions] Audio track switch failed:', error);
        }).finally(() => {
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


    private useGlobalSubtitlePreference(): boolean {
        try {
            return isStoredTrue(
                safeLocalStorageGet(RETUNE_STORAGE_KEYS.SUBTITLE_PREFERENCE_GLOBAL_OVERRIDE)
            );
        } catch {
            return false;
        }
    }

    private isBurnInTrack(track: SubtitleTrack): boolean {
        const format = (track.format || track.codec || '').toLowerCase();
        return BURN_IN_SUBTITLE_FORMATS.includes(format);
    }

    private getItemPreferenceKey(itemKey: string): string {
        return `${RETUNE_STORAGE_KEYS.SUBTITLE_PREFERENCE_BY_ITEM_PREFIX}${itemKey}`;
    }

    private persistSubtitlePreference(track: SubtitleTrack | null): void {
        const itemKey = this.deps.getCurrentProgram()?.item.ratingKey ?? null;
        const useGlobal = this.useGlobalSubtitlePreference() || !itemKey;
        const storageKey = useGlobal
            ? RETUNE_STORAGE_KEYS.SUBTITLE_PREFERENCE_GLOBAL
            : this.getItemPreferenceKey(itemKey);

        if (!track) {
            safeLocalStorageRemove(storageKey);
            return;
        }

        const payload = {
            trackId: track.id,
            language: track.languageCode || track.language,
            codec: track.codec,
            lastUpdated: Date.now(),
        };
        safeLocalStorageSet(storageKey, JSON.stringify(payload));
    }
}
