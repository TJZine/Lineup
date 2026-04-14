import type {
    INavigationManager,
} from '../../modules/navigation';
import type {
    AppError,
    IAppLifecycle,
} from '../../modules/lifecycle';
import type { IPlexAuth } from '../../modules/plex/auth';
import type { IPlexServerDiscovery } from '../../modules/plex/discovery';
import type {
    IPlexLibrary,
} from '../../modules/plex/library';
import type {
    IPlexStreamResolver,
    StreamDecision,
} from '../../modules/plex/stream';
import type {
    IChannelManager,
    ChannelConfig,
    ResolvedChannelContent,
} from '../../modules/scheduler/channel-manager';
import type {
    IChannelScheduler,
    ScheduleConfig,
} from '../../modules/scheduler/scheduler';
import type {
    IVideoPlayer,
} from '../../modules/player';
import type {
    IEPGComponent,
    IEpgDebugRuntime,
} from '../../modules/ui/epg';
import type {
    INowPlayingInfoOverlay,
} from '../../modules/ui/now-playing-info';
import type {
    IPlayerOsdOverlay,
} from '../../modules/ui/player-osd';
import type {
    IMiniGuideOverlay,
} from '../../modules/ui/mini-guide';
import type {
    IChannelTransitionOverlay,
} from '../../modules/ui/channel-transition';
import type {
    IPlaybackOptionsModal,
} from '../../modules/ui/playback-options';
import type {
    ExitConfirmCoordinator,
    ExitConfirmModal,
} from '../../modules/ui/exit-confirm';
import type { SleepTimerManager } from '../../modules/ui/sleep-timer';
import type { GuideSelectionSnapshot } from '../channel-tuning';
import type { ModuleStatus, OrchestratorConfig } from './OrchestratorTypes';
import type { DebugOverridesStore } from '../../modules/debug/DebugOverridesStore';
import type { NowPlayingDebugManager } from '../../modules/debug/NowPlayingDebugManager';
import type { AppendIssueDiagnostic } from '../../modules/debug/IssueDiagnosticsStore';
import type { EpgPreferencesStore } from '../../modules/settings/EpgPreferencesStore';
import type { NowPlayingDisplayStore } from '../../modules/settings/NowPlayingDisplayStore';
import type { ProfileSessionStore } from '../../modules/settings/ProfileSessionStore';
import type { SubtitlePreferencesStore } from '../../modules/settings/SubtitlePreferencesStore';
import type { ToastInput } from '../../modules/ui/toast/types';
import type { OrchestratorPlaybackStateAccessors } from './OrchestratorPlaybackStateAccessors';
import type { ChannelNumberOverlayRuntimePort } from './OverlayPorts';
import type { ChannelSetupCoordinator, ChannelSetupWorkflow } from '../channel-setup';
import type { EPGCoordinator } from '../../modules/ui/epg';
import type { NowPlayingInfoCoordinator } from '../../modules/ui/now-playing-info';
import type { PlayerOsdCoordinator } from '../../modules/ui/player-osd';
import type { MiniGuideCoordinator } from '../../modules/ui/mini-guide';
import type { ChannelTransitionCoordinator } from '../../modules/ui/channel-transition';
import type { PlaybackOptionsCoordinator } from '../../modules/ui/playback-options/PlaybackOptionsCoordinator';
import type { PlaybackRecoveryManager } from '../../modules/player/PlaybackRecoveryManager';
import type { ChannelTuningCoordinator } from '../channel-tuning';
import type { NavigationCoordinator } from '../../modules/navigation/NavigationCoordinator';

