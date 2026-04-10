/**
 * Application Orchestrator responsibilities:
 * - Module initialization in dependency order
 * - Cross-module event wiring
 * - State restoration on startup
 * - Error handling and recovery
 * - Channel switching and EPG management
 */

import {
    AppErrorCode,
    type IAppLifecycle,
    type AppError,
    type LifecycleAppError,
    type AppPhase,
    type LifecycleEventMap,
} from '../../modules/lifecycle';
import type { ChannelSwitchOutcome } from '../../types/channelSwitch';
import {
    type INavigationManager,
    type Screen,
} from '../../modules/navigation';
import type { GuideSettingChange } from '../../modules/ui/settings/types';
import { NavigationCoordinator } from '../../modules/navigation/NavigationCoordinator';
import {
    type IPlexAuth,
    type PlexPinRequest,
    type PlexHomeUser,
} from '../../modules/plex/auth';
import {
    type IPlexServerDiscovery,
    type PlexServerSelectionResult,
    type PlexServer,
} from '../../modules/plex/discovery';
import {
    type IPlexLibrary,
} from '../../modules/plex/library';
import {
    type IPlexStreamResolver,
    type StreamDecision,
    type StreamResolverError,
    mapPlexStreamErrorCodeToAppErrorCode,
} from '../../modules/plex/stream';
import { MIME_TYPES } from '../../modules/plex/stream/constants'; // Fix Direct Play MIME types
import {
    type IChannelManager,
    type ChannelConfig,
    type ResolvedChannelContent,
} from '../../modules/scheduler/channel-manager';
import {
    type IChannelScheduler,
    type ScheduledProgram,
    type ScheduleConfig,
} from '../../modules/scheduler/scheduler';
import {
    type IVideoPlayer,
    type StreamDescriptor,
} from '../../modules/player';
import { PlaybackRecoveryManager } from '../../modules/player/PlaybackRecoveryManager';
import {
    EPGDebugRuntime,
    type IEpgDebugRuntime,
    type IEPGComponent,
} from '../../modules/ui/epg';
import { EPGCoordinator } from '../../modules/ui/epg/EPGCoordinator';
import {
    type INowPlayingInfoOverlay,
    NOW_PLAYING_INFO_MODAL_ID,
} from '../../modules/ui/now-playing-info';
import {
    PlayerOsdOverlay,
} from '../../modules/ui/player-osd';
import { PlayerOsdCoordinator } from '../../modules/ui/player-osd/PlayerOsdCoordinator';
import { SleepTimerManager } from '../../modules/ui/sleep-timer';
import {
    type IMiniGuideOverlay,
} from '../../modules/ui/mini-guide';
import { MiniGuideCoordinator } from '../../modules/ui/mini-guide/MiniGuideCoordinator';
import {
    ChannelTransitionOverlay,
} from '../../modules/ui/channel-transition';
import { ChannelTransitionCoordinator } from '../../modules/ui/channel-transition/ChannelTransitionCoordinator';
import {
    type IPlaybackOptionsModal,
} from '../../modules/ui/playback-options';
import {
    ExitConfirmCoordinator,
    ExitConfirmModal,
    EXIT_CONFIRM_MODAL_ID,
} from '../../modules/ui/exit-confirm';
import {
    InitializationCoordinator,
    ChannelTuningCoordinator,
    OrchestratorStorageContext,
    OrchestratorEventBinder,
    OverlayRuntimePolicyController,
    ProfileSwitchCleanupController,
    PlaybackRuntimeController,
} from '..';
import type {
    OrchestratorServerSelectionReadiness,
    OrchestratorServerSelectionResult,
    SelectedServerPersistenceResult,
} from '../server-selection/ServerSelectionTypes';
import { ServerSelectionCoordinator } from '../server-selection/ServerSelectionCoordinator';
import type {
    ModuleStatus,
    OrchestratorConfig,
} from './OrchestratorTypes';
import { createOrchestratorModules } from './OrchestratorModuleFactory';
import { createOrchestratorCoordinators } from './OrchestratorCoordinatorFactory';
import { createPriorityOneControllersAndBinder } from './OrchestratorPriorityOneControllerFactory';
import type {
    ChannelBadgeOverlayInitPort,
    ChannelNumberOverlayInitPort,
} from './OverlayPorts';
import type { OrchestratorPlaybackStateAccessors } from './OrchestratorPlaybackStateAccessors';
import {
    ChannelSetupCoordinator,
    createChannelSetupWorkflowPort,
    type ChannelSetupWorkflowPort,
} from '../channel-setup';
import { NowPlayingDebugManager } from '../../modules/debug/NowPlayingDebugManager';
import { DebugOverridesStore } from '../../modules/debug/DebugOverridesStore';
import { IssueDiagnosticsStore, type AppendIssueDiagnostic } from '../../modules/debug/IssueDiagnosticsStore';
import { NowPlayingInfoCoordinator } from '../../modules/ui/now-playing-info/NowPlayingInfoCoordinator';
import { PlaybackOptionsCoordinator } from '../../modules/ui/playback-options';
import { EpgPreferencesStore } from '../../modules/settings/EpgPreferencesStore';
import { NowPlayingDisplayStore } from '../../modules/settings/NowPlayingDisplayStore';
import { ProfileSessionStore } from '../../modules/settings/ProfileSessionStore';
import { SubtitlePreferencesStore } from '../../modules/settings/SubtitlePreferencesStore';
import { AudioSettingsStore } from '../../modules/settings/AudioSettingsStore';
import type { IDisposable } from '../../utils/interfaces';
import { createMulberry32 } from '../../modules/scheduler/shared/prng';
import { fnv1a32Uint } from '../../utils/hash';
import { getRecoveryActions as getRecoveryActionsHelper } from '../error-recovery/RecoveryActions';
import { toLifecycleAppError as toLifecycleAppErrorHelper } from '../error-recovery/LifecycleErrorAdapter';
import type { ErrorRecoveryAction } from '../error-recovery/types';
import {
    buildPlexResourceUrlWithAuth,
} from '../../modules/plex/shared/plexUrl';
import type { ToastInput } from '../../modules/ui/toast/types';
import type { PlatformServices } from '../../platform';
import { webosPlatformServices } from '../../platform';
import { isAbortLikeError, summarizeErrorForLog } from '../../utils/errors';
import { ScheduleDayRolloverController } from './ScheduleDayRolloverController';
import { SubtitleTrackRecoveryController } from './SubtitleTrackRecoveryController';
import { InitializationUiInitializer } from '../initialization/InitializationUiInitializer';

// ============================================
// Types
// ============================================

export type { ModuleStatus, OrchestratorConfig } from './OrchestratorTypes';

const QA_003B_ISSUE_ID = 'QA-003b';

export type {
    ChannelSetupConfig,
    ChannelSetupContext,
    ChannelBuildSummary,
    ChannelBuildProgress,
    ChannelSetupRecord,
    ChannelSetupPreview,
    ChannelSetupReview,
} from '../channel-setup/types';

export interface PlaybackInfoSnapshot {
    channel: { id: string; number: number; name: string } | null;
    program:
    | {
        itemKey: string;
        title: string;
        fullTitle: string;
        type: string;
        scheduledStartTime: number;
        scheduledEndTime: number;
        elapsedMs: number;
        remainingMs: number;
    }
    | null;
    stream:
    | {
        protocol: StreamDescriptor['protocol'];
        mimeType: string;
        isDirectPlay: boolean;
        isTranscoding: boolean;
        container: string;
        videoCodec: string;
        audioCodec: string;
        subtitleDelivery: StreamDecision['subtitleDelivery'];
        bitrate: number;
        width: number;
        height: number;
        sessionId: string;
        selectedAudio:
        | {
            id: string;
            codec: string | null | undefined;
            channels?: number;
            language?: string;
            title?: string;
            default?: boolean;
        }
        | null;
        selectedSubtitle:
        | {
            id: string;
            codec: string | null | undefined;
            language?: string;
            title?: string;
            format?: string;
            default?: boolean;
        }
        | null;
        directPlay?: StreamDecision['directPlay'];
        audioFallback?: StreamDecision['audioFallback'];
        source?: StreamDecision['source'];
        transcodeRequest?: StreamDecision['transcodeRequest'];
        serverDecision?: StreamDecision['serverDecision'];
    }
    | null;
}

export type { OrchestratorServerSelectionResult } from '../server-selection/ServerSelectionTypes';
export type { ErrorRecoveryAction } from '../error-recovery/types';

// Re-export AppErrorCode for consumers
export { AppErrorCode };

// ============================================
// Implementation
// ============================================

/**
 * AppOrchestrator - Central coordinator for all application modules.
 *
 * Manages:
 * - Module initialization in 5 phases
 * - Cross-module event wiring
 * - State restoration on startup
 * - Error handling with recovery actions
 * - Channel switching and EPG management
 */
