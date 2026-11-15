import type { ChannelSwitchOutcome } from '../../../types/channelSwitch';
import type { Direction } from './interfaces';

export type NavigationPlaybackOptionsSectionId = 'audio' | 'subtitles';
export type NavigationChannelSwitchOutcome = ChannelSwitchOutcome;

export interface NavigationEpgPort {
    isVisible: () => boolean;
    handleNavigation: (direction: NavigationFourWayDirection) => boolean;
    handlePage: (direction: NavigationVerticalDirection) => boolean;
    handleSelect: () => boolean;
    handleBack: () => boolean;
    focusNow: () => void;
    openLineupMenu: () => void;
}

export type NavigationPlayerOsdIntent =
    | { type: 'poke'; reason: 'play' | 'pause' | 'seek' }
    | { type: 'reveal' | 'down' | 'toggleExpanded' | 'back' | 'hide' };

export interface NavigationPlaybackPort {
    isAuthenticatedForServerSelection: () => boolean;
    playFromRemote: () => Promise<void> | null;
    pauseFromRemote: () => boolean;
    seekFromRemote: (deltaMs: number) => Promise<void> | null;
    pauseForScreenChange: () => boolean;
    resumeForScreenChange: () => Promise<void> | null;
    stopPlayback: () => void;
    getSeekIncrementMs: () => number;
    isPlayerOsdVisible: () => boolean;
    isPlayerTransportContext: () => boolean;
    requestPlayerOsdIntent: (intent: NavigationPlayerOsdIntent) => boolean;
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

export type NavigationFourWayDirection = Direction;
export type NavigationVerticalDirection = Extract<Direction, 'up' | 'down'>;
