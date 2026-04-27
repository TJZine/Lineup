import type {
    INavigationManager,
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

export interface NavigationCoordinatorDeps {
    navigation: INavigationManager;
    epg: NavigationEpgPort | null;
    playback: {
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
    };
    miniGuide: {
        overlay: { isVisible: () => boolean } | null;
        coordinator: {
            show: () => void;
            hide: () => void;
            handleNavigation: (direction: 'up' | 'down') => boolean;
            handlePage: (direction: 'up' | 'down') => boolean;
            handleSelect: () => void;
        } | null;
    };
    nowPlayingInfo: {
        modalId: string;
        isModalOpen: () => boolean;
        resetAutoHideTimer: () => void;
        toggleOverlay: () => void;
        showOverlay: () => void;
        hideOverlay: () => void;
    };
    modals: {
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
    };
    channelSwitching: {
        setLastChannelChangeSourceRemote: () => void;
        setLastChannelChangeSourceNumber: () => void;
        switchToNextChannel: () => void;
        switchToPreviousChannel: () => void;
        switchToChannelByNumber: (n: number) => Promise<NavigationChannelSwitchOutcome>;
        focusEpgOnCurrentChannel: () => void;
        toggleEpg: () => void;
        onChannelInputUpdate?: (payload: { digits: string; isComplete: boolean }) => void;
    };
    uiGuards: {
        shouldRunChannelSetup: () => boolean;
        hideChannelTransition: () => void;
    };
    reportRecoverableAsyncFailure: NavigationAsyncFailureReporter;
    reportToast?: (toast: { message: string; type: 'warning' | 'error' | 'info' | 'success' }) => void;
    readKeepPlayingInSettings: () => boolean;
    readDebugLoggingEnabled: () => boolean;
}
