import type {
    AppShellAuthRuntimePort,
    AppShellChannelSetupRuntimePort,
    AppShellDiagnosticsRuntimePort,
    AppShellNavigationRuntimePort,
    AppShellOrchestratorRuntime,
    AppShellProfileRuntimePort,
    AppShellServerSelectionRuntimePort,
    AppShellSettingsRuntimePort,
} from './core/app-shell/runtime/AppShellRuntimeContracts';
import type { AppOrchestratorRuntime } from './Orchestrator';
import type { LifecycleAppError, AppPhase } from './modules/lifecycle/types';
import type { INavigationManager } from './modules/navigation';
import { createAppContainers, type AppContainerRefs } from './core/app-shell/chrome/AppContainerFactory';
import {
    AppLazyScreenRegistry,
} from './core/app-shell/deferred-screens/AppLazyScreenRegistry';
import {
    AppLazyScreenPortFactory,
    createChannelSetupRuntimePort,
} from './core/app-shell/deferred-screens/AppLazyScreenPortFactory';
import { AppScreenVisibilityCoordinator } from './core/app-shell/chrome/AppScreenVisibilityCoordinator';
import { AppAuthoringScreenRegistry } from './core/app-shell/deferred-screens/AppAuthoringScreenRegistry';
import { AppAuthoringPortFactory } from './core/app-shell/deferred-screens/AppAuthoringPortFactory';
import type { ChannelStudioRequest } from './modules/ui/channels/ChannelDirectoryPorts';
import {
    AppBlockingErrorOverlayPresenter,
    type BlockingErrorOverlayAction,
} from './core/app-shell/chrome/AppBlockingErrorOverlayPresenter';
import {
    createAppRuntimeEngineLoader,
    type AppRuntimeEngineLoader,
} from './core/app-shell/runtime/AppRuntimeEngineLoader';
import { AppDiagnosticsSurface } from './core/app-shell/diagnostics/AppDiagnosticsSurface';
import { createAppOrchestratorConfig } from './core/app-shell/config/AppOrchestratorConfigFactory';
import { AppToastPresenter } from './core/app-shell/chrome/AppToastPresenter';
import { AppThemeController } from './core/app-shell/runtime/AppThemeController';
import { DebugOverridesStore } from './modules/debug/DebugOverridesStore';
import { SplashScreen } from './modules/ui/splash';
import { ProfileSessionStore } from './modules/settings/ProfileSessionStore';
import { AccessibilityPreferencesStore } from './modules/settings/AccessibilityPreferencesStore';
import { SupportReportStore } from './modules/support/SupportReportStore';
import { NowPlayingDisplayStore, type OverlayTransparency } from './modules/settings/NowPlayingDisplayStore';
import type { ChannelSetupConfig } from './core/channel-setup/types';
import { AppErrorCode, getAppErrorCode } from './types/app-errors';
import type { IDisposable } from './utils/interfaces';
import { summarizeErrorForLog } from './utils/errors';
import { createWebOsPlatformServices, type PlatformServices } from './platform';

const NON_BLOCKING_TOAST_MESSAGES: Partial<Record<AppErrorCode, string>> = {
    [AppErrorCode.CHANNEL_NOT_FOUND]: 'That channel is unavailable.',
    [AppErrorCode.SCHEDULER_EMPTY_CHANNEL]: 'No scheduled content is available for that channel.',
    [AppErrorCode.CONTENT_UNAVAILABLE]: 'That content is unavailable right now.',
    [AppErrorCode.RESOURCE_NOT_FOUND]: 'Requested content could not be found.',
};

const NON_BLOCKING_LIFECYCLE_CODES = new Set<AppErrorCode>(
    Object.values(AppErrorCode).filter((code) => code in NON_BLOCKING_TOAST_MESSAGES)
);

