import type { IAppLifecycle, AppError } from '../../modules/lifecycle';
import { AppErrorCode } from '../../types/app-errors';
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
import type { ChannelSwitchOutcome } from '../../types/channelSwitch';
import type { IPlayerOsdOverlay } from '../../modules/ui/player-osd';
import type { IMiniGuideOverlay } from '../../modules/ui/mini-guide';
import type { IChannelTransitionOverlay } from '../../modules/ui/channel-transition';
import type { IDisposable } from '../../utils/interfaces';
import type { OrchestratorConfig, ModuleStatus } from '../orchestrator/contracts/OrchestratorTypes';
import type {
    ChannelBadgeOverlayInitPort,
    ChannelNumberOverlayInitPort,
} from '../orchestrator/contracts/OverlayPorts';
import { EpgPreferencesStore, type EpgLayoutMode } from '../../modules/settings/EpgPreferencesStore';
import { ProfileSessionStore } from '../../modules/settings/ProfileSessionStore';
import {
    applyAuthValidationPolicy,
    applyServerConnectionPolicy,
    applyPostReadyRoutingPolicy,
} from './InitializationStartupPolicy';
import {
    isStartupAbortError,
    throwIfStartupAborted,
    type StartupSignalOptions,
} from './InitializationAbort';
import { InitializationStartupQueue } from './InitializationStartupQueue';
import { toRecoverableModuleStatusError } from './RecoverableModuleStatusError';
import type { RecoverableAsyncFailureReporter } from '../orchestrator/runtime/OrchestratorRuntimeSeams';

// Numeric order is significant: lower values are earlier pipeline stages.
// runStartup compares StartupPhase values and uses Math.min(_startupQueuedPhase, startPhase)
// to collapse queued requests, so do not reorder or renumber without updating that logic.
export const STARTUP_PHASE = {
    FULL_STARTUP: 1,
    RESUME_AFTER_AUTH_CHANGE: 2,
    RESUME_AFTER_SERVER_SELECTION: 3,
    RESUME_RUNTIME_MODULES: 4,
    RESUME_EPG_ONLY: 5,
} as const;

export type StartupPhase = typeof STARTUP_PHASE[keyof typeof STARTUP_PHASE];
type StartupResumePhase =
    | typeof STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE
    | typeof STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION;

const STARTUP_RESUME_FAILURES: Record<
    StartupResumePhase,
    { context: string; message: string }
> = {
    [STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE]: {
        context: 'initialization.resume.afterAuthChange',
        message: 'Background startup resume after auth change failed',
    },
    [STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION]: {
        context: 'initialization.resume.afterServerSelection',
        message: 'Background startup resume after server selection failed',
    },
};

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
        switchToChannel: (id: string) => Promise<ChannelSwitchOutcome>;
        openServerSelect: () => void;
    };
    resources: {
        buildPlexResourceUrl: (pathOrUrl: string | null) => string | null;
    };
}

/**
 * InitializationCoordinator - Manages the named startup sequence.
 *
 * Extracted from Orchestrator to reduce its size and improve modularity.
 * The coordinator is instantiated by Orchestrator with injected dependencies
 * and callbacks, allowing bidirectional communication without tight coupling.
 */
export class InitializationCoordinator {
    private static readonly EPG_WARMUP_DELAY_MS = 1500;

    private _startupInProgress = false;
    private readonly _startupQueue = new InitializationStartupQueue();

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

