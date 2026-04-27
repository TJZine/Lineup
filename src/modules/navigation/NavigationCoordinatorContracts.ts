import type {
    INavigationManager,
    KeyEvent,
    NavigationAsyncFailureReporter,
} from './interfaces';

export type NavigationPlaybackOptionsSectionId = 'subtitles' | 'audio';
export type NavigationChannelSwitchOutcome = 'switched' | 'aborted' | 'failed';

export interface NavigationEpgPort {
    isVisible: () => boolean;
    handleNavigation: (direction: 'up' | 'down' | 'left' | 'right') => boolean;
    handlePage: (direction: 'up' | 'down') => boolean;
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
        handleNavigation: (direction: 'up' | 'down') => boolean;
        handlePage: (direction: 'up' | 'down') => boolean;
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
    startEpgRepeat(button: 'up' | 'down' | 'left' | 'right'): void;
    stopEpgRepeatForDirectionChange(button: 'up' | 'down' | 'left' | 'right'): void;
    stopMiniGuideRepeat(reason: string): void;
    startMiniGuideRepeat(button: 'up' | 'down'): void;
    stopMiniGuideRepeatForDirectionChange(button: 'up' | 'down'): void;
    hasMiniGuideRepeatButton(): boolean;
}

export type NavigationFireAndReport = (
    key: string,
    promiseFactory: () => Promise<void>,
    message: string,
    toastMessage: string
) => Promise<void> | null;

export type NavigationObserveNonBlockingPromise = (
    key: string,
    promiseFactory: () => Promise<void>,
    message: string
) => Promise<void>;

export type NavigationLogInputNotHandled = (
    reason: 'modal_open' | 'screen_not_player' | 'input_blocked',
    event: KeyEvent
) => void;

export interface NavigationCoordinatorEventPort {
    navigation: INavigationManager;
    miniGuide: NavigationMiniGuidePort;
    channelSwitching: NavigationChannelSwitchingPort;
    reportRecoverableAsyncFailure: NavigationAsyncFailureReporter;
    reportToast?: (toast: { message: string; type: 'warning' | 'error' | 'info' | 'success' }) => void;
    readDebugLoggingEnabled: () => boolean;
}

export interface NavigationRepeatHandlerPort {
    navigation: INavigationManager;
    epg: NavigationEpgPort | null;
    miniGuide: NavigationMiniGuidePort;
}

export interface NavigationKeyModeRouterPort {
    navigation: INavigationManager;
    epg: NavigationEpgPort | null;
    playback: NavigationPlaybackPort;
    miniGuide: NavigationMiniGuidePort;
    nowPlayingInfo: NavigationNowPlayingInfoPort;
    modals: NavigationModalsPort;
    channelSwitching: NavigationChannelSwitchingPort;
}

export interface NavigationScreenEffectsPort {
    navigation: INavigationManager;
    epg: NavigationEpgPort | null;
    playback: NavigationPlaybackPort;
    miniGuide: NavigationMiniGuidePort;
    nowPlayingInfo: NavigationNowPlayingInfoPort;
    channelSwitching: NavigationChannelSwitchingPort;
    uiGuards: NavigationUiGuardsPort;
    readKeepPlayingInSettings: () => boolean;
}

export interface NavigationModalEffectsPort {
    miniGuide: NavigationMiniGuidePort;
    nowPlayingInfo: NavigationNowPlayingInfoPort;
    modals: NavigationModalsPort;
}

export interface NavigationChannelNumberPort {
    epg: NavigationEpgPort | null;
    channelSwitching: NavigationChannelSwitchingPort;
}

export interface NavigationCoordinatorDeps {
    events: NavigationCoordinatorEventPort;
    repeats: NavigationRepeatHandlerPort;
    keyModeRouter: NavigationKeyModeRouterPort;
    screenEffects: NavigationScreenEffectsPort;
    modalEffects: NavigationModalEffectsPort;
    channelNumber: NavigationChannelNumberPort;
}