const ERROR_OVERLAY_MODAL_ID = 'modal:error-overlay';
const QUARANTINE_MODAL_POLICY = Object.freeze({
    dismissOnBack: false,
    blocksBackgroundCommands: true,
});
const APP_START_START_MARK = 'lineup.app_start.start';
const APP_START_FIRST_ACTIONABLE_MARK = 'lineup.app_start.first_actionable';
const ORCHESTRATOR_INITIALIZE_START_MARK = 'lineup.orchestrator_initialize.start';
const ORCHESTRATOR_INITIALIZE_END_MARK = 'lineup.orchestrator_initialize.end';
const ORCHESTRATOR_START_START_MARK = 'lineup.orchestrator_start.start';
const ORCHESTRATOR_START_END_MARK = 'lineup.orchestrator_start.end';
const ORCHESTRATOR_INITIALIZE_MEASURE = 'lineup.orchestrator_initialize';
const ORCHESTRATOR_START_MEASURE = 'lineup.orchestrator_start';
const APP_START_TO_FIRST_ACTIONABLE_MEASURE = 'lineup.app_start_to_first_actionable';

function markStartupTiming(name: string): void {
    const performanceApi = globalThis.performance;
    if (typeof performanceApi?.mark !== 'function') {
        return;
    }
    try {
        performanceApi.mark(name);
    } catch {
        return;
    }
}

function measureStartupTiming(name: string, startMark: string, endMark: string): void {
    const performanceApi = globalThis.performance;
    if (typeof performanceApi?.measure !== 'function') {
        return;
    }
    try {
        performanceApi.measure(name, startMark, endMark);
    } catch {
        return;
    }
}

export interface AppOptions {
    runtimeEngineLoader?: AppRuntimeEngineLoader;
}

export class App {
    private readonly _runtimeEngineLoader: AppRuntimeEngineLoader;
    private _orchestrator: AppShellOrchestratorRuntime | null = null;
    private readonly _debugOverridesStore = new DebugOverridesStore();
    private readonly _profileSessionStore = new ProfileSessionStore();
    private readonly _accessibilityPreferencesStore = new AccessibilityPreferencesStore();
    private readonly _nowPlayingDisplayStore = new NowPlayingDisplayStore();
    private readonly _blockingErrorOverlayPresenter = new AppBlockingErrorOverlayPresenter({
        getNavigation: (): INavigationManager | null => this._orchestrator?.getNavigation() ?? null,
        modalId: ERROR_OVERLAY_MODAL_ID,
    });
    private readonly _toastPresenter = new AppToastPresenter();
    private readonly _diagnosticsSurface = new AppDiagnosticsSurface({
        getDiagnosticsRuntime: (): AppShellDiagnosticsRuntimePort | null => this._orchestrator,
        getActiveChannelSetupConfig: (): ChannelSetupConfig | null => {
            const channelSetupScreen = this._lazyScreenRegistry?.getChannelSetupScreen() ?? null;
            const activeScreen = this._orchestrator?.getCurrentScreen() ?? null;

            if (activeScreen !== 'channel-setup') {
                return null;
            }

            return channelSetupScreen?.getPlannerDiagnosticsConfig() ?? null;
        },
        showToast: (toast): void => this._toastPresenter.show(toast),
        debugOverridesStore: this._debugOverridesStore,
    });
    private _lazyScreenRegistry: AppLazyScreenRegistry | null = null;
    private _authoringRegistry: AppAuthoringScreenRegistry | null = null;
    private _studioRequest: ChannelStudioRequest | null = null;
    private _studioEnteredFromDirectory = false;
    private _directoryPreferredId: string | undefined;
    private _directoryUseStack = false;
    private _channelSetupEnteredFromDirectory = false;
    private _screenVisibilityCoordinator: AppScreenVisibilityCoordinator | null = null;
    private _splashScreen: SplashScreen | null = null;
    private _themeController: AppThemeController | null = null;
    private _screenUnsubscribe: (() => void) | null = null;
    private _phaseUnsubscribe: (() => void) | null = null;
    private _restoreSubscription: IDisposable | null = null;
    private _restoreKeySubscription: IDisposable | null = null;
    private _startupController: AbortController | null = null;
    private _restoreCancelDestination: 'recovery' | 'server' | null = null;
    private _settingsOpenedFromRecovery = false;
    private readonly _supportReport = new SupportReportStore();
    private _recordedRestoreGeneration = 0;
    private _recordedRestoreTerminalGeneration = 0;
    private _lifecycleWarningDisposables: IDisposable[] = [];

