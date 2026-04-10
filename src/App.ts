/** Application shell that creates root containers and initializes the orchestrator. */

import {
    AppOrchestrator,
    type OrchestratorConfig,
    AppErrorCode,
} from './Orchestrator';
import type { LifecycleAppError, AppPhase } from './modules/lifecycle/types';
import type { INavigationManager, NavigationConfig } from './modules/navigation';
import type { VideoPlayerConfig } from './modules/player';
import { EPG_CONTAINER_ID, type EPGConfig } from './modules/ui/epg';
import type { NowPlayingInfoConfig } from './modules/ui/now-playing-info';
import { APP_SHELL_CONTAINER_IDS } from './modules/ui/common/appShellContainerIds';
import { PLAYER_OSD_CONTAINER_ID, type PlayerOsdConfig } from './modules/ui/player-osd';
import { CHANNEL_NUMBER_OVERLAY_CONTAINER_ID, type ChannelNumberOverlayConfig } from './modules/ui/channel-number-overlay';
import { CHANNEL_BADGE_CONTAINER_ID, type ChannelBadgeConfig } from './modules/ui/channel-badge';
import { MINI_GUIDE_CONTAINER_ID, type MiniGuideConfig } from './modules/ui/mini-guide';
import { CHANNEL_TRANSITION_CONTAINER_ID, type ChannelTransitionConfig } from './modules/ui/channel-transition';
import type { PlaybackOptionsConfig } from './modules/ui/playback-options';
import { createAppContainers, type AppContainerRefs } from './core/app-shell/AppContainerFactory';
import {
    AppLazyScreenRegistry,
} from './core/app-shell/AppLazyScreenRegistry';
import { AppLazyScreenPortFactory } from './core/app-shell/AppLazyScreenPortFactory';
import { AppScreenVisibilityCoordinator } from './core/app-shell/AppScreenVisibilityCoordinator';
import {
    AppBlockingErrorOverlayPresenter,
    type BlockingErrorOverlayAction,
} from './core/app-shell/AppBlockingErrorOverlayPresenter';
import { AppDiagnosticsSurface } from './core/app-shell/AppDiagnosticsSurface';
import { AppToastPresenter } from './core/app-shell/AppToastPresenter';
import { DebugOverridesStore } from './modules/debug/DebugOverridesStore';
import { createDefaultPlexAuthConfig } from './modules/plex/auth';
import { SplashScreen } from './modules/ui/splash';
import { ThemeManager } from './modules/ui/theme';
import { ProfileSessionStore } from './modules/settings/ProfileSessionStore';
import type { ChannelSetupConfig } from './core/channel-setup/types';
import { summarizeErrorForLog } from './utils/errors';

// ============================================
// Configuration Defaults
// ============================================

const DEFAULT_NAV_CONFIG: NavigationConfig = {
    enablePointerMode: false,
    keyRepeatDelayMs: 500,
    keyRepeatIntervalMs: 100,
    focusMemoryEnabled: true,
    debugMode: false,
};

const DEFAULT_PLAYER_CONFIG: VideoPlayerConfig = {
    containerId: APP_SHELL_CONTAINER_IDS.VIDEO,
    defaultVolume: 1.0,
    bufferAheadMs: 30000,
    seekIncrementSec: 10,
    hideControlsAfterMs: 3000,
    retryAttempts: 3,
    retryDelayMs: 1000,
};

const DEFAULT_EPG_CONFIG: EPGConfig = {
    containerId: EPG_CONTAINER_ID,
    visibleChannels: 5,
    timeSlotMinutes: 30,
    visibleHours: 2,
    totalHours: 24,
    pixelsPerMinute: 4,
    rowHeight: 96,
    showCurrentTimeIndicator: true,
    autoScrollToNow: true,
};

const DEFAULT_NOW_PLAYING_INFO_CONFIG: NowPlayingInfoConfig = {
    containerId: APP_SHELL_CONTAINER_IDS.NOW_PLAYING_INFO,
    autoHideMs: 0,
};

const DEFAULT_PLAYER_OSD_CONFIG: PlayerOsdConfig = {
    containerId: PLAYER_OSD_CONTAINER_ID,
};

const DEFAULT_CHANNEL_NUMBER_OVERLAY_CONFIG: ChannelNumberOverlayConfig = {
    containerId: CHANNEL_NUMBER_OVERLAY_CONTAINER_ID,
    completeHideDelayMs: 650,
};

