/**
 * @fileoverview Initialization Coordinator - Manages the 5-phase startup sequence.
 * @module core/InitializationCoordinator
 * @version 1.0.0
 *
 * Extracted from Orchestrator to reduce complexity and improve modularity.
 * Handles:
 * - Phase 1: Core infrastructure (Lifecycle, Navigation)
 * - Phase 2: Auth validation
 * - Phase 3: Plex server connection
 * - Phase 4: Channel Manager, Scheduler, Video Player
 * - Phase 5: EPG initialization
 */

import { AppErrorCode, type IAppLifecycle, type AppError } from '../modules/lifecycle';
import type { INavigationManager } from '../modules/navigation';
import type { IPlexAuth } from '../modules/plex/auth';
import type { IPlexServerDiscovery } from '../modules/plex/discovery';
import type { IPlexLibrary } from '../modules/plex/library';
import type { IPlexStreamResolver } from '../modules/plex/stream';
import type { IChannelManager } from '../modules/scheduler/channel-manager';
import type { IChannelScheduler } from '../modules/scheduler/scheduler';
import type { IVideoPlayer } from '../modules/player';
import type { IEPGComponent } from '../modules/ui/epg';
import type { INowPlayingInfoOverlay } from '../modules/ui/now-playing-info';
import type { IPlayerOsdOverlay } from '../modules/ui/player-osd';
import type { IChannelNumberOverlay } from '../modules/ui/channel-number-overlay';
import type { IChannelBadgeOverlay } from '../modules/ui/channel-badge';
import type { IMiniGuideOverlay } from '../modules/ui/mini-guide';
import type { IChannelTransitionOverlay } from '../modules/ui/channel-transition';
import type { IPlaybackOptionsModal } from '../modules/ui/playback-options';
import { ExitConfirmModal, EXIT_CONFIRM_CONTAINER_ID } from '../modules/ui/exit-confirm';
import type { IDisposable } from '../utils/interfaces';
import type { OrchestratorConfig, ModuleStatus } from './orchestrator/OrchestratorTypes';
import { EpgPreferencesStore, type EpgLayoutMode } from '../modules/settings/EpgPreferencesStore';
import { ProfileSessionStore } from '../modules/settings/ProfileSessionStore';
import { summarizeErrorForLog } from '../utils/errors';
import {
    applyPhase2AuthGatePolicy,
    applyPhase3ServerGatePolicy,
    applyPostReadyRoutingPolicy,
    buildEpgConfigWithStartupPolicy,
} from './initialization/InitializationStartupPolicy';

// ============================================
// Types
// ============================================

/**
 * Dependencies injected by Orchestrator.
 * These are module references the coordinator needs.
 */
export interface InitializationDependencies {
    lifecycle: IAppLifecycle | null;
    navigation: INavigationManager | null;
    plexAuth: IPlexAuth | null;
    plexDiscovery: IPlexServerDiscovery | null;
    plexLibrary: IPlexLibrary | null;
    plexStreamResolver: IPlexStreamResolver | null;
    channelManager: IChannelManager | null;
    scheduler: IChannelScheduler | null;
    videoPlayer: IVideoPlayer | null;
    epg: IEPGComponent | null;
    nowPlayingInfo: INowPlayingInfoOverlay | null;
    playerOsd: IPlayerOsdOverlay | null;
    channelNumberOverlay: IChannelNumberOverlay | null;
    channelBadgeOverlay: IChannelBadgeOverlay | null;
    miniGuide: IMiniGuideOverlay | null;
    channelTransition: IChannelTransitionOverlay | null;
    playbackOptions: IPlaybackOptionsModal | null;
    exitConfirm: ExitConfirmModal | null;
    epgPreferencesStore: EpgPreferencesStore;
    profileSessionStore: ProfileSessionStore;
}

/**
 * Callbacks the coordinator invokes on the Orchestrator.
 * These maintain separation of concerns while allowing state updates.
 */
export interface InitializationCallbacks {
    // Module status tracking
    updateModuleStatus: (
        id: string,
        status: ModuleStatus['status'],
        error?: AppError,
        loadTimeMs?: number
    ) => void;

    // Module status check (for EPG idempotency guard)
    getModuleStatus: (id: string) => ModuleStatus['status'] | undefined;

    // Error handling
    handleGlobalError: (error: AppError, context: string) => void;

    // State management
    setReady: (ready: boolean) => void;

    // Event wiring (called after phases complete)
    setupEventWiring: () => void;

