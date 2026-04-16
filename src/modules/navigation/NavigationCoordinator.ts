/**
 * @fileoverview Handles key input routing and screen navigation events.
 * @module modules/navigation/NavigationCoordinator
 * @version 1.0.0
 */

import type { INavigationManager, KeyEvent } from './interfaces';
import type { IEPGComponent } from '../ui/epg';
import type { IVideoPlayer } from '../player';
import type { IPlexAuth } from '../plex/auth';
import { NOW_PLAYING_INFO_MODAL_ID } from '../ui/now-playing-info';
import type { PlaybackOptionsSectionId } from '../ui/playback-options/types';
import {
    computeAcceleratedRepeatIntervalMs,
    EPG_REPEAT_TIMING,
    MINI_GUIDE_REPEAT_TIMING,
} from './constants';
import { isAbortLikeError } from '../../utils/errors';
import type { ChannelSwitchOutcome } from '../../types/channelSwitch';
import type { RecoverableAsyncFailureReporter } from '../../core/orchestrator/OrchestratorRuntimeSeams';

export interface NavigationCoordinatorDeps {
    navigation: INavigationManager;
    epg: IEPGComponent | null;
    playback: {
        videoPlayer: IVideoPlayer | null;
        plexAuth: IPlexAuth | null;
        stopPlayback: () => void;
        getSeekIncrementMs: () => number;
        playerOsd: {
            overlay: { isVisible: () => boolean } | null;
            coordinator: {
                poke: (reason: 'play' | 'pause' | 'seek') => void;
                toggle: () => void;
                hide: () => void;
            } | null;
        };
    };
    miniGuide: {
        overlay: { isVisible: () => boolean } | null;
        coordinator: {
            show: () => void;
            hide: () => void;
            handleNavigation: (direction: 'up' | 'down') => boolean;
            handlePage: (direction: 'up' | 'down') => boolean;
            handleSelect: () => void;
        } | null;
    };
    nowPlayingInfo: {
        isModalOpen: () => boolean;
        toggleOverlay: () => void;
        showOverlay: () => void;
        hideOverlay: () => void;
    };
    modals: {
        playbackOptions: {
            modalId: string;
            prepare: (
                preferredSection?: PlaybackOptionsSectionId
            ) => { focusableIds: string[]; preferredFocusId: string | null };
            show: () => void;
            hide: () => void;
        };
        exitConfirm: {
            modalId: string;
            prepare: () => { focusableIds: string[] };
            show: () => void;
            hide: () => void;
        };
    };
    channelSwitching: {
        setLastChannelChangeSourceRemote: () => void;
        setLastChannelChangeSourceNumber: () => void;
        switchToNextChannel: () => void;
        switchToPreviousChannel: () => void;
        switchToChannelByNumber: (n: number) => Promise<ChannelSwitchOutcome>;
        focusEpgOnCurrentChannel: () => void;
        toggleEpg: () => void;
        onChannelInputUpdate?: (payload: { digits: string; isComplete: boolean }) => void;
    };
    uiGuards: {
        shouldRunChannelSetup: () => boolean;
        hideChannelTransition: () => void;
    };
    reportRecoverableAsyncFailure: RecoverableAsyncFailureReporter;
    reportToast?: (toast: { message: string; type: 'warning' | 'error' | 'info' | 'success' }) => void;
    readKeepPlayingInSettings: () => boolean;
    readDebugLoggingEnabled: () => boolean;
}

export class NavigationCoordinator {
    private _epgRepeatTimer: ReturnType<typeof setTimeout> | null = null;
    private _epgRepeatButton: 'up' | 'down' | 'left' | 'right' | null = null;
    private _epgRepeatStartMs = 0;
    private _miniGuideRepeatTimer: ReturnType<typeof setTimeout> | null = null;
    private _miniGuideRepeatButton: 'up' | 'down' | null = null;
    private _miniGuideRepeatStartMs = 0;
    private _suppressedLogTimestamps: Map<string, number> = new Map();
    private _nonBlockingFailureTimestamps: Map<string, number> = new Map();

