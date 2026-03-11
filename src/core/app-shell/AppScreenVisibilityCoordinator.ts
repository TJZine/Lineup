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
    onLazyScreenError?: (error: unknown) => void;
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
    private readonly _onLazyScreenError: (error: unknown) => void;

    constructor(options: AppScreenVisibilityCoordinatorOptions) {
        this._getIsReady = options.getIsReady;
        this._getCurrentScreen = options.getCurrentScreen;
        this._getScreenParams = options.getScreenParams;
        this._getSplashScreen = options.getSplashScreen;
        this._getAuthScreen = options.getAuthScreen;
        this._getProfileSelectScreen = options.getProfileSelectScreen;
        this._getServerSelectScreen = options.getServerSelectScreen;
        this._getLazyScreenRegistry = options.getLazyScreenRegistry;
        this._onLazyScreenError = options.onLazyScreenError ?? (() : void => undefined);
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
            lazyRegistry?.cancelChannelSetupPrefetch();
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
            this._showLazyScreen(
                () => this._getLazyScreenRegistry()?.ensureAudioSetupScreen(),
                'audio-setup'
            );
        } else {
            lazyRegistry?.getAudioSetupScreen()?.hide();
        }

        if (showChannelSetup) {
            this._showLazyScreen(
                () => this._getLazyScreenRegistry()?.ensureChannelSetupScreen(),
                'channel-setup'
            );
        } else {
            lazyRegistry?.getChannelSetupScreen()?.hide();
        }

        if (showSettings) {
            this._showLazyScreen(
                () => this._getLazyScreenRegistry()?.ensureSettingsScreen(),
                'settings'
            );
        } else {
            lazyRegistry?.getSettingsScreen()?.hide();
        }
    }

    syncCurrentScreen(defaultScreen = 'player'): void {
        this.apply(this._getCurrentScreen() ?? defaultScreen);
    }

    private _showLazyScreen(
        ensureScreen: () => Promise<LazyVisibilityScreen | null> | null | undefined,
        expectedScreen: string
    ): void {
        const pendingScreen = ensureScreen();
        if (!pendingScreen) {
            return;
        }

        void pendingScreen
            .then((screen) => {
                if (!screen) return;
                if (this._getCurrentScreen() !== expectedScreen) return;
                screen.show();
            })
            .catch((error: unknown) => {
                this._onLazyScreenError(error);
            });
    }
}
