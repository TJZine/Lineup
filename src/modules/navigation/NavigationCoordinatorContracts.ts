import type {
    Direction,
    INavigationManager,
    NavigationAsyncFailureReporter,
} from './interfaces';
import type { ToastInput } from '../ui/toast/types';
import type {
    NavigationChannelSwitchingPort,
    NavigationFourWayDirection,
    NavigationMiniGuidePort,
    NavigationVerticalDirection,
} from './NavigationFeaturePorts';
import type { NavigationChannelNumberHandlerRuntime } from './NavigationChannelNumberHandler';
import type { NavigationCoordinatorRuntimeServices } from './NavigationCoordinatorRuntimeServices';
import type { NavigationKeyModeRouterRuntime } from './NavigationKeyModeRouter';
import type { NavigationModalEffectsRuntime } from './NavigationModalEffectsHandler';
import type { NavigationRepeatRuntime } from './NavigationRepeatHandler';
import type { NavigationScreenEffectsRuntime } from './NavigationScreenEffectsHandler';

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