    constructor(private readonly deps: NavigationCoordinatorDeps) { }

    private _reportNonBlockingFailure(
        key: string,
        event: string,
        message: string,
        error: unknown,
        toastMessage?: string
    ): void {
        const now = Date.now();
        const last = this._nonBlockingFailureTimestamps.get(key);
        if (typeof last === 'number' && now - last < 5000) {
            return;
        }
        if (this._nonBlockingFailureTimestamps.size > 20) {
            this._nonBlockingFailureTimestamps.clear();
        }
        this._nonBlockingFailureTimestamps.set(key, now);
        try {
            this.deps.reportRecoverableAsyncFailure(event, message, error);
        } catch {
            // Diagnostics are best-effort in non-blocking failure paths.
        }
        if (toastMessage) {
            try {
                this.deps.reportToast?.({ message: toastMessage, type: 'warning' });
            } catch {
                // Toast delivery must remain best-effort here.
            }
        }
    }

    private _fireAndReport(
        key: string,
        promise: Promise<void>,
        message: string,
        toastMessage: string
    ): void {
        void promise.catch((error: unknown) => {
            this._reportNonBlockingFailure(
                key,
                `navigation.${key}`,
                message,
                error,
                toastMessage
            );
        });
    }

    wireNavigationEvents(): Array<() => void> {
        const navigation = this.deps.navigation;

        const unsubs: Array<() => void> = [];

        navigation.handleLongPress('back', () => this._handleLongPressBack());

        const keyHandler = (event: KeyEvent): void => {
            this._handleKeyPress(event);
        };
        navigation.on('keyPress', keyHandler);
        unsubs.push(() => {
            navigation.off('keyPress', keyHandler);
        });

        const keyUpHandler = (payload: { button: KeyEvent['button'] }): void => {
            if (payload.button === this._epgRepeatButton) {
                this._stopEpgRepeat('keyup');
            }
            if (payload.button === this._miniGuideRepeatButton) {
                this._stopMiniGuideRepeat('keyup');
            }
        };
        navigation.on('keyUp', keyUpHandler);
        unsubs.push(() => {
            navigation.off('keyUp', keyUpHandler);
        });

        const channelNumberHandler = (payload: { channelNumber: number }): void => {
            if (!Number.isFinite(payload.channelNumber)) {
                return;
            }
            this._fireAndReport(
                'channel-number',
                this._handleChannelNumberEntered(payload.channelNumber),
                '[Navigation] channel-number failed:',
                'Could not switch to that channel'
            );
        };
        navigation.on('channelNumberEntered', channelNumberHandler);
        unsubs.push(() => {
            navigation.off('channelNumberEntered', channelNumberHandler);
        });

        const inputUpdateHandler = (payload: { digits: string; isComplete: boolean }): void => {
            this.deps.channelSwitching.onChannelInputUpdate?.(payload);
        };
        navigation.on('channelInputUpdate', inputUpdateHandler);
        unsubs.push(() => {
            navigation.off('channelInputUpdate', inputUpdateHandler);
        });

        const guideHandler = (): void => {
            // EPG is an overlay, not a navigation screen; toggle based on EPG visibility.
            this._stopEpgRepeat('guide');
            this._stopMiniGuideRepeat('guide');
            this.deps.miniGuide.coordinator?.hide();
            this.deps.channelSwitching.toggleEpg();
        };
        navigation.on('guide', guideHandler);
        unsubs.push(() => {
            navigation.off('guide', guideHandler);
        });

        const settingsHandler = (): void => {
            const currentScreen = navigation.getCurrentScreen();
            if (currentScreen === 'player' || currentScreen === 'guide') {
                navigation.goTo('settings');
            }
        };
        navigation.on('settings', settingsHandler);
        unsubs.push(() => {
            navigation.off('settings', settingsHandler);
        });

        const screenHandler = (payload: { from: string; to: string }): void => {
            this._handleScreenChange(payload.from, payload.to);
        };
        navigation.on('screenChange', screenHandler);
        unsubs.push(() => {
            navigation.off('screenChange', screenHandler);
        });

        const modalOpenHandler = (payload: { modalId: string }): void => {
            this._stopEpgRepeat('modalOpen');
            this._stopMiniGuideRepeat('modalOpen');
            this.deps.miniGuide.coordinator?.hide();
            if (payload.modalId === NOW_PLAYING_INFO_MODAL_ID) {
                this.deps.nowPlayingInfo.showOverlay();
            }
            if (payload.modalId === this.deps.modals.playbackOptions.modalId) {
                this.deps.modals.playbackOptions.show();
            }
            if (payload.modalId === this.deps.modals.exitConfirm.modalId) {
                this.deps.modals.exitConfirm.show();
            }
        };
        const modalCloseHandler = (payload: { modalId: string }): void => {
            if (payload.modalId === NOW_PLAYING_INFO_MODAL_ID) {
                this.deps.nowPlayingInfo.hideOverlay();
            }
            if (payload.modalId === this.deps.modals.playbackOptions.modalId) {
                this.deps.modals.playbackOptions.hide();
            }
            if (payload.modalId === this.deps.modals.exitConfirm.modalId) {
                this.deps.modals.exitConfirm.hide();
            }
        };
        navigation.on('modalOpen', modalOpenHandler);
        navigation.on('modalClose', modalCloseHandler);
        unsubs.push(() => {
            navigation.off('modalOpen', modalOpenHandler);
            navigation.off('modalClose', modalCloseHandler);
        });

        return unsubs;
    }

