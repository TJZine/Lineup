import type {
    INavigationManager,
    NavigationAsyncFailureReporter,
} from './interfaces';
import type { IEPGComponent } from '../ui/epg';
import type { IVideoPlayer } from '../player';
import type { IPlexAuth } from '../plex/auth';
import type { PlaybackOptionsSectionId } from '../ui/playback-options';
import type { ChannelSwitchOutcome } from '../../types/channelSwitch';

export interface NavigationCoordinatorDeps {
    navigation: INavigationManager;
    epg: IEPGComponent | null;
    playback: {
        videoPlayer: IVideoPlayer | null;
        plexAuth: IPlexAuth | null;
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
                preferredSection?: PlaybackOptionsSectionId
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
        switchToChannelByNumber: (n: number) => Promise<ChannelSwitchOutcome>;
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
