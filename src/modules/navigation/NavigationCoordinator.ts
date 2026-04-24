/**
 * @fileoverview Handles key input routing and screen navigation events.
 * @module modules/navigation/NavigationCoordinator
 * @version 1.0.0
 */

import type {
    INavigationManager,
    KeyEvent,
    NavigationAsyncFailureReporter,
} from './interfaces';
import type { IEPGComponent } from '../ui/epg';
import type { IVideoPlayer } from '../player';
import type { IPlexAuth } from '../plex/auth';
import { NOW_PLAYING_INFO_MODAL_ID } from '../ui/now-playing-info';
import type { PlaybackOptionsSectionId } from '../ui/playback-options';
import {
    computeAcceleratedRepeatIntervalMs,
    EPG_REPEAT_TIMING,
    MINI_GUIDE_REPEAT_TIMING,
} from './constants';
import { recordNonBlockingFailureTimestamp } from './nonBlockingFailureTimestamps';
import { isAbortLikeError } from '../../utils/errors';
import type { ChannelSwitchOutcome } from '../../types/channelSwitch';
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
    reportRecoverableAsyncFailure: NavigationAsyncFailureReporter;
    reportToast?: (toast: { message: string; type: 'warning' | 'error' | 'info' | 'success' }) => void;
    readKeepPlayingInSettings: () => boolean;
    readDebugLoggingEnabled: () => boolean;
}

