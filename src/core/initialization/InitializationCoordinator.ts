import type { IAppLifecycle, AppError } from '../../modules/lifecycle';
import { AppErrorCode } from '../../types/app-errors';
import type { INavigationManager } from '../../modules/navigation';
import {
    type IPlexAuth,
    type PlexAuthValidationGuard,
    isPlexAuthOperationSupersededError,
    isPlexAuthRecoverable,
} from '../../modules/plex/auth';
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
import type { OrchestratorConfig, ModuleStatus } from '../orchestrator/contracts/OrchestratorTypes';
import type {
    ChannelBadgeOverlayInitPort,
    ChannelNumberOverlayInitPort,
} from '../orchestrator/contracts/OverlayPorts';
import { EpgPreferencesStore } from '../../modules/settings/EpgPreferencesStore';
import { ProfileSessionStore } from '../../modules/settings/ProfileSessionStore';
import {
    applyAuthValidationPolicy,
    applyServerConnectionPolicy,
    applyPostReadyRoutingPolicy,
    type AuthValidationPolicyResult,
    type ServerConnectionPolicyResult,
} from './InitializationStartupPolicy';
import {
    isStartupAbortError,
    createStartupPassValidity,
    throwIfStartupAborted,
    type StartupPassValidity,
    type StartupSignalOptions,
} from './InitializationAbort';
import { InitializationStartupQueue } from './InitializationStartupQueue';
import { toRecoverableModuleStatusError } from './RecoverableModuleStatusError';
import type { RecoverableAsyncFailureReporter } from '../orchestrator/runtime/OrchestratorRuntimeSeams';
import {
    InitializationSelectedServerTransaction,
    type SelectedServerInitializationRequest,
    type SelectedServerInitializationResult,
} from './InitializationSelectedServerTransaction';
import { initializeCoreInfrastructure } from './InitializationCoreInfrastructure';
import {
    InitializationStartupHandoff,
    type InitializationSelectedServerLineage,
} from './InitializationStartupHandoff';
import {
    reportInitializationResumeFailure,
    type StartupResumePhase,
} from './InitializationResumeFailure';
import { InitializationQuarantineAuthority, InitializationQuarantinedError } from './InitializationQuarantineAuthority';
import { StartupRestoreBlockedError, type InitializationRestoreProjection } from './InitializationRestoreProjection';
// Numeric order is significant for queued phase collapsing.
export const STARTUP_PHASE = {
    FULL_STARTUP: 1,
    RESUME_AFTER_AUTH_CHANGE: 2,
    RESUME_AFTER_SERVER_SELECTION: 3,
    RESUME_RUNTIME_MODULES: 4,
    RESUME_EPG_ONLY: 5,
} as const;
export type StartupPhase = typeof STARTUP_PHASE[keyof typeof STARTUP_PHASE];
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
    epgDebugRuntime: IEPGDebugRuntime | null;
    stores: {
        epgPreferencesStore: EpgPreferencesStore;
        profileSessionStore: ProfileSessionStore;
    };
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
        setupEventWiring: () => boolean;
        disposeEventWiring: () => void;
        transferSelectedServerTuningToStartup: () => void;
    };
    serverStorage: {
        configureDiscoveryStorage: () => void;
        configureChannelManagerStorage: () => Promise<void>;
        getSelectedServerId: () => string | null;
    };
    routing: {
        shouldRunAudioSetup: () => boolean;
        openServerSelect: () => void;
    };
    epgWarmup: {
        warmCurrentViewportForStartup: (options?: {
            signal?: AbortSignal | null;
            shouldContinue?: () => boolean;
        }) => Promise<void>;
    };
    picture: {
        hasUsableRetainedSession: () => boolean;
    };
    resources: {
        buildPlexResourceUrl: (pathOrUrl: string | null) => string | null;
    };
}
export class InitializationCoordinator {
    private static readonly EPG_WARMUP_DELAY_MS = 1500;
    private _startupInProgress = false;
    private readonly _startupQueue = new InitializationStartupQueue();
    private _authResumeDisposable: IDisposable | null = null;
    private _serverResumeDisposable: IDisposable | null = null;
    private _profileResumeDisposable: IDisposable | null = null;
    private _epgInitPromise: Promise<void> | null = null;
    private _epgWarmupTimerId: ReturnType<typeof setTimeout> | null = null;
    private _epgWarmupPromise: Promise<void> | null = null;
    private _epgWarmupAbortController: AbortController | null = null;
    private readonly _selectedServerTransaction: InitializationSelectedServerTransaction;
    private readonly _startupHandoff: InitializationStartupHandoff;
    private readonly _quarantineAuthority = new InitializationQuarantineAuthority();
    private _restoreProjection: InitializationRestoreProjection = {
        generation: 0, phase: 'auth', outcome: null, channelCount: null,
        requiredComplete: false, optionalComplete: null, reason: null, actions: [],
    };
    private readonly _restoreListeners = new Set<(projection: InitializationRestoreProjection) => void>();

