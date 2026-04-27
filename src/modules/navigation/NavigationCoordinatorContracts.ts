import type {
    Direction,
    INavigationManager,
    KeyEvent,
    NavigationAsyncFailureReporter,
    Screen,
} from './interfaces';
import type { ToastInput } from '../ui/toast/types';

export type NavigationPlaybackOptionsSectionId = 'subtitles' | 'audio';
export type NavigationChannelSwitchOutcome = 'switched' | 'aborted' | 'failed';
export type NavigationFourWayDirection = Direction;
export type NavigationVerticalDirection = Extract<Direction, 'up' | 'down'>;

export interface NavigationEpgPort {
    isVisible: () => boolean;
    handleNavigation: (direction: NavigationFourWayDirection) => boolean;
    handlePage: (direction: NavigationVerticalDirection) => boolean;
    handleSelect: () => boolean;
    handleBack: () => boolean;
    focusNow: () => void;
    hide: () => void;
}

export interface NavigationVideoPlayerPort {
    play: () => Promise<void>;
    pause: () => void;
    seekRelative: (deltaMs: number) => Promise<void>;
}

export interface NavigationAuthPort {
    isAuthenticated: () => boolean;
}

export interface NavigationPlaybackPort {
    videoPlayer: NavigationVideoPlayerPort | null;
    plexAuth: NavigationAuthPort | null;
    stopPlayback: () => void;
    getSeekIncrementMs: () => number;
    playerOsd: {
        overlay: { isVisible: () => boolean } | null;
        coordinator: {
            poke: (reason: 'play' | 'pause' | 'seek') => void;
            toggle: () => void;
            hide: () => void;
        } | null;
    };
}

export interface NavigationMiniGuidePort {
    overlay: { isVisible: () => boolean } | null;
    coordinator: {
        show: () => void;
        hide: () => void;
        handleNavigation: (direction: NavigationVerticalDirection) => boolean;
        handlePage: (direction: NavigationVerticalDirection) => boolean;
        handleSelect: () => void;
    } | null;
}

export interface NavigationNowPlayingInfoPort {
    modalId: string;
    isModalOpen: () => boolean;
    resetAutoHideTimer: () => void;
    toggleOverlay: () => void;
    showOverlay: () => void;
    hideOverlay: () => void;
}

export interface NavigationModalsPort {
    playbackOptions: {
        modalId: string;
        prepare: (
            preferredSection?: NavigationPlaybackOptionsSectionId
        ) => { focusableIds: string[]; preferredFocusId: string | null };
        show: () => void;
        hide: () => void;
    };
    exitConfirm: {
        modalId: string;
        prepare: () => { focusableIds: string[] };
        show: () => void;
        hide: () => void;
    };
}

export interface NavigationChannelSwitchingPort {
    setLastChannelChangeSourceRemote: () => void;
    setLastChannelChangeSourceNumber: () => void;
    switchToNextChannel: () => void;
    switchToPreviousChannel: () => void;
    switchToChannelByNumber: (n: number) => Promise<NavigationChannelSwitchOutcome>;
    focusEpgOnCurrentChannel: () => void;
    toggleEpg: () => void;
    onChannelInputUpdate?: (payload: { digits: string; isComplete: boolean }) => void;
}

export interface NavigationUiGuardsPort {
    shouldRunChannelSetup: () => boolean;
    hideChannelTransition: () => void;
}

export interface NavigationRepeatRuntime {
    stopForKeyUp(button: KeyEvent['button']): void;
    stopForNonDirectionalInput(event: KeyEvent): void;
    stopEpgRepeat(reason: string): void;
    startEpgRepeat(button: NavigationFourWayDirection): void;
    stopEpgRepeatForDirectionChange(button: NavigationFourWayDirection): void;
    stopMiniGuideRepeat(reason: string): void;
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

export interface NavigationCoordinatorHandlerCallbacks {
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

export type NavigationCoordinatorHandlerFactory = (
    callbacks: NavigationCoordinatorHandlerCallbacks
) => NavigationCoordinatorHandlers;

export interface NavigationCoordinatorEventPort {
    navigation: INavigationManager;
    miniGuide: NavigationMiniGuidePort;
    channelSwitching: NavigationChannelSwitchingPort;
    reportRecoverableAsyncFailure: NavigationAsyncFailureReporter;
    reportToast?: (toast: ToastInput) => void;
    readDebugLoggingEnabled: () => boolean;
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
    createHandlers: NavigationCoordinatorHandlerFactory;
}
