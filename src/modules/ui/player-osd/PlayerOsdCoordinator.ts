import type { INavigationManager } from '../../navigation';
import type { IVideoPlayer, PlaybackState, PlayerStatus, TimeRange } from '../../player';
import type { ChannelConfig } from '../../scheduler/channel-manager';
import type { ScheduledProgram } from '../../scheduler/scheduler';
import type { PlexMediaItem } from '../../plex/library';
import type { StreamDescriptor } from '../../player';
import type { IPlayerOsdOverlay } from './interfaces';
import type { PlayerOsdReason, PlayerOsdViewModel, PlayerPresentationState, PlayerSleepChoice } from './types';
import type { PlaybackOptionsSectionId } from '../playback-options';
import type { PlaybackOptionsSection } from '../playback-options/types';
import type { NowPlayingDisplayStore } from '../../settings/NowPlayingDisplayStore';
import { formatAudioLabel } from '../../player';
import { getChannelNameForDisplay } from '../common/channelDisplay';
import { formatTimecode } from '../common/formatTimecode';
import { buildPlaybackSummary, type PlaybackInfoSnapshotLike } from '../../../utils/playbackSummary';
import { formatAudioCodec, formatAudioDetail } from '../../../utils/mediaFormat';
import { PlayerProgramDetails } from './PlayerProgramDetails';

const OSD_THROTTLE_MS = 250;
const PLAYER_OSD_ACTION_IDS = {
    subtitles: 'player-osd-action-subtitles',
    sleep: 'player-osd-action-sleep',
    audio: 'player-osd-action-audio',
    expand: 'player-osd-action-expand',
    guide: 'player-osd-action-guide',
    transport: 'player-osd-action-transport',
    retry: 'player-osd-action-retry',
    moreInfo: 'player-osd-more-info',
} as const;

const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
});

interface PlayerOsdCoordinatorDeps {
    getOverlay: () => IPlayerOsdOverlay | null;
    getCurrentProgram: () => ScheduledProgram | null;
    getNextProgram: () => ScheduledProgram | null;
    getScopeIdentity?: () => { userId: string | null; serverId: string | null };
    getCurrentStreamDescriptor?: () => StreamDescriptor | null;
    getPlaybackInfoSnapshot?: () => PlaybackInfoSnapshotLike | null;
    getDebugText?: () => string | null;
    fetchProgramDetails?: (ratingKey: string, signal: AbortSignal) => Promise<PlexMediaItem | null>;
    getCurrentChannel: () => ChannelConfig | null;
    getVideoPlayer: () => IVideoPlayer | null;
    getAutoHideMs: () => number;
    getNavigation: () => INavigationManager | null;
    isMiniGuideVisible: () => boolean;
    onTransport?: () => void;
    onGuide?: () => void;
    onRetry?: () => Promise<void>;
    buildPlexResourceUrl: (pathOrUrl: string) => string | null;
    cycleSleepTimerPreset?: () => number;
    getSleepTimerRemainingMs?: () => number;
    getSleepTimerSelectedMinutes?: () => number;
    setSleepTimerMinutes?: (minutes: number) => void;
    onVisibilityChange?: (visible: boolean) => void;
    nowPlayingDisplayStore: NowPlayingDisplayStore;
    getTrackDrawer: (section: PlaybackOptionsSectionId) => PlaybackOptionsSection;
}

export class PlayerOsdCoordinator {
    private _presentation: PlayerPresentationState = 'hidden';
    private _childParent: 'compact' | 'expanded' = 'expanded';
    private _childInvokerId: string | null = null;
    private readonly _programDetails: PlayerProgramDetails | null;
    private _autoHideTimer: number | null = null;
    private _retryPending = false;
    private _retryToken = 0;
    private _retryError = false;
    private _lastReason: PlayerOsdReason = 'status';
    private _lastState: PlaybackState | null = null;
    private _lastTimeUpdate: { currentTimeMs: number; durationMs: number } | null = null;
    private _bufferedRanges: TimeRange[] = [];
    private _actionsRegistered = false;
    private _registeredExtraActions: string[] = [];
    private _childFocusableIds: string[] = [];
    private _readerScrollElement: HTMLElement | null = null;
    private readonly _readerKeyHandler = (event: KeyboardEvent): void => {
        const scroll = this._readerScrollElement;
        if (!scroll) return;
        const down = event.key === 'ArrowDown' || event.key === 'PageDown';
        const up = event.key === 'ArrowUp' || event.key === 'PageUp';
        if ((down && scroll.scrollTop + scroll.clientHeight < scroll.scrollHeight - 1) ||
            (up && scroll.scrollTop > 0)) {
            event.preventDefault();
            event.stopPropagation();
            scroll.scrollTop += (down ? 1 : -1) * Math.max(80, scroll.clientHeight * 0.8);
        }
    };
    private _throttledRenderTimer: number | null = null;
    private _lastThrottledRenderAt = 0;

