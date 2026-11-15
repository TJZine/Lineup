import type {
    NavigationRepeatRuntime,
    NavigationScreenEffectsRuntime,
} from '../contracts/NavigationHandlerContracts';
import type {
    NavigationChannelSwitchingPort,
    NavigationEpgPort,
    NavigationMiniGuidePort,
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
    closeEpg: () => void;
    playback: NavigationPlaybackPort;
    miniGuide: NavigationMiniGuidePort;
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

        // Hide EPG when leaving guide.
        if (from === 'guide' && to !== 'guide') {
            this.deps.closeEpg();
        }

        if (to === 'player' && this.deps.uiGuards.shouldRunChannelSetup()) {
            this.deps.navigation.replaceScreen('channel-setup');
            return;
        }

        if (from === 'player' && to !== 'player') {
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
            this.deps.closeEpg();
        }

        // The route block belongs to the destination lifetime, including Guide PiP.
        const authoringOrSettings = (screen: Screen): boolean =>
            screen === 'settings' || screen === 'channels' || screen === 'channel-studio';
        if (authoringOrSettings(to) && !authoringOrSettings(from)) {
            if (!this.deps.readKeepPlayingInSettings()) {
                this.deps.playback.pauseForScreenChange();
            }
        }

        // Intermediate setup, account, and server routes must not uncover retained playback.
        // The route hold is independent of lifecycle holds and explicit playback intent.
        if ((to === 'guide' || to === 'player') && from !== to) {
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
