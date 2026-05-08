import type {
    INavigationManager,
    NavigationAsyncFailureReporter,
} from '../contracts/interfaces';
import type { ToastInput } from '../../../shared/toast';
import type {
    NavigationChannelSwitchingPort,
    NavigationMiniGuidePort,
} from '../contracts/NavigationFeaturePorts';

export interface NavigationCoordinatorEventPort {
    navigation: INavigationManager;
    miniGuide: NavigationMiniGuidePort;
    channelSwitching: NavigationChannelSwitchingPort;
    reportRecoverableAsyncFailure: NavigationAsyncFailureReporter;
    reportToast?: (toast: ToastInput) => void;
    readDebugLoggingEnabled: () => boolean;
    logDebug?: (event: string, payload: Record<string, unknown>) => void;
}
