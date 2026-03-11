interface VisibilityScreen {
    show: () => void;
    hide: () => void;
}

interface ServerSelectVisibilityScreen {
    show: (options?: ServerSelectShowOptions) => void;
    hide: () => void;
}

interface LazyVisibilityScreen {
    show: () => void;
    hide: () => void;
}

interface ScreenVisibilityLazyRegistry {
    getAudioSetupScreen: () => LazyVisibilityScreen | null;
    getChannelSetupScreen: () => LazyVisibilityScreen | null;
    getSettingsScreen: () => LazyVisibilityScreen | null;
    scheduleSettingsPrefetch: () => void;
    scheduleChannelSetupPrefetch: () => void;
    cancelChannelSetupPrefetch: () => void;
    ensureAudioSetupScreen: () => Promise<LazyVisibilityScreen | null>;
    ensureChannelSetupScreen: () => Promise<LazyVisibilityScreen | null>;
    ensureSettingsScreen: () => Promise<LazyVisibilityScreen | null>;
}

export interface ServerSelectShowOptions {
    allowAutoConnect: boolean;
}

export interface AppScreenVisibilityCoordinatorOptions {
    getIsReady: () => boolean;
    getCurrentScreen: () => string | null;
    getScreenParams: () => Record<string, unknown>;
    getSplashScreen: () => VisibilityScreen | null;
    getAuthScreen: () => VisibilityScreen | null;
    getProfileSelectScreen: () => VisibilityScreen | null;
    getServerSelectScreen: () => ServerSelectVisibilityScreen | null;
    getLazyScreenRegistry: () => ScreenVisibilityLazyRegistry | null;
}

export class AppScreenVisibilityCoordinator {
    private readonly _getIsReady: () => boolean;
    private readonly _getCurrentScreen: () => string | null;
    private readonly _getScreenParams: () => Record<string, unknown>;
    private readonly _getSplashScreen: () => VisibilityScreen | null;
    private readonly _getAuthScreen: () => VisibilityScreen | null;
    private readonly _getProfileSelectScreen: () => VisibilityScreen | null;
    private readonly _getServerSelectScreen: () => ServerSelectVisibilityScreen | null;
    private readonly _getLazyScreenRegistry: () => ScreenVisibilityLazyRegistry | null;

    constructor(options: AppScreenVisibilityCoordinatorOptions) {
        this._getIsReady = options.getIsReady;
        this._getCurrentScreen = options.getCurrentScreen;
        this._getScreenParams = options.getScreenParams;
        this._getSplashScreen = options.getSplashScreen;
        this._getAuthScreen = options.getAuthScreen;
        this._getProfileSelectScreen = options.getProfileSelectScreen;
        this._getServerSelectScreen = options.getServerSelectScreen;
        this._getLazyScreenRegistry = options.getLazyScreenRegistry;
    }

    apply(screen: string): void {
        const lazyRegistry = this._getLazyScreenRegistry();

        if (
            this._getIsReady() &&
            screen !== 'auth' &&
            screen !== 'profile-select' &&
            screen !== 'server-select' &&
            screen !== 'audio-setup' &&
            screen !== 'channel-setup' &&
            screen !== 'settings'
        ) {
            this._getSplashScreen()?.hide();
            this._getAuthScreen()?.hide();
            this._getProfileSelectScreen()?.hide();
            this._getServerSelectScreen()?.hide();
            lazyRegistry?.getAudioSetupScreen()?.hide();
            lazyRegistry?.getChannelSetupScreen()?.hide();
            lazyRegistry?.getSettingsScreen()?.hide();
            lazyRegistry?.scheduleSettingsPrefetch();
            return;
        }

        const showSplash = screen === 'splash';
        const showAuth = screen === 'auth';
        const showProfileSelect = screen === 'profile-select';
        const showServerSelect = screen === 'server-select';
        const showAudioSetup = screen === 'audio-setup';
        const showChannelSetup = screen === 'channel-setup';
        const showSettings = screen === 'settings';

        const splashScreen = this._getSplashScreen();
        if (splashScreen) {
            if (showSplash) {
                splashScreen.show();
            } else {
                splashScreen.hide();
            }
        }

        const authScreen = this._getAuthScreen();
        if (authScreen) {
            if (showAuth) {
                authScreen.show();
            } else {
                authScreen.hide();
            }
        }

        const profileSelectScreen = this._getProfileSelectScreen();
        if (profileSelectScreen) {
            if (showProfileSelect) {
                profileSelectScreen.show();
            } else {
                profileSelectScreen.hide();
            }
        }

        const serverSelectScreen = this._getServerSelectScreen();
        if (serverSelectScreen) {
            if (showServerSelect) {
                const params = this._getScreenParams();
                const allowAutoConnect = params.allowAutoConnect;
                const showOptions: ServerSelectShowOptions | undefined = typeof allowAutoConnect === 'boolean'
                    ? { allowAutoConnect }
                    : undefined;
                serverSelectScreen.show(showOptions);
                lazyRegistry?.scheduleChannelSetupPrefetch();
            } else {
                serverSelectScreen.hide();
                lazyRegistry?.cancelChannelSetupPrefetch();
            }
        }

        if (showAudioSetup) {
            void this._showAudioSetupScreen();
        } else {
            lazyRegistry?.getAudioSetupScreen()?.hide();
        }

        if (showChannelSetup) {
            void this._showChannelSetupScreen();
        } else {
            lazyRegistry?.getChannelSetupScreen()?.hide();
        }

        if (showSettings) {
            void this._showSettingsScreen();
        } else {
            lazyRegistry?.getSettingsScreen()?.hide();
        }
    }

    syncCurrentScreen(defaultScreen = 'player'): void {
        this.apply(this._getCurrentScreen() ?? defaultScreen);
    }

    private async _showAudioSetupScreen(): Promise<void> {
        const screen = await this._getLazyScreenRegistry()?.ensureAudioSetupScreen();
        if (!screen) return;
        if (this._getCurrentScreen() !== 'audio-setup') return;
        screen.show();
    }

    private async _showChannelSetupScreen(): Promise<void> {
        const screen = await this._getLazyScreenRegistry()?.ensureChannelSetupScreen();
        if (!screen) return;
        if (this._getCurrentScreen() !== 'channel-setup') return;
        screen.show();
    }

    private async _showSettingsScreen(): Promise<void> {
        const screen = await this._getLazyScreenRegistry()?.ensureSettingsScreen();
        if (!screen) return;
        if (this._getCurrentScreen() !== 'settings') return;
        screen.show();
    }
}
