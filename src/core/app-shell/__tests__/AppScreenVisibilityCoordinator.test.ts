/**
 * @jest-environment jsdom
 */

import { AppScreenVisibilityCoordinator } from '../chrome/AppScreenVisibilityCoordinator';

type Screen = {
    show: jest.Mock;
    hide: jest.Mock;
};

type ServerSelectScreen = {
    show: jest.Mock;
    hide: jest.Mock;
};

type MockRegistry = {
    getAuthScreen: jest.Mock;
    getProfileSelectScreen: jest.Mock;
    getServerSelectScreen: jest.Mock;
    getAudioSetupScreen: jest.Mock;
    getChannelSetupScreen: jest.Mock;
    getSettingsScreen: jest.Mock;
    scheduleSettingsPrefetch: jest.Mock;
    scheduleChannelSetupPrefetch: jest.Mock;
    cancelChannelSetupPrefetch: jest.Mock;
    ensureAuthScreen: jest.Mock;
    ensureProfileSelectScreen: jest.Mock;
    ensureServerSelectScreen: jest.Mock;
    ensureAudioSetupScreen: jest.Mock;
    ensureChannelSetupScreen: jest.Mock;
    ensureSettingsScreen: jest.Mock;
};

const createScreen = (): Screen => ({
    show: jest.fn(),
    hide: jest.fn(),
});

const createServerSelectScreen = (): ServerSelectScreen => ({
    show: jest.fn(),
    hide: jest.fn(),
});

const createRegistry = (): MockRegistry => ({
    getAuthScreen: jest.fn().mockReturnValue(null),
    getProfileSelectScreen: jest.fn().mockReturnValue(null),
    getServerSelectScreen: jest.fn().mockReturnValue(null),
    getAudioSetupScreen: jest.fn().mockReturnValue(null),
    getChannelSetupScreen: jest.fn().mockReturnValue(null),
    getSettingsScreen: jest.fn().mockReturnValue(null),
    scheduleSettingsPrefetch: jest.fn(),
    scheduleChannelSetupPrefetch: jest.fn(),
    cancelChannelSetupPrefetch: jest.fn(),
    ensureAuthScreen: jest.fn().mockResolvedValue(null),
    ensureProfileSelectScreen: jest.fn().mockResolvedValue(null),
    ensureServerSelectScreen: jest.fn().mockResolvedValue(null),
    ensureAudioSetupScreen: jest.fn().mockResolvedValue({ show: jest.fn() }),
    ensureChannelSetupScreen: jest.fn().mockResolvedValue({ show: jest.fn() }),
    ensureSettingsScreen: jest.fn().mockResolvedValue({ show: jest.fn() }),
});