    // Server/storage operations (kept in Orchestrator)
    configureDiscoveryStorage: () => void;
    configureChannelManagerStorage: () => Promise<void>;
    getSelectedServerId: () => string | null;
    shouldRunAudioSetup: () => boolean;
    shouldRunChannelSetup: () => boolean;
    switchToChannel: (id: string) => Promise<void>;
    openServerSelect: () => void;

    // EPG thumb resolver (Orchestrator owns _buildPlexResourceUrl for security)
    buildPlexResourceUrl: (pathOrUrl: string | null) => string | null;

    // Optional: seed subtitle language from Plex profile when unset
    seedSubtitleLanguageFromPlexUser?: () => void;
}

/**
 * Public interface for the InitializationCoordinator.
 */
export interface IInitializationCoordinator {
    /**
     * Run the startup sequence starting from the specified phase.
     * Phases 1-5 execute in order; earlier phases are skipped if startPhase > 1.
     */
    runStartup(startPhase: 1 | 2 | 3 | 4 | 5): Promise<void>;

    /**
     * Check if a startup sequence is currently in progress.
     */
    isStartupInProgress(): boolean;

    /**
     * Ensure EPG is initialized (for lazy initialization outside startup flow).
     */
    ensureEPGInitialized(): Promise<void>;

    /**
     * Clear auth resume listener (cleanup).
     */
    clearAuthResume(): void;

    /**
     * Clear server resume listener (cleanup).
     */
    clearServerResume(): void;

    /**
     * Clear profile resume listener (cleanup).
     */
    clearProfileResume(): void;
}

// ============================================
// Implementation
// ============================================

/**
 * InitializationCoordinator - Manages the 5-phase startup sequence.
 *
 * Extracted from Orchestrator to reduce its size and improve modularity.
 * The coordinator is instantiated by Orchestrator with injected dependencies
 * and callbacks, allowing bidirectional communication without tight coupling.
 */
export class InitializationCoordinator implements IInitializationCoordinator {
    private static readonly EPG_WARMUP_DELAY_MS = 1500;

    // Startup state
    private _startupInProgress = false;
    private _startupQueuedPhase: 1 | 2 | 3 | 4 | 5 | null = null;
    private _startupQueuedWaiters: Array<{ resolve: () => void; reject: (err: unknown) => void }> = [];

    // Resume listeners
    private _authResumeDisposable: IDisposable | null = null;
    private _serverResumeDisposable: IDisposable | null = null;
    private _profileResumeDisposable: IDisposable | null = null;