const DEFAULT_CHANNEL_BADGE_CONFIG: ChannelBadgeConfig = {
    containerId: CHANNEL_BADGE_CONTAINER_ID,
};

const DEFAULT_MINI_GUIDE_CONFIG: MiniGuideConfig = {
    containerId: MINI_GUIDE_CONTAINER_ID,
    autoHideMs: 8_000,
};

const NON_BLOCKING_TOAST_MESSAGES: Partial<Record<AppErrorCode, string>> = {
    [AppErrorCode.CHANNEL_NOT_FOUND]: 'That channel is unavailable.',
    [AppErrorCode.SCHEDULER_EMPTY_CHANNEL]: 'No scheduled content is available for that channel.',
    [AppErrorCode.CONTENT_UNAVAILABLE]: 'That content is unavailable right now.',
    [AppErrorCode.RESOURCE_NOT_FOUND]: 'Requested content could not be found.',
};

const NON_BLOCKING_LIFECYCLE_CODES = new Set<AppErrorCode>(
    Object.keys(NON_BLOCKING_TOAST_MESSAGES).map((k) => k as AppErrorCode)
);

const DEFAULT_CHANNEL_TRANSITION_CONFIG: ChannelTransitionConfig = {
    containerId: CHANNEL_TRANSITION_CONTAINER_ID,
};

const DEFAULT_PLAYBACK_OPTIONS_CONFIG: PlaybackOptionsConfig = {
    containerId: APP_SHELL_CONTAINER_IDS.PLAYBACK_OPTIONS,
};

const ERROR_OVERLAY_MODAL_ID = 'modal:error-overlay';

// ============================================
// App Class
// ============================================

/**
 * Application shell that creates containers and manages orchestrator.
 */