    private _handleScreenChange(from: string, to: string): void {
        this._stopEpgRepeat('screenChange');
        this._stopMiniGuideRepeat('screenChange');
        if (to === 'player' && this.deps.uiGuards.shouldRunChannelSetup()) {
            this.deps.navigation.replaceScreen('channel-setup');
            return;
        }

        const epg = this.deps.epg;
        const videoPlayer = this.deps.playback.videoPlayer;
        const navigation = this.deps.navigation;

        // Hide EPG when leaving guide
        if (from === 'guide' && to !== 'guide') {
            epg?.hide();
        }

        // Close Now Playing Info overlay when leaving player
        if (from === 'player' && to !== 'player') {
            if (navigation.isModalOpen(NOW_PLAYING_INFO_MODAL_ID)) {
                navigation.closeModal(NOW_PLAYING_INFO_MODAL_ID);
            }
            this.deps.miniGuide.coordinator?.hide();
            this.deps.playback.playerOsd.coordinator?.hide();
            this.deps.uiGuards.hideChannelTransition();
        }

        // Show EPG when entering guide
        if (to === 'guide') {
            if (epg && !epg.isVisible()) {
                this.deps.channelSwitching.toggleEpg();
            }
        }

        // Hide EPG when entering settings (prevents overlay bleed)
        if (to === 'settings') {
            epg?.hide();
        }

        // Pause playback when leaving player for settings/channel-edit
        if (from === 'player' && (to === 'settings' || to === 'channel-edit')) {
            if (!this._shouldKeepPlayingInSettings()) {
                videoPlayer?.pause();
            }
        }

        // Resume playback when returning to player
        if (to === 'player' && from !== 'player') {
            if (videoPlayer) {
                this._fireAndReport(
                    'resume_play',
                    videoPlayer.play(),
                    '[Navigation] resume_play failed:',
                    'Playback failed to resume'
                );
            }
        }
    }

    private _handleLongPressBack(): void {
        const navigation = this.deps.navigation;
        if (navigation.isInputBlocked()) return;

        this.deps.epg?.hide();
        while (navigation.isModalOpen()) {
            navigation.closeModal();
        }
        navigation.replaceScreen('player');
    }