    constructor(private readonly deps: PlayerOsdCoordinatorDeps) {
        this._programDetails = deps.fetchProgramDetails ? new PlayerProgramDetails({
            getCurrentProgram: deps.getCurrentProgram,
            getCurrentChannelId: (): string | null => deps.getCurrentChannel()?.id ?? null,
            getScopeIdentity: (): { userId: string | null; serverId: string | null } =>
                deps.getScopeIdentity?.() ?? { userId: null, serverId: null },
            getCurrentStreamDescriptor: (): StreamDescriptor | null => deps.getCurrentStreamDescriptor?.() ?? null,
            fetchProgramDetails: deps.fetchProgramDetails,
            isPresentationVisible: (): boolean => this._canPresent()
                && this._presentation !== 'hidden' && this._presentation !== 'compact',
            onChange: (): void => this._publishDetailResult(),
        }) : null;
    }

    getPresentationState(): PlayerPresentationState {
        return this._presentation;
    }

    revealCompact(): void {
        if (this._presentation === 'hidden') this.poke('status');
    }

    handleDown(): boolean {
        if (this._presentation === 'hidden') {
            this.revealCompact();
            return true;
        }
        const focused = this.deps.getNavigation()?.getFocusedElement();
        if (this._presentation === 'compact' && this.deps.getCurrentProgram()
            && focused?.id.startsWith('player-osd-action-') && !focused.neighbors.down) {
            this.expand();
            return true;
        }
        return false;
    }

    toggleExpanded(): void {
        if (!this.deps.getCurrentProgram()) {
            this.revealCompact();
            return;
        }
        if (this._presentation === 'expanded') {
            this.closeChild();
        } else if (this._presentation === 'compact' || this._presentation === 'hidden') {
            this.expand();
        }
    }

    handleBack(): boolean {
        if (this._presentation === 'hidden') return false;
        if (this._presentation === 'compact' || this._presentation === 'expanded') {
            this.hide();
            return true;
        }
        return this.closeChild();
    }

    retryPlayback(): void {
        const status = this._getPlaybackStatus();
        if ((status !== 'error' && status !== 'ended') ||
            this._retryPending || !this.deps.onRetry || !this.deps.getCurrentChannel()) return;
        const token = ++this._retryToken;
        this._retryPending = true;
        this._retryError = false;
        this._unregisterActions();
        this._renderAndShow('status');
        void this.deps.onRetry().then(() => {
            if (token !== this._retryToken) return;
            this._retryPending = false;
            this._unregisterActions();
            this._renderAndShow('status');
        }).catch(() => {
            if (token !== this._retryToken) return;
            this._retryPending = false;
            this._retryError = true;
            this._unregisterActions();
            this._renderAndShow('status');
        });
    }

    expand(): void {
        if (this._presentation === 'hidden') {
            this.poke('status');
        }
        if (this._presentation !== 'compact') return;
        if (!this.deps.getCurrentProgram()) return;
        this._unregisterActions();
        this._presentation = 'expanded';
        this._clearAutoHideTimer();
        this._renderAndShow(this._lastReason);
        this._programDetails?.ensure(this.deps.getCurrentProgram());
    }

    openMoreInfo(): void {
        if (this._presentation !== 'expanded') return;
        this._openChild('more-info', 'player-osd-more-info');
    }

    retryDetails(): void {
        if (this._presentation !== 'more-info' && this._presentation !== 'expanded') return;
        if (this._presentation === 'more-info') this._unregisterChildActions();
        this._programDetails?.ensure(this.deps.getCurrentProgram(), true);
    }

    openSleep(): void {
        if (this._presentation !== 'compact' && this._presentation !== 'expanded') return;
        this._openChild('sleep', PLAYER_OSD_ACTION_IDS.sleep);
    }

    selectSleepMinutes(minutes: PlayerSleepChoice['minutes']): void {
        if (this._presentation !== 'sleep') return;
        this.deps.setSleepTimerMinutes?.(minutes);
        this._renderAndShow(this._lastReason);
        this.closeChild();
    }

    closeChild(): boolean {
        if (this._presentation === 'hidden' || this._presentation === 'compact') return false;
        const prior = this._presentation;
        const invoker = this._childInvokerId;
        if (prior === 'expanded') {
            this._enterCompact();
        } else {
            this._unregisterChildActions();
            this._presentation = this._childParent;
            this._childInvokerId = null;
        }
        this._renderAndShow(this._lastReason);
        const navigation = this.deps.getNavigation();
        if (invoker && navigation?.getFocusedElement()?.id !== invoker) {
            navigation?.setFocus(invoker, { persist: false });
            if (navigation?.getFocusedElement()?.id !== invoker) {
                navigation?.setFocus(PLAYER_OSD_ACTION_IDS.subtitles, { persist: false });
            }
        }
        if (this._presentation === 'compact' && this._getPlaybackStatus() === 'playing') {
            this._scheduleAutoHide();
        }
        return true;
    }

    private _openChild(state: Extract<PlayerPresentationState, 'sleep' | 'audio' | 'subtitles' | 'more-info'>, invokerId: string): void {
        if (this._presentation !== 'compact' && this._presentation !== 'expanded') return;
        this._childParent = this._presentation === 'compact' ? 'compact' : 'expanded';
        this._childInvokerId = invokerId;
        this._unregisterActions();
        this._presentation = state;
        this._clearAutoHideTimer();
        this._renderAndShow(this._lastReason);
    }