    async runStartup(startPhase: StartupPhase, options?: StartupSignalOptions): Promise<void> {
        let activeSignal = options?.signal;
        throwIfStartupAborted(activeSignal);
        this._cancelEpgWarmup();
        if (this._startupInProgress) {
            return this._startupQueue.queue(startPhase, activeSignal);
        }

        this._startupInProgress = true;
        let phaseToRun: StartupPhase = startPhase;
        let caughtError: unknown;
        let shouldScheduleEpgWarmup = false;
        let shouldEagerlyInitEpgForFinalReadyWork: boolean | null = null;

        try {
            while (true) {
                throwIfStartupAborted(activeSignal);
                const willRunInitializePlaybackRuntime = phaseToRun <= STARTUP_PHASE.RESUME_RUNTIME_MODULES;
                const shouldEagerlyInitEpgForPass = phaseToRun > STARTUP_PHASE.FULL_STARTUP;
                throwIfStartupAborted(activeSignal);
                this._callbacks.state.setReady(false);

                if (phaseToRun <= STARTUP_PHASE.FULL_STARTUP) {
                    await this._initCoreInfrastructure(activeSignal);
                }

                if (phaseToRun <= STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE) {
                    const authValid = await this._validateAuthentication(activeSignal);
                    if (!authValid) {
                        const queuedWork = this._startupQueue.consumeQueuedWork();
                        if (queuedWork === null) break;
                        phaseToRun = queuedWork.phase;
                        activeSignal = queuedWork.signal;
                        continue;
                    }
                }

                if (phaseToRun <= STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION) {
                    const plexConnected = await this._connectPlexServer(activeSignal);
                    if (!plexConnected) {
                        const queuedWork = this._startupQueue.consumeQueuedWork();
                        if (queuedWork === null) break;
                        phaseToRun = queuedWork.phase;
                        activeSignal = queuedWork.signal;
                        continue;
                    }
                }

                if (phaseToRun <= STARTUP_PHASE.RESUME_RUNTIME_MODULES) {
                    await this._initializePlaybackRuntime(activeSignal);
                    await this._ensureCorePlayerUiInitialized(activeSignal);
                }

                if (shouldEagerlyInitEpgForPass) {
                    await this._initializeEpg({
                        ensureCorePlayerUi: !willRunInitializePlaybackRuntime,
                        signal: activeSignal,
                    });
                }

                throwIfStartupAborted(activeSignal);
                const queuedWork = this._startupQueue.consumeQueuedWork();
                if (queuedWork === null) {
                    shouldEagerlyInitEpgForFinalReadyWork = shouldEagerlyInitEpgForPass;
                    break;
                }
                phaseToRun = queuedWork.phase;
                activeSignal = queuedWork.signal;
            }

            if (shouldEagerlyInitEpgForFinalReadyWork !== null) {
                throwIfStartupAborted(activeSignal);
                this._callbacks.state.setupEventWiring();

                if (this._deps.modules.navigation) {
                    throwIfStartupAborted(activeSignal);
                    await applyPostReadyRoutingPolicy({
                        navigation: this._deps.modules.navigation,
                        channelManager: this._deps.modules.channelManager,
                        shouldRunAudioSetup: this._callbacks.routing.shouldRunAudioSetup,
                        shouldRunChannelSetup: this._callbacks.routing.shouldRunChannelSetup,
                        switchToChannel: this._callbacks.routing.switchToChannel,
                        openServerSelect: this._callbacks.routing.openServerSelect,
                        signal: activeSignal,
                    });
                }

                throwIfStartupAborted(activeSignal);
                this._callbacks.state.setReady(true);
                if (this._deps.modules.lifecycle) {
                    throwIfStartupAborted(activeSignal);
                    this._deps.modules.lifecycle.setPhase('ready');
                }

                throwIfStartupAborted(activeSignal);
                this.clearAuthResume();
                this.clearServerResume();
                this.clearProfileResume();
                shouldScheduleEpgWarmup = !shouldEagerlyInitEpgForFinalReadyWork;
            }
        } catch (error: unknown) {
            caughtError = error;
            this._cancelEpgWarmup();
            if (isStartupAbortError(error, activeSignal)) shouldScheduleEpgWarmup = false;
            else {
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
            }
        } finally {
            this._startupInProgress = false;
            this._startupQueue.settle(caughtError);
        }

        if (shouldScheduleEpgWarmup) {
            this._scheduleEpgWarmup();
        }
        // Rethrow after cleanup so direct callers receive a rejected Promise
        if (caughtError !== undefined) {
            throw caughtError;
        }
    }

    isStartupInProgress(): boolean {
        return this._startupInProgress;
    }

    async ensureEPGInitialized(): Promise<void> {
        await this._initializeEpg();
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
        await this.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
    }