    constructor(options: AppOptions = {}) {
        this._runtimeEngineLoader = options.runtimeEngineLoader ?? createAppRuntimeEngineLoader();
    }

    async start(): Promise<void> {
        markStartupTiming(APP_START_START_MARK);
        this._supportReport.record({ code: 'app-start', at: Date.now(), outcome: 'started' });
        try {
            this._themeController = new AppThemeController();
            this._themeController.initialize();
            this._applySavedVisualPreferences();

            const containerRefs = this._createContainers();
            const platformServices = createWebOsPlatformServices();
            const config = this._buildConfig(platformServices);

            this._initializeShellSurfaces(containerRefs);

            const orchestrator = await this._runtimeEngineLoader.load(platformServices);
            this._orchestrator = orchestrator;
            markStartupTiming(ORCHESTRATOR_INITIALIZE_START_MARK);
            await orchestrator.initialize(config);
            markStartupTiming(ORCHESTRATOR_INITIALIZE_END_MARK);
            measureStartupTiming(
                ORCHESTRATOR_INITIALIZE_MEASURE,
                ORCHESTRATOR_INITIALIZE_START_MARK,
                ORCHESTRATOR_INITIALIZE_END_MARK
            );

            this._wireScreenVisibility();

            // Wire up lifecycle error events before starting
            this._subscribeToLifecycleErrors();
            this._subscribeToLifecycleWarnings();
            this._orchestrator.setNowPlayingHandler((toast) => {
                this._toastPresenter.show(toast);
            });

            markStartupTiming(ORCHESTRATOR_START_START_MARK);
            await this._runStartupPass();
            this._supportReport.record({ code: 'app-start', at: Date.now(),
                outcome: this._orchestrator?.getStartupRestoreProjection()?.outcome === 'canceled' ? 'cancelled' : 'succeeded' });
            markStartupTiming(ORCHESTRATOR_START_END_MARK);
            measureStartupTiming(
                ORCHESTRATOR_START_MEASURE,
                ORCHESTRATOR_START_START_MARK,
                ORCHESTRATOR_START_END_MARK
            );
            markStartupTiming(APP_START_FIRST_ACTIONABLE_MARK);
            measureStartupTiming(
                APP_START_TO_FIRST_ACTIONABLE_MEASURE,
                APP_START_START_MARK,
                APP_START_FIRST_ACTIONABLE_MARK
            );
        } catch (error) {
            this._supportReport.record({ code: 'app-start', at: Date.now(), outcome: 'failed' });
            console.error('App startup failed:', summarizeErrorForLog(error));
            try {
                await this.shutdown();
            } catch (shutdownError) {
                console.error('App shutdown after startup failure failed:', summarizeErrorForLog(shutdownError));
            }
            throw error;
        }
    }

    private _subscribeToLifecycleErrors(): void {
        if (!this._orchestrator) return;

        // Access lifecycle through orchestrator's module system
        // Register an error handler that displays the overlay
        this._orchestrator.registerErrorHandler('app-shell', (error): boolean => {
            const lifecycleError = this._orchestrator
                ? this._orchestrator.toLifecycleAppError(error)
                : {
                    code: error.code,
                    message: error.message,
                    recoverable: error.recoverable,
                    phase: 'error' as AppPhase,
                    timestamp: Date.now(),
                    userMessage: error.message,
                    actions: [],
                };
            if (!this._shouldUseBlockingOverlay(lifecycleError)) {
                this.hideErrorOverlay();
                this._toastPresenter.show({
                    message: this._getNonBlockingToastMessage(lifecycleError),
                    type: 'warning',
                });
                return true;
            }
            this.showErrorOverlay(lifecycleError);
            return false;
        });
    }

    private _shouldUseBlockingOverlay(error: LifecycleAppError): boolean {
        if (!error.recoverable) {
            return true;
        }
        const code = getAppErrorCode(error.code);
        return code === null || !NON_BLOCKING_LIFECYCLE_CODES.has(code);
    }