    private _handleKeyPress(event: KeyEvent): void {
        const isDirection = (
            event.button === 'up'
            || event.button === 'down'
            || event.button === 'left'
            || event.button === 'right'
        );
        if (this._epgRepeatButton && !isDirection) {
            this._stopEpgRepeat('nonDirectional');
        }
        if (this._miniGuideRepeatButton && !isDirection) {
            this._stopMiniGuideRepeat('nonDirectional');
        }

        const isNowPlayingModalOpen = this.deps.nowPlayingInfo.isModalOpen();
        if (isNowPlayingModalOpen && event.button === 'back') {
            this._logInputNotHandled('modal_open', event);
            return;
        }
        if (isNowPlayingModalOpen && event.button === 'ok') {
            const navigation = this.deps.navigation;
            if (!navigation.isModalOpen(this.deps.modals.playbackOptions.modalId)) {
                const prep = this.deps.modals.playbackOptions.prepare('subtitles');
                navigation.closeModal(NOW_PLAYING_INFO_MODAL_ID);
                navigation.openModal(this.deps.modals.playbackOptions.modalId, prep.focusableIds);
                if (prep.preferredFocusId) {
                    navigation.setFocus(prep.preferredFocusId);
                }
            }
            event.handled = true;
            event.originalEvent.preventDefault();
            return;
        }

        // Compute EPG routing eligibility: only route to EPG when on guide screen with no modal open
        const epg = this.deps.epg;
        const navigation = this.deps.navigation;
        const modalOpen = navigation.isModalOpen();
        const miniGuideVisible = this.deps.miniGuide.overlay?.isVisible() ?? false;
        const shouldRouteToEpg = !modalOpen && !!epg?.isVisible() && !miniGuideVisible;

        if (modalOpen && (event.button === 'up' || event.button === 'down' || event.button === 'left' || event.button === 'right')) {
            this._logInputNotHandled('modal_open', event);
        }

        if (epg && shouldRouteToEpg) {
            switch (event.button) {
                case 'up':
                case 'down':
                case 'left':
                case 'right':
                    event.handled = true;
                    event.originalEvent.preventDefault();

                    if (event.isRepeat) {
                        return;
                    }

                    if (this._epgRepeatButton && this._epgRepeatButton !== event.button) {
                        this._stopEpgRepeat('directionChange');
                    }

                    if (epg.handleNavigation(event.button)) {
                        this._startEpgRepeat(event.button);
                    }
                    return;
                case 'play':
                    // When the guide is open, PLAY acts as "Jump to Now" instead of controlling playback.
                    // This mirrors common 10-foot UI conventions and avoids accidental playback toggles.
                    this._stopEpgRepeat('play');
                    epg.focusNow();
                    event.handled = true;
                    event.originalEvent.preventDefault();
                    return;
                case 'ok':
                    this._stopEpgRepeat('ok');
                    epg.handleSelect();
                    event.handled = true;
                    event.originalEvent.preventDefault();
                    return;
                case 'back':
                    this._stopEpgRepeat('back');
                    epg.handleBack();
                    event.handled = true;
                    event.originalEvent.preventDefault();
                    return;
                case 'channelUp':
                case 'channelDown':
                    event.handled = true;
                    event.originalEvent.preventDefault();
                    this._stopEpgRepeat('channelPage');
                    if (event.isRepeat) {
                        return;
                    }
                    epg.handlePage(event.button === 'channelUp' ? 'up' : 'down');
                    return;
                default:
                    break;
            }
        }

        const currentScreen = navigation.getCurrentScreen();
        if (currentScreen === 'player' && miniGuideVisible && !modalOpen && !shouldRouteToEpg) {
            if (navigation.isInputBlocked()) {
                this._logInputNotHandled('input_blocked', event);
                this._stopMiniGuideRepeat('inputBlocked');
                event.handled = true;
                event.originalEvent.preventDefault();
                return;
            }
            switch (event.button) {
                case 'up':
                case 'down':
                    event.handled = true;
                    event.originalEvent.preventDefault();
                    if (this._miniGuideRepeatButton && this._miniGuideRepeatButton !== event.button) {
                        this._stopMiniGuideRepeat('directionChange');
                    }
                    if (!event.isRepeat || !this._miniGuideRepeatButton) {
                        if (this.deps.miniGuide.coordinator?.handleNavigation(event.button)) {
                            this._startMiniGuideRepeat(event.button);
                        }
                    }
                    return;
                case 'channelUp':
                case 'channelDown':
                    event.handled = true;
                    event.originalEvent.preventDefault();
                    this._stopMiniGuideRepeat('page');
                    this.deps.miniGuide.coordinator?.handlePage(event.button === 'channelUp' ? 'up' : 'down');
                    return;
                case 'right':
                    event.handled = true;
                    event.originalEvent.preventDefault();
                    this._stopMiniGuideRepeat('right');
                    this.deps.miniGuide.coordinator?.hide();
                    this.deps.channelSwitching.toggleEpg();
                    return;
                case 'ok':
                    event.handled = true;
                    event.originalEvent.preventDefault();
                    this._stopMiniGuideRepeat('ok');
                    if (!event.isRepeat) {
                        this.deps.miniGuide.coordinator?.handleSelect();
                    }
                    return;
                case 'back':
                    event.handled = true;
                    event.originalEvent.preventDefault();
                    this._stopMiniGuideRepeat('back');
                    this.deps.miniGuide.coordinator?.hide();
                    return;
                default:
                    break;
            }
        }

        if (
            currentScreen === 'player'
            && !miniGuideVisible
            && !modalOpen
            && !shouldRouteToEpg
            && !(this.deps.playback.playerOsd.overlay?.isVisible() ?? false)
        ) {
            if (event.button === 'up') {
                event.handled = true;
                event.originalEvent.preventDefault();
                if (!event.isRepeat) {
                    this.deps.miniGuide.coordinator?.show();
                }
                return;
            }
        }

        if (currentScreen !== 'player' && (event.button === 'up' || event.button === 'down' || event.button === 'ok')) {
            this._logInputNotHandled('screen_not_player', event);
        }

        if (event.button === 'down') {
            if (
                currentScreen === 'player'
                && !modalOpen
                && !shouldRouteToEpg
                && !(this.deps.playback.playerOsd.overlay?.isVisible() ?? false)
                && !miniGuideVisible
            ) {
                this.deps.playback.playerOsd.coordinator?.toggle();
                event.handled = true;
                event.originalEvent.preventDefault();
                return;
            }
        }

        if (event.button === 'ok') {
            if (
                currentScreen === 'player'
                && !modalOpen
                && !(this.deps.playback.playerOsd.overlay?.isVisible() ?? false)
                && !miniGuideVisible
            ) {
                this.deps.playback.playerOsd.coordinator?.toggle();
                event.handled = true;
                event.originalEvent.preventDefault();
                return;
            }
        }

        if (event.button === 'back') {
            const currentScreen = navigation.getCurrentScreen();
            if (currentScreen === 'player' && !navigation.isModalOpen()) {
                if (this.deps.playback.playerOsd.overlay?.isVisible()) {
                    this.deps.playback.playerOsd.coordinator?.hide();
                    event.handled = true;
                    event.originalEvent.preventDefault();
                    return;
                }
                // Player back should not traverse setup/server screen history.
                const prep = this.deps.modals.exitConfirm.prepare();
                navigation.openModal(this.deps.modals.exitConfirm.modalId, prep.focusableIds);
                event.handled = true;
                event.originalEvent.preventDefault();
                return;
            }
        }

        switch (event.button) {
            case 'red':
                if (event.isRepeat) {
                    break;
                }
                this.deps.nowPlayingInfo.toggleOverlay();
                break;
            case 'channelUp':
                if (currentScreen === 'player' && !modalOpen && !shouldRouteToEpg) {
                    this.deps.channelSwitching.setLastChannelChangeSourceRemote();
                    // Treat channel-up as decrement (reverse wrap) to match user expectation.
                    this.deps.channelSwitching.switchToPreviousChannel();
                }
                break;
            case 'channelDown':
                if (currentScreen === 'player' && !modalOpen && !shouldRouteToEpg) {
                    this.deps.channelSwitching.setLastChannelChangeSourceRemote();
                    // Treat channel-down as increment (forward wrap) to match user expectation.
                    this.deps.channelSwitching.switchToNextChannel();
                }
                break;
            case 'info':
            case 'blue': {
                const navigation = this.deps.navigation;
                const plexAuth = this.deps.playback.plexAuth;
                if (plexAuth && !plexAuth.isAuthenticated()) {
                    navigation.goTo('auth');
                } else {
                    navigation.goTo('server-select', { allowAutoConnect: false });
                }
                break;
            }
            case 'play':
                {
                    const player = this.deps.playback.videoPlayer;
                    if (!player) {
                        break;
                    }
                    const playPromise = player.play();
                    this._fireAndReport(
                        'remote_play',
                        playPromise,
                        '[Navigation] remote_play failed:',
                        'Unable to start playback'
                    );
                    void playPromise.then(
                        () => {
                            this.deps.playback.playerOsd.coordinator?.poke('play');
                        },
                        () => undefined
                    );
                }
                break;
            case 'pause':
                this.deps.playback.videoPlayer?.pause();
                this.deps.playback.playerOsd.coordinator?.poke('pause');
                break;
            case 'rewind': {
                const player = this.deps.playback.videoPlayer;
                if (!player) {
                    break;
                }
                const deltaMs = -this.deps.playback.getSeekIncrementMs();
                void this._observeNonBlockingPromise('seek', player.seekRelative(deltaMs), '[Navigation] seek failed:');
                this.deps.playback.playerOsd.coordinator?.poke('seek');
                break;
            }
            case 'fastforward': {
                const player = this.deps.playback.videoPlayer;
                if (!player) {
                    break;
                }
                const deltaMs = this.deps.playback.getSeekIncrementMs();
                void this._observeNonBlockingPromise('seek', player.seekRelative(deltaMs), '[Navigation] seek failed:');
                this.deps.playback.playerOsd.coordinator?.poke('seek');
                break;
            }
            case 'stop':
                this.deps.playback.stopPlayback();
                break;
            // Other keys handled by active screen
        }
    }