    private _enterCompact(): void {
        this._unregisterChildActions();
        this._unregisterActions();
        this._programDetails?.hide();
        this._childInvokerId = null;
        this._childParent = 'expanded';
        this._presentation = 'compact';
    }

    poke(reason: PlayerOsdReason): void {
        if (this._presentation === 'hidden') this._presentation = 'compact';
        this._lastReason = reason;
        this._clearThrottledRenderTimer();
        this._renderAndShow(reason);

        const status = this._getPlaybackStatus();
        if (status === 'playing' && this._presentation === 'compact') {
            this._scheduleAutoHide();
        }
    }

    toggle(): void {
        const overlay = this.deps.getOverlay();
        if (!overlay) return;

        if (overlay.isVisible()) {
            this.hide();
            return;
        }

        this._presentation = 'compact';
        this._lastReason = 'status';
        this._renderAndShow(this._lastReason);

        const status = this._getPlaybackStatus();
        if (status === 'playing') {
            this._scheduleAutoHide();
        }
    }

    hide(): void {
        this._retryToken += 1;
        this._retryPending = false;
        this._retryError = false;
        this._presentation = 'hidden';
        this._childInvokerId = null;
        this._childParent = 'expanded';
        this._unregisterChildActions();
        this._programDetails?.hide();
        this._clearAutoHideTimer();
        this._clearThrottledRenderTimer();
        this._unregisterActions();
        this.deps.getOverlay()?.hide();
        this._notifyVisibilityChange(false);
    }

    onPlayerStateChange(state: PlaybackState): void {
        this._lastState = state;
        this._lastTimeUpdate = {
            currentTimeMs: state.currentTimeMs,
            durationMs: state.durationMs,
        };

        switch (state.status) {
            case 'paused':
                this._lastReason = 'pause';
                if (this._presentation === 'hidden') return;
                this._clearAutoHideTimer();
                this._renderAndShow(this._lastReason);
                return;
            case 'seeking':
                this._lastReason = 'seek';
                if (this._presentation === 'hidden') return;
                this._clearAutoHideTimer();
                this._renderAndShow(this._lastReason);
                return;
            case 'playing':
                if (this._presentation !== 'hidden' && this._presentation !== 'compact') {
                    this._requestThrottledRender();
                } else if (this._presentation === 'compact' && this.deps.getOverlay()?.isVisible()) {
                    this._renderAndShow(this._lastReason);
                    this._scheduleAutoHide();
                }
                return;
            case 'loading':
            case 'buffering':
            case 'idle':
                if (this._presentation !== 'hidden' && this._presentation !== 'compact') {
                    this._renderAndShow('status');
                    return;
                }
                this.hide();
                return;
            case 'error':
            case 'ended':
                if (this.deps.getCurrentChannel()) {
                    this._clearAutoHideTimer();
                    this._enterCompact();
                    this._renderAndShow('status');
                    return;
                }
                this.hide();
                return;
            default:
                this.hide();
                return;
        }
    }

    onTimeUpdate(payload: { currentTimeMs: number; durationMs: number }): void {
        this._lastTimeUpdate = payload;
        this._requestThrottledRender();
    }

    onBufferUpdate(payload: { bufferedRanges: TimeRange[] }): void {
        this._bufferedRanges = Array.isArray(payload.bufferedRanges)
            ? payload.bufferedRanges.slice()
            : [];
        this._requestThrottledRender();
    }

    /**
     * Re-render the OSD view model if (and only if) it is currently visible.
     * Used for non-playback-driven UI updates (e.g., sleep timer countdown).
     */
    refreshIfVisible(): void {
        const overlay = this.deps.getOverlay();
        if (!overlay || !overlay.isVisible()) {
            return;
        }
        if (this._presentation !== 'compact' && this._presentation !== 'hidden' &&
            this._programDetails && !this._programDetails.isCurrent(this.deps.getCurrentProgram())) {
            this._programDetails.ensure(this.deps.getCurrentProgram());
        }
        this._requestThrottledRender();
    }

    onProgramChanged(): void {
        this._retryToken += 1;
        this._retryPending = false;
        this._retryError = false;
        this._lastState = null;
        this._lastTimeUpdate = null;
        this._bufferedRanges = [];
        this._programDetails?.clear();
        if (this._presentation !== 'hidden' && this._presentation !== 'compact') {
            this._programDetails?.ensure(this.deps.getCurrentProgram());
        }
        this.refreshIfVisible();
    }

    private _renderAndShow(reason: PlayerOsdReason): void {
        if (!this._canPresent()) {
            this.hide();
            return;
        }
        const overlay = this.deps.getOverlay();
        if (!overlay) return;
        this._clearThrottledRenderTimer();
        this._setOverlayViewModel(overlay, reason);
        this._lastThrottledRenderAt = Date.now();
        overlay.show();
        this._notifyVisibilityChange(true);
        this._registerActions();
        if (this._presentation === 'sleep') this._registerSleepActions();
        if (this._presentation === 'more-info') this._registerReaderActions();
        if (this._presentation === 'audio' || this._presentation === 'subtitles') this._registerTrackActions();
    }