describe('AppScreenVisibilityCoordinator', () => {
    let isReady = false;
    let currentScreen = 'player';
    let serverSelectParams: { allowAutoConnect: boolean } | null = null;

    let splashScreen: Screen;
    let authScreen: Screen;
    let profileSelectScreen: Screen;
    let serverSelectScreen: ServerSelectScreen;
    let registry: MockRegistry;
    let lazyScreenErrorHandler: jest.Mock;

    const createCoordinator = (): AppScreenVisibilityCoordinator => new AppScreenVisibilityCoordinator({
        getIsReady: () => isReady,
        getCurrentScreen: () => currentScreen,
        getServerSelectParams: () => serverSelectParams,
        getSplashScreen: () => splashScreen,
        getLazyScreenRegistry: () => registry as never,
        onLazyScreenError: lazyScreenErrorHandler,
    });

    beforeEach(() => {
        isReady = false;
        currentScreen = 'player';
        serverSelectParams = null;

        splashScreen = createScreen();
        authScreen = createScreen();
        profileSelectScreen = createScreen();
        serverSelectScreen = createServerSelectScreen();
        registry = createRegistry();
        registry.getAuthScreen.mockReturnValue(authScreen);
        registry.getProfileSelectScreen.mockReturnValue(profileSelectScreen);
        registry.getServerSelectScreen.mockReturnValue(serverSelectScreen);
        lazyScreenErrorHandler = jest.fn();
    });

    it('hides setup/transient screens and schedules settings prefetch when ready for non-setup screen', () => {
        isReady = true;
        const audioSetupScreen = createScreen();
        const channelSetupScreen = createScreen();
        const settingsScreen = createScreen();
        registry.getAudioSetupScreen.mockReturnValue(audioSetupScreen);
        registry.getChannelSetupScreen.mockReturnValue(channelSetupScreen);
        registry.getSettingsScreen.mockReturnValue(settingsScreen);

        const coordinator = createCoordinator();
        coordinator.apply('player');

        expect(splashScreen.hide).toHaveBeenCalledTimes(1);
        expect(authScreen.hide).toHaveBeenCalledTimes(1);
        expect(profileSelectScreen.hide).toHaveBeenCalledTimes(1);
        expect(serverSelectScreen.hide).toHaveBeenCalledTimes(1);
        expect(audioSetupScreen.hide).toHaveBeenCalledTimes(1);
        expect(channelSetupScreen.hide).toHaveBeenCalledTimes(1);
        expect(settingsScreen.hide).toHaveBeenCalledTimes(1);
        expect(registry.cancelChannelSetupPrefetch).toHaveBeenCalledTimes(1);
        expect(registry.scheduleSettingsPrefetch).toHaveBeenCalledTimes(1);
    });

    it('shows existing server-select without re-showing splash and preserves allowAutoConnect forwarding', () => {
        currentScreen = 'server-select';
        serverSelectParams = { allowAutoConnect: true };
        registry.ensureServerSelectScreen.mockResolvedValue(serverSelectScreen);

        const coordinator = createCoordinator();
        coordinator.apply('server-select');

        expect(splashScreen.show).not.toHaveBeenCalled();
        expect(serverSelectScreen.show).toHaveBeenCalledWith({ allowAutoConnect: true });
        expect(registry.scheduleChannelSetupPrefetch).toHaveBeenCalledTimes(1);
        expect(splashScreen.hide).toHaveBeenCalledTimes(1);
    });

    it('keeps previous startup screen visible while replacement startup screen is loading', async () => {
        currentScreen = 'auth';
        registry.getAuthScreen.mockReturnValue(null);

        let resolveAuth!: (screen: Screen) => void;
        registry.ensureAuthScreen.mockReturnValue(
            new Promise((resolve) => {
                resolveAuth = resolve;
            })
        );

        const coordinator = createCoordinator();
        coordinator.apply('auth');

        expect(splashScreen.show).toHaveBeenCalledTimes(1);
        expect(serverSelectScreen.hide).not.toHaveBeenCalled();

        resolveAuth(authScreen);
        await Promise.resolve();

        expect(serverSelectScreen.hide).toHaveBeenCalledTimes(1);
        expect(profileSelectScreen.hide).toHaveBeenCalledTimes(1);
        expect(authScreen.show).toHaveBeenCalledTimes(1);
        expect(splashScreen.hide).toHaveBeenCalledTimes(1);
    });

    it('switches between already-instantiated startup screens without showing splash', () => {
        currentScreen = 'profile-select';
        registry.getProfileSelectScreen.mockReturnValue(profileSelectScreen);

        const coordinator = createCoordinator();
        coordinator.apply('profile-select');

        expect(splashScreen.show).not.toHaveBeenCalled();
        expect(authScreen.hide).toHaveBeenCalledTimes(1);
        expect(serverSelectScreen.hide).toHaveBeenCalledTimes(1);
        expect(profileSelectScreen.show).toHaveBeenCalledTimes(1);
        expect(splashScreen.hide).toHaveBeenCalledTimes(1);
    });

    it('preserves show ordering for cached startup transitions (hide previous before show next)', () => {
        currentScreen = 'auth';
        registry.getAuthScreen.mockReturnValue(authScreen);

        const coordinator = createCoordinator();
        coordinator.apply('auth');

        const hideServerOrder = serverSelectScreen.hide.mock.invocationCallOrder[0];
        const showAuthOrder = authScreen.show.mock.invocationCallOrder[0];
        if (hideServerOrder === undefined || showAuthOrder === undefined) {
            throw new Error('Expected both startup transition calls to be recorded');
        }
        expect(hideServerOrder).toBeLessThan(showAuthOrder);
    });

    it('does not show stale startup screen when route changes before async load resolves', async () => {
        currentScreen = 'profile-select';
        registry.getProfileSelectScreen.mockReturnValue(null);

        let resolveProfile!: (screen: Screen) => void;
        registry.ensureProfileSelectScreen.mockReturnValue(
            new Promise((resolve) => {
                resolveProfile = resolve;
            })
        );

        const coordinator = createCoordinator();
        coordinator.apply('profile-select');

        expect(splashScreen.show).toHaveBeenCalledTimes(1);

        currentScreen = 'player';
        resolveProfile(profileSelectScreen);
        await Promise.resolve();

        expect(profileSelectScreen.show).not.toHaveBeenCalled();
        expect(authScreen.hide).not.toHaveBeenCalled();
        expect(serverSelectScreen.hide).not.toHaveBeenCalled();
    });

    it('ignores an old startup success after an A to B to A route sequence', async () => {
        currentScreen = 'server-select';
        serverSelectParams = { allowAutoConnect: true };
        registry.getServerSelectScreen.mockReturnValue(null);

        let resolveOldServerSelect!: (screen: ServerSelectScreen) => void;
        let resolveCurrentServerSelect!: (screen: ServerSelectScreen) => void;
        registry.ensureServerSelectScreen
            .mockReturnValueOnce(new Promise((resolve) => {
                resolveOldServerSelect = resolve;
            }))
            .mockReturnValueOnce(new Promise((resolve) => {
                resolveCurrentServerSelect = resolve;
            }));

        const coordinator = createCoordinator();
        coordinator.apply('server-select');

        currentScreen = 'auth';
        coordinator.apply('auth');

        currentScreen = 'server-select';
        coordinator.apply('server-select');
        jest.clearAllMocks();

        resolveOldServerSelect(serverSelectScreen);
        await Promise.resolve();

        expect(serverSelectScreen.show).not.toHaveBeenCalled();
        expect(authScreen.hide).not.toHaveBeenCalled();
        expect(profileSelectScreen.hide).not.toHaveBeenCalled();
        expect(registry.scheduleChannelSetupPrefetch).not.toHaveBeenCalled();
        expect(splashScreen.hide).not.toHaveBeenCalled();

        resolveCurrentServerSelect(serverSelectScreen);
        await Promise.resolve();

        expect(authScreen.hide).toHaveBeenCalledTimes(1);
        expect(profileSelectScreen.hide).toHaveBeenCalledTimes(1);
        expect(serverSelectScreen.show).toHaveBeenCalledTimes(1);
        expect(serverSelectScreen.show).toHaveBeenCalledWith({ allowAutoConnect: true });
        expect(registry.scheduleChannelSetupPrefetch).toHaveBeenCalledTimes(1);
        expect(splashScreen.hide).toHaveBeenCalledTimes(1);
    });

    it('supersedes an old lazy success when the same route is applied again', async () => {
        currentScreen = 'settings';
        const oldSettingsScreen = createScreen();
        const currentSettingsScreen = createScreen();

        let resolveOldSettings!: (screen: Screen) => void;
        let resolveCurrentSettings!: (screen: Screen) => void;
        registry.ensureSettingsScreen
            .mockReturnValueOnce(new Promise((resolve) => {
                resolveOldSettings = resolve;
            }))
            .mockReturnValueOnce(new Promise((resolve) => {
                resolveCurrentSettings = resolve;
            }));

        const coordinator = createCoordinator();
        coordinator.apply('settings');
        coordinator.apply('settings');

        resolveOldSettings(oldSettingsScreen);
        await Promise.resolve();
        expect(oldSettingsScreen.show).not.toHaveBeenCalled();

        resolveCurrentSettings(currentSettingsScreen);
        await Promise.resolve();
        expect(currentSettingsScreen.show).toHaveBeenCalledTimes(1);
    });

    it('cancels channel setup prefetch when leaving server-select to a non-startup screen', () => {
        const coordinator = createCoordinator();
        coordinator.apply('settings');

        expect(serverSelectScreen.hide).toHaveBeenCalledTimes(1);
        expect(registry.cancelChannelSetupPrefetch).toHaveBeenCalledTimes(1);
    });

    it('forwards undefined server-select options when no typed server-select params are present', () => {
        currentScreen = 'server-select';
        const coordinator = createCoordinator();

        serverSelectParams = null;
        coordinator.apply('server-select');
        expect(serverSelectScreen.show).toHaveBeenLastCalledWith(undefined);
    });

    it('shows lazy-loaded setup screens only when current route still matches', async () => {
        const channelSetupShow = jest.fn();
        const settingsShow = jest.fn();
        const audioShow = jest.fn();
        registry.ensureChannelSetupScreen.mockResolvedValue({ show: channelSetupShow });
        registry.ensureSettingsScreen.mockResolvedValue({ show: settingsShow });
        registry.ensureAudioSetupScreen.mockResolvedValue({ show: audioShow });

        const coordinator = createCoordinator();

        currentScreen = 'channel-setup';
        coordinator.apply('channel-setup');
        await Promise.resolve();

        currentScreen = 'player';
        coordinator.apply('settings');
        await Promise.resolve();

        currentScreen = 'audio-setup';
        coordinator.apply('audio-setup');
        await Promise.resolve();

        expect(channelSetupShow).toHaveBeenCalledTimes(1);
        expect(settingsShow).not.toHaveBeenCalled();
        expect(audioShow).toHaveBeenCalledTimes(1);
    });

    it('routes deferred startup-screen load failures through the app-shell error callback', async () => {
        currentScreen = 'auth';
        registry.getAuthScreen.mockReturnValue(null);

        const lazyError = new Error('chunk load failed');
        registry.ensureAuthScreen.mockRejectedValue(lazyError);

        const coordinator = createCoordinator();
        coordinator.apply('auth');
        await Promise.resolve();
        await Promise.resolve();

        expect(lazyScreenErrorHandler).toHaveBeenCalledTimes(1);
        expect(lazyScreenErrorHandler).toHaveBeenCalledWith(lazyError);
        expect(splashScreen.hide).not.toHaveBeenCalled();
    });

    it('ignores deferred startup-screen load failures after the route changes', async () => {
        currentScreen = 'auth';
        registry.getAuthScreen.mockReturnValue(null);

        let rejectAuth!: (error: unknown) => void;
        registry.ensureAuthScreen.mockReturnValue(
            new Promise((_resolve, reject) => {
                rejectAuth = reject;
            })
        );

        const coordinator = createCoordinator();
        coordinator.apply('auth');

        currentScreen = 'player';
        rejectAuth(new Error('stale chunk load failure'));
        await Promise.resolve();
        await Promise.resolve();

        expect(lazyScreenErrorHandler).not.toHaveBeenCalled();
    });

    it('ignores an old lazy failure but reports the current failure after an A to B to A route sequence', async () => {
        currentScreen = 'settings';

        let rejectOldSettings!: (error: unknown) => void;
        let rejectCurrentSettings!: (error: unknown) => void;
        registry.ensureSettingsScreen
            .mockReturnValueOnce(new Promise((_resolve, reject) => {
                rejectOldSettings = reject;
            }))
            .mockReturnValueOnce(new Promise((_resolve, reject) => {
                rejectCurrentSettings = reject;
            }));

        const coordinator = createCoordinator();
        coordinator.apply('settings');

        currentScreen = 'player';
        coordinator.apply('player');

        currentScreen = 'settings';
        coordinator.apply('settings');

        const oldError = new Error('old settings chunk load failed');
        rejectOldSettings(oldError);
        await Promise.resolve();
        await Promise.resolve();
        expect(lazyScreenErrorHandler).not.toHaveBeenCalled();

        const currentError = new Error('current settings chunk load failed');
        rejectCurrentSettings(currentError);
        await Promise.resolve();
        await Promise.resolve();
        expect(lazyScreenErrorHandler).toHaveBeenCalledTimes(1);
        expect(lazyScreenErrorHandler).toHaveBeenCalledWith(currentError);
    });

    it.each(['channel-setup', 'settings'])(
        'ignores %s lazy-screen load failures after the route changes',
        async (screen) => {
            currentScreen = screen;

            let rejectScreen!: (error: unknown) => void;
            const pendingScreen = new Promise<Screen>((_resolve, reject) => {
                rejectScreen = reject;
            });
            if (screen === 'channel-setup') {
                registry.ensureChannelSetupScreen.mockReturnValue(pendingScreen);
            } else {
                registry.ensureSettingsScreen.mockReturnValue(pendingScreen);
            }

            const coordinator = createCoordinator();
            coordinator.apply(screen);

            currentScreen = 'player';
            rejectScreen(new Error('stale chunk load failure'));
            await Promise.resolve();
            await Promise.resolve();

            expect(lazyScreenErrorHandler).not.toHaveBeenCalled();
        }
    );

    it('routes current lazy-screen load failures through the app-shell error callback once', async () => {
        currentScreen = 'settings';
        const lazyError = new Error('settings chunk load failed');
        registry.ensureSettingsScreen.mockRejectedValue(lazyError);

        const coordinator = createCoordinator();
        coordinator.apply('settings');
        await Promise.resolve();
        await Promise.resolve();

        expect(lazyScreenErrorHandler).toHaveBeenCalledTimes(1);
        expect(lazyScreenErrorHandler).toHaveBeenCalledWith(lazyError);
    });

    it('syncs using current screen and player fallback', () => {
        currentScreen = 'auth';
        const coordinator = createCoordinator();

        coordinator.syncCurrentScreen();
        expect(authScreen.show).toHaveBeenCalledTimes(1);

        currentScreen = null as unknown as string;
        coordinator.syncCurrentScreen();
        expect(splashScreen.hide).toHaveBeenCalled();
    });
});