    private _getNonBlockingToastMessage(error: LifecycleAppError): string {
        const code = getAppErrorCode(error.code);
        const mapped = code ? NON_BLOCKING_TOAST_MESSAGES[code] : undefined;
        if (typeof mapped === 'string' && mapped.length > 0) {
            return mapped;
        }
        return error.userMessage?.trim() || 'Something went wrong.';
    }

    private _subscribeToLifecycleWarnings(): void {
        if (!this._orchestrator) return;
        if (this._lifecycleWarningDisposables.length > 0) return;

        this._lifecycleWarningDisposables.push(
            this._orchestrator.onLifecycleEvent('persistenceWarning', () => {
                this._toastPresenter.show({ message: 'Some settings could not be saved.', type: 'warning' });
            }),
            this._orchestrator.onLifecycleEvent('networkWarning', () => {
                this._toastPresenter.show({ message: 'Network connection looks unstable.', type: 'warning' });
            })
        );
    }

    private _disposeLifecycleWarningSubscriptions(): void {
        for (const disposable of this._lifecycleWarningDisposables) {
            disposable.dispose();
        }
        this._lifecycleWarningDisposables = [];
    }

    async shutdown(): Promise<void> {
        this._startupController?.abort(new DOMException('App shutdown', 'AbortError'));
        this._startupController = null;
        this._restoreSubscription?.dispose();
        this._restoreSubscription = null;
        this._restoreKeySubscription?.dispose();
        this._restoreKeySubscription = null;
        this._settingsOpenedFromRecovery = false;
        if (this._screenUnsubscribe) {
            this._screenUnsubscribe();
            this._screenUnsubscribe = null;
        }
        if (this._phaseUnsubscribe) {
            this._phaseUnsubscribe();
            this._phaseUnsubscribe = null;
        }
        this._disposeLifecycleWarningSubscriptions();

        this._blockingErrorOverlayPresenter.dispose();
        this._toastPresenter.dispose();

        this._splashScreen?.hide();
        this._splashScreen = null;
        this._lazyScreenRegistry?.destroy();
        this._lazyScreenRegistry = null;
        this._authoringRegistry?.destroy();
        this._authoringRegistry = null;
        this._studioRequest = null;
        this._directoryPreferredId = undefined;
        this._directoryUseStack = false;
        this._channelSetupEnteredFromDirectory = false;
        this._screenVisibilityCoordinator = null;
        this._themeController = null;
        this._diagnosticsSurface.dispose();
        const orchestrator = this._orchestrator;
        if (orchestrator) {
            this._orchestrator = null;
            orchestrator.setNowPlayingHandler(null);
            await orchestrator.shutdown();
        }
    }

    getOrchestrator(): AppOrchestratorRuntime | null {
        return this._orchestrator;
    }

    private _applySavedVisualPreferences(): void {
        this._setOverlayTransparency(this._nowPlayingDisplayStore.readOverlayTransparencyAndClean());
        this._setAccessibilityPreference('reduceMotion', this._accessibilityPreferencesStore.readReduceMotionEnabledAndClean());
        this._setAccessibilityPreference('largeFocus', this._accessibilityPreferencesStore.readLargeFocusEnabledAndClean());
    }

    private _setOverlayTransparency(value: OverlayTransparency): void {
        document.body?.setAttribute('data-player-overlay-transparency', value);
    }

    private _setAccessibilityPreference(name: 'reduceMotion' | 'largeFocus', enabled: boolean): void {
        const root = document.body;
        if (!root) return;
        if (name === 'reduceMotion') {
            if (enabled) root.setAttribute('data-motion', 'reduced');
            else root.removeAttribute('data-motion');
        } else {
            if (enabled) root.setAttribute('data-large-focus', 'true');
            else root.removeAttribute('data-large-focus');
        }
    }

    private _createContainers(): AppContainerRefs {
        const root = document.getElementById('app');
        if (!root) {
            throw new Error('Root element #app not found');
        }

        const refs = createAppContainers(root);

        this._blockingErrorOverlayPresenter.setContainer(refs.errorOverlay);
        this._diagnosticsSurface.setContainer(refs.devMenuContainer);
        this._diagnosticsSurface.initialize();
        this._toastPresenter.setContainer(refs.toastContainer);

        return refs;
    }