    private _notifyVisibilityChange(visible: boolean): void {
        this.deps.onVisibilityChange?.(visible);
    }

    private _clearThrottledRenderTimer(): void {
        if (this._throttledRenderTimer !== null) {
            globalThis.clearTimeout(this._throttledRenderTimer);
            this._throttledRenderTimer = null;
        }
    }

    private _requestThrottledRender(): void {
        if (!this._canPresent()) {
            this.hide();
            return;
        }
        const overlay = this.deps.getOverlay();
        if (!overlay || !overlay.isVisible()) {
            return;
        }
        if (this._throttledRenderTimer !== null) {
            return;
        }
        const now = Date.now();
        const elapsed = now - this._lastThrottledRenderAt;
        if (elapsed >= OSD_THROTTLE_MS) {
            this._setOverlayViewModel(overlay, this._lastReason);
            this._lastThrottledRenderAt = now;
            return;
        }

        this._throttledRenderTimer = globalThis.setTimeout(() => {
            this._throttledRenderTimer = null;
            if (!this._canPresent()) {
                this.hide();
                return;
            }
            const nextNow = Date.now();
            this._setOverlayViewModel(overlay, this._lastReason);
            this._lastThrottledRenderAt = nextNow;
        }, OSD_THROTTLE_MS - elapsed) as unknown as number;
    }

    private _canPresent(): boolean {
        const navigation = this.deps.getNavigation();
        return navigation?.getCurrentScreen() === 'player'
            && !navigation.isModalOpen() && !this.deps.isMiniGuideVisible();
    }

    private _setOverlayViewModel(overlay: IPlayerOsdOverlay, reason: PlayerOsdReason): void {
        overlay.setViewModel(this._buildViewModel(reason));
        this._reconcileTrackActions();
    }

    private _reconcileTrackActions(): void {
        const section = this._presentation;
        if (section !== 'audio' && section !== 'subtitles') return;
        const drawer = this.deps.getTrackDrawer(section);
        const desired = [
            ...drawer.options.filter((option) => !option.disabled).map((option) => option.id),
            ...(drawer.modeOptions ?? []).filter((option) => !option.disabled).map((option) => option.id),
            'player-osd-track-close',
        ];
        if (desired.length === this._childFocusableIds.length &&
            desired.every((id, index) => id === this._childFocusableIds[index])) return;
        const focusId = this.deps.getNavigation()?.getFocusedElement()?.id ?? null;
        this._unregisterChildActions();
        this._registerTrackActions();
        if (focusId && desired.includes(focusId)) {
            this.deps.getNavigation()?.setFocus(focusId, { persist: false });
        }
    }

