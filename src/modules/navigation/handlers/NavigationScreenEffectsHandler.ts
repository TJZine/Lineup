import type {
    NavigationRepeatRuntime,
    NavigationScreenEffectsRuntime,
} from '../contracts/NavigationHandlerContracts';
import type {
    NavigationChannelSwitchingPort,
    NavigationEpgPort,
    NavigationMiniGuidePort,
    NavigationNowPlayingInfoPort,
    NavigationPlaybackPort,
} from '../contracts/NavigationFeaturePorts';
import type { INavigationManager, Screen } from '../contracts/interfaces';
import type { NavigationFireAndReport } from '../coordinator/NavigationCoordinatorRuntimeServices';

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

        // Hide EPG on every non-player/non-guide screen to prevent overlay bleed.
        // The guide exit path above handles guide-originated transitions once.
        if (from !== 'guide' && to !== 'player' && to !== 'guide') {
            epg?.hide();
        }

        // Pause playback when leaving player for settings/channel-edit.
        if (from === 'player' && (to === 'settings' || to === 'channel-edit')) {
            if (!this.deps.readKeepPlayingInSettings()) {
                this.deps.playback.pauseForScreenChange();
            }
        }

        // Resume playback when returning to player.
        if (to === 'player' && from !== 'player') {
            const resumeRequest = this.deps.playback.resumeForScreenChange();
            if (resumeRequest) {
                this.fireAndReport(
                    'resume_play',
                    () => resumeRequest,
                    '[Navigation] resume_play failed:',
                    'Playback failed to resume'
                );
            }
        }
    }
}