    private _initializeShellSurfaces(containerRefs: AppContainerRefs): void {
        const themeController = this._themeController;
        if (!themeController) {
            return;
        }
        const lazyScreenPortFactory = new AppLazyScreenPortFactory({
            openChannelsFromSettings: (): void => {
                this._orchestrator?.getNavigation()?.goTo('channels');
            },
            goBackFromChannelSetupLibraries: (): void => {
                const navigation = this._orchestrator?.getNavigation();
                if (this._channelSetupEnteredFromDirectory && navigation?.goBack()) return;
                this._orchestrator?.openServerSelect();
            },
            openCustomChannelStudio: (): void => {
                this._studioRequest = { kind: 'create' };
                this._studioEnteredFromDirectory = false;
                this._orchestrator?.getNavigation()?.replaceScreen('channel-studio');
            },
            getNavigationRuntime: (): AppShellNavigationRuntimePort | null => this._orchestrator,
            getAuthRuntime: (): AppShellAuthRuntimePort | null => this._orchestrator,
            getProfileRuntime: (): AppShellProfileRuntimePort | null => this._orchestrator,
            getServerSelectionRuntime: (): AppShellServerSelectionRuntimePort | null => this._orchestrator,
            getChannelSetupRuntime: (): AppShellChannelSetupRuntimePort | null =>
                createChannelSetupRuntimePort(this._orchestrator),
            getSettingsRuntime: (): AppShellSettingsRuntimePort | null => {
                const runtime = this._orchestrator;
                if (!runtime) {
                    return null;
                }
                return {
                    setSubtitleTrack: (trackId) => runtime.setSubtitleTrack(trackId),
                    onGuideSettingChange: (change) => runtime.onGuideSettingChange(change),
                    getActiveUsername: () => runtime.getActiveUsername(),
                    getTheme: () => themeController.getTheme(),
                    setTheme: (theme) => themeController.setTheme(theme),
                    getThemePersistenceResult: () => themeController.getPersistenceResult(),
                    retryThemePersistence: () => themeController.retryPersistence(),
                    updateSettingsPlaybackPolicy: (keepRunning) => runtime.updateSettingsPlaybackPolicy(keepRunning),
                    setOverlayTransparency: (value) => this._setOverlayTransparency(value),
                    setAccessibilityPreference: (name, enabled) => this._setAccessibilityPreference(name, enabled),
                    switchProfileFromSettings: (): void => { runtime.getNavigation()?.goTo('profile-select'); },
                    switchServerFromSettings: () => runtime.openServerSelect(),
                    signOutFromSettings: () => runtime.signOutPlex(),
                };
            },
        });
        this._splashScreen = new SplashScreen(
            containerRefs.splashContainer,
            () => {
                this._restoreCancelDestination = 'server';
                this._startupController?.abort(new DOMException('Switching server', 'AbortError'));
                this._orchestrator?.openServerSelect();
            },
            () => this._orchestrator?.getNavigation() ?? null
        );
        this._lazyScreenRegistry = new AppLazyScreenRegistry({
            portFactory: lazyScreenPortFactory,
            profileSessionStore: this._profileSessionStore,
            containers: {
                authContainer: containerRefs.authContainer,
                profileSelectContainer: containerRefs.profileSelectContainer,
                serverSelectContainer: containerRefs.serverSelectContainer,
                audioSetupContainer: containerRefs.audioSetupContainer,
                channelSetupContainer: containerRefs.channelSetupContainer,
                settingsContainer: containerRefs.settingsContainer,
            },
            onAudioSetupComplete: (): void => {
                lazyScreenPortFactory.getNavigation()?.replaceScreen('channel-setup');
            },
        });
        const authoringPorts = new AppAuthoringPortFactory(
            () => this._orchestrator,
            {
                openStudio: (request): void => {
                    this._studioRequest = request;
                    this._studioEnteredFromDirectory = true;
                    this._orchestrator?.getNavigation()?.goTo('channel-studio');
                },
                openGenerate: (): void => {
                    this._channelSetupEnteredFromDirectory = true;
                    this._orchestrator?.getNavigation()?.goTo('channel-setup');
                },
                goBack: (): void => {
                    const navigation = this._orchestrator?.getNavigation();
                    if (this._directoryUseStack && navigation?.goBack()) return;
                    navigation?.replaceScreen('guide');
                },
                closeStudio: (focusChannelId): void => {
                    this._directoryPreferredId = focusChannelId ?? undefined;
                    const navigation = this._orchestrator?.getNavigation();
                    if (this._studioEnteredFromDirectory && navigation?.goBack()) return;
                    this._directoryUseStack = false;
                    navigation?.replaceScreen('channels');
                },
                openGuide: (): void => { this._orchestrator?.getNavigation()?.replaceScreen('guide'); },
            }
        );
        this._authoringRegistry = new AppAuthoringScreenRegistry({
            directoryContainer: containerRefs.channelDirectoryContainer,
            studioContainer: containerRefs.channelStudioContainer,
            createDirectoryPorts: (): ReturnType<AppAuthoringPortFactory['createDirectoryPorts']> =>
                authoringPorts.createDirectoryPorts(),
            createStudioPorts: (): ReturnType<AppAuthoringPortFactory['createStudioPorts']> =>
                authoringPorts.createStudioPorts(),
            getScopeKey: (): string => this._orchestrator?.getDirectoryScopeKey() ?? 'unavailable',
            onLoadError: (error): void => this._handleLazyScreenError(error),
        });
        this._screenVisibilityCoordinator = new AppScreenVisibilityCoordinator({
            getIsReady: (): boolean => this._orchestrator?.isReady() ?? false,
            getCurrentScreen: (): string | null => this._orchestrator?.getCurrentScreen() ?? null,
            getServerSelectParams: (): { allowAutoConnect: boolean } | null => (
                this._orchestrator?.getNavigation()?.getServerSelectParams() ?? null
            ),
            getSplashScreen: (): SplashScreen | null => this._splashScreen,
            getLazyScreenRegistry: (): AppLazyScreenRegistry | null => this._lazyScreenRegistry,
            getAuthoringScreenRegistry: (): AppAuthoringScreenRegistry | null => this._authoringRegistry,
            getStudioRequest: (): ChannelStudioRequest | null => this._studioRequest,
            getDirectoryPreferredId: (): string | undefined => this._directoryPreferredId,
            onSettingsShown: (): void => {
                if (this._settingsOpenedFromRecovery) this._lazyScreenRegistry?.getSettingsScreen()?.showSupport();
            },
            onLazyScreenError: (error: unknown): void => {
                this._handleLazyScreenError(error);
            },
        });
        this._screenVisibilityCoordinator.apply('splash');
    }