    private _buildViewModel(reason: PlayerOsdReason): PlayerOsdViewModel {
        const channel = this.deps.getCurrentChannel();
        const program = this.deps.getCurrentProgram();
        const player = this.deps.getVideoPlayer();
        const status = this._getPlaybackStatus();
        const state = this._lastState ?? player?.getState();
        const lastUpdate = this._lastTimeUpdate;

        const currentTimeMs = Math.max(0, lastUpdate?.currentTimeMs ?? state?.currentTimeMs ?? 0);
        const durationMs = Math.max(0, lastUpdate?.durationMs ?? state?.durationMs ?? 0);
        const clampedTimeMs = durationMs > 0 ? Math.min(currentTimeMs, durationMs) : currentTimeMs;
        const playedRatio = durationMs > 0 ? clamp01(clampedTimeMs / durationMs) : 0;
        const bufferedRatio = this._computeBufferedRatio(clampedTimeMs, durationMs, playedRatio);
        const isLive = durationMs <= 0;

        const channelPrefix = formatChannelPrefix(channel);
        const title = program?.item.title?.trim() ||
            (status === 'loading' || status === 'buffering'
                ? 'Loading program…'
                : channel ? 'Program information unavailable' : 'No program selected');
        const subtitle = program?.item.fullTitle && program.item.fullTitle !== program.item.title
            ? program.item.fullTitle
            : null;
        const preferClearLogos = this.deps.nowPlayingDisplayStore.readPreferClearLogosEnabledAndClean(true);
        const clearLogoPath = program?.item.clearLogo ?? null;
        const clearLogoUrl = preferClearLogos && clearLogoPath
            ? this.deps.buildPlexResourceUrl(clearLogoPath)
            : null;
        const sleepTimerRemainingMs = this.deps.getSleepTimerRemainingMs?.() ?? 0;
        const sleepTimerText = sleepTimerRemainingMs > 0
            ? `Sleep ${formatTimecode(sleepTimerRemainingMs)}`
            : null;

        const timecode = isLive
            ? 'Live'
            : `${formatTimecode(clampedTimeMs)} / ${formatTimecode(durationMs)}`;

        const nowMs = Date.now();
        const remainingMs = program
            ? Math.max(0, program.scheduledEndTime - nowMs)
            : Math.max(0, durationMs - clampedTimeMs);

        const remainingLabel = formatRemainingLabel(remainingMs);
        const endsAtLabel = formatEndsAt(nowMs, remainingMs);
        const endsAtText = isLive
            ? null
            : remainingLabel && endsAtLabel
                ? `${remainingLabel} • ${endsAtLabel}`
                : endsAtLabel;

        const bufferAheadMs = durationMs > 0
            ? Math.max(0, bufferedRatio * durationMs - clampedTimeMs)
            : 0;

        const bufferText = formatBufferText(bufferAheadMs);
        const upNextText = this._buildUpNextText(isLive, nowMs);

        const audioLabel = this._buildAudioLabel(player, state?.activeAudioId ?? null);
        const subtitleLabel = this._buildSubtitleLabel(player, state?.activeSubtitleId ?? null);
        const detail = this._programDetails?.snapshot(program) ?? { details: null, status: 'unavailable' as const };
        const details = detail.details;
        const description = details?.summary ?? program?.item.summary ?? null;
        const posterPath = program?.item.type === 'episode'
            ? details?.grandparentThumb ?? program?.item.showThumb ?? program?.item.thumb
            : details?.thumb ?? program?.item.thumb;
        const posterUrl = posterPath ? this.deps.buildPlexResourceUrl(posterPath) : null;
        const facts = [
            program?.item.year ? String(program.item.year) : null,
            details?.contentRating ?? program?.item.contentRating ?? null,
            ...(details?.genres ?? program?.item.genres ?? []),
        ].filter((part): part is string => Boolean(part));
        const mediaInfo = program?.item.mediaInfo;
        const qualityBadges = [
            mediaInfo?.resolution,
            mediaInfo?.hdr,
            mediaInfo?.audioCodec ? formatAudioCodec(mediaInfo.audioCodec) : null,
            mediaInfo ? formatAudioDetail(mediaInfo) : null,
        ].filter((part): part is string => Boolean(part));
        const castText = (details?.actorRoles?.length
            ? details.actorRoles.map((role) => role.role ? `${role.name} as ${role.role}` : role.name)
            : details?.actors ?? []).filter(Boolean).slice(0, 8).join(' · ');
        const playback = buildPlaybackSummary(this.deps.getPlaybackInfoSnapshot?.());
        const debugText = this.deps.getDebugText?.() ?? null;

        return {
            reason,
            presentation: this._presentation,
            parentPresentation: this._childParent,
            statusLabel: mapStatusLabel(status),
            channelPrefix,
            title,
            subtitle,
            isLive,
            currentTimeMs: clampedTimeMs,
            durationMs,
            playedRatio,
            bufferedRatio,
            timecode,
            endsAtText,
            bufferText,
            ...(upNextText ? { upNextText } : {}),
            actionIds: {
                subtitles: PLAYER_OSD_ACTION_IDS.subtitles,
                sleep: PLAYER_OSD_ACTION_IDS.sleep,
                audio: PLAYER_OSD_ACTION_IDS.audio,
                guide: PLAYER_OSD_ACTION_IDS.guide,
                ...((status === 'error' || status === 'ended') && channel && !this._retryPending
                    ? { retry: PLAYER_OSD_ACTION_IDS.retry }
                    : {}),
                ...(program ? {
                    transport: PLAYER_OSD_ACTION_IDS.transport,
                    expand: PLAYER_OSD_ACTION_IDS.expand,
                    moreInfo: PLAYER_OSD_ACTION_IDS.moreInfo,
                } : {}),
            },
            retryPending: this._retryPending,
            errorText: this._retryError ? 'Retry failed. Check the channel or open Guide.' :
                (status === 'error' ? 'Playback unavailable. Retry or open Guide.' : null),
            audioLabel,
            subtitleLabel,
            ...(sleepTimerText ? { sleepTimerText } : {}),
            ...(clearLogoUrl ? { clearLogoUrl } : {}),
            description,
            posterUrl,
            facts,
            qualityBadges,
            castText: castText || null,
            playbackSummary: playback.summary,
            playbackDetails: [
                ...playback.details,
                ...(debugText ? [debugText] : []),
            ],
            detailStatus: detail.status,
            ...(this._presentation === 'sleep' ? {
                sleepChoices: this._buildSleepChoices(),
                sleepRemainingText: sleepTimerRemainingMs > 0
                    ? `${Math.ceil(sleepTimerRemainingMs / 60_000)}m remaining`
                    : null,
            } : {}),
            ...((this._presentation === 'audio' || this._presentation === 'subtitles')
                ? { trackDrawer: this.deps.getTrackDrawer(this._presentation) }
                : {}),
        };
    }

    private _publishDetailResult(): void {
        const focusId = this.deps.getNavigation()?.getFocusedElement()?.id ?? null;
        if (this._presentation === 'more-info') this._unregisterChildActions();
        this._renderAndShow(this._lastReason);
        if (focusId && this._childFocusableIds.includes(focusId)) {
            this.deps.getNavigation()?.setFocus(focusId, { persist: false });
        }
    }

