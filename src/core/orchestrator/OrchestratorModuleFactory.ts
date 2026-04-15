import { AppLifecycle, type IAppLifecycle } from '../../modules/lifecycle';
import { NavigationManager, type INavigationManager } from '../../modules/navigation';
import { PlexAuth, type IPlexAuth } from '../../modules/plex/auth';
import { PlexServerDiscovery, type IPlexServerDiscovery } from '../../modules/plex/discovery';
import {
    PlexLibrary,
    type IPlexLibrary,
    type PlexLibraryConfig,
} from '../../modules/plex/library';
import {
    PlexStreamResolver,
    type IPlexStreamResolver,
    type PlexStreamResolverConfig,
} from '../../modules/plex/stream';
import {
    ChannelManager,
    type IChannelManager,
    type ChannelManagerConfig,
} from '../../modules/scheduler/channel-manager';
import { ChannelScheduler, type IChannelScheduler } from '../../modules/scheduler/scheduler';
import { VideoPlayer, type IVideoPlayer } from '../../modules/player';
import { DeferredEPGComponent } from '../../modules/ui/epg';
import type { IEPGComponent, IEPGReadinessPort } from '../../modules/ui/epg';
import {
    NowPlayingInfoOverlay,
    type INowPlayingInfoOverlay,
} from '../../modules/ui/now-playing-info';
import { PlayerOsdOverlay } from '../../modules/ui/player-osd';
import {
    ChannelNumberOverlay,
} from '../../modules/ui/channel-number-overlay';
import {
    ChannelBadgeOverlay,
} from '../../modules/ui/channel-badge';
import {
    MiniGuideOverlay,
    type IMiniGuideOverlay,
} from '../../modules/ui/mini-guide';
import {
    ChannelTransitionOverlay,
} from '../../modules/ui/channel-transition';
import {
    PlaybackOptionsModal,
    type IPlaybackOptionsModal,
} from '../../modules/ui/playback-options';
import { ExitConfirmModal } from '../../modules/ui/exit-confirm';
import { SleepTimerManager } from '../../modules/ui/sleep-timer';
import { STORAGE_KEYS } from '../../types';
import type { OrchestratorConfig } from './OrchestratorTypes';
import type {
    ChannelBadgeOverlayInitPort,
    ChannelNumberOverlayInitPort,
} from './OverlayPorts';
import type { PlatformServices } from '../../platform';
import { DebugOverridesStore } from '../../modules/debug/DebugOverridesStore';
import type { DeveloperSettingsStore } from '../../modules/settings/DeveloperSettingsStore';

export interface OrchestratorModuleFactoryDeps {
    config: OrchestratorConfig;
    platformServices: PlatformServices;
    debugOverridesStore: DebugOverridesStore;
    developerSettingsStore: DeveloperSettingsStore;
    onSleepTimerTick: () => void;
}

export interface OrchestratorModules {
    lifecycle: IAppLifecycle;
    navigation: INavigationManager;
    plexAuth: IPlexAuth;
    plexDiscovery: IPlexServerDiscovery;
    plexLibrary: IPlexLibrary;
    plexStreamResolver: IPlexStreamResolver;
    channelManager: IChannelManager;
    scheduler: IChannelScheduler;
    videoPlayer: IVideoPlayer;
    epg: IEPGComponent;
    epgReadinessPort: IEPGReadinessPort | null;
    nowPlayingInfo: INowPlayingInfoOverlay;
    playerOsd: PlayerOsdOverlay;
    channelNumberOverlay: ChannelNumberOverlayInitPort;
    channelBadgeOverlay: ChannelBadgeOverlayInitPort;
    miniGuide: IMiniGuideOverlay;
    channelTransitionOverlay: ChannelTransitionOverlay;
    playbackOptionsModal: IPlaybackOptionsModal;
    exitConfirmModal: ExitConfirmModal;
    sleepTimer: SleepTimerManager;
}