    private _wireScreenVisibility(): void {
        if (!this._orchestrator) {
            return;
        }
        const disposable = this._orchestrator.onScreenChange((from, to) => {
            if (to === 'channel-setup' && from !== 'channels') this._channelSetupEnteredFromDirectory = false;
            if (to === 'channels' && (from === 'guide' || from === 'settings')) {
                this._directoryUseStack = true;
                this._directoryPreferredId = undefined;
            }
            if (from === 'channel-studio' && to !== 'channel-studio') this._studioRequest = null;
            this._screenVisibilityCoordinator?.apply(to);
            if (from === 'settings' && to === 'splash' && this._settingsOpenedFromRecovery) {
                this._settingsOpenedFromRecovery = false;
                const projection = this._orchestrator?.getStartupRestoreProjection();
                if (projection?.phase === 'complete' && !projection.requiredComplete) {
                    this.showErrorOverlay({ code: AppErrorCode.INITIALIZATION_FAILED,
                        message: projection.reason ?? 'Lineup restore needs attention.',
                        userMessage: projection.reason ?? 'Lineup restore needs attention.',
                        recoverable: true, phase: 'error', timestamp: Date.now(), actions: [] });
                }
            }
        });
        this._screenUnsubscribe = (): void => disposable.dispose();

        this._restoreSubscription = this._orchestrator.subscribeToStartupRestoreProjection(projection => {
            this._splashScreen?.updateRestoreProjection(projection);
            if (projection.generation > this._recordedRestoreGeneration) {
                this._recordedRestoreGeneration = projection.generation;
                this._supportReport.record({ code: 'restore', at: Date.now(), outcome: 'started' });
            }
            if (projection.generation > this._recordedRestoreTerminalGeneration && projection.phase === 'complete') {
                this._recordedRestoreTerminalGeneration = projection.generation;
                this._supportReport.record({ code: 'restore', at: Date.now(),
                    outcome: projection.outcome === 'canceled' ? 'cancelled'
                        : projection.requiredComplete ? 'succeeded' : 'failed' });
            }
            if (projection.phase === 'complete' && projection.outcome === 'canceled'
                && this._restoreCancelDestination === 'recovery') {
                this._restoreCancelDestination = null;
                this.showErrorOverlay({ code: AppErrorCode.INITIALIZATION_FAILED,
                    message: 'Lineup restore was canceled.', userMessage: 'Lineup restore was canceled.',
                    recoverable: true, phase: 'error', timestamp: Date.now(), actions: [] });
            }
        });
        this._restoreKeySubscription = this._orchestrator.getNavigation()?.on('keyPress', event => {
            if (event.handled || event.button !== 'back'
                || this._orchestrator?.getCurrentScreen() !== 'splash'
                || !this._startupController) return;
            const projection = this._orchestrator.getStartupRestoreProjection();
            if (!projection || projection.phase === 'complete') return;
            event.handled = true;
            event.originalEvent.preventDefault();
            this._restoreCancelDestination = 'recovery';
            this._startupController.abort(new DOMException('Restore canceled by Back', 'AbortError'));
        }) ?? null;

        const phaseDisposable = this._orchestrator.onLifecycleEvent('phaseChange', ({ to }) => {
            if (to === 'ready') {
                this._screenVisibilityCoordinator?.syncCurrentScreen();
            }
        });
        this._phaseUnsubscribe = (): void => phaseDisposable.dispose();

        const current = this._orchestrator.getCurrentScreen();
        if (current) {
            this._screenVisibilityCoordinator?.apply(current);
        }
    }