    private _computeBufferedRatio(
        currentTimeMs: number,
        durationMs: number,
        playedRatio: number
    ): number {
        if (durationMs <= 0) {
            return playedRatio;
        }

        let bufferedEndMs = currentTimeMs;
        let matchedEndMs = -1;
        for (const range of this._bufferedRanges) {
            if (!range) continue;
            const startMs = range.startMs ?? 0;
            const endMs = range.endMs ?? 0;
            if (startMs <= currentTimeMs && endMs >= currentTimeMs) {
                if (endMs > matchedEndMs) {
                    matchedEndMs = endMs;
                }
            }
        }

        if (matchedEndMs >= 0) {
            bufferedEndMs = matchedEndMs;
        }

        const clampedEndMs = Math.max(currentTimeMs, Math.min(bufferedEndMs, durationMs));
        const ratio = clamp01(clampedEndMs / durationMs);
        return Math.max(playedRatio, ratio);
    }

    private _getPlaybackStatus(): PlayerStatus {
        if (this._lastState) return this._lastState.status;
        const state = this.deps.getVideoPlayer()?.getState();
        return state?.status ?? 'idle';
    }

    private _scheduleAutoHide(): void {
        this._clearAutoHideTimer();
        if (this._presentation !== 'compact') return;
        const autoHideMs = sanitizeAutoHideMs(this.deps.getAutoHideMs());
        this._autoHideTimer = globalThis.setTimeout(() => {
            this._autoHideTimer = null;
            this.hide();
        }, autoHideMs) as unknown as number;
    }

    private _clearAutoHideTimer(): void {
        if (this._autoHideTimer !== null) {
            globalThis.clearTimeout(this._autoHideTimer);
            this._autoHideTimer = null;
        }
    }

    private _buildUpNextText(isLive: boolean, nowMs: number): string | null {
        if (isLive) {
            return null;
        }
        const next = this.deps.getNextProgram();
        if (!next) {
            return null;
        }
        const startsAtMs = next.scheduledStartTime;
        if (!Number.isFinite(startsAtMs) || startsAtMs <= nowMs) {
            return null;
        }
        const title = next.item?.title?.trim();
        if (!title) {
            return null;
        }
        const formatted = TIME_FORMATTER.format(new Date(startsAtMs));
        return `Up next • ${formatted} — ${title}`;
    }

    private _registerActions(): void {
        if (this._presentation !== 'compact' && this._presentation !== 'expanded') return;
        if (this._actionsRegistered) return;
        const navigation = this.deps.getNavigation();
        if (!navigation) return;
        if (navigation.isModalOpen()) return;
        if (typeof document === 'undefined') return;

        const subtitlesEl = document.getElementById(PLAYER_OSD_ACTION_IDS.subtitles) as HTMLElement | null;
        const sleepEl = document.getElementById(PLAYER_OSD_ACTION_IDS.sleep) as HTMLElement | null;
        const audioEl = document.getElementById(PLAYER_OSD_ACTION_IDS.audio) as HTMLElement | null;
        if (!subtitlesEl || !sleepEl || !audioEl) return;

        navigation.registerFocusable({
            id: PLAYER_OSD_ACTION_IDS.subtitles,
            element: subtitlesEl, preventScrollOnFocus: true,
            neighbors: { right: PLAYER_OSD_ACTION_IDS.sleep },
            onFocus: () => this._onActionInteraction(),
            onSelect: () => this._openPlaybackOptions('subtitles'),
        });
        navigation.registerFocusable({
            id: PLAYER_OSD_ACTION_IDS.sleep,
            element: sleepEl, preventScrollOnFocus: true,
            neighbors: {
                left: PLAYER_OSD_ACTION_IDS.subtitles,
                right: PLAYER_OSD_ACTION_IDS.audio,
            },
            onFocus: () => this._onActionInteraction(),
            onSelect: () => {
                this.openSleep();
            },
        });
        navigation.registerFocusable({
            id: PLAYER_OSD_ACTION_IDS.audio,
            element: audioEl, preventScrollOnFocus: true,
            neighbors: {
                left: PLAYER_OSD_ACTION_IDS.sleep,
                ...(document.getElementById(PLAYER_OSD_ACTION_IDS.retry)
                    ? { right: PLAYER_OSD_ACTION_IDS.retry }
                    : document.getElementById(PLAYER_OSD_ACTION_IDS.transport)
                    ? { right: PLAYER_OSD_ACTION_IDS.transport }
                    : document.getElementById(PLAYER_OSD_ACTION_IDS.guide)
                        ? { right: PLAYER_OSD_ACTION_IDS.guide }
                        : {}),
            },
            onFocus: () => this._onActionInteraction(),
            onSelect: () => this._openPlaybackOptions('audio'),
        });

        const extras = [
            ...(document.getElementById(PLAYER_OSD_ACTION_IDS.retry)
                ? [{ id: PLAYER_OSD_ACTION_IDS.retry, action: (): void => this.retryPlayback() }]
                : []),
            { id: PLAYER_OSD_ACTION_IDS.transport, action: (): void => { this.deps.onTransport?.(); } },
            { id: PLAYER_OSD_ACTION_IDS.guide, action: (): void => { this.deps.onGuide?.(); } },
            ...(this._presentation === 'compact'
                ? [{ id: PLAYER_OSD_ACTION_IDS.expand, action: (): void => this.expand() }]
                : [
                    { id: PLAYER_OSD_ACTION_IDS.moreInfo, action: (): void => this.openMoreInfo() },
                    { id: 'player-osd-expanded-close', action: (): void => { this.closeChild(); } },
                ]),
        ];
        const available = extras.filter(({ id }) => document.getElementById(id) !== null);
        for (let index = 0; index < available.length; index += 1) {
            const entry = available[index];
            if (!entry) continue;
            const element = document.getElementById(entry.id);
            if (!element) continue;
            const previous = available[index - 1];
            const next = available[index + 1];
            navigation.registerFocusable({
                id: entry.id,
                element,
                preventScrollOnFocus: true,
                neighbors: {
                    ...(index === 0 ? { left: PLAYER_OSD_ACTION_IDS.audio } :
                        (previous ? { left: previous.id } : {})),
                    ...(next ? { right: next.id } : {}),
                },
                onFocus: () => this._onActionInteraction(),
                onSelect: entry.action,
            });
            this._registeredExtraActions.push(entry.id);
        }

        if (!navigation.isModalOpen()) {
            navigation.setFocus(PLAYER_OSD_ACTION_IDS.subtitles, { persist: false });
        }
        this._actionsRegistered = true;
    }

