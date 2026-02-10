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
import type { StreamDescriptor } from '../../player/types';
import { redactSensitiveTokens } from '../../../utils/redact';
import {
    isStoredTrue,
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSet,
} from '../../../utils/storage';

export const SUBTITLE_PROBE_TOTAL_TIMEOUT_MS = 400;

export interface PlaybackOptionsCoordinatorDeps {
    playbackOptionsModalId: string;
    getNavigation: () => INavigationManager | null;
    getPlaybackOptionsModal: () => IPlaybackOptionsModal | null;
    getVideoPlayer: () => IVideoPlayer | null;
    getCurrentStreamDescriptor?: () => StreamDescriptor | null;
    getCurrentProgram: () => ScheduledProgram | null;
    requestBurnInSubtitle?: (trackId: string, reason: string) => boolean | Promise<boolean>;
    notifyToast?: (message: string, type?: ToastType) => void;
}

export class PlaybackOptionsCoordinator {
    private pendingViewModel: PlaybackOptionsViewModel | null = null;
    private pendingFocusableIds: string[] = [];
    private pendingPreferredFocusId: string | null = null;
    private registeredFocusableIds: string[] = [];
    private preferredSection: PlaybackOptionsSectionId = 'subtitles';
    private readonly subtitleProbeCache: Map<string, 'supported' | 'unsupported'> = new Map();
    private _subtitleSelectToken = 0;

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
        this.subtitleProbeCache.clear();
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
                helperText: 'Direct is fastest. Extract uses the server. Full mode can use Burn-in (transcodes) when needed.',
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
        const token = ++this._subtitleSelectToken;
        void this.handleSubtitleSelectAsync(trackId, token);
    }

    private async handleSubtitleSelectAsync(trackId: string | null, token: number): Promise<void> {
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

        const mode = getSubtitleMode();
        const allowBurnIn = subtitleModeAllowsBurnIn(mode);
        if (trackId && track && allowBurnIn) {
            // For burn-in formats (PGS/ASS/etc), go straight to the burn-in stream reload.
            if (this.isBurnInTrack(track)) {
                this.persistSubtitlePreference(track);
                this.requestBurnInSubtitle(track.id, 'user_selected_burn_in_format');
                this.refreshIfOpen();
                this.closeModalAndReturnFocus();
                return;
            }

            if (track.isTextCandidate) {
                // Direct-fetchable tracks don't need probing – they already have a known-good key.
                if (!track.fetchableViaKey || !track.key) {
                    const selectedItemKey = this.getCurrentProgramItemKey();
                    const decision = await this.probeTextSubtitleExtractability(track);
                    if (token !== this._subtitleSelectToken) {
                        this.refreshIfOpen();
                        return;
                    }
                    const currentItemKey = this.getCurrentProgramItemKey();
                    const currentTrack = player.getAvailableSubtitles().find((candidate) => candidate.id === track.id) ?? null;
                    if (currentItemKey !== selectedItemKey || !currentTrack) {
                        // Program rollover or track list changes can occur while probing; drop stale results.
                        this.refreshIfOpen();
                        return;
                    }
                    if (decision === 'unsupported') {
                        this.persistSubtitlePreference(currentTrack);
                        this.requestBurnInSubtitle(currentTrack.id, 'user_selected_text_extract_probe_unsupported');
                        this.refreshIfOpen();
                        this.closeModalAndReturnFocus();
                        return;
                    }
                }
            }
        }

        player.setSubtitleTrack(trackId).catch(() => {
            // Subtitle selection errors are handled by SubtitleManager fallback/Toast.
        });
        this.persistSubtitlePreference(track);
        this.refreshIfOpen();
        this.closeModalAndReturnFocus();
    }

    private requestBurnInSubtitle(trackId: string, reason: string): void {
        const request = this.deps.requestBurnInSubtitle;
        if (!request) {
            this.deps.notifyToast?.('Burn-in subtitles unavailable', 'warning');
            return;
        }
        this.deps.notifyToast?.('Loading burn-in subtitles…', 'info');
        try {
            void Promise.resolve(request(trackId, reason))
                .then((ok) => {
                    if (ok === false) {
                        this.deps.notifyToast?.('Failed to load burn-in subtitles', 'warning');
                    }
                })
                .catch(() => {
                    this.deps.notifyToast?.('Failed to load burn-in subtitles', 'warning');
                });
        } catch {
            this.deps.notifyToast?.('Failed to load burn-in subtitles', 'warning');
        }
    }

    private getCurrentProgramItemKey(): string | null {
        return this.deps.getCurrentProgram()?.item.ratingKey ?? null;
    }

    // Non-cryptographic hash used only for cache-key scoping. Avoid storing raw tokens in keys.
    private hashForCacheKeyScope(value: string): string {
        let hash = 0;
        for (let index = 0; index < value.length; index += 1) {
            hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
        }
        return (hash >>> 0).toString(16);
    }

    private getProbeCacheKey(
        trackId: string,
        context: NonNullable<StreamDescriptor['subtitleContext']>
    ): string {
        const itemKey = context.itemKey ?? this.getCurrentProgramItemKey() ?? 'global';
        const serverKey = context.serverUri ?? 'unknown-server';
        const token = this.getAuthTokenFromHeaders(context.authHeaders);
        const accountKey = token ? this.hashForCacheKeyScope(token) : 'anonymous';
        return `${serverKey}::${accountKey}::${itemKey}::${trackId}`;
    }

    private getAuthTokenFromHeaders(headers: Record<string, string>): string | null {
        const token = headers['X-Plex-Token'] ?? headers['x-plex-token'];
        return typeof token === 'string' && token.length > 0 ? token : null;
    }

    private buildSubtitleProbeUrl(track: SubtitleTrack, context: NonNullable<StreamDescriptor['subtitleContext']>): URL | null {
        const baseUri = context.serverUri ?? null;
        if (!baseUri) return null;
        try {
            const url = track.key
                ? new URL(track.key, baseUri)
                : new URL(`/library/streams/${encodeURIComponent(track.id)}`, baseUri);
            const token = this.getAuthTokenFromHeaders(context.authHeaders);
            if (token && !url.searchParams.has('X-Plex-Token')) {
                url.searchParams.set('X-Plex-Token', token);
            }
            return url;
        } catch {
            return null;
        }
    }

    private async probeTextSubtitleExtractability(track: SubtitleTrack): Promise<'supported' | 'unsupported' | 'unknown'> {
        const context = this.deps.getCurrentStreamDescriptor?.()?.subtitleContext ?? null;
        if (!context) return 'unknown';
        const cacheKey = this.getProbeCacheKey(track.id, context);
        const cached = this.subtitleProbeCache.get(cacheKey);
        if (cached) return cached;

        // Fast probe only: treat timeout/failure as unsupported and force burn-in for this selection.
        // Use a minimal header set so the probe matches the normal query-token extraction path and avoids
        // preflight-only failures caused by broader X-Plex-* header bundles.
        const url = this.buildSubtitleProbeUrl(track, context);
        if (!url) return 'unknown';

        const startMs = Date.now();
        try {
            const headController = new AbortController();
            const headTimeoutId = setTimeout(() => headController.abort(), SUBTITLE_PROBE_TOTAL_TIMEOUT_MS);
            let response: Response;
            try {
                response = await fetch(url.toString(), {
                method: 'HEAD',
                headers: { Accept: 'text/vtt, text/plain, */*' },
                    signal: headController.signal,
                });
            } finally {
                clearTimeout(headTimeoutId);
            }
            if (!response.ok && (response.status === 405 || response.status === 501)) {
                // Some Plex endpoints/proxies may not support HEAD reliably; fall back to GET.
                const elapsedMs = Date.now() - startMs;
                const remainingMs = Math.max(0, SUBTITLE_PROBE_TOTAL_TIMEOUT_MS - elapsedMs);
                // Keep the total probe time bounded; don't double the worst-case latency.
                const fallbackTimeoutMs = Math.max(50, remainingMs);

                const getController = new AbortController();
                const getTimeoutId = setTimeout(() => getController.abort(), fallbackTimeoutMs);
                try {
                    response = await fetch(url.toString(), {
                        method: 'GET',
                        headers: { Accept: 'text/vtt, text/plain, */*' },
                        signal: getController.signal,
                    });
                } finally {
                    clearTimeout(getTimeoutId);
                }
            }
            if (response.ok) {
                this.subtitleProbeCache.set(cacheKey, 'supported');
                return 'supported';
            }
            if (response.status >= 500) {
                // Don't cache transient server errors; allow future attempts to succeed.
                return 'unsupported';
            }
            this.subtitleProbeCache.set(cacheKey, 'unsupported');
            return 'unsupported';
        } catch {
            // Don't cache transient network/timeout errors; allow future attempts to succeed.
            return 'unsupported';
        }
    }

    private handleAudioSelect(trackId: string): void {
        const player = this.deps.getVideoPlayer();
        if (!player) return;
        player.setAudioTrack(trackId).catch((error) => {
            const safeError = error instanceof Error
                ? `${error.name}: ${error.message}`
                : String(error);
            console.error('[PlaybackOptions] Audio track switch failed:', redactSensitiveTokens(safeError));
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