    private async _runStartupPass(): Promise<void> {
        const orchestrator = this._orchestrator;
        if (!orchestrator) throw new Error('Startup runtime is unavailable.');
        const controller = new AbortController();
        this._startupController = controller;
        this._restoreCancelDestination = null;
        try {
            await orchestrator.start({ signal: controller.signal });
        } catch (error) {
            if (!controller.signal.aborted) throw error;
        } finally {
            if (this._startupController === controller) this._startupController = null;
        }
    }

    private _buildConfig(
        platformServices: PlatformServices = createWebOsPlatformServices()
    ): ReturnType<typeof createAppOrchestratorConfig> {
        return createAppOrchestratorConfig(platformServices);
    }

    showErrorOverlay(error: LifecycleAppError): void {
        if (!this._orchestrator) {
            return;
        }

        const quarantineState = this._orchestrator.getQuarantineState();
        if (quarantineState.kind === 'quarantined') {
            const actions: BlockingErrorOverlayAction[] = [
                {
                    id: 'retry',
                    label: 'Retry',
                    isPrimary: true,
                    action: async (): Promise<void> => {
                        const orchestrator = this._orchestrator;
                        if (!orchestrator) {
                            throw new Error('Recovery runtime is unavailable.');
                        }
                        const presentation = await orchestrator.retryQuarantineRecovery();
                        if (orchestrator.getQuarantineState().kind !== 'clear') {
                            throw new Error('Recovery did not clear quarantine.');
                        }
                        this._blockingErrorOverlayPresenter.hide();
                        if (presentation === 'server-select') {
                            orchestrator.openServerSelect();
                        }
                    },
                },
                {
                    id: 'exit',
                    label: 'Exit',
                    isPrimary: false,
                    action: (): Promise<void> => this._requireOrchestratorForQuarantine().exitQuarantine(),
                },
            ];
            this._blockingErrorOverlayPresenter.show(error, actions, {
                modalPolicy: QUARANTINE_MODAL_POLICY,
            });
            return;
        }

        const restore = this._orchestrator.getStartupRestoreProjection();
        if ((error.code === AppErrorCode.STORAGE_CORRUPTED || error.code === AppErrorCode.INITIALIZATION_FAILED)
            && restore?.phase === 'complete' && !restore.requiredComplete
            && restore.actions.length > 0) {
            const orchestrator = this._orchestrator;
            const actions: BlockingErrorOverlayAction[] = [];
            if (restore.actions.includes('retry')) actions.push({
                id: 'retry', label: 'Retry', isPrimary: true, action: async (): Promise<void> => {
                    this._blockingErrorOverlayPresenter.hide();
                    await this._runStartupPass();
                },
            });
            if (restore.actions.includes('switch-server')) actions.push({
                id: 'switch-server', label: 'Switch server', isPrimary: false, action: (): void => {
                    this._blockingErrorOverlayPresenter.hide();
                    orchestrator.openServerSelect();
                },
            });
            if (restore.actions.includes('switch-profile')) actions.push({
                id: 'switch-profile', label: 'Switch profile', isPrimary: false, action: (): void => {
                    this._blockingErrorOverlayPresenter.hide();
                    orchestrator.getNavigation()?.goTo('profile-select');
                },
            });
            if (restore.actions.includes('support')) actions.push({
                id: 'support', label: 'Support', isPrimary: false, action: (): void => {
                    this._blockingErrorOverlayPresenter.hide();
                    this._settingsOpenedFromRecovery = true;
                    orchestrator.getNavigation()?.goTo('settings');
                },
            });
            if (restore.actions.includes('rerun-setup')) actions.push({
                id: 'rerun-setup', label: 'Re-run setup', isPrimary: false,
                action: (): void => {
                    if (!orchestrator.getSelectedServerId()) {
                        throw new Error('A selected server is required before setup can reopen.');
                    }
                    this._blockingErrorOverlayPresenter.hide();
                    const result = orchestrator.requestChannelSetupRerun();
                    if (!result.ok) throw new Error('A selected server is required before setup can reopen.');
                },
            });
            this._blockingErrorOverlayPresenter.show(error, actions);
            return;
        }

        const recoveryCode = getAppErrorCode(error.code) ?? AppErrorCode.UNKNOWN;
        const actions: BlockingErrorOverlayAction[] = error.actions.length > 0
            ? error.actions
            : this._orchestrator.getRecoveryActions(recoveryCode);
        this._blockingErrorOverlayPresenter.show(error, actions);
    }