    private _onActionInteraction(): void {
        if (this._presentation === 'compact' && this._getPlaybackStatus() === 'playing') {
            this._scheduleAutoHide();
        }
    }

    private _unregisterActions(): void {
        if (!this._actionsRegistered) return;
        const navigation = this.deps.getNavigation();
        if (!navigation) return;
        navigation.unregisterFocusable(PLAYER_OSD_ACTION_IDS.subtitles);
        navigation.unregisterFocusable(PLAYER_OSD_ACTION_IDS.sleep);
        navigation.unregisterFocusable(PLAYER_OSD_ACTION_IDS.audio);
        for (const id of this._registeredExtraActions) navigation.unregisterFocusable(id);
        this._registeredExtraActions = [];
        this._actionsRegistered = false;
    }

    private _registerSleepActions(): void {
        const navigation = this.deps.getNavigation();
        if (!navigation || this._childFocusableIds.length > 0) return;
        const choices = this._buildSleepChoices();
        const ids = choices.map((choice) => `player-osd-sleep-${choice.minutes}`);
        ids.push('player-osd-sleep-close');
        for (let index = 0; index < ids.length; index += 1) {
            const id = ids[index];
            const element = id ? document.getElementById(id) : null;
            if (!id || !element) continue;
            const up = index > 0 ? ids[index - 1] : undefined;
            const down = index < ids.length - 1 ? ids[index + 1] : undefined;
            navigation.registerFocusable({
                id,
                element,
                preventScrollOnFocus: true,
                neighbors: { ...(up ? { up } : {}), ...(down ? { down } : {}) },
                onSelect: () => {
                    if (id === 'player-osd-sleep-close') {
                        this.closeChild();
                    } else {
                        const choice = choices[index];
                        if (choice) this.selectSleepMinutes(choice.minutes);
                    }
                },
            });
            this._childFocusableIds.push(id);
        }
        const selected = choices.find((choice) => choice.selected);
        navigation.setFocus(`player-osd-sleep-${selected?.minutes ?? 0}`, { persist: false });
    }

    private _unregisterChildActions(): void {
        const navigation = this.deps.getNavigation();
        for (const id of this._childFocusableIds) navigation?.unregisterFocusable(id);
        this._childFocusableIds = [];
        this._readerScrollElement?.removeEventListener('keydown', this._readerKeyHandler);
        this._readerScrollElement = null;
    }

    private _registerReaderActions(): void {
        const navigation = this.deps.getNavigation();
        if (!navigation || this._childFocusableIds.length > 0) return;
        const scroll = document.getElementById('player-osd-reader-scroll');
        const close = document.getElementById('player-osd-reader-close');
        const retry = document.getElementById('player-osd-reader-retry');
        if (!scroll || !close) return;
        scroll.addEventListener('keydown', this._readerKeyHandler);
        this._readerScrollElement = scroll;
        const actions = [
            { id: scroll.id, element: scroll, onSelect: (): void => scroll.scrollBy({ top: scroll.clientHeight * 0.8 }) },
            ...(retry && !retry.hidden ? [{ id: retry.id, element: retry, onSelect: (): void => this.retryDetails() }] : []),
            { id: close.id, element: close, onSelect: (): void => { this.closeChild(); } },
        ];
        for (let index = 0; index < actions.length; index += 1) {
            const action = actions[index];
            if (!action) continue;
            const previous = actions[index - 1];
            const next = actions[index + 1];
            navigation.registerFocusable({
                id: action.id,
                element: action.element,
                preventScrollOnFocus: true,
                neighbors: {
                    ...(previous ? { up: previous.id } : {}),
                    ...(next ? { down: next.id } : {}),
                },
                onSelect: action.onSelect,
            });
            this._childFocusableIds.push(action.id);
        }
        navigation.setFocus(scroll.id, { persist: false });
    }

    private _openPlaybackOptions(section: PlaybackOptionsSectionId): void {
        const navigation = this.deps.getNavigation();
        if (!navigation) return;
        if (navigation.isModalOpen()) return;

        this._openChild(section, PLAYER_OSD_ACTION_IDS[section]);
    }