export class AppOrchestrator {
    private _lifecycle: IAppLifecycle | null = null;
    private _navigation: INavigationManager | null = null;
    private _plexAuth: IPlexAuth | null = null;
    private _plexDiscovery: IPlexServerDiscovery | null = null;
    private _plexLibrary: IPlexLibrary | null = null;
    private _plexStreamResolver: IPlexStreamResolver | null = null;
    private _channelManager: IChannelManager | null = null;
    private _scheduler: IChannelScheduler | null = null;
    private _videoPlayer: IVideoPlayer | null = null;
    private _epg: IEPGComponent | null = null;
    private _epgCoordinator: EPGCoordinator | null = null;
    private _nowPlayingInfo: INowPlayingInfoOverlay | null = null;
    private _nowPlayingInfoCoordinator: NowPlayingInfoCoordinator | null = null;
    private _playerOsd: PlayerOsdOverlay | null = null;
    private _channelNumberOverlay: ChannelNumberOverlayInitPort | null = null;
    private _channelBadgeOverlay: ChannelBadgeOverlayInitPort | null = null;
    private _channelTransitionOverlay: ChannelTransitionOverlay | null = null;
    private _playerOsdCoordinator: PlayerOsdCoordinator | null = null;
    private _miniGuide: IMiniGuideOverlay | null = null;
    private _miniGuideCoordinator: MiniGuideCoordinator | null = null;
    private _channelTransitionCoordinator: ChannelTransitionCoordinator | null = null;
    private _playbackOptionsModal: IPlaybackOptionsModal | null = null;
    private _playbackOptionsCoordinator: PlaybackOptionsCoordinator | null = null;
    private _exitConfirmModal: ExitConfirmModal | null = null;
    private _exitConfirmCoordinator: ExitConfirmCoordinator | null = null;
    private _sleepTimer: SleepTimerManager | null = null;
    private readonly _audioSettingsStore = new AudioSettingsStore();
    private readonly _subtitlePreferencesStore = new SubtitlePreferencesStore();
    private readonly _epgPreferencesStore = new EpgPreferencesStore();
    private readonly _nowPlayingDisplayStore = new NowPlayingDisplayStore();
    private readonly _profileSessionStore = new ProfileSessionStore();
    private _nowPlayingDebugManager: NowPlayingDebugManager | null = null;
    private _playbackRecovery: PlaybackRecoveryManager | null = null;
    private _channelTuning: ChannelTuningCoordinator | null = null;
    private _navigationCoordinator: NavigationCoordinator | null = null;
    private _nowPlayingHandler: ((toast: ToastInput) => void) | null = null;
    private _pendingNowPlayingChannelId: string | null = null;
    private _shouldAutoShowInfoBannerOnNextPlay = false;
    private _lastChannelChangeSource: 'remote' | 'number' | 'guide' | null = null;
    private _scheduleDayRolloverController: ScheduleDayRolloverController | null = null;
    private _subtitleTrackRecoveryController: SubtitleTrackRecoveryController | null = null;

    private _config: OrchestratorConfig | null = null;
    private _moduleStatus: Map<string, ModuleStatus> = new Map();
    private _errorHandlers: Map<string, (error: AppError) => boolean> = new Map();
    private _eventBinder: OrchestratorEventBinder | null = null;
    private _ready: boolean = false;
    private _initCoordinator: InitializationCoordinator | null = null;
    private _channelSetup: ChannelSetupCoordinator | null = null;
    private _playbackRuntimeController: PlaybackRuntimeController | null = null;
    private _overlayRuntimePolicyController: OverlayRuntimePolicyController | null = null;
    private _profileSwitchCleanupController: ProfileSwitchCleanupController | null = null;
    private _priorityOneControllersInitializing = false;

    private _currentProgramForPlayback: ScheduledProgram | null = null;
    private _currentStreamDescriptor: StreamDescriptor | null = null;
    private _currentStreamDecision: StreamDecision | null = null;
    private readonly _platformServices: PlatformServices;
    private readonly _storageContext: OrchestratorStorageContext;
    private readonly _debugOverridesStore = new DebugOverridesStore();
    private readonly _issueDiagnosticsStore = new IssueDiagnosticsStore();
    private _epgDebugRuntime: IEpgDebugRuntime | null = null;
    private readonly _playbackStateAccessors: OrchestratorPlaybackStateAccessors;
    private readonly _channelSetupWorkflowPort: ChannelSetupWorkflowPort;
    private readonly _serverSelectionCoordinator: ServerSelectionCoordinator;

    private _throwModuleInitPreconditionError(
        message: string,
        context: Record<string, unknown>
    ): never {
        throw Object.assign(new Error(message), {
            code: AppErrorCode.MODULE_INIT_FAILED,
            recoverable: true,
            context,
        } satisfies Pick<AppError, 'code' | 'recoverable' | 'context'>);
    }

    constructor(platformServices?: PlatformServices) {
        this._platformServices = platformServices ?? webosPlatformServices;
        this._storageContext = new OrchestratorStorageContext({
            getActiveUserId: this._getActiveUserId.bind(this),
            getSelectedServerId: this._getSelectedServerId.bind(this),
            setDiscoveryStorageKeys: (selectedKey: string, healthKey: string): void => {
                this._plexDiscovery?.setStorageKeys(selectedKey, healthKey);
            },
            setChannelManagerStorageKeys: (channelsKey: string, currentChannelKey: string): void => {
                this._channelManager?.setStorageKeys(channelsKey, currentChannelKey);
            },
        });
        this._playbackStateAccessors = {
            getCurrentProgramForPlayback: (): ScheduledProgram | null => this._currentProgramForPlayback,
            setCurrentProgramForPlayback: (program: ScheduledProgram | null): void => {
                this._currentProgramForPlayback = program;
            },
            getCurrentStreamDescriptor: (): StreamDescriptor | null => this._currentStreamDescriptor,
            setCurrentStreamDescriptor: (stream: StreamDescriptor | null): void => {
                this._currentStreamDescriptor = stream;
            },
            getCurrentStreamDecision: (): StreamDecision | null => this._currentStreamDecision,
            setCurrentStreamDecision: (decision: StreamDecision | null): void => {
                this._currentStreamDecision = decision;
            },
            getPendingNowPlayingChannelId: (): string | null => this._pendingNowPlayingChannelId,
            setPendingNowPlayingChannelId: (channelId: string | null): void => {
                this._pendingNowPlayingChannelId = channelId;
            },
            getShouldAutoShowInfoBannerOnNextPlay: (): boolean =>
                this._shouldAutoShowInfoBannerOnNextPlay,
            setShouldAutoShowInfoBannerOnNextPlay: (value: boolean): void => {
                this._shouldAutoShowInfoBannerOnNextPlay = value;
            },
        };
        this._channelSetupWorkflowPort = createChannelSetupWorkflowPort({
            getChannelSetupCoordinator: (): ChannelSetupCoordinator | null => this._channelSetup,
        });
        this._serverSelectionCoordinator = new ServerSelectionCoordinator({
            selectServer: async (serverId: string): Promise<PlexServerSelectionResult> => {
                if (!this._plexDiscovery) {
                    throw new Error('PlexServerDiscovery not initialized');
                }
                return this._plexDiscovery.selectServer(serverId);
            },
            getSelectedServerUri: (): string | null => this._plexDiscovery?.getServerUri() ?? null,
            persistSelection: async (
                serverId: string,
                serverUri: string | null
            ): Promise<SelectedServerPersistenceResult> =>
                this._persistSelectedServerForActiveUser(serverId, serverUri),
            runPostSelectionRuntimeSwap: async (): Promise<void> => {
                if (!this._initCoordinator) {
                    return;
                }
                await this._initCoordinator.runStartup(3);
                if (this._epg) {
                    this._epgCoordinator?.clearSelectedChannelScheduleSnapshot();
                    this._epgCoordinator?.clearScheduleCaches();
                }
                this._epg?.clearSchedules();
                this._epgCoordinator?.primeEpgChannels();
                await this._epgCoordinator?.refreshEpgSchedules({ reason: 'server-swap' });
            },
            getReadiness: (): OrchestratorServerSelectionReadiness =>
                (this._ready ? 'ready' : 'startup_pending'),
        });
        this._initializeModuleStatus();
    }

