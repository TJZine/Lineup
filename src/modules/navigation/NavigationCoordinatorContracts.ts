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

export interface NavigationCoordinatorEventPort {
    navigation: INavigationManager;
    miniGuide: NavigationMiniGuidePort;
    channelSwitching: NavigationChannelSwitchingPort;
    reportRecoverableAsyncFailure: NavigationAsyncFailureReporter;
    reportToast?: (toast: ToastInput) => void;
    readDebugLoggingEnabled: () => boolean;
    logDebug?: (event: string, payload: Record<string, unknown>) => void;
}
