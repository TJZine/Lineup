import type {
    KeyEvent,
    NavigationEventMap,
} from './interfaces';
import type { NavigationCoordinatorEventPort } from './NavigationCoordinatorEventPort';
import type { NavigationChannelNumberHandlerRuntime } from './NavigationChannelNumberHandler';
import type { NavigationCoordinatorRuntimeServices } from './NavigationCoordinatorRuntimeServices';
import type { NavigationKeyModeRouterRuntime } from './NavigationKeyModeRouter';
import type { NavigationModalEffectsRuntime } from './NavigationModalEffectsHandler';
import type { NavigationRepeatRuntime } from './NavigationRepeatHandler';
import type { NavigationScreenEffectsRuntime } from './NavigationScreenEffectsHandler';

export interface NavigationCoordinatorHandlers {
    repeats: NavigationRepeatRuntime;
    keyModeRouter: NavigationKeyModeRouterRuntime;
    screenEffects: NavigationScreenEffectsRuntime;
    modalEffects: NavigationModalEffectsRuntime;
    channelNumber: NavigationChannelNumberHandlerRuntime;
}

/**
 * Ports referenced by multiple dependency groups must point at the same runtime
 * instances. For example, orchestrator wiring should pass one shared
 * NavigationMiniGuidePort, NavigationChannelSwitchingPort, INavigationManager,
 * and NavigationEpgPort anywhere those ports appear so handlers operate on the
 * same navigation state.
 */
export interface NavigationCoordinatorDeps {
    events: NavigationCoordinatorEventPort;
    handlers: NavigationCoordinatorHandlers;
    runtime: NavigationCoordinatorRuntimeServices;
}

export class NavigationCoordinator {
    private readonly _repeats: NavigationRepeatRuntime;
    private readonly _keyModeRouter: NavigationKeyModeRouterRuntime;
    private readonly _screenEffects: NavigationScreenEffectsRuntime;
    private readonly _modalEffects: NavigationModalEffectsRuntime;
    private readonly _channelNumberHandler: NavigationChannelNumberHandlerRuntime;

    constructor(private readonly deps: NavigationCoordinatorDeps) {
        const handlers = deps.handlers;
        this._repeats = handlers.repeats;
        this._keyModeRouter = handlers.keyModeRouter;
        this._screenEffects = handlers.screenEffects;
        this._modalEffects = handlers.modalEffects;
        this._channelNumberHandler = handlers.channelNumber;
    }

    wireNavigationEvents(): Array<() => void> {
        const navigation = this.deps.events.navigation;

        const unsubs: Array<() => void> = [];

        navigation.handleLongPress('back', () => this._keyModeRouter.handleLongPressBack());

        const keyHandler = (event: KeyEvent): void => {
            this._keyModeRouter.handleKeyPress(event);
        };
        navigation.on('keyPress', keyHandler);
        unsubs.push(() => {
            navigation.off('keyPress', keyHandler);
        });

        const keyUpHandler = (payload: { button: KeyEvent['button'] }): void => {
            this._repeats.stopForKeyUp(payload.button);
        };
        navigation.on('keyUp', keyUpHandler);
        unsubs.push(() => {
            navigation.off('keyUp', keyUpHandler);
        });

        const channelNumberHandler = (payload: { channelNumber: number }): void => {
            if (!Number.isFinite(payload.channelNumber)) {
                return;
            }
            this.deps.runtime.fireAndReport(
                'channel-number',
                () => this._channelNumberHandler.handleChannelNumberEntered(payload.channelNumber),
                '[Navigation] channel-number failed:',
                'Could not switch to that channel'
            );
        };
        navigation.on('channelNumberEntered', channelNumberHandler);
        unsubs.push(() => {
            navigation.off('channelNumberEntered', channelNumberHandler);
        });

        const inputUpdateHandler = (payload: { digits: string; isComplete: boolean }): void => {
            this.deps.events.channelSwitching.onChannelInputUpdate?.(payload);
        };
        navigation.on('channelInputUpdate', inputUpdateHandler);
        unsubs.push(() => {
            navigation.off('channelInputUpdate', inputUpdateHandler);
        });

        const guideHandler = (): void => {
            // EPG is an overlay, not a navigation screen; toggle based on EPG visibility.
            this._repeats.stopEpgRepeat('guide');
            this._repeats.stopMiniGuideRepeat('guide');
            this.deps.events.miniGuide.coordinator?.hide();
            this.deps.events.channelSwitching.toggleEpg();
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

        const screenHandler = (payload: NavigationEventMap['screenChange']): void => {
            this._screenEffects.handleScreenChange(payload.from, payload.to);
        };
        navigation.on('screenChange', screenHandler);
        unsubs.push(() => {
            navigation.off('screenChange', screenHandler);
        });

        const modalOpenHandler = (payload: { modalId: string }): void => {
            this._modalEffects.handleModalOpen(payload.modalId);
        };
        const modalCloseHandler = (payload: { modalId: string }): void => {
            this._modalEffects.handleModalClose(payload.modalId);
        };
        navigation.on('modalOpen', modalOpenHandler);
        navigation.on('modalClose', modalCloseHandler);
        unsubs.push(() => {
            navigation.off('modalOpen', modalOpenHandler);
            navigation.off('modalClose', modalCloseHandler);
        });

        return unsubs;
    }
}
