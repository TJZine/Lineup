import type { ServerSelectNavigationParams } from '../../../modules/navigation';

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
    getAuthScreen: () => LazyVisibilityScreen | null;
    getProfileSelectScreen: () => LazyVisibilityScreen | null;
    getServerSelectScreen: () => ServerSelectVisibilityScreen | null;
    getAudioSetupScreen: () => LazyVisibilityScreen | null;
    getChannelSetupScreen: () => LazyVisibilityScreen | null;
    getSettingsScreen: () => LazyVisibilityScreen | null;
    scheduleSettingsPrefetch: () => void;
    scheduleChannelSetupPrefetch: () => void;
    cancelChannelSetupPrefetch: () => void;
    ensureAuthScreen: () => Promise<LazyVisibilityScreen | null>;
    ensureProfileSelectScreen: () => Promise<LazyVisibilityScreen | null>;
    ensureServerSelectScreen: () => Promise<ServerSelectVisibilityScreen | null>;
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
    getServerSelectParams: () => ServerSelectNavigationParams | null;
    getSplashScreen: () => VisibilityScreen | null;
    getLazyScreenRegistry: () => ScreenVisibilityLazyRegistry | null;
    onLazyScreenError?: (error: unknown) => void;
}

export class AppScreenVisibilityCoordinator {
    private _presentationGeneration = 0;
    private readonly _getIsReady: () => boolean;
    private readonly _getCurrentScreen: () => string | null;
    private readonly _getServerSelectParams: () => ServerSelectNavigationParams | null;
    private readonly _getSplashScreen: () => VisibilityScreen | null;
    private readonly _getLazyScreenRegistry: () => ScreenVisibilityLazyRegistry | null;
    private readonly _onLazyScreenError: (error: unknown) => void;

    constructor(options: AppScreenVisibilityCoordinatorOptions) {
        this._getIsReady = options.getIsReady;
        this._getCurrentScreen = options.getCurrentScreen;
        this._getServerSelectParams = options.getServerSelectParams;
        this._getSplashScreen = options.getSplashScreen;
        this._getLazyScreenRegistry = options.getLazyScreenRegistry;
        this._onLazyScreenError = options.onLazyScreenError ?? (() : void => undefined);
    }

    apply(screen: string): void {
        const presentationGeneration = ++this._presentationGeneration;
        const lazyRegistry = this._getLazyScreenRegistry();
        const isAuthScreen = screen === 'auth';
        const isProfileSelectScreen = screen === 'profile-select';
        const isServerSelectScreen = screen === 'server-select';
        const isStartupScreen = isAuthScreen || isProfileSelectScreen || isServerSelectScreen;

        if (
            this._getIsReady() &&
            !isStartupScreen &&
            screen !== 'audio-setup' &&
            screen !== 'channel-setup' &&
            screen !== 'settings'
        ) {
            this._getSplashScreen()?.hide();
            lazyRegistry?.getAuthScreen()?.hide();
            lazyRegistry?.getProfileSelectScreen()?.hide();
            lazyRegistry?.getServerSelectScreen()?.hide();
            lazyRegistry?.getAudioSetupScreen()?.hide();
            lazyRegistry?.getChannelSetupScreen()?.hide();
            lazyRegistry?.getSettingsScreen()?.hide();
            lazyRegistry?.cancelChannelSetupPrefetch();
            lazyRegistry?.scheduleSettingsPrefetch();
            return;
        }

        const showSplash = screen === 'splash';
        const showAudioSetup = screen === 'audio-setup';
        const showChannelSetup = screen === 'channel-setup';
        const showSettings = screen === 'settings';

        const splashScreen = this._getSplashScreen();
        if (splashScreen) {
            if (showSplash) {
                splashScreen.show();
            } else if (!isStartupScreen) {
                splashScreen.hide();
            }
        }

        if (isAuthScreen && lazyRegistry) {
            this._showDeferredStartupScreen(
                () => lazyRegistry.getAuthScreen(),
                () => lazyRegistry.ensureAuthScreen(),
                'auth',
                (startupScreen) => startupScreen.show(),
                presentationGeneration
            );
        }

        if (isProfileSelectScreen && lazyRegistry) {
            this._showDeferredStartupScreen(
                () => lazyRegistry.getProfileSelectScreen(),
                () => lazyRegistry.ensureProfileSelectScreen(),
                'profile-select',
                (startupScreen) => startupScreen.show(),
                presentationGeneration
            );
        }

        if (isServerSelectScreen && lazyRegistry) {
            const showOptions = this._getServerSelectParams() ?? undefined;

            this._showDeferredStartupScreen(
                () => lazyRegistry.getServerSelectScreen(),
                () => lazyRegistry.ensureServerSelectScreen(),
                'server-select',
                (startupScreen) => {
                    startupScreen.show(showOptions);
                    lazyRegistry.scheduleChannelSetupPrefetch();
                },
                presentationGeneration
            );
        }

        if (!isStartupScreen) {
            lazyRegistry?.getAuthScreen()?.hide();
            lazyRegistry?.getProfileSelectScreen()?.hide();
            lazyRegistry?.getServerSelectScreen()?.hide();
            lazyRegistry?.cancelChannelSetupPrefetch();
        }

        if (showAudioSetup) {
            this._showLazyScreen(
                () => this._getLazyScreenRegistry()?.ensureAudioSetupScreen(),
                'audio-setup',
                presentationGeneration
            );
        } else {
            lazyRegistry?.getAudioSetupScreen()?.hide();
        }

        if (showChannelSetup) {
            this._showLazyScreen(
                () => this._getLazyScreenRegistry()?.ensureChannelSetupScreen(),
                'channel-setup',
                presentationGeneration
            );
        } else {
            lazyRegistry?.getChannelSetupScreen()?.hide();
        }

        if (showSettings) {
            this._showLazyScreen(
                () => this._getLazyScreenRegistry()?.ensureSettingsScreen(),
                'settings',
                presentationGeneration
            );
        } else {
            lazyRegistry?.getSettingsScreen()?.hide();
        }
    }

