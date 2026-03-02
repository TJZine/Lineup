/**
 * @fileoverview Application Orchestrator - Central coordinator for all modules.
 * @module Orchestrator
 * @version 1.0.0
 *
 * Responsibilities:
 * - Module initialization in dependency order
 * - Cross-module event wiring
 * - State restoration on startup
 * - Error handling and recovery
 * - Channel switching and EPG management
 */

import {
    AppLifecycle,
    AppErrorCode,
    type IAppLifecycle,
    type AppError,
    type LifecycleAppError,
    type AppPhase,
    type LifecycleEventMap,
} from './modules/lifecycle';
import { STORAGE_KEYS } from './types';
import type { ChannelSwitchOutcome } from './types/channelSwitch';
import {
    NavigationManager,
    type INavigationManager,
    CHANNEL_INPUT_CONFIG,
    type NavigationConfig,
    type Screen,
} from './modules/navigation';
import type { GuideSettingChange } from './modules/ui/settings/types';
import { NavigationCoordinator } from './modules/navigation/NavigationCoordinator';
import {
    PlexAuth,
    type IPlexAuth,
    type PlexAuthConfig,
    type PlexPinRequest,
    type PlexHomeUser,
} from './modules/plex/auth';
import {
    PlexServerDiscovery,
    type IPlexServerDiscovery,
    type PlexServer,
} from './modules/plex/discovery';
import {
    PlexLibrary,
    type IPlexLibrary,
    type PlexLibraryType,
    type PlexLibraryConfig,
} from './modules/plex/library';
import {
    PlexStreamResolver,
    type IPlexStreamResolver,
    type PlexStreamResolverConfig,
    type StreamDecision,
    type StreamResolverError,
    mapPlexStreamErrorCodeToAppErrorCode,
} from './modules/plex/stream';
import { MIME_TYPES } from './modules/plex/stream/constants'; // Fix Direct Play MIME types
import {
    ChannelManager,
    type IChannelManager,
    type ChannelManagerConfig,
    type ChannelConfig,
    type ResolvedChannelContent,
} from './modules/scheduler/channel-manager';
import {
    ChannelScheduler,
    type IChannelScheduler,
    type ScheduledProgram,
    type ScheduleConfig,
} from './modules/scheduler/scheduler';
import {
    VideoPlayer,
    type IVideoPlayer,
    type VideoPlayerConfig,
    type StreamDescriptor,
    type PlaybackState,
    type PlaybackError,
    type TimeRange,
    mapPlayerErrorCodeToAppErrorCode,
} from './modules/player';
import { BURN_IN_SUBTITLE_FORMATS } from './modules/player/constants';
import { PlaybackRecoveryManager } from './modules/player/PlaybackRecoveryManager';
import {
    EPGComponent,
    type IEPGComponent,
    type EPGConfig,
} from './modules/ui/epg';
import { EPGCoordinator, type EpgUiStatus } from './modules/ui/epg/EPGCoordinator';
import {
    NowPlayingInfoOverlay,
    type INowPlayingInfoOverlay,
    type NowPlayingInfoConfig,
    NOW_PLAYING_INFO_MODAL_ID,
} from './modules/ui/now-playing-info';
import {
    PlayerOsdOverlay,
    type IPlayerOsdOverlay,
    type PlayerOsdConfig,
} from './modules/ui/player-osd';
import { PlayerOsdCoordinator } from './modules/ui/player-osd/PlayerOsdCoordinator';
import {
    ChannelNumberOverlay,
    type IChannelNumberOverlay,
    type ChannelNumberOverlayConfig,
} from './modules/ui/channel-number-overlay';
import {
    ChannelBadgeOverlay,
    type IChannelBadgeOverlay,
    type ChannelBadgeConfig,
} from './modules/ui/channel-badge';
import { SleepTimerManager } from './modules/ui/sleep-timer';
import {
    MiniGuideOverlay,
    type IMiniGuideOverlay,
    type MiniGuideConfig,
} from './modules/ui/mini-guide';
import { MiniGuideCoordinator } from './modules/ui/mini-guide/MiniGuideCoordinator';
import {
    ChannelTransitionOverlay,
    type IChannelTransitionOverlay,
    type ChannelTransitionConfig,
} from './modules/ui/channel-transition';
import { ChannelTransitionCoordinator } from './modules/ui/channel-transition/ChannelTransitionCoordinator';
import {
    PlaybackOptionsModal,
    type IPlaybackOptionsModal,
    type PlaybackOptionsConfig,
    PLAYBACK_OPTIONS_MODAL_ID,
} from './modules/ui/playback-options';
import {
    ExitConfirmCoordinator,
    ExitConfirmModal,
    EXIT_CONFIRM_FOCUSABLE_IDS,
    EXIT_CONFIRM_MODAL_ID,
} from './modules/ui/exit-confirm';
import {
    InitializationCoordinator,
    ChannelTuningCoordinator,
    OrchestratorStorageContext,
    type IInitializationCoordinator,
} from './core';
import { ChannelSetupCoordinator } from './core/channel-setup';
import type {
    ChannelSetupConfig,
    ChannelSetupContext,
    ChannelBuildSummary,
    ChannelBuildProgress,
    ChannelSetupRecord,
    ChannelSetupPreview,
    ChannelSetupReview,
} from './core/channel-setup/types';
import { NowPlayingDebugManager } from './modules/debug/NowPlayingDebugManager';
import {
    NowPlayingInfoCoordinator,
    getNowPlayingInfoAutoHideMs,
} from './modules/ui/now-playing-info/NowPlayingInfoCoordinator';
import { PlaybackOptionsCoordinator } from './modules/ui/playback-options';
import type { IDisposable } from './utils/interfaces';
import { createMulberry32 } from './utils/prng';
import {
    readStoredBoolean,
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSet,
} from './utils/storage';
import { LINEUP_STORAGE_KEYS } from './config/storageKeys';
import { getRecoveryActions as getRecoveryActionsHelper } from './core/error-recovery/RecoveryActions';
import { toLifecycleAppError as toLifecycleAppErrorHelper } from './core/error-recovery/LifecycleErrorAdapter';
import type { ErrorRecoveryAction } from './core/error-recovery/types';
import type { ToastInput } from './modules/ui/toast/types';
import type { PlatformServices } from './platform';
import { webosPlatformServices } from './platform';
import { isAbortLikeError, summarizeErrorForLog } from './utils/errors';

// ============================================
// Types
// ============================================

/**
 * Module health status
 */
export interface ModuleStatus {
    id: string;
    name: string;
    status: 'pending' | 'initializing' | 'ready' | 'error' | 'disabled';
    loadTimeMs?: number;
    error?: AppError;
}

export type {
    ChannelSetupConfig,
    ChannelSetupContext,
    ChannelBuildSummary,
    ChannelBuildProgress,
    ChannelSetupRecord,
    ChannelSetupPreview,
    ChannelSetupReview,
} from './core/channel-setup/types';

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

/**
 * Orchestrator configuration (module configs passed at initialization)
 */
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

export type { ErrorRecoveryAction } from './core/error-recovery/types';

/**
 * Application Orchestrator Interface
 */