    /**
     * Initialize the orchestrator with configuration.
     * Creates all module instances but does not start them.
     * @param config - Configuration for all modules
     */
    async initialize(config: OrchestratorConfig): Promise<void> {
        this._config = config;
        if (this._config.nowPlayingInfoConfig) {
            const previousOnAutoHide = this._config.nowPlayingInfoConfig.onAutoHide ?? null;
            this._config.nowPlayingInfoConfig.onAutoHide = (): void => {
                if (previousOnAutoHide) {
                    previousOnAutoHide();
                }
                if (this._navigation?.isModalOpen(NOW_PLAYING_INFO_MODAL_ID)) {
                    this._navigation.closeModal(NOW_PLAYING_INFO_MODAL_ID);
                }
            };
        }

        const modules = createOrchestratorModules({
            config,
            platformServices: this._platformServices,
            debugOverridesStore: this._debugOverridesStore,
            onSleepTimerTick: (): void => {
                // Sleep timer countdown is independent of playback time updates; only refresh OSD if visible.
                this._playerOsdCoordinator?.refreshIfVisible();
            },
        });
        this._lifecycle = modules.lifecycle;
        this._navigation = modules.navigation;
        this._plexAuth = modules.plexAuth;
        this._plexDiscovery = modules.plexDiscovery;
        this._plexLibrary = modules.plexLibrary;
        this._plexStreamResolver = modules.plexStreamResolver;
        this._channelManager = modules.channelManager;
        this._scheduler = modules.scheduler;
        this._videoPlayer = modules.videoPlayer;
        this._epg = modules.epg;
        this._nowPlayingInfo = modules.nowPlayingInfo;
        this._playerOsd = modules.playerOsd;
        this._channelNumberOverlay = modules.channelNumberOverlay;
        this._channelBadgeOverlay = modules.channelBadgeOverlay;
        this._miniGuide = modules.miniGuide;
        this._channelTransitionOverlay = modules.channelTransitionOverlay;
        this._playbackOptionsModal = modules.playbackOptionsModal;
        this._exitConfirmModal = modules.exitConfirmModal;
        this._sleepTimer = modules.sleepTimer;
        this._epgDebugRuntime?.destroy();
        this._epgDebugRuntime = new EPGDebugRuntime();

        this._configureDiscoveryStorageKeysForActiveUser();

        const initializationUiInitializer = new InitializationUiInitializer(
            config,
            {
                nowPlayingInfo: this._nowPlayingInfo,
                playbackOptions: this._playbackOptionsModal,
                exitConfirm: this._exitConfirmModal,
            },
            {
                updateModuleStatus: this._updateModuleStatus.bind(this),
                getModuleStatus: (id: string): ModuleStatus['status'] | undefined =>
                    this._moduleStatus.get(id)?.status,
            }
        );

        // Create InitializationCoordinator with dependencies and callbacks
        this._initCoordinator = new InitializationCoordinator(
            config,
            {
                modules: {
                    lifecycle: this._lifecycle,
                    navigation: this._navigation,
                    plexAuth: this._plexAuth,
                    plexDiscovery: this._plexDiscovery,
                    plexLibrary: this._plexLibrary,
                    plexStreamResolver: this._plexStreamResolver,
                    channelManager: this._channelManager,
                    scheduler: this._scheduler,
                    videoPlayer: this._videoPlayer,
                    epg: this._epg,
                },
                readiness: {
                    epg: modules.epgReadinessPort,
                },
                overlays: {
                    playerOsd: this._playerOsd,
                    channelNumberOverlay: this._channelNumberOverlay,
                    channelBadgeOverlay: this._channelBadgeOverlay,
                    miniGuide: this._miniGuide,
                    channelTransition: this._channelTransitionOverlay,
                },
                uiInitializer: initializationUiInitializer,
                epgDebugRuntime: this._epgDebugRuntime,
                stores: {
                    epgPreferencesStore: this._epgPreferencesStore,
                    profileSessionStore: this._profileSessionStore,
                },
            },
            {
                status: {
                    updateModuleStatus: this._updateModuleStatus.bind(this),
                    getModuleStatus: (id: string): ModuleStatus['status'] | undefined =>
                        this._moduleStatus.get(id)?.status,
                },
                errors: {
                    handleGlobalError: this.handleGlobalError.bind(this),
                },
                state: {
                    setReady: (ready: boolean): void => {
                        this._ready = ready;
                    },
                    setupEventWiring: (): void => {
                        this._requireEventBinder().bind();
                    },
                },
                serverStorage: {
                    configureDiscoveryStorage: this._configureDiscoveryStorageKeysForActiveUser.bind(this),
                    configureChannelManagerStorage: this._configureChannelManagerStorageForSelectedServer.bind(this),
                    getSelectedServerId: this._getSelectedServerId.bind(this),
                },
                routing: {
                    shouldRunAudioSetup: this._shouldRunAudioSetup.bind(this),
                    shouldRunChannelSetup: (): boolean => this._channelSetup?.shouldRunChannelSetup() ?? false,
                    switchToChannel: this.switchToChannel.bind(this),
                    openServerSelect: this.openServerSelect.bind(this),
                },
                resources: {
                    buildPlexResourceUrl: (pathOrUrl: string | null): string | null => {
                        if (!pathOrUrl) return null;
                        return this._buildPlexResourceUrl(pathOrUrl);
                    },
                },
                subtitle: {
                    seedSubtitleLanguageFromPlexUser: (): void => {
                        this._seedSubtitleLanguageFromPlexUser();
                    },
                },
            }
        );

        this._createCoordinators();
        this._channelSetup?.cleanupStaleChannelBuildKeys();
        this._initializePriorityOneControllers();

        this.registerErrorHandler('channel-number-overlay', (error) => {
            if (typeof document === 'undefined') return false;
            if (error.code !== AppErrorCode.CHANNEL_NOT_FOUND) return false;
            const attempted = error.context?.attemptedChannelNumber;
            const op = error.context?.operation;
            if (op !== 'switchToChannelByNumber') return false;
            if (typeof attempted !== 'number' || !Number.isFinite(attempted)) return false;
            this._channelNumberOverlay?.showError(Math.floor(attempted));
            return true;
        });

        // Update status for all modules
        this._updateModuleStatus('event-emitter', 'ready');
    }

