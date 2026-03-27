/**
 * @jest-environment jsdom
 */

import type { AppOrchestrator } from '../../../Orchestrator';
import { ProfileSessionStore } from '../../../modules/settings/ProfileSessionStore';
import { SettingsStore } from '../../../modules/ui/settings/SettingsStore';
import { AppLazyScreenRegistry } from '../AppLazyScreenRegistry';
import { CHANNEL_SETUP_PREFETCH_DELAY_MS, SETTINGS_PREFETCH_DELAY_MS } from '../constants';

type MockScreen = {
    show: jest.Mock;
    hide: jest.Mock;
    destroy: jest.Mock;
};

const makeScreen = (): MockScreen => ({
    show: jest.fn(),
    hide: jest.fn(),
    destroy: jest.fn(),
});

const makeOrchestrator = (): AppOrchestrator => ({
    getNavigation: jest.fn().mockReturnValue(null),
    getChannelSetupSessionGateway: jest.fn(() => ({
        getNavigation: jest.fn().mockReturnValue(null),
        getSelectedServerStorageKey: jest.fn().mockReturnValue('selected-server-id'),
        getServerHealthStorageKey: jest.fn().mockReturnValue('server-health'),
        getSelectedServerId: jest.fn().mockReturnValue(null),
        openServerSelect: jest.fn(),
        switchToChannelByNumber: jest.fn().mockResolvedValue(undefined),
        openEPG: jest.fn(),
        requestChannelSetupRerun: jest.fn(),
        getLibrariesForSetup: jest.fn().mockResolvedValue([]),
        getChannelSetupRecord: jest.fn().mockReturnValue(null),
        getSetupContextForSelectedServer: jest.fn().mockReturnValue('unknown'),
        getSetupPreview: jest.fn().mockResolvedValue({
            estimates: {
                total: 0,
                collections: 0,
                playlists: 0,
                genres: 0,
                directors: 0,
                decades: 0,
                recentlyAdded: 0,
                studios: 0,
                actors: 0,
            },
            warnings: [],
            reachedMaxChannels: false,
        }),
        getSetupReview: jest.fn().mockResolvedValue({
            preview: {
                estimates: {
                    total: 0,
                    collections: 0,
                    playlists: 0,
                    genres: 0,
                    directors: 0,
                    decades: 0,
                    recentlyAdded: 0,
                    studios: 0,
                    actors: 0,
                },
                warnings: [],
                reachedMaxChannels: false,
            },
            diff: {
                summary: { created: 0, removed: 0, unchanged: 0 },
                samples: { created: [], removed: [], unchanged: [] },
            },
        }),
        createChannelsFromSetup: jest.fn().mockResolvedValue({
            created: 0,
            skipped: 0,
            reachedMaxChannels: false,
            errorCount: 0,
            canceled: false,
            lastTask: 'done',
        }),
        markSetupComplete: jest.fn(),
    })),
    setSubtitleTrack: jest.fn(),
    onGuideSettingChange: jest.fn(),
    getActiveUsername: jest.fn().mockReturnValue('UnitTestUser'),
} as never);

const flushMicrotasks = async (): Promise<void> => {
    await Promise.resolve();
};