    getRestoreProjection(): InitializationRestoreProjection { return this._restoreProjection; }

    subscribeToRestoreProjection(
        listener: (projection: InitializationRestoreProjection) => void
    ): IDisposable {
        this._restoreListeners.add(listener);
        listener(this._restoreProjection);
        return { dispose: (): void => { this._restoreListeners.delete(listener); } };
    }

    private _publishRestore(
        change: Partial<InitializationRestoreProjection>, expectedGeneration?: number
    ): void {
        if (expectedGeneration !== undefined && this._restoreProjection.generation !== expectedGeneration) return;
        this._restoreProjection = { ...this._restoreProjection, ...change };
        for (const listener of this._restoreListeners) listener(this._restoreProjection);
    }
    constructor(
        private readonly _config: OrchestratorConfig,
        private readonly _deps: InitializationDependencies,
        private readonly _callbacks: InitializationCallbacks
    ) {
        this._startupHandoff = new InitializationStartupHandoff(this._callbacks.state.transferSelectedServerTuningToStartup);
        this._selectedServerTransaction = new InitializationSelectedServerTransaction({
            getPlexAuth: (): IPlexAuth | null => this._deps.modules.plexAuth,
            isSelectedServerConnected: (): boolean =>
                this._deps.modules.plexDiscovery?.isConnected() === true,
            initializePlaybackRuntime: (signal): Promise<void> =>
                this._initializePlaybackRuntime(signal),
            initializeEpg: (signal): Promise<void> =>
                this._initializeEpg({ signal }),
            isEpgReady: (): boolean => this._callbacks.status.getModuleStatus('epg-ui') === 'ready',
            getNavigation: (): INavigationManager | null => this._deps.modules.navigation,
            getChannelManager: (): IChannelManager | null => this._deps.modules.channelManager,
            shouldRunAudioSetup: this._callbacks.routing.shouldRunAudioSetup,
            openServerSelect: this._callbacks.routing.openServerSelect,
            publishCommitStart: (): void => {
                this._callbacks.status.updateModuleStatus('plex-auth', 'ready', undefined, 0);
                this._callbacks.status.updateModuleStatus('plex-server-discovery', 'ready', undefined, 0);
                this._callbacks.status.updateModuleStatus('plex-library', 'ready', undefined, 0);
                this._callbacks.status.updateModuleStatus('plex-stream-resolver', 'ready', undefined, 0);
            },
            setupEventWiring: this._callbacks.state.setupEventWiring,
            disposeEventWiring: this._callbacks.state.disposeEventWiring,
            setReady: this._callbacks.state.setReady,
            publishLifecycleReady: (): void => {
                this._deps.modules.lifecycle?.setPhase('ready');
            },
            clearResumeHandlers: (): void => {
                this.clearAuthResume();
                this.clearServerResume();
                this.clearProfileResume();
            },
        });
    }
    async runSelectedServerTransaction(request: SelectedServerInitializationRequest): Promise<SelectedServerInitializationResult> {
        this._cancelEpgWarmup();
        const generation = this._restoreProjection.generation + 1;
        this._publishRestore({ generation, phase: 'auth', outcome: null,
            channelCount: null, requiredComplete: false, optionalComplete: null,
            reason: null, actions: [] });
        const result = await this._selectedServerTransaction.run({
            ...request,
            publishRestorePhase: (phase): void => this._publishRestore({ phase }, generation),
            publishRestoreLoad: (load): void => this._publishRestore({
                phase: 'prepare-runtime', outcome: load.kind,
                channelCount: 'channelCount' in load ? load.channelCount : null,
            }, generation),
        });
        if (result.kind === 'completed') {
            const load = this._deps.modules.channelManager?.getLastLoadOutcome();
            const optionalComplete = result.payload.epgRefresh.kind === 'succeeded';
            this._publishRestore({ phase: 'complete', outcome: load?.kind ?? null,
                channelCount: load && 'channelCount' in load ? load.channelCount : null,
                requiredComplete: true, optionalComplete,
                reason: optionalComplete ? null : 'Some Guide data is unavailable. Retry to refresh.',
                actions: optionalComplete ? [] : ['retry', 'switch-server'] }, generation);
        } else if (result.kind === 'stopped') {
            this._publishRestore({ phase: 'complete',
                outcome: result.reason === 'auth_required' ? 'auth-invalid'
                    : result.reason === 'server_unavailable' ? 'server-unavailable' : 'superseded',
                reason: result.reason,
                actions: result.reason === 'superseded' ? [] : ['retry', 'switch-server', 'support'] }, generation);
        } else {
            const blocked = result.error instanceof StartupRestoreBlockedError ? result.error : null;
            const load = blocked?.outcome;
            this._publishRestore({ phase: 'complete', outcome: load?.kind ?? 'restore-failed',
                channelCount: load && 'channelCount' in load ? load.channelCount : null,
                reason: result.error instanceof Error ? result.error.message : String(result.error),
                actions: load?.kind === 'unreadable' || load?.kind === 'unsupported'
                    ? ['retry', 'switch-server', 'switch-profile', 'rerun-setup', 'support']
                    : ['retry', 'switch-server', 'switch-profile', 'support'] }, generation);
        }
        return result;
    }
    runStartup(startPhase: StartupPhase, options?: StartupSignalOptions): Promise<void> {
        const lease = this._quarantineAuthority.begin(options?.signal);
        if (!lease) return Promise.reject(new InitializationQuarantinedError());
        const request = this._startupHandoff.beginStartup();
        this._publishRestore({ generation: this._restoreProjection.generation + 1, phase: 'auth',
            outcome: null, channelCount: null, requiredComplete: false, optionalComplete: null,
            reason: null, actions: [] });
        const startup = this._runStartup(startPhase, { signal: lease.signal, preferQueuedSignal: Boolean(options?.signal) });
        this._startupHandoff.trackStartup(request, startup);
        return lease.track(startup);
    }
    async prepareForSelectedServerQuarantine(): Promise<void> {
        const drainage = this._quarantineAuthority.prepare();
        this.clearAuthResume(); this.clearServerResume(); this.clearProfileResume();
        await Promise.all([drainage, this._epgWarmupPromise ?? Promise.resolve()]);
    }
    releaseSelectedServerQuarantine(): void { this._quarantineAuthority.release(); }
    beginSelectedServerLineage(): InitializationSelectedServerLineage {
        return this._startupHandoff.beginSelectedServerLineage(); }
    getSupersedingStartupHandoff(lineage: InitializationSelectedServerLineage): Promise<void> | null {
        return this._startupHandoff.getSupersedingStartupHandoff(lineage); }
    releaseSelectedServerLineage(lineage: InitializationSelectedServerLineage): void {
        this._startupHandoff.releaseSelectedServerLineage(lineage); }
    private async _runStartup(startPhase: StartupPhase, options?: StartupSignalOptions & {
        preferQueuedSignal?: boolean;
    }): Promise<void> {
        let activeCallerSignal = options?.signal;
        throwIfStartupAborted(activeCallerSignal);
        this._cancelEpgWarmup();
        if (this._startupInProgress) {
            return this._startupQueue.queue(startPhase, activeCallerSignal, options?.preferQueuedSignal);
        }
        this._startupInProgress = true;
        let phaseToRun: StartupPhase = startPhase;
        let caughtError: unknown;
        let passValidity: StartupPassValidity | null = null;
        let retainedGuard: PlexAuthValidationGuard | null = null;
        let projectionGeneration = this._restoreProjection.generation;
        try {
            while (true) {
                projectionGeneration = this._restoreProjection.generation;
                throwIfStartupAborted(activeCallerSignal);
                        const shouldEagerlyInitEpgForPass = phaseToRun > STARTUP_PHASE.FULL_STARTUP;
                if (phaseToRun <= STARTUP_PHASE.FULL_STARTUP) {
                    await initializeCoreInfrastructure({
                        config: this._config,
                        lifecycle: this._deps.modules.lifecycle,
                        navigation: this._deps.modules.navigation,
                        updateModuleStatus: this._callbacks.status.updateModuleStatus,
                        signal: activeCallerSignal,
                    });
                }

                const authResult: AuthValidationPolicyResult = retainedGuard
                    ? { kind: 'continue' as const, guard: retainedGuard }
                    : await this._validateAuthentication(activeCallerSignal);
                retainedGuard = null;
                if (authResult.kind === 'stop') {
                    if (this._deps.modules.navigation?.getCurrentScreen() === 'auth') {
                        this._publishRestore({ phase: 'complete', outcome: 'auth-invalid',
                            reason: 'Sign in is required.', actions: ['retry'] }, projectionGeneration);
                    }
                    const queuedWork = this._startupQueue.consumeQueuedWork();
                    if (queuedWork === null) break;
                    phaseToRun = queuedWork.phase;
                    activeCallerSignal = queuedWork.signal;
                    continue;
                }
                passValidity = createStartupPassValidity(activeCallerSignal, authResult.guard);
                let activeSignal = passValidity.signal;
                passValidity.assertCurrent();
                this._callbacks.state.setReady(false);

                try {
                    if (phaseToRun <= STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION) {
                        this._publishRestore({ phase: 'server' }, projectionGeneration);
                        const serverConnection = await this._connectPlexServer(activeSignal);
                        passValidity!.assertCurrent();
                        if (serverConnection.kind === 'stop') {
                            this._publishRestore({ phase: 'complete', outcome: 'server-unavailable',
                                reason: serverConnection.reason, actions: ['retry', 'switch-server'] }, projectionGeneration);
                            const queuedWork = this._startupQueue.consumeQueuedWork();
                            passValidity.dispose();
                            passValidity = null;
                            if (queuedWork === null) break;
                            phaseToRun = queuedWork.phase;
                            activeCallerSignal = queuedWork.signal;
                            retainedGuard = authResult.guard;
                            continue;
                        }
                        const plexDiscovery = this._deps.modules.plexDiscovery;
                        if (!plexDiscovery) throw new Error('Plex discovery unavailable after connection.');
                        passValidity.dispose();
                        passValidity = createStartupPassValidity(activeCallerSignal, authResult.guard, {
                            signal: plexDiscovery.getSelectionReceiptSignal(serverConnection.receipt),
                            assertCurrent: (): void =>
                                plexDiscovery.assertSelectionReceiptCurrent(serverConnection.receipt),
                        });
                        activeSignal = passValidity.signal;
                    }

                    if (phaseToRun <= STARTUP_PHASE.RESUME_RUNTIME_MODULES) {
                        this._publishRestore({ phase: 'read-lineup' }, projectionGeneration);
                        await this._initializePlaybackRuntime(activeSignal, projectionGeneration);
                        passValidity!.assertCurrent();
                    }

                    if (shouldEagerlyInitEpgForPass) {
                        await this._initializeEpg({
                            signal: activeSignal,
                        });
                        passValidity.assertCurrent();
                    }

                    const load = this._deps.modules.channelManager?.getLastLoadOutcome();
                    if (load?.kind === 'readable' || load?.kind === 'readable-degraded') {
                        this._publishRestore({ phase: 'prepare-guide' }, projectionGeneration);
                        await this._initializeEpg({ signal: activeSignal });
                        passValidity.assertCurrent();
                        if (this._callbacks.status.getModuleStatus('epg-ui') !== 'ready') {
                            throw new Error('Guide runtime is unavailable after lineup restore.');
                        }
                    }

                    passValidity.assertCurrent();
                    const queuedWork = this._startupQueue.consumeQueuedWork();
                    if (queuedWork !== null) {
                        passValidity!.dispose();
                        passValidity = null;
                        phaseToRun = queuedWork.phase;
                        activeCallerSignal = queuedWork.signal;
                        retainedGuard = authResult.guard;
                        continue;
                    }

                    passValidity.assertCurrent();
                    this._callbacks.state.setupEventWiring();

                    if (this._deps.modules.navigation) {
                        passValidity.assertCurrent();
                        await applyPostReadyRoutingPolicy({
                            navigation: this._deps.modules.navigation,
                            channelManager: this._deps.modules.channelManager,
                            shouldRunAudioSetup: this._callbacks.routing.shouldRunAudioSetup,
                            openServerSelect: this._callbacks.routing.openServerSelect,
                            signal: activeSignal,
                        });
                        passValidity.assertCurrent();
                    }

                    passValidity.assertCurrent();
                    this._callbacks.state.setReady(true);
                    if (load) this._publishRestore({ phase: 'complete', outcome: load.kind,
                        channelCount: 'channelCount' in load ? load.channelCount : null,
                        requiredComplete: true, optionalComplete: null,
                        reason: load.kind === 'readable-degraded' ? 'Saved lineup needed a safe legacy repair.' : null,
                        actions: [] }, projectionGeneration);
                    if (this._deps.modules.lifecycle) {
                        passValidity.assertCurrent();
                        this._deps.modules.lifecycle.setPhase('ready');
                    }

                    passValidity.assertCurrent();
                    this.clearAuthResume();
                    this.clearServerResume();
                    this.clearProfileResume();
                    if (!shouldEagerlyInitEpgForPass) {
                        this._scheduleEpgWarmup(() => authResult.guard.assertCurrent());
                    }
                    break;
                } catch (error) {
                    try {
                        passValidity!.assertCurrent();
                    } catch (validityError) {
                        if (!isPlexAuthOperationSupersededError(validityError)) throw validityError;
                        const queuedWork = this._startupQueue.consumeQueuedWork();
                        passValidity!.dispose();
                        passValidity = null;
                        if (queuedWork === null) break;
                        phaseToRun = queuedWork.phase;
                        activeCallerSignal = queuedWork.signal;
                        continue;
                    }
                    throw error;
                }
            }
        } catch (error: unknown) {
            caughtError = error;
            this._cancelEpgWarmup();
            if (activeCallerSignal?.aborted && isStartupAbortError(error, activeCallerSignal)) {
                this._publishRestore({ phase: 'complete', outcome: 'canceled',
                    requiredComplete: false, optionalComplete: null,
                    reason: 'Lineup restore was canceled.', actions: ['retry', 'switch-server', 'support'] }, projectionGeneration);
            }
            if (error instanceof StartupRestoreBlockedError) {
                this._publishRestore({ phase: 'complete', outcome: error.outcome.kind,
                    channelCount: null, requiredComplete: false, optionalComplete: null,
                    reason: error.message,
                    actions: error.outcome.kind === 'unreadable' || error.outcome.kind === 'unsupported'
                        ? ['retry', 'switch-server', 'switch-profile', 'rerun-setup', 'support']
                        : ['retry', 'switch-server', 'switch-profile', 'support'] }, projectionGeneration);
            }
            if (!isStartupAbortError(error, activeCallerSignal) && !isStartupAbortError(error, passValidity?.signal)) {
                const message = error instanceof Error ? error.message : String(error);
                if (!(error instanceof StartupRestoreBlockedError)) {
                    this._publishRestore({ phase: 'complete', outcome: 'restore-failed',
                        requiredComplete: false, optionalComplete: null, reason: message,
                        actions: ['retry', 'switch-server', 'switch-profile', 'support'] }, projectionGeneration);
                }
                this.clearAuthResume();
                this.clearServerResume();
                this.clearProfileResume();
                this._callbacks.errors.handleGlobalError(
                    {
                        code: error instanceof StartupRestoreBlockedError
                            ? AppErrorCode.STORAGE_CORRUPTED : AppErrorCode.INITIALIZATION_FAILED,
                        message,
                        recoverable: true,
                    },
                    'start'
                );
            }
        } finally {
            passValidity?.dispose();
            this._startupInProgress = false;
            this._startupQueue.settle(caughtError);
        }

        if (caughtError !== undefined) {
            throw caughtError;
        }
    }
    isStartupInProgress(): boolean {
        return this._startupInProgress;
    }
    async ensureEPGInitialized(signal?: AbortSignal | null): Promise<void> {
        await this._initializeEpg({ signal });
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
    prepareForRuntimeAuthRecovery(): void {
        this._registerAuthResume();
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
        await this.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
    }

    private async _validateAuthentication(signal: AbortSignal | null | undefined): Promise<AuthValidationPolicyResult> {
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
            return { kind: 'stop' as const };
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

    private async _connectPlexServer(
        signal: AbortSignal | null | undefined
    ): Promise<ServerConnectionPolicyResult> {
        const startTime = Date.now();
        if (
            !this._deps.modules.plexDiscovery ||
            !this._deps.modules.plexLibrary ||
            !this._deps.modules.plexStreamResolver ||
            !this._deps.modules.navigation
        ) {
            return { kind: 'stop', reason: 'selection_failed' };
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
            return { kind: 'stop', reason: 'selection_failed' };
        }
    }
    private async _initializePlaybackRuntime(
        signal: AbortSignal | null | undefined,
        projectionGeneration?: number
    ): Promise<void> {
        const startTime = Date.now();
        if (this._deps.modules.channelManager) {
            const channelManager = this._deps.modules.channelManager;
            await this._initializeRuntimeModule('channel-manager', startTime, signal, async () => {
                await this._callbacks.serverStorage.configureChannelManagerStorage();
                throwIfStartupAborted(signal);
                const load = await channelManager.loadChannels();
                throwIfStartupAborted(signal);
                if (projectionGeneration !== undefined) {
                    this._publishRestore({ phase: 'prepare-runtime', outcome: load.kind,
                        channelCount: 'channelCount' in load ? load.channelCount : null }, projectionGeneration);
                }
            });
        }
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
        if (this._deps.modules.videoPlayer && this._config) {
            const videoPlayer = this._deps.modules.videoPlayer;
            await this._initializeRuntimeModule('video-player', startTime, signal, async () => {
                await videoPlayer.initialize({
                    ...this._config.playerConfig,
                });
                throwIfStartupAborted(signal);
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
        signal?: AbortSignal | null | undefined;
    }): Promise<void> {
        const signal = options?.signal;
        throwIfStartupAborted(signal);
        if (this._callbacks.status.getModuleStatus('epg-ui') === 'ready') {
            return;
        }
        if (this._epgInitPromise) {
            await this._epgInitPromise;
            throwIfStartupAborted(signal);
            return;
        }
        if (!this._deps.modules.epg || !this._config) {
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
                hasUsableRetainedSession: this._callbacks.picture.hasUsableRetainedSession,
                epgPreferencesStore: this._deps.stores.epgPreferencesStore,
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
            await this._deps.readiness.epg?.ensureReady(signal);
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
    }
    async drainEpgWarmupForShutdown(): Promise<void> {
        if (this._epgWarmupTimerId !== null) {
            clearTimeout(this._epgWarmupTimerId);
            this._epgWarmupTimerId = null;
        }
        this._epgWarmupAbortController?.abort('shutdown');
        this._epgWarmupAbortController = null;
        try {
            await (this._epgWarmupPromise ?? Promise.resolve());
        } catch {
            // Best-effort drain; abort/supersession settles the warmup port.
        }
    }

    private _cancelEpgWarmup(): void {
        if (this._epgWarmupTimerId !== null) {
            clearTimeout(this._epgWarmupTimerId);
            this._epgWarmupTimerId = null;
        }
        this._epgWarmupAbortController?.abort('superseded');
        this._epgWarmupAbortController = null;
    }

    private _isPlaybackPlayingForWarmup(): boolean {
        try {
            return this._deps.modules.videoPlayer?.isPlaying?.() === true;
        } catch {
            return false;
        }
    }

    private _scheduleEpgWarmup(assertCurrent?: () => void): void {
        this._cancelEpgWarmup();
        this._epgWarmupTimerId = setTimeout(() => {
            this._epgWarmupTimerId = null;
            try {
                assertCurrent?.();
            } catch {
                return;
            }
            const abortController = new AbortController();
            this._epgWarmupAbortController = abortController;
            const warmup = (async (): Promise<void> => {
                try {
                    assertCurrent?.();
                } catch {
                    return;
                }
                try {
                    await this.ensureEPGInitialized(abortController.signal);
                } catch {
                    return;
                }
                if (abortController.signal.aborted) {
                    return;
                }
                try {
                    assertCurrent?.();
                } catch {
                    return;
                }
                if (!this._isPlaybackPlayingForWarmup()) {
                    return;
                }
                try {
                    await this._callbacks.epgWarmup.warmCurrentViewportForStartup({
                        signal: abortController.signal,
                        shouldContinue: (): boolean => this._isPlaybackPlayingForWarmup(),
                    });
                } catch {
                    // Best-effort warmup.
                }
            })();
            this._epgWarmupPromise = warmup;
            void warmup.finally(() => {
                if (this._epgWarmupPromise === warmup) this._epgWarmupPromise = null;
                if (this._epgWarmupAbortController === abortController) {
                    this._epgWarmupAbortController = null;
                }
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
                reportInitializationResumeFailure(
                    STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION,
                    this._callbacks.diagnostics.reportRecoverableAsyncFailure,
                    error
                );
            });
        });
        this._profileResumeDisposable = disposable;
    }

    private _resumeStartupFrom(phase: StartupResumePhase): void {
        void this.runStartup(phase).catch((error: unknown) => {
            reportInitializationResumeFailure(
                phase,
                this._callbacks.diagnostics.reportRecoverableAsyncFailure,
                error
            );
        });
    }
}