    private _createCoordinators(): void {
        // This method assumes `initialize()` has already created the module instances it references.
        // It must not perform side effects other than assigning coordinator fields.
        if (
            !this._lifecycle ||
            !this._navigation ||
            !this._plexAuth ||
            !this._plexDiscovery ||
            !this._plexLibrary ||
            !this._plexStreamResolver ||
            !this._channelManager ||
            !this._scheduler ||
            !this._videoPlayer ||
            !this._epg ||
            !this._nowPlayingInfo ||
            !this._playerOsd ||
            !this._channelNumberOverlay ||
            !this._channelBadgeOverlay ||
            !this._miniGuide ||
            !this._channelTransitionOverlay ||
            !this._playbackOptionsModal ||
            !this._exitConfirmModal ||
            !this._sleepTimer
        ) {
            throw new Error('Orchestrator coordinator initialization requires module instances');
        }
        if (!this._initCoordinator) {
            throw new Error('InitializationCoordinator must exist before coordinator assembly');
        }
        const initCoordinator = this._initCoordinator;

        const appendIssueDiagnostic: AppendIssueDiagnostic = (issue: string, event: string, data: unknown): void => {
            this._issueDiagnosticsStore.append(issue, event, data);
        };

        const coordinators = createOrchestratorCoordinators({
            epgDebugRuntime: this._epgDebugRuntime,
            config: this._config,
            moduleStatus: this._moduleStatus,
            init: {
                ensureEpgInitialized: (): Promise<void> =>
                    initCoordinator.ensureEPGInitialized(),
            },
            modules: {
                navigation: this._navigation,
                plexAuth: this._plexAuth,
                plexDiscovery: this._plexDiscovery,
                plexLibrary: this._plexLibrary,
                plexStreamResolver: this._plexStreamResolver,
                channelManager: this._channelManager,
                scheduler: this._scheduler,
                videoPlayer: this._videoPlayer,
                lifecycle: this._lifecycle,
                epg: this._epg,
            },
            overlays: {
                nowPlayingInfo: this._nowPlayingInfo,
                playerOsd: this._playerOsd,
                channelNumberOverlay: this._channelNumberOverlay,
                miniGuide: this._miniGuide,
                channelTransitionOverlay: this._channelTransitionOverlay,
                playbackOptionsModal: this._playbackOptionsModal,
                exitConfirmModal: this._exitConfirmModal,
                sleepTimer: this._sleepTimer,
            },
            stores: {
                debugOverridesStore: this._debugOverridesStore,
                subtitlePreferencesStore: this._subtitlePreferencesStore,
                epgPreferencesStore: this._epgPreferencesStore,
                nowPlayingDisplayStore: this._nowPlayingDisplayStore,
                profileSessionStore: this._profileSessionStore,
            },
            diagnostics: {
                appendIssueDiagnostic,
            },
            playback: {
                state: this._playbackStateAccessors,
                getPlaybackInfoSnapshot: (): PlaybackInfoSnapshot | null => this.getPlaybackInfoSnapshot(),
                refreshPlaybackInfoSnapshot: (): Promise<PlaybackInfoSnapshot> =>
                    this.refreshPlaybackInfoSnapshot(),
                stopPlayback: (): void => this._stopPlayback(),
                stopActiveTranscodeSession: (): void =>
                    this._requirePlaybackRuntimeController().stopActiveTranscodeSession(),
                getMimeType: (decision: StreamDecision): string => this._getMimeType(decision),
                buildPlexResourceUrl: (pathOrUrl: string): string | null => this._buildPlexResourceUrl(pathOrUrl),
            },
            schedule: {
                lastChannelChangeSource: (): 'remote' | 'number' | 'guide' | null => this._lastChannelChangeSource,
                setLastChannelChangeSource: (source: 'remote' | 'number' | 'guide' | null): void => {
                    this._lastChannelChangeSource = source;
                },
                setActiveScheduleDayKey: (dayKey: number): void => {
                    this._scheduleDayRolloverController?.setActiveScheduleDayKey(dayKey);
                },
                getSelectedServerId: (): string | null => this._getSelectedServerId(),
                getLocalMidnightMs: (timeMs: number): number => this._getLocalMidnightMs(timeMs),
                getLocalDayKey: (timeMs: number): number => this._getLocalDayKey(timeMs),
                buildDailyScheduleConfig: (
                    channel: ChannelConfig,
                    items: ResolvedChannelContent['items'],
                    referenceTimeMs: number
                ): ScheduleConfig => this._buildDailyScheduleConfig(channel, items, referenceTimeMs),
            },
            actions: {
                switchToChannel: (
                    channelId: string,
                    options?: { guideSelectionSnapshot?: import('../channel-tuning').GuideSelectionSnapshot }
                ): Promise<void> => this.switchToChannel(channelId, options),
                switchToNextChannel: (): void => this._switchToNextChannel(),
                switchToPreviousChannel: (): void => this._switchToPreviousChannel(),
                switchToChannelByNumberWithOutcome: (n: number): Promise<ChannelSwitchOutcome> =>
                    this._switchToChannelByNumberWithOutcome(n),
                toggleEPG: (): void => this.toggleEPG(),
                onOverlayVisibilityChange: (visible: boolean): void => {
                    this._requireOverlayRuntimePolicyController().handleOverlayVisibilityChange(visible);
                },
                toggleNowPlayingInfoOverlay: (): void => {
                    this._requireOverlayRuntimePolicyController().toggleNowPlayingInfoOverlay();
                },
            },
            errors: {
                handleGlobalError: (error: AppError, context: string): void =>
                    this.handleGlobalError(error, context),
            },
            nowPlaying: {
                handler: (): ((toast: ToastInput) => void) | null => this._nowPlayingHandler,
            },
        });

        this._epgCoordinator = coordinators.epgCoordinator;
        this._channelSetup = coordinators.channelSetup;
        this._nowPlayingDebugManager = coordinators.nowPlayingDebugManager;
        this._nowPlayingInfoCoordinator = coordinators.nowPlayingInfoCoordinator;
        this._playerOsdCoordinator = coordinators.playerOsdCoordinator;
        this._miniGuideCoordinator = coordinators.miniGuideCoordinator;
        this._channelTransitionCoordinator = coordinators.channelTransitionCoordinator;
        this._playbackOptionsCoordinator = coordinators.playbackOptionsCoordinator;
        this._exitConfirmCoordinator = coordinators.exitConfirmCoordinator;
        this._playbackRecovery = coordinators.playbackRecovery;
        this._channelTuning = coordinators.channelTuning;
        this._navigationCoordinator = coordinators.navigationCoordinator;
        this._scheduleDayRolloverController = new ScheduleDayRolloverController({
            now: (): number => Date.now(),
            getChannelManager: (): IChannelManager | null => this._channelManager,
            getScheduler: (): IChannelScheduler | null => this._scheduler,
            getEpgCoordinator: (): EPGCoordinator | null => this._epgCoordinator,
            getLocalMidnightMs: (timeMs: number): number => this._getLocalMidnightMs(timeMs),
            getLocalDayKey: (timeMs: number): number => this._getLocalDayKey(timeMs),
            buildDailyScheduleConfig: (
                channel: ChannelConfig,
                items: ResolvedChannelContent['items'],
                referenceTimeMs: number
            ): ScheduleConfig => this._buildDailyScheduleConfig(channel, items, referenceTimeMs),
            reportError: (message: string, error: unknown): void => {
                console.error(message, summarizeErrorForLog(error));
            },
        });
        this._subtitleTrackRecoveryController = new SubtitleTrackRecoveryController({
            getVideoPlayer: (): IVideoPlayer | null => this._videoPlayer,
            getPlaybackRecovery: (): PlaybackRecoveryManager | null => this._playbackRecovery,
            readSubtitleMode: (): import('../../shared/subtitle-mode').SubtitleMode =>
                this._subtitlePreferencesStore.readSubtitleMode('full'),
            setSubtitleTrack: (trackId: string | null): Promise<void> => this.setSubtitleTrack(trackId),
            nowPlayingWarn: (message: string): void => {
                this._nowPlayingHandler?.({ message, type: 'warning' });
            },
            getCurrentStreamDecision: (): StreamDecision | null => this._currentStreamDecision,
            getCurrentStreamDescriptor: (): StreamDescriptor | null => this._currentStreamDescriptor,
            appendIssueDiagnostic: ({ key, data }): void => {
                appendIssueDiagnostic(QA_003B_ISSUE_ID, key, data);
            },
        });
    }

    /**
     * Start the application - execute initialization sequence and begin playback.
     * Follows 5-phase initialization order per spec.
     */
    async start(): Promise<void> {
        if (!this._initCoordinator) {
            this._throwModuleInitPreconditionError('Orchestrator must be initialized before starting', {
                method: 'start',
                dependency: 'InitializationCoordinator',
            });
        }

        this._playbackRecovery?.resetPlaybackFailureGuard();
        await this._initCoordinator.runStartup(1);
    }

    /**
     * Shutdown the application gracefully.
     * Saves state, stops playback, and cleans up all resources.
     *
     * NOTE: The orchestrator follows a singleton lifecycle pattern.
     * After shutdown, the instance should be discarded. To restart,
     * create a new AppOrchestrator instance and call initialize() + start().
     * Internal state (_errorHandlers, _moduleStatus) is not reset because
     * instance reuse is not a supported pattern.
     */
    async shutdown(): Promise<void> {
        const teardownFailures: Array<{ step: string; error: unknown }> = [];
        const recordTeardownFailure = (step: string, error: unknown): void => {
            teardownFailures.push({ step, error: summarizeErrorForLog(error) });
        };

        if (this._initCoordinator) {
            this._initCoordinator.clearAuthResume();
            this._initCoordinator.clearServerResume();
            this._initCoordinator.clearProfileResume();
        }

        if (this._scheduleDayRolloverController) {
            try {
                this._scheduleDayRolloverController.dispose();
            } catch (error) {
                recordTeardownFailure('scheduleDayRolloverController.dispose', error);
            }
        }

        this._eventBinder?.dispose((error: unknown): void => {
            recordTeardownFailure('events.unsubscribe', error);
        });

        if (this._channelManager?.flushSaves) {
            try {
                await this._channelManager.flushSaves();
            } catch (error) {
                recordTeardownFailure('channelManager.flushSaves', error);
            }
        }
        if (this._channelManager?.dispose) {
            try {
                this._channelManager.dispose();
            } catch (error) {
                recordTeardownFailure('channelManager.dispose', error);
            }
        }

        // Shutdown lifecycle (flushes state and removes global listeners)
        if (this._lifecycle) {
            try {
                await this._lifecycle.shutdown();
            } catch (error) {
                recordTeardownFailure('lifecycle.shutdown', error);
            }
            this._lifecycle = null;
        }

        // Stop playback (resilient to errors)
        if (this._videoPlayer) {
            try {
                this._stopPlayback();
            } catch (error) {
                recordTeardownFailure('videoPlayer.stop', error);
            }
        }

        // Stop scheduler timer
        if (this._scheduler) {
            try {
                this._scheduler.pauseSyncTimer();
            } catch (error) {
                recordTeardownFailure('scheduler.pauseSyncTimer', error);
            }
            try {
                this._scheduler.unloadChannel();
            } catch (error) {
                recordTeardownFailure('scheduler.unloadChannel', error);
            }
        }

        // Destroy modules
        if (this._epg) {
            try {
                this._epg.destroy();
            } catch (error) {
                recordTeardownFailure('epg.destroy', error);
            }
        }
        if (this._epgDebugRuntime) {
            try {
                this._epgDebugRuntime.destroy();
            } catch (error) {
                recordTeardownFailure('epgDebugRuntime.destroy', error);
            }
            this._epgDebugRuntime = null;
        }
        try {
            this._nowPlayingInfoCoordinator?.dispose();
        } catch (error) {
            recordTeardownFailure('nowPlayingInfoCoordinator.dispose', error);
        }
        if (this._nowPlayingInfo) {
            try {
                this._nowPlayingInfo.destroy();
            } catch (error) {
                recordTeardownFailure('nowPlayingInfo.destroy', error);
            }
        }
        try {
            this._playerOsdCoordinator?.hide();
        } catch (error) {
            recordTeardownFailure('playerOsdCoordinator.hide', error);
        }
        if (this._playerOsd) {
            try {
                this._playerOsd.destroy();
            } catch (error) {
                recordTeardownFailure('playerOsd.destroy', error);
            }
        }
        if (this._channelNumberOverlay) {
            try {
                this._channelNumberOverlay.destroy();
            } catch (error) {
                recordTeardownFailure('channelNumberOverlay.destroy', error);
            }
            this._channelNumberOverlay = null;
        }
        if (this._channelBadgeOverlay) {
            try {
                this._channelBadgeOverlay.destroy();
            } catch (error) {
                recordTeardownFailure('channelBadgeOverlay.destroy', error);
            }
            this._channelBadgeOverlay = null;
        }
        try {
            this._miniGuideCoordinator?.hide();
        } catch (error) {
            recordTeardownFailure('miniGuideCoordinator.hide', error);
        }
        if (this._miniGuide) {
            try {
                this._miniGuide.destroy();
            } catch (error) {
                recordTeardownFailure('miniGuide.destroy', error);
            }
        }
        try {
            this._channelTransitionCoordinator?.hide();
        } catch (error) {
            recordTeardownFailure('channelTransitionCoordinator.hide', error);
        }
        if (this._channelTransitionOverlay) {
            try {
                this._channelTransitionOverlay.destroy();
            } catch (error) {
                recordTeardownFailure('channelTransitionOverlay.destroy', error);
            }
        }
        try {
            this._playbackOptionsCoordinator?.dispose();
        } catch (error) {
            recordTeardownFailure('playbackOptionsCoordinator.dispose', error);
        }
        if (this._playbackOptionsModal) {
            try {
                this._playbackOptionsModal.destroy();
            } catch (error) {
                recordTeardownFailure('playbackOptionsModal.destroy', error);
            }
        }
        if (this._exitConfirmModal) {
            if (this._navigation?.isModalOpen(EXIT_CONFIRM_MODAL_ID)) {
                try {
                    this._navigation.closeModal(EXIT_CONFIRM_MODAL_ID);
                } catch (error) {
                    recordTeardownFailure('navigation.closeModal(exit-confirm)', error);
                }
            }
            try {
                this._exitConfirmCoordinator?.handleModalClose(EXIT_CONFIRM_MODAL_ID);
            } catch (error) {
                recordTeardownFailure('exitConfirmCoordinator.handleModalClose', error);
            }
            try {
                this._exitConfirmModal.destroy();
            } catch (error) {
                recordTeardownFailure('exitConfirmModal.destroy', error);
            }
            this._exitConfirmModal = null;
        }
        if (this._videoPlayer) {
            try {
                this._videoPlayer.destroy();
            } catch (error) {
                recordTeardownFailure('videoPlayer.destroy', error);
            }
        }
        if (this._sleepTimer) {
            try {
                this._sleepTimer.destroy();
            } catch (error) {
                recordTeardownFailure('sleepTimer.destroy', error);
            }
            this._sleepTimer = null;
        }
        if (this._navigation) {
            try {
                this._navigation.destroy();
            } catch (error) {
                recordTeardownFailure('navigation.destroy', error);
            }
        }

        if (teardownFailures.length > 0) {
            console.warn('[Orchestrator] Shutdown teardown failures:', teardownFailures);
        }

        this._initCoordinator = null;
        this._scheduleDayRolloverController = null;
        this._subtitleTrackRecoveryController = null;
        this._ready = false;
    }

