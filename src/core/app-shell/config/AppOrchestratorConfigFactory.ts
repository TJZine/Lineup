import { createDefaultPlexAuthConfig } from '../../../modules/plex/auth/config';
import type { NavigationConfig } from '../../../modules/navigation';
import type { VideoPlayerConfig } from '../../../modules/player';
import { createDefaultEpgConfig } from '../../../modules/ui/epg/constants';
import type { EPGConfig } from '../../../modules/ui/epg/types';
import { APP_SHELL_CONTAINER_IDS } from '../../../modules/ui/common/appShellContainerIds';
import { PLAYER_OSD_CONTAINER_ID } from '../../../modules/ui/player-osd/constants';
import type { PlayerOsdConfig } from '../../../modules/ui/player-osd/types';
import { CHANNEL_NUMBER_OVERLAY_CONTAINER_ID } from '../../../modules/ui/channel-number-overlay/constants';
import type { ChannelNumberOverlayConfig } from '../../../modules/ui/channel-number-overlay/types';
import { CHANNEL_BADGE_CONTAINER_ID } from '../../../modules/ui/channel-badge/constants';
import type { ChannelBadgeConfig } from '../../../modules/ui/channel-badge/types';
import { MINI_GUIDE_CONTAINER_ID } from '../../../modules/ui/mini-guide/constants';
import type { MiniGuideConfig } from '../../../modules/ui/mini-guide/types';
import { CHANNEL_TRANSITION_CONTAINER_ID } from '../../../modules/ui/channel-transition/constants';
import type { ChannelTransitionConfig } from '../../../modules/ui/channel-transition/types';
import { createWebOsPlatformServices, type PlatformServices } from '../../../platform';
import type { OrchestratorConfig } from '../../orchestrator/contracts/OrchestratorTypes';

const DEFAULT_NAV_CONFIG: NavigationConfig = {
    enablePointerMode: false,
    keyRepeatDelayMs: 500,
    keyRepeatIntervalMs: 100,
    focusMemoryEnabled: true,
    debugMode: false,
};

const DEFAULT_PLAYER_CONFIG: VideoPlayerConfig = {
    containerId: APP_SHELL_CONTAINER_IDS.VIDEO,
    defaultVolume: 1.0,
    bufferAheadMs: 30000,
    seekIncrementSec: 10,
    hideControlsAfterMs: 3000,
    retryAttempts: 3,
    retryDelayMs: 1000,
};

const DEFAULT_PLAYER_OSD_CONFIG: PlayerOsdConfig = {
    containerId: PLAYER_OSD_CONTAINER_ID,
};

const DEFAULT_CHANNEL_NUMBER_OVERLAY_CONFIG: ChannelNumberOverlayConfig = {
    containerId: CHANNEL_NUMBER_OVERLAY_CONTAINER_ID,
    completeHideDelayMs: 650,
};

const DEFAULT_CHANNEL_BADGE_CONFIG: ChannelBadgeConfig = {
    containerId: CHANNEL_BADGE_CONTAINER_ID,
};

const DEFAULT_MINI_GUIDE_CONFIG: MiniGuideConfig = {
    containerId: MINI_GUIDE_CONTAINER_ID,
};

const DEFAULT_CHANNEL_TRANSITION_CONFIG: ChannelTransitionConfig = {
    containerId: CHANNEL_TRANSITION_CONTAINER_ID,
};

const createNavigationConfig = (): NavigationConfig => ({
    ...DEFAULT_NAV_CONFIG,
});

const createPlayerConfig = (): VideoPlayerConfig => ({
    ...DEFAULT_PLAYER_CONFIG,
});

const createEpgConfig = (): EPGConfig => ({
    ...createDefaultEpgConfig(),
});

const createPlayerOsdConfig = (): PlayerOsdConfig => ({
    ...DEFAULT_PLAYER_OSD_CONFIG,
});

const createChannelNumberOverlayConfig = (): ChannelNumberOverlayConfig => ({
    ...DEFAULT_CHANNEL_NUMBER_OVERLAY_CONFIG,
});

const createChannelBadgeConfig = (): ChannelBadgeConfig => ({
    ...DEFAULT_CHANNEL_BADGE_CONFIG,
});

const createMiniGuideConfig = (): MiniGuideConfig => ({
    ...DEFAULT_MINI_GUIDE_CONFIG,
});

const createChannelTransitionConfig = (): ChannelTransitionConfig => ({
    ...DEFAULT_CHANNEL_TRANSITION_CONFIG,
});

export function createAppOrchestratorConfig(
    platformServices: PlatformServices = createWebOsPlatformServices()
): OrchestratorConfig {
    return {
        plexConfig: createDefaultPlexAuthConfig(
            undefined,
            '6.0',
            () => platformServices.identity.detectPlatformVersion()
        ),
        navConfig: createNavigationConfig(),
        playerConfig: createPlayerConfig(),
        epgConfig: createEpgConfig(),
        playerOsdConfig: createPlayerOsdConfig(),
        channelNumberOverlayConfig: createChannelNumberOverlayConfig(),
        channelBadgeConfig: createChannelBadgeConfig(),
        miniGuideConfig: createMiniGuideConfig(),
        channelTransitionConfig: createChannelTransitionConfig(),
    };
}
