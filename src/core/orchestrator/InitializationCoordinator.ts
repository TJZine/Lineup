/**
 * @fileoverview Initialization Coordinator - Manages the 5-phase startup sequence.
 * @module core/orchestrator/InitializationCoordinator
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

import { AppErrorCode, type IAppLifecycle, type AppError } from '../../modules/lifecycle';
import type { INavigationManager } from '../../modules/navigation';
import { type IPlexAuth, isPlexAuthRecoverable } from '../../modules/plex/auth';
import type { IPlexServerDiscovery } from '../../modules/plex/discovery';
import type { IPlexLibrary } from '../../modules/plex/library';
import type { IPlexStreamResolver } from '../../modules/plex/stream';
import type { IChannelManager } from '../../modules/scheduler/channel-manager';
import type { IChannelScheduler } from '../../modules/scheduler/scheduler';
import type { IVideoPlayer } from '../../modules/player';
import type { IEPGComponent, IEPGReadinessPort, IEPGDebugRuntime } from '../../modules/ui/epg';
import { buildEPGStartupConfig } from '../../modules/ui/epg';
import type { IPlayerOsdOverlay } from '../../modules/ui/player-osd';
import type { IMiniGuideOverlay } from '../../modules/ui/mini-guide';
import type { IChannelTransitionOverlay } from '../../modules/ui/channel-transition';
import type { IDisposable } from '../../utils/interfaces';
import type { OrchestratorConfig, ModuleStatus } from './OrchestratorTypes';
import type {
    ChannelBadgeOverlayInitPort,
    ChannelNumberOverlayInitPort,
} from './OverlayPorts';
import { EpgPreferencesStore, type EpgLayoutMode } from '../../modules/settings/EpgPreferencesStore';
import { ProfileSessionStore } from '../../modules/settings/ProfileSessionStore';
import {
    applyPhase2AuthGatePolicy,
    applyPhase3ServerGatePolicy,
    applyPostReadyRoutingPolicy,
} from '../initialization/InitializationStartupPolicy';
import { toRecoverableModuleStatusError } from '../initialization/RecoverableModuleStatusError';
import type { RecoverableAsyncFailureReporter } from './OrchestratorRuntimeSeams';

// ============================================
// Types
// ============================================

/**
 * Dependencies injected by Orchestrator.
 * These are module references the coordinator needs.
 */
export interface InitializationDependencies {
    modules: {
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
    };
    readiness: {
        epg: IEPGReadinessPort | null;
    };
    overlays: {
        playerOsd: IPlayerOsdOverlay | null;
        channelNumberOverlay: ChannelNumberOverlayInitPort | null;
        channelBadgeOverlay: ChannelBadgeOverlayInitPort | null;
        miniGuide: IMiniGuideOverlay | null;
        channelTransition: IChannelTransitionOverlay | null;
    };
    startupUiInitializer: InitializationStartupUiPort;
    epgDebugRuntime: IEPGDebugRuntime | null;
    stores: {
        epgPreferencesStore: EpgPreferencesStore;
        profileSessionStore: ProfileSessionStore;
    };
}

export interface InitializationStartupUiPort {
    ensureCorePlayerUiInitialized(): Promise<void>;
}

/**
 * Callbacks the coordinator invokes on the Orchestrator.
 * These maintain separation of concerns while allowing state updates.
 */
export interface InitializationCallbacks {
    status: {
        updateModuleStatus: (
            id: string,
            status: ModuleStatus['status'],
            error?: AppError,
            loadTimeMs?: number
        ) => void;
        getModuleStatus: (id: string) => ModuleStatus['status'] | undefined;
    };
    errors: {
        handleGlobalError: (error: AppError, context: string) => void;
    };
    diagnostics: {
        reportRecoverableAsyncFailure: RecoverableAsyncFailureReporter;
    };
    state: {
        setReady: (ready: boolean) => void;
        setupEventWiring: () => void;
    };
    serverStorage: {
        configureDiscoveryStorage: () => void;
        configureChannelManagerStorage: () => Promise<void>;
        getSelectedServerId: () => string | null;
    };
    routing: {
        shouldRunAudioSetup: () => boolean;
        shouldRunChannelSetup: () => boolean;
        switchToChannel: (id: string) => Promise<void>;
        openServerSelect: () => void;
    };
    resources: {
        buildPlexResourceUrl: (pathOrUrl: string | null) => string | null;
    };
    subtitle: {
        seedSubtitleLanguageFromPlexUser?: () => void;
    };
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
export class InitializationCoordinator {
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
        this._cancelEpgWarmup();
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
        let shouldRunFinalReadyWork = false;

