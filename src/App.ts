/**
 * @fileoverview Application shell - creates root containers and initializes orchestrator.
 * @module App
 * @version 1.0.0
 */

import {
    AppOrchestrator,
    type OrchestratorConfig,
    AppErrorCode,
} from './Orchestrator';
import type { LifecycleAppError, AppPhase } from './modules/lifecycle/types';
import type { INavigationManager, NavigationConfig } from './modules/navigation';
import type { VideoPlayerConfig } from './modules/player';
import type { EPGConfig } from './modules/ui/epg';
import type { NowPlayingInfoConfig } from './modules/ui/now-playing-info';
import type { PlayerOsdConfig } from './modules/ui/player-osd';
import type { ChannelNumberOverlayConfig } from './modules/ui/channel-number-overlay';
import { CHANNEL_BADGE_CONTAINER_ID, type ChannelBadgeConfig } from './modules/ui/channel-badge';
import type { MiniGuideConfig } from './modules/ui/mini-guide';
import type { ChannelTransitionConfig } from './modules/ui/channel-transition';
import type { PlaybackOptionsConfig } from './modules/ui/playback-options';
import { createAppContainers, type AppContainerRefs } from './core/app-shell/AppContainerFactory';
import { AppLazyScreenRegistry } from './core/app-shell/AppLazyScreenRegistry';
import {
    AppBlockingErrorOverlayPresenter,
    type BlockingErrorOverlayAction,
} from './core/app-shell/AppBlockingErrorOverlayPresenter';
import { AppDiagnosticsSurface } from './core/app-shell/AppDiagnosticsSurface';
import { AppToastPresenter } from './core/app-shell/AppToastPresenter';
import type { PlexAuthConfig } from './modules/plex/auth';
import { AuthScreen } from './modules/ui/auth';
import { ProfileSelectScreen } from './modules/ui/profile-select';
import { ServerSelectScreen } from './modules/ui/server-select';
import { SplashScreen } from './modules/ui/splash';
import { ThemeManager } from './modules/ui/theme';
import { STORAGE_KEYS } from './types';
import {
    safeLocalStorageGet,
    safeLocalStorageSet,
} from './utils/storage';
import { summarizeErrorForLog } from './utils/errors';

// ============================================
// Configuration Defaults
// ============================================

const DEFAULT_PLEX_CONFIG: PlexAuthConfig = {
    clientIdentifier: '',
    product: 'Lineup',
    version: '1.0.0',
    platform: 'webOS',
    platformVersion: '6.0',
    device: 'LG Smart TV',
    deviceName: 'Living Room TV',
};

const DEFAULT_NAV_CONFIG: NavigationConfig = {
    enablePointerMode: false,
    keyRepeatDelayMs: 500,
    keyRepeatIntervalMs: 100,
    focusMemoryEnabled: true,
    debugMode: false,
};

const DEFAULT_PLAYER_CONFIG: VideoPlayerConfig = {
    containerId: 'video-container',
    defaultVolume: 1.0,
    bufferAheadMs: 30000,
    seekIncrementSec: 10,
    hideControlsAfterMs: 3000,
    retryAttempts: 3,
    retryDelayMs: 1000,
};

const DEFAULT_EPG_CONFIG: EPGConfig = {
    containerId: 'epg-container',
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
    containerId: 'now-playing-info-container',
    autoHideMs: 0,
};

const DEFAULT_PLAYER_OSD_CONFIG: PlayerOsdConfig = {
    containerId: 'player-osd-container',
};

const DEFAULT_CHANNEL_NUMBER_OVERLAY_CONFIG: ChannelNumberOverlayConfig = {
    containerId: 'channel-number-overlay-container',
    completeHideDelayMs: 650,
};

const DEFAULT_CHANNEL_BADGE_CONFIG: ChannelBadgeConfig = {
    containerId: CHANNEL_BADGE_CONTAINER_ID,
};

const DEFAULT_MINI_GUIDE_CONFIG: MiniGuideConfig = {
    containerId: 'mini-guide-container',
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
    containerId: 'channel-transition-container',
};

