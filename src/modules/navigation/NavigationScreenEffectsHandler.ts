import { NOW_PLAYING_INFO_MODAL_ID } from '../ui/now-playing-info';
import type { NavigationCoordinatorDeps } from './NavigationCoordinatorDeps';
import type { NavigationRepeatHandler } from './NavigationRepeatHandler';
import type { NavigationFireAndReport } from './NavigationKeyModeRouter';
import type { Screen } from './interfaces';

export class NavigationScreenEffectsHandler {
    constructor(
        private readonly deps: NavigationCoordinatorDeps,
        private readonly repeats: NavigationRepeatHandler,
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
            if (navigation.isModalOpen(NOW_PLAYING_INFO_MODAL_ID)) {
                navigation.closeModal(NOW_PLAYING_INFO_MODAL_ID);
            }
            this.deps.miniGuide.coordinator?.hide();
            this.deps.playback.playerOsd.coordinator?.hide();
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
