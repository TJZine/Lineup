import type {
    Direction,
    INavigationManager,
    KeyEvent,
    NavigationAsyncFailureReporter,
    Screen,
} from './interfaces';
import type { ToastInput } from '../ui/toast/types';
import type {
    NavigationChannelSwitchingPort,
    NavigationFourWayDirection,
    NavigationMiniGuidePort,
    NavigationVerticalDirection,
} from './NavigationFeaturePorts';

type IsExactType<Actual, Expected> =
    [Actual] extends [Expected]
        ? ([Expected] extends [Actual] ? true : false)
        : false;

type AssertTrue<T extends true> = T;

export type NavigationDirectionContractCheck = AssertTrue<
    IsExactType<Direction, NavigationFourWayDirection>
>;
export type NavigationVerticalDirectionContractCheck = AssertTrue<
    IsExactType<Extract<Direction, NavigationVerticalDirection>, NavigationVerticalDirection>
>;

export type NavigationRepeatStopReason =
    | 'inputBlocked'
    | 'keyup'
    | 'nonDirectional'
    | 'directionChange'
    | 'restart'
    | 'notVisible'
    | 'modalOpen'
    | 'noButton'
    | 'blocked'
    | 'guide'
    | 'screenChange'
    | 'ok'
    | 'back';

export type EpgStopReason =
    | NavigationRepeatStopReason
    | 'play'
    | 'channelPage';

export type MiniGuideStopReason =
    | NavigationRepeatStopReason
    | 'page'
    | 'right'
    | 'notPlayer';

export interface NavigationRepeatRuntime {
    stopForKeyUp(button: KeyEvent['button']): void;
    stopForNonDirectionalInput(event: KeyEvent): void;
    stopEpgRepeat(reason: EpgStopReason): void;
    startEpgRepeat(button: NavigationFourWayDirection): void;
    stopEpgRepeatForDirectionChange(button: NavigationFourWayDirection): void;
    stopMiniGuideRepeat(reason: MiniGuideStopReason): void;
    startMiniGuideRepeat(button: NavigationVerticalDirection): void;
    stopMiniGuideRepeatForDirectionChange(button: NavigationVerticalDirection): void;
    hasMiniGuideRepeatButton(): boolean;
}

export interface NavigationKeyModeRouterRuntime {
    handleLongPressBack(): void;
    handleKeyPress(event: KeyEvent): void;
}

export interface NavigationScreenEffectsRuntime {
    handleScreenChange(from: Screen, to: Screen): void;
}

export interface NavigationModalEffectsRuntime {
    handleModalOpen(modalId: string): void;
    handleModalClose(modalId: string): void;
}

export interface NavigationChannelNumberHandlerRuntime {
    handleChannelNumberEntered(channelNumber: number): Promise<void>;
}

export interface NavigationCoordinatorRuntimeServices {
    fireAndReport: (
        key: string,
        promiseFactory: () => Promise<void>,
        message: string,
        toastMessage: string
    ) => Promise<void> | null;
    observeNonBlockingPromise: (
        key: string,
        promiseFactory: () => Promise<void>,
        message: string
    ) => Promise<void>;
    logInputNotHandled: (
        reason: 'modal_open' | 'screen_not_player' | 'input_blocked',
        event: KeyEvent
    ) => void;
}

export interface NavigationCoordinatorHandlers {
    repeats: NavigationRepeatRuntime;
    keyModeRouter: NavigationKeyModeRouterRuntime;
    screenEffects: NavigationScreenEffectsRuntime;
    modalEffects: NavigationModalEffectsRuntime;
    channelNumber: NavigationChannelNumberHandlerRuntime;
}

export interface NavigationCoordinatorEventPort {
    navigation: INavigationManager;
    miniGuide: NavigationMiniGuidePort;
    channelSwitching: NavigationChannelSwitchingPort;
    reportRecoverableAsyncFailure: NavigationAsyncFailureReporter;
    reportToast?: (toast: ToastInput) => void;
    readDebugLoggingEnabled: () => boolean;
    logDebug?: (event: string, payload: Record<string, unknown>) => void;
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
