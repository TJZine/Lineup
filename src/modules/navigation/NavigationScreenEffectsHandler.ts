import type {
    NavigationRepeatRuntime,
    NavigationScreenEffectsRuntime,
} from './NavigationHandlerContracts';
import type {
    NavigationChannelSwitchingPort,
    NavigationEpgPort,
    NavigationMiniGuidePort,
    NavigationNowPlayingInfoPort,
    NavigationPlaybackPort,
} from './NavigationFeaturePorts';
import type { INavigationManager, Screen } from './interfaces';
import type { NavigationFireAndReport } from './NavigationCoordinatorRuntimeServices';

export interface NavigationUiGuardsPort {
    shouldRunChannelSetup: () => boolean;
    hideChannelTransition: () => void;
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

export class NavigationScreenEffectsHandler implements NavigationScreenEffectsRuntime {
    constructor(
        private readonly deps: NavigationScreenEffectsPort,
        private readonly repeats: NavigationRepeatRuntime,
        private readonly fireAndReport: NavigationFireAndReport
    ) { }

    handleScreenChange(from: Screen, to: Screen): void {
        this.repeats.stopEpgRepeat('screenChange');
        this.repeats.stopMiniGuideRepeat('screenChange');
        const epg = this.deps.epg;
        const videoPlayer = this.deps.playback.videoPlayer;
        const navigation = this.deps.navigation;

        // Hide EPG when leaving guide.
        if (from === 'guide' && to !== 'guide') {
            epg?.hide();
        }

        if (to === 'player' && this.deps.uiGuards.shouldRunChannelSetup()) {
            this.deps.navigation.replaceScreen('channel-setup');
            return;
        }

        // Close Now Playing Info overlay when leaving player.
        if (from === 'player' && to !== 'player') {
            if (navigation.isModalOpen(this.deps.nowPlayingInfo.modalId)) {
                navigation.closeModal(this.deps.nowPlayingInfo.modalId);
            }
            this.deps.miniGuide.requestMiniGuideIntent({ type: 'hide' });
            this.deps.playback.requestPlayerOsdIntent({ type: 'hide' });
            this.deps.uiGuards.hideChannelTransition();
        }

        // Show EPG when entering guide.
        if (to === 'guide') {
            if (epg && !epg.isVisible()) {
                this.deps.channelSwitching.toggleEpg();
            }
        }

        // Hide EPG when entering settings to prevent overlay bleed.
        if (to === 'settings') {
            epg?.hide();
        }

        // Pause playback when leaving player for settings/channel-edit.
        if (from === 'player' && (to === 'settings' || to === 'channel-edit')) {
            if (!this.deps.readKeepPlayingInSettings()) {
                videoPlayer?.pause();
            }
        }

        // Resume playback when returning to player.
        if (to === 'player' && from !== 'player') {
            if (videoPlayer) {
                this.fireAndReport(
                    'resume_play',
                    () => videoPlayer.play(),
                    '[Navigation] resume_play failed:',
                    'Playback failed to resume'
                );
            }
        }
    }
}
