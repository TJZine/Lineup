import { createAppOrchestratorConfig } from '../AppOrchestratorConfigFactory';
import { APP_SHELL_CONTAINER_IDS } from '../../../modules/ui/common/appShellContainerIds';
import { PLAYER_OSD_CONTAINER_ID } from '../../../modules/ui/player-osd';
import { CHANNEL_NUMBER_OVERLAY_CONTAINER_ID } from '../../../modules/ui/channel-number-overlay';
import { CHANNEL_BADGE_CONTAINER_ID } from '../../../modules/ui/channel-badge';
import { MINI_GUIDE_CONTAINER_ID } from '../../../modules/ui/mini-guide';
import { CHANNEL_TRANSITION_CONTAINER_ID } from '../../../modules/ui/channel-transition';
import { EPG_CONTAINER_ID } from '../../../modules/ui/epg';

describe('createAppOrchestratorConfig', () => {
    it('builds fresh config objects with the app-shell startup defaults', () => {
        const first = createAppOrchestratorConfig();
        const second = createAppOrchestratorConfig();

        expect(first).not.toBe(second);
        expect(first.navConfig).not.toBe(second.navConfig);
        expect(first.playerConfig).not.toBe(second.playerConfig);
        expect(first.epgConfig).not.toBe(second.epgConfig);
        expect(first.nowPlayingInfoConfig).not.toBe(second.nowPlayingInfoConfig);
        expect(first.playerOsdConfig).not.toBe(second.playerOsdConfig);
        expect(first.channelNumberOverlayConfig).not.toBe(second.channelNumberOverlayConfig);
        expect(first.channelBadgeConfig).not.toBe(second.channelBadgeConfig);
        expect(first.miniGuideConfig).not.toBe(second.miniGuideConfig);
        expect(first.channelTransitionConfig).not.toBe(second.channelTransitionConfig);
        expect(first.playbackOptionsConfig).not.toBe(second.playbackOptionsConfig);

        expect(first.playerConfig.containerId).toBe(APP_SHELL_CONTAINER_IDS.VIDEO);
        expect(first.epgConfig.containerId).toBe(EPG_CONTAINER_ID);
        expect(first.nowPlayingInfoConfig.containerId).toBe(APP_SHELL_CONTAINER_IDS.NOW_PLAYING_INFO);
        expect(first.playerOsdConfig.containerId).toBe(PLAYER_OSD_CONTAINER_ID);
        expect(first.channelNumberOverlayConfig.containerId).toBe(CHANNEL_NUMBER_OVERLAY_CONTAINER_ID);
        expect(first.channelBadgeConfig.containerId).toBe(CHANNEL_BADGE_CONTAINER_ID);
        expect(first.miniGuideConfig.containerId).toBe(MINI_GUIDE_CONTAINER_ID);
        expect(first.channelTransitionConfig.containerId).toBe(CHANNEL_TRANSITION_CONTAINER_ID);
        expect(first.playbackOptionsConfig.containerId).toBe(APP_SHELL_CONTAINER_IDS.PLAYBACK_OPTIONS);
    });
});
