/**
 * Application Orchestrator responsibilities:
 * - Module initialization in dependency order
 * - Cross-module event wiring
 * - State restoration on startup
 * - Error handling and recovery
 * - Runtime collaborator composition
 */

import {
    type IAppLifecycle,
    type AppError,
    type LifecycleAppError,
    type AppPhase,
    type LifecycleEventMap,
} from '../../modules/lifecycle';
import { AppErrorCode } from '../../types/app-errors';
import type { ChannelSwitchOutcome } from '../../types/channelSwitch';
import {
    type INavigationManager,
    type Screen,
} from '../../modules/navigation';
import type { GuideSettingChange } from '../../modules/ui/settings/types';
import { NavigationCoordinator } from '../../modules/navigation/coordinator/NavigationCoordinator';
import {
    type IPlexAuth,
    type PlexPinRequest,
    type PlexHomeUser,
} from '../../modules/plex/auth';
import {
    type IPlexServerDiscovery,
    type PlexServer,
    isPlexDiscoverySelectionSupersededError,
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
import { MIME_TYPES } from '../../modules/plex/stream/policy/constants'; // Fix Direct Play MIME types
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
import { PlaybackRecoveryManager } from '../../modules/player';
import {
    EPGCoordinator,
    EPGDebugRuntime,
    type IEPGDebugRuntime,
    type IEPGComponent,
} from '../../modules/ui/epg';
import {
    type INowPlayingInfoOverlay,
    NowPlayingInfoCoordinator,
    NOW_PLAYING_INFO_MODAL_ID,
} from '../../modules/ui/now-playing-info';
import {
    PlayerOsdCoordinator,
    PlayerOsdOverlay,
} from '../../modules/ui/player-osd';
import { SleepTimerManager } from '../../modules/ui/sleep-timer';
import {
    MiniGuideCoordinator,
    type IMiniGuideOverlay,
} from '../../modules/ui/mini-guide';
import {
    ChannelTransitionCoordinator,
    ChannelTransitionOverlay,
} from '../../modules/ui/channel-transition';
import {
    type IPlaybackOptionsModal,
} from '../../modules/ui/playback-options';
import {
    ExitConfirmCoordinator,
    ExitConfirmModal,
    EXIT_CONFIRM_MODAL_ID,
} from '../../modules/ui/exit-confirm';
import { InitializationCoordinator, STARTUP_PHASE } from '../initialization/InitializationCoordinator';
import { ChannelTuningCoordinator } from '../channel-tuning';
import { OrchestratorStorageContext } from './storage/OrchestratorStorageContext';
import { OrchestratorEventBinder } from './events/OrchestratorEventBinder';
import { OverlayRuntimePolicyController } from './controllers/OverlayRuntimePolicyController';
import { ProfileSwitchCleanupController } from './controllers/ProfileSwitchCleanupController';
import { PlaybackRuntimeController } from './priority-one/PlaybackRuntimeController';
import type {
    OrchestratorServerSelectionResult,
} from '../server-selection/ServerSelectionTypes';
import { clearIdentityScopedRuntimeState } from './runtime/clearIdentityScopedRuntimeState';
import { buildPlexResourceUrlSafely } from './runtime/buildPlexResourceUrlSafely';
import type {
    ModuleStatus,
    OrchestratorConfig,
} from './contracts/OrchestratorTypes';
import { createOrchestratorModules } from './assembly/OrchestratorModuleFactory';
import {
    createOrchestratorCoordinatorAssemblyInput,
    createOrchestratorCoordinators,
} from './assembly/OrchestratorCoordinatorAssembly';
import type {
    OrchestratorCoordinatorAssemblyInputDraft,
    OrchestratorCoordinators,
} from './assembly/OrchestratorCoordinatorContracts';
import {
    createPriorityOneRuntimeAssembly,
    type PriorityOneControllersAndBinder,
} from './priority-one/PriorityOneAssemblyBuilder';
import type {
    ChannelBadgeOverlayInitPort,
    ChannelNumberOverlayInitPort,
} from './contracts/OverlayPorts';
import type { OrchestratorPlaybackStateAccessors } from './runtime/OrchestratorPlaybackStateAccessors';
import { createPlaybackInfoSnapshot, type PlaybackInfoSnapshot } from './runtime/OrchestratorPlaybackInfoSnapshot';
import { ChannelSetupCoordinator } from '../channel-setup/ChannelSetupCoordinator';
import { createChannelSetupWorkflowPort } from '../channel-setup/workflow/createChannelSetupWorkflowPort';
import type { ChannelSetupWorkflowPortOwners } from '../channel-setup/workflow/createChannelSetupWorkflowPort';
import type { ChannelSetupWorkflowPort } from '../channel-setup/workflow/ChannelSetupWorkflowPort';
import type { ChannelSetupRerunRequestResult } from '../channel-setup/types';
import { NowPlayingDebugManager } from '../../modules/debug/NowPlayingDebugManager';
import { DebugOverridesStore } from '../../modules/debug/DebugOverridesStore';
import { IssueDiagnosticsStore, type AppendIssueDiagnostic } from '../../modules/debug/IssueDiagnosticsStore';
import { PlaybackOptionsCoordinator } from '../../modules/ui/playback-options';
import { EpgPreferencesStore } from '../../modules/settings/EpgPreferencesStore';
import { NowPlayingDisplayStore } from '../../modules/settings/NowPlayingDisplayStore';
import { ProfileSessionStore } from '../../modules/settings/ProfileSessionStore';
import { SubtitlePreferencesStore } from '../../modules/settings/SubtitlePreferencesStore';
import { AudioSettingsStore } from '../../modules/settings/AudioSettingsStore';
import { DeveloperSettingsStore } from '../../modules/settings/DeveloperSettingsStore';
import type { IDisposable } from '../../utils/interfaces';
import { getRecoveryActions as getRecoveryActionsHelper } from '../error-recovery/RecoveryActions';
import { toLifecycleAppError as toLifecycleAppErrorHelper } from '../error-recovery/LifecycleErrorAdapter';
import type { ErrorRecoveryAction } from '../error-recovery/types';
import type { ToastInput } from '../../shared/toast';
import type { PlatformServices } from '../../platform';
import { createWebOsPlatformServices } from '../../platform';
import { summarizeErrorForLog } from '../../utils/errors';
import { ScheduleDayRolloverController } from './controllers/ScheduleDayRolloverController';
import { SubtitleTrackRecoveryController } from './controllers/SubtitleTrackRecoveryController';
import { createOrchestratorRuntimeControllers } from './runtime/OrchestratorRuntimeControllerBuilder';
import { OrchestratorSchedulePolicy } from './policy/OrchestratorSchedulePolicy';
import { createAppStartupUiInitializer } from '../app-shell/chrome/AppStartupUiPortFactory';
import {
    createDefaultRecoverableRuntimeIssueReporter,
    type RecoverableRuntimeIssueReporter,
} from './runtime/OrchestratorRecoverableRuntimeReporter';
import type { RecoverableAsyncFailureReporter } from './runtime/OrchestratorRuntimeSeams';
import {
    captureRecoverableRuntimeResult,
    captureRecoverableRuntimeResultAsync,
} from './runtime/OrchestratorRecoverableRuntimeResult';
import { OrchestratorShutdownTeardown } from './runtime/OrchestratorShutdownTeardown';
import { OrchestratorChannelSwitchRuntime } from './runtime/OrchestratorChannelSwitchRuntime';
import { OrchestratorPlexAuthRuntime } from './runtime/OrchestratorPlexAuthRuntime';
import { OrchestratorServerSelectionRuntime } from './runtime/OrchestratorServerSelectionRuntime';
import type { SelectedServerScreenState } from '../server-selection/SelectedServerScreenStateProjection';

const QA_003B_ISSUE_ID = 'QA-003b';


/**
 * AppOrchestrator - Central coordinator for all application modules.
 *
 * Manages:
 * - Module initialization in 5 phases
 * - Cross-module event wiring
 * - State restoration on startup
 * - Error handling with recovery actions
 * - Runtime collaborator composition
 */
export class AppOrchestrator {
    private static readonly MAX_PENDING_GLOBAL_ERRORS = 5;
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
    private readonly _developerSettingsStore = new DeveloperSettingsStore();
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
    private _isHandlingGlobalError = false;
    private _pendingGlobalErrors: Array<{ error: AppError; context: string }> = [];
    private _eventBinder: OrchestratorEventBinder | null = null;
    private _ready: boolean = false;
    private _initCoordinator: InitializationCoordinator | null = null;
    private _channelSetup: ChannelSetupCoordinator | null = null;
    private _channelSetupPortOwners: ChannelSetupWorkflowPortOwners | null = null;
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
    private readonly _recoverableRuntimeReporter: RecoverableRuntimeIssueReporter;
    private _epgDebugRuntime: IEPGDebugRuntime | null = null;
    private readonly _playbackStateAccessors: OrchestratorPlaybackStateAccessors;
    private readonly _channelSetupWorkflowPort: ChannelSetupWorkflowPort;
    private readonly _channelSwitchRuntime: OrchestratorChannelSwitchRuntime;
    private readonly _plexAuthRuntime: OrchestratorPlexAuthRuntime;
    private readonly _serverSelectionRuntime: OrchestratorServerSelectionRuntime;
    private readonly _schedulePolicy = new OrchestratorSchedulePolicy();
    private readonly _reportedModuleStatusCloneFallbackContexts = new WeakSet<object>();
    private _shutdownStarted = false;
    private _shutdownPromise: Promise<void> | null = null;

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

    private _throwShutdownPreconditionError(method: string): never {
        throw Object.assign(new Error('AppOrchestrator cannot be used after shutdown; create a new instance.'), {
            code: AppErrorCode.MODULE_INIT_FAILED,
            recoverable: false,
            context: {
                method,
                lifecycle: 'shutdown',
            },
        } satisfies Pick<AppError, 'code' | 'recoverable' | 'context'>);
    }

    private _assertNotShutdown(method: string): void {
        if (this._shutdownStarted) {
            this._throwShutdownPreconditionError(method);
        }
    }

    private _getAuthoritativeCurrentProgramForPlayback(): ScheduledProgram | null {
        const schedulerState = this._scheduler?.getState();
        if (schedulerState?.isActive) {
            return schedulerState.currentProgram ?? null;
        }
        return this._currentProgramForPlayback;
    }

    private _warnRecoverableRuntimeIssue(
        event: string,
        message: string,
        data: Record<string, unknown> = {}
    ): void {
        this._recoverableRuntimeReporter.reportIssue(event, message, data);
    }

    private _warnRecoverableRuntimeError(
        event: string,
        message: string,
        error: unknown,
        data: Record<string, unknown> = {}
    ): void {
        this._recoverableRuntimeReporter.reportError(event, message, error, data);
    }

    private readonly _reportRecoverableAsyncFailure: RecoverableAsyncFailureReporter = (
        event,
        message,
        error,
        data
    ): void => {
        this._warnRecoverableRuntimeError(event, message, error, data);
    };

    constructor(platformServices?: PlatformServices) {
        this._platformServices = platformServices ?? createWebOsPlatformServices();
        this._recoverableRuntimeReporter = createDefaultRecoverableRuntimeIssueReporter(
            QA_003B_ISSUE_ID,
            this._issueDiagnosticsStore.append.bind(this._issueDiagnosticsStore)
        );
        this._serverSelectionRuntime = new OrchestratorServerSelectionRuntime({
            assertNotShutdown: this._assertNotShutdown.bind(this),
            getPlexAuth: (): IPlexAuth | null => this._plexAuth,
            getPlexDiscovery: (): IPlexServerDiscovery | null => this._plexDiscovery,
            getInitializationCoordinator: (): InitializationCoordinator | null => this._initCoordinator,
            getEpg: (): IEPGComponent | null => this._epg,
            getEpgCoordinator: (): EPGCoordinator | null => this._epgCoordinator,
            isReady: (): boolean => this._ready,
            reportError: (
                event: string,
                message: string,
                error: unknown,
                data?: Record<string, unknown>
            ): void => {
                this._warnRecoverableRuntimeError(event, message, error, data);
            },
            throwModuleInitPreconditionError: this._throwModuleInitPreconditionError.bind(this),
        });
        this._storageContext = new OrchestratorStorageContext({
            getActiveUserId: this._getActiveUserId.bind(this),
            getSelectedServerId: (): string | null => this._serverSelectionRuntime.getSelectedServerId(),
            setDiscoveryStorageKeys: (selectedKey: string, healthKey: string): void => {
                this._plexDiscovery?.setStorageKeys(selectedKey, healthKey);
            },
            setChannelManagerStorageKeys: (channelsKey: string, currentChannelKey: string): void => {
                this._channelManager?.setStorageKeys(channelsKey, currentChannelKey);
            },
            setEpgLibraryFilterScope: (scope): void => {
                this._epgPreferencesStore.setLibraryFilterScope(scope);
            },
        });
        this._playbackStateAccessors = {
            getCurrentProgramForPlayback: (): ScheduledProgram | null =>
                this._getAuthoritativeCurrentProgramForPlayback(),
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
            getOwners: (): ChannelSetupWorkflowPortOwners | null => this._channelSetupPortOwners,
        });
        this._plexAuthRuntime = new OrchestratorPlexAuthRuntime({
            assertNotShutdown: this._assertNotShutdown.bind(this),
            getPlexAuth: (): IPlexAuth | null => this._plexAuth,
            throwModuleInitPreconditionError: this._throwModuleInitPreconditionError.bind(this),
        });
        this._channelSwitchRuntime = new OrchestratorChannelSwitchRuntime({
            assertNotShutdown: this._assertNotShutdown.bind(this),
            getChannelTuning: (): ChannelTuningCoordinator | null => this._channelTuning,
            getChannelManager: (): IChannelManager | null => this._channelManager,
            getScheduler: (): IChannelScheduler | null => this._scheduler,
            getVideoPlayer: (): IVideoPlayer | null => this._videoPlayer,
            reportIssue: (
                event: string,
                message: string,
                data?: Record<string, unknown>
            ): void => {
                this._warnRecoverableRuntimeIssue(event, message, data);
            },
            reportError: (event: string, message: string, error: unknown): void => {
                this._warnRecoverableRuntimeError(event, message, error);
            },
        });
        this._initializeModuleStatus();
    }

    async initialize(config: OrchestratorConfig): Promise<void> {
        this._assertNotShutdown('initialize');
        const orchestratorConfig = this._prepareConfig(config);
        this._config = orchestratorConfig;

        const modules = createOrchestratorModules({
            config: orchestratorConfig,
            platformServices: this._platformServices,
            debugOverridesStore: this._debugOverridesStore,
            developerSettingsStore: this._developerSettingsStore,
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

        const startupUiInitializer = createAppStartupUiInitializer(
            orchestratorConfig,
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

        this._initCoordinator = new InitializationCoordinator(
            orchestratorConfig,
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
                startupUiInitializer,
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
                diagnostics: {
                    reportRecoverableAsyncFailure: this._reportRecoverableAsyncFailure,
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
                    getSelectedServerId: (): string | null => this._serverSelectionRuntime.getSelectedServerId(),
                },
                routing: {
                    shouldRunAudioSetup: this._shouldRunAudioSetup.bind(this),
                    shouldRunChannelSetup: (): boolean => this._channelSetup?.shouldRunChannelSetup() ?? false,
                    switchToChannel: this._switchToChannelWithOutcome.bind(this),
                    openServerSelect: this.openServerSelect.bind(this),
                },
                resources: {
                    buildPlexResourceUrl: (pathOrUrl: string | null): string | null => {
                        if (!pathOrUrl) return null;
                        return this._buildPlexResourceUrl(pathOrUrl);
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

        this._updateModuleStatus('event-emitter', 'ready');
    }

    private _prepareConfig(config: OrchestratorConfig): OrchestratorConfig {
        const nowPlayingInfoConfig = { ...config.nowPlayingInfoConfig };
        const previousOnAutoHide = nowPlayingInfoConfig.onAutoHide ?? null;

        nowPlayingInfoConfig.onAutoHide = (): void => {
            previousOnAutoHide?.();

            if (this._navigation?.isModalOpen(NOW_PLAYING_INFO_MODAL_ID)) {
                this._navigation.closeModal(NOW_PLAYING_INFO_MODAL_ID);
            }
        };

        return {
            ...config,
            nowPlayingInfoConfig,
        };
    }

    private _createCoordinators(): void {
        // This method assumes `initialize()` has already created the module instances it references.
        // It must not perform side effects other than assigning coordinator fields.
        if (!this._initCoordinator) {
            throw new Error('InitializationCoordinator must exist before coordinator assembly');
        }
        const initCoordinator = this._initCoordinator;

        const appendIssueDiagnostic: AppendIssueDiagnostic = (issue: string, event: string, data: unknown): void => {
            this._issueDiagnosticsStore.append(issue, event, data);
        };

        this._assignCoordinators(
            createOrchestratorCoordinators(
                createOrchestratorCoordinatorAssemblyInput(
                    this._buildCoordinatorAssemblyInput(initCoordinator, appendIssueDiagnostic)
                )
            )
        );
        this._assignRuntimeControllers(
            createOrchestratorRuntimeControllers({
                scheduleDayRollover: {
                    now: (): number => Date.now(),
                    getChannelManager: (): IChannelManager | null => this._channelManager,
                    getScheduler: (): IChannelScheduler | null => this._scheduler,
                    getEpgCoordinator: (): EPGCoordinator | null => this._epgCoordinator,
                    getLocalMidnightMs: (timeMs: number): number =>
                        this._schedulePolicy.getLocalMidnightMs(timeMs),
                    getLocalDayKey: (timeMs: number): number =>
                        this._schedulePolicy.getLocalDayKey(timeMs),
                    buildDailyScheduleConfig: (
                        channel: ChannelConfig,
                        items: ResolvedChannelContent['items'],
                        referenceTimeMs: number
                    ): ScheduleConfig =>
                        this._schedulePolicy.buildDailyScheduleConfig(channel, items, referenceTimeMs),
                    reportError: (message: string, error: unknown): void => {
                        this._warnRecoverableRuntimeError(
                            'orchestrator.scheduleDayRollover',
                            message,
                            error
                        );
                    },
                },
                subtitleTrackRecovery: {
                    getVideoPlayer: (): IVideoPlayer | null => this._videoPlayer,
                    getPlaybackRecovery: (): PlaybackRecoveryManager | null => this._playbackRecovery,
                    readSubtitleMode: () =>
                        this._subtitlePreferencesStore.readSubtitleModeAndClean('full'),
                    setSubtitleTrack: (trackId: string | null): Promise<void> =>
                        this.setSubtitleTrack(trackId),
                    nowPlayingWarn: (message: string): void => {
                        this._nowPlayingHandler?.({ message, type: 'warning' });
                    },
                    getCurrentStreamDecision: (): StreamDecision | null => this._currentStreamDecision,
                    getCurrentStreamDescriptor: (): StreamDescriptor | null => this._currentStreamDescriptor,
                    appendIssueDiagnostic,
                    issueId: QA_003B_ISSUE_ID,
                },
            })
        );
    }

    private _buildCoordinatorAssemblyInput(
        initCoordinator: InitializationCoordinator,
        appendIssueDiagnostic: AppendIssueDiagnostic
    ): OrchestratorCoordinatorAssemblyInputDraft {
        return {
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
            requiredSurfaces: {
                channelBadgeOverlay: this._channelBadgeOverlay,
            },
            stores: {
                developerSettingsStore: this._developerSettingsStore,
                debugOverridesStore: this._debugOverridesStore,
                subtitlePreferencesStore: this._subtitlePreferencesStore,
                epgPreferencesStore: this._epgPreferencesStore,
                nowPlayingDisplayStore: this._nowPlayingDisplayStore,
                profileSessionStore: this._profileSessionStore,
            },
            diagnostics: {
                appendIssueDiagnostic,
                reportRecoverableAsyncFailure: this._reportRecoverableAsyncFailure,
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
                getActiveUserId: (): string | null => this._getActiveUserId(),
                getSelectedServerId: (): string | null => this._serverSelectionRuntime.getSelectedServerId(),
                getLocalMidnightMs: (timeMs: number): number => this._schedulePolicy.getLocalMidnightMs(timeMs),
                getLocalDayKey: (timeMs: number): number => this._schedulePolicy.getLocalDayKey(timeMs),
                buildDailyScheduleConfig: (
                    channel: ChannelConfig,
                    items: ResolvedChannelContent['items'],
                    referenceTimeMs: number
                ): ScheduleConfig => this._schedulePolicy.buildDailyScheduleConfig(channel, items, referenceTimeMs),
            },
            actions: {
                switchToChannel: (
                    channelId: string,
                    options?: { guideSelectionSnapshot?: import('../channel-tuning').GuideSelectionSnapshot }
                ): Promise<void> => this.switchToChannel(channelId, options),
                switchToChannelWithOutcome: (
                    channelId: string,
                    options?: { guideSelectionSnapshot?: import('../channel-tuning').GuideSelectionSnapshot }
                ): Promise<ChannelSwitchOutcome> => this._switchToChannelWithOutcome(channelId, options),
                switchToNextChannel: (): void => this._channelSwitchRuntime.switchToNextChannel(),
                switchToPreviousChannel: (): void => this._channelSwitchRuntime.switchToPreviousChannel(),
                switchToChannelByNumberWithOutcome: (n: number): Promise<ChannelSwitchOutcome> =>
                    this.switchToChannelByNumberWithOutcome(n),
                toggleEPG: (): void => this.toggleEPG(),
                onOverlayVisibilityChange: (visible: boolean): void => {
                    this._requireOverlayRuntimePolicyController().handleOverlayVisibilityChange(visible);
                },
                onChannelTransitionActivityChange: (_active: boolean): void => {
                    this._requireOverlayRuntimePolicyController().syncChannelBadgeOverlay();
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
        };
    }

    private _assignCoordinators(coordinators: OrchestratorCoordinators): void {
        this._epgCoordinator = coordinators.epgCoordinator;
        this._channelSetup = coordinators.channelSetup;
        this._channelSetupPortOwners = coordinators.channelSetupPortOwners;
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
    }

    private _assignRuntimeControllers(
        controllers: ReturnType<typeof createOrchestratorRuntimeControllers>
    ): void {
        this._scheduleDayRolloverController = controllers.scheduleDayRolloverController;
        this._subtitleTrackRecoveryController = controllers.subtitleTrackRecoveryController;
    }

    async start(): Promise<void> {
        this._assertNotShutdown('start');
        if (!this._initCoordinator) {
            this._throwModuleInitPreconditionError('Orchestrator must be initialized before starting', {
                method: 'start',
                dependency: 'InitializationCoordinator',
            });
        }

        this._playbackRecovery?.resetPlaybackFailureGuard();
        await this._initCoordinator.runStartup(STARTUP_PHASE.FULL_STARTUP);
    }

    /**
     * The orchestrator follows a singleton lifecycle pattern. After shutdown,
     * discard this instance and create a new one before initialize() + start().
     * Internal state is not fully reset because instance reuse is unsupported.
     */
    async shutdown(): Promise<void> {
        if (this._shutdownPromise) {
            return this._shutdownPromise;
        }
        if (this._shutdownStarted) {
            return;
        }
        this._shutdownStarted = true;
        this._shutdownPromise = this._runShutdownTeardown();

        try {
            await this._shutdownPromise;
        } finally {
            this._shutdownPromise = null;
        }
    }

    private async _runShutdownTeardown(): Promise<void> {
        const teardown = new OrchestratorShutdownTeardown();

        const initCoordinator = this._initCoordinator;
        if (initCoordinator) {
            teardown.run('initCoordinator.clearAuthResume', () => initCoordinator.clearAuthResume());
            teardown.run('initCoordinator.clearServerResume', () => initCoordinator.clearServerResume());
            teardown.run('initCoordinator.clearProfileResume', () => initCoordinator.clearProfileResume());
        }

        if (this._scheduleDayRolloverController) {
            teardown.run('scheduleDayRolloverController.dispose', () =>
                this._scheduleDayRolloverController?.dispose()
            );
            this._scheduleDayRolloverController = null;
        }

        teardown.run('events.unsubscribe', () => {
            this._eventBinder?.dispose((error: unknown): void => {
                teardown.recordFailure('events.unsubscribe', error);
            });
        });
        this._eventBinder = null;

        const channelManager = this._channelManager;
        const flushChannelSaves = channelManager?.flushSaves;
        if (flushChannelSaves) {
            await teardown.runAsync('channelManager.flushSaves', () => flushChannelSaves.call(channelManager));
        }
        const disposeChannelManager = channelManager?.dispose;
        if (disposeChannelManager) {
            teardown.run('channelManager.dispose', () => disposeChannelManager.call(channelManager));
        }
        this._channelManager = null;

        const lifecycle = this._lifecycle;
        if (lifecycle) {
            await teardown.runAsync('lifecycle.shutdown', () => lifecycle.shutdown());
            this._lifecycle = null;
        }

        if (this._videoPlayer) {
            teardown.run('videoPlayer.stop', () => this._stopPlayback());
        }

        const scheduler = this._scheduler;
        if (scheduler) {
            teardown.run('scheduler.pauseSyncTimer', () => scheduler.pauseSyncTimer());
            teardown.run('scheduler.unloadChannel', () => scheduler.unloadChannel());
            this._scheduler = null;
        }

        teardown.run('epgCoordinator.dispose', () => this._epgCoordinator?.dispose('shutdown'));
        this._epgCoordinator = null;
        if (this._epg) {
            teardown.run('epg.destroy', () => this._epg?.destroy());
        }
        this._epg = null;
        if (this._epgDebugRuntime) {
            teardown.run('epgDebugRuntime.destroy', () => this._epgDebugRuntime?.destroy());
            this._epgDebugRuntime = null;
        }
        if (this._nowPlayingDebugManager) {
            teardown.run('nowPlayingDebugManager.dispose', () => this._nowPlayingDebugManager?.dispose());
            this._nowPlayingDebugManager = null;
        }
        teardown.run('nowPlayingInfoCoordinator.dispose', () => this._nowPlayingInfoCoordinator?.dispose());
        this._nowPlayingInfoCoordinator = null;
        if (this._nowPlayingInfo) {
            teardown.run('nowPlayingInfo.destroy', () => this._nowPlayingInfo?.destroy());
            this._nowPlayingInfo = null;
        }
        teardown.run('playerOsdCoordinator.hide', () => this._playerOsdCoordinator?.hide());
        this._playerOsdCoordinator = null;
        if (this._playerOsd) {
            teardown.run('playerOsd.destroy', () => this._playerOsd?.destroy());
            this._playerOsd = null;
        }
        if (this._channelNumberOverlay) {
            teardown.run('channelNumberOverlay.destroy', () => this._channelNumberOverlay?.destroy());
            this._channelNumberOverlay = null;
        }
        if (this._channelBadgeOverlay) {
            teardown.run('channelBadgeOverlay.destroy', () => this._channelBadgeOverlay?.destroy());
            this._channelBadgeOverlay = null;
        }
        teardown.run('miniGuideCoordinator.hide', () => this._miniGuideCoordinator?.hide());
        this._miniGuideCoordinator = null;
        if (this._miniGuide) {
            teardown.run('miniGuide.destroy', () => this._miniGuide?.destroy());
            this._miniGuide = null;
        }
        teardown.run('channelTransitionCoordinator.hide', () => this._channelTransitionCoordinator?.hide());
        this._channelTransitionCoordinator = null;
        if (this._channelTransitionOverlay) {
            teardown.run('channelTransitionOverlay.destroy', () => this._channelTransitionOverlay?.destroy());
            this._channelTransitionOverlay = null;
        }
        teardown.run('playbackOptionsCoordinator.dispose', () => this._playbackOptionsCoordinator?.dispose());
        this._playbackOptionsCoordinator = null;
        if (this._playbackOptionsModal) {
            teardown.run('playbackOptionsModal.destroy', () => this._playbackOptionsModal?.destroy());
            this._playbackOptionsModal = null;
        }
        if (this._exitConfirmModal && this._navigation?.isModalOpen(EXIT_CONFIRM_MODAL_ID)) {
            teardown.run('navigation.closeModal(exit-confirm)', () =>
                this._navigation?.closeModal(EXIT_CONFIRM_MODAL_ID)
            );
        }
        if (this._exitConfirmCoordinator) {
            teardown.run('exitConfirmCoordinator.handleModalClose', () =>
                this._exitConfirmCoordinator?.handleModalClose(EXIT_CONFIRM_MODAL_ID)
            );
            this._exitConfirmCoordinator = null;
        }
        if (this._exitConfirmModal) {
            teardown.run('exitConfirmModal.destroy', () => this._exitConfirmModal?.destroy());
            this._exitConfirmModal = null;
        }
        if (this._videoPlayer) {
            teardown.run('videoPlayer.destroy', () => this._videoPlayer?.destroy());
            this._videoPlayer = null;
        }
        if (this._sleepTimer) {
            teardown.run('sleepTimer.destroy', () => this._sleepTimer?.destroy());
            this._sleepTimer = null;
        }
        if (this._navigation) {
            teardown.run('navigation.destroy', () => this._navigation?.destroy());
            this._navigation = null;
        }

        const teardownFailures = teardown.getFailures();
        if (teardownFailures.length > 0) {
            this._warnRecoverableRuntimeIssue(
                'orchestrator.shutdown.teardown',
                'Shutdown teardown failures',
                { teardownFailures }
            );
        }

        this._initCoordinator = null;
        this._epgCoordinator = null;
        this._nowPlayingDebugManager = null;
        this._navigationCoordinator = null;
        this._playbackRecovery = null;
        this._channelTuning = null;
        this._subtitleTrackRecoveryController = null;
        this._playbackRuntimeController = null;
        this._overlayRuntimePolicyController = null;
        this._profileSwitchCleanupController = null;
        this._channelSetup = null;
        this._channelSetupPortOwners = null;
        this._plexAuth = null;
        this._plexDiscovery = null;
        this._plexLibrary = null;
        this._plexStreamResolver = null;
        this._currentProgramForPlayback = null;
        this._currentStreamDescriptor = null;
        this._currentStreamDecision = null;
        this._nowPlayingHandler = null;
        this._pendingNowPlayingChannelId = null;
        this._shouldAutoShowInfoBannerOnNextPlay = false;
        this._lastChannelChangeSource = null;
        this._ready = false;
    }

    getModuleStatus(): Map<string, ModuleStatus> {
        return new Map(
            Array.from(this._moduleStatus, ([id, status]) => [id, this._cloneModuleStatus(status)])
        );
    }

    isReady(): boolean {
        return this._ready;
    }

    getSelectedServerId(): string | null {
        return this._serverSelectionRuntime.getSelectedServerId();
    }

    getSelectedServerScreenState(): SelectedServerScreenState {
        return this._storageContext.getSelectedServerScreenState();
    }

    getSelectedServerStorageKey(): string {
        return this._storageContext.getSelectedServerStorageKey();
    }

    getServerHealthStorageKey(): string {
        return this._storageContext.getServerHealthStorageKey();
    }

    getCurrentScreen(): Screen | null {
        if (!this._navigation) {
            return null;
        }
        return this._navigation.getCurrentScreen();
    }

    getNavigation(): INavigationManager | null {
        return this._navigation;
    }

    getPlaybackInfoSnapshot(): PlaybackInfoSnapshot {
        return createPlaybackInfoSnapshot({
            playback: this._playbackStateAccessors,
            getCurrentChannel: () => this._channelManager?.getCurrentChannel() ?? null,
        });
    }

    async refreshPlaybackInfoSnapshot(): Promise<PlaybackInfoSnapshot> {
        const program = this._getAuthoritativeCurrentProgramForPlayback();
        const decision = this._currentStreamDecision;
        if (!program || !decision || !this._plexStreamResolver) {
            return this.getPlaybackInfoSnapshot();
        }

        await this._nowPlayingDebugManager?.ensureServerDecisionForPlaybackInfoSnapshot();

        return this.getPlaybackInfoSnapshot();
    }

    async setSubtitleTrack(trackId: string | null): Promise<void> {
        this._assertNotShutdown('setSubtitleTrack');
        if (!this._videoPlayer) return;
        const setTrackResult = await captureRecoverableRuntimeResultAsync(
            async () => this._videoPlayer?.setSubtitleTrack(trackId)
        );
        if (!setTrackResult.ok) {
            this._warnRecoverableRuntimeError(
                'orchestrator.subtitleTrack.set',
                'setSubtitleTrack failed',
                setTrackResult.error,
                { trackId }
            );
            if (this._nowPlayingHandler) {
                this._nowPlayingHandler({ message: 'Could not update subtitles', type: 'warning' });
            }
        }
    }

    /**
     * Subscribe to navigation screen change events.
     */
    onScreenChange(handler: (from: string, to: string) => void): IDisposable {
        this._assertNotShutdown('onScreenChange');
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

    async requestAuthPin(options?: { signal?: AbortSignal | null }): Promise<PlexPinRequest> {
        return this._plexAuthRuntime.requestAuthPin(options);
    }

    async pollForPin(pinId: number, options?: { signal?: AbortSignal | null }): Promise<PlexPinRequest> {
        return this._plexAuthRuntime.pollForPin(pinId, options);
    }

    async cancelPin(pinId: number): Promise<void> {
        await this._plexAuthRuntime.cancelPin(pinId);
    }

    async getHomeUsers(options?: { signal?: AbortSignal | null }): Promise<PlexHomeUser[]> {
        this._assertNotShutdown('getHomeUsers');
        if (!this._plexAuth) {
            this._throwModuleInitPreconditionError('PlexAuth not initialized', {
                method: 'getHomeUsers',
                dependency: 'PlexAuth',
            });
        }
        return this._plexAuth.getHomeUsers(options);
    }

    getActiveUsername(): string | null {
        return this._plexAuth?.getCurrentUser()?.username ?? null;
    }

    private _requireInitializationCoordinator(): InitializationCoordinator {
        if (!this._initCoordinator) {
            throw new Error('InitializationCoordinator not initialized');
        }

        return this._initCoordinator;
    }

    async switchHomeUser(
        userId: string,
        options?: { pin?: string | null; signal?: AbortSignal | null }
    ): Promise<void> {
        this._assertNotShutdown('switchHomeUser');
        if (!this._plexAuth || !this._plexDiscovery) {
            const missingDependency = !this._plexAuth ? 'PlexAuth' : 'PlexServerDiscovery';
            this._throwModuleInitPreconditionError(`${missingDependency} not initialized`, {
                method: 'switchHomeUser',
                dependency: missingDependency,
            });
        }

        const cleanupController = this._requireProfileSwitchCleanupController();
        const initCoordinator = this._requireInitializationCoordinator();
        cleanupController.prepareForProfileSwitchAttempt();
        initCoordinator.prepareForProfileSwitchAttempt();
        try {
            await this._plexAuth.switchHomeUser(userId, {
                pin: options?.pin ?? null,
                signal: options?.signal ?? null,
            });
        } catch (error) {
            initCoordinator.restorePendingServerResumeAfterProfileSwitchFailure();
            throw error;
        }
        this._clearIdentityScopedRuntimeState({ stopPlayback: false });
        await this._resumeStartupAfterProfileSwitch(initCoordinator);
    }

    async useMainAccountProfile(): Promise<void> {
        this._assertNotShutdown('useMainAccountProfile');
        if (!this._plexAuth || !this._plexDiscovery) {
            const missingDependency = !this._plexAuth ? 'PlexAuth' : 'PlexServerDiscovery';
            this._throwModuleInitPreconditionError(`${missingDependency} not initialized`, {
                method: 'useMainAccountProfile',
                dependency: missingDependency,
            });
        }

        const cleanupController = this._requireProfileSwitchCleanupController();
        const initCoordinator = this._requireInitializationCoordinator();
        cleanupController.prepareForProfileSwitchAttempt();
        initCoordinator.prepareForProfileSwitchAttempt();
        try {
            await this._plexAuth.logoutActiveUser();
        } catch (error) {
            initCoordinator.restorePendingServerResumeAfterProfileSwitchFailure();
            throw error;
        }
        this._clearIdentityScopedRuntimeState({ stopPlayback: false });
        await this._resumeStartupAfterProfileSwitch(initCoordinator);
    }

    async signOutPlex(): Promise<void> {
        this._assertNotShutdown('signOutPlex');
        if (!this._plexAuth) {
            this._throwModuleInitPreconditionError('PlexAuth not initialized', {
                method: 'signOutPlex',
                dependency: 'PlexAuth',
            });
        }
        await this._plexAuth.clearCredentials();
        try {
            this._plexDiscovery?.clearSelection();
        } catch (error) {
            if (!isPlexDiscoverySelectionSupersededError(error)) throw error;
        }
        this._clearIdentityScopedRuntimeState({ stopPlayback: true });
        await this._configureChannelManagerStorageForSelectedServer();
        if (this._initCoordinator) {
            await this._initCoordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE);
        } else {
            this._navigation?.goTo('auth');
        }
    }

    /**
     * Discover Plex servers (optionally forcing refresh).
     */
    async discoverServers(options?: { forceRefresh?: boolean; signal?: AbortSignal | null }): Promise<PlexServer[]> {
        this._assertNotShutdown('discoverServers');
        if (!this._plexDiscovery) {
            this._throwModuleInitPreconditionError('PlexServerDiscovery not initialized', {
                method: 'discoverServers',
                dependency: 'PlexServerDiscovery',
            });
        }
        if (options?.forceRefresh === true) {
            return this._plexDiscovery.refreshServers({ signal: options.signal ?? null });
        }
        return this._plexDiscovery.discoverServers({ signal: options?.signal ?? null });
    }

    async selectServer(
        serverId: string,
        options?: { signal?: AbortSignal | null }
    ): Promise<OrchestratorServerSelectionResult> {
        return this._serverSelectionRuntime.selectServer(serverId, options);
    }

    async clearSelectedServer(): Promise<void> {
        await this._serverSelectionRuntime.clearSelectedServer();
        this._clearIdentityScopedRuntimeState({ stopPlayback: true });
        await this._configureChannelManagerStorageForSelectedServer();
    }

    private async _resumeStartupAfterProfileSwitch(initCoordinator: InitializationCoordinator): Promise<void> {
        this._navigation?.goTo('splash');
        await initCoordinator.resumeStartupAfterProfileSwitch();
    }

    getChannelSetupWorkflowPort(): ChannelSetupWorkflowPort {
        return this._channelSetupWorkflowPort;
    }

    requestChannelSetupRerun(): ChannelSetupRerunRequestResult {
        this._assertNotShutdown('requestChannelSetupRerun');
        return this._requireChannelSetupCoordinator().requestChannelSetupRerun();
    }

    async switchToChannel(
        channelId: string,
        options?: {
            signal?: AbortSignal;
            guideSelectionSnapshot?: import('../channel-tuning').GuideSelectionSnapshot;
        }
    ): Promise<void> {
        await this._channelSwitchRuntime.switchToChannel(channelId, options);
    }

    private async _switchToChannelWithOutcome(
        channelId: string,
        options?: {
            signal?: AbortSignal;
            guideSelectionSnapshot?: import('../channel-tuning').GuideSelectionSnapshot;
        }
    ): Promise<ChannelSwitchOutcome> {
        return this._channelSwitchRuntime.switchToChannelWithOutcome(channelId, options);
    }

    async switchToChannelByNumber(number: number, options?: { signal?: AbortSignal }): Promise<void> {
        await this._channelSwitchRuntime.switchToChannelByNumber(number, options);
    }

    async switchToChannelByNumberWithOutcome(
        number: number,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSwitchOutcome> {
        return this._channelSwitchRuntime.switchToChannelByNumberWithOutcome(number, options);
    }

    openEPG(): void {
        this._assertNotShutdown('openEPG');
        this._epgCoordinator?.openEPG();
    }

    closeEPG(): void {
        this._assertNotShutdown('closeEPG');
        this._epgCoordinator?.closeEPG();
    }

    openServerSelect(options?: { allowAutoConnect?: boolean }): void {
        this._assertNotShutdown('openServerSelect');
        if (!this._navigation) {
            return;
        }
        this._navigation.goTo('server-select', {
            allowAutoConnect: options?.allowAutoConnect === true,
        });
    }

    toggleServerSelect(): void {
        this._assertNotShutdown('toggleServerSelect');
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
        this._assertNotShutdown('toggleEPG');
        this._epgCoordinator?.toggleEPG();
    }

    onGuideSettingChange(change: GuideSettingChange): void {
        this._assertNotShutdown('onGuideSettingChange');
        this._epgCoordinator?.handleGuideSettingChange(change);
    }

    handleGlobalError(error: AppError, context: string): void {
        this._assertNotShutdown('handleGlobalError');
        if (this._isHandlingGlobalError) {
            this._queueReentrantGlobalError(error, context);
            return;
        }

        this._isHandlingGlobalError = true;

        try {
            this._handleGlobalErrorOnce(error, context);

            let processedPendingErrors = 0;
            while (
                this._pendingGlobalErrors.length > 0 &&
                processedPendingErrors < AppOrchestrator.MAX_PENDING_GLOBAL_ERRORS
            ) {
                processedPendingErrors += 1;
                const pending = this._pendingGlobalErrors.shift()!;
                this._handleGlobalErrorOnce(pending.error, pending.context);
            }

            if (this._pendingGlobalErrors.length > 0) {
                this._warnRecoverableRuntimeIssue(
                    'orchestrator.globalErrorQueue.reentrancyLimit',
                    'Dropping queued global errors after reentrancy limit',
                    { droppedCount: this._pendingGlobalErrors.length }
                );
                this._pendingGlobalErrors = [];
            }
        } finally {
            this._pendingGlobalErrors = [];
            this._isHandlingGlobalError = false;
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
        this._assertNotShutdown('registerErrorHandler');
        this._errorHandlers.set(moduleId, handler);
    }

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
                    this._warnRecoverableRuntimeError(
                        'orchestrator.recovery.retryStart',
                        'Retry start failed',
                        error
                    );
                });
            },
            retryPlayback: (): void => {
                try {
                    const scheduler = this._scheduler;
                    const schedulerState = scheduler?.getState();
                    const currentProgram = this._getAuthoritativeCurrentProgramForPlayback();
                    if (!scheduler || !schedulerState?.isActive || !currentProgram) {
                        throw new Error(`Cannot retry playback without ${scheduler ? 'an active program' : 'an active scheduler'}`);
                    }
                    this._playbackRecovery?.resetPlaybackFailureGuard();
                    this._playbackRecovery?.resetDirectFallbackAndBurnInAttempts();
                    scheduler.jumpToProgram(currentProgram);
                } catch (error: unknown) {
                    this._warnRecoverableRuntimeError('orchestrator.recovery.retryPlayback', 'Retry playback failed', error);
                    this.handleGlobalError({
                        code: AppErrorCode.PLAYBACK_FAILED,
                        message: 'Playback retry failed',
                        recoverable: true,
                        context: { safeError: summarizeErrorForLog(error) },
                    }, 'playback');
                }
            },
            exitApp: (): void => {
                this.shutdown().catch((error: unknown) => {
                    this._warnRecoverableRuntimeError(
                        'orchestrator.recovery.exitApp',
                        'Shutdown failed',
                        error
                    );
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
                this._lifecycle ? this._lifecycle.getErrorUserMessage(code) : error.message,
            getRecoveryActions: (code: AppErrorCode): ErrorRecoveryAction[] =>
                this.getRecoveryActions(code),
            nowMs: (): number => Date.now(),
        });
    }

    public onLifecycleEvent<K extends keyof LifecycleEventMap>(
        event: K,
        handler: (payload: LifecycleEventMap[K]) => void
    ): IDisposable {
        this._assertNotShutdown('onLifecycleEvent');
        if (!this._lifecycle) {
            return { dispose: (): void => undefined };
        }
        return this._lifecycle.on(event, handler);
    }


    private _cloneModuleStatus(status: ModuleStatus): ModuleStatus {
        return {
            ...status,
            ...(status.error
                ? {
                    error: {
                        ...status.error,
                        ...(status.error.context
                            ? { context: this._cloneModuleStatusErrorContext(status.error.context) }
                            : {}),
                    },
                }
                : {}),
        };
    }

    private _cloneModuleStatusErrorContext(context: Record<string, unknown>): Record<string, unknown> {
        if (typeof globalThis.structuredClone === 'function') {
            const cloneResult = captureRecoverableRuntimeResult(
                () => globalThis.structuredClone(context) as Record<string, unknown>
            );
            if (cloneResult.ok) {
                return cloneResult.value;
            }

            if (!cloneResult.ok) {
                if (!this._reportedModuleStatusCloneFallbackContexts.has(context)) {
                    this._reportedModuleStatusCloneFallbackContexts.add(context);
                    this._warnRecoverableRuntimeError(
                        'orchestrator.moduleStatus.cloneContext',
                        'Falling back to diagnostic-value clone for module status error context',
                        cloneResult.error
                    );
                }
            }
        }

        return this._cloneDiagnosticValue(context, new WeakMap<object, unknown>()) as Record<string, unknown>;
    }

    private _cloneDiagnosticValue(value: unknown, seen: WeakMap<object, unknown>): unknown {
        if (value === null || typeof value !== 'object') {
            return value;
        }

        const existingClone = seen.get(value);
        if (existingClone !== undefined) {
            return existingClone;
        }

        if (Array.isArray(value)) {
            const clone: unknown[] = [];
            seen.set(value, clone);
            for (const item of value) {
                clone.push(this._cloneDiagnosticValue(item, seen));
            }
            return clone;
        }

        if (value instanceof Date) {
            return new Date(value.getTime());
        }

        if (value instanceof Map) {
            const clone = new Map<unknown, unknown>();
            seen.set(value, clone);
            for (const [entryKey, entryValue] of value) {
                clone.set(
                    this._cloneDiagnosticValue(entryKey, seen),
                    this._cloneDiagnosticValue(entryValue, seen)
                );
            }
            return clone;
        }

        if (value instanceof Set) {
            const clone = new Set<unknown>();
            seen.set(value, clone);
            for (const entry of value) {
                clone.add(this._cloneDiagnosticValue(entry, seen));
            }
            return clone;
        }

        const clone: Record<string, unknown> = {};
        seen.set(value, clone);
        for (const [entryKey, entryValue] of Object.entries(value)) {
            clone[entryKey] = this._cloneDiagnosticValue(entryValue, seen);
        }
        return clone;
    }

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

    private _getActiveUserId(): string | null {
        if (!this._plexAuth) {
            return null;
        }
        return this._plexAuth.getActiveUserId() ?? this._plexAuth.getAccountUserId() ?? null;
    }

    private _configureDiscoveryStorageKeysForActiveUser(): void {
        this._storageContext.configureDiscoveryStorageKeysForActiveUser();
    }

    private async _configureChannelManagerStorageForSelectedServer(): Promise<void> {
        await this._storageContext.configureChannelManagerStorageForSelectedServer();
    }

    private _shouldRunAudioSetup(): boolean {
        return !this._audioSettingsStore.readAudioSetupCompleteAndClean(false);
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
            mapped === AppErrorCode.AUTH_INVALID ||
            mapped === AppErrorCode.ACCESS_DENIED
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

    private _queueReentrantGlobalError(error: AppError, context: string): void {
        if (this._pendingGlobalErrors.length >= AppOrchestrator.MAX_PENDING_GLOBAL_ERRORS) {
            this._warnRecoverableRuntimeIssue(
                'orchestrator.globalErrorQueue.queueLimit',
                'Dropping reentrant global error after queue limit',
                {
                    context,
                    safeError: summarizeErrorForLog(error),
                }
            );
            return;
        }

        this._pendingGlobalErrors.push({ error, context });
    }

    private _handleGlobalErrorOnce(error: AppError, context: string): void {
        this._warnRecoverableRuntimeError(
            'orchestrator.globalError',
            `Global error in ${context}`,
            error
        );

        for (const [moduleId, handler] of this._errorHandlers) {
            if (this._runGlobalErrorHandler(moduleId, handler, error)) {
                this._warnRecoverableRuntimeIssue(
                    'orchestrator.globalError.handlerHandled',
                    'Global error handled by module',
                    { moduleId }
                );
                return;
            }
        }

        this._lifecycle?.reportError(error);
    }

    private _runGlobalErrorHandler(
        moduleId: string,
        handler: (error: AppError) => boolean,
        error: AppError
    ): boolean {
        const handlerResult = captureRecoverableRuntimeResult(() => handler(error));
        if (handlerResult.ok) {
            return handlerResult.value;
        }

        this._warnRecoverableRuntimeError(
            'orchestrator.globalError.handlerFailure',
            `Error in handler for ${moduleId}`,
            handlerResult.error
        );
        return false;
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

            this._assignPriorityOneControllers(
                createPriorityOneRuntimeAssembly({
                    requiredModules: {
                        scheduler: this._scheduler,
                        videoPlayer: this._videoPlayer,
                        lifecycle: this._lifecycle,
                    },
                    runtimeSurfaces: {
                        channelBadgeOverlay: this._channelBadgeOverlay,
                        playerOsd: this._playerOsd,
                        nowPlayingInfo: this._nowPlayingInfo,
                        epg: this._epg,
                        channelManager: this._channelManager,
                        navigation: this._navigation,
                        plexLibrary: this._plexLibrary,
                        plexStreamResolver: this._plexStreamResolver,
                    },
                    playback: {
                        playbackState: this._playbackStateAccessors,
                        playbackRecovery: this._playbackRecovery,
                    },
                    runtimeControllers: {
                        channelTransition: this._channelTransitionCoordinator,
                        playerOsd: this._playerOsdCoordinator,
                        nowPlayingInfo: this._nowPlayingInfoCoordinator,
                        epg: this._epgCoordinator,
                        navigation: this._navigationCoordinator,
                        playbackOptions: this._playbackOptionsCoordinator,
                        scheduleDayRollover: this._scheduleDayRolloverController,
                        subtitleTrackRecovery: this._subtitleTrackRecoveryController,
                        nowPlayingDebug: this._nowPlayingDebugManager,
                    },
                    orchestratorCallbacks: {
                        stopPlayback: (): void => this._stopPlayback(),
                        handleGlobalError: (error: AppError, context: string): void => {
                            this.handleGlobalError(error, context);
                        },
                        handlePlexLibraryAuthExpired: (): void => this._handlePlexLibraryAuthExpired(),
                        handlePlexStreamError: (error): void => this._handlePlexStreamError(error),
                        showPersistenceWarning: (message): void => {
                            this._nowPlayingHandler?.({ message, type: 'warning' });
                        },
                        reportRecoverableRuntimeIssue: this._warnRecoverableRuntimeIssue.bind(this),
                        reportRecoverableRuntimeError: this._warnRecoverableRuntimeError.bind(this),
                    },
                })
            );
        } finally {
            this._priorityOneControllersInitializing = false;
        }
    }

    private _assignPriorityOneControllers(
        priorityOne: PriorityOneControllersAndBinder
    ): void {
        this._overlayRuntimePolicyController = priorityOne.overlayRuntimePolicyController;
        this._playbackRuntimeController = priorityOne.playbackRuntimeController;
        this._profileSwitchCleanupController = priorityOne.profileSwitchCleanupController;
        this._eventBinder = priorityOne.eventBinder;
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
        const stopTranscodeResult = captureRecoverableRuntimeResult(
            () => this._playbackRuntimeController?.stopActiveTranscodeSession()
        );
        if (!stopTranscodeResult.ok) {
            this._warnRecoverableRuntimeError(
                'orchestrator.playback.stopTranscodeSession',
                'stopActiveTranscodeSession failed during playback stop',
                stopTranscodeResult.error
            );
        }
        this._videoPlayer?.stop();
    }

    private _clearIdentityScopedRuntimeState(options: { stopPlayback: boolean }): void {
        clearIdentityScopedRuntimeState({
            stopPlayback: (): void => this._stopPlayback(),
            unloadCurrentChannel: (): void => this._scheduler?.unloadChannel(),
            clearPlaybackState: (): void => this._clearPlaybackIdentityState(),
            clearChannelManagerRuntimeState: (): void => this._channelManager?.clearRuntimeState(),
            clearEpgScheduleState: (): void => {
                this._epgCoordinator?.clearSelectedChannelScheduleSnapshot();
                this._epgCoordinator?.clearScheduleCaches();
                this._epg?.clearSchedules();
            },
            reportFailure: this._warnRecoverableRuntimeError.bind(this),
        }, options);
    }

    private _clearPlaybackIdentityState(): void {
        this._currentProgramForPlayback = null;
        this._currentStreamDescriptor = null;
        this._currentStreamDecision = null;
        this._pendingNowPlayingChannelId = null;
        this._shouldAutoShowInfoBannerOnNextPlay = false;
        this._lastChannelChangeSource = null;
    }

    private _buildPlexResourceUrl(pathOrUrl: string): string | null {
        return buildPlexResourceUrlSafely({
            getServerUri: (): string | null => this._plexDiscovery?.getServerUri() ?? null,
            getAuthHeaders: (): Record<string, string> => this._plexAuth?.getAuthHeaders() ?? {},
            reportError: (event, message, error, data) => this._warnRecoverableRuntimeError(event, message, error, data),
        }, pathOrUrl);
    }

    private _getMimeType(decision: StreamDecision): string {
        if (decision.protocol === 'hls') {
            return MIME_TYPES.hls || 'application/x-mpegURL';
        }
        if (decision.container) {
            const mime = MIME_TYPES[decision.container];
            if (mime) return mime;
        }
        return 'video/mp4';
    }

    setNowPlayingHandler(handler: ((toast: ToastInput) => void) | null): void {
        this._nowPlayingHandler = handler;
    }
}
