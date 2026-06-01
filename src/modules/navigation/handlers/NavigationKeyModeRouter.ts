import type { INavigationManager, KeyEvent, Screen } from '../contracts/interfaces';
import type {
    NavigationFireAndReport,
    NavigationLogInputNotHandled,
    NavigationObserveNonBlockingPromise,
} from '../coordinator/NavigationCoordinatorRuntimeServices';
import type {
    NavigationKeyModeRouterRuntime,
    NavigationRepeatRuntime,
} from '../contracts/NavigationHandlerContracts';
import type {
    NavigationChannelSwitchingPort,
    NavigationEpgPort,
    NavigationFourWayDirection,
    NavigationMiniGuidePort,
    NavigationModalsPort,
    NavigationNowPlayingInfoPort,
    NavigationPlaybackPort,
} from '../contracts/NavigationFeaturePorts';

export interface NavigationKeyModeRouterPort {
    navigation: INavigationManager;
    epg: NavigationEpgPort | null;
    playback: NavigationPlaybackPort;
    miniGuide: NavigationMiniGuidePort;
    nowPlayingInfo: NavigationNowPlayingInfoPort;
    modals: NavigationModalsPort;
    channelSwitching: NavigationChannelSwitchingPort;
}

type KeyPressRoutingState = {
    currentScreen: Screen;
    modalOpen: boolean;
    miniGuideVisible: boolean;
    shouldRouteToEpg: boolean;
};

export class NavigationKeyModeRouter implements NavigationKeyModeRouterRuntime {
    constructor(
        private readonly deps: NavigationKeyModeRouterPort,
        private readonly repeats: NavigationRepeatRuntime,
        private readonly fireAndReport: NavigationFireAndReport,
        private readonly observeNonBlockingPromise: NavigationObserveNonBlockingPromise,
        private readonly logInputNotHandled: NavigationLogInputNotHandled
    ) { }

    handleLongPressBack(): void {
        const navigation = this.deps.navigation;
        if (navigation.isInputBlocked()) return;

        this.deps.epg?.hide();
        while (navigation.isModalOpen()) {
            navigation.closeModal();
        }
        navigation.replaceScreen('player');
    }

    handleKeyPress(event: KeyEvent): void {
        this.repeats.stopForNonDirectionalInput(event);

        if (this._handleNowPlayingModalKeyPress(event)) {
            return;
        }

        const routingState = this._getKeyPressRoutingState();
        if (routingState.modalOpen && this._isDirectionalButton(event.button)) {
            this.logInputNotHandled('modal_open', event);
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
            this.logInputNotHandled('screen_not_player', event);
        }

        if (this._handlePlayerOsdToggleKeyPress(event, routingState)) {
            return;
        }

        if (this._handlePlayerBackKeyPress(event, routingState)) {
            return;
        }

        this._handleDefaultKeyPress(event, routingState);
    }

