import { createAppOrchestratorConfig } from '../AppOrchestratorConfigFactory';

describe('createAppOrchestratorConfig', () => {
    it('returns fresh mutable config sections for each factory call', () => {
        const first = createAppOrchestratorConfig();
        const second = createAppOrchestratorConfig();

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
    });

    it('does not leak mutations from one returned config into later factory calls', () => {
        const first = createAppOrchestratorConfig();

        first.navConfig.keyRepeatDelayMs = 123;
        first.playerConfig.seekIncrementSec = 99;
        first.epgConfig.visibleChannels = 12;
        first.miniGuideConfig.autoHideMs = 1234;

        const second = createAppOrchestratorConfig();

        expect(second.navConfig.keyRepeatDelayMs).toBe(500);
        expect(second.playerConfig.seekIncrementSec).toBe(10);
        expect(second.epgConfig.visibleChannels).toBe(5);
        expect(second.miniGuideConfig.autoHideMs).toBe(8_000);
    });
});
