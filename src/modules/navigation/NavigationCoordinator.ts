import type {
    KeyEvent,
    NavigationEventMap,
} from './interfaces';
import { recordNonBlockingFailureTimestamp } from './nonBlockingFailureTimestamps';
import type {
    NavigationChannelNumberHandlerRuntime,
    NavigationCoordinatorDeps,
    NavigationCoordinatorHandlers,
    NavigationKeyModeRouterRuntime,
    NavigationModalEffectsRuntime,
    NavigationRepeatRuntime,
    NavigationScreenEffectsRuntime,
} from './NavigationCoordinatorContracts';

export class NavigationCoordinator {
    private readonly _repeats: NavigationRepeatRuntime;
    private readonly _keyModeRouter: NavigationKeyModeRouterRuntime;
    private readonly _screenEffects: NavigationScreenEffectsRuntime;
    private readonly _modalEffects: NavigationModalEffectsRuntime;
    private readonly _channelNumberHandler: NavigationChannelNumberHandlerRuntime;
    private _suppressedLogTimestamps: Map<string, number> = new Map();
    private _nonBlockingFailureTimestamps: Map<string, number> = new Map();

    constructor(private readonly deps: NavigationCoordinatorDeps) {
        const handlers: NavigationCoordinatorHandlers = deps.createHandlers({
            fireAndReport: (key, promiseFactory, message, toastMessage) => this._fireAndReport(
                key,
                promiseFactory,
                message,
                toastMessage
            ),
            observeNonBlockingPromise: (key, promiseFactory, message) => this._observeNonBlockingPromise(
                key,
                promiseFactory,
                message
            ),
            logInputNotHandled: (reason, event) => this._logInputNotHandled(reason, event),
        });
        this._repeats = handlers.repeats;
        this._keyModeRouter = handlers.keyModeRouter;
        this._screenEffects = handlers.screenEffects;
        this._modalEffects = handlers.modalEffects;
        this._channelNumberHandler = handlers.channelNumber;
    }

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
            this.deps.events.reportRecoverableAsyncFailure(event, message, error);
        } catch {
            // Diagnostics are best-effort in non-blocking failure paths.
        }
        if (toastMessage) {
            try {
                this.deps.events.reportToast?.({ message: toastMessage, type: 'warning' });
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
            this._fireAndReport(
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

    private _isDebugLoggingEnabled(): boolean {
        return this.deps.events.readDebugLoggingEnabled();
    }

    private _logInputNotHandled(
        reason: 'modal_open' | 'screen_not_player' | 'input_blocked',
        event: KeyEvent
    ): void {
        if (!this._isDebugLoggingEnabled()) return;
        const navigation = this.deps.events.navigation;
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
