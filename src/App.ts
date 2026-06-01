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
    private _screenVisibilityCoordinator: AppScreenVisibilityCoordinator | null = null;
    private _splashScreen: SplashScreen | null = null;
    private _themeController: AppThemeController | null = null;
    private _screenUnsubscribe: (() => void) | null = null;
    private _phaseUnsubscribe: (() => void) | null = null;
    private _lifecycleWarningDisposables: IDisposable[] = [];

    constructor(options: AppOptions = {}) {
        this._runtimeEngineLoader = options.runtimeEngineLoader ?? createAppRuntimeEngineLoader();
    }

    async start(): Promise<void> {
        markStartupTiming(APP_START_START_MARK);
        try {
            this._themeController = new AppThemeController();
            this._themeController.initialize();

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
            await orchestrator.start();
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
                };
            },
        });
        this._splashScreen = new SplashScreen(containerRefs.splashContainer);
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
        this._screenVisibilityCoordinator = new AppScreenVisibilityCoordinator({
            getIsReady: (): boolean => this._orchestrator?.isReady() ?? false,
            getCurrentScreen: (): string | null => this._orchestrator?.getCurrentScreen() ?? null,
            getServerSelectParams: (): { allowAutoConnect: boolean } | null => (
                this._orchestrator?.getNavigation()?.getServerSelectParams() ?? null
            ),
            getSplashScreen: (): SplashScreen | null => this._splashScreen,
            getLazyScreenRegistry: (): AppLazyScreenRegistry | null => this._lazyScreenRegistry,
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
        const disposable = this._orchestrator.onScreenChange((_from, to) => {
            this._screenVisibilityCoordinator?.apply(to);
        });
        this._screenUnsubscribe = (): void => disposable.dispose();

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

    private _buildConfig(
        platformServices: PlatformServices = createWebOsPlatformServices()
    ): ReturnType<typeof createAppOrchestratorConfig> {
        return createAppOrchestratorConfig(platformServices);
    }

    showErrorOverlay(error: LifecycleAppError): void {
        if (!this._orchestrator) {
            return;
        }

        const recoveryCode = getAppErrorCode(error.code) ?? AppErrorCode.UNKNOWN;
        const actions: BlockingErrorOverlayAction[] =
            error.actions.length > 0
                ? error.actions
                : this._orchestrator.getRecoveryActions(recoveryCode);
        this._blockingErrorOverlayPresenter.show(error, actions);
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
