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
import {
    ExitConfirmCoordinator,
    ExitConfirmModal,
} from '../../modules/ui/exit-confirm';
import { SleepTimerManager } from '../../modules/ui/sleep-timer';
import type { GuideSelectionSnapshot } from '../channel-tuning';
import type { ModuleStatus, OrchestratorConfig } from './OrchestratorTypes';
import { DebugOverridesStore } from '../../modules/debug/DebugOverridesStore';
import { NowPlayingDebugManager } from '../../modules/debug/NowPlayingDebugManager';
import type { AppendIssueDiagnostic } from '../../modules/debug/IssueDiagnosticsStore';
import { EpgPreferencesStore } from '../../modules/settings/EpgPreferencesStore';
import { NowPlayingDisplayStore } from '../../modules/settings/NowPlayingDisplayStore';
import { ProfileSessionStore } from '../../modules/settings/ProfileSessionStore';
import { SubtitlePreferencesStore } from '../../modules/settings/SubtitlePreferencesStore';
import type { ToastInput } from '../../modules/ui/toast/types';
import type { OrchestratorPlaybackStateAccessors } from './OrchestratorPlaybackStateAccessors';
import type { ChannelNumberOverlayRuntimePort } from './OverlayPorts';
import {
    buildChannelSetupCoordinator,
    buildChannelTransitionCoordinator,
    buildChannelTuningCoordinator,
    buildEpgCoordinator,
    bindEpgVisibleRangeChange,
    buildExitConfirmCoordinator,
    buildMiniGuideCoordinator,
    buildNavigationCoordinator,
    buildNowPlayingDebugManager,
    buildNowPlayingInfoCoordinator,
    buildPlaybackOptionsCoordinator,
    buildPlaybackRecovery,
    buildPlayerOsdCoordinator,
} from './OrchestratorCoordinatorBuilders';
import { ChannelSetupCoordinator } from '../channel-setup';
import { EPGCoordinator } from '../../modules/ui/epg/EPGCoordinator';
import { NowPlayingInfoCoordinator } from '../../modules/ui/now-playing-info/NowPlayingInfoCoordinator';
import { PlayerOsdCoordinator } from '../../modules/ui/player-osd/PlayerOsdCoordinator';
import { MiniGuideCoordinator } from '../../modules/ui/mini-guide/MiniGuideCoordinator';
import { ChannelTransitionCoordinator } from '../../modules/ui/channel-transition/ChannelTransitionCoordinator';
import { PlaybackOptionsCoordinator } from '../../modules/ui/playback-options/PlaybackOptionsCoordinator';
import { PlaybackRecoveryManager } from '../../modules/player/PlaybackRecoveryManager';
import { ChannelTuningCoordinator } from '../channel-tuning';
import { NavigationCoordinator } from '../../modules/navigation/NavigationCoordinator';

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

export interface OrchestratorCoordinators {
    epgCoordinator: EPGCoordinator;
    channelSetup: ChannelSetupCoordinator;
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

export function createOrchestratorCoordinators(
    input: OrchestratorCoordinatorFactoryDeps
): OrchestratorCoordinators {
    const epgCoordinator = buildEpgCoordinator(input);
    bindEpgVisibleRangeChange(input, epgCoordinator);

    const channelSetup = buildChannelSetupCoordinator(input, epgCoordinator);

    let nowPlayingInfoCoordinator: NowPlayingInfoCoordinator | null = null;
    const nowPlayingDebugManager = buildNowPlayingDebugManager(
        input,
        (): void => nowPlayingInfoCoordinator?.refreshIfOpen()
    );

    nowPlayingInfoCoordinator = buildNowPlayingInfoCoordinator(input, nowPlayingDebugManager);

    let playbackOptionsCoordinator: PlaybackOptionsCoordinator | null = null;
    const playerOsdCoordinator = buildPlayerOsdCoordinator(
        input,
        (preferredSection) =>
            playbackOptionsCoordinator?.prepareModal(preferredSection) ??
            { focusableIds: [], preferredFocusId: null }
    );

    const miniGuideCoordinator = buildMiniGuideCoordinator(input);
    const channelTransitionCoordinator = buildChannelTransitionCoordinator(input);
    const playbackRecovery = buildPlaybackRecovery(input);
    playbackOptionsCoordinator = buildPlaybackOptionsCoordinator(input, playbackRecovery);
    const exitConfirmCoordinator = buildExitConfirmCoordinator(input);
    const channelTuning = buildChannelTuningCoordinator(
        input,
        playbackRecovery,
        channelTransitionCoordinator
    );
    const navigationCoordinator = buildNavigationCoordinator(input, {
        epgCoordinator,
        channelSetup,
        nowPlayingInfoCoordinator,
        playerOsdCoordinator,
        miniGuideCoordinator,
        channelTransitionCoordinator,
        playbackOptionsCoordinator,
        exitConfirmCoordinator,
    });

    return {
        epgCoordinator,
        channelSetup,
        nowPlayingDebugManager,
        nowPlayingInfoCoordinator,
        playerOsdCoordinator,
        miniGuideCoordinator,
        channelTransitionCoordinator,
        playbackOptionsCoordinator,
        exitConfirmCoordinator,
        playbackRecovery,
        channelTuning,
        navigationCoordinator,
    };
}