    private _stopEpgRepeat(_reason: string): void {
        if (this._epgRepeatTimer !== null) {
            clearTimeout(this._epgRepeatTimer);
            this._epgRepeatTimer = null;
        }
        this._epgRepeatButton = null;
        this._epgRepeatStartMs = 0;
    }

    private _scheduleNextEpgRepeatTick(): void {
        const epg = this.deps.epg;
        const navigation = this.deps.navigation;

        if (!epg || !epg.isVisible()) {
            this._stopEpgRepeat('notVisible');
            return;
        }
        if (navigation.isModalOpen()) {
            this._stopEpgRepeat('modalOpen');
            return;
        }
        if (navigation.isInputBlocked()) {
            this._stopEpgRepeat('inputBlocked');
            return;
        }
        if (!this._epgRepeatButton) {
            this._stopEpgRepeat('noButton');
            return;
        }

        const moved = epg.handleNavigation(this._epgRepeatButton);
        if (!moved) {
            this._stopEpgRepeat('blocked');
            return;
        }

        const heldMs = Date.now() - this._epgRepeatStartMs;
        const interval = computeAcceleratedRepeatIntervalMs(heldMs, EPG_REPEAT_TIMING);
        this._epgRepeatTimer = setTimeout(
            () => this._scheduleNextEpgRepeatTick(),
            interval
        );
    }

