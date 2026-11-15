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
    NavigationPlaybackPort,
} from '../contracts/NavigationFeaturePorts';

export interface NavigationKeyModeRouterPort {
    navigation: INavigationManager;
    epg: NavigationEpgPort | null;
    closeEpg: () => void;
    playback: NavigationPlaybackPort;
    miniGuide: NavigationMiniGuidePort;
    channelSwitching: NavigationChannelSwitchingPort;
}

type KeyPressRoutingState = {
    currentScreen: Screen;
    modalOpen: boolean;
    miniGuideVisible: boolean;
    shouldRouteToEpg: boolean;
};

export class NavigationKeyModeRouter implements NavigationKeyModeRouterRuntime {
    private _latestTransportCommand = 0;

    constructor(
        private readonly deps: NavigationKeyModeRouterPort,
        private readonly repeats: NavigationRepeatRuntime,
        private readonly fireAndReport: NavigationFireAndReport,
        private readonly observeNonBlockingPromise: NavigationObserveNonBlockingPromise,
        private readonly logInputNotHandled: NavigationLogInputNotHandled
    ) { }

    handleLongPressBack(): void {
        // Long Back belongs to the webOS system.
    }

    handleKeyPress(event: KeyEvent): void {
        this.repeats.stopForNonDirectionalInput(event);
        if (this._isTransportButton(event.button)) this._latestTransportCommand += 1;

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

    private _getKeyPressRoutingState(): KeyPressRoutingState {
        const epg = this.deps.epg;
        const navigation = this.deps.navigation;
        const modalOpen = navigation.isModalOpen();
        const currentScreen = navigation.getCurrentScreen();
        const miniGuideVisible = this.deps.miniGuide.isVisible();
        return {
            currentScreen,
            modalOpen,
            miniGuideVisible,
            shouldRouteToEpg:
                !modalOpen &&
                (currentScreen === 'player' || currentScreen === 'guide') &&
                !!epg?.isVisible() &&
                !miniGuideVisible,
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
                if (epg.handleBack()) {
                    this._consumeKeyEvent(event);
                    return true;
                }
                return false;
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
                if (event.isRepeat) return true;
                this.deps.miniGuide.requestMiniGuideIntent({
                    type: 'page',
                    direction: event.button === 'channelUp' ? 'up' : 'down',
                });
                return true;
            case 'right':
                this._consumeKeyEvent(event);
                this.repeats.stopMiniGuideRepeat('right');
                this.deps.miniGuide.requestMiniGuideIntent({ type: 'hide' });
                this.deps.navigation.goTo('guide');
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
            this._consumeKeyEvent(event);
            if (!event.isRepeat) this.deps.playback.requestPlayerOsdIntent({ type: 'reveal' });
            return true;
        }

        if (event.button === 'down' && routingState.currentScreen === 'player'
            && !routingState.modalOpen && !routingState.shouldRouteToEpg
            && !routingState.miniGuideVisible && this.deps.playback.isPlayerOsdVisible()) {
            if (event.isRepeat) return false;
            if (this.deps.playback.requestPlayerOsdIntent({ type: 'down' })) {
                this._consumeKeyEvent(event);
                return true;
            }
            return false;
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
            if (!event.isRepeat) this.deps.playback.requestPlayerOsdIntent({ type: 'back' });
            this._consumeKeyEvent(event);
            return true;
        }

        navigation.goTo('guide');
        this._consumeKeyEvent(event);
        return true;
    }

    private _handleDefaultKeyPress(event: KeyEvent, routingState: KeyPressRoutingState): void {
        if (this._isTransportButton(event.button) && !this._canControlPlayback(routingState)) {
            this._consumeKeyEvent(event);
            return;
        }
        switch (event.button) {
            case 'red':
            case 'info':
                if (event.isRepeat) {
                    break;
                }
                if (routingState.currentScreen === 'player' && !routingState.modalOpen
                    && !routingState.shouldRouteToEpg && !routingState.miniGuideVisible) {
                    this.deps.playback.requestPlayerOsdIntent({ type: 'toggleExpanded' });
                    this._consumeKeyEvent(event);
                }
                break;
            case 'blue':
                if (!event.isRepeat && !routingState.modalOpen
                    && (routingState.currentScreen === 'player' || routingState.currentScreen === 'guide')) {
                    if (routingState.currentScreen === 'player') this.deps.navigation.goTo('guide');
                    this.deps.epg?.openLineupMenu();
                    this._consumeKeyEvent(event);
                }
                break;
            case 'channelUp':
                if (
                    routingState.currentScreen === 'player'
                    && !routingState.modalOpen
                    && !routingState.shouldRouteToEpg && !event.isRepeat
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
                    && !routingState.shouldRouteToEpg && !event.isRepeat
                ) {
                    this.deps.channelSwitching.setLastChannelChangeSourceRemote();
                    // Treat channel-down as increment (forward wrap) to match user expectation.
                    this.deps.channelSwitching.switchToNextChannel();
                }
                break;
            case 'play':
                {
                    const command = this._latestTransportCommand;
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
                            if (command !== this._latestTransportCommand
                                || !this._canControlPlayback(this._getKeyPressRoutingState())) return;
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

    private _canControlPlayback(state: KeyPressRoutingState): boolean {
        return state.currentScreen === 'player' && !state.modalOpen && !state.miniGuideVisible
            && !state.shouldRouteToEpg && !this.deps.navigation.isInputBlocked()
            && this.deps.playback.isPlayerTransportContext();
    }

    private _isTransportButton(button: KeyEvent['button']): boolean {
        return button === 'play' || button === 'pause' || button === 'rewind'
            || button === 'fastforward' || button === 'stop';
    }

    private _isDirectionalButton(button: KeyEvent['button']): button is NavigationFourWayDirection {
        return button === 'up' || button === 'down' || button === 'left' || button === 'right';
    }
}
