/**
 * @jest-environment jsdom
 */

import { InitializationCoordinator, STARTUP_PHASE } from '../InitializationCoordinator';
import type { InitializationDependencies, InitializationCallbacks } from '../InitializationCoordinator';
import { CLASSIC_EPG_PIP_CLASS } from '../../../modules/ui/epg';
import type { PlexAuthDataV2, PlexStoredCredentialsReadResult } from '../../../modules/plex/auth';
import { PlexApiError } from '../../../modules/plex/auth';
import { AppErrorCode } from '../../../types/app-errors';
import { CHANNEL_BADGE_CONTAINER_ID } from '../../../modules/ui/channel-badge';
import { EpgPreferencesStore, type EpgLayoutMode } from '../../../modules/settings/EpgPreferencesStore';
import { ProfileSessionStore } from '../../../modules/settings/ProfileSessionStore';
import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { APP_SHELL_CONTAINER_IDS } from '../../../modules/ui/common/appShellContainerIds';

const SKIPPED_SAVED_SERVER_RESTORE = { kind: 'skipped_no_saved_server' } as const;

const createStoredCredentials = (
    activeToken: string,
    accountToken: string,
    userId: string = 'user-1'
): PlexStoredCredentialsReadResult => ({
    kind: 'available',
    credentials: {
        accountToken: {
            token: accountToken,
            userId,
            username: 'account',
            email: 'account@example.com',
            thumb: '',
            expiresAt: null,
            issuedAt: new Date(),
        },
        activeToken: {
            token: activeToken,
            userId,
            username: 'active',
            email: 'active@example.com',
            thumb: '',
            expiresAt: null,
            issuedAt: new Date(),
        },
        activeUserId: userId,
        selectedServerByUserId: {
            [userId]: { serverId: null, serverUri: null },
        },
    } satisfies PlexAuthDataV2,
});