    private _startEpgRepeat(button: 'up' | 'down' | 'left' | 'right'): void {
        this._stopEpgRepeat('restart');
        this._epgRepeatButton = button;
        this._epgRepeatStartMs = Date.now();
        this._epgRepeatTimer = setTimeout(
            () => this._scheduleNextEpgRepeatTick(),
            EPG_REPEAT_TIMING.INITIAL_DELAY_MS
        );
    }

    private _stopMiniGuideRepeat(_reason: string): void {
        if (this._miniGuideRepeatTimer !== null) {
            clearTimeout(this._miniGuideRepeatTimer);
            this._miniGuideRepeatTimer = null;
        }
        this._miniGuideRepeatButton = null;
        this._miniGuideRepeatStartMs = 0;
    }

    private _scheduleNextMiniGuideRepeatTick(): void {
        const navigation = this.deps.navigation;
        if (navigation.isModalOpen()) {
            this._stopMiniGuideRepeat('modalOpen');
            return;
        }
        if (navigation.isInputBlocked()) {
            this._stopMiniGuideRepeat('inputBlocked');
            return;
        }
        if (navigation.getCurrentScreen() !== 'player') {
            this._stopMiniGuideRepeat('notPlayer');
            return;
        }
        if (!(this.deps.miniGuide.overlay?.isVisible() ?? false)) {
            this._stopMiniGuideRepeat('notVisible');
            return;
        }
        if (!this._miniGuideRepeatButton) {
            this._stopMiniGuideRepeat('noButton');
            return;
        }

        const moved = this.deps.miniGuide.coordinator?.handleNavigation(this._miniGuideRepeatButton) ?? false;
        if (!moved) {
            this._stopMiniGuideRepeat('blocked');
            return;
        }

        const heldMs = Date.now() - this._miniGuideRepeatStartMs;
        const interval = computeAcceleratedRepeatIntervalMs(heldMs, MINI_GUIDE_REPEAT_TIMING);
        this._miniGuideRepeatTimer = setTimeout(
            () => this._scheduleNextMiniGuideRepeatTick(),
            interval
        );
    }