export class App {
    private _orchestrator: AppOrchestrator | null = null;
    private readonly _debugOverridesStore = new DebugOverridesStore();
    private readonly _profileSessionStore = new ProfileSessionStore();
    private readonly _blockingErrorOverlayPresenter = new AppBlockingErrorOverlayPresenter({
        getNavigation: (): INavigationManager | null => this._orchestrator?.getNavigation() ?? null,
        modalId: ERROR_OVERLAY_MODAL_ID,
    });
    private readonly _toastPresenter = new AppToastPresenter();
    private readonly _diagnosticsSurface = new AppDiagnosticsSurface({
        getDiagnosticsRuntime: (): AppOrchestrator | null => this._orchestrator,
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
    private _screenUnsubscribe: (() => void) | null = null;
    private _phaseUnsubscribe: (() => void) | null = null;

    /**
     * Initialize and start the application.
     */
    async start(): Promise<void> {
        try {
            ThemeManager.getInstance();

            // Create root containers
            const containerRefs = this._createContainers();

            // Build configuration
            const config = this._buildConfig();

            // Create and initialize orchestrator
            this._orchestrator = new AppOrchestrator();
            await this._orchestrator.initialize(config);

            // Initialize minimal auth/server screens before startup
            this._initializeScreens(containerRefs);
            this._wireScreenVisibility();

            // Wire up lifecycle error events before starting
            this._subscribeToLifecycleErrors();
            this._subscribeToLifecycleWarnings();
            this._orchestrator.setNowPlayingHandler((toast) => {
                this._toastPresenter.show(toast);
            });

            // Start the orchestrator
            await this._orchestrator.start();
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

    /**
     * Subscribe to lifecycle error events to display overlay.
     */
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
        return !NON_BLOCKING_LIFECYCLE_CODES.has(error.code as AppErrorCode);
    }

    private _getNonBlockingToastMessage(error: LifecycleAppError): string {
        const code = error.code as AppErrorCode;
        const mapped = NON_BLOCKING_TOAST_MESSAGES[code];
        if (typeof mapped === 'string' && mapped.length > 0) {
            return mapped;
        }
        return error.userMessage?.trim() || 'Something went wrong.';
    }

    /**
     * Subscribe to lifecycle warning events to display non-blocking toasts.
     */
    private _subscribeToLifecycleWarnings(): void {
        if (!this._orchestrator) return;

        this._orchestrator.onLifecycleEvent('persistenceWarning', () => {
            this._toastPresenter.show({ message: 'Some settings could not be saved.', type: 'warning' });
        });

        this._orchestrator.onLifecycleEvent('networkWarning', () => {
            this._toastPresenter.show({ message: 'Network connection looks unstable.', type: 'warning' });
        });
    }

    /**
     * Shutdown the application.
     */
    async shutdown(): Promise<void> {
        if (this._screenUnsubscribe) {
            this._screenUnsubscribe();
            this._screenUnsubscribe = null;
        }
        if (this._phaseUnsubscribe) {
            this._phaseUnsubscribe();
            this._phaseUnsubscribe = null;
        }

        this._blockingErrorOverlayPresenter.dispose();
        this._toastPresenter.dispose();

        this._splashScreen?.hide();
        this._splashScreen = null;
        this._lazyScreenRegistry?.destroy();
        this._lazyScreenRegistry = null;
        this._screenVisibilityCoordinator = null;
        this._diagnosticsSurface.dispose();
        const orchestrator = this._orchestrator;
        if (orchestrator) {
            this._orchestrator = null;
            orchestrator.setNowPlayingHandler(null);
            await orchestrator.shutdown();
        }
    }

    /**
     * Get the orchestrator instance.
     */
    getOrchestrator(): AppOrchestrator | null {
        return this._orchestrator;
    }

    // ============================================
    // Private Methods
    // ============================================

    /**
     * Create DOM containers for modules that need them.
     */
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

    private _initializeScreens(containerRefs: AppContainerRefs): void {
        if (!this._orchestrator) {
            return;
        }
        const lazyScreenPortFactory = new AppLazyScreenPortFactory({
            getNavigationRuntime: (): AppOrchestrator | null => this._orchestrator,
            getAuthRuntime: (): AppOrchestrator | null => this._orchestrator,
            getProfileRuntime: (): AppOrchestrator | null => this._orchestrator,
            getServerSelectionRuntime: (): AppOrchestrator | null => this._orchestrator,
            getChannelSetupRuntime: (): AppOrchestrator | null => this._orchestrator,
            getSettingsRuntime: (): AppOrchestrator | null => this._orchestrator,
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
            getScreenParams: (): Record<string, unknown> => (
                this._orchestrator?.getNavigation()?.getScreenParams() ?? {}
            ),
            getSplashScreen: (): SplashScreen | null => this._splashScreen,
            getLazyScreenRegistry: (): AppLazyScreenRegistry | null => this._lazyScreenRegistry,
            onLazyScreenError: (error: unknown): void => {
                this._handleLazyScreenError(error);
            },
        });
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

    /**
     * Build orchestrator configuration.
     */
    private _buildConfig(): OrchestratorConfig {
        return {
            plexConfig: createDefaultPlexAuthConfig(),
            navConfig: DEFAULT_NAV_CONFIG,
            playerConfig: DEFAULT_PLAYER_CONFIG,
            epgConfig: DEFAULT_EPG_CONFIG,
            nowPlayingInfoConfig: DEFAULT_NOW_PLAYING_INFO_CONFIG,
            playerOsdConfig: DEFAULT_PLAYER_OSD_CONFIG,
            channelNumberOverlayConfig: DEFAULT_CHANNEL_NUMBER_OVERLAY_CONFIG,
            channelBadgeConfig: DEFAULT_CHANNEL_BADGE_CONFIG,
            miniGuideConfig: DEFAULT_MINI_GUIDE_CONFIG,
            channelTransitionConfig: DEFAULT_CHANNEL_TRANSITION_CONFIG,
            playbackOptionsConfig: DEFAULT_PLAYBACK_OPTIONS_CONFIG,
        };
    }

    /**
     * Show error overlay with recovery actions.
     */
    showErrorOverlay(error: LifecycleAppError): void {
        if (!this._orchestrator) {
            return;
        }

        const actions: BlockingErrorOverlayAction[] =
            error.actions.length > 0
                ? error.actions
                : this._orchestrator.getRecoveryActions(error.code as AppErrorCode);
        this._blockingErrorOverlayPresenter.show(error, actions);
    }

    /**
     * Hide error overlay.
     */
    hideErrorOverlay(options?: { fromModalClose?: boolean }): void {
        this._blockingErrorOverlayPresenter.hide(options);
    }

    /**
     * Show fatal error when app cannot start.
     */
    private _showFatalError(error: unknown): void {
        const message = error instanceof Error ? error.message : String(error);
        const root = document.getElementById('app');
        if (root) {
            // Create container
            const container = document.createElement('div');
            container.className = 'fatal-error';

            // Title
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
