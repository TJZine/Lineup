/**
 * @jest-environment jsdom
 */

import { ProfileSessionStore } from '../../../modules/settings/ProfileSessionStore';
import {
    AppLazyScreenRegistry,
} from '../deferred-screens/AppLazyScreenRegistry';
import type {
    AppLazyChannelSetupScreenInput,
    AppLazyScreenPortFactory,
    AppLazySettingsRuntimePorts,
} from '../deferred-screens/AppLazyScreenPortFactory';
import { CHANNEL_SETUP_PREFETCH_DELAY_MS, SETTINGS_PREFETCH_DELAY_MS } from '../config/constants';

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

type PortFactoryLike = Pick<
    AppLazyScreenPortFactory,
    | 'createAuthScreenPorts'
    | 'createProfileSelectScreenPorts'
    | 'createServerSelectScreenPorts'
    | 'createChannelSetupScreenInput'
    | 'createSettingsRuntimePorts'
    | 'getNavigation'
>;

const makePortFactory = (): PortFactoryLike => ({
    createAuthScreenPorts: jest.fn(() => ({
        requestAuthPin: jest.fn().mockResolvedValue({} as never),
        pollForPin: jest.fn().mockResolvedValue({} as never),
        cancelPin: jest.fn().mockResolvedValue(undefined),
        getNavigation: jest.fn().mockReturnValue(null),
    })),
    createProfileSelectScreenPorts: jest.fn(() => ({
        getHomeUsers: jest.fn().mockResolvedValue([]),
        switchHomeUser: jest.fn().mockResolvedValue(undefined),
        useMainAccountProfile: jest.fn().mockResolvedValue(undefined),
        signOutPlex: jest.fn().mockResolvedValue(undefined),
        getNavigation: jest.fn().mockReturnValue(null),
    })),
    createServerSelectScreenPorts: jest.fn(() => ({
        discoverServers: jest.fn().mockResolvedValue([]),
        selectServer: jest.fn().mockResolvedValue({
            kind: 'selected',
        }),
        clearSelectedServer: jest.fn().mockResolvedValue(undefined),
        getSelectedServerScreenState: jest.fn().mockReturnValue({
            selectedServerId: null,
            serverHealth: {},
        }),
        requestChannelSetupRerun: jest.fn(),
        getNavigation: jest.fn().mockReturnValue(null),
    })),
    createChannelSetupScreenInput: jest.fn((): AppLazyChannelSetupScreenInput => ({
        workflowPort: {
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
            invalidateFacetSnapshot: jest.fn(),
            invalidateSessionData: jest.fn(),
        },
        screenPorts: {
            getNavigation: jest.fn().mockReturnValue(null),
            getSelectedServerId: jest.fn().mockReturnValue(null),
            openServerSelect: jest.fn(),
            switchToChannelByNumberWithOutcome: jest.fn().mockResolvedValue({ kind: 'switched' }),
            openEPG: jest.fn(),
        },
    })),
    createSettingsRuntimePorts: jest.fn((): AppLazySettingsRuntimePorts => ({
        getNavigation: jest.fn().mockReturnValue(null),
        clearSubtitleTrack: jest.fn().mockResolvedValue(undefined),
        onGuideSettingChange: jest.fn(),
        getActiveUsername: jest.fn().mockReturnValue('UnitTestUser'),
        getTheme: jest.fn().mockReturnValue('ember-steel'),
        setTheme: jest.fn(),
    })),
    getNavigation: jest.fn().mockReturnValue(null),
});