export interface IAppOrchestrator {
    initialize(config: OrchestratorConfig): Promise<void>;
    start(): Promise<void>;
    shutdown(): Promise<void>;
    getModuleStatus(): Map<string, ModuleStatus>;
    isReady(): boolean;
    getCurrentScreen(): Screen | null;
    onScreenChange(handler: (from: string, to: string) => void): IDisposable;
    getPlaybackInfoSnapshot(): PlaybackInfoSnapshot;
    refreshPlaybackInfoSnapshot(): Promise<PlaybackInfoSnapshot>;
    setSubtitleTrack(trackId: string | null): Promise<void>;
    switchToChannel(channelId: string, options?: { signal?: AbortSignal }): Promise<void>;
    switchToChannelByNumber(number: number, options?: { signal?: AbortSignal }): Promise<void>;
    openEPG(): void;
    closeEPG(): void;
    toggleEPG(): void;
    onGuideSettingChange(change: GuideSettingChange): void;
    requestAuthPin(): Promise<PlexPinRequest>;
    pollForPin(pinId: number): Promise<PlexPinRequest>;
    cancelPin(pinId: number): Promise<void>;
    getHomeUsers(): Promise<PlexHomeUser[]>;
    switchHomeUser(userId: string, pin?: string): Promise<void>;
    useMainAccountProfile(): Promise<void>;
    signOutPlex(): Promise<void>;
    discoverServers(forceRefresh?: boolean): Promise<PlexServer[]>;
    selectServer(serverId: string): Promise<boolean>;
    clearSelectedServer(): void;
    getSelectedServerId(): string | null;
    getSelectedServerStorageKey(): string;
    getServerHealthStorageKey(): string;
    getLibrariesForSetup(signal?: AbortSignal | null): Promise<PlexLibraryType[]>;
    getChannelSetupRecord(serverId: string): ChannelSetupRecord | null;
    getSetupContextForSelectedServer(): ChannelSetupContext;
    getSetupPreview(config: ChannelSetupConfig, options?: { signal?: AbortSignal }): Promise<ChannelSetupPreview>;
    getSetupReview(config: ChannelSetupConfig, options?: { signal?: AbortSignal }): Promise<ChannelSetupReview>;
    createChannelsFromSetup(config: ChannelSetupConfig, options?: { signal?: AbortSignal; onProgress?: (p: ChannelBuildProgress) => void }): Promise<ChannelBuildSummary>;
    markSetupComplete(serverId: string, setupConfig: ChannelSetupConfig): void;
    requestChannelSetupRerun(): void;
    handleGlobalError(error: AppError, context: string): void;
    registerErrorHandler(moduleId: string, handler: (error: AppError) => boolean): void;
    getRecoveryActions(errorCode: AppErrorCode): ErrorRecoveryAction[];
    toLifecycleAppError(error: AppError): LifecycleAppError;
    onLifecycleEvent<K extends keyof LifecycleEventMap>(
        event: K,
        handler: (payload: LifecycleEventMap[K]) => void
    ): IDisposable;
    getNavigation(): INavigationManager | null;
    setNowPlayingHandler(handler: ((toast: ToastInput) => void) | null): void;
}

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
export class AppOrchestrator implements IAppOrchestrator {
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
    private _channelNumberOverlay: IChannelNumberOverlay | null = null;
    private _channelBadgeOverlay: IChannelBadgeOverlay | null = null;
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
    private _nowPlayingDebugManager: NowPlayingDebugManager | null = null;
    private _playbackRecovery: PlaybackRecoveryManager | null = null;
    private _channelTuning: ChannelTuningCoordinator | null = null;
    private _navigationCoordinator: NavigationCoordinator | null = null;
    private _nowPlayingHandler: ((toast: ToastInput) => void) | null = null;
    private _pendingNowPlayingChannelId: string | null = null;
    private _shouldAutoShowInfoBannerOnNextPlay = false;
    private _lastChannelChangeSource: 'remote' | 'number' | 'guide' | null = null;
    private _activeScheduleDayKey: number | null = null;
    private _pendingDayRolloverDayKey: number | null = null;
    private _pendingDayRolloverTimer: ReturnType<typeof setTimeout> | null = null;

    private _config: OrchestratorConfig | null = null;
    private _moduleStatus: Map<string, ModuleStatus> = new Map();
    private _errorHandlers: Map<string, (error: AppError) => boolean> = new Map();
    private _eventUnsubscribers: Array<() => void> = [];
    private _eventsWired: boolean = false;
    private _ready: boolean = false;
    private _initCoordinator: IInitializationCoordinator | null = null;
    private _channelSetup: ChannelSetupCoordinator | null = null;
    private _lastProgramStartPromise: Promise<void> | null = null;
    private _programStartSequence: number = 0;

    private _currentProgramForPlayback: ScheduledProgram | null = null;
    private _currentStreamDescriptor: StreamDescriptor | null = null;
    private _currentStreamDecision: StreamDecision | null = null;
    private readonly _platformServices: PlatformServices;
    private readonly _storageContext: OrchestratorStorageContext;

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

        // Create module instances (not yet initialized)
        this._lifecycle = new AppLifecycle(undefined, undefined, this._platformServices.lifecycle);
        this._navigation = new NavigationManager(this._platformServices.input);
        this._plexAuth = new PlexAuth(config.plexConfig);
        this._plexDiscovery = new PlexServerDiscovery({
            getAuthHeaders: (): Record<string, string> => {
                if (this._plexAuth) {
                    return this._plexAuth.getAuthHeaders();
                }
                return {};
            },
        });
        this._configureDiscoveryStorageKeysForActiveUser();

        // PlexLibrary needs config with accessors
        const plexLibraryConfig: PlexLibraryConfig = {
            getAuthHeaders: () => {
                if (this._plexAuth) {
                    return this._plexAuth.getAuthHeaders();
                }
                return {};
            },
            getServerUri: () => {
                if (this._plexDiscovery) {
                    return this._plexDiscovery.getServerUri();
                }
                return null;
            },
            getAuthToken: () => {
                if (this._plexAuth) {
                    const user = this._plexAuth.getCurrentUser();
                    return user ? user.token : null;
                }
                return null;
            },
        };
        const plexLibrary = new PlexLibrary(plexLibraryConfig);
        this._plexLibrary = plexLibrary;

        // PlexStreamResolver needs config with accessors
        const streamResolverConfig: PlexStreamResolverConfig = {
            getAuthHeaders: () => {
                if (this._plexAuth) {
                    return this._plexAuth.getAuthHeaders();
                }
                return {};
            },
            getServerUri: () => {
                if (this._plexDiscovery) {
                    return this._plexDiscovery.getServerUri();
                }
                return null;
            },
            getSelectedConnection: () => {
                const conn = this._plexDiscovery?.getSelectedConnection() ?? null;
                if (!conn) return null;
                return { uri: conn.uri, local: conn.local, relay: conn.relay };
            },
            getHttpsConnection: () => {
                const conn = this._plexDiscovery?.getHttpsConnection() ?? null;
                if (conn) return { uri: conn.uri };
                return null;
            },
            getRelayConnection: () => {
                const conn = this._plexDiscovery?.getRelayConnection() ?? null;
                if (conn) return { uri: conn.uri };
                return null;
            },
            getItem: async (ratingKey: string) => {
                if (this._plexLibrary) {
                    return this._plexLibrary.getItem(ratingKey);
                }
                return null;
            },
            clientIdentifier: config.plexConfig.clientIdentifier,
            identityService: this._platformServices.identity,
        };
        const plexStreamResolver = new PlexStreamResolver(streamResolverConfig);
        this._plexStreamResolver = plexStreamResolver;

        // ChannelManager needs config
        const channelManagerConfig: ChannelManagerConfig = {
            plexLibrary: plexLibrary,
            storageKey: STORAGE_KEYS.CHANNELS_REAL,
            currentChannelKey: STORAGE_KEYS.CURRENT_CHANNEL,
        };
        this._channelManager = new ChannelManager(channelManagerConfig);

        // ChannelScheduler - no init args
        this._scheduler = new ChannelScheduler();

        // VideoPlayer - no constructor args, initialize later
        this._videoPlayer = new VideoPlayer({
            playbackService: this._platformServices.playback,
            subtitleService: this._platformServices.subtitle,
        });

        // EPGComponent - no constructor args, initialize later
        this._epg = new EPGComponent();

        // Now Playing Info overlay - no constructor args, initialize later
        this._nowPlayingInfo = new NowPlayingInfoOverlay();

        // Player OSD overlay - no constructor args, initialize later
        this._playerOsd = new PlayerOsdOverlay();
        this._channelNumberOverlay = new ChannelNumberOverlay();
        this._channelBadgeOverlay = new ChannelBadgeOverlay();

        // Mini Guide overlay - no constructor args, initialize later
        this._miniGuide = new MiniGuideOverlay();

        // Channel transition overlay - no constructor args, initialize later
        this._channelTransitionOverlay = new ChannelTransitionOverlay();

        // Playback Options modal - no constructor args, initialize later
        this._playbackOptionsModal = new PlaybackOptionsModal();

        // Exit confirmation modal - initialize later
        this._exitConfirmModal = new ExitConfirmModal();
        this._sleepTimer = new SleepTimerManager({
            onWarning: (): void => undefined,
            onSleep: (): void => {
                this._videoPlayer?.pause();
            },
            onCancel: (): void => undefined,
            onTick: (): void => {
                // Sleep timer countdown is independent of playback time updates; only refresh OSD if visible.
                this._playerOsdCoordinator?.refreshIfVisible();
            },
        });

        this._createCoordinators();
        if (this._config.epgConfig) {
            const previousOnVisibleRangeChange = this._config.epgConfig.onVisibleRangeChange ?? null;
            this._config.epgConfig.onVisibleRangeChange = (range): void => {
                if (previousOnVisibleRangeChange) {
                    previousOnVisibleRangeChange(range);
                }
                this._epgCoordinator?.refreshEpgSchedulesForRange(range, { reason: 'visible-range' });
            };
        }
        this._channelSetup?.cleanupStaleChannelBuildKeys();

