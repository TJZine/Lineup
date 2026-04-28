export type NavigationPlaybackOptionsSectionId = 'subtitles' | 'audio';
export type NavigationChannelSwitchOutcome = 'switched' | 'aborted' | 'failed';

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

export type NavigationFourWayDirection = 'up' | 'down' | 'left' | 'right';
export type NavigationVerticalDirection = 'up' | 'down';
