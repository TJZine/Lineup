import type {
    KeyEvent,
    NavigationEventMap,
} from './interfaces';
import type { NavigationCoordinatorEventPort } from './NavigationCoordinatorEventPort';
import type { NavigationCoordinatorRuntimeServices } from './NavigationCoordinatorRuntimeServices';
import type {
    NavigationChannelNumberHandlerRuntime,
    NavigationKeyModeRouterRuntime,
    NavigationModalEffectsRuntime,
    NavigationRepeatRuntime,
    NavigationScreenEffectsRuntime,
} from './NavigationHandlerContracts';

export interface NavigationCoordinatorHandlers {
    repeats: NavigationRepeatRuntime;
    keyModeRouter: NavigationKeyModeRouterRuntime;
    screenEffects: NavigationScreenEffectsRuntime;
    modalEffects: NavigationModalEffectsRuntime;
    channelNumber: NavigationChannelNumberHandlerRuntime;
}

export interface NavigationGuideMiniGuideEvents {
    hideForGuideToggle(): void;
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
    guideMiniGuide: NavigationGuideMiniGuideEvents;
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
        const subscribe = <K extends keyof NavigationEventMap>(
            event: K,
            handler: (payload: NavigationEventMap[K]) => void
        ): void => {
            const disposable = navigation.on(event, handler);
            unsubs.push(() => disposable.dispose());
        };

        navigation.handleLongPress('back', () => this._keyModeRouter.handleLongPressBack());

        const keyHandler = (event: KeyEvent): void => {
            this._keyModeRouter.handleKeyPress(event);
        };
        subscribe('keyPress', keyHandler);

        const keyUpHandler = (payload: { button: KeyEvent['button'] }): void => {
            this._repeats.stopForKeyUp(payload.button);
        };
        subscribe('keyUp', keyUpHandler);

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
        subscribe('channelNumberEntered', channelNumberHandler);

        const inputUpdateHandler = (payload: { digits: string; isComplete: boolean }): void => {
            this.deps.events.channelSwitching.onChannelInputUpdate?.(payload);
        };
        subscribe('channelInputUpdate', inputUpdateHandler);

        const guideHandler = (): void => {
            // EPG is an overlay, not a navigation screen; toggle based on EPG visibility.
            this._repeats.stopEpgRepeat('guide');
            this._repeats.stopMiniGuideRepeat('guide');
            this.deps.guideMiniGuide.hideForGuideToggle();
            this.deps.events.channelSwitching.toggleEpg();
        };
        subscribe('guide', guideHandler);

        const settingsHandler = (): void => {
            const currentScreen = navigation.getCurrentScreen();
            if (currentScreen === 'player' || currentScreen === 'guide') {
                navigation.goTo('settings');
            }
        };
        subscribe('settings', settingsHandler);

        const screenHandler = (payload: NavigationEventMap['screenChange']): void => {
            this._screenEffects.handleScreenChange(payload.from, payload.to);
        };
        subscribe('screenChange', screenHandler);

        const modalOpenHandler = (payload: { modalId: string }): void => {
            this._modalEffects.handleModalOpen(payload.modalId);
        };
        const modalCloseHandler = (payload: { modalId: string }): void => {
            this._modalEffects.handleModalClose(payload.modalId);
        };
        const modalOpenDisposable = navigation.on('modalOpen', modalOpenHandler);
        const modalCloseDisposable = navigation.on('modalClose', modalCloseHandler);
        unsubs.push(() => {
            modalOpenDisposable.dispose();
            modalCloseDisposable.dispose();
        });

        return unsubs;
    }
}