    // EPG init promise (prevents duplicate initialization)
    private _epgInitPromise: Promise<void> | null = null;
    private _nowPlayingInfoInitPromise: Promise<void> | null = null;
    private _playbackOptionsInitPromise: Promise<void> | null = null;
    private _exitConfirmInitPromise: Promise<void> | null = null;
    private _epgWarmupTimerId: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private readonly _config: OrchestratorConfig,
        private readonly _deps: InitializationDependencies,
        private readonly _callbacks: InitializationCallbacks
    ) { }

    // ============================================
    // Public Methods
    // ============================================

    async runStartup(startPhase: 1 | 2 | 3 | 4 | 5): Promise<void> {
        if (this._startupInProgress) {
            this._startupQueuedPhase = this._startupQueuedPhase === null
                ? startPhase
                : (Math.min(this._startupQueuedPhase, startPhase) as 1 | 2 | 3 | 4 | 5);
            return new Promise((resolve, reject) => {
                this._startupQueuedWaiters.push({ resolve, reject });
            });
        }

        this._startupInProgress = true;
        let phaseToRun: 1 | 2 | 3 | 4 | 5 = startPhase;
        let caughtError: unknown = null;
        let shouldScheduleEpgWarmup = false;

        try {
            while (true) {
                this._callbacks.setReady(false);

                // Force phase to initializing to ensure 'ready' event is emitted at the end
                if (this._deps.lifecycle) {
                    this._deps.lifecycle.setPhase('initializing');
                }

                if (phaseToRun <= 1) {
                    await this._initPhase1();
                }

                if (phaseToRun <= 2) {
                    const authValid = await this._initPhase2();
                    if (!authValid) {
                        if (this._startupQueuedPhase === null) {
                            break;
                        }
                        phaseToRun = this._startupQueuedPhase;
                        this._startupQueuedPhase = null;
                        continue;
                    }
                }

                if (phaseToRun <= 3) {
                    const plexConnected = await this._initPhase3();
                    if (!plexConnected) {
                        if (this._startupQueuedPhase === null) {
                            break;
                        }
                        phaseToRun = this._startupQueuedPhase;
                        this._startupQueuedPhase = null;
                        continue;
                    }
                }

                if (phaseToRun <= 4) {
                    await this._initPhase4();
                    await this._ensureCorePlayerUiInitialized();
                }

                this._callbacks.setupEventWiring();
                this._callbacks.setReady(true);
                if (this._deps.lifecycle) {
                    this._deps.lifecycle.setPhase('ready');
                }

                if (this._deps.navigation) {
                    await applyPostReadyRoutingPolicy({
                        navigation: this._deps.navigation,
                        channelManager: this._deps.channelManager,
                        shouldRunAudioSetup: this._callbacks.shouldRunAudioSetup,
                        shouldRunChannelSetup: this._callbacks.shouldRunChannelSetup,
                        switchToChannel: this._callbacks.switchToChannel,
                        openServerSelect: this._callbacks.openServerSelect,
                    });
                }

                this.clearAuthResume();
                this.clearServerResume();
                this.clearProfileResume();

                if (this._startupQueuedPhase === null) {
                    shouldScheduleEpgWarmup = true;
                    break;
                }
                phaseToRun = this._startupQueuedPhase;
                this._startupQueuedPhase = null;
            }
        } catch (error: unknown) {
            caughtError = error;
            this._cancelEpgWarmup();
            const message = error instanceof Error ? error.message : String(error);
            // Avoid leaving stale resume listeners after a fatal startup error.
            this.clearAuthResume();
            this.clearServerResume();
            this.clearProfileResume();
            this._callbacks.handleGlobalError(
                {
                    code: AppErrorCode.INITIALIZATION_FAILED,
                    message,
                    recoverable: true,
                },
                'start'
            );
        } finally {
            this._startupInProgress = false;
            this._startupQueuedPhase = null;
            const waiters = this._startupQueuedWaiters;
            this._startupQueuedWaiters = [];
            for (const waiter of waiters) {
                try {
                    if (caughtError) {
                        waiter.reject(caughtError);
                    } else {
                        waiter.resolve();
                    }
                } catch {
                    // Ignore waiter failures
                }
            }
        }

        if (shouldScheduleEpgWarmup) {
            this._scheduleEpgWarmup();
        }

        // Rethrow after cleanup so direct callers receive a rejected Promise
        if (caughtError) {
            throw caughtError;
        }
    }

    isStartupInProgress(): boolean {
        return this._startupInProgress;
    }

    async ensureEPGInitialized(): Promise<void> {
        await this._initPhase5();
    }

    clearAuthResume(): void {
        this._cancelEpgWarmup();
        if (this._authResumeDisposable) {
            this._authResumeDisposable.dispose();
            this._authResumeDisposable = null;
        }
    }

    clearServerResume(): void {
        this._cancelEpgWarmup();
        if (this._serverResumeDisposable) {
            this._serverResumeDisposable.dispose();
            this._serverResumeDisposable = null;
        }
    }

    clearProfileResume(): void {
        this._cancelEpgWarmup();
        if (this._profileResumeDisposable) {
            this._profileResumeDisposable.dispose();
            this._profileResumeDisposable = null;
        }
    }

    // ============================================
    // Private Methods - Initialization Phases
    // ============================================

    /**
     * Phase 1: Initialize core infrastructure (EventEmitter, AppLifecycle, Navigation)
     */
    private async _initPhase1(): Promise<void> {
        const startTime = Date.now();

        // EventEmitter is already ready (synchronous)
        this._callbacks.updateModuleStatus('event-emitter', 'ready', undefined, 0);

        // Initialize Lifecycle and Navigation in parallel
        const promises: Promise<void>[] = [];

        if (this._deps.lifecycle) {
            this._callbacks.updateModuleStatus('app-lifecycle', 'initializing');
            promises.push(
                this._deps.lifecycle.initialize().then(() => {
                    this._callbacks.updateModuleStatus(
                        'app-lifecycle',
                        'ready',
                        undefined,
                        Date.now() - startTime
                    );
                })
            );
        }

        if (this._deps.navigation && this._config) {
            this._callbacks.updateModuleStatus('navigation', 'initializing');
            this._deps.navigation.initialize(this._config.navConfig);
            this._callbacks.updateModuleStatus(
                'navigation',
                'ready',
                undefined,
                Date.now() - startTime
            );
        }

        await Promise.all(promises);

        if (this._deps.lifecycle) {
            this._deps.lifecycle.setPhase('authenticating');
        }
    }

    /**
     * Phase 2: Validate authentication
     */
    private async _initPhase2(): Promise<boolean> {
        const startTime = Date.now();
        this._callbacks.updateModuleStatus('plex-auth', 'initializing');

        if (!this._deps.plexAuth || !this._deps.navigation) {
            this._callbacks.updateModuleStatus('plex-auth', 'error');
            return false;
        }

        const phase2Inputs = {
            startTime,
            plexAuth: this._deps.plexAuth,
            navigation: this._deps.navigation,
            lifecycle: this._deps.lifecycle,
            updateModuleStatus: this._callbacks.updateModuleStatus,
            configureDiscoveryStorage: this._callbacks.configureDiscoveryStorage,
            readShowProfilePickerOnStartup: (): boolean =>
                this._deps.profileSessionStore.readShowProfilePickerOnStartup(false),
            handlers: {
                registerAuthResume: (): void => this._registerAuthResume(),
                registerProfileResume: (): void => this._registerProfileResume(),
            },
            ...(this._callbacks.seedSubtitleLanguageFromPlexUser
                ? {
                    seedSubtitleLanguageFromPlexUser:
                        this._callbacks.seedSubtitleLanguageFromPlexUser,
                }
                : {}),
        };

        return applyPhase2AuthGatePolicy(phase2Inputs);
    }

    /**
     * Phase 3: Connect to Plex server and initialize Plex services
     */
    private async _initPhase3(): Promise<boolean> {
        const startTime = Date.now();

        if (
            !this._deps.plexDiscovery ||
            !this._deps.plexLibrary ||
            !this._deps.plexStreamResolver ||
            !this._deps.navigation
        ) {
            return false;
        }

        return applyPhase3ServerGatePolicy({
            startTime,
            plexDiscovery: this._deps.plexDiscovery,
            plexLibrary: this._deps.plexLibrary,
            plexStreamResolver: this._deps.plexStreamResolver,
            navigation: this._deps.navigation,
            updateModuleStatus: this._callbacks.updateModuleStatus,
            handlers: {
                registerServerResume: () => this._registerServerResume(),
            },
        });
    }

    /**
     * Phase 4: Initialize Channel Manager, Scheduler, and Video Player
     */
    private async _initPhase4(): Promise<void> {
        const startTime = Date.now();

        // Channel Manager
        if (this._deps.channelManager) {
            this._callbacks.updateModuleStatus('channel-manager', 'initializing');
            await this._callbacks.configureChannelManagerStorage();
            await this._deps.channelManager.loadChannels();

            this._callbacks.updateModuleStatus(
                'channel-manager',
                'ready',
                undefined,
                Date.now() - startTime
            );
        }

        // Channel Scheduler (no async init needed)
        if (this._deps.scheduler) {
            this._callbacks.updateModuleStatus(
                'channel-scheduler',
                'ready',
                undefined,
                Date.now() - startTime
            );
        } else {
            this._callbacks.updateModuleStatus('channel-scheduler', 'disabled');
        }

        // Video Player
        if (this._deps.videoPlayer && this._config) {
            this._callbacks.updateModuleStatus('video-player', 'initializing');
            await this._deps.videoPlayer.initialize({
                ...this._config.playerConfig,
            });

            // Request Media Session integration (once per app lifetime)
            this._deps.videoPlayer.requestMediaSession();

            this._callbacks.updateModuleStatus(
                'video-player',
                'ready',
                undefined,
                Date.now() - startTime
            );
        }

        if (this._deps.playerOsd && this._config) {
            this._callbacks.updateModuleStatus('player-osd-ui', 'initializing');
            this._deps.playerOsd.initialize(this._config.playerOsdConfig);
            this._callbacks.updateModuleStatus(
                'player-osd-ui',
                'ready',
                undefined,
                Date.now() - startTime
            );
        }

        if (this._deps.channelNumberOverlay && this._config) {
            this._callbacks.updateModuleStatus('channel-number-overlay-ui', 'initializing');
            this._deps.channelNumberOverlay.initialize(this._config.channelNumberOverlayConfig.containerId);
            this._callbacks.updateModuleStatus(
                'channel-number-overlay-ui',
                'ready',
                undefined,
                Date.now() - startTime
            );
        }

        if (this._deps.channelBadgeOverlay && this._config) {
            this._callbacks.updateModuleStatus('channel-badge-ui', 'initializing');
            this._deps.channelBadgeOverlay.initialize(this._config.channelBadgeConfig);
            this._callbacks.updateModuleStatus(
                'channel-badge-ui',
                'ready',
                undefined,
                Date.now() - startTime
            );
        }

        if (this._deps.miniGuide && this._config) {
            this._callbacks.updateModuleStatus('mini-guide-ui', 'initializing');
            this._deps.miniGuide.initialize(this._config.miniGuideConfig);
            this._callbacks.updateModuleStatus(
                'mini-guide-ui',
                'ready',
                undefined,
                Date.now() - startTime
            );
        }

        if (this._deps.channelTransition && this._config) {
            this._callbacks.updateModuleStatus('channel-transition-ui', 'initializing');
            this._deps.channelTransition.initialize(this._config.channelTransitionConfig);
            this._callbacks.updateModuleStatus(
                'channel-transition-ui',
                'ready',
                undefined,
                Date.now() - startTime
            );
        }

    }

    /**
     * Phase 5: Initialize EPG
     */
    private async _initPhase5(): Promise<void> {
        if (this._callbacks.getModuleStatus('epg-ui') === 'ready') {
            await this._ensureCorePlayerUiInitialized();
            return;
        }
        if (this._epgInitPromise) {
            await this._epgInitPromise;
            await this._ensureCorePlayerUiInitialized();
            return;
        }
        if (!this._deps.epg || !this._config) {
            await this._ensureCorePlayerUiInitialized();
            return;
        }

        const startTime = Date.now();
        this._callbacks.updateModuleStatus('epg-ui', 'initializing');
        const init = async (): Promise<void> => {
            const epgConfigWithResolver = buildEpgConfigWithStartupPolicy({
                epgConfig: this._config.epgConfig,
                plexLibrary: this._deps.plexLibrary,
                videoPlayer: this._deps.videoPlayer,
                channelManager: this._deps.channelManager,
                scheduler: this._deps.scheduler,
                buildPlexResourceUrl: this._callbacks.buildPlexResourceUrl,
                readEpgLayoutMode: (): EpgLayoutMode =>
                    this._deps.epgPreferencesStore.readLayoutMode('classic'),
                readShowNowWatchingBanner: (): boolean =>
                    this._deps.epgPreferencesStore.readNowWatchingEnabled(true),
            });
            this._deps.epg!.initialize(epgConfigWithResolver);
            if (this._deps.epg!.ensureReady) {
                await this._deps.epg!.ensureReady();
            }
            this._callbacks.updateModuleStatus(
                'epg-ui',
                'ready',
                undefined,
                Date.now() - startTime
            );
        };
        this._epgInitPromise = init()
            .catch((e) => {
                this._callbacks.updateModuleStatus('epg-ui', 'error');
                throw e;
            })
            .finally(() => {
                this._epgInitPromise = null;
            });

        await this._epgInitPromise;
        await this._ensureCorePlayerUiInitialized();
    }

    private async _ensureCorePlayerUiInitialized(): Promise<void> {
        await this._initNowPlayingInfoUI();
        await this._initPlaybackOptionsUI();
        await this._initExitConfirmUI();
    }

    private async _initNowPlayingInfoUI(): Promise<void> {
        if (this._callbacks.getModuleStatus('now-playing-info-ui') === 'ready') {
            return;
        }
        if (this._nowPlayingInfoInitPromise) {
            await this._nowPlayingInfoInitPromise;
            return;
        }
        if (!this._deps.nowPlayingInfo || !this._config) {
            return;
        }

        const startTime = Date.now();
        this._callbacks.updateModuleStatus('now-playing-info-ui', 'initializing');
        const init = async (): Promise<void> => {
            this._deps.nowPlayingInfo!.initialize(this._config.nowPlayingInfoConfig);
            this._callbacks.updateModuleStatus(
                'now-playing-info-ui',
                'ready',
                undefined,
                Date.now() - startTime
            );
        };
        this._nowPlayingInfoInitPromise = init()
            .catch((e) => {
                this._callbacks.updateModuleStatus('now-playing-info-ui', 'error');
                throw e;
            })
            .finally(() => {
                this._nowPlayingInfoInitPromise = null;
            });

        await this._nowPlayingInfoInitPromise;
    }

    private async _initPlaybackOptionsUI(): Promise<void> {
        if (this._callbacks.getModuleStatus('playback-options-ui') === 'ready') {
            return;
        }
        if (this._playbackOptionsInitPromise) {
            await this._playbackOptionsInitPromise;
            return;
        }
        if (!this._deps.playbackOptions || !this._config) {
            return;
        }

        const startTime = Date.now();
        this._callbacks.updateModuleStatus('playback-options-ui', 'initializing');
        const init = async (): Promise<void> => {
            this._deps.playbackOptions!.initialize(this._config.playbackOptionsConfig);
            this._callbacks.updateModuleStatus(
                'playback-options-ui',
                'ready',
                undefined,
                Date.now() - startTime
            );
        };
        this._playbackOptionsInitPromise = init()
            .catch((e) => {
                this._callbacks.updateModuleStatus('playback-options-ui', 'error');
                throw e;
            })
            .finally(() => {
                this._playbackOptionsInitPromise = null;
            });

        await this._playbackOptionsInitPromise;
    }

    private async _initExitConfirmUI(): Promise<void> {
        if (this._callbacks.getModuleStatus('exit-confirm-ui') === 'ready') {
            return;
        }
        if (this._exitConfirmInitPromise) {
            await this._exitConfirmInitPromise;
            return;
        }
        if (!this._deps.exitConfirm) {
            return;
        }

        const startTime = Date.now();
        this._callbacks.updateModuleStatus('exit-confirm-ui', 'initializing');
        const init = async (): Promise<void> => {
            this._deps.exitConfirm!.initialize({ containerId: EXIT_CONFIRM_CONTAINER_ID });
            this._callbacks.updateModuleStatus(
                'exit-confirm-ui',
                'ready',
                undefined,
                Date.now() - startTime
            );
        };
        this._exitConfirmInitPromise = init()
            .catch((e) => {
                this._callbacks.updateModuleStatus('exit-confirm-ui', 'error');
                throw e;
            })
            .finally(() => {
                this._exitConfirmInitPromise = null;
            });

        await this._exitConfirmInitPromise;
    }

    private _cancelEpgWarmup(): void {
        if (this._epgWarmupTimerId !== null) {
            clearTimeout(this._epgWarmupTimerId);
            this._epgWarmupTimerId = null;
        }
    }

    private _scheduleEpgWarmup(): void {
        this._cancelEpgWarmup();
        this._epgWarmupTimerId = setTimeout(() => {
            this._epgWarmupTimerId = null;
            void this.ensureEPGInitialized().catch(() => {
                // Best-effort warmup only.
            });
        }, InitializationCoordinator.EPG_WARMUP_DELAY_MS);
    }

    // ============================================
    // Private Methods - Resume Handlers
    // ============================================

    /**
     * Register listener for auth state changes to resume startup.
     */
    private _registerAuthResume(): void {
        if (!this._deps.plexAuth) {
            return;
        }

        this.clearAuthResume();
        const disposable = this._deps.plexAuth.on('authChange', (isAuthenticated) => {
            if (!isAuthenticated) {
                return;
            }
            this.clearAuthResume();
            this.runStartup(2).catch((error) => {
                console.error('[InitializationCoordinator] Auth resume failed:', summarizeErrorForLog(error));
            });
        });
        this._authResumeDisposable = disposable;
    }

    /**
     * Register listener for server connection changes to resume startup.
     */
    private _registerServerResume(): void {
        if (!this._deps.plexDiscovery) {
            return;
        }

        this.clearServerResume();
        const disposable = this._deps.plexDiscovery.on('connectionChange', (uri) => {
            if (!uri) {
                return;
            }
            this.clearServerResume();
            this.runStartup(3).catch((error) => {
                console.error('[InitializationCoordinator] Server resume failed:', summarizeErrorForLog(error));
            });
        });
        this._serverResumeDisposable = disposable;
    }

    /**
     * Register listener for profile change events to resume startup.
     */
    private _registerProfileResume(): void {
        if (!this._deps.plexAuth) {
            return;
        }

        this.clearProfileResume();
        const disposable = this._deps.plexAuth.on('profileChange', () => {
            this.clearProfileResume();
            // Critical: ensure discovery storage keys are updated for the new activeUserId
            // before Phase 3 runs and restores server selection from localStorage.
            this._callbacks.configureDiscoveryStorage();
            this.runStartup(3).catch((error) => {
                console.error('[InitializationCoordinator] Profile resume failed:', summarizeErrorForLog(error));
            });
        });
        this._profileResumeDisposable = disposable;
    }
}