    private async _initCoreInfrastructure(signal: AbortSignal | null | undefined): Promise<void> {
        const startTime = Date.now();

        throwIfStartupAborted(signal);
        // EventEmitter is already ready (synchronous)
        this._callbacks.status.updateModuleStatus('event-emitter', 'ready', undefined, 0);

        const promises: Promise<void>[] = [];

        if (this._deps.modules.lifecycle) {
            throwIfStartupAborted(signal);
            this._callbacks.status.updateModuleStatus('app-lifecycle', 'initializing');
            promises.push(
                this._deps.modules.lifecycle.initialize().then(() => {
                    throwIfStartupAborted(signal);
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
            throwIfStartupAborted(signal);
            this._callbacks.status.updateModuleStatus('navigation', 'initializing');
            this._deps.modules.navigation.initialize(this._config.navConfig);
            throwIfStartupAborted(signal);
            this._callbacks.status.updateModuleStatus(
                'navigation',
                'ready',
                undefined,
                Date.now() - startTime
            );
        }

        await Promise.all(promises);
        throwIfStartupAborted(signal);
    }

    private async _validateAuthentication(signal: AbortSignal | null | undefined): Promise<boolean> {
        const startTime = Date.now();
        throwIfStartupAborted(signal);
        this._callbacks.status.updateModuleStatus('plex-auth', 'initializing');

        if (!this._deps.modules.plexAuth || !this._deps.modules.navigation) {
            throwIfStartupAborted(signal);
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

        const authGateInputs = {
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
            signal,
        };

        return applyAuthValidationPolicy(authGateInputs);
    }

    private async _connectPlexServer(signal: AbortSignal | null | undefined): Promise<boolean> {
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
            return await applyServerConnectionPolicy({
                startTime,
                plexDiscovery: this._deps.modules.plexDiscovery,
                plexLibrary: this._deps.modules.plexLibrary,
                plexStreamResolver: this._deps.modules.plexStreamResolver,
                navigation: this._deps.modules.navigation,
                updateModuleStatus: this._callbacks.status.updateModuleStatus,
                handlers: {
                    registerServerResume: () => this._registerServerResume(),
                },
                signal,
            });
        } catch (error) {
            if (!isPlexAuthRecoverable(error)) {
                throw error;
            }

            throwIfStartupAborted(signal);
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
            throwIfStartupAborted(signal);
            this._deps.modules.navigation.goTo('auth');
            this._callbacks.errors.handleGlobalError(moduleError, 'plex-server-discovery');
            return false;
        }
    }

    private async _initializePlaybackRuntime(signal: AbortSignal | null | undefined): Promise<void> {
        const startTime = Date.now();

        // Channel Manager
        if (this._deps.modules.channelManager) {
            const channelManager = this._deps.modules.channelManager;
            await this._initializeRuntimeModule('channel-manager', startTime, signal, async () => {
                await this._callbacks.serverStorage.configureChannelManagerStorage();
                throwIfStartupAborted(signal);
                await channelManager.loadChannels();
            });
        }

        // Channel Scheduler (no async init needed)
        if (this._deps.modules.scheduler) {
            throwIfStartupAborted(signal);
            this._callbacks.status.updateModuleStatus(
                'channel-scheduler',
                'ready',
                undefined,
                Date.now() - startTime
            );
        } else {
            throwIfStartupAborted(signal);
            this._callbacks.status.updateModuleStatus('channel-scheduler', 'disabled');
        }

        // Video Player
        if (this._deps.modules.videoPlayer && this._config) {
            const videoPlayer = this._deps.modules.videoPlayer;
            await this._initializeRuntimeModule('video-player', startTime, signal, async () => {
                await videoPlayer.initialize({
                    ...this._config.playerConfig,
                });
                throwIfStartupAborted(signal);
                // Request Media Session integration (once per app lifetime)
                videoPlayer.requestMediaSession();
            });
        }

        if (this._deps.overlays.playerOsd && this._config) {
            const playerOsd = this._deps.overlays.playerOsd;
            await this._initializeRuntimeModule('player-osd-ui', startTime, signal, () => {
                playerOsd.initialize(this._config.playerOsdConfig);
            });
        }

        if (this._deps.overlays.channelNumberOverlay && this._config) {
            const channelNumberOverlay = this._deps.overlays.channelNumberOverlay;
            await this._initializeRuntimeModule('channel-number-overlay-ui', startTime, signal, () => {
                channelNumberOverlay.initialize(this._config.channelNumberOverlayConfig.containerId);
            });
        }

        if (this._deps.overlays.channelBadgeOverlay && this._config) {
            const channelBadgeOverlay = this._deps.overlays.channelBadgeOverlay;
            await this._initializeRuntimeModule('channel-badge-ui', startTime, signal, () => {
                channelBadgeOverlay.initialize(this._config.channelBadgeConfig);
            });
        }

        if (this._deps.overlays.miniGuide && this._config) {
            const miniGuide = this._deps.overlays.miniGuide;
            await this._initializeRuntimeModule('mini-guide-ui', startTime, signal, () => {
                miniGuide.initialize(this._config.miniGuideConfig);
            });
        }

        if (this._deps.overlays.channelTransition && this._config) {
            const channelTransition = this._deps.overlays.channelTransition;
            await this._initializeRuntimeModule('channel-transition-ui', startTime, signal, () => {
                channelTransition.initialize(this._config.channelTransitionConfig);
            });
        }

    }

    private async _initializeRuntimeModule(
        moduleId: string,
        startTime: number,
        signal: AbortSignal | null | undefined,
        initialize: () => void | Promise<void>
    ): Promise<void> {
        throwIfStartupAborted(signal);
        this._callbacks.status.updateModuleStatus(moduleId, 'initializing');
        await initialize();
        throwIfStartupAborted(signal);
        this._callbacks.status.updateModuleStatus(moduleId, 'ready', undefined, Date.now() - startTime);
    }

    private async _initializeEpg(options?: {
        ensureCorePlayerUi?: boolean;
        signal?: AbortSignal | null | undefined;
    }): Promise<void> {
        const ensureCorePlayerUi = options?.ensureCorePlayerUi ?? true;
        const signal = options?.signal;
        throwIfStartupAborted(signal);
        if (this._callbacks.status.getModuleStatus('epg-ui') === 'ready') {
            if (ensureCorePlayerUi) {
                await this._ensureCorePlayerUiInitialized(signal);
            }
            return;
        }
        if (this._epgInitPromise) {
            await this._epgInitPromise;
            throwIfStartupAborted(signal);
            if (ensureCorePlayerUi) {
                await this._ensureCorePlayerUiInitialized(signal);
            }
            return;
        }
        if (!this._deps.modules.epg || !this._config) {
            if (ensureCorePlayerUi) {
                await this._ensureCorePlayerUiInitialized(signal);
            }
            return;
        }

        const startTime = Date.now();
        throwIfStartupAborted(signal);
        this._callbacks.status.updateModuleStatus('epg-ui', 'initializing');
        const init = async (): Promise<void> => {
            throwIfStartupAborted(signal);
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
            throwIfStartupAborted(signal);
            epg.initialize(epgConfigWithResolver);
            await this._deps.readiness.epg?.ensureReady();
            throwIfStartupAborted(signal);
            this._callbacks.status.updateModuleStatus(
                'epg-ui',
                'ready',
                undefined,
                Date.now() - startTime
            );
        };
        this._epgInitPromise = init()
            .catch((e) => {
                if (isStartupAbortError(e, signal)) throw e;
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
            await this._ensureCorePlayerUiInitialized(signal);
        }
    }

    private async _ensureCorePlayerUiInitialized(signal: AbortSignal | null | undefined): Promise<void> {
        throwIfStartupAborted(signal);
        await this._deps.startupUiInitializer.ensureCorePlayerUiInitialized();
        throwIfStartupAborted(signal);
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
            this._resumeStartupFrom(STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE);
        });
        this._authResumeDisposable = disposable;
    }

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
            this._resumeStartupFrom(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
        });
        this._serverResumeDisposable = disposable;
    }

    private _registerProfileResume(): void {
        if (!this._deps.modules.plexAuth) {
            return;
        }

        this.clearProfileResume();
        const disposable = this._deps.modules.plexAuth.on('profileChange', () => {
            void this.resumeStartupAfterProfileSwitch().catch((error: unknown) => {
                this._reportResumeFailure(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION, error);
            });
        });
        this._profileResumeDisposable = disposable;
    }

    private _resumeStartupFrom(phase: StartupResumePhase): void {
        void this.runStartup(phase).catch((error: unknown) => {
            this._reportResumeFailure(phase, error);
        });
    }

    private _reportResumeFailure(phase: StartupResumePhase, error: unknown): void {
        // runStartup() already reports fatal startup failures via handleGlobalError('start').
        // Consume the rejection here only to avoid an unhandled Promise rejection on resume.
        try {
            const failure = STARTUP_RESUME_FAILURES[phase];
            this._callbacks.diagnostics.reportRecoverableAsyncFailure(
                failure.context,
                failure.message,
                error
            );
        } catch {
            // Resume rejection is already consumed above; diagnostics must stay best-effort.
        }
    }
}