    /**
     * Get the status of all modules.
     */
    getModuleStatus(): Map<string, ModuleStatus> {
        return new Map(this._moduleStatus);
    }

    /**
     * Check if the orchestrator is ready for operations.
     */
    isReady(): boolean {
        return this._ready;
    }

    getSelectedServerId(): string | null {
        return this._getSelectedServerId();
    }

    getSelectedServerStorageKey(): string {
        return this._storageContext.getSelectedServerStorageKey();
    }

    getServerHealthStorageKey(): string {
        return this._storageContext.getServerHealthStorageKey();
    }

    /**
     * Get the currently active navigation screen.
     */
    getCurrentScreen(): Screen | null {
        if (!this._navigation) {
            return null;
        }
        return this._navigation.getCurrentScreen();
    }

    /**
     * Get the navigation manager instance.
     */
    getNavigation(): INavigationManager | null {
        return this._navigation;
    }

    getPlaybackInfoSnapshot(): PlaybackInfoSnapshot {
        const channel = this._channelManager?.getCurrentChannel() ?? null;
        const program = this._currentProgramForPlayback;
        const decision = this._currentStreamDecision;
        const descriptor = this._currentStreamDescriptor;

        return {
            channel: channel ? { id: channel.id, number: channel.number, name: channel.name } : null,
            program: program
                ? {
                    itemKey: program.item.ratingKey,
                    title: program.item.title,
                    fullTitle: program.item.fullTitle,
                    type: program.item.type,
                    scheduledStartTime: program.scheduledStartTime,
                    scheduledEndTime: program.scheduledEndTime,
                    elapsedMs: program.elapsedMs,
                    remainingMs: program.remainingMs,
                }
                : null,
            stream:
                decision && descriptor
                    ? {
                        protocol: descriptor.protocol,
                        mimeType: descriptor.mimeType,
                        isDirectPlay: decision.isDirectPlay,
                        isTranscoding: decision.isTranscoding,
                        container: decision.container,
                        videoCodec: decision.videoCodec,
                        audioCodec: decision.audioCodec,
                        subtitleDelivery: decision.subtitleDelivery,
                        bitrate: decision.bitrate,
                        width: decision.width,
                        height: decision.height,
                        sessionId: decision.sessionId,
                        selectedAudio: ((): {
                            id: string;
                            codec: string | null | undefined;
                            channels?: number;
                            language?: string;
                            title?: string;
                            default?: boolean;
                        } | null => {
                            const a = decision.selectedAudioStream;
                            if (!a) return null;
                            const out: {
                                id: string;
                                codec: string | null | undefined;
                                channels?: number;
                                language?: string;
                                title?: string;
                                default?: boolean;
                            } = { id: a.id, codec: a.codec };
                            if (typeof a.channels === 'number') out.channels = a.channels;
                            if (typeof a.language === 'string') out.language = a.language;
                            if (typeof a.title === 'string') out.title = a.title;
                            if (typeof a.default === 'boolean') out.default = a.default;
                            return out;
                        })(),
                        selectedSubtitle: ((): {
                            id: string;
                            codec: string | null | undefined;
                            language?: string;
                            title?: string;
                            format?: string;
                            default?: boolean;
                        } | null => {
                            const s = decision.selectedSubtitleStream;
                            if (!s) return null;
                            const out: {
                                id: string;
                                codec: string | null | undefined;
                                language?: string;
                                title?: string;
                                format?: string;
                                default?: boolean;
                            } = { id: s.id, codec: s.codec };
                            if (typeof s.language === 'string') out.language = s.language;
                            if (typeof s.title === 'string') out.title = s.title;
                            if (typeof s.format === 'string') out.format = s.format;
                            if (typeof s.default === 'boolean') out.default = s.default;
                            return out;
                        })(),
                        directPlay: decision.directPlay,
                        audioFallback: decision.audioFallback,
                        source: decision.source,
                        transcodeRequest: decision.transcodeRequest,
                        serverDecision: decision.serverDecision,
                    }
                    : null,
        };
    }

    async refreshPlaybackInfoSnapshot(): Promise<PlaybackInfoSnapshot> {
        const program = this._currentProgramForPlayback;
        const decision = this._currentStreamDecision;
        if (!program || !decision || !this._plexStreamResolver) {
            return this.getPlaybackInfoSnapshot();
        }

        await this._nowPlayingDebugManager?.ensureServerDecisionForPlaybackInfoSnapshot();

        return this.getPlaybackInfoSnapshot();
    }

    async setSubtitleTrack(trackId: string | null): Promise<void> {
        if (!this._videoPlayer) return;
        try {
            await this._videoPlayer.setSubtitleTrack(trackId);
        } catch (error) {
            console.warn('[Orchestrator] setSubtitleTrack failed:', {
                trackId,
                error: summarizeErrorForLog(error),
            });
            if (this._nowPlayingHandler) {
                this._nowPlayingHandler({ message: 'Could not update subtitles', type: 'warning' });
            }
        }
    }

    /**
     * Subscribe to navigation screen change events.
     */
    onScreenChange(handler: (from: string, to: string) => void): IDisposable {
        if (!this._navigation) {
            return { dispose: (): void => undefined };
        }
        const wrapped = (payload: { from: string; to: string }): void => {
            handler(payload.from, payload.to);
        };
        this._navigation.on('screenChange', wrapped);
        return {
            dispose: (): void => {
                if (this._navigation) {
                    this._navigation.off('screenChange', wrapped);
                }
            },
        };
    }

    /**
     * Request a Plex PIN for authentication.
     */
    async requestAuthPin(): Promise<PlexPinRequest> {
        if (!this._plexAuth) {
            this._throwModuleInitPreconditionError('PlexAuth not initialized', {
                method: 'requestAuthPin',
                dependency: 'PlexAuth',
            });
        }
        return this._plexAuth.requestPin();
    }

    /**
     * Poll for PIN claim status.
     */
    async pollForPin(pinId: number): Promise<PlexPinRequest> {
        if (!this._plexAuth) {
            this._throwModuleInitPreconditionError('PlexAuth not initialized', {
                method: 'pollForPin',
                dependency: 'PlexAuth',
            });
        }
        return this._plexAuth.pollForPin(pinId);
    }

    /**
     * Cancel an active PIN request.
     */
    async cancelPin(pinId: number): Promise<void> {
        if (!this._plexAuth) {
            this._throwModuleInitPreconditionError('PlexAuth not initialized', {
                method: 'cancelPin',
                dependency: 'PlexAuth',
            });
        }
        await this._plexAuth.cancelPin(pinId);
    }