    private _startMiniGuideRepeat(button: 'up' | 'down'): void {
        this._stopMiniGuideRepeat('restart');
        this._miniGuideRepeatButton = button;
        this._miniGuideRepeatStartMs = Date.now();
        this._miniGuideRepeatTimer = setTimeout(
            () => this._scheduleNextMiniGuideRepeatTick(),
            MINI_GUIDE_REPEAT_TIMING.INITIAL_DELAY_MS
        );
    }

    private async _handleChannelNumberEntered(channelNumber: number): Promise<void> {
        this.deps.channelSwitching.setLastChannelChangeSourceNumber();
        try {
            const outcome = await this.deps.channelSwitching.switchToChannelByNumber(channelNumber);
            if (outcome !== 'switched') {
                return;
            }
            if (this.deps.epg?.isVisible()) {
                this.deps.channelSwitching.focusEpgOnCurrentChannel();
            }
        } catch (error: unknown) {
            if (isAbortLikeError(error)) {
                return;
            }
            throw error;
        }
    }

    private async _observeNonBlockingPromise(
        key: string,
        promise: Promise<void>,
        message: string
    ): Promise<void> {
        try {
            await promise;
        } catch (error: unknown) {
            this._reportNonBlockingFailure(
                key,
                `navigation.${key}`,
                message,
                error
            );
        }
    }

    private _shouldKeepPlayingInSettings(): boolean {
        return this.deps.readKeepPlayingInSettings();
    }

    private _isDebugLoggingEnabled(): boolean {
        return this.deps.readDebugLoggingEnabled();
    }

    private _logInputNotHandled(
        reason: 'modal_open' | 'screen_not_player' | 'input_blocked',
        event: KeyEvent
    ): void {
        if (!this._isDebugLoggingEnabled()) return;
        const navigation = this.deps.navigation;
        const state = navigation.getState();
        const key = [
            reason,
            event.button,
            state?.currentScreen ?? 'unknown',
            (state?.modalStack ?? []).join(','),
            navigation.isInputBlocked() ? 'blocked' : 'open',
        ].join('|');
        const now = Date.now();
        const last = this._suppressedLogTimestamps.get(key) ?? 0;
        if (now - last < 1000) {
            return;
        }
        if (this._suppressedLogTimestamps.size > 50) {
            this._suppressedLogTimestamps.clear();
        }
        this._suppressedLogTimestamps.set(key, now);
    }
}