    private _requireOrchestratorForQuarantine(): AppShellOrchestratorRuntime {
        if (!this._orchestrator) {
            throw new Error('Recovery runtime is unavailable.');
        }
        return this._orchestrator;
    }

    hideErrorOverlay(options?: { fromModalClose?: boolean }): void {
        this._blockingErrorOverlayPresenter.hide(options);
    }

    private _showFatalError(error: unknown): void {
        const message = error instanceof Error ? error.message : String(error);
        const root = document.getElementById('app');
        if (root) {
            const container = document.createElement('div');
            container.className = 'fatal-error';

            const title = document.createElement('h1');
            title.textContent = 'Application Error';
            container.appendChild(title);

            // Error message (safe - uses textContent, not innerHTML)
            const errorPara = document.createElement('p');
            errorPara.textContent = message;
            container.appendChild(errorPara);

            // Instructions
            const instructPara = document.createElement('p');
            instructPara.textContent = 'Please refresh the page or restart the application.';
            container.appendChild(instructPara);

            root.replaceChildren(container);
        }
    }

    private _handleLazyScreenError(error: unknown): void {
        console.error('[App] Lazy screen load failed:', summarizeErrorForLog(error));

        if (!this._orchestrator) {
            this._showFatalError(error);
            return;
        }

        this.showErrorOverlay(
            this._orchestrator.toLifecycleAppError({
                code: AppErrorCode.MODULE_INIT_FAILED,
                message: 'Failed to load a deferred application screen.',
                recoverable: true,
                context: {
                    error: summarizeErrorForLog(error),
                },
            })
        );
    }

}
