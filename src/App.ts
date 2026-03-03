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
import { createAppContainers } from './core/app-shell/AppContainerFactory';
import { AppLazyScreenRegistry } from './core/app-shell/AppLazyScreenRegistry';
import {
    AppBlockingErrorOverlayPresenter,
    type BlockingErrorOverlayAction,
} from './core/app-shell/AppBlockingErrorOverlayPresenter';
import { AppToastPresenter } from './core/app-shell/AppToastPresenter';
import type { PlexAuthConfig } from './modules/plex/auth';
import { AuthScreen } from './modules/ui/auth';
import { ProfileSelectScreen } from './modules/ui/profile-select';
import { ServerSelectScreen } from './modules/ui/server-select';
import { SplashScreen } from './modules/ui/splash';
import { ThemeManager } from './modules/ui/theme';
import type { ToastInput } from './modules/ui/toast/types';
import { STORAGE_KEYS } from './types';
import { LINEUP_STORAGE_KEYS } from './config/storageKeys';
import {
    readStoredBoolean,
    safeClearLineupStorage,
    safeLocalStorageGet,
    safeLocalStorageRemove,
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
        getNavigation: (): INavigationManager | null => this._getSafeNavigation(),
        modalId: ERROR_OVERLAY_MODAL_ID,
    });
    private readonly _toastPresenter = new AppToastPresenter();
    private _authContainer: HTMLElement | null = null;
    private _profileSelectContainer: HTMLElement | null = null;
    private _serverSelectContainer: HTMLElement | null = null;
    private _channelSetupContainer: HTMLElement | null = null;
    private _authScreen: AuthScreen | null = null;
    private _profileSelectScreen: ProfileSelectScreen | null = null;
    private _serverSelectScreen: ServerSelectScreen | null = null;
    private _lazyScreenRegistry: AppLazyScreenRegistry | null = null;
    private _audioSetupContainer: HTMLElement | null = null;
    private _settingsContainer: HTMLElement | null = null;

    private _splashContainer: HTMLElement | null = null;
    private _splashScreen: SplashScreen | null = null;
    private _devMenuContainer: HTMLElement | null = null;
    private _screenUnsubscribe: (() => void) | null = null;
    private _phaseUnsubscribe: (() => void) | null = null;
    private _globalKeydownHandler: ((e: KeyboardEvent) => void) | null = null;

    private _getSafeNavigation(): INavigationManager | null {
        return this._orchestrator?.getNavigation() ?? null;
    }

    /**
     * Initialize and start the application.
     */
    async start(): Promise<void> {
        try {
            ThemeManager.getInstance();

            // Create root containers
            this._createContainers();

            // Build configuration
            const config = this._buildConfig();

            // Create and initialize orchestrator
            this._orchestrator = new AppOrchestrator();
            await this._orchestrator.initialize(config);

            // Initialize minimal auth/server screens before startup
            this._initializeScreens();
            this._wireScreenVisibility();

            // Wire up lifecycle error events before starting
            this._subscribeToLifecycleErrors();
            this._subscribeToLifecycleWarnings();
            this._wireNowPlayingToasts();

            // Start the orchestrator
            await this._orchestrator.start();
        } catch (error) {
            console.error('App startup failed:', summarizeErrorForLog(error));
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
                this._showToast({
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
            this._showToast({ message: 'Some settings could not be saved.', type: 'warning' });
        });

        this._orchestrator.onLifecycleEvent('networkWarning', () => {
            this._showToast({ message: 'Network connection looks unstable.', type: 'warning' });
        });
    }

    private _wireNowPlayingToasts(): void {
        if (!this._orchestrator) return;
        this._orchestrator.setNowPlayingHandler((toast) => {
            this._showToast(toast);
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
        if (this._globalKeydownHandler) {
            document.removeEventListener('keydown', this._globalKeydownHandler);
            this._globalKeydownHandler = null;
        }

        this._blockingErrorOverlayPresenter.dispose();
        this._toastPresenter.dispose();

        this._authScreen?.destroy();
        this._authScreen = null;
        this._profileSelectScreen?.destroy();
        this._profileSelectScreen = null;
        this._serverSelectScreen?.destroy();
        this._serverSelectScreen = null;
        this._lazyScreenRegistry?.destroy();
        this._lazyScreenRegistry = null;
        try {
            delete (window as { lineup?: unknown }).lineup;
        } catch {
            // ignore
        }
        if (this._orchestrator) {
            this._orchestrator.setNowPlayingHandler(null);
            await this._orchestrator.shutdown();
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
    private _createContainers(): void {
        const root = document.getElementById('app');
        if (!root) {
            throw new Error('Root element #app not found');
        }

        const refs = createAppContainers(root);

        this._splashContainer = refs.splashContainer;
        this._authContainer = refs.authContainer;
        this._profileSelectContainer = refs.profileSelectContainer;
        this._serverSelectContainer = refs.serverSelectContainer;
        this._channelSetupContainer = refs.channelSetupContainer;
        this._audioSetupContainer = refs.audioSetupContainer;
        this._settingsContainer = refs.settingsContainer;
        this._blockingErrorOverlayPresenter.setContainer(refs.errorOverlay);
        this._devMenuContainer = refs.devMenuContainer;
        this._toastPresenter.setContainer(refs.toastContainer);

        // Global debug key handlers
        if (this._globalKeydownHandler) {
            document.removeEventListener('keydown', this._globalKeydownHandler);
        }
        this._globalKeydownHandler = (e: KeyboardEvent): void => {
            if (this._isDebugSurfaceEnabled() && e.code === 'KeyI') {
                this._orchestrator?.toggleServerSelect();
            }
            // Dev Menu: Ctrl+Shift+D
            if (this._isDebugSurfaceEnabled() && e.code === 'KeyD' && e.ctrlKey && e.shiftKey) {
                this._toggleDevMenu();
            }
        };
        document.addEventListener('keydown', this._globalKeydownHandler);

        // Expose global helper only when debug surface is enabled.
        if (this._isDebugSurfaceEnabled()) {
            (window as unknown as { lineup: { toggleDevMenu: () => void } }).lineup = {
                toggleDevMenu: (): void => this._toggleDevMenu(),
            };
        } else {
            try {
                delete (window as { lineup?: unknown }).lineup;
            } catch {
                // ignore
            }
        }

    }

    private _initializeScreens(): void {
        if (!this._orchestrator) {
            return;
        }
        if (this._splashContainer) {
            this._splashScreen = new SplashScreen(this._splashContainer);
        }
        if (
            !this._authContainer ||
            !this._profileSelectContainer ||
            !this._serverSelectContainer ||
            !this._channelSetupContainer
        ) {
            return;
        }
        this._authScreen = new AuthScreen(this._authContainer, this._orchestrator);
        this._profileSelectScreen = new ProfileSelectScreen(this._profileSelectContainer, this._orchestrator);
        this._serverSelectScreen = new ServerSelectScreen(
            this._serverSelectContainer,
            this._orchestrator
        );
        // Audio setup, Channel setup, and Settings remain lazy-loaded to
        // reduce initial JS parse/compile cost on webOS. The registry owns
        // all lazy-screen state, timers, and cleanup for those screens.
        this._lazyScreenRegistry = new AppLazyScreenRegistry({
            getOrchestrator: (): AppOrchestrator | null => this._orchestrator,
            containers: {
                audioSetupContainer: this._audioSetupContainer,
                channelSetupContainer: this._channelSetupContainer,
                settingsContainer: this._settingsContainer,
            },
            onAudioSetupComplete: (): void => this._onAudioSetupComplete(),
        });
    }

    private _onAudioSetupComplete(): void {
        // Navigate to channel-setup after audio setup
        if (this._orchestrator) {
            this._orchestrator.getNavigation()?.replaceScreen('channel-setup');
        }
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

    /**
     * Show a non-blocking toast message.
     */
    private _showToast(input: ToastInput): void {
        this._toastPresenter.show(input);
    }

    private async _copyToClipboard(text: string): Promise<boolean> {
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    private _toggleDevMenu(): void {
        if (!this._isDebugSurfaceEnabled()) return;
        if (!this._devMenuContainer) return;

        if (this._devMenuContainer.style.display === 'none') {
            this._renderDevMenu();
            this._devMenuContainer.style.display = 'block';
        } else {
            this._devMenuContainer.style.display = 'none';
        }
    }

    private _isDebugSurfaceEnabled(): boolean {
        if (__LINEUP_DEV_BUILD__) {
            return true;
        }
        return readStoredBoolean(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, false);
    }

    private _renderDevMenu(): void {
        if (!this._devMenuContainer) return;

        // Dev-only: keep all interpolations here strictly to controlled constants/flags.
        // Do NOT interpolate Plex/user-provided strings into innerHTML to avoid future XSS foot-guns.
        this._devMenuContainer.innerHTML = `
            <h2 style="margin-top:0;border-bottom:1px solid #444;padding-bottom:10px;">Dev Menu</h2>
            <div style="margin-bottom:15px;color:#aaa;font-size:13px;">
                Storage keys: <code id="dev-storage-key-channels"></code>, <code id="dev-storage-key-current"></code>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;">
                <details style="border:1px solid #333;border-radius:8px;padding:10px;">
                    <summary style="cursor:pointer;color:#ddd;">Plex Debug Overrides</summary>
                    <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
                        <label style="font-size:13px;color:#aaa;">
                            <input id="dev-directplay-audio-fallback" type="checkbox" /> Try Direct Play using fallback audio track (lineup_direct_play_audio_fallback=1)
                        </label>
                        <div style="margin-top:6px;font-size:12px;color:#888;">
                            Now Playing Stream Debug (overlay)
                        </div>
                        <label style="font-size:13px;color:#aaa;">
                            <input id="dev-nowplaying-stream-debug" type="checkbox" /> Show stream decision in Show Info overlay (lineup_now_playing_stream_debug=1)
                        </label>
                        <label style="font-size:13px;color:#aaa;">
                            <input id="dev-nowplaying-stream-debug-auto" type="checkbox" /> Auto-open Show Info on tune when debug is enabled (lineup_now_playing_stream_debug_auto_show=1)
                        </label>
                        <label style="font-size:13px;color:#aaa;">
                            Forced Client Profile Name
                            <select id="dev-transcode-profile-name" style="margin-left:8px;padding:6px;">
                                <option value="">(default)</option>
                                <option value="HTML TV App">HTML TV App</option>
                                <option value="Generic">Generic</option>
                            </select>
                        </label>
                        <div style="display:flex;gap:10px;margin-top:6px;">
                            <button id="dev-transcode-save" style="padding:8px;cursor:pointer;">Save Overrides</button>
                            <button id="dev-transcode-clear" style="padding:8px;cursor:pointer;background:#500;color:#fff;border:none;">Clear Overrides</button>
                        </div>
                        <div style="font-size:12px;color:#888;margin-top:6px;">
                            Forced profile affects only transcode URL generation. Tokens are never shown.
                        </div>
                    </div>
                </details>
                <details style="border:1px solid #333;border-radius:8px;padding:10px;">
                    <summary style="cursor:pointer;color:#ddd;">Playback Info (PMS Decision)</summary>
                    <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
                        <div style="display:flex;gap:10px;align-items:center;">
                            <button id="dev-playback-refresh" style="padding:8px;cursor:pointer;">Refresh</button>
                            <button id="dev-playback-copy-summary" style="padding:8px;cursor:pointer;">Copy Summary</button>
                            <button id="dev-playback-copy-raw" style="padding:8px;cursor:pointer;">Copy Raw</button>
                            <span style="font-size:12px;color:#888;">Tip: Ctrl+Shift+D (desktop) or run window.lineup.toggleDevMenu() in the console</span>
                        </div>
                        <pre id="dev-playback-info" style="margin:0;max-height:260px;overflow:auto;background:#111;border:1px solid #333;border-radius:6px;padding:10px;color:#ddd;font-size:12px;line-height:1.35;white-space:pre-wrap;"></pre>
                        <div style="font-size:12px;color:#888;">
                            Shows Lineup's local decision and (when transcoding) the server's universal transcode decision.
                        </div>
                    </div>
                </details>
                <button id="dev-reset-app" style="padding:10px;cursor:pointer;background:#500;color:#fff;border:none;">Reset Lineup Storage</button>
                <button id="dev-close" style="padding:10px;cursor:pointer;margin-top:10px;">Close</button>
            </div>
        `;
        const channelsKey = this._devMenuContainer.querySelector('#dev-storage-key-channels');
        if (channelsKey) {
            channelsKey.textContent = STORAGE_KEYS.CHANNELS_REAL;
        }
        const currentChannelKey = this._devMenuContainer.querySelector('#dev-storage-key-current');
        if (currentChannelKey) {
            currentChannelKey.textContent = STORAGE_KEYS.CURRENT_CHANNEL;
        }

        // Bind events
        this._devMenuContainer.querySelector('#dev-reset-app')?.addEventListener('click', () => {
            const ok = window.confirm('Reset Lineup storage (channels, overrides)?');
            if (!ok) return;
            safeClearLineupStorage();
            window.location.reload();
        });

        this._devMenuContainer.querySelector('#dev-close')?.addEventListener('click', () => {
            this._devMenuContainer!.style.display = 'none';
        });

        this._devMenuContainer.querySelector('#dev-playback-refresh')?.addEventListener('click', () => {
            void this._refreshDevPlaybackInfo();
        });
        void this._refreshDevPlaybackInfo();

        // Transcode override controls (real mode only)
        const read = (k: string): string => safeLocalStorageGet(k) ?? '';
        const clamp = (v: string): string => v.trim().slice(0, 128);
        const writeOrRemove = (k: string, v: string): void => {
            const value = clamp(v);
            if (value.length === 0) {
                safeLocalStorageRemove(k);
            } else {
                safeLocalStorageSet(k, value);
            }
        };

        const profileNameSelect = this._devMenuContainer.querySelector('#dev-transcode-profile-name') as HTMLSelectElement | null;
        if (profileNameSelect) {
            const storedProfileName = read(LINEUP_STORAGE_KEYS.TRANSCODE_PROFILE_NAME);
            const isSupportedStoredProfileName = Array.from(profileNameSelect.options).some(
                (option) => option.value === storedProfileName
            );
            if (storedProfileName.length > 0 && !isSupportedStoredProfileName) {
                safeLocalStorageRemove(LINEUP_STORAGE_KEYS.TRANSCODE_PROFILE_NAME);
                profileNameSelect.value = '';
            } else {
                profileNameSelect.value = storedProfileName;
            }
        }
        const directPlayAudioFallbackEl = this._devMenuContainer.querySelector('#dev-directplay-audio-fallback') as HTMLInputElement | null;
        if (directPlayAudioFallbackEl) {
            directPlayAudioFallbackEl.checked =
                read(LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK) === '1';
        }
        const nowPlayingStreamDebugEl = this._devMenuContainer.querySelector('#dev-nowplaying-stream-debug') as HTMLInputElement | null;
        if (nowPlayingStreamDebugEl) {
            nowPlayingStreamDebugEl.checked =
                read(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG) === '1';
        }
        const nowPlayingStreamDebugAutoEl = this._devMenuContainer.querySelector('#dev-nowplaying-stream-debug-auto') as HTMLInputElement | null;
        if (nowPlayingStreamDebugAutoEl) {
            nowPlayingStreamDebugAutoEl.checked =
                read(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG_AUTO_SHOW) === '1';
        }

        this._devMenuContainer.querySelector('#dev-transcode-save')?.addEventListener('click', () => {
            if (directPlayAudioFallbackEl) {
                safeLocalStorageSet(
                    LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK,
                    directPlayAudioFallbackEl.checked ? '1' : '0'
                );
            }
            if (nowPlayingStreamDebugEl) {
                safeLocalStorageSet(
                    LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG,
                    nowPlayingStreamDebugEl.checked ? '1' : '0'
                );
            }
            if (nowPlayingStreamDebugAutoEl) {
                safeLocalStorageSet(
                    LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG_AUTO_SHOW,
                    nowPlayingStreamDebugAutoEl.checked ? '1' : '0'
                );
            }
            if (profileNameSelect) {
                writeOrRemove(LINEUP_STORAGE_KEYS.TRANSCODE_PROFILE_NAME, profileNameSelect.value);
            }
            this._showToast({ message: 'Saved overrides', type: 'success' });
        });

        this._devMenuContainer.querySelector('#dev-transcode-clear')?.addEventListener('click', () => {
            const ok = window.confirm('Clear transcode overrides?');
            if (!ok) return;
            const keys = [
                LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK,
                LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG,
                LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG_AUTO_SHOW,
                LINEUP_STORAGE_KEYS.TRANSCODE_PROFILE_NAME,
            ] as const;
            for (const k of keys) safeLocalStorageRemove(k);
            this._showToast({ message: 'Cleared overrides', type: 'success' });
            // Re-render to reflect cleared state
            this._renderDevMenu();
        });

        this._devMenuContainer.querySelector('#dev-playback-copy-summary')?.addEventListener('click', async () => {
            const pre = this._devMenuContainer?.querySelector('#dev-playback-info') as HTMLPreElement | null;
            const text = pre?.dataset?.summary ?? '';
            if (!text) {
                this._showToast({ message: 'Nothing to copy (refresh first)', type: 'warning' });
                return;
            }
            const ok = await this._copyToClipboard(text);
            this._showToast({ message: ok ? 'Copied summary' : 'Copy not supported', type: ok ? 'success' : 'warning' });
        });

        this._devMenuContainer.querySelector('#dev-playback-copy-raw')?.addEventListener('click', async () => {
            const pre = this._devMenuContainer?.querySelector('#dev-playback-info') as HTMLPreElement | null;
            const text = pre?.dataset?.raw ?? '';
            if (!text) {
                this._showToast({ message: 'Nothing to copy (refresh first)', type: 'warning' });
                return;
            }
            const ok = await this._copyToClipboard(text);
            this._showToast({ message: ok ? 'Copied raw JSON' : 'Copy not supported', type: ok ? 'success' : 'warning' });
        });
    }

    private async _refreshDevPlaybackInfo(): Promise<void> {
        if (!this._devMenuContainer || !this._orchestrator) return;
        const pre = this._devMenuContainer.querySelector('#dev-playback-info') as HTMLPreElement | null;
        if (!pre) return;

        pre.textContent = 'Loading...';
        pre.dataset.summary = '';
        pre.dataset.raw = '';
        try {
            const snapshot = await this._orchestrator.refreshPlaybackInfoSnapshot();
            const fmtMs = (ms: number): string => {
                const totalSec = Math.max(0, Math.floor(ms / 1000));
                const h = Math.floor(totalSec / 3600);
                const m = Math.floor((totalSec % 3600) / 60);
                const s = totalSec % 60;
                if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                return `${m}:${String(s).padStart(2, '0')}`;
            };
            const fmtKbps = (kbps: number): string => {
                if (!Number.isFinite(kbps)) return 'unknown';
                if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mbps`;
                return `${kbps} kbps`;
            };

            const rawJson = JSON.stringify(snapshot, null, 2);

            const lines: string[] = [];
            lines.push('PLAYBACK INFO');
            lines.push('='.repeat(60));
            lines.push(`Channel: ${snapshot.channel ? `${snapshot.channel.number} ${snapshot.channel.name}` : '(none)'}`);
            lines.push(`Item:    ${snapshot.program ? snapshot.program.title : '(none)'}`);
            if (snapshot.program) {
                lines.push(`Time:    elapsed ${fmtMs(snapshot.program.elapsedMs)} / remaining ${fmtMs(snapshot.program.remainingMs)}`);
            }

            lines.push('');
            lines.push('DELIVERY (what the TV receives)');
            lines.push('-'.repeat(60));
            if (!snapshot.stream) {
                lines.push('(no stream decision yet)');
            } else {
                const s = snapshot.stream;
                lines.push(`Protocol: ${s.protocol.toUpperCase()}  MIME: ${s.mimeType}`);
                lines.push(`Lineup:    ${s.isDirectPlay ? 'DIRECT PLAY' : 'HLS SESSION REQUESTED (Plex decides copy vs transcode)'}`);
                lines.push(`Target:    ${s.container}  video=${s.videoCodec}  audio=${s.audioCodec}  ${s.width}x${s.height}  ${fmtKbps(s.bitrate)}`);
                lines.push(`Subtitles: ${s.subtitleDelivery}`);

                if (s.serverDecision) {
                    const sd = s.serverDecision;
                    const parts = [
                        sd.videoDecision ? `video=${sd.videoDecision}` : null,
                        sd.audioDecision ? `audio=${sd.audioDecision}` : null,
                        sd.subtitleDecision ? `subtitles=${sd.subtitleDecision}` : null,
                    ].filter(Boolean);
                    if (parts.length > 0) {
                        lines.push(`PMS:       ${parts.join(' ')}`);
                    }
                    if (sd.decisionText) {
                        lines.push(`PMS text:  ${sd.decisionText}`);
                    }
                } else if (!s.isDirectPlay) {
                    lines.push('PMS:       (decision not fetched; press Refresh again)');
                }

                if (s.directPlay && s.directPlay.reasons.length > 0) {
                    lines.push('');
                    lines.push(`Direct Play blocked by: ${s.directPlay.reasons.join(', ')}`);
                }

                lines.push('');
                lines.push('SOURCE (selected Plex media version)');
                lines.push('-'.repeat(60));
                if (s.source) {
                    lines.push(`Source: ${s.source.container}  video=${s.source.videoCodec}  audio=${s.source.audioCodec}  ${s.source.width}x${s.source.height}  ${fmtKbps(s.source.bitrate)}`);
                } else {
                    lines.push('(unknown)');
                }

                lines.push('');
                lines.push('TRACKS');
                lines.push('-'.repeat(60));
                lines.push(`Audio:    ${s.selectedAudio ? `${s.selectedAudio.codec ?? 'unknown'}${typeof s.selectedAudio.channels === 'number' ? ` ${s.selectedAudio.channels}ch` : ''}${s.selectedAudio.language ? ` (${s.selectedAudio.language})` : ''}` : '(none)'}`);
                lines.push(`Subtitle: ${s.selectedSubtitle ? `${s.selectedSubtitle.codec ?? 'unknown'}${s.selectedSubtitle.language ? ` (${s.selectedSubtitle.language})` : ''}` : '(none)'}`);
                if (s.audioFallback) {
                    lines.push(`Fallback: ${s.audioFallback.fromCodec} -> ${s.audioFallback.toCodec} (${s.audioFallback.reason})`);
                }

                if (s.transcodeRequest) {
                    lines.push('');
                    lines.push('REQUEST (Lineup -> PMS)');
                    lines.push('-'.repeat(60));
                    lines.push(`Session: ${s.transcodeRequest.sessionId}`);
                    lines.push(`Max BR:  ${fmtKbps(s.transcodeRequest.maxBitrate)}`);
                    lines.push(`AudioID: ${s.transcodeRequest.audioStreamId ?? '(none)'}`);
                }
            }

            lines.push('');
            lines.push('RAW');
            lines.push('-'.repeat(60));
            lines.push(rawJson);

            pre.textContent = lines.join('\n');
            const rawHeaderIdx = lines.findIndex((l) => l === 'RAW');
            const summary =
                rawHeaderIdx > 0 ? lines.slice(0, Math.max(0, rawHeaderIdx - 1)).join('\n') : pre.textContent;
            pre.dataset.summary = summary ?? '';
            pre.dataset.raw = rawJson;
        } catch (error) {
            pre.textContent = `Failed to load playback info: ${error instanceof Error ? error.message : String(error)}`;
            pre.dataset.summary = '';
            pre.dataset.raw = '';
        }
    }

}