describe('InitializationCoordinator (Plex Home)', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    });

    type LegacyInitializationDependencies = {
        lifecycle: InitializationDependencies['modules']['lifecycle'];
        navigation: InitializationDependencies['modules']['navigation'];
        plexAuth: InitializationDependencies['modules']['plexAuth'];
        plexDiscovery: InitializationDependencies['modules']['plexDiscovery'];
        plexLibrary: InitializationDependencies['modules']['plexLibrary'];
        plexStreamResolver: InitializationDependencies['modules']['plexStreamResolver'];
        channelManager: InitializationDependencies['modules']['channelManager'];
        scheduler: InitializationDependencies['modules']['scheduler'];
        videoPlayer: InitializationDependencies['modules']['videoPlayer'];
        epg: InitializationDependencies['modules']['epg'];
        epgReadiness: InitializationDependencies['readiness']['epg'];
        playerOsd: InitializationDependencies['overlays']['playerOsd'];
        channelNumberOverlay: InitializationDependencies['overlays']['channelNumberOverlay'];
        channelBadgeOverlay: InitializationDependencies['overlays']['channelBadgeOverlay'];
        miniGuide: InitializationDependencies['overlays']['miniGuide'];
        channelTransition: InitializationDependencies['overlays']['channelTransition'];
        startupUiInitializer: InitializationDependencies['startupUiInitializer'];
        epgPreferencesStore: InitializationDependencies['stores']['epgPreferencesStore'];
        profileSessionStore: InitializationDependencies['stores']['profileSessionStore'];
    };

    type LegacyInitializationCallbacks = {
        updateModuleStatus: InitializationCallbacks['status']['updateModuleStatus'];
        getModuleStatus: InitializationCallbacks['status']['getModuleStatus'];
        handleGlobalError: InitializationCallbacks['errors']['handleGlobalError'];
        reportRecoverableAsyncFailure: InitializationCallbacks['diagnostics']['reportRecoverableAsyncFailure'];
        setReady: InitializationCallbacks['state']['setReady'];
        setupEventWiring: InitializationCallbacks['state']['setupEventWiring'];
        configureDiscoveryStorage: InitializationCallbacks['serverStorage']['configureDiscoveryStorage'];
        configureChannelManagerStorage: InitializationCallbacks['serverStorage']['configureChannelManagerStorage'];
        getSelectedServerId: InitializationCallbacks['serverStorage']['getSelectedServerId'];
        shouldRunAudioSetup: InitializationCallbacks['routing']['shouldRunAudioSetup'];
        shouldRunChannelSetup: InitializationCallbacks['routing']['shouldRunChannelSetup'];
        switchToChannel: InitializationCallbacks['routing']['switchToChannel'];
        openServerSelect: InitializationCallbacks['routing']['openServerSelect'];
        buildPlexResourceUrl: InitializationCallbacks['resources']['buildPlexResourceUrl'];
    };

    type CoordinatorHarness = {
        coordinator: InitializationCoordinator;
        deps: InitializationDependencies & LegacyInitializationDependencies;
        callbacks: InitializationCallbacks & LegacyInitializationCallbacks;
    };

    const makeCoordinator = (
        depsOverrides: Partial<LegacyInitializationDependencies> = {},
        configOverrides: Partial<{
            epgConfig: unknown;
        }> = {}
    ): CoordinatorHarness => {
        const navigation = {
            initialize: jest.fn(),
            getCurrentScreen: jest.fn().mockReturnValue('splash'),
            goTo: jest.fn(),
            replaceScreen: jest.fn(),
            getServerSelectParams: jest.fn().mockReturnValue(null),
            getState: jest.fn().mockReturnValue({ screenStack: [] }),
        } as unknown as LegacyInitializationDependencies['navigation'];

        const plexAuth = {
            readStoredCredentialsAndClearCorruption: jest.fn().mockReturnValue({ kind: 'missing' }),
            validateToken: jest.fn().mockResolvedValue(true),
            getCurrentUser: jest.fn().mockReturnValue(null),
            storeCredentials: jest.fn(() => undefined),
            getHomeUsers: jest.fn().mockResolvedValue([]),
            on: jest.fn(() => ({ dispose: jest.fn() })),
        } as unknown as LegacyInitializationDependencies['plexAuth'];

        const plexDiscovery = {
            initialize: jest.fn().mockResolvedValue(SKIPPED_SAVED_SERVER_RESTORE),
            isConnected: jest.fn().mockReturnValue(false),
            on: jest.fn(() => ({ dispose: jest.fn() })),
        } as unknown as LegacyInitializationDependencies['plexDiscovery'];

        const legacyDeps: LegacyInitializationDependencies = {
            lifecycle: null,
            navigation,
            plexAuth,
            plexDiscovery,
            plexLibrary: {} as never,
            plexStreamResolver: {} as never,
            channelManager: null,
            scheduler: null,
            videoPlayer: null,
            epg: null,
            epgReadiness: null,
            playerOsd: null,
            channelNumberOverlay: null,
            channelBadgeOverlay: null,
            miniGuide: null,
            channelTransition: null,
            startupUiInitializer: {
                ensureCorePlayerUiInitialized: jest.fn().mockResolvedValue(undefined),
            } as unknown as LegacyInitializationDependencies['startupUiInitializer'],
            epgPreferencesStore: new EpgPreferencesStore(),
            profileSessionStore: new ProfileSessionStore(),
        };
        Object.assign(legacyDeps, depsOverrides);

        const deps: InitializationDependencies = {
            modules: {
                lifecycle: legacyDeps.lifecycle,
                navigation: legacyDeps.navigation,
                plexAuth: legacyDeps.plexAuth,
                plexDiscovery: legacyDeps.plexDiscovery,
                plexLibrary: legacyDeps.plexLibrary,
                plexStreamResolver: legacyDeps.plexStreamResolver,
                channelManager: legacyDeps.channelManager,
                scheduler: legacyDeps.scheduler,
                videoPlayer: legacyDeps.videoPlayer,
                epg: legacyDeps.epg,
            },
            readiness: {
                epg: legacyDeps.epgReadiness,
            },
            overlays: {
                playerOsd: legacyDeps.playerOsd,
                channelNumberOverlay: legacyDeps.channelNumberOverlay,
                channelBadgeOverlay: legacyDeps.channelBadgeOverlay,
                miniGuide: legacyDeps.miniGuide,
                channelTransition: legacyDeps.channelTransition,
            },
            startupUiInitializer: legacyDeps.startupUiInitializer,
            epgDebugRuntime: null,
            stores: {
                epgPreferencesStore: legacyDeps.epgPreferencesStore,
                profileSessionStore: legacyDeps.profileSessionStore,
            },
        };

        const legacyCallbacks: LegacyInitializationCallbacks = {
            updateModuleStatus: jest.fn(),
            getModuleStatus: jest.fn(),
            handleGlobalError: jest.fn(),
            reportRecoverableAsyncFailure: jest.fn(),
            setReady: jest.fn(),
            setupEventWiring: jest.fn(),
            configureDiscoveryStorage: jest.fn(),
            configureChannelManagerStorage: jest.fn().mockResolvedValue(undefined),
            getSelectedServerId: jest.fn().mockReturnValue(null),
            shouldRunAudioSetup: jest.fn().mockReturnValue(false),
            shouldRunChannelSetup: jest.fn().mockReturnValue(false),
            switchToChannel: jest.fn(),
            openServerSelect: jest.fn(),
            buildPlexResourceUrl: jest.fn(),
        };
        const callbacks: InitializationCallbacks = {
            status: {
                updateModuleStatus: legacyCallbacks.updateModuleStatus,
                getModuleStatus: legacyCallbacks.getModuleStatus,
            },
            errors: {
                handleGlobalError: legacyCallbacks.handleGlobalError,
            },
            diagnostics: {
                reportRecoverableAsyncFailure: legacyCallbacks.reportRecoverableAsyncFailure,
            },
            state: {
                setReady: legacyCallbacks.setReady,
                setupEventWiring: legacyCallbacks.setupEventWiring,
            },
            serverStorage: {
                configureDiscoveryStorage: legacyCallbacks.configureDiscoveryStorage,
                configureChannelManagerStorage: legacyCallbacks.configureChannelManagerStorage,
                getSelectedServerId: legacyCallbacks.getSelectedServerId,
            },
            routing: {
                shouldRunAudioSetup: legacyCallbacks.shouldRunAudioSetup,
                shouldRunChannelSetup: legacyCallbacks.shouldRunChannelSetup,
                switchToChannel: legacyCallbacks.switchToChannel,
                openServerSelect: legacyCallbacks.openServerSelect,
            },
            resources: {
                buildPlexResourceUrl: legacyCallbacks.buildPlexResourceUrl,
            },
        };

        const coordinator = new InitializationCoordinator(
            {
                plexConfig: {} as never,
                navConfig: {} as never,
                playerConfig: {} as never,
                epgConfig: (configOverrides.epgConfig ?? ({} as never)) as never,
                nowPlayingInfoConfig: {} as never,
                playerOsdConfig: {} as never,
                channelNumberOverlayConfig: {} as never,
                channelBadgeConfig: { containerId: CHANNEL_BADGE_CONTAINER_ID } as never,
                miniGuideConfig: {} as never,
                channelTransitionConfig: {} as never,
                playbackOptionsConfig: {} as never,
            },
            deps,
            callbacks
        );

        const harnessDeps = Object.assign(deps, legacyDeps) as InitializationDependencies & LegacyInitializationDependencies;

        // Keep the legacy flat accessors for existing tests, but proxy writes to the
        // real nested dependency bag so setup cannot drift.
        Object.defineProperty(harnessDeps, 'channelManager', {
            configurable: true,
            enumerable: true,
            get: (): InitializationDependencies['modules']['channelManager'] => deps.modules.channelManager,
            set: (value: InitializationDependencies['modules']['channelManager']) => {
                deps.modules.channelManager = value;
            },
        });

        return {
            coordinator,
            deps: harnessDeps,
            callbacks: Object.assign(callbacks, legacyCallbacks),
        };
    };

    it('routes to server-select when active token is valid and picker is disabled', async () => {
        const { coordinator, deps } = makeCoordinator();
        const plexAuth = deps.plexAuth as unknown as {
            readStoredCredentialsAndClearCorruption: jest.Mock;
            validateToken: jest.Mock;
        };
        const navigation = deps.navigation as unknown as { goTo: jest.Mock };
        const plexDiscovery = deps.plexDiscovery as unknown as { isConnected: jest.Mock };

        plexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('active-token', 'account-token'));
        plexAuth.validateToken.mockResolvedValue(true);
        plexDiscovery.isConnected.mockReturnValue(false);

        await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE);

        expect(navigation.goTo).toHaveBeenCalledWith('server-select');
        expect(navigation.goTo).not.toHaveBeenCalledWith('profile-select');
    });

    it('routes to profile-select when active token is invalid but account is valid', async () => {
        const { coordinator, deps } = makeCoordinator();
        const plexAuth = deps.plexAuth as unknown as {
            readStoredCredentialsAndClearCorruption: jest.Mock;
            validateToken: jest.Mock;
            storeCredentials: jest.Mock;
            getCurrentUser: jest.Mock;
        };
        const navigation = deps.navigation as unknown as { goTo: jest.Mock };

        plexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(createStoredCredentials('bad-token', 'account-token'));
        plexAuth.validateToken
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);
        plexAuth.getCurrentUser.mockReturnValue({
            token: 'account-token',
            userId: 'user-1',
            username: 'account',
            email: 'account@example.com',
            thumb: '',
            expiresAt: null,
            issuedAt: new Date(),
        });

        await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE);

        expect(navigation.goTo).toHaveBeenCalledWith('profile-select');
        expect(plexAuth.storeCredentials).toHaveBeenCalledWith({
            accountToken: {
                token: 'account-token',
                userId: 'user-1',
                username: 'account',
                email: 'account@example.com',
                thumb: '',
                expiresAt: null,
                issuedAt: expect.any(Date),
            },
            activeToken: {
                token: 'account-token',
                userId: 'user-1',
                username: 'account',
                email: 'account@example.com',
                thumb: '',
                expiresAt: null,
                issuedAt: expect.any(Date),
            },
            activeUserId: 'user-1',
            selectedServerByUserId: {
                'user-1': { serverId: null, serverUri: null },
            },
            deviceKey: null,
        });
    });

    it('rethrows non-auth token validation failures instead of masking them as auth resume', async () => {
        const { coordinator, deps, callbacks } = makeCoordinator();
        const plexAuth = deps.plexAuth as unknown as {
            readStoredCredentialsAndClearCorruption: jest.Mock;
            validateToken: jest.Mock;
            on: jest.Mock;
        };
        const navigation = deps.navigation as unknown as { goTo: jest.Mock };

        plexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(
            createStoredCredentials('active-token', 'account-token')
        );
        plexAuth.validateToken.mockRejectedValue(new Error('validation down'));

        await expect(coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE)).rejects.toThrow('validation down');

        expect(callbacks.updateModuleStatus).not.toHaveBeenCalledWith('plex-auth', 'pending');
        expect(plexAuth.on).not.toHaveBeenCalledWith('authChange', expect.any(Function));
        expect(plexAuth.on).not.toHaveBeenCalledWith('profileChange', expect.any(Function));
        expect(navigation.goTo).not.toHaveBeenCalledWith('auth');
    });

    it('does not resume startup for unauthenticated authChange events from cancelled auth flows', async () => {
        const { coordinator, deps } = makeCoordinator();
        const plexAuth = deps.plexAuth as unknown as {
            readStoredCredentialsAndClearCorruption: jest.Mock;
            on: jest.Mock;
        };
        const authChangeHandlers: Array<(isAuthenticated: boolean) => void> = [];
        plexAuth.on.mockImplementation((event: string, handler: (isAuthenticated: boolean) => void) => {
            if (event === 'authChange') {
                authChangeHandlers.push(handler);
            }
            return { dispose: jest.fn() };
        });
        plexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue({ kind: 'missing' });
        const runSpy = jest.spyOn(coordinator, 'runStartup');

        await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE);
        const handler = authChangeHandlers[0];
        if (!handler) {
            throw new Error('Expected authChange handler to be registered');
        }

        runSpy.mockClear();
        handler(false);
        await Promise.resolve();

        expect(runSpy).not.toHaveBeenCalled();

        handler(true);
        expect(runSpy).toHaveBeenCalledWith(STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE);
        const resumePromise = runSpy.mock.results[0]?.value as Promise<void>;
        await resumePromise;
    });

    it('does not redundantly reset lifecycle phases during full startup', async () => {
        const lifecycle = {
            initialize: jest.fn().mockResolvedValue(undefined),
            setPhase: jest.fn(),
        } as unknown as LegacyInitializationDependencies['lifecycle'];

        const { coordinator, deps } = makeCoordinator({
            lifecycle,
        });

        const plexAuth = deps.plexAuth as unknown as {
            readStoredCredentialsAndClearCorruption: jest.Mock;
        };

        plexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue({ kind: 'missing' });

        await coordinator.runStartup(STARTUP_PHASE.FULL_STARTUP);

        expect((lifecycle as unknown as { initialize: jest.Mock }).initialize).toHaveBeenCalledTimes(1);
        expect((lifecycle as unknown as { setPhase: jest.Mock }).setPhase).not.toHaveBeenCalledWith('initializing');
        expect((lifecycle as unknown as { setPhase: jest.Mock }).setPhase).not.toHaveBeenCalledWith('authenticating');
    });

    it('configures discovery storage before resuming after server selection on profileChange', async () => {
        const { coordinator, deps, callbacks } = makeCoordinator();

        const order: string[] = [];

        // Arrange deps: stored creds + valid active token, and ensure startup shows profile-select
        const plexAuth = deps.plexAuth as unknown as {
            readStoredCredentialsAndClearCorruption: jest.Mock;
            validateToken: jest.Mock;
            getHomeUsers: jest.Mock;
            on: jest.Mock;
        };
        const navigation = deps.navigation as unknown as {
            getCurrentScreen: jest.Mock;
            goTo: jest.Mock;
        };
        const plexDiscovery = deps.plexDiscovery as unknown as {
            initialize: jest.Mock;
            isConnected: jest.Mock;
        };
        const channelManager = {
            getCurrentChannel: jest.fn().mockReturnValue({ id: 'current-channel-id' }),
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as LegacyInitializationDependencies['channelManager'];
        deps.channelManager = channelManager;

        let profileChangeHandler: (() => void) | null = null;
        plexAuth.on.mockImplementation((event: string, handler: () => void) => {
            if (event === 'profileChange') {
                profileChangeHandler = handler;
            }
            return { dispose: jest.fn() };
        });

        (callbacks.configureDiscoveryStorage as jest.Mock).mockImplementation(() => {
            order.push('configure');
        });
        plexDiscovery.initialize.mockImplementation(async () => {
            order.push('init');
            return SKIPPED_SAVED_SERVER_RESTORE;
        });

        navigation.getCurrentScreen.mockReturnValue('auth');
        plexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(
            createStoredCredentials('active-token', 'account-token')
        );
        plexAuth.validateToken.mockResolvedValue(true);
        plexAuth.getHomeUsers.mockResolvedValue([
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: false },
        ]);
        plexDiscovery.isConnected.mockReturnValue(false);

        const runSpy = jest.spyOn(coordinator, 'runStartup');

        // Act: initial startup should show profile-select and register the resume handler
        await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE);
        expect(navigation.goTo).toHaveBeenCalledWith('profile-select');
        expect(profileChangeHandler).toBeTruthy();

        // Clear any ordering noise from auth validation (which also configures discovery storage).
        order.length = 0;

        // Act: simulate user switch emitting profileChange
        profileChangeHandler!();

        // Wait for the server connection startup triggered by the handler.
        const serverConnectionCallIndex = runSpy.mock.calls.findIndex((args) => args[0] === STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
        expect(serverConnectionCallIndex).toBeGreaterThanOrEqual(0);
        const serverConnectionPromise = runSpy.mock.results[serverConnectionCallIndex]?.value as Promise<void>;
        await serverConnectionPromise;

        // Assert: storage configured before discovery initialize reads from localStorage
        expect(order[0]).toBe('configure');
        expect(order).toContain('init');
    });

    it('routes profileChange resume through the coordinator-owned profile-switch restart helper', async () => {
        const { coordinator, deps } = makeCoordinator();
        const plexAuth = deps.plexAuth as unknown as {
            readStoredCredentialsAndClearCorruption: jest.Mock;
            validateToken: jest.Mock;
            getHomeUsers: jest.Mock;
            on: jest.Mock;
        };
        const navigation = deps.navigation as unknown as {
            getCurrentScreen: jest.Mock;
            goTo: jest.Mock;
        };
        const plexDiscovery = deps.plexDiscovery as unknown as {
            isConnected: jest.Mock;
        };

        let profileChangeHandler: (() => void) | null = null;
        plexAuth.on.mockImplementation((event: string, handler: () => void) => {
            if (event === 'profileChange') {
                profileChangeHandler = handler;
            }
            return { dispose: jest.fn() };
        });

        navigation.getCurrentScreen.mockReturnValue('auth');
        plexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(
            createStoredCredentials('active-token', 'account-token')
        );
        plexAuth.validateToken.mockResolvedValue(true);
        plexAuth.getHomeUsers.mockResolvedValue([
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: false },
        ]);
        plexDiscovery.isConnected.mockReturnValue(true);

        const resumeSpy = jest
            .spyOn(coordinator, 'resumeStartupAfterProfileSwitch')
            .mockResolvedValue(undefined);

        await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE);
        expect(profileChangeHandler).toBeTruthy();

        const handler = profileChangeHandler as (() => void) | null;
        if (handler === null) {
            throw new Error('Expected profileChange handler to be registered');
        }

        handler();
        await Promise.resolve();

        expect(resumeSpy).toHaveBeenCalledTimes(1);
    });

    it('uses the coordinator-owned helper to clear profile resume and rerun server-selection startup after a manual profile switch', async () => {
        const { coordinator, deps, callbacks } = makeCoordinator();
        const plexDiscovery = deps.plexDiscovery as unknown as {
            initialize: jest.Mock;
            isConnected: jest.Mock;
        };

        const order: string[] = [];
        const originalClearProfileResume = coordinator.clearProfileResume.bind(coordinator);
        const clearProfileResumeSpy = jest
            .spyOn(coordinator, 'clearProfileResume')
            .mockImplementation(() => {
                order.push('clear');
                originalClearProfileResume();
            });

        (callbacks.configureDiscoveryStorage as jest.Mock).mockImplementation(() => {
            order.push('configure');
        });
        plexDiscovery.initialize.mockImplementation(async () => {
            order.push('init');
            return SKIPPED_SAVED_SERVER_RESTORE;
        });
        plexDiscovery.isConnected.mockReturnValue(true);

        await coordinator.resumeStartupAfterProfileSwitch();

        expect(clearProfileResumeSpy).toHaveBeenCalled();
        expect(order[0]).toBe('clear');
        expect(order[1]).toBe('configure');
        expect(order).toContain('init');
    });

    it('clears a stale server-resume listener before the manual profile-switch rerun from server-select', async () => {
        const { coordinator, deps } = makeCoordinator();
        const plexDiscovery = deps.plexDiscovery as unknown as {
            initialize: jest.Mock;
            isConnected: jest.Mock;
            on: jest.Mock;
        };

        const connectionChangeListeners = new Set<(uri: string | null) => void>();
        plexDiscovery.on.mockImplementation((event: string, handler: (uri: string | null) => void) => {
            if (event !== 'connectionChange') {
                return { dispose: jest.fn() };
            }

            connectionChangeListeners.add(handler);
            return {
                dispose: jest.fn(() => {
                    connectionChangeListeners.delete(handler);
                }),
            };
        });

        plexDiscovery.isConnected.mockReturnValue(false);

        await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
        expect(connectionChangeListeners.size).toBe(1);

        const runSpy = jest.spyOn(coordinator, 'runStartup');

        coordinator.prepareForProfileSwitchAttempt();
        expect(connectionChangeListeners.size).toBe(0);

        for (const listener of connectionChangeListeners) {
            listener('http://server.example');
        }
        await Promise.resolve();

        expect(runSpy).not.toHaveBeenCalled();

        plexDiscovery.isConnected.mockReturnValue(true);
        await coordinator.resumeStartupAfterProfileSwitch();

        expect(runSpy).toHaveBeenCalledTimes(1);
        expect(runSpy).toHaveBeenCalledWith(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
    });

    it('reports resumed startup failures only once when profile resume startup rejects', async () => {
        const { coordinator, deps, callbacks } = makeCoordinator({
            lifecycle: {
                setPhase: jest.fn(),
            } as unknown as LegacyInitializationDependencies['lifecycle'],
            channelManager: {
                loadChannels: jest.fn().mockResolvedValue(undefined),
                getCurrentChannel: jest.fn().mockReturnValue({ id: 'current-channel-id' }),
                getAllChannels: jest.fn().mockReturnValue([]),
            } as unknown as LegacyInitializationDependencies['channelManager'],
        });

        const plexAuth = deps.plexAuth as unknown as {
            readStoredCredentialsAndClearCorruption: jest.Mock;
            validateToken: jest.Mock;
            getHomeUsers: jest.Mock;
            on: jest.Mock;
        };
        const plexDiscovery = deps.plexDiscovery as unknown as {
            initialize: jest.Mock;
            isConnected: jest.Mock;
        };
        const navigation = deps.navigation as unknown as {
            getCurrentScreen: jest.Mock;
        };

        let profileChangeHandler: (() => void) | null = null;
        plexAuth.on.mockImplementation((event: string, handler: () => void) => {
            if (event === 'profileChange') {
                profileChangeHandler = handler;
            }
            return { dispose: jest.fn() };
        });

        plexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(
            createStoredCredentials('active-token', 'account-token')
        );
        plexAuth.validateToken.mockResolvedValue(true);
        plexAuth.getHomeUsers.mockResolvedValue([
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: false },
        ]);
        plexDiscovery.initialize.mockResolvedValue(SKIPPED_SAVED_SERVER_RESTORE);
        plexDiscovery.isConnected.mockReturnValue(true);
        navigation.getCurrentScreen.mockReturnValue('auth');
        (callbacks.switchToChannel as jest.Mock).mockRejectedValueOnce(new Error('route failed'));

        const runSpy = jest.spyOn(coordinator, 'runStartup');

        await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE);
        expect(profileChangeHandler).toBeTruthy();

        if (!profileChangeHandler) {
            throw new Error('Expected profileChange handler to be registered');
        }
        const resumeHandler = profileChangeHandler as () => void;
        resumeHandler();

        const resumeCallIndex = runSpy.mock.calls.findIndex((args) => args[0] === STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
        expect(resumeCallIndex).toBeGreaterThanOrEqual(0);

        const resumePromise = runSpy.mock.results[resumeCallIndex]?.value as Promise<void>;
        await expect(resumePromise).rejects.toThrow('route failed');
        await Promise.resolve();

        expect(callbacks.handleGlobalError).toHaveBeenCalledTimes(1);
        expect(callbacks.handleGlobalError).toHaveBeenCalledWith(
            expect.objectContaining({
                code: 'INITIALIZATION_FAILED',
                message: 'route failed',
                recoverable: true,
            }),
            'start'
        );
        expect(callbacks.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'initialization.resume.afterServerSelection',
            'Background startup resume after server selection failed',
            expect.any(Error)
        );
        expect(callbacks.reportRecoverableAsyncFailure).toHaveBeenCalledTimes(1);
    });

    it('swallows diagnostics failures when resumed startup reporting throws', async () => {
        const { coordinator, deps, callbacks } = makeCoordinator({
            lifecycle: {
                setPhase: jest.fn(),
            } as unknown as LegacyInitializationDependencies['lifecycle'],
            channelManager: {
                loadChannels: jest.fn().mockResolvedValue(undefined),
                getCurrentChannel: jest.fn().mockReturnValue({ id: 'current-channel-id' }),
                getAllChannels: jest.fn().mockReturnValue([]),
            } as unknown as LegacyInitializationDependencies['channelManager'],
        });

        const plexAuth = deps.plexAuth as unknown as {
            readStoredCredentialsAndClearCorruption: jest.Mock;
            validateToken: jest.Mock;
            getHomeUsers: jest.Mock;
            on: jest.Mock;
        };
        const plexDiscovery = deps.plexDiscovery as unknown as {
            initialize: jest.Mock;
            isConnected: jest.Mock;
        };
        const navigation = deps.navigation as unknown as {
            getCurrentScreen: jest.Mock;
        };

        let profileChangeHandler: (() => void) | null = null;
        plexAuth.on.mockImplementation((event: string, handler: () => void) => {
            if (event === 'profileChange') {
                profileChangeHandler = handler;
            }
            return { dispose: jest.fn() };
        });

        plexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(
            createStoredCredentials('active-token', 'account-token')
        );
        plexAuth.validateToken.mockResolvedValue(true);
        plexAuth.getHomeUsers.mockResolvedValue([
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: false },
        ]);
        plexDiscovery.initialize.mockResolvedValue(SKIPPED_SAVED_SERVER_RESTORE);
        plexDiscovery.isConnected.mockReturnValue(true);
        navigation.getCurrentScreen.mockReturnValue('auth');
        (callbacks.switchToChannel as jest.Mock).mockRejectedValueOnce(new Error('route failed'));
        (callbacks.reportRecoverableAsyncFailure as jest.Mock).mockImplementation(() => {
            throw new Error('diagnostics failed');
        });
        const runSpy = jest.spyOn(coordinator, 'runStartup');

        await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE);
        expect(profileChangeHandler).toBeTruthy();

        expect(() => {
            profileChangeHandler?.();
        }).not.toThrow();

        const resumeCallIndex = runSpy.mock.calls.findIndex((args) => args[0] === STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
        expect(resumeCallIndex).toBeGreaterThanOrEqual(0);

        const resumePromise = runSpy.mock.results[resumeCallIndex]?.value as Promise<void>;
        await expect(resumePromise).rejects.toThrow('route failed');
        await Promise.resolve();

        expect(callbacks.handleGlobalError).toHaveBeenCalledTimes(1);
        expect(callbacks.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'initialization.resume.afterServerSelection',
            'Background startup resume after server selection failed',
            expect.any(Error)
        );
    });

    describe('server connection startup policy branches', () => {
        it('marks discovery error, navigates to server-select, and does not register server resume when discovery init fails', async () => {
            const { coordinator, deps, callbacks } = makeCoordinator();
            const navigation = deps.navigation as unknown as { goTo: jest.Mock };
            const plexDiscovery = deps.plexDiscovery as unknown as {
                initialize: jest.Mock;
                on: jest.Mock;
            };

            plexDiscovery.initialize.mockRejectedValue(new Error('discovery init failed'));

            await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);

            expect(callbacks.updateModuleStatus).toHaveBeenCalledWith(
                'plex-server-discovery',
                'error',
                expect.objectContaining({
                    code: 'MODULE_INIT_FAILED',
                    message: 'discovery init failed',
                    recoverable: true,
                })
            );
            expect(navigation.goTo).toHaveBeenCalledWith('server-select');
            expect(plexDiscovery.on).not.toHaveBeenCalled();
        });

        it.each([
            AppErrorCode.AUTH_INVALID,
            AppErrorCode.AUTH_REQUIRED,
            AppErrorCode.AUTH_EXPIRED,
        ])('routes %s discovery auth failures through global auth recovery instead of server-select', async (code) => {
            const { coordinator, deps, callbacks } = makeCoordinator();
            const navigation = deps.navigation as unknown as { goTo: jest.Mock };
            const plexAuth = deps.plexAuth as unknown as {
                on: jest.Mock;
            };
            const plexDiscovery = deps.plexDiscovery as unknown as {
                initialize: jest.Mock;
                on: jest.Mock;
            };
            const authError = new PlexApiError(
                code,
                'cloud discovery credentials rejected',
                401,
                false
            );

            plexDiscovery.initialize.mockRejectedValue(authError);

            await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);

            expect(callbacks.updateModuleStatus).toHaveBeenCalledWith(
                'plex-server-discovery',
                'error',
                expect.objectContaining({
                    code,
                    message: 'cloud discovery credentials rejected',
                    recoverable: true,
                })
            );
            expect(callbacks.handleGlobalError).toHaveBeenCalledWith(
                expect.objectContaining({
                    code,
                    message: 'cloud discovery credentials rejected',
                    recoverable: true,
                }),
                'plex-server-discovery'
            );
            expect(plexAuth.on).toHaveBeenCalledWith('authChange', expect.any(Function));
            expect(navigation.goTo).toHaveBeenCalledWith('auth');
            expect(navigation.goTo).not.toHaveBeenCalledWith('server-select');
            expect(plexDiscovery.on).not.toHaveBeenCalled();
        });

        it('marks statuses pending, registers server resume, and navigates to server-select when discovery is disconnected', async () => {
            const { coordinator, deps, callbacks } = makeCoordinator();
            const navigation = deps.navigation as unknown as { goTo: jest.Mock };
            const plexDiscovery = deps.plexDiscovery as unknown as {
                initialize: jest.Mock;
                isConnected: jest.Mock;
                on: jest.Mock;
            };

            plexDiscovery.initialize.mockResolvedValue(SKIPPED_SAVED_SERVER_RESTORE);
            plexDiscovery.isConnected.mockReturnValue(false);

            await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);

            expect(callbacks.updateModuleStatus).toHaveBeenCalledWith(
                'plex-server-discovery',
                'pending',
                undefined,
                expect.any(Number)
            );
            expect(callbacks.updateModuleStatus).toHaveBeenCalledWith(
                'plex-library',
                'pending',
                undefined,
                expect.any(Number)
            );
            expect(callbacks.updateModuleStatus).toHaveBeenCalledWith(
                'plex-stream-resolver',
                'pending',
                undefined,
                expect.any(Number)
            );
            expect(plexDiscovery.on).toHaveBeenCalledWith('connectionChange', expect.any(Function));
            expect(navigation.goTo).toHaveBeenCalledWith('server-select');
        });
    });

    it('initializes core player UI before marking startup ready after runtime module resume', async () => {
        const callOrder: string[] = [];
        const startupUiInitializer = {
            ensureCorePlayerUiInitialized: jest.fn().mockImplementation(async () => {
                callOrder.push('core-player-ui');
            }),
        } as unknown as LegacyInitializationDependencies['startupUiInitializer'];
        const { coordinator, callbacks } = makeCoordinator({
            startupUiInitializer,
        });

        (callbacks.setReady as jest.Mock).mockImplementation((ready: boolean) => {
            if (ready) {
                callOrder.push('ready-true');
            }
        });

        await coordinator.runStartup(STARTUP_PHASE.RESUME_RUNTIME_MODULES);

        expect(callOrder).toEqual([
            'core-player-ui',
            'ready-true',
        ]);
    });

    describe('playback runtime module status sequencing', () => {
        const statusLabel = (id: string, status: string): string => `status:${id}:${status}`;
        const initLabel = (id: string): string => `init:${id}`;
        const requireOrderIndex = (order: string[], label: string): number => {
            const index = order.indexOf(label);
            expect(index).not.toBe(-1);
            return index;
        };

        it('publishes initializing before and ready after wrapped runtime initializers with existing module ids', async () => {
            const order: string[] = [];
            const wrappedModuleIds = [
                'channel-manager',
                'video-player',
                'player-osd-ui',
                'channel-number-overlay-ui',
                'channel-badge-ui',
                'mini-guide-ui',
                'channel-transition-ui',
            ];
            const { coordinator, callbacks } = makeCoordinator({
                channelManager: {
                    loadChannels: jest.fn(async () => {
                        order.push(initLabel('channel-manager'));
                    }),
                    getCurrentChannel: jest.fn().mockReturnValue(null),
                    getAllChannels: jest.fn().mockReturnValue([]),
                } as unknown as LegacyInitializationDependencies['channelManager'],
                scheduler: {} as unknown as LegacyInitializationDependencies['scheduler'],
                videoPlayer: {
                    initialize: jest.fn(async () => {
                        order.push(initLabel('video-player'));
                    }),
                    requestMediaSession: jest.fn(),
                } as unknown as LegacyInitializationDependencies['videoPlayer'],
                playerOsd: {
                    initialize: jest.fn(() => {
                        order.push(initLabel('player-osd-ui'));
                    }),
                } as unknown as LegacyInitializationDependencies['playerOsd'],
                channelNumberOverlay: {
                    initialize: jest.fn(() => {
                        order.push(initLabel('channel-number-overlay-ui'));
                    }),
                } as unknown as LegacyInitializationDependencies['channelNumberOverlay'],
                channelBadgeOverlay: {
                    initialize: jest.fn(() => {
                        order.push(initLabel('channel-badge-ui'));
                    }),
                } as unknown as LegacyInitializationDependencies['channelBadgeOverlay'],
                miniGuide: {
                    initialize: jest.fn(() => {
                        order.push(initLabel('mini-guide-ui'));
                    }),
                } as unknown as LegacyInitializationDependencies['miniGuide'],
                channelTransition: {
                    initialize: jest.fn(() => {
                        order.push(initLabel('channel-transition-ui'));
                    }),
                } as unknown as LegacyInitializationDependencies['channelTransition'],
            });
            (callbacks.updateModuleStatus as jest.Mock).mockImplementation((id: string, status: string) => {
                order.push(statusLabel(id, status));
            });

            await coordinator.runStartup(STARTUP_PHASE.RESUME_RUNTIME_MODULES);

            for (const id of wrappedModuleIds) {
                const initializingIndex = requireOrderIndex(order, statusLabel(id, 'initializing'));
                const initIndex = requireOrderIndex(order, initLabel(id));
                const readyIndex = requireOrderIndex(order, statusLabel(id, 'ready'));
                expect(initializingIndex).toBeLessThan(initIndex);
                expect(initIndex).toBeLessThan(readyIndex);
            }
            expect(callbacks.updateModuleStatus).toHaveBeenCalledWith(
                'channel-scheduler',
                'ready',
                undefined,
                expect.any(Number)
            );
            expect(callbacks.updateModuleStatus).not.toHaveBeenCalledWith('channel-scheduler', 'initializing');
        });

        it('reports later runtime load times from the shared playback-runtime start time', async () => {
            let now = 1000;
            const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
            const { coordinator, callbacks } = makeCoordinator({
                channelManager: {
                    loadChannels: jest.fn().mockResolvedValue(undefined),
                    getCurrentChannel: jest.fn().mockReturnValue(null),
                    getAllChannels: jest.fn().mockReturnValue([]),
                } as unknown as LegacyInitializationDependencies['channelManager'],
                channelBadgeOverlay: {
                    initialize: jest.fn(() => {
                        now = 1200;
                    }),
                } as unknown as LegacyInitializationDependencies['channelBadgeOverlay'],
                miniGuide: {
                    initialize: jest.fn(() => {
                        now = 1250;
                    }),
                } as unknown as LegacyInitializationDependencies['miniGuide'],
            });

            try {
                await coordinator.runStartup(STARTUP_PHASE.RESUME_RUNTIME_MODULES);
            } finally {
                dateNowSpy.mockRestore();
            }

            expect(callbacks.updateModuleStatus).toHaveBeenCalledWith(
                'mini-guide-ui',
                'ready',
                undefined,
                250
            );
        });

        it('keeps channel scheduler disabled without initialization ceremony when missing', async () => {
            const { coordinator, callbacks } = makeCoordinator();

            await coordinator.runStartup(STARTUP_PHASE.RESUME_RUNTIME_MODULES);

            expect(callbacks.updateModuleStatus).toHaveBeenCalledWith('channel-scheduler', 'disabled');
            expect(callbacks.updateModuleStatus).not.toHaveBeenCalledWith('channel-scheduler', 'initializing');
            expect(callbacks.updateModuleStatus).not.toHaveBeenCalledWith(
                'channel-scheduler',
                'ready',
                undefined,
                expect.any(Number)
            );
        });

        it('does not publish statuses for missing optional runtime modules', async () => {
            const { coordinator, callbacks } = makeCoordinator();
            const missingOptionalIds = [
                'channel-manager',
                'video-player',
                'player-osd-ui',
                'channel-number-overlay-ui',
                'channel-badge-ui',
                'mini-guide-ui',
                'channel-transition-ui',
            ];

            await coordinator.runStartup(STARTUP_PHASE.RESUME_RUNTIME_MODULES);

            for (const id of missingOptionalIds) {
                expect(callbacks.updateModuleStatus).not.toHaveBeenCalledWith(id, 'initializing');
                expect(callbacks.updateModuleStatus).not.toHaveBeenCalledWith(
                    id,
                    'ready',
                    undefined,
                    expect.any(Number)
                );
            }
        });

        it('does not publish ready when a wrapped runtime initializer throws', async () => {
            const { coordinator, callbacks } = makeCoordinator({
                playerOsd: {
                    initialize: jest.fn(() => {
                        throw new Error('osd failed');
                    }),
                } as unknown as LegacyInitializationDependencies['playerOsd'],
            });

            await expect(coordinator.runStartup(STARTUP_PHASE.RESUME_RUNTIME_MODULES)).rejects.toThrow('osd failed');

            expect(callbacks.updateModuleStatus).toHaveBeenCalledWith('player-osd-ui', 'initializing');
            expect(callbacks.updateModuleStatus).not.toHaveBeenCalledWith(
                'player-osd-ui',
                'ready',
                undefined,
                expect.any(Number)
            );
        });

        it('requests media session after video player initialize and before video-player ready', async () => {
            const order: string[] = [];
            const videoPlayer = {
                initialize: jest.fn(async () => {
                    order.push('video-player-initialize');
                }),
                requestMediaSession: jest.fn(() => {
                    order.push('request-media-session');
                }),
            } as unknown as LegacyInitializationDependencies['videoPlayer'];
            const { coordinator, callbacks } = makeCoordinator({
                videoPlayer,
            });
            (callbacks.updateModuleStatus as jest.Mock).mockImplementation((id: string, status: string) => {
                if (id === 'video-player' && status === 'ready') {
                    order.push('video-player-ready');
                }
            });

            await coordinator.runStartup(STARTUP_PHASE.RESUME_RUNTIME_MODULES);

            expect(order).toEqual([
                'video-player-initialize',
                'request-media-session',
                'video-player-ready',
            ]);
        });
    });

    it('awaits EPG initialization before marking rerun startup ready', async () => {
        const callOrder: string[] = [];
        const epg = {
            initialize: jest.fn(() => {
                callOrder.push('epg-initialize');
            }),
        } as unknown as LegacyInitializationDependencies['epg'];
        const epgReadiness = {
            ensureReady: jest.fn(async () => {
                callOrder.push('epg-ready');
            }),
        } as NonNullable<LegacyInitializationDependencies['epgReadiness']>;
        const { coordinator, deps, callbacks } = makeCoordinator({
            epg,
            epgReadiness,
        });
        const plexDiscovery = deps.plexDiscovery as unknown as {
            initialize: jest.Mock;
            isConnected: jest.Mock;
        };

        plexDiscovery.initialize.mockResolvedValue(SKIPPED_SAVED_SERVER_RESTORE);
        plexDiscovery.isConnected.mockReturnValue(true);
        (callbacks.setReady as jest.Mock).mockImplementation((ready: boolean) => {
            if (ready) {
                callOrder.push('ready-true');
            }
        });

        await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);

        expect(callOrder).toEqual([
            'epg-initialize',
            'epg-ready',
            'ready-true',
        ]);
    });

    it('does not publish ready or run post-ready routing before a queued rerun becomes the final pass', async () => {
        const { coordinator, callbacks, deps } = makeCoordinator();
        const navigation = deps.navigation as unknown as {
            replaceScreen: jest.Mock;
            goTo: jest.Mock;
            getCurrentScreen: jest.Mock;
        };
        const plexAuth = deps.plexAuth as unknown as {
            readStoredCredentialsAndClearCorruption: jest.Mock;
            validateToken: jest.Mock;
            getHomeUsers: jest.Mock;
            on: jest.Mock;
        };
        const plexDiscovery = deps.plexDiscovery as unknown as {
            initialize: jest.Mock;
            isConnected: jest.Mock;
            on: jest.Mock;
        };

        let profileChangeHandler: (() => void) | null = null;
        plexAuth.on.mockImplementation((event: string, handler: () => void) => {
            if (event === 'profileChange') {
                profileChangeHandler = handler;
            }
            return { dispose: jest.fn() };
        });

        plexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(
            createStoredCredentials('active-token', 'account-token')
        );
        plexAuth.validateToken.mockResolvedValue(true);
        plexAuth.getHomeUsers.mockResolvedValue([
            { id: '1', title: 'Admin', thumb: null, admin: true, protected: false },
            { id: '2', title: 'Kid', thumb: null, admin: false, protected: false },
        ]);
        plexDiscovery.initialize.mockResolvedValue(SKIPPED_SAVED_SERVER_RESTORE);
        plexDiscovery.isConnected.mockReturnValue(true);
        navigation.getCurrentScreen.mockReturnValue('auth');

        await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE);

        expect(callbacks.setupEventWiring).not.toHaveBeenCalled();
        expect(callbacks.setReady).not.toHaveBeenCalledWith(true);
        expect(profileChangeHandler).toBeTruthy();

        let releaseDiscoveryInitialize: (() => void) | null = null;
        let initializeCallCount = 0;
        plexDiscovery.initialize.mockImplementation(() => {
            initializeCallCount += 1;
            if (initializeCallCount === 1) {
                return new Promise<typeof SKIPPED_SAVED_SERVER_RESTORE>((resolve) => {
                    releaseDiscoveryInitialize = (): void => resolve(SKIPPED_SAVED_SERVER_RESTORE);
                });
            }
            return Promise.resolve(SKIPPED_SAVED_SERVER_RESTORE);
        });

        const runPromise = coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
        await Promise.resolve();

        expect(callbacks.setupEventWiring).not.toHaveBeenCalled();
        expect(callbacks.setReady).not.toHaveBeenCalledWith(true);

        if (!profileChangeHandler) {
            throw new Error('Expected profileChange handler to be registered');
        }
        (profileChangeHandler as unknown as () => void)();
        if (releaseDiscoveryInitialize) {
            (releaseDiscoveryInitialize as unknown as () => void)();
        }
        await runPromise;

        expect(callbacks.setupEventWiring).toHaveBeenCalledTimes(1);
        expect(callbacks.setReady).toHaveBeenCalledWith(true);
    });

    it('does not resolve queued startup callers until final ready work completes', async () => {
        const { coordinator, callbacks, deps } = makeCoordinator();
        const plexAuth = deps.plexAuth as unknown as {
            readStoredCredentialsAndClearCorruption: jest.Mock;
            validateToken: jest.Mock;
        };
        const plexDiscovery = deps.plexDiscovery as unknown as {
            initialize: jest.Mock;
            isConnected: jest.Mock;
        };

        plexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(
            createStoredCredentials('active-token', 'account-token')
        );
        plexAuth.validateToken.mockResolvedValue(true);

        let releaseDiscoveryInitialize: (() => void) | null = null;
        plexDiscovery.initialize.mockImplementation(
            () =>
                new Promise<typeof SKIPPED_SAVED_SERVER_RESTORE>((resolve) => {
                    releaseDiscoveryInitialize = (): void => resolve(SKIPPED_SAVED_SERVER_RESTORE);
                })
        );
        plexDiscovery.isConnected.mockReturnValue(true);

        let setupEventWiringCompleted = false;
        let setupEventWiringWasCompleteWhenQueuedResolved: boolean | null = null;
        (callbacks.setupEventWiring as jest.Mock).mockImplementation(() => {
            setupEventWiringCompleted = true;
        });

        const firstRunPromise = coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
        const queuedRunPromise = coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY);
        void queuedRunPromise.then(() => {
            setupEventWiringWasCompleteWhenQueuedResolved = setupEventWiringCompleted;
        });

        expect(releaseDiscoveryInitialize).toBeTruthy();
        if (!releaseDiscoveryInitialize) {
            throw new Error('Expected discovery initialize gate to be registered');
        }
        const resolveDiscoveryInitialize: () => void = releaseDiscoveryInitialize;
        resolveDiscoveryInitialize();
        await firstRunPromise;
        await queuedRunPromise;

        expect(setupEventWiringCompleted).toBe(true);
        expect(setupEventWiringWasCompleteWhenQueuedResolved).toBe(true);
    });

    it('rejects caller-aborted server-selection resumes without completing startup side effects', async () => {
        const abortReason = new DOMException('server selection hidden', 'AbortError');
        const controller = new AbortController();
        const { coordinator, callbacks, deps } = makeCoordinator();
        const plexDiscovery = deps.plexDiscovery as unknown as {
            initialize: jest.Mock;
            isConnected: jest.Mock;
        };

        let releaseDiscoveryInitialize: (() => void) | null = null;
        plexDiscovery.initialize.mockImplementation(
            () =>
                new Promise<typeof SKIPPED_SAVED_SERVER_RESTORE>((resolve) => {
                    releaseDiscoveryInitialize = (): void => resolve(SKIPPED_SAVED_SERVER_RESTORE);
                })
        );
        plexDiscovery.isConnected.mockReturnValue(true);

        const resume = coordinator.runStartup(
            STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION,
            { signal: controller.signal }
        );
        await Promise.resolve();

        expect(releaseDiscoveryInitialize).toBeTruthy();
        controller.abort(abortReason);
        (releaseDiscoveryInitialize as unknown as () => void)();

        await expect(resume).rejects.toBe(abortReason);
        expect(plexDiscovery.initialize).toHaveBeenCalledWith({ signal: controller.signal });
        expect(callbacks.setupEventWiring).not.toHaveBeenCalled();
        expect(callbacks.setReady).not.toHaveBeenCalledWith(true);
        expect(callbacks.handleGlobalError).not.toHaveBeenCalled();
    });

    it('rejects queued startup waiters when their caller aborts before the queued pass runs', async () => {
        const abortReason = new DOMException('queued startup hidden', 'AbortError');
        const controller = new AbortController();
        const { coordinator, deps } = makeCoordinator();
        const plexDiscovery = deps.plexDiscovery as unknown as {
            initialize: jest.Mock;
            isConnected: jest.Mock;
        };

        let releaseDiscoveryInitialize: (() => void) | null = null;
        plexDiscovery.initialize.mockImplementation(
            () =>
                new Promise<typeof SKIPPED_SAVED_SERVER_RESTORE>((resolve) => {
                    releaseDiscoveryInitialize = (): void => resolve(SKIPPED_SAVED_SERVER_RESTORE);
                })
        );
        plexDiscovery.isConnected.mockReturnValue(true);

        const firstRun = coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
        const queuedRun = coordinator.runStartup(
            STARTUP_PHASE.RESUME_EPG_ONLY,
            { signal: controller.signal }
        );

        controller.abort(abortReason);
        await expect(queuedRun).rejects.toBe(abortReason);

        expect(releaseDiscoveryInitialize).toBeTruthy();
        (releaseDiscoveryInitialize as unknown as () => void)();
        await expect(firstRun).resolves.toBeUndefined();
    });

    it('cancels queued startup work when its caller aborts after the queued phase is consumed', async () => {
        const abortReason = new DOMException('queued startup hidden', 'AbortError');
        const controller = new AbortController();
        let releaseAuthValidation: (() => void) | null = null;
        let releaseEpgReady: (() => void) | null = null;
        let markEpgReadyWaitStarted: (() => void) | null = null;
        let markValidateTokenStarted: (() => void) | null = null;
        const validateTokenStarted = new Promise<void>((resolve) => {
            markValidateTokenStarted = resolve;
        });
        const epgReadyWaitStarted = new Promise<void>((resolve) => {
            markEpgReadyWaitStarted = resolve;
        });
        const { coordinator, callbacks, deps } = makeCoordinator({
            epg: {
                initialize: jest.fn(),
            } as unknown as LegacyInitializationDependencies['epg'],
            epgReadiness: {
                ensureReady: jest.fn(() =>
                    new Promise<void>((resolve) => {
                        releaseEpgReady = resolve;
                        markEpgReadyWaitStarted?.();
                    })
                ),
            } as unknown as LegacyInitializationDependencies['epgReadiness'],
        });
        const plexDiscovery = deps.plexDiscovery as unknown as {
            initialize: jest.Mock;
            isConnected: jest.Mock;
        };
        const plexAuth = deps.plexAuth as unknown as {
            readStoredCredentialsAndClearCorruption: jest.Mock;
            validateToken: jest.Mock;
        };

        plexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(
            createStoredCredentials('active-token', 'account-token')
        );
        plexAuth.validateToken.mockImplementation(
            () =>
                new Promise<boolean>((resolve) => {
                    releaseAuthValidation = (): void => resolve(true);
                    markValidateTokenStarted?.();
                })
        );
        plexDiscovery.initialize.mockResolvedValue(SKIPPED_SAVED_SERVER_RESTORE);
        plexDiscovery.isConnected.mockReturnValue(true);

        const firstRun = coordinator.runStartup(STARTUP_PHASE.FULL_STARTUP);
        await validateTokenStarted;

        const queuedRun = coordinator.runStartup(
            STARTUP_PHASE.RESUME_EPG_ONLY,
            { signal: controller.signal }
        );
        const firstRunExpectation = expect(firstRun).rejects.toBe(abortReason);
        const queuedRunExpectation = expect(queuedRun).rejects.toBe(abortReason);

        (releaseAuthValidation as unknown as () => void)();
        await epgReadyWaitStarted;

        controller.abort(abortReason);
        (releaseEpgReady as unknown as () => void)();

        await firstRunExpectation;
        await queuedRunExpectation;
        expect(callbacks.setupEventWiring).not.toHaveBeenCalled();
        expect(callbacks.setReady).not.toHaveBeenCalledWith(true);
        expect(callbacks.handleGlobalError).not.toHaveBeenCalled();
        expect(
            (callbacks.updateModuleStatus as jest.Mock).mock.calls.some(
                ([id, status]) => id === 'epg-ui' && status === 'error'
            )
        ).toBe(false);
    });

    it('uses a same-phase queued waiter with a caller signal as the consumed startup owner', async () => {
        const abortReason = new DOMException('queued startup hidden', 'AbortError');
        const controller = new AbortController();
        let releaseAuthValidation: (() => void) | null = null;
        let releaseEpgReady: (() => void) | null = null;
        let markEpgReadyWaitStarted: (() => void) | null = null;
        const epgReadyWaitStarted = new Promise<void>((resolve) => {
            markEpgReadyWaitStarted = resolve;
        });
        const { coordinator, callbacks, deps } = makeCoordinator({
            epg: {
                initialize: jest.fn(),
            } as unknown as LegacyInitializationDependencies['epg'],
            epgReadiness: {
                ensureReady: jest.fn(() =>
                    new Promise<void>((resolve) => {
                        releaseEpgReady = resolve;
                        markEpgReadyWaitStarted?.();
                    })
                ),
            } as unknown as LegacyInitializationDependencies['epgReadiness'],
        });
        const plexDiscovery = deps.plexDiscovery as unknown as {
            initialize: jest.Mock;
            isConnected: jest.Mock;
        };
        const plexAuth = deps.plexAuth as unknown as {
            readStoredCredentialsAndClearCorruption: jest.Mock;
            validateToken: jest.Mock;
        };

        plexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(
            createStoredCredentials('active-token', 'account-token')
        );
        plexAuth.validateToken.mockImplementation(
            () =>
                new Promise<boolean>((resolve) => {
                    releaseAuthValidation = (): void => resolve(true);
                })
        );
        plexDiscovery.initialize.mockResolvedValue(SKIPPED_SAVED_SERVER_RESTORE);
        plexDiscovery.isConnected.mockReturnValue(true);

        const firstRun = coordinator.runStartup(STARTUP_PHASE.FULL_STARTUP);
        for (let attempt = 0; attempt < 5 && !releaseAuthValidation; attempt += 1) {
            await Promise.resolve();
        }
        expect(releaseAuthValidation).toBeTruthy();

        const signalLessQueuedRun = coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY);
        const signalOwnedQueuedRun = coordinator.runStartup(
            STARTUP_PHASE.RESUME_EPG_ONLY,
            { signal: controller.signal }
        );

        const firstRunExpectation = expect(firstRun).rejects.toBe(abortReason);
        const signalLessQueuedRunExpectation = expect(signalLessQueuedRun).rejects.toBe(abortReason);
        const signalOwnedQueuedRunExpectation = expect(signalOwnedQueuedRun).rejects.toBe(abortReason);

        (releaseAuthValidation as unknown as () => void)();
        await epgReadyWaitStarted;

        controller.abort(abortReason);
        (releaseEpgReady as unknown as () => void)();

        await firstRunExpectation;
        await signalLessQueuedRunExpectation;
        await signalOwnedQueuedRunExpectation;
        expect(callbacks.setupEventWiring).not.toHaveBeenCalled();
        expect(callbacks.setReady).not.toHaveBeenCalledWith(true);
        expect(callbacks.handleGlobalError).not.toHaveBeenCalled();
    });

    it('reports abort-like startup failures when no caller signal requested cancellation', async () => {
        const abortError = new DOMException('internal channel load abort', 'AbortError');
        const { coordinator, callbacks } = makeCoordinator({
            channelManager: {
                loadChannels: jest.fn().mockRejectedValue(abortError),
                getCurrentChannel: jest.fn().mockReturnValue(null),
                getAllChannels: jest.fn().mockReturnValue([]),
            } as unknown as LegacyInitializationDependencies['channelManager'],
        });

        await expect(
            coordinator.runStartup(STARTUP_PHASE.RESUME_RUNTIME_MODULES)
        ).rejects.toBe(abortError);

        expect(callbacks.handleGlobalError).toHaveBeenCalledWith(
            {
                code: AppErrorCode.INITIALIZATION_FAILED,
                message: 'internal channel load abort',
                recoverable: true,
            },
            'start'
        );
    });

    it('reports non-abort startup failures that race with caller cancellation', async () => {
        const controller = new AbortController();
        const startupError = new Error('channel load failed after abort');
        const { coordinator, callbacks } = makeCoordinator({
            channelManager: {
                loadChannels: jest.fn().mockImplementation(async () => {
                    controller.abort(new DOMException('server selection hidden', 'AbortError'));
                    throw startupError;
                }),
                getCurrentChannel: jest.fn().mockReturnValue(null),
                getAllChannels: jest.fn().mockReturnValue([]),
            } as unknown as LegacyInitializationDependencies['channelManager'],
        });

        await expect(
            coordinator.runStartup(STARTUP_PHASE.RESUME_RUNTIME_MODULES, { signal: controller.signal })
        ).rejects.toBe(startupError);

        expect(callbacks.handleGlobalError).toHaveBeenCalledWith(
            {
                code: AppErrorCode.INITIALIZATION_FAILED,
                message: 'channel load failed after abort',
                recoverable: true,
            },
            'start'
        );
    });

    it('reports internal abort-like startup failures that race with caller cancellation', async () => {
        const controller = new AbortController();
        const startupError = new DOMException('internal channel load abort after caller abort', 'AbortError');
        const { coordinator, callbacks } = makeCoordinator({
            channelManager: {
                loadChannels: jest.fn().mockImplementation(async () => {
                    controller.abort(new DOMException('server selection hidden', 'AbortError'));
                    throw startupError;
                }),
                getCurrentChannel: jest.fn().mockReturnValue(null),
                getAllChannels: jest.fn().mockReturnValue([]),
            } as unknown as LegacyInitializationDependencies['channelManager'],
        });

        await expect(
            coordinator.runStartup(STARTUP_PHASE.RESUME_RUNTIME_MODULES, { signal: controller.signal })
        ).rejects.toBe(startupError);

        expect(callbacks.handleGlobalError).toHaveBeenCalledWith(
            {
                code: AppErrorCode.INITIALIZATION_FAILED,
                message: 'internal channel load abort after caller abort',
                recoverable: true,
            },
            'start'
        );
    });

    it('cancels a pending warmup timer when a rerun eagerly initializes EPG', async () => {
        jest.useFakeTimers();
        const epg = {
            initialize: jest.fn(),
        } as unknown as LegacyInitializationDependencies['epg'];
        const epgReadiness = {
            ensureReady: jest.fn(async () => undefined),
        } as NonNullable<LegacyInitializationDependencies['epgReadiness']>;
        const { coordinator, deps } = makeCoordinator({
            epg,
            epgReadiness,
        });
        const plexAuth = deps.plexAuth as unknown as {
            readStoredCredentialsAndClearCorruption: jest.Mock;
            validateToken: jest.Mock;
        };
        const plexDiscovery = deps.plexDiscovery as unknown as {
            initialize: jest.Mock;
            isConnected: jest.Mock;
        };

        try {
            plexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(
                createStoredCredentials('active-token', 'account-token')
            );
            plexAuth.validateToken.mockResolvedValue(true);
            plexDiscovery.initialize.mockResolvedValue(SKIPPED_SAVED_SERVER_RESTORE);
            plexDiscovery.isConnected.mockReturnValue(true);

            await coordinator.runStartup(STARTUP_PHASE.FULL_STARTUP);
            expect(epgReadiness.ensureReady).not.toHaveBeenCalled();

            await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
            expect(epgReadiness.ensureReady).toHaveBeenCalledTimes(1);

            await jest.advanceTimersByTimeAsync(1500);

            expect(epgReadiness.ensureReady).toHaveBeenCalledTimes(1);
        } finally {
            jest.useRealTimers();
        }
    });

	    describe('post-ready routing policy', () => {
        it('does not schedule deferred EPG warmup when full-startup final routing fails', async () => {
            jest.useFakeTimers();
            const epg = {
                initialize: jest.fn(),
            } as unknown as LegacyInitializationDependencies['epg'];
            const epgReadiness = {
                ensureReady: jest.fn(async () => undefined),
            } as NonNullable<LegacyInitializationDependencies['epgReadiness']>;
            const { coordinator, deps, callbacks } = makeCoordinator({
                epg,
                epgReadiness,
                channelManager: {
                    loadChannels: jest.fn().mockResolvedValue(undefined),
                    getCurrentChannel: jest.fn().mockReturnValue({ id: 'current-channel-id' }),
                    getAllChannels: jest.fn().mockReturnValue([]),
                } as unknown as LegacyInitializationDependencies['channelManager'],
            });
            const plexAuth = deps.plexAuth as unknown as {
                readStoredCredentialsAndClearCorruption: jest.Mock;
                validateToken: jest.Mock;
            };
            const plexDiscovery = deps.plexDiscovery as unknown as {
                initialize: jest.Mock;
                isConnected: jest.Mock;
            };

            try {
                plexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(
                    createStoredCredentials('active-token', 'account-token')
                );
                plexAuth.validateToken.mockResolvedValue(true);
                plexDiscovery.initialize.mockResolvedValue(SKIPPED_SAVED_SERVER_RESTORE);
                plexDiscovery.isConnected.mockReturnValue(true);
                (callbacks.switchToChannel as jest.Mock).mockRejectedValueOnce(new Error('route failed'));

                await expect(coordinator.runStartup(STARTUP_PHASE.FULL_STARTUP)).rejects.toThrow('route failed');
                await jest.advanceTimersByTimeAsync(1500);

                expect((epg as unknown as { initialize: jest.Mock }).initialize).not.toHaveBeenCalled();
                expect(epgReadiness.ensureReady).not.toHaveBeenCalled();
            } finally {
                jest.useRealTimers();
            }
        });

	        it('routes to audio-setup when audio and channel setup are both required', async () => {
	            const { coordinator, deps, callbacks } = makeCoordinator();
	            const navigation = deps.navigation as unknown as { replaceScreen: jest.Mock };

            (callbacks.shouldRunAudioSetup as jest.Mock).mockReturnValue(true);
            (callbacks.shouldRunChannelSetup as jest.Mock).mockReturnValue(true);

            await coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY);

            expect(navigation.replaceScreen).toHaveBeenCalledWith('audio-setup');
        });

	        it('routes to channel-setup when only channel setup is required', async () => {
	            const { coordinator, deps, callbacks } = makeCoordinator();
	            const navigation = deps.navigation as unknown as { replaceScreen: jest.Mock };

            (callbacks.shouldRunAudioSetup as jest.Mock).mockReturnValue(false);
            (callbacks.shouldRunChannelSetup as jest.Mock).mockReturnValue(true);

            await coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY);

	            expect(navigation.replaceScreen).toHaveBeenCalledWith('channel-setup');
	        });

	        it('opens server select when channel manager is unavailable', async () => {
	            const { coordinator, deps, callbacks } = makeCoordinator({
	                channelManager: null,
	            });
	            const navigation = deps.navigation as unknown as { replaceScreen: jest.Mock };

	            await coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY);

	            expect(callbacks.openServerSelect).toHaveBeenCalled();
	            expect(navigation.replaceScreen).not.toHaveBeenCalled();
	        });

        it('routes to player and switches to current channel when present', async () => {
            const currentChannel = { id: 'current-channel-id' };
            const { coordinator, deps, callbacks } = makeCoordinator({
	                channelManager: {
                    getCurrentChannel: jest.fn().mockReturnValue(currentChannel),
                    getAllChannels: jest.fn().mockReturnValue([]),
                } as unknown as LegacyInitializationDependencies['channelManager'],
            });
            const navigation = deps.navigation as unknown as { replaceScreen: jest.Mock };

            await coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY);

            expect(navigation.replaceScreen).toHaveBeenCalledWith('player');
            expect(callbacks.switchToChannel).toHaveBeenCalledWith(currentChannel.id);
            expect(callbacks.openServerSelect).not.toHaveBeenCalled();
        });

        it('does not route to player when caller cancellation wins during initial tune', async () => {
            const abortReason = new DOMException('server selection hidden', 'AbortError');
            const controller = new AbortController();
            const currentChannel = { id: 'current-channel-id' };
            const { coordinator, deps, callbacks } = makeCoordinator({
                channelManager: {
                    getCurrentChannel: jest.fn().mockReturnValue(currentChannel),
                    getAllChannels: jest.fn().mockReturnValue([]),
                } as unknown as LegacyInitializationDependencies['channelManager'],
            });
            const navigation = deps.navigation as unknown as { replaceScreen: jest.Mock };

            (callbacks.switchToChannel as jest.Mock).mockImplementationOnce(async () => {
                controller.abort(abortReason);
                return 'switched';
            });

            await expect(
                coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY, { signal: controller.signal })
            ).rejects.toBe(abortReason);

            expect(callbacks.switchToChannel).toHaveBeenCalledWith(currentChannel.id);
            expect(navigation.replaceScreen).not.toHaveBeenCalledWith('player');
            expect(callbacks.openServerSelect).not.toHaveBeenCalled();
            expect(callbacks.setReady).not.toHaveBeenCalledWith(true);
            expect(callbacks.handleGlobalError).not.toHaveBeenCalled();
        });

        it('routes to player and switches to first channel when no current channel exists', async () => {
            const firstChannel = { id: 'first-channel-id' };
            const { coordinator, deps, callbacks } = makeCoordinator({
                channelManager: {
                    getCurrentChannel: jest.fn().mockReturnValue(null),
                    getAllChannels: jest.fn().mockReturnValue([firstChannel]),
                } as unknown as LegacyInitializationDependencies['channelManager'],
            });
            const navigation = deps.navigation as unknown as { replaceScreen: jest.Mock };

            await coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY);

            expect(navigation.replaceScreen).toHaveBeenCalledWith('player');
            expect(callbacks.switchToChannel).toHaveBeenCalledWith(firstChannel.id);
            expect(callbacks.openServerSelect).not.toHaveBeenCalled();
        });

	        it('opens server select when no channels exist', async () => {
	            const { coordinator, deps, callbacks } = makeCoordinator({
	                channelManager: {
                    getCurrentChannel: jest.fn().mockReturnValue(null),
                    getAllChannels: jest.fn().mockReturnValue([]),
                } as unknown as LegacyInitializationDependencies['channelManager'],
            });
            const navigation = deps.navigation as unknown as { replaceScreen: jest.Mock };

            await coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY);

            expect(navigation.replaceScreen).not.toHaveBeenCalledWith('player');
            expect(callbacks.switchToChannel).not.toHaveBeenCalled();
            expect(callbacks.openServerSelect).toHaveBeenCalled();
	        });

	        it('does not publish ready or ready lifecycle phase when post-ready routing throws', async () => {
	            const lifecycle = {
	                setPhase: jest.fn(),
	            } as unknown as LegacyInitializationDependencies['lifecycle'];
	            const { coordinator, deps, callbacks } = makeCoordinator({
	                lifecycle,
	                channelManager: {
	                    getCurrentChannel: jest.fn().mockReturnValue({ id: 'current-channel-id' }),
	                    getAllChannels: jest.fn().mockReturnValue([]),
	                } as unknown as LegacyInitializationDependencies['channelManager'],
	            });

	            (callbacks.switchToChannel as jest.Mock).mockRejectedValueOnce(new Error('route failed'));

	            await expect(coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY)).rejects.toThrow('route failed');

	            expect(callbacks.setReady).not.toHaveBeenCalledWith(true);
	            expect((deps.lifecycle as unknown as { setPhase: jest.Mock }).setPhase).not.toHaveBeenCalledWith('ready');
	            expect(callbacks.handleGlobalError).toHaveBeenCalledWith(
	                expect.objectContaining({
	                    code: 'INITIALIZATION_FAILED',
	                    message: 'route failed',
	                    recoverable: true,
	                }),
	                'start'
	            );
	        });

	        it('keeps startup ready and routes to channel setup when the initial tune fails', async () => {
	            const lifecycle = {
	                setPhase: jest.fn(),
	            } as unknown as LegacyInitializationDependencies['lifecycle'];
	            const { coordinator, deps, callbacks } = makeCoordinator({
	                lifecycle,
	                channelManager: {
	                    getCurrentChannel: jest.fn().mockReturnValue({ id: 'current-channel-id' }),
	                    getAllChannels: jest.fn().mockReturnValue([]),
	                } as unknown as LegacyInitializationDependencies['channelManager'],
	            });
	            const navigation = deps.navigation as unknown as { replaceScreen: jest.Mock };

	            (callbacks.switchToChannel as jest.Mock).mockResolvedValueOnce('failed');

	            await expect(coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY)).resolves.toBeUndefined();

	            expect(navigation.replaceScreen).toHaveBeenCalledWith('channel-setup');
	            expect(navigation.replaceScreen).not.toHaveBeenCalledWith('player');
	            expect(callbacks.openServerSelect).not.toHaveBeenCalled();
	            expect(callbacks.setReady).toHaveBeenCalledWith(true);
	            expect((deps.lifecycle as unknown as { setPhase: jest.Mock }).setPhase).toHaveBeenCalledWith('ready');
	            expect(callbacks.handleGlobalError).not.toHaveBeenCalled();
	        });

	        it('does not publish ready or open server select when the initial tune aborts', async () => {
	            const lifecycle = {
	                setPhase: jest.fn(),
	            } as unknown as LegacyInitializationDependencies['lifecycle'];
	            const { coordinator, deps, callbacks } = makeCoordinator({
	                lifecycle,
	                channelManager: {
	                    getCurrentChannel: jest.fn().mockReturnValue({ id: 'current-channel-id' }),
	                    getAllChannels: jest.fn().mockReturnValue([]),
	                } as unknown as LegacyInitializationDependencies['channelManager'],
	            });
	            const navigation = deps.navigation as unknown as { replaceScreen: jest.Mock };

	            (callbacks.switchToChannel as jest.Mock).mockResolvedValueOnce('aborted');

	            await expect(coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY)).rejects.toThrow(
	                'Initial channel switch aborted for current-channel-id.'
	            );

            expect(navigation.replaceScreen).not.toHaveBeenCalledWith('player');
            expect(callbacks.openServerSelect).not.toHaveBeenCalled();
            expect(callbacks.setReady).not.toHaveBeenCalledWith(true);
            expect((deps.lifecycle as unknown as { setPhase: jest.Mock }).setPhase).not.toHaveBeenCalledWith('ready');
	            expect(callbacks.handleGlobalError).toHaveBeenCalledWith(
	                expect.objectContaining({
	                    code: 'INITIALIZATION_FAILED',
	                    message: 'Initial channel switch aborted for current-channel-id.',
	                    recoverable: true,
	                }),
	                'start'
	            );
	        });
    });

	    describe('EPG layoutMode fallback injection', () => {
	        it('defaults to classic when storage is unset', async () => {
	            localStorage.removeItem(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE);

            const epg = { initialize: jest.fn() } as unknown as LegacyInitializationDependencies['epg'];
            const { coordinator } = makeCoordinator({ epg, plexLibrary: null });

            await coordinator.ensureEPGInitialized();

	            expect((epg as unknown as { initialize: jest.Mock }).initialize).toHaveBeenCalledWith(
	                expect.objectContaining({ layoutMode: 'classic' })
	            );
	        });

        it('uses overlay only when storage is exactly overlay', async () => {
            localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE, 'overlay');

            const epg = { initialize: jest.fn() } as unknown as LegacyInitializationDependencies['epg'];
            const { coordinator } = makeCoordinator({ epg, plexLibrary: null });

            await coordinator.ensureEPGInitialized();

            expect((epg as unknown as { initialize: jest.Mock }).initialize).toHaveBeenCalledWith(
                expect.objectContaining({ layoutMode: 'overlay' })
            );
        });

	        it('treats invalid stored values as classic', async () => {
	            localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE, 'weird');

            const epg = { initialize: jest.fn() } as unknown as LegacyInitializationDependencies['epg'];
            const { coordinator } = makeCoordinator({ epg, plexLibrary: null });

            await coordinator.ensureEPGInitialized();

	            expect((epg as unknown as { initialize: jest.Mock }).initialize).toHaveBeenCalledWith(
	                expect.objectContaining({ layoutMode: 'classic' })
	            );
	        });

	        it('preserves supplied onLayoutModeChange when shaping EPG config', async () => {
	            const onLayoutModeChange = jest.fn();
	            const epg = { initialize: jest.fn() } as unknown as LegacyInitializationDependencies['epg'];
	            const { coordinator } = makeCoordinator(
	                { epg, plexLibrary: null },
	                { epgConfig: { onLayoutModeChange } as never }
	            );

	            await coordinator.ensureEPGInitialized();

	            const initArg = (epg as unknown as { initialize: jest.Mock }).initialize.mock.calls[0]?.[0] as {
	                onLayoutModeChange?: (mode: EpgLayoutMode) => void;
	            };
	            initArg.onLayoutModeChange?.('classic');

	            expect(onLayoutModeChange).toHaveBeenCalledWith('classic');
	        });

	        it('adds and removes the classic PiP class through startup-policy layout mode callback', async () => {
	            const epg = { initialize: jest.fn() } as unknown as LegacyInitializationDependencies['epg'];
	            const { coordinator } = makeCoordinator({ epg, plexLibrary: null });
            const videoContainer = document.createElement('div');
            videoContainer.id = APP_SHELL_CONTAINER_IDS.VIDEO;
            document.body.appendChild(videoContainer);

	            try {
	                await coordinator.ensureEPGInitialized();

	                const initArg = (epg as unknown as { initialize: jest.Mock }).initialize.mock.calls[0]?.[0] as {
	                    onLayoutModeChange?: (mode: EpgLayoutMode) => void;
	                };
	                initArg.onLayoutModeChange?.('classic');
	                expect(videoContainer.classList.contains(CLASSIC_EPG_PIP_CLASS)).toBe(true);

	                initArg.onLayoutModeChange?.('overlay');
	                expect(videoContainer.classList.contains(CLASSIC_EPG_PIP_CLASS)).toBe(false);
	            } finally {
                videoContainer.remove();
            }
	        });
	    });
	});