        // Create InitializationCoordinator with dependencies and callbacks
        this._initCoordinator = new InitializationCoordinator(
            config,
            {
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
                nowPlayingInfo: this._nowPlayingInfo,
                playerOsd: this._playerOsd,
                channelNumberOverlay: this._channelNumberOverlay,
                channelBadgeOverlay: this._channelBadgeOverlay,
                miniGuide: this._miniGuide,
                channelTransition: this._channelTransitionOverlay,
                playbackOptions: this._playbackOptionsModal,
                exitConfirm: this._exitConfirmModal,
            },
            {
                updateModuleStatus: this._updateModuleStatus.bind(this),
                getModuleStatus: (id: string): ModuleStatus['status'] | undefined => this._moduleStatus.get(id)?.status,
                handleGlobalError: this.handleGlobalError.bind(this),
                setReady: (ready: boolean): void => { this._ready = ready; },
                setupEventWiring: this._setupEventWiring.bind(this),
                configureDiscoveryStorage: this._configureDiscoveryStorageKeysForActiveUser.bind(this),
                configureChannelManagerStorage: this._configureChannelManagerStorageForSelectedServer.bind(this),
                getSelectedServerId: this._getSelectedServerId.bind(this),
                shouldRunAudioSetup: this._shouldRunAudioSetup.bind(this),
                shouldRunChannelSetup: (): boolean => this._channelSetup?.shouldRunChannelSetup() ?? false,
                switchToChannel: this.switchToChannel.bind(this),
                openServerSelect: this.openServerSelect.bind(this),
                buildPlexResourceUrl: (pathOrUrl: string | null): string | null => {
                    if (!pathOrUrl) return null;
                    return this._buildPlexResourceUrl(pathOrUrl);
                },
                seedSubtitleLanguageFromPlexUser: (): void => {
                    this._seedSubtitleLanguageFromPlexUser();
                },
            }
        );

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
        this._epgCoordinator = new EPGCoordinator({
            getEpg: (): IEPGComponent | null => this._epg,
            getChannelManager: (): IChannelManager | null => this._channelManager,
            getScheduler: (): IChannelScheduler | null => this._scheduler,
            getEpgUiStatus: (): EpgUiStatus => this._moduleStatus.get('epg-ui')?.status as EpgUiStatus,
            ensureEpgInitialized: (): Promise<void> =>
                this._initCoordinator?.ensureEPGInitialized() ?? Promise.resolve(),
            getEpgConfig: (): EPGConfig | null => this._config?.epgConfig ?? null,
            getLocalMidnightMs: (t: number): number => this._getLocalMidnightMs(t),
            buildDailyScheduleConfig: (
                channel: ChannelConfig,
                items: ResolvedChannelContent['items'],
                referenceTimeMs: number
            ): ScheduleConfig => this._buildDailyScheduleConfig(channel, items, referenceTimeMs),
            getPreserveFocusOnOpen: (): boolean => this._lastChannelChangeSource === 'guide',
            setLastChannelChangeSourceToGuide: (): void => {
                this._lastChannelChangeSource = 'guide';
            },
            switchToChannel: (channelId: string): Promise<void> => this.switchToChannel(channelId),
            reportEpgInitWarning: (error: unknown): void => {
                console.warn('[EPG_INIT] Deferred guide initialization failed:', summarizeErrorForLog(error));
                this._nowPlayingHandler?.({
                    message: 'Guide unavailable right now. Try again.',
                    type: 'warning',
                });
            },
        });

        this._channelSetup = new ChannelSetupCoordinator({
            plexLibrary: this._plexLibrary!,
            channelManager: this._channelManager!,
            navigation: this._navigation!,
            getSelectedServerId: (): string | null => this._getSelectedServerId(),
            storageGet: (key: string): string | null => safeLocalStorageGet(key),
            storageSet: (key: string, value: string): void => {
                safeLocalStorageSet(key, value);
            },
            storageRemove: (key: string): void => {
                safeLocalStorageRemove(key);
            },
            handleGlobalError: (error: AppError, context: string): void => this.handleGlobalError(error, context),
            primeEpgChannels: (): void => this._epgCoordinator?.primeEpgChannels(),
            refreshEpgSchedules: (options?: { reason?: string; debounceMs?: number }): Promise<void> =>
                this._epgCoordinator?.refreshEpgSchedules(options) ?? Promise.resolve(),
        });

        this._nowPlayingDebugManager = new NowPlayingDebugManager({
            nowPlayingModalId: NOW_PLAYING_INFO_MODAL_ID,
            getNavigation: (): INavigationManager | null => this._navigation,
            getStreamResolver: (): IPlexStreamResolver | null => this._plexStreamResolver,
            getNowPlayingInfo: (): INowPlayingInfoOverlay | null => this._nowPlayingInfo,
            getCurrentProgram: (): ScheduledProgram | null =>
                this._scheduler?.getCurrentProgram() ?? this._currentProgramForPlayback,
            getCurrentStreamDecision: (): StreamDecision | null => this._currentStreamDecision,
            requestNowPlayingOverlayRefresh: (): void =>
                this._nowPlayingInfoCoordinator?.refreshIfOpen(),
        });

        this._nowPlayingInfoCoordinator = new NowPlayingInfoCoordinator({
            nowPlayingModalId: NOW_PLAYING_INFO_MODAL_ID,
            getNavigation: (): INavigationManager | null => this._navigation,
            getScheduler: (): IChannelScheduler | null => this._scheduler,
            getChannelManager: (): IChannelManager | null => this._channelManager,
            getPlexLibrary: (): IPlexLibrary | null => this._plexLibrary,
            getNowPlayingInfo: (): INowPlayingInfoOverlay | null => this._nowPlayingInfo,
            getNowPlayingInfoConfig: (): NowPlayingInfoConfig | null =>
                this._config?.nowPlayingInfoConfig ?? null,
            buildPlexResourceUrl: (pathOrUrl: string): string | null =>
                this._buildPlexResourceUrl(pathOrUrl),
            buildDebugText: (): string | null =>
                this._nowPlayingDebugManager?.buildNowPlayingStreamDebugText() ?? null,
            maybeFetchStreamDecisionForDebugHud: (): Promise<void> =>
                this._nowPlayingDebugManager?.maybeFetchNowPlayingStreamDecisionForDebugHud() ??
                Promise.resolve(),
            getAutoHideMs: (): number =>
                getNowPlayingInfoAutoHideMs(this._config?.nowPlayingInfoConfig),
            getCurrentProgramForPlayback: (): ScheduledProgram | null =>
                this._currentProgramForPlayback,
            getPlaybackInfoSnapshot: (): PlaybackInfoSnapshot | null =>
                this.getPlaybackInfoSnapshot(),
            refreshPlaybackInfoSnapshot: (): Promise<PlaybackInfoSnapshot> =>
                this.refreshPlaybackInfoSnapshot(),
            onVisibilityChange: (visible: boolean): void => {
                this._handleOverlayVisibilityChange(visible);
            },
        });

        this._playerOsdCoordinator = new PlayerOsdCoordinator({
            getOverlay: (): IPlayerOsdOverlay | null => this._playerOsd,
            getCurrentProgram: (): ScheduledProgram | null =>
                this._scheduler?.getCurrentProgram() ?? this._currentProgramForPlayback,
            getNextProgram: (): ScheduledProgram | null => this._scheduler?.getNextProgram() ?? null,
            getCurrentChannel: (): ChannelConfig | null =>
                this._channelManager?.getCurrentChannel() ?? null,
            getVideoPlayer: (): IVideoPlayer | null => this._videoPlayer,
            getAutoHideMs: (): number =>
                this._config?.playerConfig.hideControlsAfterMs ?? 3000,
            getNavigation: (): INavigationManager | null => this._navigation,
            buildPlexResourceUrl: (pathOrUrl: string): string | null =>
                this._buildPlexResourceUrl(pathOrUrl),
            cycleSleepTimerPreset: (): number => this._sleepTimer?.cyclePreset() ?? 0,
            getSleepTimerRemainingMs: (): number => this._sleepTimer?.getRemainingMs() ?? 0,
            playbackOptionsModalId: PLAYBACK_OPTIONS_MODAL_ID,
            preparePlaybackOptionsModal: (
                preferredSection
            ): { focusableIds: string[]; preferredFocusId: string | null } =>
                this._playbackOptionsCoordinator?.prepareModal(preferredSection) ??
                { focusableIds: [], preferredFocusId: null },
            onVisibilityChange: (visible: boolean): void => {
                this._handleOverlayVisibilityChange(visible);
            },
        });