        try {
            while (true) {
                const willRunPhase4 = phaseToRun <= 4;
                const shouldEagerlyInitEpgForPass = phaseToRun > 1;
                this._callbacks.state.setReady(false);

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

                if (shouldEagerlyInitEpgForPass) {
                    await this._initPhase5({
                        ensureCorePlayerUi: !willRunPhase4,
                    });
                }

                if (this._startupQueuedPhase === null) {
                    shouldScheduleEpgWarmup = !shouldEagerlyInitEpgForPass;
                    shouldRunFinalReadyWork = true;
                    break;
                }
                phaseToRun = this._startupQueuedPhase;
                this._startupQueuedPhase = null;
            }

            if (shouldRunFinalReadyWork) {
                this._callbacks.state.setupEventWiring();

                if (this._deps.modules.navigation) {
                    await applyPostReadyRoutingPolicy({
                        navigation: this._deps.modules.navigation,
                        channelManager: this._deps.modules.channelManager,
                        shouldRunAudioSetup: this._callbacks.routing.shouldRunAudioSetup,
                        shouldRunChannelSetup: this._callbacks.routing.shouldRunChannelSetup,
                        switchToChannel: this._callbacks.routing.switchToChannel,
                        openServerSelect: this._callbacks.routing.openServerSelect,
                    });
                }

                this._callbacks.state.setReady(true);
                if (this._deps.modules.lifecycle) {
                    this._deps.modules.lifecycle.setPhase('ready');
                }

                this.clearAuthResume();
                this.clearServerResume();
                this.clearProfileResume();
            }
        } catch (error: unknown) {
            caughtError = error;
            this._cancelEpgWarmup();
            const message = error instanceof Error ? error.message : String(error);
            // Avoid leaving stale resume listeners after a fatal startup error.
            this.clearAuthResume();
            this.clearServerResume();
            this.clearProfileResume();
            this._callbacks.errors.handleGlobalError(
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

    prepareForProfileSwitchAttempt(): void {
        this.clearServerResume();
        this.clearProfileResume();
    }

    restorePendingServerResumeAfterProfileSwitchFailure(): void {
        const discoveryStatus = this._callbacks.status.getModuleStatus('plex-server-discovery');
        const libraryStatus = this._callbacks.status.getModuleStatus('plex-library');
        const streamResolverStatus = this._callbacks.status.getModuleStatus('plex-stream-resolver');
        if (
            discoveryStatus !== 'pending'
            && libraryStatus !== 'pending'
            && streamResolverStatus !== 'pending'
        ) {
            return;
        }

        this._registerServerResume();
    }

    async resumeStartupAfterProfileSwitch(): Promise<void> {
        this.clearServerResume();
        this.clearProfileResume();
        this._callbacks.serverStorage.configureDiscoveryStorage();
        await this.runStartup(3);
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
        this._callbacks.status.updateModuleStatus('event-emitter', 'ready', undefined, 0);

        // Initialize Lifecycle and Navigation in parallel
        const promises: Promise<void>[] = [];

        if (this._deps.modules.lifecycle) {
            this._callbacks.status.updateModuleStatus('app-lifecycle', 'initializing');
            promises.push(
                this._deps.modules.lifecycle.initialize().then(() => {
                    this._callbacks.status.updateModuleStatus(
                        'app-lifecycle',
                        'ready',
                        undefined,
                        Date.now() - startTime
                    );
                })
            );
        }

        if (this._deps.modules.navigation && this._config) {
            this._callbacks.status.updateModuleStatus('navigation', 'initializing');
            this._deps.modules.navigation.initialize(this._config.navConfig);
            this._callbacks.status.updateModuleStatus(
                'navigation',
                'ready',
                undefined,
                Date.now() - startTime
            );
        }

        await Promise.all(promises);
    }

    /**
     * Phase 2: Validate authentication
     */
    private async _initPhase2(): Promise<boolean> {
        const startTime = Date.now();
        this._callbacks.status.updateModuleStatus('plex-auth', 'initializing');

        if (!this._deps.modules.plexAuth || !this._deps.modules.navigation) {
            this._callbacks.status.updateModuleStatus(
                'plex-auth',
                'error',
                toRecoverableModuleStatusError(
                    new Error('Plex auth or navigation module unavailable during startup.'),
                    'Plex auth or navigation module unavailable during startup.'
                )
            );
            return false;
        }

        const phase2Inputs = {
            startTime,
            plexAuth: this._deps.modules.plexAuth,
            navigation: this._deps.modules.navigation,
            lifecycle: this._deps.modules.lifecycle,
            updateModuleStatus: this._callbacks.status.updateModuleStatus,
            configureDiscoveryStorage: this._callbacks.serverStorage.configureDiscoveryStorage,
            readShowProfilePickerOnStartup: (): boolean =>
                this._deps.stores.profileSessionStore.readShowProfilePickerOnStartupAndClean(false),
            handlers: {
                registerAuthResume: (): void => this._registerAuthResume(),
                registerProfileResume: (): void => this._registerProfileResume(),
            },
            ...(this._callbacks.subtitle.seedSubtitleLanguageFromPlexUser
                ? {
                    seedSubtitleLanguageFromPlexUser:
                        this._callbacks.subtitle.seedSubtitleLanguageFromPlexUser,
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
            !this._deps.modules.plexDiscovery ||
            !this._deps.modules.plexLibrary ||
            !this._deps.modules.plexStreamResolver ||
            !this._deps.modules.navigation
        ) {
            return false;
        }

        try {
            return await applyPhase3ServerGatePolicy({
                startTime,
                plexDiscovery: this._deps.modules.plexDiscovery,
                plexLibrary: this._deps.modules.plexLibrary,
                plexStreamResolver: this._deps.modules.plexStreamResolver,
                navigation: this._deps.modules.navigation,
                updateModuleStatus: this._callbacks.status.updateModuleStatus,
                handlers: {
                    registerServerResume: () => this._registerServerResume(),
                },
            });
        } catch (error) {
            if (!isPlexAuthRecoverable(error)) {
                throw error;
            }

            const moduleError = toRecoverableModuleStatusError(
                error,
                'Server discovery authentication failed during startup.'
            );
            this._callbacks.status.updateModuleStatus(
                'plex-server-discovery',
                'error',
                moduleError
            );
            this._registerAuthResume();
            this._deps.modules.navigation.goTo('auth');
            this._callbacks.errors.handleGlobalError(moduleError, 'plex-server-discovery');
            return false;
        }
    }

    /**
     * Phase 4: Initialize Channel Manager, Scheduler, and Video Player
     */
    private async _initPhase4(): Promise<void> {
        const startTime = Date.now();

        // Channel Manager
        if (this._deps.modules.channelManager) {
            this._callbacks.status.updateModuleStatus('channel-manager', 'initializing');
            await this._callbacks.serverStorage.configureChannelManagerStorage();
            await this._deps.modules.channelManager.loadChannels();

            this._callbacks.status.updateModuleStatus(
                'channel-manager',
                'ready',
                undefined,
                Date.now() - startTime
            );
        }

        // Channel Scheduler (no async init needed)
        if (this._deps.modules.scheduler) {
            this._callbacks.status.updateModuleStatus(
                'channel-scheduler',
                'ready',
                undefined,
                Date.now() - startTime
            );
        } else {
            this._callbacks.status.updateModuleStatus('channel-scheduler', 'disabled');
        }

        // Video Player
        if (this._deps.modules.videoPlayer && this._config) {
            this._callbacks.status.updateModuleStatus('video-player', 'initializing');
            await this._deps.modules.videoPlayer.initialize({
                ...this._config.playerConfig,
            });

            // Request Media Session integration (once per app lifetime)
            this._deps.modules.videoPlayer.requestMediaSession();

            this._callbacks.status.updateModuleStatus(
                'video-player',
                'ready',
                undefined,
                Date.now() - startTime
            );
        }

        if (this._deps.overlays.playerOsd && this._config) {
            this._callbacks.status.updateModuleStatus('player-osd-ui', 'initializing');
            this._deps.overlays.playerOsd.initialize(this._config.playerOsdConfig);
            this._callbacks.status.updateModuleStatus(
                'player-osd-ui',
                'ready',
                undefined,
                Date.now() - startTime
            );
        }

        if (this._deps.overlays.channelNumberOverlay && this._config) {
            this._callbacks.status.updateModuleStatus('channel-number-overlay-ui', 'initializing');
            this._deps.overlays.channelNumberOverlay.initialize(this._config.channelNumberOverlayConfig.containerId);
            this._callbacks.status.updateModuleStatus(
                'channel-number-overlay-ui',
                'ready',
                undefined,
                Date.now() - startTime
            );
        }

        if (this._deps.overlays.channelBadgeOverlay && this._config) {
            this._callbacks.status.updateModuleStatus('channel-badge-ui', 'initializing');
            this._deps.overlays.channelBadgeOverlay.initialize(this._config.channelBadgeConfig);
            this._callbacks.status.updateModuleStatus(
                'channel-badge-ui',
                'ready',
                undefined,
                Date.now() - startTime
            );
        }

        if (this._deps.overlays.miniGuide && this._config) {
            this._callbacks.status.updateModuleStatus('mini-guide-ui', 'initializing');
            this._deps.overlays.miniGuide.initialize(this._config.miniGuideConfig);
            this._callbacks.status.updateModuleStatus(
                'mini-guide-ui',
                'ready',
                undefined,
                Date.now() - startTime
            );
        }

        if (this._deps.overlays.channelTransition && this._config) {
            this._callbacks.status.updateModuleStatus('channel-transition-ui', 'initializing');
            this._deps.overlays.channelTransition.initialize(this._config.channelTransitionConfig);
            this._callbacks.status.updateModuleStatus(
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
    private async _initPhase5(options?: { ensureCorePlayerUi?: boolean }): Promise<void> {
        const ensureCorePlayerUi = options?.ensureCorePlayerUi ?? true;
        if (this._callbacks.status.getModuleStatus('epg-ui') === 'ready') {
            if (ensureCorePlayerUi) {
                await this._ensureCorePlayerUiInitialized();
            }
            return;
        }
        if (this._epgInitPromise) {
            await this._epgInitPromise;
            if (ensureCorePlayerUi) {
                await this._ensureCorePlayerUiInitialized();
            }
            return;
        }
        if (!this._deps.modules.epg || !this._config) {
            if (ensureCorePlayerUi) {
                await this._ensureCorePlayerUiInitialized();
            }
            return;
        }

        const startTime = Date.now();
        this._callbacks.status.updateModuleStatus('epg-ui', 'initializing');
        const init = async (): Promise<void> => {
            const epgConfigWithResolver = buildEPGStartupConfig({
                epgConfig: this._config.epgConfig,
                plexLibrary: this._deps.modules.plexLibrary,
                videoPlayer: this._deps.modules.videoPlayer,
                channelManager: this._deps.modules.channelManager,
                scheduler: this._deps.modules.scheduler,
                buildPlexResourceUrl: this._callbacks.resources.buildPlexResourceUrl,
                readEpgLayoutMode: (): EpgLayoutMode =>
                    this._deps.stores.epgPreferencesStore.readLayoutModeAndClean('classic'),
                readShowNowWatchingBanner: (): boolean =>
                    this._deps.stores.epgPreferencesStore.readNowWatchingEnabledAndClean(true),
                debugRuntime: this._deps.epgDebugRuntime,
            });
            const epg = this._deps.modules.epg;
            if (!epg) {
                return;
            }
            epg.initialize(epgConfigWithResolver);
            await this._deps.readiness.epg?.ensureReady();
            this._callbacks.status.updateModuleStatus(
                'epg-ui',
                'ready',
                undefined,
                Date.now() - startTime
            );
        };
        this._epgInitPromise = init()
            .catch((e) => {
                this._callbacks.status.updateModuleStatus(
                    'epg-ui',
                    'error',
                    toRecoverableModuleStatusError(e, 'EPG initialization failed.')
                );
                throw e;
            })
            .finally(() => {
                this._epgInitPromise = null;
            });

        await this._epgInitPromise;
        if (ensureCorePlayerUi) {
            await this._ensureCorePlayerUiInitialized();
        }
    }

    private async _ensureCorePlayerUiInitialized(): Promise<void> {
        await this._deps.startupUiInitializer.ensureCorePlayerUiInitialized();
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
        if (!this._deps.modules.plexAuth) {
            return;
        }

        this.clearAuthResume();
        const disposable = this._deps.modules.plexAuth.on('authChange', (isAuthenticated) => {
            if (!isAuthenticated) {
                return;
            }
            this.clearAuthResume();
            this._resumeStartupPhase(2);
        });
        this._authResumeDisposable = disposable;
    }

    /**
     * Register listener for server connection changes to resume startup.
     */
    private _registerServerResume(): void {
        if (!this._deps.modules.plexDiscovery) {
            return;
        }

        this.clearServerResume();
        const disposable = this._deps.modules.plexDiscovery.on('connectionChange', (uri) => {
            if (!uri) {
                return;
            }
            this.clearServerResume();
            this._resumeStartupPhase(3);
        });
        this._serverResumeDisposable = disposable;
    }

    /**
     * Register listener for profile change events to resume startup.
     */
    private _registerProfileResume(): void {
        if (!this._deps.modules.plexAuth) {
            return;
        }

        this.clearProfileResume();
        const disposable = this._deps.modules.plexAuth.on('profileChange', () => {
            void this.resumeStartupAfterProfileSwitch().catch((error: unknown) => {
                this._reportResumeFailure(3, error);
            });
        });
        this._profileResumeDisposable = disposable;
    }

    private _resumeStartupPhase(phase: 2 | 3): void {
        void this.runStartup(phase).catch((error: unknown) => {
            this._reportResumeFailure(phase, error);
        });
    }

    private _reportResumeFailure(phase: 2 | 3, error: unknown): void {
        // runStartup() already reports fatal startup failures via handleGlobalError('start').
        // Consume the rejection here only to avoid an unhandled Promise rejection on resume.
        try {
            this._callbacks.diagnostics.reportRecoverableAsyncFailure(
                `initialization.resume.phase${phase}`,
                `Background startup resume failed for phase ${phase}`,
                error
            );
        } catch {
            // Resume rejection is already consumed above; diagnostics must stay best-effort.
        }
    }
}
