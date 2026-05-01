import type {
    INavigationManager,
    NavigationAsyncFailureReporter,
} from './interfaces';
import type { ToastInput } from '../../shared/toast';
import type {
    NavigationChannelSwitchingPort,
    NavigationMiniGuidePort,
} from './NavigationFeaturePorts';

export interface NavigationCoordinatorEventPort {
    navigation: INavigationManager;
    miniGuide: NavigationMiniGuidePort;
    channelSwitching: NavigationChannelSwitchingPort;
    reportRecoverableAsyncFailure: NavigationAsyncFailureReporter;
    reportToast?: (toast: ToastInput) => void;
    readDebugLoggingEnabled: () => boolean;
    logDebug?: (event: string, payload: Record<string, unknown>) => void;
}