        this._miniGuideCoordinator = new MiniGuideCoordinator({
            getOverlay: (): IMiniGuideOverlay | null => this._miniGuide,
            getChannelManager: (): IChannelManager | null => this._channelManager,
            getScheduler: (): IChannelScheduler | null => this._scheduler,
            buildDailyScheduleConfig: (
                channel: ChannelConfig,
                items: ResolvedChannelContent['items'],
                referenceTimeMs: number
            ): ScheduleConfig => this._buildDailyScheduleConfig(channel, items, referenceTimeMs),
            switchToChannel: (channelId: string): Promise<void> => this.switchToChannel(channelId),
            getAutoHideMs: (): number => {
                const configured = this._config?.miniGuideConfig?.autoHideMs;
                if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) {
                    return Math.max(1000, Math.floor(configured));
                }
                return 8_000;
            },
        });

        this._channelTransitionCoordinator = new ChannelTransitionCoordinator({
            getOverlay: (): IChannelTransitionOverlay | null => this._channelTransitionOverlay,
            getNavigation: (): INavigationManager | null => this._navigation,
            getVideoPlayer: (): IVideoPlayer | null => this._videoPlayer,
        });

        this._playbackOptionsCoordinator = new PlaybackOptionsCoordinator({
            playbackOptionsModalId: PLAYBACK_OPTIONS_MODAL_ID,
            getNavigation: (): INavigationManager | null => this._navigation,
            getPlaybackOptionsModal: (): IPlaybackOptionsModal | null => this._playbackOptionsModal,
            getVideoPlayer: (): IVideoPlayer | null => this._videoPlayer,
            getCurrentStreamDescriptor: (): StreamDescriptor | null => this._currentStreamDescriptor,
            getCurrentProgram: (): ScheduledProgram | null =>
                this._scheduler?.getCurrentProgram() ?? this._currentProgramForPlayback,
            requestBurnInSubtitle: (trackId: string, reason: string): Promise<boolean> =>
                this._playbackRecovery?.attemptBurnInSubtitleForCurrentProgram(trackId, reason)
                ?? Promise.resolve(false),
            notifyToast: (message, type): void => {
                if (!this._nowPlayingHandler) return;
                this._nowPlayingHandler(type ? { message, type } : message);
            },
        });

        this._exitConfirmCoordinator = new ExitConfirmCoordinator({
            getNavigation: (): INavigationManager | null => this._navigation,
            getModal: (): ExitConfirmModal | null => this._exitConfirmModal,
        });

        this._playbackRecovery = new PlaybackRecoveryManager({
            getVideoPlayer: (): IVideoPlayer | null => this._videoPlayer,
            getStreamResolver: (): IPlexStreamResolver | null => this._plexStreamResolver,
            getScheduler: (): IChannelScheduler | null => this._scheduler,
            getCurrentProgramForPlayback: (): ScheduledProgram | null => this._currentProgramForPlayback,
            getCurrentStreamDescriptor: (): StreamDescriptor | null => this._currentStreamDescriptor,
            getCurrentStreamDecision: (): StreamDecision | null => this._currentStreamDecision,
            setCurrentStreamDecision: (decision: StreamDecision): void => {
                this._currentStreamDecision = decision;
            },
            setCurrentStreamDescriptor: (descriptor: StreamDescriptor): void => {
                this._currentStreamDescriptor = descriptor;
            },
            buildPlexResourceUrl: (pathOrUrl: string): string | null =>
                this._buildPlexResourceUrl(pathOrUrl),
            getMimeType: (decision: StreamDecision): string => this._getMimeType(decision),
            getAuthHeaders: (): Record<string, string> =>
                this._plexAuth?.getAuthHeaders() ?? {},
            getServerUri: (): string | null =>
                this._plexDiscovery?.getServerUri() ?? null,
            getPreferredSubtitleLanguage: (): string | null =>
                safeLocalStorageGet(LINEUP_STORAGE_KEYS.SUBTITLE_LANGUAGE),
            getPlexPreferredSubtitleLanguage: (): string | null =>
                this._plexAuth?.getCurrentUser()?.preferredSubtitleLanguage ?? null,
            notifySubtitleUnavailable: (): void => {
                if (this._nowPlayingHandler) {
                    this._nowPlayingHandler({ message: 'Subtitles unavailable for this item', type: 'warning' });
                }
            },
            notifyToast: (message, type): void => {
                if (!this._nowPlayingHandler) return;
                this._nowPlayingHandler(type ? { message, type } : message);
            },
            handleGlobalError: (error: AppError, context: string): void =>
                this.handleGlobalError(error, context),
        });

        this._channelTuning = new ChannelTuningCoordinator({
            getChannelManager: (): IChannelManager | null => this._channelManager,
            getScheduler: (): IChannelScheduler | null => this._scheduler,
            getVideoPlayer: (): IVideoPlayer | null => this._videoPlayer,
            buildDailyScheduleConfig: (
                channel: ChannelConfig,
                items: ResolvedChannelContent['items'],
                referenceTimeMs: number
            ): ScheduleConfig => this._buildDailyScheduleConfig(channel, items, referenceTimeMs),
            getLocalDayKey: (timeMs: number): number => this._getLocalDayKey(timeMs),
            setActiveScheduleDayKey: (dayKey: number): void => {
                this._activeScheduleDayKey = dayKey;
            },
            setPendingNowPlayingChannelId: (channelId: string | null): void => {
                this._pendingNowPlayingChannelId = channelId;
            },
            getPendingNowPlayingChannelId: (): string | null => this._pendingNowPlayingChannelId,
            resetPlaybackGuardsForNewChannel: (): void => {
                this._playbackRecovery?.resetPlaybackFailureGuard();
                this._playbackRecovery?.resetDirectFallbackAttempts();
            },
            stopActiveTranscodeSession: (): void => {
                this._stopActiveTranscodeSession();
            },
            armChannelTransitionForSwitch: (prefix: string): void => {
                this._channelTransitionCoordinator?.armForChannelSwitch(prefix);
            },
            handleGlobalError: (error: AppError, context: string): void =>
                this.handleGlobalError(error, context),
            saveLifecycleState: async (): Promise<void> => {
                if (this._lifecycle) {
                    await this._lifecycle.saveState();
                }
            },
        });

        this._navigationCoordinator = new NavigationCoordinator({
            navigation: this._navigation!,
            epg: this._epg,
            videoPlayer: this._videoPlayer,
            plexAuth: this._plexAuth,
            stopPlayback: (): void => this._stopPlayback(),
            pokePlayerOsd: (reason): void => {
                this._playerOsdCoordinator?.poke(reason);
            },
            togglePlayerOsd: (): void => {
                this._playerOsdCoordinator?.toggle();
            },
            isPlayerOsdVisible: (): boolean => this._playerOsd?.isVisible() ?? false,
            showMiniGuide: (): void => {
                this._miniGuideCoordinator?.show();
            },
            hideMiniGuide: (): void => {
                this._miniGuideCoordinator?.hide();
            },
            isMiniGuideVisible: (): boolean => this._miniGuide?.isVisible() ?? false,
            handleMiniGuideNavigation: (direction): boolean =>
                this._miniGuideCoordinator?.handleNavigation(direction) ?? false,
            handleMiniGuidePage: (direction): boolean =>
                this._miniGuideCoordinator?.handlePage(direction) ?? false,
            handleMiniGuideSelect: (): void => {
                this._lastChannelChangeSource = 'remote';
                this._miniGuideCoordinator?.handleSelect();
            },
            onChannelInputUpdate: (payload): void => {
                if (payload.digits) {
                    this._channelNumberOverlay?.showDigits(payload.digits, CHANNEL_INPUT_CONFIG.MAX_DIGITS);
                }
                if (payload.isComplete) {
                    const configuredDelay = this._config?.channelNumberOverlayConfig?.completeHideDelayMs;
                    const delayMs =
                        typeof configuredDelay === 'number' &&
                            Number.isFinite(configuredDelay) &&
                            configuredDelay >= 0
                            ? Math.floor(configuredDelay)
                            : 650;
                    this._channelNumberOverlay?.scheduleHide(delayMs);
                }
            },
            getSeekIncrementMs: (): number =>
                (this._config?.playerConfig.seekIncrementSec ?? 10) * 1000,
            isNowPlayingModalOpen: (): boolean => {
                const isOpen = this._navigation?.isModalOpen(NOW_PLAYING_INFO_MODAL_ID) ?? false;
                if (isOpen) {
                    this._nowPlayingInfo?.resetAutoHideTimer();
                }
                return isOpen;
            },
            toggleNowPlayingInfoOverlay: (): void => this._toggleNowPlayingInfoOverlay(),
            showNowPlayingInfoOverlay: (): void =>
                this._nowPlayingInfoCoordinator?.handleModalOpen(NOW_PLAYING_INFO_MODAL_ID),
            hideNowPlayingInfoOverlay: (): void =>
                this._nowPlayingInfoCoordinator?.handleModalClose(NOW_PLAYING_INFO_MODAL_ID),
            playbackOptionsModalId: PLAYBACK_OPTIONS_MODAL_ID,
            preparePlaybackOptionsModal: (
                preferredSection
            ): { focusableIds: string[]; preferredFocusId: string | null } =>
                this._playbackOptionsCoordinator?.prepareModal(preferredSection) ??
                { focusableIds: [], preferredFocusId: null },
            showPlaybackOptionsModal: (): void =>
                this._playbackOptionsCoordinator?.handleModalOpen(PLAYBACK_OPTIONS_MODAL_ID),
            hidePlaybackOptionsModal: (): void =>
                this._playbackOptionsCoordinator?.handleModalClose(PLAYBACK_OPTIONS_MODAL_ID),
            exitConfirmModalId: EXIT_CONFIRM_MODAL_ID,
            prepareExitConfirmModal: (): { focusableIds: string[] } => ({
                focusableIds: [...EXIT_CONFIRM_FOCUSABLE_IDS],
            }),
            showExitConfirmModal: (): void =>
                this._exitConfirmCoordinator?.handleModalOpen(EXIT_CONFIRM_MODAL_ID),
            hideExitConfirmModal: (): void =>
                this._exitConfirmCoordinator?.handleModalClose(EXIT_CONFIRM_MODAL_ID),
            setLastChannelChangeSourceRemote: (): void => {
                this._lastChannelChangeSource = 'remote';
            },
            setLastChannelChangeSourceNumber: (): void => {
                this._lastChannelChangeSource = 'number';
            },
            switchToNextChannel: (): void => this._switchToNextChannel(),
            switchToPreviousChannel: (): void => this._switchToPreviousChannel(),
            switchToChannelByNumber: (n: number): Promise<ChannelSwitchOutcome> =>
                this._switchToChannelByNumberWithOutcome(n),
            focusEpgOnCurrentChannel: (): void => {
                this._epgCoordinator?.focusEpgOnCurrentChannel();
            },
            toggleEpg: (): void => this.toggleEPG(),
            shouldRunChannelSetup: (): boolean => this._channelSetup?.shouldRunChannelSetup() ?? false,
            hidePlayerOsd: (): void => {
                this._playerOsdCoordinator?.hide();
            },
            hideChannelTransition: (): void => {
                this._channelTransitionCoordinator?.hide();
            },
            reportToast: (toast): void => {
                this._nowPlayingHandler?.(toast);
            },
        });
    }

    /**
     * Start the application - execute initialization sequence and begin playback.
     * Follows 5-phase initialization order per spec.
     */
    async start(): Promise<void> {
        this._playbackRecovery?.resetPlaybackFailureGuard();
        if (!this._initCoordinator) {
            throw new Error('Orchestrator must be initialized before starting');
        }
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

        if (this._pendingDayRolloverTimer !== null) {
            globalThis.clearTimeout(this._pendingDayRolloverTimer);
            this._pendingDayRolloverTimer = null;
        }
        this._pendingDayRolloverDayKey = null;

        // Unregister all event subscriptions (resilient to throwing handlers)
        for (const unsubscribe of this._eventUnsubscribers) {
            try {
                unsubscribe();
            } catch (error) {
                recordTeardownFailure('events.unsubscribe', error);
            }
        }
        this._eventUnsubscribers = [];
        this._eventsWired = false; // Reset to allow re-wiring on retry

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
            console.warn('[Orchestrator] setSubtitleTrack failed:', summarizeErrorForLog(error));
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
            throw new Error('PlexAuth not initialized');
        }
        return this._plexAuth.requestPin();
    }

    /**
     * Poll for PIN claim status.
     */
    async pollForPin(pinId: number): Promise<PlexPinRequest> {
        if (!this._plexAuth) {
            throw new Error('PlexAuth not initialized');
        }
        return this._plexAuth.pollForPin(pinId);
    }

    /**
     * Cancel an active PIN request.
     */
    async cancelPin(pinId: number): Promise<void> {
        if (!this._plexAuth) {
            throw new Error('PlexAuth not initialized');
        }
        await this._plexAuth.cancelPin(pinId);
    }

    async getHomeUsers(): Promise<PlexHomeUser[]> {
        if (!this._plexAuth) {
            throw new Error('PlexAuth not initialized');
        }
        return this._plexAuth.getHomeUsers();
    }

    async switchHomeUser(userId: string, pin?: string): Promise<void> {
        if (!this._plexAuth || !this._plexDiscovery) {
            throw new Error('PlexAuth not initialized');
        }

        this._prepareForProfileSwitch();
        // Profile-switch startup is resumed explicitly below; avoid duplicate
        // queued startup runs from a stale profile-resume listener.
        this._initCoordinator?.clearProfileResume();
        await this._plexAuth.switchHomeUser(userId, { pin: pin ?? null });
        this._configureDiscoveryStorageKeysForActiveUser();

        if (this._initCoordinator) {
            await this._initCoordinator.runStartup(3);
        } else {
            await this._plexDiscovery.initialize();
        }
    }

    async useMainAccountProfile(): Promise<void> {
        if (!this._plexAuth || !this._plexDiscovery) {
            throw new Error('PlexAuth not initialized');
        }

        this._prepareForProfileSwitch();
        // Same as switchHomeUser: avoid duplicate startup runs when an old
        // profile-resume listener is still registered.
        this._initCoordinator?.clearProfileResume();
        await this._plexAuth.logoutActiveUser();
        this._configureDiscoveryStorageKeysForActiveUser();

        if (this._initCoordinator) {
            await this._initCoordinator.runStartup(3);
        } else {
            await this._plexDiscovery.initialize();
        }
    }

    async signOutPlex(): Promise<void> {
        if (!this._plexAuth) {
            throw new Error('PlexAuth not initialized');
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
            throw new Error('PlexServerDiscovery not initialized');
        }
        if (forceRefresh) {
            return this._plexDiscovery.refreshServers();
        }
        return this._plexDiscovery.discoverServers();
    }

    /**
     * Select a Plex server to connect to.
     */
    async selectServer(serverId: string): Promise<boolean> {
        if (!this._plexDiscovery) {
            throw new Error('PlexServerDiscovery not initialized');
        }
        const ok = await this._plexDiscovery.selectServer(serverId);
        if (ok) {
            await this._persistSelectedServerForActiveUser(
                serverId,
                this._plexDiscovery.getServerUri()
            );
            // If we're already running (or resuming from the server-select screen),
            // re-run the channel/player/EPG phases to swap to the selected server.
            if (this._initCoordinator) {
                await this._initCoordinator.runStartup(3);
                if (this._epg) {
                    this._epgCoordinator?.clearScheduleCaches();
                    this._epg.clearSchedules();
                }
                this._epgCoordinator?.primeEpgChannels();
                await this._epgCoordinator?.refreshEpgSchedules({ reason: 'server-swap' });
            }
            return this._ready;
        }
        return ok;
    }

    /**
     * Clear saved server selection.
     */
    clearSelectedServer(): void {
        if (!this._plexDiscovery) {
            throw new Error('PlexServerDiscovery not initialized');
        }
        this._plexDiscovery.clearSelection();
        void this._persistSelectedServerForActiveUser(null, null);
    }

    async getLibrariesForSetup(signal?: AbortSignal | null): Promise<PlexLibraryType[]> {
        return this._channelSetup?.getLibrariesForSetup(signal ?? null)
            ?? Promise.reject(new Error('Channel setup not initialized'));
    }

    getChannelSetupRecord(serverId: string): ChannelSetupRecord | null {
        return this._channelSetup?.getSetupRecord(serverId) ?? null;
    }

    getSetupContextForSelectedServer(): ChannelSetupContext {
        return this._channelSetup?.getSetupContextForSelectedServer() ?? 'unknown';
    }

    async getSetupPreview(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSetupPreview> {
        return this._channelSetup?.getSetupPreview(config, options)
            ?? Promise.reject(new Error('Channel setup not initialized'));
    }

    async getSetupReview(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal }
    ): Promise<ChannelSetupReview> {
        return this._channelSetup?.getSetupReview(config, options)
            ?? Promise.reject(new Error('Channel setup not initialized'));
    }

    async createChannelsFromSetup(
        config: ChannelSetupConfig,
        options?: { signal?: AbortSignal; onProgress?: (p: ChannelBuildProgress) => void }
    ): Promise<ChannelBuildSummary> {
        return this._channelSetup?.createChannelsFromSetup(config, options)
            ?? Promise.reject(new Error('Channel setup not initialized'));
    }

    markSetupComplete(serverId: string, setupConfig: ChannelSetupConfig): void {
        this._channelSetup?.markSetupComplete(serverId, setupConfig);
    }

    requestChannelSetupRerun(): void {
        this._channelSetup?.requestChannelSetupRerun();
    }

    /**
     * Switch to a channel by ID.
     * Stops current playback, resolves content, configures scheduler, and syncs.
     * @param channelId - ID of channel to switch to
     */
    async switchToChannel(channelId: string, options?: { signal?: AbortSignal }): Promise<void> {
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
        const epg = this._epg;
        const epgCoordinator = this._epgCoordinator;
        if (!epg || !epgCoordinator) return;
        if (!epg.isVisible()) return;

        if (change.key === 'layoutMode') {
            epg.setLayoutMode(change.mode);
            return;
        }

        if (change.key === 'nowWatchingBanner') {
            epg.setNowWatchingBannerEnabled(change.enabled);
            return;
        }

        if (change.key === 'libraryTabs' || change.key === 'aggressivePreload' || change.key === 'pastItemsWindow') {
            epgCoordinator.clearScheduleCaches();
            epg.clearSchedules();
        }

        epgCoordinator.primeEpgChannels();
        if (
            change.key === 'libraryTabs' ||
            change.key === 'guideDensity' ||
            change.key === 'aggressivePreload' ||
            change.key === 'pastItemsWindow'
        ) {
            void epgCoordinator.refreshEpgSchedules({ reason: 'guide-settings' });
        }
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
        const existing = safeLocalStorageGet(LINEUP_STORAGE_KEYS.SUBTITLE_LANGUAGE);
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
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.SUBTITLE_LANGUAGE, normalized);
    }

    private async _configureChannelManagerStorageForSelectedServer(): Promise<void> {
        await this._storageContext.configureChannelManagerStorageForSelectedServer();
    }

    private async _persistSelectedServerForActiveUser(
        serverId: string | null,
        serverUri: string | null
    ): Promise<void> {
        if (!this._plexAuth) {
            return;
        }
        const stored = await this._plexAuth.getStoredCredentials();
        if (!stored) {
            return;
        }
        const activeUserId = this._plexAuth.getActiveUserId() ?? stored.activeUserId;
        if (!activeUserId) {
            return;
        }
        const selectedServerByUserId = {
            ...(stored.selectedServerByUserId ?? {}),
        };
        selectedServerByUserId[activeUserId] = { serverId, serverUri };
        await this._plexAuth.storeCredentials({
            accountToken: stored.accountToken,
            activeToken: stored.activeToken,
            activeUserId,
            selectedServerByUserId,
            deviceKey: stored.deviceKey ?? null,
        });
    }

    private _shouldRunAudioSetup(): boolean {
        // Check if audio setup has been completed
        const completed = safeLocalStorageGet(LINEUP_STORAGE_KEYS.AUDIO_SETUP_COMPLETE);
        return completed !== '1';
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

        const baseSeed =
            typeof channel.shuffleSeed === 'number' && Number.isFinite(channel.shuffleSeed)
                ? channel.shuffleSeed
                : Date.now();

        const isShuffleLike = channel.playbackMode === 'shuffle' || channel.playbackMode === 'block';
        const effectiveSeed = isShuffleLike ? (baseSeed ^ dayKey) >>> 0 : baseSeed;

        const scheduleConfig: ScheduleConfig = {
            channelId: channel.id,
            anchorTime: dayStart - phaseOffsetMs,
            content: items,
            playbackMode: channel.playbackMode,
            shuffleSeed: effectiveSeed,
            loopSchedule: true,
        };

        if (typeof channel.blockSize === 'number' && Number.isFinite(channel.blockSize)) {
            scheduleConfig.blockSize = channel.blockSize;
        }

        return scheduleConfig;
    }

    private async _handleScheduleDayRollover(): Promise<void> {
        if (!this._channelManager || !this._scheduler) {
            return;
        }
        const now = Date.now();
        const dayKey = this._getLocalDayKey(now);
        if (this._activeScheduleDayKey === null) {
            this._activeScheduleDayKey = dayKey;
            return;
        }
        if (dayKey === this._activeScheduleDayKey) {
            return;
        }

        // If we're already waiting to apply the same day rollover, no-op.
        if (this._pendingDayRolloverDayKey === dayKey) {
            return;
        }

        const dayStart = this._getLocalMidnightMs(now);
        const currentProgram = this._scheduler.getCurrentProgram();
        const spansMidnight =
            currentProgram !== null &&
            currentProgram.scheduledStartTime < dayStart &&
            currentProgram.scheduledEndTime > dayStart;

        // Avoid interrupting a program that started before midnight and is still playing.
        if (spansMidnight) {
            this._pendingDayRolloverDayKey = dayKey;
            if (this._pendingDayRolloverTimer !== null) {
                globalThis.clearTimeout(this._pendingDayRolloverTimer);
                this._pendingDayRolloverTimer = null;
            }
            const delayMs = Math.max(0, currentProgram.scheduledEndTime - now + 50);
            this._pendingDayRolloverTimer = globalThis.setTimeout(() => {
                this._pendingDayRolloverTimer = null;
                this._applyScheduleDayRollover().catch((error) => {
                    console.error('[Orchestrator] Failed to apply day rollover:', summarizeErrorForLog(error));
                });
            }, delayMs);
            return;
        }

        this._pendingDayRolloverDayKey = dayKey;
        await this._applyScheduleDayRollover();
    }

    private async _applyScheduleDayRollover(): Promise<void> {
        if (!this._channelManager || !this._scheduler) {
            return;
        }
        const now = Date.now();
        const dayKey = this._getLocalDayKey(now);
        if (this._activeScheduleDayKey === dayKey) {
            this._pendingDayRolloverDayKey = null;
            return;
        }

        const current = this._channelManager.getCurrentChannel();
        if (!current) {
            this._activeScheduleDayKey = dayKey;
            this._pendingDayRolloverDayKey = null;
            return;
        }

        const content = await this._channelManager.resolveChannelContent(current.id);
        this._scheduler.loadChannel(this._buildDailyScheduleConfig(current, content.items, now));
        this._scheduler.syncToCurrentTime();

        await this._epgCoordinator?.refreshEpgSchedules();
        this._activeScheduleDayKey = dayKey;
        this._pendingDayRolloverDayKey = null;
    }

    // ============================================
    // Private Methods - Event Wiring
    // ============================================

    private _wireSchedulerEvents(cleanups: Array<() => void>): void {
        const scheduler = this._scheduler;
        if (!scheduler) return;

        const programStartHandler = (program: ScheduledProgram): void => {
            this._handleProgramStartTracked(program).catch((error) => {
                console.error('[Orchestrator] Unhandled error in program start:', summarizeErrorForLog(error));
            });
        };
        scheduler.on('programStart', programStartHandler);

        const scheduleSyncHandler = (): void => {
            this._handleScheduleDayRollover().catch((error) => {
                console.error('[Orchestrator] Unhandled error in scheduleSync handler:', summarizeErrorForLog(error));
            });
        };
        scheduler.on('scheduleSync', scheduleSyncHandler);

        cleanups.push(() => {
            scheduler.off('programStart', programStartHandler);
            scheduler.off('scheduleSync', scheduleSyncHandler);
        });
    }

    private _wirePlayerEvents(cleanups: Array<() => void>): void {
        const videoPlayer = this._videoPlayer;
        if (!videoPlayer) return;

        const endedHandler = (): void => {
            this._handlePlayerEnded();
        };
        const trackChangeHandler = (event: { type: 'audio' | 'subtitle'; trackId: string | null }): void => {
            this._handlePlayerTrackChange(event);
        };
        const errorHandler = (error: PlaybackError): void => {
            this._handlePlaybackError(error);
        };
        const stateChangeHandler = (state: PlaybackState): void => {
            this._handlePlayerStateChange(state);
        };
        const timeUpdateHandler = (payload: { currentTimeMs: number; durationMs: number }): void => {
            this._handlePlayerTimeUpdate(payload);
        };
        const bufferUpdateHandler = (payload: { percent: number; bufferedRanges: TimeRange[] }): void => {
            this._handlePlayerBufferUpdate(payload);
        };

        videoPlayer.on('ended', endedHandler);
        videoPlayer.on('trackChange', trackChangeHandler);
        videoPlayer.on('error', errorHandler);
        videoPlayer.on('stateChange', stateChangeHandler);
        videoPlayer.on('timeUpdate', timeUpdateHandler);
        videoPlayer.on('bufferUpdate', bufferUpdateHandler);

        cleanups.push(() => {
            videoPlayer.off('ended', endedHandler);
            videoPlayer.off('trackChange', trackChangeHandler);
            videoPlayer.off('error', errorHandler);
            videoPlayer.off('stateChange', stateChangeHandler);
            videoPlayer.off('timeUpdate', timeUpdateHandler);
            videoPlayer.off('bufferUpdate', bufferUpdateHandler);
        });
    }

    private _wirePlexEvents(cleanups: Array<() => void>): void {
        const plexLibrary = this._plexLibrary;
        if (plexLibrary) {
            const authExpiredHandler = (): void => {
                this._handlePlexLibraryAuthExpired();
            };
            plexLibrary.on('authExpired', authExpiredHandler);
            cleanups.push(() => {
                plexLibrary.off('authExpired', authExpiredHandler);
            });
        }

        const plexStreamResolver = this._plexStreamResolver;
        if (plexStreamResolver) {
            const plexStreamErrorHandler = (error: StreamResolverError): void => {
                this._handlePlexStreamError(error);
            };
            plexStreamResolver.on('error', plexStreamErrorHandler);
            cleanups.push(() => {
                plexStreamResolver.off('error', plexStreamErrorHandler);
            });
        }
    }

    private _wireNavigationEvents(cleanups: Array<() => void>): void {
        cleanups.push(...(this._navigationCoordinator?.wireNavigationEvents() ?? []));
        const navigation = this._navigation;
        if (!navigation) {
            return;
        }

        const screenChangeHandler = (payload: { from: string; to: string }): void => {
            this._handleScreenChange(payload);
        };
        navigation.on('screenChange', screenChangeHandler);
        cleanups.push(() => {
            navigation.off('screenChange', screenChangeHandler);
        });
    }

    private _wireEpgEvents(cleanups: Array<() => void>): void {
        cleanups.push(...(this._epgCoordinator?.wireEpgEvents() ?? []));
    }

    private _wireChannelManagerEvents(cleanups: Array<() => void>): void {
        const channelManager = this._channelManager;
        if (!channelManager) {
            return;
        }
        const sub = channelManager.on('persistenceWarning', ({ message }) => {
            this._nowPlayingHandler?.({ message, type: 'warning' });
        });
        cleanups.push(() => {
            if (sub && typeof (sub as { dispose?: unknown }).dispose === 'function') {
                (sub as { dispose: () => void }).dispose();
            }
        });
    }

    private _wireLifecycleEvents(cleanups: Array<() => void>): void {
        const lifecycle = this._lifecycle;
        if (!lifecycle) return;

        const pauseSub = lifecycle.onPause(() => {
            return this._handleLifecyclePause().catch((error) => {
                console.error('[Orchestrator] Unhandled error in lifecycle pause handler:', summarizeErrorForLog(error));
            });
        });

        const resumeSub = lifecycle.onResume(() => {
            return this._handleLifecycleResume().catch((error) => {
                console.error('[Orchestrator] Unhandled error in lifecycle resume handler:', summarizeErrorForLog(error));
            });
        });

        cleanups.push(() => pauseSub.dispose());
        cleanups.push(() => resumeSub.dispose());
    }

    /**
     * Wire up all cross-module events per integration contracts.
     * Idempotent: guards against duplicate wiring on retries.
     */
    private _setupEventWiring(): void {
        // Guard against duplicate wiring on retries
        if (this._eventsWired) {
            return;
        }
        const cleanups: Array<() => void> = [];
        try {
            this._wireSchedulerEvents(cleanups);
            this._wirePlayerEvents(cleanups);
            this._wirePlexEvents(cleanups);
            this._wireNavigationEvents(cleanups);
            this._wireEpgEvents(cleanups);
            this._wireChannelManagerEvents(cleanups);
            this._wireLifecycleEvents(cleanups);
            this._eventUnsubscribers.push(...cleanups);
            this._eventsWired = true;
        } catch (error) {
            const cleanupFailures: Array<{ step: string; error: unknown }> = [];
            for (const cleanup of cleanups) {
                try {
                    cleanup();
                } catch (cleanupError) {
                    cleanupFailures.push({
                        step: 'event-wiring.cleanup',
                        error: summarizeErrorForLog(cleanupError),
                    });
                }
            }
            if (cleanupFailures.length > 0) {
                console.warn('[Orchestrator] Event wiring rollback failures:', cleanupFailures);
            }
            throw error;
        }
    }

    private _handlePlayerEnded(): void {
        // Stream reload/recovery can trigger spurious 'ended' events on webOS (especially when tearing down src).
        // Never advance the schedule during an intentional reload.
        if (this._playbackRecovery?.isStreamRecoveryInProgress()) {
            return;
        }
        this._stopActiveTranscodeSession();
        this._scheduler?.skipToNext();
    }

    private _handlePlayerTrackChange(event: { type: 'audio' | 'subtitle'; trackId: string | null }): void {
        this._playbackOptionsCoordinator?.refreshIfOpen();

        if (event.type === 'audio') {
            if (event.trackId && this._currentStreamDescriptor?.protocol === 'direct') {
                const warnAudioReloadFailed = (): void => {
                    if (!this._nowPlayingHandler) return;
                    this._nowPlayingHandler({ message: 'Failed to apply audio track change', type: 'warning' });
                };
                const reloadPromise =
                    this._playbackRecovery?.attemptAudioTrackReloadForCurrentProgram(
                        event.trackId,
                        'audio_track_change'
                    ) ?? null;
                if (reloadPromise) {
                    void reloadPromise.then((ok) => {
                        if (!ok) {
                            warnAudioReloadFailed();
                        }
                    })
                    .catch(() => warnAudioReloadFailed());
                }
            }
            return;
        }

        if (!this._videoPlayer) {
            return;
        }

        if (!event.trackId) {
            const decision = this._currentStreamDecision ?? null;
            if (decision?.transcodeRequest?.subtitleMode === 'burn') {
                const warnDisableFailed = (): void => {
                    if (!this._nowPlayingHandler) return;
                    this._nowPlayingHandler({ message: 'Failed to disable burn-in subtitles', type: 'warning' });
                };
                void this._playbackRecovery?.attemptDisableBurnInSubtitlesForCurrentProgram('subtitle_track_off')
                    .then((result) => {
                        if (result.outcome !== 'failed') return;
                        warnDisableFailed();
                    })
                    .catch(() => warnDisableFailed());
            }
            return;
        }

        const selected = this._videoPlayer.getAvailableSubtitles()
            .find((track) => track.id === event.trackId) ?? null;
        if (!selected) {
            return;
        }

        const format = (selected.format || selected.codec || '').toLowerCase();
        const isBurnIn = BURN_IN_SUBTITLE_FORMATS.includes(format);
        if (!isBurnIn) {
            return;
        }

        // Only check burn-in settings for tracks that actually require burn-in.
        const allowBurnIn = readStoredBoolean(LINEUP_STORAGE_KEYS.SUBTITLE_ALLOW_BURN_IN, true);
        if (!allowBurnIn) {
            if (this._nowPlayingHandler) {
                this._nowPlayingHandler({ message: 'Burn-in subtitles are disabled in Settings', type: 'warning' });
            }
            void this.setSubtitleTrack(null);
            return;
        }

        void this._playbackRecovery?.attemptBurnInSubtitleForCurrentProgram(
            event.trackId,
            'subtitle_track_change'
        );
    }

    private _handlePlaybackError(error: PlaybackError): void {
        if (error.recoverable) {
            const mappedCode = mapPlayerErrorCodeToAppErrorCode(error.code);
            this.handleGlobalError(
                {
                    code: mappedCode,
                    message: error.message,
                    recoverable: true,
                },
                'video-player'
            );
            return;
        }

        this._playbackRecovery?.handlePlaybackFailure('video-player', error);
    }

    private _handlePlayerStateChange(state: PlaybackState): void {
        this._playerOsdCoordinator?.onPlayerStateChange(state);
        this._channelTransitionCoordinator?.onPlayerStateChange(state);
        if (state.status === 'playing' && this._shouldAutoShowInfoBannerOnNextPlay) {
            this._shouldAutoShowInfoBannerOnNextPlay = false;
            this._playerOsdCoordinator?.showInfoBanner();
        }
    }

    private _handlePlayerTimeUpdate(payload: { currentTimeMs: number; durationMs: number }): void {
        this._playerOsdCoordinator?.onTimeUpdate(payload);
    }

    private _handlePlayerBufferUpdate(payload: { percent: number; bufferedRanges: TimeRange[] }): void {
        this._playerOsdCoordinator?.onBufferUpdate(payload);
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

    private _handleScreenChange(payload: { from: string; to: string }): void {
        this._channelTransitionCoordinator?.onScreenChange(payload.to as Screen);
    }

    private async _handleLifecyclePause(): Promise<void> {
        if (this._videoPlayer) {
            this._videoPlayer.pause();
        }
        if (this._scheduler) {
            this._scheduler.pauseSyncTimer();
        }
        if (this._lifecycle) {
            await this._lifecycle.saveState();
        }
    }

    private async _handleLifecycleResume(): Promise<void> {
        const lastProgramStartBefore = this._lastProgramStartPromise;
        if (this._scheduler) {
            this._scheduler.resumeSyncTimer();
            this._scheduler.syncToCurrentTime();
        }
        const lastProgramStartAfter = this._lastProgramStartPromise;
        if (
            lastProgramStartAfter &&
            lastProgramStartAfter !== lastProgramStartBefore
        ) {
            await lastProgramStartAfter;
            return;
        }
        if (this._videoPlayer) {
            await this._videoPlayer.play();
        }
    }

    // ========================================
    // ========================================

    /**
     * Handle program start event from scheduler.
     */
    private async _handleProgramStart(program: ScheduledProgram): Promise<void> {
        const sequence = ++this._programStartSequence;
        const isStale = (): boolean => sequence !== this._programStartSequence;
        if (!this._videoPlayer) {
            return;
        }

        this._currentProgramForPlayback = program;
        const programAtStart = program;
        const shouldAutoShowInfoBanner = this._pendingNowPlayingChannelId !== null;
        if (shouldAutoShowInfoBanner) {
            this._shouldAutoShowInfoBannerOnNextPlay = true;
            this._pendingNowPlayingChannelId = null;
        }
        try {
            this._nowPlayingInfoCoordinator?.onProgramStart(program);
            this._syncChannelBadgeOverlay();
            this._epgCoordinator?.refreshEpgScheduleForLiveChannel();
            const stream = await this._playbackRecovery?.resolveStreamForProgram(programAtStart);
            if (isStale() || this._currentProgramForPlayback !== programAtStart) {
                if (shouldAutoShowInfoBanner) {
                    this._shouldAutoShowInfoBannerOnNextPlay = false;
                }
                return;
            }
            if (!stream) {
                if (shouldAutoShowInfoBanner) {
                    this._shouldAutoShowInfoBannerOnNextPlay = false;
                }
                return;
            }
            this._currentStreamDescriptor = stream;

            // Optional developer aid: show a compact "stream decision" HUD when tuning a channel,
            // and fetch PMS transcode decision in the background to explain why video/audio transcodes.
            this._nowPlayingDebugManager?.maybeAutoShowNowPlayingStreamDebugHud();
            void this._nowPlayingDebugManager?.maybeFetchNowPlayingStreamDecisionForDebugHud();

            await this._videoPlayer.loadStream(stream);
            if (isStale() || this._currentProgramForPlayback !== programAtStart) {
                if (shouldAutoShowInfoBanner) {
                    this._shouldAutoShowInfoBannerOnNextPlay = false;
                }
                return;
            }
            await this._videoPlayer.play();
            this._playbackRecovery?.resetPlaybackFailureGuard();
        } catch (error) {
            if (this._playbackRecovery?.tryHandleStreamResolverAuthError(error)) {
                if (shouldAutoShowInfoBanner) {
                    this._shouldAutoShowInfoBannerOnNextPlay = false;
                }
                return;
            }
            if (this._playbackRecovery?.tryHandleStreamResolverPermissionError(error)) {
                if (shouldAutoShowInfoBanner) {
                    this._shouldAutoShowInfoBannerOnNextPlay = false;
                }
                return;
            }
            console.error('Failed to load stream:', summarizeErrorForLog(error));
            this._playbackRecovery?.handlePlaybackFailure('programStart', error);
            if (shouldAutoShowInfoBanner) {
                this._shouldAutoShowInfoBannerOnNextPlay = false;
            }
        }
    }

    private _syncChannelBadgeOverlay(): void {
        if (!this._channelBadgeOverlay) {
            return;
        }

        const osdVisible = this._playerOsd?.isVisible() ?? false;
        const npiVisible = this._nowPlayingInfo?.isVisible() ?? false;

        if (!osdVisible && !npiVisible) {
            this._channelBadgeOverlay.hide();
            return;
        }

        const channel = this._channelManager?.getCurrentChannel() ?? null;
        if (!channel) {
            this._channelBadgeOverlay.hide();
            return;
        }

        this._channelBadgeOverlay.show({
            channelNumber: channel.number,
            channelName: channel.name,
        });
    }

    private _handleOverlayVisibilityChange(visible: boolean): void {
        // Intentionally ignore the overlay-specific visibility value: channel badge visibility is derived
        // from combined OSD + NowPlayingInfo overlay states.
        void visible;
        this._syncChannelBadgeOverlay();
    }

    private _handleProgramStartTracked(program: ScheduledProgram): Promise<void> {
        const promise = this._handleProgramStart(program);
        this._lastProgramStartPromise = promise;
        return promise;
    }

    private _stopActiveTranscodeSession(): void {
        const decision = this._currentStreamDecision;
        if (!decision || !decision.isTranscoding || !decision.sessionId) {
            return;
        }
        void this._plexStreamResolver?.stopTranscodeSession(decision.sessionId);
    }

    private _stopPlayback(): void {
        this._stopActiveTranscodeSession();
        this._videoPlayer?.stop();
    }

    private _prepareForProfileSwitch(): void {
        if (this._pendingDayRolloverTimer !== null) {
            globalThis.clearTimeout(this._pendingDayRolloverTimer);
            this._pendingDayRolloverTimer = null;
        }
        this._pendingDayRolloverDayKey = null;
        this._stopPlayback();
        this._scheduler?.unloadChannel();
        this._pendingNowPlayingChannelId = null;
        this._shouldAutoShowInfoBannerOnNextPlay = false;
        this._currentProgramForPlayback = null;
        this._currentStreamDescriptor = null;
        this._currentStreamDecision = null;
    }

    private _toggleNowPlayingInfoOverlay(): void {
        if (!this._navigation || !this._nowPlayingInfo) {
            return;
        }
        const currentScreen = this._navigation.getCurrentScreen();
        if (currentScreen !== 'player') {
            return;
        }
        if (!this._currentProgramForPlayback) {
            return;
        }

        if (this._navigation.isModalOpen(NOW_PLAYING_INFO_MODAL_ID)) {
            this._navigation.closeModal(NOW_PLAYING_INFO_MODAL_ID);
            return;
        }
        if (this._navigation.isModalOpen()) {
            return;
        }

        this._navigation.openModal(NOW_PLAYING_INFO_MODAL_ID);
    }

    private _buildPlexResourceUrl(pathOrUrl: string): string | null {
        try {
            // If already absolute http(s), return as-is.
            if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
                return pathOrUrl;
            }

            const baseUri = this._plexDiscovery?.getServerUri() ?? null;
            if (!baseUri) {
                return null;
            }

            const url = new URL(pathOrUrl, baseUri);
            const headers = this._plexAuth?.getAuthHeaders() ?? {};
            const token = headers['X-Plex-Token'];
            if (typeof token === 'string' && token.length > 0) {
                // Note: We include the token as a query param because some webOS media/image fetch paths
                // cannot reliably attach headers. This carries leak risk (logs/referrers/caches), so avoid
                // logging these URLs and only use them where required.
                url.searchParams.set('X-Plex-Token', token);
            }
            return url.toString();
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
