import type { AppError } from '../../modules/lifecycle';
import type { NavigationConfig } from '../../modules/navigation';
import type { PlexAuthConfig } from '../../modules/plex/auth';
import type { VideoPlayerConfig } from '../../modules/player';
import type { ChannelBadgeConfig } from '../../modules/ui/channel-badge';
import type { ChannelNumberOverlayConfig } from '../../modules/ui/channel-number-overlay';
import type { ChannelTransitionConfig } from '../../modules/ui/channel-transition';
import type { EPGConfig } from '../../modules/ui/epg';
import type { MiniGuideConfig } from '../../modules/ui/mini-guide';
import type { NowPlayingInfoConfig } from '../../modules/ui/now-playing-info';
import type { PlaybackOptionsConfig } from '../../modules/ui/playback-options';
import type { PlayerOsdConfig } from '../../modules/ui/player-osd';
import type { ModuleRuntimeStatus } from '../module-status';

export interface ModuleStatus {
    id: string;
    name: string;
    status: ModuleRuntimeStatus;
    loadTimeMs?: number;
    error?: AppError;
}

export interface OrchestratorConfig {
    plexConfig: PlexAuthConfig;
    playerConfig: VideoPlayerConfig;
    navConfig: NavigationConfig;
    epgConfig: EPGConfig;
    nowPlayingInfoConfig: NowPlayingInfoConfig;
    playbackOptionsConfig: PlaybackOptionsConfig;
    playerOsdConfig: PlayerOsdConfig;
    channelNumberOverlayConfig: ChannelNumberOverlayConfig;
    channelBadgeConfig: ChannelBadgeConfig;
    miniGuideConfig: MiniGuideConfig;
    channelTransitionConfig: ChannelTransitionConfig;
}