    syncCurrentScreen(defaultScreen = 'player'): void {
        this.apply(this._getCurrentScreen() ?? defaultScreen);
    }

    private _hideInactiveStartupScreens(activeScreen: 'auth' | 'profile-select' | 'server-select'): void {
        const registry = this._getLazyScreenRegistry();
        if (!registry) return;

        if (activeScreen !== 'auth') {
            registry.getAuthScreen()?.hide();
        }
        if (activeScreen !== 'profile-select') {
            registry.getProfileSelectScreen()?.hide();
        }
        if (activeScreen !== 'server-select') {
            registry.getServerSelectScreen()?.hide();
            registry.cancelChannelSetupPrefetch();
        }
    }

    private _showDeferredStartupScreen(
        getScreen: () => LazyVisibilityScreen | ServerSelectVisibilityScreen | null,
        ensureScreen: () => Promise<LazyVisibilityScreen | ServerSelectVisibilityScreen | null> | null | undefined,
        expectedScreen: 'auth' | 'profile-select' | 'server-select',
        onShow: ((screen: LazyVisibilityScreen | ServerSelectVisibilityScreen) => void) | undefined,
        presentationGeneration: number
    ): void {
        const existingScreen = getScreen();
        if (existingScreen) {
            if (!this._isCurrentPresentation(expectedScreen, presentationGeneration)) return;
            this._hideInactiveStartupScreens(expectedScreen);
            if (onShow) {
                onShow(existingScreen);
            } else {
                existingScreen.show();
            }
            this._getSplashScreen()?.hide();
            return;
        }

        this._getSplashScreen()?.show();
        const pendingScreen = ensureScreen();
        if (!pendingScreen) return;

        pendingScreen
            .then((startupScreen) => {
                if (!startupScreen) return;
                if (!this._isCurrentPresentation(expectedScreen, presentationGeneration)) return;
                this._hideInactiveStartupScreens(expectedScreen);
                if (onShow) {
                    onShow(startupScreen);
                } else {
                    startupScreen.show();
                }
                this._getSplashScreen()?.hide();
            })
            .catch((error: unknown) => {
                if (!this._isCurrentPresentation(expectedScreen, presentationGeneration)) return;
                this._onLazyScreenError(error);
            });
    }

    private _showLazyScreen(
        ensureScreen: () => Promise<LazyVisibilityScreen | null> | null | undefined,
        expectedScreen: string,
        presentationGeneration: number
    ): void {
        const pendingScreen = ensureScreen();
        if (!pendingScreen) {
            return;
        }

        pendingScreen
            .then((screenInstance) => {
                if (!screenInstance) return;
                if (!this._isCurrentPresentation(expectedScreen, presentationGeneration)) return;
                screenInstance.show();
            })
            .catch((error: unknown) => {
                if (!this._isCurrentPresentation(expectedScreen, presentationGeneration)) return;
                this._onLazyScreenError(error);
            });
    }

    private _isCurrentPresentation(expectedScreen: string, presentationGeneration: number): boolean {
        return (
            presentationGeneration === this._presentationGeneration &&
            this._getCurrentScreen() === expectedScreen
        );
    }
}