    private _handleNowPlayingModalKeyPress(event: KeyEvent): boolean {
        const isNowPlayingModalOpen = this.deps.nowPlayingInfo.isModalOpen();
        if (isNowPlayingModalOpen && event.button === 'back') {
            this.logInputNotHandled('modal_open', event);
            return true;
        }
        if (isNowPlayingModalOpen && event.button === 'ok') {
            const navigation = this.deps.navigation;
            if (!navigation.isModalOpen(this.deps.modals.playbackOptions.modalId)) {
                const prep = this.deps.modals.playbackOptions.prepare('subtitles');
                this.deps.nowPlayingInfo.resetAutoHideTimer();
                navigation.closeModal(this.deps.nowPlayingInfo.modalId);
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
        const miniGuideVisible = this.deps.miniGuide.isVisible();
        return {
            currentScreen: navigation.getCurrentScreen(),
            modalOpen,
            miniGuideVisible,
            shouldRouteToEpg: !modalOpen && !!epg?.isVisible() && !miniGuideVisible,
        };
    }

    private _handleEpgModeKeyPress(event: KeyEvent, routingState: KeyPressRoutingState): boolean {
        const epg = this.deps.epg;
        if (!epg || !routingState.shouldRouteToEpg) {
            return false;
        }
        if (this.deps.navigation.isInputBlocked()) {
            this.logInputNotHandled('input_blocked', event);
            this.repeats.stopEpgRepeat('inputBlocked');
            this._consumeKeyEvent(event);
            return true;
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

                this.repeats.stopEpgRepeatForDirectionChange(event.button);

                if (epg.handleNavigation(event.button)) {
                    this.repeats.startEpgRepeat(event.button);
                }
                return true;
            case 'play':
                this.repeats.stopEpgRepeat('play');
                epg.focusNow();
                this._consumeKeyEvent(event);
                return true;
            case 'ok':
                this.repeats.stopEpgRepeat('ok');
                epg.handleSelect();
                this._consumeKeyEvent(event);
                return true;
            case 'back':
                this.repeats.stopEpgRepeat('back');
                epg.handleBack();
                this._consumeKeyEvent(event);
                return true;
            case 'channelUp':
            case 'channelDown':
                this._consumeKeyEvent(event);
                this.repeats.stopEpgRepeat('channelPage');
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
            this.logInputNotHandled('input_blocked', event);
            this.repeats.stopMiniGuideRepeat('inputBlocked');
            this._consumeKeyEvent(event);
            return true;
        }

        switch (event.button) {
            case 'up':
            case 'down':
                this._consumeKeyEvent(event);
                this.repeats.stopMiniGuideRepeatForDirectionChange(event.button);
                if (!event.isRepeat || !this.repeats.hasMiniGuideRepeatButton()) {
                    if (this.deps.miniGuide.requestMiniGuideIntent({ type: 'navigate', direction: event.button })) {
                        this.repeats.startMiniGuideRepeat(event.button);
                    }
                }
                return true;
            case 'channelUp':
            case 'channelDown':
                this._consumeKeyEvent(event);
                this.repeats.stopMiniGuideRepeat('page');
                this.deps.miniGuide.requestMiniGuideIntent({
                    type: 'page',
                    direction: event.button === 'channelUp' ? 'up' : 'down',
                });
                return true;
            case 'right':
                this._consumeKeyEvent(event);
                this.repeats.stopMiniGuideRepeat('right');
                this.deps.miniGuide.requestMiniGuideIntent({ type: 'hide' });
                this.deps.channelSwitching.toggleEpg();
                return true;
            case 'ok':
                this._consumeKeyEvent(event);
                this.repeats.stopMiniGuideRepeat('ok');
                if (!event.isRepeat) {
                    this.deps.miniGuide.requestMiniGuideIntent({ type: 'select' });
                }
                return true;
            case 'back':
                this._consumeKeyEvent(event);
                this.repeats.stopMiniGuideRepeat('back');
                this.deps.miniGuide.requestMiniGuideIntent({ type: 'hide' });
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
            && !this.deps.playback.isPlayerOsdVisible()
            && event.button === 'up'
        ) {
            this._consumeKeyEvent(event);
            if (!event.isRepeat) {
                this.deps.miniGuide.requestMiniGuideIntent({ type: 'show' });
            }
            return true;
        }
        return false;
    }

    private _handlePlayerOsdToggleKeyPress(
        event: KeyEvent,
        routingState: KeyPressRoutingState
    ): boolean {
        const isOsdToggleButton = event.button === 'down' || event.button === 'ok';
        if (
            isOsdToggleButton
            && routingState.currentScreen === 'player'
            && !routingState.modalOpen
            && !routingState.shouldRouteToEpg
            && !this.deps.playback.isPlayerOsdVisible()
            && !routingState.miniGuideVisible
        ) {
            this.deps.playback.requestPlayerOsdIntent({ type: 'toggle' });
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

        if (this.deps.playback.isPlayerOsdVisible()) {
            this.deps.playback.requestPlayerOsdIntent({ type: 'hide' });
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
                if (event.isRepeat) {
                    break;
                }
                const navigation = this.deps.navigation;
                if (!this.deps.playback.isAuthenticatedForServerSelection()) {
                    navigation.goTo('auth');
                } else {
                    navigation.goTo('server-select', { allowAutoConnect: false });
                }
                break;
            }
            case 'play':
                {
                    const playRequest = this.deps.playback.playFromRemote();
                    if (!playRequest) {
                        break;
                    }
                    const playPromise = this.fireAndReport(
                        'remote_play',
                        () => playRequest,
                        '[Navigation] remote_play failed:',
                        'Unable to start playback'
                    );
                    void playPromise?.then(
                        () => {
                            this.deps.playback.requestPlayerOsdIntent({ type: 'poke', reason: 'play' });
                        },
                        () => undefined
                    );
                }
                break;
            case 'pause':
                if (this.deps.playback.pauseFromRemote()) {
                    this.deps.playback.requestPlayerOsdIntent({ type: 'poke', reason: 'pause' });
                }
                break;
            case 'rewind': {
                const deltaMs = -this.deps.playback.getSeekIncrementMs();
                const seekRequest = this.deps.playback.seekFromRemote(deltaMs);
                if (!seekRequest) {
                    break;
                }
                void this.observeNonBlockingPromise(
                    'seek',
                    () => seekRequest,
                    '[Navigation] seek failed:'
                );
                this.deps.playback.requestPlayerOsdIntent({ type: 'poke', reason: 'seek' });
                break;
            }
            case 'fastforward': {
                const deltaMs = this.deps.playback.getSeekIncrementMs();
                const seekRequest = this.deps.playback.seekFromRemote(deltaMs);
                if (!seekRequest) {
                    break;
                }
                void this.observeNonBlockingPromise(
                    'seek',
                    () => seekRequest,
                    '[Navigation] seek failed:'
                );
                this.deps.playback.requestPlayerOsdIntent({ type: 'poke', reason: 'seek' });
                break;
            }
            case 'stop':
                this.deps.playback.stopPlayback();
                break;
            // Other keys handled by active screen.
        }
    }

    private _consumeKeyEvent(event: KeyEvent): void {
        event.handled = true;
        event.originalEvent.preventDefault();
    }

    private _isDirectionalButton(button: KeyEvent['button']): button is NavigationFourWayDirection {
        return button === 'up' || button === 'down' || button === 'left' || button === 'right';
    }
}
