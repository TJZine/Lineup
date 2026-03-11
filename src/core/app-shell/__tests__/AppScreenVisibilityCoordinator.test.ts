/**
 * @jest-environment jsdom
 */

import { AppScreenVisibilityCoordinator } from '../AppScreenVisibilityCoordinator';

type Screen = {
    show: jest.Mock;
    hide: jest.Mock;
};

type MockRegistry = {
    getAudioSetupScreen: jest.Mock;
    getChannelSetupScreen: jest.Mock;
    getSettingsScreen: jest.Mock;
    scheduleSettingsPrefetch: jest.Mock;
    scheduleChannelSetupPrefetch: jest.Mock;
    cancelChannelSetupPrefetch: jest.Mock;
    ensureAudioSetupScreen: jest.Mock;
    ensureChannelSetupScreen: jest.Mock;
    ensureSettingsScreen: jest.Mock;
};

const createScreen = (): Screen => ({
    show: jest.fn(),
    hide: jest.fn(),
});

const createRegistry = (): MockRegistry => ({
    getAudioSetupScreen: jest.fn().mockReturnValue(null),
    getChannelSetupScreen: jest.fn().mockReturnValue(null),
    getSettingsScreen: jest.fn().mockReturnValue(null),
    scheduleSettingsPrefetch: jest.fn(),
    scheduleChannelSetupPrefetch: jest.fn(),
    cancelChannelSetupPrefetch: jest.fn(),
    ensureAudioSetupScreen: jest.fn().mockResolvedValue({ show: jest.fn() }),
    ensureChannelSetupScreen: jest.fn().mockResolvedValue({ show: jest.fn() }),
    ensureSettingsScreen: jest.fn().mockResolvedValue({ show: jest.fn() }),
});

describe('AppScreenVisibilityCoordinator', () => {
    let isReady = false;
    let currentScreen = 'player';
    let screenParams: Record<string, unknown> = {};

    let splashScreen: Screen;
    let authScreen: Screen;
    let profileSelectScreen: Screen;
    let serverSelectScreen: Screen;
    let registry: MockRegistry;

    const createCoordinator = (): AppScreenVisibilityCoordinator => new AppScreenVisibilityCoordinator({
        getIsReady: () => isReady,
        getCurrentScreen: () => currentScreen,
        getScreenParams: () => screenParams,
        getSplashScreen: () => splashScreen,
        getAuthScreen: () => authScreen,
        getProfileSelectScreen: () => profileSelectScreen,
        getServerSelectScreen: () => serverSelectScreen,
        getLazyScreenRegistry: () => registry as never,
    });

    beforeEach(() => {
        isReady = false;
        currentScreen = 'player';
        screenParams = {};

        splashScreen = createScreen();
        authScreen = createScreen();
        profileSelectScreen = createScreen();
        serverSelectScreen = createScreen();
        registry = createRegistry();
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
        expect(registry.scheduleSettingsPrefetch).toHaveBeenCalledTimes(1);
    });

    it('shows server-select with allowAutoConnect boolean and schedules channel prefetch', () => {
        screenParams = { allowAutoConnect: true };

        const coordinator = createCoordinator();
        coordinator.apply('server-select');

        expect(serverSelectScreen.show).toHaveBeenCalledWith({ allowAutoConnect: true });
        expect(registry.scheduleChannelSetupPrefetch).toHaveBeenCalledTimes(1);
        expect(registry.cancelChannelSetupPrefetch).not.toHaveBeenCalled();
    });

    it('shows server-select with undefined options when allowAutoConnect is missing or non-boolean', () => {
        const coordinator = createCoordinator();

        screenParams = {};
        coordinator.apply('server-select');
        expect(serverSelectScreen.show).toHaveBeenLastCalledWith(undefined);

        screenParams = { allowAutoConnect: 'yes' };
        coordinator.apply('server-select');
        expect(serverSelectScreen.show).toHaveBeenLastCalledWith(undefined);
    });

    it('cancels channel setup prefetch when leaving server-select', () => {
        const coordinator = createCoordinator();
        coordinator.apply('auth');

        expect(serverSelectScreen.hide).toHaveBeenCalledTimes(1);
        expect(registry.cancelChannelSetupPrefetch).toHaveBeenCalledTimes(1);
    });

    it('shows lazy-loaded screens only when current route still matches', async () => {
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

    it('syncs using current screen and player fallback', () => {
        const coordinator = createCoordinator();

        currentScreen = 'auth';
        coordinator.syncCurrentScreen();
        expect(authScreen.show).toHaveBeenCalledTimes(1);

        currentScreen = null as unknown as string;
        coordinator.syncCurrentScreen();
        expect(splashScreen.hide).toHaveBeenCalled();
    });
});