const makeMissingPortFactory = (): PortFactoryLike => ({
    createAuthScreenPorts: jest.fn(() => null),
    createProfileSelectScreenPorts: jest.fn(() => null),
    createServerSelectScreenPorts: jest.fn(() => null),
    createChannelSetupScreenInput: jest.fn(() => null),
    createSettingsRuntimePorts: jest.fn(() => null),
    getNavigation: jest.fn().mockReturnValue(null),
});

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
            portFactory: makeMissingPortFactory() as AppLazyScreenPortFactory,
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

    it('returns null without constructing deferred screens when screen-specific ports are unavailable', async () => {
        const AuthScreen = jest.fn();
        const ProfileSelectScreen = jest.fn();
        const ServerSelectScreen = jest.fn();
        const ChannelSetupScreen = jest.fn();
        const SettingsScreen = jest.fn();
        const loadAuthScreen = jest.fn().mockResolvedValue({ AuthScreen });
        const loadProfileSelectScreen = jest.fn().mockResolvedValue({ ProfileSelectScreen });
        const loadServerSelectScreen = jest.fn().mockResolvedValue({ ServerSelectScreen });
        const loadChannelSetupScreen = jest.fn().mockResolvedValue({ ChannelSetupScreen });
        const loadSettingsModule = jest.fn().mockResolvedValue({ SettingsScreen });

        const registry = new AppLazyScreenRegistry({
            portFactory: makeMissingPortFactory() as AppLazyScreenPortFactory,
            profileSessionStore: new ProfileSessionStore(),
            containers: {
                authContainer: document.createElement('div'),
                profileSelectContainer: document.createElement('div'),
                serverSelectContainer: document.createElement('div'),
                channelSetupContainer: document.createElement('div'),
                settingsContainer: document.createElement('div'),
            },
            loaders: {
                loadAuthScreen,
                loadProfileSelectScreen,
                loadServerSelectScreen,
                loadChannelSetupScreen,
                loadSettingsModule,
            },
        });

        await expect(registry.ensureAuthScreen()).resolves.toBeNull();
        await expect(registry.ensureProfileSelectScreen()).resolves.toBeNull();
        await expect(registry.ensureServerSelectScreen()).resolves.toBeNull();
        await expect(registry.ensureChannelSetupScreen()).resolves.toBeNull();
        await expect(registry.ensureSettingsScreen()).resolves.toBeNull();

        expect(loadAuthScreen).toHaveBeenCalledTimes(1);
        expect(loadProfileSelectScreen).toHaveBeenCalledTimes(1);
        expect(loadServerSelectScreen).toHaveBeenCalledTimes(1);
        expect(loadChannelSetupScreen).toHaveBeenCalledTimes(1);
        expect(loadSettingsModule).toHaveBeenCalledTimes(1);
        expect(AuthScreen).not.toHaveBeenCalled();
        expect(ProfileSelectScreen).not.toHaveBeenCalled();
        expect(ServerSelectScreen).not.toHaveBeenCalled();
        expect(ChannelSetupScreen).not.toHaveBeenCalled();
        expect(SettingsScreen).not.toHaveBeenCalled();
    });

    it('dedupes concurrent auth/profile/server screen loads and caches instances', async () => {
        const authScreen = makeScreen();
        const profileSelectScreen = makeScreen();
        const serverSelectScreen = makeScreen();
        const AuthScreen = jest.fn().mockImplementation(() => authScreen);
        const ProfileSelectScreen = jest.fn().mockImplementation(() => profileSelectScreen);
        const ServerSelectScreen = jest.fn().mockImplementation(() => serverSelectScreen);
        const profileSessionStore = new ProfileSessionStore();

        const portFactory = makePortFactory();
        const registry = new AppLazyScreenRegistry({
            portFactory: portFactory as AppLazyScreenPortFactory,
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
        expect(ServerSelectScreen).toHaveBeenCalledWith(
            expect.any(HTMLElement),
            expect.objectContaining({
                discoverServers: expect.any(Function),
                selectServer: expect.any(Function),
                clearSelectedServer: expect.any(Function),
                getSelectedServerScreenState: expect.any(Function),
                requestChannelSetupRerun: expect.any(Function),
                getNavigation: expect.any(Function),
            })
        );
        expect(firstServer).toBe(serverSelectScreen as never);
        expect(secondServer).toBe(serverSelectScreen as never);
        expect(thirdServer).toBe(serverSelectScreen as never);
        expect(registry.getServerSelectScreen()).toBe(serverSelectScreen as never);
    });

    it('dedupes concurrent settings loads and caches the instance', async () => {
        const settingsScreen = makeScreen();
        const SettingsScreen = jest.fn().mockImplementation(() => settingsScreen);
        const loadSettingsModule = jest.fn().mockResolvedValue({
            SettingsScreen,
        });
        const portFactory = makePortFactory();

        const registry = new AppLazyScreenRegistry({
            portFactory: portFactory as AppLazyScreenPortFactory,
            profileSessionStore: new ProfileSessionStore(),
            containers: {
                settingsContainer: document.createElement('div'),
            },
            loaders: {
                loadSettingsModule,
            },
        });

        const [first, second] = await Promise.all([
            registry.ensureSettingsScreen(),
            registry.ensureSettingsScreen(),
        ]);
        const third = await registry.ensureSettingsScreen();
        const constructorArgs = SettingsScreen.mock.calls[0];

        expect(loadSettingsModule).toHaveBeenCalledTimes(1);
        expect(SettingsScreen).toHaveBeenCalledTimes(1);
        expect(constructorArgs).toBeDefined();
        expect(constructorArgs).toHaveLength(1);
        expect(portFactory.createSettingsRuntimePorts).toHaveBeenCalledTimes(1);
        const settingsRuntimePorts = (portFactory.createSettingsRuntimePorts as jest.Mock).mock.results[0]?.value;
        expect(constructorArgs?.[0]).toEqual({
            container: expect.any(HTMLElement),
            getNavigation: settingsRuntimePorts?.getNavigation,
            onSubtitleModeChange: expect.any(Function),
            onGuideSettingChange: expect.any(Function),
            getActiveUsername: settingsRuntimePorts?.getActiveUsername,
            getTheme: settingsRuntimePorts?.getTheme,
            setTheme: settingsRuntimePorts?.setTheme,
        });
        expect(first).toBe(settingsScreen as never);
        expect(second).toBe(settingsScreen as never);
        expect(third).toBe(settingsScreen as never);
    });

    it('reports subtitle-track clearing failures without leaking an unhandled rejection', async () => {
        const settingsScreen = makeScreen();
        const SettingsScreen = jest.fn().mockImplementation(() => settingsScreen);
        const loadSettingsModule = jest.fn().mockResolvedValue({ SettingsScreen });
        const clearError = new Error('clear failed');
        const portFactory = makePortFactory();
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        (portFactory.createSettingsRuntimePorts as jest.Mock).mockReturnValueOnce({
            getNavigation: jest.fn().mockReturnValue(null),
            clearSubtitleTrack: jest.fn().mockRejectedValue(clearError),
            onGuideSettingChange: jest.fn(),
            getActiveUsername: jest.fn().mockReturnValue('UnitTestUser'),
            getTheme: jest.fn().mockReturnValue('ember-steel'),
            setTheme: jest.fn(),
        } satisfies AppLazySettingsRuntimePorts);

        const registry = new AppLazyScreenRegistry({
            portFactory: portFactory as AppLazyScreenPortFactory,
            profileSessionStore: new ProfileSessionStore(),
            containers: {
                settingsContainer: document.createElement('div'),
            },
            loaders: {
                loadSettingsModule,
            },
        });

        await registry.ensureSettingsScreen();
        const constructorArgs = SettingsScreen.mock.calls[0]?.[0];

        constructorArgs.onSubtitleModeChange('off');
        await flushMicrotasks();

        const settingsRuntimePorts = (portFactory.createSettingsRuntimePorts as jest.Mock).mock.results[0]?.value;
        expect(settingsRuntimePorts.clearSubtitleTrack).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(
            '[AppLazyScreenRegistry] Failed to clear subtitle track after subtitle mode off',
            expect.objectContaining({
                name: 'Error',
                message: 'clear failed',
            })
        );
    });

    it('dedupes concurrent channel-setup loads and caches the instance', async () => {
        const channelSetupScreen = makeScreen();
        const ChannelSetupScreen = jest.fn().mockImplementation(() => channelSetupScreen);
        const loadChannelSetupScreen = jest.fn().mockResolvedValue({
            ChannelSetupScreen,
        });

        const registry = new AppLazyScreenRegistry({
            portFactory: makePortFactory() as AppLazyScreenPortFactory,
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
            portFactory: makePortFactory() as AppLazyScreenPortFactory,
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
        const loadSettingsModule = jest.fn().mockResolvedValue({ SettingsScreen: jest.fn() });
        const loadChannelSetupScreen = jest.fn().mockResolvedValue({ ChannelSetupScreen: jest.fn() });

        const registry = new AppLazyScreenRegistry({
            portFactory: makePortFactory() as AppLazyScreenPortFactory,
            profileSessionStore: new ProfileSessionStore(),
            containers: {
                settingsContainer: document.createElement('div'),
                channelSetupContainer: document.createElement('div'),
            },
            loaders: {
                loadSettingsModule,
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
        const loadSettingsModule = jest.fn().mockResolvedValue({ SettingsScreen: jest.fn() });
        const loadChannelSetupScreen = jest.fn().mockResolvedValue({ ChannelSetupScreen: jest.fn() });

        const registry = new AppLazyScreenRegistry({
            portFactory: makePortFactory() as AppLazyScreenPortFactory,
            profileSessionStore: new ProfileSessionStore(),
            containers: {
                settingsContainer: document.createElement('div'),
                channelSetupContainer: document.createElement('div'),
            },
            loaders: {
                loadSettingsModule,
                loadChannelSetupScreen,
            },
        });

        registry.scheduleSettingsPrefetch();
        registry.scheduleChannelSetupPrefetch();

        jest.advanceTimersByTime(CHANNEL_SETUP_PREFETCH_DELAY_MS);
        await flushMicrotasks();

        expect(loadChannelSetupScreen).toHaveBeenCalledTimes(1);
        expect(loadSettingsModule).toHaveBeenCalledTimes(0);

        jest.advanceTimersByTime(SETTINGS_PREFETCH_DELAY_MS - CHANNEL_SETUP_PREFETCH_DELAY_MS);
        await flushMicrotasks();

        expect(loadSettingsModule).toHaveBeenCalledTimes(1);
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
        const loadSettingsModule = jest.fn().mockReturnValue(loadPromise);

        const registry = new AppLazyScreenRegistry({
            portFactory: makePortFactory() as AppLazyScreenPortFactory,
            profileSessionStore: new ProfileSessionStore(),
            containers: {
                settingsContainer: document.createElement('div'),
            },
            loaders: {
                loadSettingsModule,
            },
        });

        const pendingScreen = registry.ensureSettingsScreen();

        expect(loadSettingsModule).toHaveBeenCalledTimes(1);

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
            portFactory: makePortFactory() as AppLazyScreenPortFactory,
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
                loadSettingsModule: jest.fn().mockResolvedValue({
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
