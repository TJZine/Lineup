import type { ChannelSwitchOutcome } from '../../../types/channelSwitch';

export type NavigationPlaybackOptionsSectionId = 'subtitles' | 'audio';
export type NavigationChannelSwitchOutcome = ChannelSwitchOutcome;

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

export type NavigationPlayerOsdIntent =
    | { type: 'poke'; reason: 'play' | 'pause' | 'seek' }
    | { type: 'toggle' }
    | { type: 'hide' };

export interface NavigationPlaybackPort {
    videoPlayer: NavigationVideoPlayerPort | null;
    plexAuth: NavigationAuthPort | null;
    stopPlayback: () => void;
    getSeekIncrementMs: () => number;
    isPlayerOsdVisible: () => boolean;
    requestPlayerOsdIntent: (intent: NavigationPlayerOsdIntent) => void;
}

export type NavigationMiniGuideIntent =
    | { type: 'show' }
    | { type: 'hide' }
    | { type: 'navigate'; direction: NavigationVerticalDirection }
    | { type: 'page'; direction: NavigationVerticalDirection }
    | { type: 'select' };

export interface NavigationMiniGuidePort {
    isVisible: () => boolean;
    requestMiniGuideIntent: (intent: NavigationMiniGuideIntent) => boolean;
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