type KeyPressRoutingState = {
    epg: IEPGComponent | null;
    currentScreen: string;
    modalOpen: boolean;
    miniGuideVisible: boolean;
    shouldRouteToEpg: boolean;
};

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
        if (!recordNonBlockingFailureTimestamp(this._nonBlockingFailureTimestamps, key, now)) {
            return;
        }
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
        promiseFactory: () => Promise<void>,
        message: string,
        toastMessage: string
    ): Promise<void> | null {
        let promise: Promise<void>;
        try {
            promise = promiseFactory();
        } catch (error: unknown) {
            this._reportNonBlockingFailure(
                key,
                `navigation.${key}`,
                message,
                error,
                toastMessage
            );
            return null;
        }
        void promise.catch((error: unknown) => {
            this._reportNonBlockingFailure(
                key,
                `navigation.${key}`,
                message,
                error,
                toastMessage
            );
        });
        return promise;
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
                () => this._handleChannelNumberEntered(payload.channelNumber),
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
                    () => videoPlayer.play(),
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
        this._stopRepeatsForNonDirectionalInput(event);

        if (this._handleNowPlayingModalKeyPress(event)) {
            return;
        }

        const routingState = this._getKeyPressRoutingState();
        if (routingState.modalOpen && this._isDirectionalButton(event.button)) {
            this._logInputNotHandled('modal_open', event);
        }

        if (this._handleEpgModeKeyPress(event, routingState)) {
            return;
        }

        if (this._handleMiniGuideModeKeyPress(event, routingState)) {
            return;
        }

        if (this._handlePlayerMiniGuideShowKeyPress(event, routingState)) {
            return;
        }

        if (
            routingState.currentScreen !== 'player'
            && (event.button === 'up' || event.button === 'down' || event.button === 'ok')
        ) {
            this._logInputNotHandled('screen_not_player', event);
        }

        if (this._handlePlayerOsdToggleKeyPress(event, routingState)) {
            return;
        }

        if (this._handlePlayerBackKeyPress(event, routingState)) {
            return;
        }

        this._handleDefaultKeyPress(event, routingState);
    }

    private _stopRepeatsForNonDirectionalInput(event: KeyEvent): void {
        if (this._epgRepeatButton && !this._isDirectionalButton(event.button)) {
            this._stopEpgRepeat('nonDirectional');
        }
        if (this._miniGuideRepeatButton && !this._isDirectionalButton(event.button)) {
            this._stopMiniGuideRepeat('nonDirectional');
        }
    }

    private _handleNowPlayingModalKeyPress(event: KeyEvent): boolean {
        const isNowPlayingModalOpen = this.deps.nowPlayingInfo.isModalOpen();
        if (isNowPlayingModalOpen && event.button === 'back') {
            this._logInputNotHandled('modal_open', event);
            return true;
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
            this._consumeKeyEvent(event);
            return true;
        }
        return false;
    }

    private _getKeyPressRoutingState(): KeyPressRoutingState {
        const epg = this.deps.epg;
        const navigation = this.deps.navigation;
        const modalOpen = navigation.isModalOpen();
        const miniGuideVisible = this.deps.miniGuide.overlay?.isVisible() ?? false;
        return {
            epg,
            currentScreen: navigation.getCurrentScreen(),
            modalOpen,
            miniGuideVisible,
            shouldRouteToEpg: !modalOpen && !!epg?.isVisible() && !miniGuideVisible,
        };
    }

    private _handleEpgModeKeyPress(event: KeyEvent, routingState: KeyPressRoutingState): boolean {
        const { epg, shouldRouteToEpg } = routingState;
        if (!epg || !shouldRouteToEpg) {
            return false;
        }

        switch (event.button) {
            case 'up':
            case 'down':
            case 'left':
            case 'right':
                this._consumeKeyEvent(event);

                if (event.isRepeat) {
                    return true;
                }

                if (this._epgRepeatButton && this._epgRepeatButton !== event.button) {
                    this._stopEpgRepeat('directionChange');
                }

                if (epg.handleNavigation(event.button)) {
                    this._startEpgRepeat(event.button);
                }
                return true;
            case 'play':
                this._stopEpgRepeat('play');
                epg.focusNow();
                this._consumeKeyEvent(event);
                return true;
            case 'ok':
                this._stopEpgRepeat('ok');
                epg.handleSelect();
                this._consumeKeyEvent(event);
                return true;
            case 'back':
                this._stopEpgRepeat('back');
                epg.handleBack();
                this._consumeKeyEvent(event);
                return true;
            case 'channelUp':
            case 'channelDown':
                this._consumeKeyEvent(event);
                this._stopEpgRepeat('channelPage');
                if (event.isRepeat) {
                    return true;
                }
                epg.handlePage(event.button === 'channelUp' ? 'up' : 'down');
                return true;
            default:
                return false;
        }
    }

    private _handleMiniGuideModeKeyPress(event: KeyEvent, routingState: KeyPressRoutingState): boolean {
        const { currentScreen, miniGuideVisible, modalOpen } = routingState;
        if (currentScreen !== 'player' || !miniGuideVisible || modalOpen) {
            return false;
        }
        if (this.deps.navigation.isInputBlocked()) {
            this._logInputNotHandled('input_blocked', event);
            this._stopMiniGuideRepeat('inputBlocked');
            this._consumeKeyEvent(event);
            return true;
        }

        switch (event.button) {
            case 'up':
            case 'down':
                this._consumeKeyEvent(event);
                if (this._miniGuideRepeatButton && this._miniGuideRepeatButton !== event.button) {
                    this._stopMiniGuideRepeat('directionChange');
                }
                if (!event.isRepeat || !this._miniGuideRepeatButton) {
                    if (this.deps.miniGuide.coordinator?.handleNavigation(event.button)) {
                        this._startMiniGuideRepeat(event.button);
                    }
                }
                return true;
            case 'channelUp':
            case 'channelDown':
                this._consumeKeyEvent(event);
                this._stopMiniGuideRepeat('page');
                this.deps.miniGuide.coordinator?.handlePage(event.button === 'channelUp' ? 'up' : 'down');
                return true;
            case 'right':
                this._consumeKeyEvent(event);
                this._stopMiniGuideRepeat('right');
                this.deps.miniGuide.coordinator?.hide();
                this.deps.channelSwitching.toggleEpg();
                return true;
            case 'ok':
                this._consumeKeyEvent(event);
                this._stopMiniGuideRepeat('ok');
                if (!event.isRepeat) {
                    this.deps.miniGuide.coordinator?.handleSelect();
                }
                return true;
            case 'back':
                this._consumeKeyEvent(event);
                this._stopMiniGuideRepeat('back');
                this.deps.miniGuide.coordinator?.hide();
                return true;
            default:
                return false;
        }
    }

    private _handlePlayerMiniGuideShowKeyPress(
        event: KeyEvent,
        routingState: KeyPressRoutingState
    ): boolean {
        if (
            routingState.currentScreen === 'player'
            && !routingState.miniGuideVisible
            && !routingState.modalOpen
            && !routingState.shouldRouteToEpg
            && !(this.deps.playback.playerOsd.overlay?.isVisible() ?? false)
            && event.button === 'up'
        ) {
            this._consumeKeyEvent(event);
            if (!event.isRepeat) {
                this.deps.miniGuide.coordinator?.show();
            }
            return true;
        }
        return false;
    }

    private _handlePlayerOsdToggleKeyPress(
        event: KeyEvent,
        routingState: KeyPressRoutingState
    ): boolean {
        if (
            event.button === 'down'
            && routingState.currentScreen === 'player'
            && !routingState.modalOpen
            && !routingState.shouldRouteToEpg
            && !(this.deps.playback.playerOsd.overlay?.isVisible() ?? false)
            && !routingState.miniGuideVisible
        ) {
            this.deps.playback.playerOsd.coordinator?.toggle();
            this._consumeKeyEvent(event);
            return true;
        }

        if (
            event.button === 'ok'
            && routingState.currentScreen === 'player'
            && !routingState.modalOpen
            && !(this.deps.playback.playerOsd.overlay?.isVisible() ?? false)
            && !routingState.miniGuideVisible
        ) {
            this.deps.playback.playerOsd.coordinator?.toggle();
            this._consumeKeyEvent(event);
            return true;
        }

        return false;
    }

    private _handlePlayerBackKeyPress(event: KeyEvent, routingState: KeyPressRoutingState): boolean {
        if (event.button !== 'back') {
            return false;
        }

        const navigation = this.deps.navigation;
        if (routingState.currentScreen !== 'player' || routingState.modalOpen) {
            return false;
        }

        if (this.deps.playback.playerOsd.overlay?.isVisible()) {
            this.deps.playback.playerOsd.coordinator?.hide();
            this._consumeKeyEvent(event);
            return true;
        }

        const prep = this.deps.modals.exitConfirm.prepare();
        navigation.openModal(this.deps.modals.exitConfirm.modalId, prep.focusableIds);
        this._consumeKeyEvent(event);
        return true;
    }

    private _handleDefaultKeyPress(event: KeyEvent, routingState: KeyPressRoutingState): void {
        switch (event.button) {
            case 'red':
                if (event.isRepeat) {
                    break;
                }
                this.deps.nowPlayingInfo.toggleOverlay();
                break;
            case 'channelUp':
                if (
                    routingState.currentScreen === 'player'
                    && !routingState.modalOpen
                    && !routingState.shouldRouteToEpg
                ) {
                    this.deps.channelSwitching.setLastChannelChangeSourceRemote();
                    // Treat channel-up as decrement (reverse wrap) to match user expectation.
                    this.deps.channelSwitching.switchToPreviousChannel();
                }
                break;
            case 'channelDown':
                if (
                    routingState.currentScreen === 'player'
                    && !routingState.modalOpen
                    && !routingState.shouldRouteToEpg
                ) {
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
                    const playPromise = this._fireAndReport(
                        'remote_play',
                        () => player.play(),
                        '[Navigation] remote_play failed:',
                        'Unable to start playback'
                    );
                    void playPromise?.then(
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
                void this._observeNonBlockingPromise(
                    'seek',
                    () => player.seekRelative(deltaMs),
                    '[Navigation] seek failed:'
                );
                this.deps.playback.playerOsd.coordinator?.poke('seek');
                break;
            }
            case 'fastforward': {
                const player = this.deps.playback.videoPlayer;
                if (!player) {
                    break;
                }
                const deltaMs = this.deps.playback.getSeekIncrementMs();
                void this._observeNonBlockingPromise(
                    'seek',
                    () => player.seekRelative(deltaMs),
                    '[Navigation] seek failed:'
                );
                this.deps.playback.playerOsd.coordinator?.poke('seek');
                break;
            }
            case 'stop':
                this.deps.playback.stopPlayback();
                break;
            // Other keys handled by active screen
        }
    }

    private _consumeKeyEvent(event: KeyEvent): void {
        event.handled = true;
        event.originalEvent.preventDefault();
    }

    private _isDirectionalButton(button: KeyEvent['button']): button is 'up' | 'down' | 'left' | 'right' {
        return button === 'up' || button === 'down' || button === 'left' || button === 'right';
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
        promiseFactory: () => Promise<void>,
        message: string
    ): Promise<void> {
        let promise: Promise<void>;
        try {
            promise = promiseFactory();
        } catch (error: unknown) {
            this._reportNonBlockingFailure(
                key,
                `navigation.${key}`,
                message,
                error
            );
            return;
        }
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