    async getHomeUsers(): Promise<PlexHomeUser[]> {
        if (!this._plexAuth) {
            this._throwModuleInitPreconditionError('PlexAuth not initialized', {
                method: 'getHomeUsers',
                dependency: 'PlexAuth',
            });
        }
        return this._plexAuth.getHomeUsers();
    }

    getActiveUsername(): string | null {
        return this._plexAuth?.getCurrentUser()?.username ?? null;
    }

    async switchHomeUser(userId: string, pin?: string): Promise<void> {
        if (!this._plexAuth || !this._plexDiscovery) {
            const missingDependency = !this._plexAuth ? 'PlexAuth' : 'PlexServerDiscovery';
            this._throwModuleInitPreconditionError(`${missingDependency} not initialized`, {
                method: 'switchHomeUser',
                dependency: missingDependency,
            });
        }

        const cleanupController = this._requireProfileSwitchCleanupController();
        cleanupController.prepareForProfileSwitchAttempt();
        // Profile-switch startup is resumed explicitly below; avoid duplicate
        // queued startup runs from a stale profile-resume listener.
        this._initCoordinator?.clearProfileResume();
        await this._plexAuth.switchHomeUser(userId, { pin: pin ?? null });
        cleanupController.finalizeProfileSwitch();
        this._configureDiscoveryStorageKeysForActiveUser();
        await this._resumeStartupAfterProfileSwitch();
    }

    async useMainAccountProfile(): Promise<void> {
        if (!this._plexAuth || !this._plexDiscovery) {
            const missingDependency = !this._plexAuth ? 'PlexAuth' : 'PlexServerDiscovery';
            this._throwModuleInitPreconditionError(`${missingDependency} not initialized`, {
                method: 'useMainAccountProfile',
                dependency: missingDependency,
            });
        }

        const cleanupController = this._requireProfileSwitchCleanupController();
        cleanupController.prepareForProfileSwitchAttempt();
        // Same as switchHomeUser: avoid duplicate startup runs when an old
        // profile-resume listener is still registered.
        this._initCoordinator?.clearProfileResume();
        await this._plexAuth.logoutActiveUser();
        cleanupController.finalizeProfileSwitch();
        this._configureDiscoveryStorageKeysForActiveUser();
        await this._resumeStartupAfterProfileSwitch();
    }

    async signOutPlex(): Promise<void> {
        if (!this._plexAuth) {
            this._throwModuleInitPreconditionError('PlexAuth not initialized', {
                method: 'signOutPlex',
                dependency: 'PlexAuth',
            });
        }
        await this._plexAuth.clearCredentials();
        this._plexDiscovery?.clearSelection();
        if (this._initCoordinator) {
            await this._initCoordinator.runStartup(2);
        } else {
            this._navigation?.goTo('auth');
        }
    }

    /**
     * Discover Plex servers (optionally forcing refresh).
     */
    async discoverServers(forceRefresh: boolean = false): Promise<PlexServer[]> {
        if (!this._plexDiscovery) {
            this._throwModuleInitPreconditionError('PlexServerDiscovery not initialized', {
                method: 'discoverServers',
                dependency: 'PlexServerDiscovery',
            });
        }
        if (forceRefresh) {
            return this._plexDiscovery.refreshServers();
        }
        return this._plexDiscovery.discoverServers();
    }

    /**
     * Select a Plex server to connect to.
     */
    async selectServer(serverId: string): Promise<OrchestratorServerSelectionResult> {
        if (!this._plexDiscovery) {
            this._throwModuleInitPreconditionError('PlexServerDiscovery not initialized', {
                method: 'selectServer',
                dependency: 'PlexServerDiscovery',
            });
        }
        return this._serverSelectionCoordinator.selectServer(serverId);
    }

    /**
     * Clear saved server selection.
     */
    clearSelectedServer(): void {
        if (!this._plexDiscovery) {
            this._throwModuleInitPreconditionError('PlexServerDiscovery not initialized', {
                method: 'clearSelectedServer',
                dependency: 'PlexServerDiscovery',
            });
        }
        this._plexDiscovery.clearSelection();
        void this._persistSelectedServerForActiveUser(null, null);
    }

    private async _resumeStartupAfterProfileSwitch(): Promise<void> {
        this._navigation?.goTo('splash');
        if (this._initCoordinator) {
            await this._initCoordinator.runStartup(3);
            return;
        }
        if (!this._plexDiscovery) {
            throw new Error('PlexServerDiscovery not initialized');
        }
        await this._plexDiscovery.initialize();
    }

    getChannelSetupWorkflowPort(): ChannelSetupWorkflowPort {
        return this._channelSetupWorkflowPort;
    }

    requestChannelSetupRerun(): void {
        this._requireChannelSetupCoordinator().requestChannelSetupRerun();
    }

    // Runtime channel-switch commands are intentionally best-effort: remote input can
    // arrive before tuning modules are assembled, so these methods no-op safely.
    // Setup/capability entrypoints still enforce strict precondition throws.
    /**
     * Switch to a channel by ID.
     * Stops current playback, resolves content, configures scheduler, and syncs.
     * @param channelId - ID of channel to switch to
     */
    async switchToChannel(
        channelId: string,
        options?: {
            signal?: AbortSignal;
            guideSelectionSnapshot?: import('../channel-tuning').GuideSelectionSnapshot;
        }
    ): Promise<void> {
        if (!this._channelTuning) {
            if (!this._channelManager || !this._scheduler || !this._videoPlayer) {
                console.error('Modules not initialized');
            }
            return;
        }

        await this._channelTuning.switchToChannel(channelId, options);
    }

    /**
     * Switch to a channel by its number.
     * @param number - Channel number
     */
    async switchToChannelByNumber(number: number, options?: { signal?: AbortSignal }): Promise<void> {
        if (!this._channelTuning) {
            if (!this._channelManager || !this._scheduler || !this._videoPlayer) {
                console.error('Modules not initialized');
            }
            return;
        }

        await this._channelTuning.switchToChannelByNumber(number, options);
    }