export function createOrchestratorModules(deps: OrchestratorModuleFactoryDeps): OrchestratorModules {
    const lifecycle = new AppLifecycle(undefined, undefined, deps.platformServices.lifecycle);
    const navigation = new NavigationManager(deps.platformServices.input, {
        readDebugLoggingEnabled: (): boolean =>
            deps.developerSettingsStore.readDebugLoggingEnabledAndClean(false),
    });
    const plexAuth = new PlexAuth(deps.config.plexConfig);
    const plexDiscovery = new PlexServerDiscovery({
        getAuthHeaders: (): Record<string, string> => plexAuth.getAuthHeaders(),
    });

    const plexLibraryConfig: PlexLibraryConfig = {
        getAuthHeaders: () => plexAuth.getAuthHeaders(),
        getServerUri: () => plexDiscovery.getServerUri(),
        getAuthToken: () => {
            const user = plexAuth.getCurrentUser();
            return user ? user.token : null;
        },
    };
    const plexLibrary = new PlexLibrary(plexLibraryConfig);

    const streamResolverConfig: PlexStreamResolverConfig = {
        getAuthHeaders: () => plexAuth.getAuthHeaders(),
        getServerUri: () => plexDiscovery.getServerUri(),
        getSelectedConnection: () => {
            const conn = plexDiscovery.getSelectedConnection() ?? null;
            if (!conn) return null;
            return { uri: conn.uri, local: conn.local, relay: conn.relay };
        },
        getHttpsConnection: () => {
            const conn = plexDiscovery.getHttpsConnection() ?? null;
            if (conn) return { uri: conn.uri };
            return null;
        },
        getRelayConnection: () => {
            const conn = plexDiscovery.getRelayConnection() ?? null;
            if (conn) return { uri: conn.uri };
            return null;
        },
        getItem: async (ratingKey: string) => plexLibrary.getItem(ratingKey),
        clientIdentifier: deps.config.plexConfig.clientIdentifier,
        debugOverridesStore: deps.debugOverridesStore,
        identityService: deps.platformServices.identity,
    };
    const plexStreamResolver = new PlexStreamResolver(streamResolverConfig);

    const channelManagerConfig: ChannelManagerConfig = {
        plexLibrary,
        storageKey: STORAGE_KEYS.CHANNELS_REAL,
        currentChannelKey: STORAGE_KEYS.CURRENT_CHANNEL,
    };
    const channelManager = new ChannelManager(channelManagerConfig);

    const scheduler = new ChannelScheduler();
    const videoPlayer = new VideoPlayer({
        playbackService: deps.platformServices.playback,
        subtitleService: deps.platformServices.subtitle,
    });
    const deferredEpg = new DeferredEPGComponent();
    const epg: IEPGComponent = deferredEpg;
    const epgReadinessPort: IEPGReadinessPort = deferredEpg;
    const nowPlayingInfo = new NowPlayingInfoOverlay();
    const playerOsd = new PlayerOsdOverlay();
    const channelNumberOverlay = new ChannelNumberOverlay();
    const channelBadgeOverlay = new ChannelBadgeOverlay();
    const miniGuide = new MiniGuideOverlay();
    const channelTransitionOverlay = new ChannelTransitionOverlay();
    const playbackOptionsModal = new PlaybackOptionsModal();
    const exitConfirmModal = new ExitConfirmModal();
    const sleepTimer = new SleepTimerManager({
        onWarning: (): void => undefined,
        onSleep: (): void => {
            videoPlayer.pause();
        },
        onCancel: (): void => undefined,
        onTick: deps.onSleepTimerTick,
    });

    return {
        lifecycle,
        navigation,
        plexAuth,
        plexDiscovery,
        plexLibrary,
        plexStreamResolver,
        channelManager,
        scheduler,
        videoPlayer,
        epg,
        epgReadinessPort,
        nowPlayingInfo,
        playerOsd,
        channelNumberOverlay,
        channelBadgeOverlay,
        miniGuide,
        channelTransitionOverlay,
        playbackOptionsModal,
        exitConfirmModal,
        sleepTimer,
    };
}