describe('AppLazyScreenRegistry', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('returns null when required dependencies are missing', async () => {
        const registry = new AppLazyScreenRegistry({
            getOrchestrator: (): null => null,
            profileSessionStore: new ProfileSessionStore(),
            containers: {},
        });

        await expect(registry.ensureAuthScreen()).resolves.toBeNull();
        await expect(registry.ensureProfileSelectScreen()).resolves.toBeNull();
        await expect(registry.ensureServerSelectScreen()).resolves.toBeNull();
        await expect(registry.ensureAudioSetupScreen()).resolves.toBeNull();
        await expect(registry.ensureChannelSetupScreen()).resolves.toBeNull();
        await expect(registry.ensureSettingsScreen()).resolves.toBeNull();
    });

    it('dedupes concurrent auth/profile/server screen loads and caches instances', async () => {
        const authScreen = makeScreen();
        const profileSelectScreen = makeScreen();
        const serverSelectScreen = makeScreen();
        const AuthScreen = jest.fn().mockImplementation(() => authScreen);
        const ProfileSelectScreen = jest.fn().mockImplementation(() => profileSelectScreen);
        const ServerSelectScreen = jest.fn().mockImplementation(() => serverSelectScreen);
        const profileSessionStore = new ProfileSessionStore();

        const registry = new AppLazyScreenRegistry({
            getOrchestrator: makeOrchestrator,
            profileSessionStore,
            containers: {
                authContainer: document.createElement('div'),
                profileSelectContainer: document.createElement('div'),
                serverSelectContainer: document.createElement('div'),
            },
            loaders: {
                loadAuthScreen: jest.fn().mockResolvedValue({ AuthScreen }),
                loadProfileSelectScreen: jest.fn().mockResolvedValue({ ProfileSelectScreen }),
                loadServerSelectScreen: jest.fn().mockResolvedValue({ ServerSelectScreen }),
            },
        });

        const [firstAuth, secondAuth] = await Promise.all([
            registry.ensureAuthScreen(),
            registry.ensureAuthScreen(),
        ]);
        const thirdAuth = await registry.ensureAuthScreen();
        expect(AuthScreen).toHaveBeenCalledTimes(1);
        expect(AuthScreen).toHaveBeenCalledWith(
            expect.any(HTMLElement),
            expect.objectContaining({
                requestAuthPin: expect.any(Function),
                pollForPin: expect.any(Function),
                cancelPin: expect.any(Function),
                getNavigation: expect.any(Function),
            })
        );
        expect(firstAuth).toBe(authScreen as never);
        expect(secondAuth).toBe(authScreen as never);
        expect(thirdAuth).toBe(authScreen as never);
        expect(registry.getAuthScreen()).toBe(authScreen as never);

        const [firstProfile, secondProfile] = await Promise.all([
            registry.ensureProfileSelectScreen(),
            registry.ensureProfileSelectScreen(),
        ]);
        const thirdProfile = await registry.ensureProfileSelectScreen();
        expect(ProfileSelectScreen).toHaveBeenCalledTimes(1);
        expect(ProfileSelectScreen).toHaveBeenCalledWith(
            expect.any(HTMLElement),
            expect.objectContaining({
                getHomeUsers: expect.any(Function),
                switchHomeUser: expect.any(Function),
                useMainAccountProfile: expect.any(Function),
                signOutPlex: expect.any(Function),
                getNavigation: expect.any(Function),
            }),
            profileSessionStore
        );
        expect(firstProfile).toBe(profileSelectScreen as never);
        expect(secondProfile).toBe(profileSelectScreen as never);
        expect(thirdProfile).toBe(profileSelectScreen as never);
        expect(registry.getProfileSelectScreen()).toBe(profileSelectScreen as never);

        const [firstServer, secondServer] = await Promise.all([
            registry.ensureServerSelectScreen(),
            registry.ensureServerSelectScreen(),
        ]);
        const thirdServer = await registry.ensureServerSelectScreen();
        expect(ServerSelectScreen).toHaveBeenCalledTimes(1);
        expect(firstServer).toBe(serverSelectScreen as never);
        expect(secondServer).toBe(serverSelectScreen as never);
        expect(thirdServer).toBe(serverSelectScreen as never);
        expect(registry.getServerSelectScreen()).toBe(serverSelectScreen as never);
    });

    it('dedupes concurrent settings loads and caches the instance', async () => {
        const settingsScreen = makeScreen();
        const SettingsScreen = jest.fn().mockImplementation(() => settingsScreen);
        const loadSettingsScreen = jest.fn().mockResolvedValue({
            SettingsScreen,
        });

        const registry = new AppLazyScreenRegistry({
            getOrchestrator: makeOrchestrator,
            profileSessionStore: new ProfileSessionStore(),
            containers: {
                settingsContainer: document.createElement('div'),
            },
            loaders: {
                loadSettingsScreen,
            },
        });

        const [first, second] = await Promise.all([
            registry.ensureSettingsScreen(),
            registry.ensureSettingsScreen(),
        ]);
        const third = await registry.ensureSettingsScreen();
        const constructorArgs = SettingsScreen.mock.calls[0];

        expect(loadSettingsScreen).toHaveBeenCalledTimes(1);
        expect(SettingsScreen).toHaveBeenCalledTimes(1);
        expect(constructorArgs).toBeDefined();
        expect(constructorArgs?.[constructorArgs.length - 1]).toBeInstanceOf(SettingsStore);
        expect(first).toBe(settingsScreen as never);
        expect(second).toBe(settingsScreen as never);
        expect(third).toBe(settingsScreen as never);
    });

    it('dedupes concurrent channel-setup loads and caches the instance', async () => {
        const channelSetupScreen = makeScreen();
        const ChannelSetupScreen = jest.fn().mockImplementation(() => channelSetupScreen);
        const loadChannelSetupScreen = jest.fn().mockResolvedValue({
            ChannelSetupScreen,
        });

        const registry = new AppLazyScreenRegistry({
            getOrchestrator: makeOrchestrator,
            profileSessionStore: new ProfileSessionStore(),
            containers: {
                channelSetupContainer: document.createElement('div'),
            },
            loaders: {
                loadChannelSetupScreen,
            },
        });

        const [first, second] = await Promise.all([
            registry.ensureChannelSetupScreen(),
            registry.ensureChannelSetupScreen(),
        ]);
        const third = await registry.ensureChannelSetupScreen();

        expect(loadChannelSetupScreen).toHaveBeenCalledTimes(1);
        expect(ChannelSetupScreen).toHaveBeenCalledTimes(1);
        expect(first).toBe(channelSetupScreen as never);
        expect(second).toBe(channelSetupScreen as never);
        expect(third).toBe(channelSetupScreen as never);
    });

    it('wires the audio setup completion callback through the registry-owned constructor path', async () => {
        const audioSetupScreen = makeScreen();

        const AudioSetupScreen = jest.fn().mockImplementation(
            (_container: HTMLElement, _getNavigation: () => unknown, _onComplete: () => void) => audioSetupScreen
        );

        const onAudioSetupComplete = jest.fn();

        const registry = new AppLazyScreenRegistry({
            getOrchestrator: makeOrchestrator,
            profileSessionStore: new ProfileSessionStore(),
            containers: {
                audioSetupContainer: document.createElement('div'),
            },
            onAudioSetupComplete,
            loaders: {
                loadAudioSetupScreen: jest.fn().mockResolvedValue({
                    AudioSetupScreen,
                }),
            },
        });

        const first = await registry.ensureAudioSetupScreen();
        const second = await registry.ensureAudioSetupScreen();

        expect(AudioSetupScreen).toHaveBeenCalledTimes(1);
        expect(first).toBe(audioSetupScreen as never);
        expect(second).toBe(audioSetupScreen as never);

        const maybeOnComplete = AudioSetupScreen.mock.calls[0]?.[2] as (() => void) | undefined;
        expect(maybeOnComplete).toBeDefined();
        maybeOnComplete?.();
        expect(onAudioSetupComplete).toHaveBeenCalledTimes(1);
    });

    it('schedules and cancels prefetch timers without duplicates', () => {
        const loadSettingsScreen = jest.fn().mockResolvedValue({ SettingsScreen: jest.fn() });
        const loadChannelSetupScreen = jest.fn().mockResolvedValue({ ChannelSetupScreen: jest.fn() });

        const registry = new AppLazyScreenRegistry({
            getOrchestrator: makeOrchestrator,
            profileSessionStore: new ProfileSessionStore(),
            containers: {
                settingsContainer: document.createElement('div'),
                channelSetupContainer: document.createElement('div'),
            },
            loaders: {
                loadSettingsScreen,
                loadChannelSetupScreen,
            },
        });

        registry.scheduleSettingsPrefetch();
        registry.scheduleSettingsPrefetch();
        registry.scheduleChannelSetupPrefetch();
        registry.scheduleChannelSetupPrefetch();

        expect(jest.getTimerCount()).toBe(2);

        registry.cancelSettingsPrefetch();
        expect(jest.getTimerCount()).toBe(1);

        registry.cancelChannelSetupPrefetch();
        expect(jest.getTimerCount()).toBe(0);
    });

    it('fires prefetch loaders after the existing delays only once', async () => {
        const loadSettingsScreen = jest.fn().mockResolvedValue({ SettingsScreen: jest.fn() });
        const loadChannelSetupScreen = jest.fn().mockResolvedValue({ ChannelSetupScreen: jest.fn() });

        const registry = new AppLazyScreenRegistry({
            getOrchestrator: makeOrchestrator,
            profileSessionStore: new ProfileSessionStore(),
            containers: {
                settingsContainer: document.createElement('div'),
                channelSetupContainer: document.createElement('div'),
            },
            loaders: {
                loadSettingsScreen,
                loadChannelSetupScreen,
            },
        });

        registry.scheduleSettingsPrefetch();
        registry.scheduleChannelSetupPrefetch();

        jest.advanceTimersByTime(CHANNEL_SETUP_PREFETCH_DELAY_MS);
        await flushMicrotasks();

        expect(loadChannelSetupScreen).toHaveBeenCalledTimes(1);
        expect(loadSettingsScreen).toHaveBeenCalledTimes(0);

        jest.advanceTimersByTime(SETTINGS_PREFETCH_DELAY_MS - CHANNEL_SETUP_PREFETCH_DELAY_MS);
        await flushMicrotasks();

        expect(loadSettingsScreen).toHaveBeenCalledTimes(1);
    });

    it('returns null without constructing a screen when an in-flight load resolves after destroy', async () => {
        const settingsScreen = makeScreen();
        const SettingsScreen = jest.fn().mockImplementation(() => settingsScreen);
        type DeferredSettingsModule = {
            SettingsScreen: new (...args: unknown[]) => unknown;
        };
        let resolveLoad!: (value: DeferredSettingsModule) => void;
        const loadPromise = new Promise<DeferredSettingsModule>((resolve) => {
            resolveLoad = resolve;
        });
        const loadSettingsScreen = jest.fn().mockReturnValue(loadPromise);

        const registry = new AppLazyScreenRegistry({
            getOrchestrator: makeOrchestrator,
            profileSessionStore: new ProfileSessionStore(),
            containers: {
                settingsContainer: document.createElement('div'),
            },
            loaders: {
                loadSettingsScreen,
            },
        });

        const pendingScreen = registry.ensureSettingsScreen();

        expect(loadSettingsScreen).toHaveBeenCalledTimes(1);

        registry.destroy();
        resolveLoad({ SettingsScreen });

        await expect(pendingScreen).resolves.toBeNull();
        expect(SettingsScreen).not.toHaveBeenCalled();
        expect(settingsScreen.destroy).not.toHaveBeenCalled();
    });

    it('destroy clears timers, destroys cached screens, and blocks future ensures', async () => {
        const audioSetupScreen = makeScreen();
        const authScreen = makeScreen();
        const profileSelectScreen = makeScreen();
        const serverSelectScreen = makeScreen();
        const channelSetupScreen = makeScreen();
        const settingsScreen = makeScreen();

        const registry = new AppLazyScreenRegistry({
            getOrchestrator: makeOrchestrator,
            profileSessionStore: new ProfileSessionStore(),
            containers: {
                authContainer: document.createElement('div'),
                profileSelectContainer: document.createElement('div'),
                serverSelectContainer: document.createElement('div'),
                audioSetupContainer: document.createElement('div'),
                channelSetupContainer: document.createElement('div'),
                settingsContainer: document.createElement('div'),
            },
            loaders: {
                loadAuthScreen: jest.fn().mockResolvedValue({
                    AuthScreen: jest.fn().mockImplementation(() => authScreen),
                }),
                loadProfileSelectScreen: jest.fn().mockResolvedValue({
                    ProfileSelectScreen: jest.fn().mockImplementation(() => profileSelectScreen),
                }),
                loadServerSelectScreen: jest.fn().mockResolvedValue({
                    ServerSelectScreen: jest.fn().mockImplementation(() => serverSelectScreen),
                }),
                loadAudioSetupScreen: jest.fn().mockResolvedValue({
                    AudioSetupScreen: jest.fn().mockImplementation(() => audioSetupScreen),
                }),
                loadChannelSetupScreen: jest.fn().mockResolvedValue({
                    ChannelSetupScreen: jest.fn().mockImplementation(() => channelSetupScreen),
                }),
                loadSettingsScreen: jest.fn().mockResolvedValue({
                    SettingsScreen: jest.fn().mockImplementation(() => settingsScreen),
                }),
            },
        });

        registry.scheduleSettingsPrefetch();
        registry.scheduleChannelSetupPrefetch();

        expect(jest.getTimerCount()).toBe(2);

        await registry.ensureAuthScreen();
        await registry.ensureProfileSelectScreen();
        await registry.ensureServerSelectScreen();
        await registry.ensureAudioSetupScreen();
        await registry.ensureChannelSetupScreen();
        await registry.ensureSettingsScreen();

        registry.destroy();

        expect(jest.getTimerCount()).toBe(0);
        expect(authScreen.destroy).toHaveBeenCalledTimes(1);
        expect(profileSelectScreen.destroy).toHaveBeenCalledTimes(1);
        expect(serverSelectScreen.destroy).toHaveBeenCalledTimes(1);
        expect(audioSetupScreen.destroy).toHaveBeenCalledTimes(1);
        expect(channelSetupScreen.destroy).toHaveBeenCalledTimes(1);
        expect(settingsScreen.destroy).toHaveBeenCalledTimes(1);
        await expect(registry.ensureAuthScreen()).resolves.toBeNull();
        await expect(registry.ensureProfileSelectScreen()).resolves.toBeNull();
        await expect(registry.ensureServerSelectScreen()).resolves.toBeNull();
        await expect(registry.ensureAudioSetupScreen()).resolves.toBeNull();
        await expect(registry.ensureChannelSetupScreen()).resolves.toBeNull();
        await expect(registry.ensureSettingsScreen()).resolves.toBeNull();
    });
});