const DEFAULT_PLAYBACK_OPTIONS_CONFIG: PlaybackOptionsConfig = {
    containerId: 'playback-options-container',
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
    private readonly _blockingErrorOverlayPresenter = new AppBlockingErrorOverlayPresenter({
        getNavigation: (): INavigationManager | null => this._orchestrator?.getNavigation() ?? null,
        modalId: ERROR_OVERLAY_MODAL_ID,
    });
    private readonly _toastPresenter = new AppToastPresenter();
    private readonly _diagnosticsSurface = new AppDiagnosticsSurface({
        getOrchestrator: (): AppOrchestrator | null => this._orchestrator,
        showToast: (toast): void => this._toastPresenter.show(toast),
    });
    private _authScreen: AuthScreen | null = null;
    private _profileSelectScreen: ProfileSelectScreen | null = null;
    private _serverSelectScreen: ServerSelectScreen | null = null;
    private _lazyScreenRegistry: AppLazyScreenRegistry | null = null;
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
            this._showFatalError(error);
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
        this._authScreen?.destroy();
        this._authScreen = null;
        this._profileSelectScreen?.destroy();
        this._profileSelectScreen = null;
        this._serverSelectScreen?.destroy();
        this._serverSelectScreen = null;
        this._lazyScreenRegistry?.destroy();
        this._lazyScreenRegistry = null;
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
        this._splashScreen = new SplashScreen(containerRefs.splashContainer);
        this._authScreen = new AuthScreen(containerRefs.authContainer, this._orchestrator);
        this._profileSelectScreen = new ProfileSelectScreen(containerRefs.profileSelectContainer, this._orchestrator);
        this._serverSelectScreen = new ServerSelectScreen(
            containerRefs.serverSelectContainer,
            this._orchestrator
        );
        // Audio setup, Channel setup, and Settings remain lazy-loaded to
        // reduce initial JS parse/compile cost on webOS. The registry owns
        // all lazy-screen state, timers, and cleanup for those screens.
        this._lazyScreenRegistry = new AppLazyScreenRegistry({
            getOrchestrator: (): AppOrchestrator | null => this._orchestrator,
            containers: {
                audioSetupContainer: containerRefs.audioSetupContainer,
                channelSetupContainer: containerRefs.channelSetupContainer,
                settingsContainer: containerRefs.settingsContainer,
            },
            onAudioSetupComplete: (): void => {
                this._orchestrator?.getNavigation()?.replaceScreen('channel-setup');
            },
        });
    }

    private _wireScreenVisibility(): void {
        if (!this._orchestrator) {
            return;
        }
        const disposable = this._orchestrator.onScreenChange((_from, to) => {
            this._applyScreenVisibility(to);
        });
        this._screenUnsubscribe = (): void => disposable.dispose();

        const phaseDisposable = this._orchestrator.onLifecycleEvent('phaseChange', ({ to }) => {
            if (to === 'ready') {
                const current = this._orchestrator?.getCurrentScreen();
                this._applyScreenVisibility(current ?? 'player');
            }
        });
        this._phaseUnsubscribe = (): void => phaseDisposable.dispose();

        const current = this._orchestrator.getCurrentScreen();
        if (current) {
            this._applyScreenVisibility(current);
        }
    }

    private _applyScreenVisibility(screen: string): void {
        // Guard: If app is ready, hide setup screens unless navigating to them
        // Settings is handled separately below (it's an overlay, not a setup flow)
        if (
            this._orchestrator &&
            this._orchestrator.isReady() &&
            screen !== 'auth' &&
            screen !== 'profile-select' &&
            screen !== 'server-select' &&
            screen !== 'audio-setup' &&
            screen !== 'channel-setup' &&
            screen !== 'settings'
        ) {
            this._splashScreen?.hide();
            this._authScreen?.hide();
            this._profileSelectScreen?.hide();
            this._serverSelectScreen?.hide();
            this._lazyScreenRegistry?.getAudioSetupScreen()?.hide();
            this._lazyScreenRegistry?.getChannelSetupScreen()?.hide();
            this._lazyScreenRegistry?.getSettingsScreen()?.hide();
            this._lazyScreenRegistry?.scheduleSettingsPrefetch();
            return;
        }
        const showSplash = screen === 'splash';
        const showAuth = screen === 'auth';
        const showProfileSelect = screen === 'profile-select';
        const showServerSelect = screen === 'server-select';
        const showAudioSetup = screen === 'audio-setup';
        const showChannelSetup = screen === 'channel-setup';
        const showSettings = screen === 'settings';

        if (this._splashScreen) {
            if (showSplash) {
                this._splashScreen.show();
            } else {
                this._splashScreen.hide();
            }
        }

        if (this._authScreen) {
            if (showAuth) {
                this._authScreen.show();
            } else {
                this._authScreen.hide();
            }
        }

        if (this._profileSelectScreen) {
            if (showProfileSelect) {
                this._profileSelectScreen.show();
            } else {
                this._profileSelectScreen.hide();
            }
        }

        if (this._serverSelectScreen) {
            if (showServerSelect) {
                const params = this._orchestrator?.getNavigation()?.getScreenParams() ?? {};
                const allowAutoConnect = params.allowAutoConnect as boolean | undefined;
                const showOptions = typeof allowAutoConnect === 'boolean'
                    ? { allowAutoConnect }
                    : undefined;
                this._serverSelectScreen.show(showOptions);
                this._lazyScreenRegistry?.scheduleChannelSetupPrefetch();
            } else {
                this._serverSelectScreen.hide();
                this._lazyScreenRegistry?.cancelChannelSetupPrefetch();
            }
        }

        if (showAudioSetup) {
            void this._showAudioSetupScreen();
        } else {
            this._lazyScreenRegistry?.getAudioSetupScreen()?.hide();
        }

        if (showChannelSetup) {
            void this._showChannelSetupScreen();
        } else {
            this._lazyScreenRegistry?.getChannelSetupScreen()?.hide();
        }

        if (showSettings) {
            void this._showSettingsScreen();
        } else {
            this._lazyScreenRegistry?.getSettingsScreen()?.hide();
        }
    }

    private async _showChannelSetupScreen(): Promise<void> {
        const screen = await this._lazyScreenRegistry?.ensureChannelSetupScreen();
        if (!screen) return;
        if (this._orchestrator?.getCurrentScreen() !== 'channel-setup') return;
        screen.show();
    }

    private async _showAudioSetupScreen(): Promise<void> {
        const screen = await this._lazyScreenRegistry?.ensureAudioSetupScreen();
        if (!screen) return;
        if (this._orchestrator?.getCurrentScreen() !== 'audio-setup') return;
        screen.show();
    }

    private async _showSettingsScreen(): Promise<void> {
        const screen = await this._lazyScreenRegistry?.ensureSettingsScreen();
        if (!screen) return;
        if (this._orchestrator?.getCurrentScreen() !== 'settings') return;
        screen.show();
    }

    /**
     * Build orchestrator configuration.
     */
    private _buildConfig(): OrchestratorConfig {
        return {
            plexConfig: this._getPlexConfig(),
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
     * Get Plex configuration with client identifier.
     */
    private _getPlexConfig(): PlexAuthConfig {
        const config = { ...DEFAULT_PLEX_CONFIG };

        // Get or generate client identifier
        let clientId = safeLocalStorageGet(STORAGE_KEYS.CLIENT_ID) ?? '';
        const isSaneClientId = (value: string): boolean =>
            value.length > 0 && value.length <= 128 && /^[a-zA-Z0-9._-]+$/.test(value);
        if (!isSaneClientId(clientId)) {
            clientId = this._generateClientId();
            safeLocalStorageSet(STORAGE_KEYS.CLIENT_ID, clientId);
        }
        config.clientIdentifier = clientId;

        return config;
    }

    /**
     * Generate a unique client identifier.
     * Uses crypto.randomUUID if available, falls back to Math.random.
     */
    private _generateClientId(): string {
        // Prefer crypto.randomUUID() if available (Chromium 92+)
        // Note: Some webOS versions may not support this despite Chromium version
        if (
            typeof crypto !== 'undefined' &&
            typeof crypto.randomUUID === 'function'
        ) {
            try {
                return `lineup-${crypto.randomUUID()}`;
            } catch {
                // Fall through to Math.random fallback
            }
        }

        // Fallback to Math.random (adequate for non-security-sensitive client ID)
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = 'lineup-';
        for (let i = 0; i < 16; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
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
            // Clear existing content
            root.innerHTML = '';

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

            root.appendChild(container);
        }
    }

}