export interface OrchestratorCoordinatorFactoryDeps {
    epgDebugRuntime: IEpgDebugRuntime | null;
    config: OrchestratorConfig | null;
    moduleStatus: Map<string, ModuleStatus>;
    init: {
        ensureEpgInitialized: () => Promise<void>;
    };
    modules: {
        navigation: INavigationManager;
        plexAuth: IPlexAuth;
        plexDiscovery: IPlexServerDiscovery;
        plexLibrary: IPlexLibrary;
        plexStreamResolver: IPlexStreamResolver;
        channelManager: IChannelManager;
        scheduler: IChannelScheduler;
        videoPlayer: IVideoPlayer;
        lifecycle: IAppLifecycle;
        epg: IEPGComponent;
    };
    overlays: {
        nowPlayingInfo: INowPlayingInfoOverlay;
        playerOsd: IPlayerOsdOverlay;
        channelNumberOverlay: ChannelNumberOverlayRuntimePort;
        miniGuide: IMiniGuideOverlay;
        channelTransitionOverlay: IChannelTransitionOverlay;
        playbackOptionsModal: IPlaybackOptionsModal;
        exitConfirmModal: ExitConfirmModal;
        sleepTimer: SleepTimerManager;
    };
    stores: {
        debugOverridesStore: DebugOverridesStore;
        subtitlePreferencesStore: SubtitlePreferencesStore;
        epgPreferencesStore: EpgPreferencesStore;
        nowPlayingDisplayStore: NowPlayingDisplayStore;
        profileSessionStore: ProfileSessionStore;
    };
    diagnostics: {
        appendIssueDiagnostic: AppendIssueDiagnostic;
    };
    playback: {
        state: OrchestratorPlaybackStateAccessors;
        getPlaybackInfoSnapshot: () => import('../../utils/playbackSummary').PlaybackInfoSnapshotLike | null;
        refreshPlaybackInfoSnapshot: () => Promise<import('../../utils/playbackSummary').PlaybackInfoSnapshotLike>;
        stopPlayback: () => void;
        stopActiveTranscodeSession: () => void;
        getMimeType: (decision: StreamDecision) => string;
        buildPlexResourceUrl: (pathOrUrl: string) => string | null;
    };
    schedule: {
        lastChannelChangeSource: () => 'remote' | 'number' | 'guide' | null;
        setLastChannelChangeSource: (source: 'remote' | 'number' | 'guide' | null) => void;
        setActiveScheduleDayKey: (dayKey: number) => void;
        getSelectedServerId: () => string | null;
        getLocalMidnightMs: (timeMs: number) => number;
        getLocalDayKey: (timeMs: number) => number;
        buildDailyScheduleConfig: (
            channel: ChannelConfig,
            items: ResolvedChannelContent['items'],
            referenceTimeMs: number
        ) => ScheduleConfig;
    };
    actions: {
        switchToChannel: (
            channelId: string,
            options?: { guideSelectionSnapshot?: GuideSelectionSnapshot }
        ) => Promise<void>;
        switchToNextChannel: () => void;
        switchToPreviousChannel: () => void;
        switchToChannelByNumberWithOutcome: (n: number) => Promise<import('../../types/channelSwitch').ChannelSwitchOutcome>;
        toggleEPG: () => void;
        onOverlayVisibilityChange: (visible: boolean) => void;
        toggleNowPlayingInfoOverlay: () => void;
    };
    errors: {
        handleGlobalError: (error: AppError, context: string) => void;
    };
    nowPlaying: {
        handler: () => ((toast: ToastInput) => void) | null;
    };
}

export type OrchestratorCoordinatorBuilderInput = OrchestratorCoordinatorFactoryDeps;

export interface OrchestratorCoordinators {
    epgCoordinator: EPGCoordinator;
    channelSetup: ChannelSetupCoordinator;
    channelSetupWorkflow: ChannelSetupWorkflow;
    nowPlayingDebugManager: NowPlayingDebugManager;
    nowPlayingInfoCoordinator: NowPlayingInfoCoordinator;
    playerOsdCoordinator: PlayerOsdCoordinator;
    miniGuideCoordinator: MiniGuideCoordinator;
    channelTransitionCoordinator: ChannelTransitionCoordinator;
    playbackOptionsCoordinator: PlaybackOptionsCoordinator;
    exitConfirmCoordinator: ExitConfirmCoordinator;
    playbackRecovery: PlaybackRecoveryManager;
    channelTuning: ChannelTuningCoordinator;
    navigationCoordinator: NavigationCoordinator;
}