    private _registerTrackActions(): void {
        const navigation = this.deps.getNavigation();
        const section = this._presentation;
        if (!navigation || (section !== 'audio' && section !== 'subtitles') || this._childFocusableIds.length > 0) return;
        const drawer = this.deps.getTrackDrawer(section);
        const ids = [
            ...drawer.options.filter((option) => !option.disabled).map((option) => option.id),
            ...(drawer.modeOptions ?? []).filter((option) => !option.disabled).map((option) => option.id),
            'player-osd-track-close',
        ];
        for (let index = 0; index < ids.length; index += 1) {
            const id = ids[index];
            const element = id ? document.getElementById(id) : null;
            if (!id || !element) continue;
            const previous = ids[index - 1];
            const next = ids[index + 1];
            navigation.registerFocusable({
                id,
                element,
                preventScrollOnFocus: true,
                neighbors: {
                    ...(previous ? { up: previous } : {}),
                    ...(next ? { down: next } : {}),
                },
                onFocus: () => element.scrollIntoView?.({ block: 'nearest' }),
                onSelect: () => {
                    if (id === 'player-osd-track-close') {
                        this.closeChild();
                        return;
                    }
                    const current = this.deps.getTrackDrawer(section);
                    [...current.options, ...(current.modeOptions ?? [])]
                        .find((option) => option.id === id)?.onSelect();
                    this._requestThrottledRender();
                },
            });
            this._childFocusableIds.push(id);
        }
        const selected = drawer.options.find((option) => option.selected && !option.disabled);
        navigation.setFocus(selected?.id ?? ids[0] ?? 'player-osd-track-close', { persist: false });
    }

    private _buildSleepChoices(): PlayerSleepChoice[] {
        const selected = this.deps.getSleepTimerSelectedMinutes?.() ?? 0;
        return [
            { minutes: 0, label: 'Off', selected: selected === 0 },
            { minutes: 15, label: '15 minutes', selected: selected === 15 },
            { minutes: 30, label: '30 minutes', selected: selected === 30 },
            { minutes: 60, label: '1 hour', selected: selected === 60 },
            { minutes: 90, label: '90 minutes', selected: selected === 90 },
            { minutes: 120, label: '2 hours', selected: selected === 120 },
        ];
    }

    private _buildAudioLabel(player: IVideoPlayer | null, activeAudioId: string | null): string | null {
        const tracks = player?.getAvailableAudio() ?? [];
        if (!activeAudioId) {
            return tracks.length > 0 ? 'Unknown' : null;
        }
        const active = tracks.find((track) => track.id === activeAudioId) ?? null;
        if (!active) {
            return tracks.length > 0 ? 'Unknown' : null;
        }
        return formatAudioLabel(active);
    }

    private _buildSubtitleLabel(player: IVideoPlayer | null, activeSubtitleId: string | null): string | null {
        const tracks = player?.getAvailableSubtitles() ?? [];
        if (!activeSubtitleId) {
            return 'Off';
        }
        const active = tracks.find((track) => track.id === activeSubtitleId) ?? null;
        if (!active) {
            return tracks.length > 0 ? 'On' : 'Off';
        }
        return active.label || 'On';
    }
}

function formatChannelPrefix(channel: ChannelConfig | null): string {
    if (!channel) return '';
    const displayName = getChannelNameForDisplay({
        name: channel.name,
        sourceLibraryName: channel.sourceLibraryName ?? null,
    });
    const hasNumber = typeof channel.number === 'number' && Number.isFinite(channel.number);
    const hasName = typeof displayName === 'string' && displayName.length > 0;
    if (hasNumber && hasName) {
        return `${channel.number} ${displayName}`;
    }
    if (hasName) {
        return displayName;
    }
    if (hasNumber) {
        return `${channel.number}`;
    }
    return '';
}

function mapStatusLabel(status: PlayerStatus): PlayerOsdViewModel['statusLabel'] {
    switch (status) {
        case 'playing':
            return 'PLAYING';
        case 'paused':
            return 'PAUSED';
        case 'seeking':
            return 'SEEKING';
        case 'buffering':
            return 'BUFFERING';
        case 'loading':
            return 'LOADING';
        case 'error':
            return 'ERROR';
        case 'idle':
        case 'ended':
        default:
            return 'STOPPED';
    }
}

function formatEndsAt(nowMs: number, remainingMs: number): string | null {
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
        return null;
    }
    const endsAtMs = nowMs + remainingMs;
    const formatted = TIME_FORMATTER.format(new Date(endsAtMs));
    return `Ends ${formatted}`;
}

function formatRemainingLabel(remainingMs: number): string | null {
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
        return null;
    }
    if (remainingMs < 60_000) {
        return '<1m left';
    }
    const minutes = Math.floor(remainingMs / 60_000);
    return `${minutes}m left`;
}

function formatBufferText(bufferAheadMs: number): string | null {
    if (!Number.isFinite(bufferAheadMs) || bufferAheadMs < 5000) {
        return null;
    }
    const seconds = Math.round(bufferAheadMs / 1000);
    return `Buffer +${seconds}s`;
}

function sanitizeAutoHideMs(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
        return 3000;
    }
    return Math.floor(value);
}

function clamp01(value: number): number {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}