    private async _switchToChannelByNumberWithOutcome(
        number: number,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSwitchOutcome> {
        if (!this._channelTuning) {
            if (!this._channelManager || !this._scheduler || !this._videoPlayer) {
                console.error('Modules not initialized');
            }
            return 'failed';
        }

        try {
            return await this._channelTuning.switchToChannelByNumber(number, options);
        } catch (error: unknown) {
            if (isAbortLikeError(error, options?.signal)) {
                return 'aborted';
            }
            console.error('switchToChannelByNumberWithOutcome failed:', summarizeErrorForLog(error));
            return 'failed';
        }
    }

    /**
     * Open the EPG overlay.
     */
    openEPG(): void {
        this._epgCoordinator?.openEPG();
    }

    /**
     * Close the EPG overlay.
     */
    closeEPG(): void {
        this._epgCoordinator?.closeEPG();
    }

    /**
     * Open the server selection screen.
     */
    openServerSelect(options?: { allowAutoConnect?: boolean }): void {
        if (!this._navigation) {
            return;
        }
        this._navigation.goTo('server-select', {
            allowAutoConnect: options?.allowAutoConnect === true,
        });
    }

    /**
     * Toggle the server selection screen.
     */
    toggleServerSelect(): void {
        if (!this._navigation) {
            return;
        }

        const current = this._navigation.getCurrentScreen();
        if (current === 'server-select') {
            // Attempt to go back; if stack is empty, force player
            if (!this._navigation.goBack()) {
                this._navigation.replaceScreen('player');
            }
        } else {
            this.openServerSelect();
        }
    }

    /**
     * Toggle EPG visibility.
     */
    toggleEPG(): void {
        this._epgCoordinator?.toggleEPG();
    }

    onGuideSettingChange(change: GuideSettingChange): void {
        this._epgCoordinator?.handleGuideSettingChange(change);
    }

    /**
     * Handle a global application error.
     * Routes to module-specific handlers first, then reports via lifecycle.
     * @param error - The error to handle
     * @param context - Module or operation context
     */
    handleGlobalError(error: AppError, context: string): void {
        console.error(`[${context}] Error:`, summarizeErrorForLog(error));

        // Try module-specific handlers first
        for (const [moduleId, handler] of this._errorHandlers) {
            try {
                const handled = handler(error);
                if (handled) {
                    console.warn(`Error handled by ${moduleId}`);
                    return;
                }
            } catch (handlerError) {
                console.error(`Error in handler for ${moduleId}:`, summarizeErrorForLog(handlerError));
            }
        }

        // Report via lifecycle for UI display
        if (this._lifecycle) {
            this._lifecycle.reportError(error);
        }
    }

    /**
     * Register a module-specific error handler.
     * @param moduleId - Module identifier
     * @param handler - Handler function, returns true if handled
     */
    registerErrorHandler(
        moduleId: string,
        handler: (error: AppError) => boolean
    ): void {
        this._errorHandlers.set(moduleId, handler);
    }

    /**
     * Get recovery actions for a specific error code.
     * Covers all AppErrorCode values per spec.
     * @param errorCode - Error code to get actions for
     */
    getRecoveryActions(errorCode: AppErrorCode): ErrorRecoveryAction[] {
        return getRecoveryActionsHelper(errorCode, {
            goToAuth: (): void => {
                if (this._navigation) {
                    this._navigation.goTo('auth');
                }
            },
            goToServerSelect: (): void => {
                if (this._navigation) {
                    this._navigation.goTo('server-select');
                }
            },
            goToChannelEdit: (): void => {
                if (this._navigation) {
                    this._navigation.goTo('channel-edit');
                }
            },
            goToSettings: (): void => {
                if (this._navigation) {
                    this._navigation.goTo('settings');
                }
            },
            retryStart: (): void => {
                this.start().catch((error: unknown) => {
                    console.error('[Orchestrator] Retry start failed:', summarizeErrorForLog(error));
                });
            },
            exitApp: (): void => {
                this.shutdown().catch((error: unknown) => {
                    console.error('[Orchestrator] Shutdown failed:', summarizeErrorForLog(error));
                });
            },
            skipToNext: (): void => {
                if (this._scheduler) {
                    this._scheduler.skipToNext();
                }
            },
        });
    }

    public toLifecycleAppError(error: AppError): LifecycleAppError {
        return toLifecycleAppErrorHelper(error, {
            getPhase: (): AppPhase => (this._lifecycle ? this._lifecycle.getPhase() : 'error'),
            getUserMessage: (code: AppErrorCode): string =>
                this._lifecycle ? this._lifecycle.getErrorRecovery().getUserMessage(code) : error.message,
            getRecoveryActions: (code: AppErrorCode): ErrorRecoveryAction[] =>
                this.getRecoveryActions(code),
            nowMs: (): number => Date.now(),
        });
    }

    public onLifecycleEvent<K extends keyof LifecycleEventMap>(
        event: K,
        handler: (payload: LifecycleEventMap[K]) => void
    ): IDisposable {
        if (!this._lifecycle) {
            return { dispose: (): void => undefined };
        }
        return this._lifecycle.on(event, handler);
    }

    // ============================================
    // Private Methods - Initialization Phases
    // ============================================

    private _initializeModuleStatus(): void {
        const modules = [
            'event-emitter',
            'app-lifecycle',
            'navigation',
            'plex-auth',
            'plex-server-discovery',
            'plex-library',
            'plex-stream-resolver',
            'channel-manager',
            'channel-scheduler',
            'video-player',
            'epg-ui',
            'now-playing-info-ui',
            'player-osd-ui',
            'channel-number-overlay-ui',
            'channel-badge-ui',
            'mini-guide-ui',
            'channel-transition-ui',
            'playback-options-ui',
            'exit-confirm-ui',
        ];

        for (const id of modules) {
            this._moduleStatus.set(id, {
                id,
                name: id,
                status: 'pending',
            });
        }
    }

    private _updateModuleStatus(
        id: string,
        status: ModuleStatus['status'],
        error?: AppError,
        loadTimeMs?: number
    ): void {
        const current = this._moduleStatus.get(id);
        if (current) {
            current.status = status;

            // Clear stale error when transitioning to non-error state
            if (status !== 'error') {
                delete current.error;
            }
            if (error) {
                current.error = error;
            }

            // Clear stale loadTimeMs except when explicitly provided
            if (status !== 'initializing' && loadTimeMs === undefined) {
                delete current.loadTimeMs;
            }
            if (loadTimeMs !== undefined) {
                current.loadTimeMs = loadTimeMs;
            }
        }
    }

    private _getSelectedServerId(): string | null {
        if (!this._plexDiscovery) {
            return null;
        }
        const server = this._plexDiscovery.getSelectedServer();
        return server ? server.id : null;
    }

    private _getActiveUserId(): string | null {
        if (!this._plexAuth) {
            return null;
        }
        return this._plexAuth.getActiveUserId() ?? this._plexAuth.getAccountUserId() ?? null;
    }

    private _configureDiscoveryStorageKeysForActiveUser(): void {
        this._storageContext.configureDiscoveryStorageKeysForActiveUser();
    }

    private _seedSubtitleLanguageFromPlexUser(): void {
        const existing = this._subtitlePreferencesStore.readSubtitleLanguage();
        if (typeof existing === 'string' && existing.trim().length > 0) {
            return;
        }
        const plexPreferred = this._plexAuth?.getCurrentUser()?.preferredSubtitleLanguage ?? null;
        if (typeof plexPreferred !== 'string') {
            return;
        }
        const normalized = plexPreferred.trim();
        if (normalized.length === 0) {
            return;
        }
        this._subtitlePreferencesStore.writeSubtitleLanguage(normalized);
    }

    private async _configureChannelManagerStorageForSelectedServer(): Promise<void> {
        await this._storageContext.configureChannelManagerStorageForSelectedServer();
    }

    private async _persistSelectedServerForActiveUser(
        serverId: string | null,
        serverUri: string | null
    ): Promise<'updated' | 'skipped_missing_credentials' | 'skipped_corrupted_credentials'> {
        if (!this._plexAuth) {
            return 'skipped_missing_credentials';
        }
        const stored = await this._plexAuth.getStoredCredentials();
        if (stored.kind === 'missing') {
            return 'skipped_missing_credentials';
        }
        if (stored.kind === 'corrupted') {
            return 'skipped_corrupted_credentials';
        }
        const credentials = stored.credentials;
        const activeUserId = this._plexAuth.getActiveUserId() ?? credentials.activeUserId;
        if (!activeUserId) {
            return 'skipped_missing_credentials';
        }
        const selectedServerByUserId = {
            ...(credentials.selectedServerByUserId ?? {}),
        };
        selectedServerByUserId[activeUserId] = { serverId, serverUri };
        await this._plexAuth.storeCredentials({
            accountToken: credentials.accountToken,
            activeToken: credentials.activeToken,
            activeUserId,
            selectedServerByUserId,
            deviceKey: credentials.deviceKey ?? null,
        });
        return 'updated';
    }

    private _shouldRunAudioSetup(): boolean {
        return !this._audioSettingsStore.readAudioSetupComplete(false);
    }

    private _getLocalMidnightMs(timeMs: number): number {
        const date = new Date(timeMs);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }

    private _getLocalDayKey(timeMs: number): number {
        const date = new Date(timeMs);
        return (date.getFullYear() * 10000) + ((date.getMonth() + 1) * 100) + date.getDate();
    }

    private _calculateLoopDurationMs(items: ResolvedChannelContent['items']): number {
        let total = 0;
        for (const item of items) {
            total += item.durationMs;
        }
        return total;
    }

    private _getPhaseOffsetMs(channel: ChannelConfig, items: ResolvedChannelContent['items']): number {
        const loopDurationMs = this._calculateLoopDurationMs(items);
        if (!Number.isFinite(loopDurationMs) || loopDurationMs <= 0) {
            return 0;
        }
        const seed =
            typeof channel.phaseSeed === 'number' && Number.isFinite(channel.phaseSeed)
                ? channel.phaseSeed
                : 0;
        if (seed === 0) {
            return 0;
        }
        const random = createMulberry32(seed);
        return Math.floor(random() * loopDurationMs);
    }

    private _buildDailyScheduleConfig(
        channel: ChannelConfig,
        items: ResolvedChannelContent['items'],
        referenceTimeMs: number
    ): ScheduleConfig {
        const dayStart = this._getLocalMidnightMs(referenceTimeMs);
        const dayKey = this._getLocalDayKey(dayStart);
        const phaseOffsetMs = this._getPhaseOffsetMs(channel, items);

        const isRandomPlayback = channel.playbackMode === 'random';
        const playbackMode: ScheduleConfig['playbackMode'] =
            isRandomPlayback ? 'shuffle' : (channel.playbackMode as ScheduleConfig['playbackMode']);
        const baseSeed = this._computeSchedulerBaseSeed(channel, dayStart);
        const isShuffleLike = playbackMode === 'shuffle' || playbackMode === 'block';
        const effectiveSeed = isShuffleLike ? (baseSeed ^ dayKey) >>> 0 : baseSeed;

        const scheduleConfig: ScheduleConfig = {
            channelId: channel.id,
            anchorTime: dayStart - phaseOffsetMs,
            content: items,
            playbackMode,
            shuffleSeed: effectiveSeed,
            loopSchedule: true,
        };

        if (typeof channel.blockSize === 'number' && Number.isFinite(channel.blockSize)) {
            scheduleConfig.blockSize = channel.blockSize;
        }

        return scheduleConfig;
    }

    private _computeSchedulerBaseSeed(channel: ChannelConfig, dayStart: number): number {
        const configuredShuffleSeed =
            typeof channel.shuffleSeed === 'number' && Number.isFinite(channel.shuffleSeed)
                ? channel.shuffleSeed
                : fnv1a32Uint(`${channel.id}:shuffle`);

        if (channel.playbackMode === 'random') {
            return (configuredShuffleSeed ^ dayStart) >>> 0;
        }

        return configuredShuffleSeed;
    }

    private _handlePlexLibraryAuthExpired(): void {
        this.handleGlobalError(
            {
                code: AppErrorCode.AUTH_EXPIRED,
                message: 'Authentication expired',
                recoverable: true,
            },
            'plex-library'
        );
    }

    private _handlePlexStreamError(error: StreamResolverError): void {
        const mapped = mapPlexStreamErrorCodeToAppErrorCode(error.code);
        if (
            mapped === AppErrorCode.AUTH_REQUIRED ||
            mapped === AppErrorCode.AUTH_EXPIRED ||
            mapped === AppErrorCode.AUTH_INVALID
        ) {
            this.handleGlobalError(
                {
                    code: mapped,
                    message: error.message,
                    recoverable: error.recoverable,
                },
                'plex-stream'
            );
        }
    }

    private _initializePriorityOneControllers(): void {
        if (this._eventBinder) {
            return;
        }
        if (this._priorityOneControllersInitializing) {
            return;
        }
        this._priorityOneControllersInitializing = true;
        try {
            if (!this._scheduler) {
                throw new Error('Priority 1 controller initialization requires scheduler');
            }
            if (!this._videoPlayer) {
                throw new Error('Priority 1 controller initialization requires video player');
            }
            if (!this._lifecycle) {
                throw new Error('Priority 1 controller initialization requires lifecycle');
            }
            if (!this._playbackRecovery) {
                throw new Error('Priority 1 controller initialization requires playback recovery');
            }

            const priorityOne = createPriorityOneControllersAndBinder({
                scheduler: this._scheduler,
                videoPlayer: this._videoPlayer,
                lifecycle: this._lifecycle,
                playbackRecovery: this._playbackRecovery,
                channelBadgeOverlay: this._channelBadgeOverlay,
                playerOsd: this._playerOsd,
                nowPlayingInfo: this._nowPlayingInfo,
                epg: this._epg,
                channelManager: this._channelManager,
                navigation: this._navigation,
                plexLibrary: this._plexLibrary,
                plexStreamResolver: this._plexStreamResolver,
                playbackState: this._playbackStateAccessors,
                cancelPendingDayRollover: (): void => {
                    this._scheduleDayRolloverController?.cancelPendingDayRollover();
                },
                stopPlayback: (): void => this._stopPlayback(),
                unloadCurrentChannel: (): void => {
                    this._scheduler?.unloadChannel();
                },
                stopTranscodeSessionById: (sessionId: string): void => {
                    void this._plexStreamResolver?.stopTranscodeSession(sessionId);
                },
                skipToNextProgram: (): void => {
                    this._scheduler?.skipToNext();
                },
                pausePlayer: (): void => {
                    this._videoPlayer?.pause();
                },
                playPlayer: (): Promise<void> => this._videoPlayer?.play() ?? Promise.resolve(),
                pauseSchedulerSync: (): void => {
                    this._scheduler?.pauseSyncTimer();
                },
                resumeSchedulerSync: (): void => {
                    this._scheduler?.resumeSyncTimer();
                },
                syncSchedulerToCurrentTime: (): void => {
                    this._scheduler?.syncToCurrentTime();
                },
                handleGlobalError: (error: AppError, context: string): void => {
                    this.handleGlobalError(error, context);
                },
                onPlayerStateChange: (state): void => {
                    this._playerOsdCoordinator?.onPlayerStateChange(state);
                    this._channelTransitionCoordinator?.onPlayerStateChange(state);
                },
                showInfoBanner: (): void => {
                    this._playerOsdCoordinator?.showInfoBanner();
                },
                onPlayerTimeUpdate: (payload): void => {
                    this._playerOsdCoordinator?.onTimeUpdate(payload);
                },
                onPlayerBufferUpdate: (payload): void => {
                    this._playerOsdCoordinator?.onBufferUpdate(payload);
                },
                onProgramStartUiSideEffects: (program): void => {
                    this._nowPlayingInfoCoordinator?.onProgramStart(program);
                    this._requireOverlayRuntimePolicyController().syncChannelBadgeOverlay();
                    this._epgCoordinator?.refreshEpgScheduleForLiveChannel();
                },
                onStreamResolved: (): void => {
                    this._nowPlayingDebugManager?.maybeAutoShowNowPlayingStreamDebugHud();
                    void this._nowPlayingDebugManager?.maybeFetchNowPlayingStreamDecisionForDebugHud();
                },
                onPlaybackStartFailure: (error: unknown): void => {
                    console.error('Failed to load stream:', summarizeErrorForLog(error));
                },
                wireNavigationCoordinatorEvents: (): Array<() => void> =>
                    this._navigationCoordinator?.wireNavigationEvents() ?? [],
                wireEpgCoordinatorEvents: (): Array<() => void> =>
                    this._epgCoordinator?.wireEpgEvents() ?? [],
                handleScheduleDayRollover: (): Promise<void> =>
                    this._scheduleDayRolloverController?.handleScheduleDayRollover() ?? Promise.resolve(),
                handlePlayerTrackChange: (event): void => {
                    this._playbackOptionsCoordinator?.refreshIfOpen();
                    this._subtitleTrackRecoveryController?.handleTrackChange(event);
                },
                handlePlexLibraryAuthExpired: (): void => this._handlePlexLibraryAuthExpired(),
                handlePlexStreamError: (error): void => this._handlePlexStreamError(error),
                handleScreenChange: (payload): void => this._handleScreenChange(payload),
                reportPersistenceWarning: (message): void => {
                    this._nowPlayingHandler?.({ message, type: 'warning' });
                },
                nowPlayingModalId: NOW_PLAYING_INFO_MODAL_ID,
            });

            this._overlayRuntimePolicyController = priorityOne.overlayRuntimePolicyController;
            this._playbackRuntimeController = priorityOne.playbackRuntimeController;
            this._profileSwitchCleanupController = priorityOne.profileSwitchCleanupController;
            this._eventBinder = priorityOne.eventBinder;
        } finally {
            this._priorityOneControllersInitializing = false;
        }
    }

    private _handleScreenChange(payload: { from: Screen; to: Screen }): void {
        this._channelTransitionCoordinator?.onScreenChange(payload.to);
    }

    private _requireEventBinder(): OrchestratorEventBinder {
        if (!this._eventBinder) {
            throw new Error('OrchestratorEventBinder not initialized');
        }
        return this._eventBinder;
    }

    private _requireOverlayRuntimePolicyController(): OverlayRuntimePolicyController {
        if (!this._overlayRuntimePolicyController) {
            throw new Error('OverlayRuntimePolicyController not initialized');
        }
        return this._overlayRuntimePolicyController;
    }

    private _requireProfileSwitchCleanupController(): ProfileSwitchCleanupController {
        if (!this._profileSwitchCleanupController) {
            throw new Error('ProfileSwitchCleanupController not initialized');
        }
        return this._profileSwitchCleanupController;
    }

    private _requirePlaybackRuntimeController(): PlaybackRuntimeController {
        if (!this._playbackRuntimeController) {
            throw new Error('PlaybackRuntimeController not initialized');
        }
        return this._playbackRuntimeController;
    }

    private _requireChannelSetupCoordinator(): ChannelSetupCoordinator {
        if (!this._channelSetup) {
            throw new Error('Channel setup not initialized');
        }
        return this._channelSetup;
    }

    private _stopPlayback(): void {
        this._playbackRuntimeController?.stopActiveTranscodeSession();
        this._videoPlayer?.stop();
    }

    private _buildPlexResourceUrl(pathOrUrl: string): string | null {
        try {
            const baseUri = this._plexDiscovery?.getServerUri() ?? null;
            const headers = this._plexAuth?.getAuthHeaders() ?? {};
            return buildPlexResourceUrlWithAuth(baseUri, pathOrUrl, headers);
        } catch {
            return null;
        }
    }

    /**
     * Get MIME type from stream decision.
     */
    private _getMimeType(decision: StreamDecision): string {
        if (decision.protocol === 'hls') {
            return MIME_TYPES.hls || 'application/x-mpegURL';
        }
        if (decision.container) {
            const mime = MIME_TYPES[decision.container];
            if (mime) return mime;
        }
        // Fallback
        return 'video/mp4';
    }

    /**
     * Switch to next channel.
     */
    private _switchToNextChannel(): void {
        if (!this._channelManager) return;

        const nextChannel = this._channelManager.getNextChannel();
        if (nextChannel) {
            this.switchToChannel(nextChannel.id).catch((error: unknown) => {
                if (isAbortLikeError(error)) return;
                console.error('[Orchestrator] Next channel switch failed:', summarizeErrorForLog(error));
            });
        }
    }

    /**
     * Switch to previous channel.
     */
    private _switchToPreviousChannel(): void {
        if (!this._channelManager) return;

        const prevChannel = this._channelManager.getPreviousChannel();
        if (prevChannel) {
            this.switchToChannel(prevChannel.id).catch((error: unknown) => {
                if (isAbortLikeError(error)) return;
                console.error('[Orchestrator] Previous channel switch failed:', summarizeErrorForLog(error));
            });
        }
    }

    setNowPlayingHandler(handler: ((toast: ToastInput) => void) | null): void {
        this._nowPlayingHandler = handler;
    }
}
