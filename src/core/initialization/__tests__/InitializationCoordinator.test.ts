/**
 * @jest-environment jsdom
 */

import { InitializationCoordinator, STARTUP_PHASE } from '../InitializationCoordinator';
import type { InitializationDependencies, InitializationCallbacks } from '../InitializationCoordinator';
import { CLASSIC_EPG_PIP_CLASS } from '../../../modules/ui/epg';
import type { PlexAuthDataV2, PlexStoredCredentialsReadResult } from '../../../modules/plex/auth';
import { PlexApiError, PlexAuthOperationSupersededError } from '../../../modules/plex/auth';
import { AppErrorCode } from '../../../types/app-errors';
import { CHANNEL_BADGE_CONTAINER_ID } from '../../../modules/ui/channel-badge';
import { EpgPreferencesStore, type EpgLayoutMode } from '../../../modules/settings/EpgPreferencesStore';
import { ProfileSessionStore } from '../../../modules/settings/ProfileSessionStore';
import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { APP_SHELL_CONTAINER_IDS } from '../../../modules/ui/common/appShellContainerIds';
import { PlexDiscoverySelectionContext } from '../../../modules/plex/discovery/PlexDiscoverySelectionContext';
import type { PlexSavedServerRestoreResult } from '../../../modules/plex/discovery';
import { advanceTimersUntil } from '../../../__tests__/helpers';

const SKIPPED_SAVED_SERVER_RESTORE = { kind: 'skipped_no_saved_server' } as const;
const createSelectedSavedServerRestore = (): Extract<
    PlexSavedServerRestoreResult,
    { kind: 'selected' }
> => {
    const context = new PlexDiscoverySelectionContext();
    const receipt = context.issueReceipt(context.capture(), 'selected');
    return { kind: 'selected', serverId: 'server-1', receipt } as const;
};
const createAuthGuard = (): { signal: AbortSignal; assertCurrent: jest.Mock } => ({
    signal: new AbortController().signal,
    assertCurrent: jest.fn(),
});

async function flushUntil(predicate: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        if (predicate()) return;
        await Promise.resolve();
    }
    if (!predicate()) {
        throw new Error('flushUntil: predicate was not satisfied after 10 microtask flushes');
    }
}

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

    type InitializationDependencyOverrides = {
        modules?: Partial<InitializationDependencies['modules']>;
        readiness?: Partial<InitializationDependencies['readiness']>;
        overlays?: Partial<InitializationDependencies['overlays']>;
        startupUiInitializer?: InitializationDependencies['startupUiInitializer'];
        stores?: Partial<InitializationDependencies['stores']>;
    };

    type PlexAuthProfileChangePayload = {
        fromUserId: string | null;
        toUserId: string;
    };
    type PlexAuthOnArgs =
        | ['authChange', (isAuthenticated: boolean) => void]
        | ['profileChange', (payload: PlexAuthProfileChangePayload) => void];
    type MockedPlexAuth = Omit<
        jest.Mocked<NonNullable<InitializationDependencies['modules']['plexAuth']>>,
        'on'
    > & {
        on: jest.MockedFunction<(...args: PlexAuthOnArgs) => { dispose: jest.Mock }>;
    };
    type MockedInitializationCallbacks = {
        [K in keyof InitializationCallbacks]: jest.Mocked<InitializationCallbacks[K]>;
    };

    type CoordinatorHarness = {
        coordinator: InitializationCoordinator;
        deps: InitializationDependencies;
        callbacks: MockedInitializationCallbacks;
        mocks: {
            navigation: jest.Mocked<NonNullable<InitializationDependencies['modules']['navigation']>>;
            plexAuth: MockedPlexAuth;
            plexDiscovery: jest.Mocked<NonNullable<InitializationDependencies['modules']['plexDiscovery']>>;
        };
    };

    const makeCoordinator = (
        depsOverrides: InitializationDependencyOverrides = {},
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
        } as unknown as jest.Mocked<NonNullable<InitializationDependencies['modules']['navigation']>>;
        navigation.goTo.mockImplementation((screen) => {
            navigation.getCurrentScreen.mockReturnValue(screen);
        });

        const readStoredCredentialsAndClearCorruption = jest.fn().mockReturnValue(
            createStoredCredentials('active-token', 'account-token')
        );
        const validateToken = jest.fn().mockResolvedValue(true);
        const getCurrentUser = jest.fn().mockReturnValue(null);
        const storeCredentials = jest.fn((_credentials: PlexAuthDataV2) => undefined);
        const plexAuth = {
            readStoredCredentialsAndClearCorruption,
            validateToken,
            getCurrentUser,
            storeCredentials,
            validateStoredCredentials: jest.fn().mockResolvedValue({
                kind: 'active_valid',
                guard: createAuthGuard(),
            }),
            getHomeUsers: jest.fn().mockResolvedValue([]),
            on: jest.fn(() => ({ dispose: jest.fn() })),
        } as unknown as MockedPlexAuth;

        const plexDiscovery = {
            initialize: jest.fn().mockResolvedValue(SKIPPED_SAVED_SERVER_RESTORE),
            isConnected: jest.fn().mockReturnValue(false),
            getSelectionReceiptSignal: jest.fn(() => new AbortController().signal),
            assertSelectionReceiptCurrent: jest.fn(),
            on: jest.fn(() => ({ dispose: jest.fn() })),
        } as unknown as jest.Mocked<NonNullable<InitializationDependencies['modules']['plexDiscovery']>>;

        const deps: InitializationDependencies = {
            modules: {
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
                ...depsOverrides.modules,
            },
            readiness: {
                epg: null,
                ...depsOverrides.readiness,
            },
            overlays: {
                playerOsd: null,
                channelNumberOverlay: null,
                channelBadgeOverlay: null,
                miniGuide: null,
                channelTransition: null,
                ...depsOverrides.overlays,
            },
            startupUiInitializer: depsOverrides.startupUiInitializer ?? {
                ensureCorePlayerUiInitialized: jest.fn().mockResolvedValue(undefined),
            } as unknown as InitializationDependencies['startupUiInitializer'],
            epgDebugRuntime: null,
            stores: {
                epgPreferencesStore: new EpgPreferencesStore(),
                profileSessionStore: new ProfileSessionStore(),
                ...depsOverrides.stores,
            },
        };

        const callbacks: MockedInitializationCallbacks = {
            status: {
                updateModuleStatus: jest.fn(),
                getModuleStatus: jest.fn(),
            },
            errors: {
                handleGlobalError: jest.fn(),
            },
            diagnostics: {
                reportRecoverableAsyncFailure: jest.fn(),
            },
            state: {
                setReady: jest.fn(),
                setupEventWiring: jest.fn(() => true),
                disposeEventWiring: jest.fn(),
                transferSelectedServerTuningToStartup: jest.fn(),
            },
            serverStorage: {
                configureDiscoveryStorage: jest.fn(),
                configureChannelManagerStorage: jest.fn().mockResolvedValue(undefined),
                getSelectedServerId: jest.fn().mockReturnValue(null),
            },
            routing: {
                shouldRunAudioSetup: jest.fn().mockReturnValue(false),
                shouldRunChannelSetup: jest.fn().mockReturnValue(false),
                switchToChannel: jest.fn().mockResolvedValue({ kind: 'switched' }),
                openServerSelect: jest.fn(),
            },
            resources: {
                buildPlexResourceUrl: jest.fn(),
            },
            epgWarmup: {
                warmCurrentViewportForStartup: jest.fn().mockResolvedValue(undefined),
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

        return {
            coordinator,
            deps,
            callbacks,
            mocks: {
                navigation,
                plexAuth,
                plexDiscovery,
            },
        };
    };

    it('routes to server-select when active token is valid and picker is disabled', async () => {
        const {
            coordinator,
            mocks: { plexAuth, navigation, plexDiscovery },
        } = makeCoordinator();

        plexAuth.validateStoredCredentials.mockResolvedValue({
            kind: 'active_valid',
            guard: createAuthGuard(),
        });
        plexDiscovery.isConnected.mockReturnValue(false);

        await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE);

        expect(navigation.goTo).toHaveBeenCalledWith('server-select');
        expect(navigation.goTo).not.toHaveBeenCalledWith('profile-select');
    });

    it('routes to profile-select when active token is invalid but account is valid', async () => {
        const {
            coordinator,
            mocks: { plexAuth, navigation },
        } = makeCoordinator();

        plexAuth.validateStoredCredentials.mockResolvedValue({
            kind: 'account_fallback_valid',
            guard: createAuthGuard(),
        });

        await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE);

        expect(navigation.goTo).toHaveBeenCalledWith('profile-select');
    });

    it('rethrows non-auth token validation failures instead of masking them as auth resume', async () => {
        const {
            coordinator,
            callbacks,
            mocks: { plexAuth, navigation },
        } = makeCoordinator();

        plexAuth.validateStoredCredentials.mockRejectedValue(new Error('validation down'));

        await expect(coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE)).rejects.toThrow('validation down');

        expect(callbacks.status.updateModuleStatus).not.toHaveBeenCalledWith('plex-auth', 'pending');
        expect(plexAuth.on).not.toHaveBeenCalledWith('authChange', expect.any(Function));
        expect(plexAuth.on).not.toHaveBeenCalledWith('profileChange', expect.any(Function));
        expect(navigation.goTo).not.toHaveBeenCalledWith('auth');
    });

    it('does not resume startup for unauthenticated authChange events from cancelled auth flows', async () => {
        const {
            coordinator,
            mocks: { plexAuth },
        } = makeCoordinator();
        const authChangeHandlers: Array<(isAuthenticated: boolean) => void> = [];
        plexAuth.on.mockImplementation((...args: PlexAuthOnArgs) => {
            const [event, handler] = args;
            if (event === 'authChange') {
                authChangeHandlers.push(handler);
            }
            return { dispose: jest.fn() };
        });
        plexAuth.validateStoredCredentials.mockResolvedValue({
            kind: 'missing',
            guard: createAuthGuard(),
        });
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
        } as unknown as InitializationDependencies['modules']['lifecycle'];

        const {
            coordinator,
            mocks: { plexAuth },
        } = makeCoordinator({ modules: { lifecycle } });

        plexAuth.validateStoredCredentials.mockResolvedValue({
            kind: 'missing',
            guard: createAuthGuard(),
        });

        await coordinator.runStartup(STARTUP_PHASE.FULL_STARTUP);

        expect((lifecycle as unknown as { initialize: jest.Mock }).initialize).toHaveBeenCalledTimes(1);
        expect((lifecycle as unknown as { setPhase: jest.Mock }).setPhase).not.toHaveBeenCalledWith('initializing');
        expect((lifecycle as unknown as { setPhase: jest.Mock }).setPhase).not.toHaveBeenCalledWith('authenticating');
    });

    it('configures discovery storage before resuming after server selection on profileChange', async () => {
        const {
            coordinator,
            deps,
            callbacks,
            mocks: { plexAuth, navigation, plexDiscovery },
        } = makeCoordinator();

        const order: string[] = [];

        // Arrange deps: stored creds + valid active token, and ensure startup shows profile-select
        const channelManager = {
            getCurrentChannel: jest.fn().mockReturnValue({ id: 'current-channel-id' }),
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as InitializationDependencies['modules']['channelManager'];
        deps.modules.channelManager = channelManager;

        let profileChangeHandler: (() => void) | null = null;
        plexAuth.on.mockImplementation((...args: PlexAuthOnArgs) => {
            const [event, handler] = args;
            if (event === 'profileChange') {
                profileChangeHandler = (): void => handler({ fromUserId: null, toUserId: 'user-2' });
            }
            return { dispose: jest.fn() };
        });

        callbacks.serverStorage.configureDiscoveryStorage.mockImplementation(() => {
            order.push('configure');
        });
        plexAuth.validateStoredCredentials.mockImplementation(async () => {
            order.push('validate');
            return { kind: 'active_valid', guard: createAuthGuard() };
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
        expect(order[0]).toBe('validate');
        expect(order).toEqual(['validate', 'configure', 'init']);
        expect(order).toContain('init');
    });

    it('routes profileChange resume through the coordinator-owned profile-switch restart helper', async () => {
        const {
            coordinator,
            mocks: { plexAuth, navigation, plexDiscovery },
        } = makeCoordinator();

        let profileChangeHandler: (() => void) | null = null;
        plexAuth.on.mockImplementation((...args: PlexAuthOnArgs) => {
            const [event, handler] = args;
            if (event === 'profileChange') {
                profileChangeHandler = (): void => handler({ fromUserId: null, toUserId: 'user-2' });
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
        const {
            coordinator,
            callbacks,
            mocks: { plexDiscovery },
        } = makeCoordinator();

        const order: string[] = [];
        const originalClearProfileResume = coordinator.clearProfileResume.bind(coordinator);
        const clearProfileResumeSpy = jest
            .spyOn(coordinator, 'clearProfileResume')
            .mockImplementation(() => {
                order.push('clear');
                originalClearProfileResume();
            });

        callbacks.serverStorage.configureDiscoveryStorage.mockImplementation(() => {
            order.push('configure');
        });
        plexDiscovery.initialize.mockImplementation(async () => {
            order.push('init');
            return createSelectedSavedServerRestore();
        });
        plexDiscovery.isConnected.mockReturnValue(true);

        await coordinator.resumeStartupAfterProfileSwitch();

        expect(clearProfileResumeSpy).toHaveBeenCalled();
        expect(order[0]).toBe('clear');
        expect(order[1]).toBe('configure');
        expect(order).toContain('init');
    });

    it('clears a stale server-resume listener before the manual profile-switch rerun from server-select', async () => {
        const {
            coordinator,
            mocks: { plexDiscovery },
        } = makeCoordinator();

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
        const {
            coordinator,
            callbacks,
            mocks: { plexAuth, plexDiscovery, navigation },
        } = makeCoordinator({ modules: { lifecycle: {
                setPhase: jest.fn(),
            } as unknown as InitializationDependencies['modules']['lifecycle'], channelManager: {
                loadChannels: jest.fn().mockResolvedValue(undefined),
                getCurrentChannel: jest.fn().mockReturnValue({ id: 'current-channel-id' }),
                getAllChannels: jest.fn().mockReturnValue([]),
            } as unknown as InitializationDependencies['modules']['channelManager'] } });

        let profileChangeHandler: (() => void) | null = null;
        plexAuth.on.mockImplementation((...args: PlexAuthOnArgs) => {
            const [event, handler] = args;
            if (event === 'profileChange') {
                profileChangeHandler = (): void => handler({ fromUserId: null, toUserId: 'user-2' });
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
        plexDiscovery.initialize.mockResolvedValue(createSelectedSavedServerRestore());
        plexDiscovery.isConnected.mockReturnValue(true);
        navigation.getCurrentScreen.mockReturnValue('auth');
        callbacks.routing.switchToChannel.mockRejectedValueOnce(new Error('route failed'));

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

        expect(callbacks.errors.handleGlobalError).toHaveBeenCalledTimes(1);
        expect(callbacks.errors.handleGlobalError).toHaveBeenCalledWith(
            expect.objectContaining({
                code: 'INITIALIZATION_FAILED',
                message: 'route failed',
                recoverable: true,
            }),
            'start'
        );
        expect(callbacks.diagnostics.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'initialization.resume.afterServerSelection',
            'Background startup resume after server selection failed',
            expect.any(Error)
        );
        expect(callbacks.diagnostics.reportRecoverableAsyncFailure).toHaveBeenCalledTimes(1);
    });

    it('swallows diagnostics failures when resumed startup reporting throws', async () => {
        const {
            coordinator,
            callbacks,
            mocks: { plexAuth, plexDiscovery, navigation },
        } = makeCoordinator({ modules: { lifecycle: {
                setPhase: jest.fn(),
            } as unknown as InitializationDependencies['modules']['lifecycle'], channelManager: {
                loadChannels: jest.fn().mockResolvedValue(undefined),
                getCurrentChannel: jest.fn().mockReturnValue({ id: 'current-channel-id' }),
                getAllChannels: jest.fn().mockReturnValue([]),
            } as unknown as InitializationDependencies['modules']['channelManager'] } });

        let profileChangeHandler: (() => void) | null = null;
        plexAuth.on.mockImplementation((...args: PlexAuthOnArgs) => {
            const [event, handler] = args;
            if (event === 'profileChange') {
                profileChangeHandler = (): void => handler({ fromUserId: null, toUserId: 'user-2' });
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
        plexDiscovery.initialize.mockResolvedValue(createSelectedSavedServerRestore());
        plexDiscovery.isConnected.mockReturnValue(true);
        navigation.getCurrentScreen.mockReturnValue('auth');
        callbacks.routing.switchToChannel.mockRejectedValueOnce(new Error('route failed'));
        callbacks.diagnostics.reportRecoverableAsyncFailure.mockImplementation(() => {
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

        expect(callbacks.errors.handleGlobalError).toHaveBeenCalledTimes(1);
        expect(callbacks.diagnostics.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'initialization.resume.afterServerSelection',
            'Background startup resume after server selection failed',
            expect.any(Error)
        );
    });

    describe('server connection startup policy branches', () => {
        it('marks discovery error, navigates to server-select, and does not register server resume when discovery init fails', async () => {
            const {
                coordinator,
                callbacks,
                mocks: { navigation, plexDiscovery },
            } = makeCoordinator();

            plexDiscovery.initialize.mockRejectedValue(new Error('discovery init failed'));

            await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);

            expect(callbacks.status.updateModuleStatus).toHaveBeenCalledWith(
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
            const {
                coordinator,
                callbacks,
                mocks: { navigation, plexAuth, plexDiscovery },
            } = makeCoordinator();
            const authError = new PlexApiError(
                code,
                'cloud discovery credentials rejected',
                401,
                false
            );

            plexDiscovery.initialize.mockRejectedValue(authError);

            await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);

            expect(callbacks.status.updateModuleStatus).toHaveBeenCalledWith(
                'plex-server-discovery',
                'error',
                expect.objectContaining({
                    code,
                    message: 'cloud discovery credentials rejected',
                    recoverable: true,
                })
            );
            expect(callbacks.errors.handleGlobalError).toHaveBeenCalledWith(
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
            const {
                coordinator,
                callbacks,
                mocks: { navigation, plexDiscovery },
            } = makeCoordinator();

            plexDiscovery.initialize.mockResolvedValue(SKIPPED_SAVED_SERVER_RESTORE);
            plexDiscovery.isConnected.mockReturnValue(false);

            await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);

            expect(callbacks.status.updateModuleStatus).toHaveBeenCalledWith(
                'plex-server-discovery',
                'pending',
                undefined,
                expect.any(Number)
            );
            expect(callbacks.status.updateModuleStatus).toHaveBeenCalledWith(
                'plex-library',
                'pending',
                undefined,
                expect.any(Number)
            );
            expect(callbacks.status.updateModuleStatus).toHaveBeenCalledWith(
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
        } as unknown as InitializationDependencies['startupUiInitializer'];
        const { coordinator, callbacks } = makeCoordinator({
            startupUiInitializer,
        });

        callbacks.state.setReady.mockImplementation((ready: boolean) => {
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
            const { coordinator, callbacks } = makeCoordinator({ modules: { channelManager: {
                    loadChannels: jest.fn(async () => {
                        order.push(initLabel('channel-manager'));
                    }),
                    getCurrentChannel: jest.fn().mockReturnValue(null),
                    getAllChannels: jest.fn().mockReturnValue([]),
                } as unknown as InitializationDependencies['modules']['channelManager'], scheduler: {} as unknown as InitializationDependencies['modules']['scheduler'], videoPlayer: {
                    initialize: jest.fn(async () => {
                        order.push(initLabel('video-player'));
                    }),
                    requestMediaSession: jest.fn(),
                } as unknown as InitializationDependencies['modules']['videoPlayer'] }, overlays: { playerOsd: {
                    initialize: jest.fn(() => {
                        order.push(initLabel('player-osd-ui'));
                    }),
                } as unknown as InitializationDependencies['overlays']['playerOsd'], channelNumberOverlay: {
                    initialize: jest.fn(() => {
                        order.push(initLabel('channel-number-overlay-ui'));
                    }),
                } as unknown as InitializationDependencies['overlays']['channelNumberOverlay'], channelBadgeOverlay: {
                    initialize: jest.fn(() => {
                        order.push(initLabel('channel-badge-ui'));
                    }),
                } as unknown as InitializationDependencies['overlays']['channelBadgeOverlay'], miniGuide: {
                    initialize: jest.fn(() => {
                        order.push(initLabel('mini-guide-ui'));
                    }),
                } as unknown as InitializationDependencies['overlays']['miniGuide'], channelTransition: {
                    initialize: jest.fn(() => {
                        order.push(initLabel('channel-transition-ui'));
                    }),
                } as unknown as InitializationDependencies['overlays']['channelTransition'] } });
            callbacks.status.updateModuleStatus.mockImplementation((id: string, status: string) => {
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
            expect(callbacks.status.updateModuleStatus).toHaveBeenCalledWith(
                'channel-scheduler',
                'ready',
                undefined,
                expect.any(Number)
            );
            expect(callbacks.status.updateModuleStatus).not.toHaveBeenCalledWith('channel-scheduler', 'initializing');
        });

        it('reports later runtime load times from the shared playback-runtime start time', async () => {
            let now = 1000;
            const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
            const { coordinator, callbacks } = makeCoordinator({ modules: { channelManager: {
                    loadChannels: jest.fn().mockResolvedValue(undefined),
                    getCurrentChannel: jest.fn().mockReturnValue(null),
                    getAllChannels: jest.fn().mockReturnValue([]),
                } as unknown as InitializationDependencies['modules']['channelManager'] }, overlays: { channelBadgeOverlay: {
                    initialize: jest.fn(() => {
                        now = 1200;
                    }),
                } as unknown as InitializationDependencies['overlays']['channelBadgeOverlay'], miniGuide: {
                    initialize: jest.fn(() => {
                        now = 1250;
                    }),
                } as unknown as InitializationDependencies['overlays']['miniGuide'] } });

            try {
                await coordinator.runStartup(STARTUP_PHASE.RESUME_RUNTIME_MODULES);
            } finally {
                dateNowSpy.mockRestore();
            }

            expect(callbacks.status.updateModuleStatus).toHaveBeenCalledWith(
                'mini-guide-ui',
                'ready',
                undefined,
                250
            );
        });

        it('keeps channel scheduler disabled without initialization ceremony when missing', async () => {
            const { coordinator, callbacks } = makeCoordinator();

            await coordinator.runStartup(STARTUP_PHASE.RESUME_RUNTIME_MODULES);

            expect(callbacks.status.updateModuleStatus).toHaveBeenCalledWith('channel-scheduler', 'disabled');
            expect(callbacks.status.updateModuleStatus).not.toHaveBeenCalledWith('channel-scheduler', 'initializing');
            expect(callbacks.status.updateModuleStatus).not.toHaveBeenCalledWith(
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
                expect(callbacks.status.updateModuleStatus).not.toHaveBeenCalledWith(id, 'initializing');
                expect(callbacks.status.updateModuleStatus).not.toHaveBeenCalledWith(
                    id,
                    'ready',
                    undefined,
                    expect.any(Number)
                );
            }
        });

        it('does not publish ready when a wrapped runtime initializer throws', async () => {
            const { coordinator, callbacks } = makeCoordinator({ overlays: { playerOsd: {
                    initialize: jest.fn(() => {
                        throw new Error('osd failed');
                    }),
                } as unknown as InitializationDependencies['overlays']['playerOsd'] } });

            await expect(coordinator.runStartup(STARTUP_PHASE.RESUME_RUNTIME_MODULES)).rejects.toThrow('osd failed');

            expect(callbacks.status.updateModuleStatus).toHaveBeenCalledWith('player-osd-ui', 'initializing');
            expect(callbacks.status.updateModuleStatus).not.toHaveBeenCalledWith(
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
            } as unknown as InitializationDependencies['modules']['videoPlayer'];
            const { coordinator, callbacks } = makeCoordinator({ modules: { videoPlayer } });
            callbacks.status.updateModuleStatus.mockImplementation((id: string, status: string) => {
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
        } as unknown as InitializationDependencies['modules']['epg'];
        const epgReadiness = {
            ensureReady: jest.fn(async () => {
                callOrder.push('epg-ready');
            }),
        } as NonNullable<InitializationDependencies['readiness']['epg']>;
        const {
            coordinator,
            callbacks,
            mocks: { plexDiscovery },
        } = makeCoordinator({ modules: { epg }, readiness: { epg: epgReadiness } });

        plexDiscovery.initialize.mockResolvedValue(createSelectedSavedServerRestore());
        plexDiscovery.isConnected.mockReturnValue(true);
        callbacks.state.setReady.mockImplementation((ready: boolean) => {
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
        const {
            coordinator,
            callbacks,
            mocks: { navigation, plexAuth, plexDiscovery },
        } = makeCoordinator();

        let profileChangeHandler: (() => void) | null = null;
        plexAuth.on.mockImplementation((...args: PlexAuthOnArgs) => {
            const [event, handler] = args;
            if (event === 'profileChange') {
                profileChangeHandler = (): void => handler({ fromUserId: null, toUserId: 'user-2' });
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
        plexDiscovery.initialize.mockResolvedValue(createSelectedSavedServerRestore());
        plexDiscovery.isConnected.mockReturnValue(true);
        navigation.getCurrentScreen.mockReturnValue('auth');

        await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_AUTH_CHANGE);

        expect(callbacks.state.setupEventWiring).not.toHaveBeenCalled();
        expect(callbacks.state.setReady).not.toHaveBeenCalledWith(true);
        expect(profileChangeHandler).toBeTruthy();

        let releaseDiscoveryInitialize: (() => void) | null = null;
        let initializeCallCount = 0;
        plexDiscovery.initialize.mockImplementation(() => {
            initializeCallCount += 1;
            if (initializeCallCount === 1) {
                return new Promise<ReturnType<typeof createSelectedSavedServerRestore>>((resolve) => {
                    releaseDiscoveryInitialize = (): void => resolve(createSelectedSavedServerRestore());
                });
            }
            return Promise.resolve(createSelectedSavedServerRestore());
        });

        const runPromise = coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
        await flushUntil(() => releaseDiscoveryInitialize !== null);

        expect(callbacks.state.setupEventWiring).not.toHaveBeenCalled();
        expect(callbacks.state.setReady).not.toHaveBeenCalledWith(true);

        if (!profileChangeHandler) {
            throw new Error('Expected profileChange handler to be registered');
        }
        (profileChangeHandler as unknown as () => void)();
        if (releaseDiscoveryInitialize) {
            (releaseDiscoveryInitialize as unknown as () => void)();
        }
        await runPromise;

        expect(callbacks.state.setupEventWiring).toHaveBeenCalledTimes(1);
        expect(callbacks.state.setReady).toHaveBeenCalledWith(true);
    });

    it('does not resolve queued startup callers until final ready work completes', async () => {
        const {
            coordinator,
            callbacks,
            mocks: { plexAuth, plexDiscovery },
        } = makeCoordinator();

        plexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(
            createStoredCredentials('active-token', 'account-token')
        );
        plexAuth.validateToken.mockResolvedValue(true);

        let releaseDiscoveryInitialize: (() => void) | null = null;
        plexDiscovery.initialize.mockImplementation(
            () =>
                new Promise<ReturnType<typeof createSelectedSavedServerRestore>>((resolve) => {
                    releaseDiscoveryInitialize = (): void => resolve(createSelectedSavedServerRestore());
                })
        );
        plexDiscovery.isConnected.mockReturnValue(true);

        let setupEventWiringCompleted = false;
        let setupEventWiringWasCompleteWhenQueuedResolved: boolean | null = null;
        callbacks.state.setupEventWiring.mockImplementation(() => {
            setupEventWiringCompleted = true;
            return true;
        });

        const firstRunPromise = coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
        const queuedRunPromise = coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY);
        void queuedRunPromise.then(() => {
            setupEventWiringWasCompleteWhenQueuedResolved = setupEventWiringCompleted;
        });

        await flushUntil(() => releaseDiscoveryInitialize !== null);
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
        const {
            coordinator,
            callbacks,
            mocks: { plexDiscovery },
        } = makeCoordinator();

        let releaseDiscoveryInitialize: (() => void) | null = null;
        plexDiscovery.initialize.mockImplementation(
            () =>
                new Promise<ReturnType<typeof createSelectedSavedServerRestore>>((resolve) => {
                    releaseDiscoveryInitialize = (): void => resolve(createSelectedSavedServerRestore());
                })
        );
        plexDiscovery.isConnected.mockReturnValue(true);

        const resume = coordinator.runStartup(
            STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION,
            { signal: controller.signal }
        );
        await flushUntil(() => releaseDiscoveryInitialize !== null);

        expect(releaseDiscoveryInitialize).toBeTruthy();
        controller.abort(abortReason);
        (releaseDiscoveryInitialize as unknown as () => void)();

        await expect(resume).rejects.toBe(abortReason);
        expect(plexDiscovery.initialize).toHaveBeenCalledWith({ signal: controller.signal });
        expect(callbacks.state.setupEventWiring).not.toHaveBeenCalled();
        expect(callbacks.state.setReady).not.toHaveBeenCalledWith(true);
        expect(callbacks.errors.handleGlobalError).not.toHaveBeenCalled();
    });

    it('keeps caller abort nonfatal when auth supersession aborted the composed signal first', async () => {
        const caller = new AbortController();
        const auth = new AbortController();
        const callerReason = new DOMException('screen hidden', 'AbortError');
        const superseded = new PlexAuthOperationSupersededError();
        let releaseLoad: (() => void) | null = null;
        const {
            coordinator,
            callbacks,
            mocks: { plexAuth },
        } = makeCoordinator({ modules: { channelManager: {
                loadChannels: jest.fn(() => new Promise<void>((resolve) => {
                    releaseLoad = resolve;
                })),
                getCurrentChannel: jest.fn().mockReturnValue(null),
                getAllChannels: jest.fn().mockReturnValue([]),
            } as unknown as InitializationDependencies['modules']['channelManager'] } });
        plexAuth.validateStoredCredentials.mockResolvedValue({
            kind: 'active_valid',
            guard: {
                signal: auth.signal,
                assertCurrent: (): void => {
                    if (auth.signal.aborted) throw superseded;
                },
            },
        });

        const startup = coordinator.runStartup(STARTUP_PHASE.RESUME_RUNTIME_MODULES, {
            signal: caller.signal,
        });
        await flushUntil(() => releaseLoad !== null);
        auth.abort(superseded);
        caller.abort(callerReason);
        releaseLoad!();

        await expect(startup).rejects.toBe(callerReason);
        expect(callbacks.errors.handleGlobalError).not.toHaveBeenCalled();
    });

    it('rejects queued startup waiters when their caller aborts before the queued pass runs', async () => {
        const abortReason = new DOMException('queued startup hidden', 'AbortError');
        const controller = new AbortController();
        const {
            coordinator,
            mocks: { plexDiscovery },
        } = makeCoordinator();

        let releaseDiscoveryInitialize: (() => void) | null = null;
        plexDiscovery.initialize.mockImplementation(
            () =>
                new Promise<ReturnType<typeof createSelectedSavedServerRestore>>((resolve) => {
                    releaseDiscoveryInitialize = (): void => resolve(createSelectedSavedServerRestore());
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

        await flushUntil(() => releaseDiscoveryInitialize !== null);
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
        const {
            coordinator,
            callbacks,
            mocks: { plexDiscovery, plexAuth },
        } = makeCoordinator({ modules: { epg: {
                initialize: jest.fn(),
            } as unknown as InitializationDependencies['modules']['epg'] }, readiness: { epg: {
                ensureReady: jest.fn(() =>
                    new Promise<void>((resolve) => {
                        releaseEpgReady = resolve;
                        markEpgReadyWaitStarted?.();
                    })
                ),
            } as unknown as InitializationDependencies['readiness']['epg'] } });
        plexAuth.validateStoredCredentials.mockImplementation(
            () =>
                new Promise((resolve) => {
                    releaseAuthValidation = (): void => resolve({
                        kind: 'active_valid',
                        guard: createAuthGuard(),
                    });
                    markValidateTokenStarted?.();
                })
        );
        plexDiscovery.initialize.mockResolvedValue(createSelectedSavedServerRestore());
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
        expect(callbacks.state.setupEventWiring).not.toHaveBeenCalled();
        expect(callbacks.state.setReady).not.toHaveBeenCalledWith(true);
        expect(callbacks.errors.handleGlobalError).not.toHaveBeenCalled();
        expect(
            callbacks.status.updateModuleStatus.mock.calls.some(
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
        const {
            coordinator,
            callbacks,
            mocks: { plexDiscovery, plexAuth },
        } = makeCoordinator({ modules: { epg: {
                initialize: jest.fn(),
            } as unknown as InitializationDependencies['modules']['epg'] }, readiness: { epg: {
                ensureReady: jest.fn(() =>
                    new Promise<void>((resolve) => {
                        releaseEpgReady = resolve;
                        markEpgReadyWaitStarted?.();
                    })
                ),
            } as unknown as InitializationDependencies['readiness']['epg'] } });
        plexAuth.validateStoredCredentials.mockImplementation(
            () =>
                new Promise((resolve) => {
                    releaseAuthValidation = (): void => resolve({
                        kind: 'active_valid',
                        guard: createAuthGuard(),
                    });
                })
        );
        plexDiscovery.initialize.mockResolvedValue(createSelectedSavedServerRestore());
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
        expect(callbacks.state.setupEventWiring).not.toHaveBeenCalled();
        expect(callbacks.state.setReady).not.toHaveBeenCalledWith(true);
        expect(callbacks.errors.handleGlobalError).not.toHaveBeenCalled();
    });

    it('reports abort-like startup failures when no caller signal requested cancellation', async () => {
        const abortError = new DOMException('internal channel load abort', 'AbortError');
        const { coordinator, callbacks } = makeCoordinator({ modules: { channelManager: {
                loadChannels: jest.fn().mockRejectedValue(abortError),
                getCurrentChannel: jest.fn().mockReturnValue(null),
                getAllChannels: jest.fn().mockReturnValue([]),
            } as unknown as InitializationDependencies['modules']['channelManager'] } });

        await expect(
            coordinator.runStartup(STARTUP_PHASE.RESUME_RUNTIME_MODULES)
        ).rejects.toBe(abortError);

        expect(callbacks.errors.handleGlobalError).toHaveBeenCalledWith(
            {
                code: AppErrorCode.INITIALIZATION_FAILED,
                message: 'internal channel load abort',
                recoverable: true,
            },
            'start'
        );
    });

    it('preserves caller cancellation over a racing non-abort startup failure', async () => {
        const controller = new AbortController();
        const abortReason = new DOMException('server selection hidden', 'AbortError');
        const startupError = new Error('channel load failed after abort');
        const { coordinator, callbacks } = makeCoordinator({ modules: { channelManager: {
                loadChannels: jest.fn().mockImplementation(async () => {
                    controller.abort(abortReason);
                    throw startupError;
                }),
                getCurrentChannel: jest.fn().mockReturnValue(null),
                getAllChannels: jest.fn().mockReturnValue([]),
            } as unknown as InitializationDependencies['modules']['channelManager'] } });

        await expect(
            coordinator.runStartup(STARTUP_PHASE.RESUME_RUNTIME_MODULES, { signal: controller.signal })
        ).rejects.toBe(abortReason);
        expect(callbacks.errors.handleGlobalError).not.toHaveBeenCalled();
    });

    it('preserves caller cancellation over a racing internal abort-like failure', async () => {
        const controller = new AbortController();
        const abortReason = new DOMException('server selection hidden', 'AbortError');
        const startupError = new DOMException('internal channel load abort after caller abort', 'AbortError');
        const { coordinator, callbacks } = makeCoordinator({ modules: { channelManager: {
                loadChannels: jest.fn().mockImplementation(async () => {
                    controller.abort(abortReason);
                    throw startupError;
                }),
                getCurrentChannel: jest.fn().mockReturnValue(null),
                getAllChannels: jest.fn().mockReturnValue([]),
            } as unknown as InitializationDependencies['modules']['channelManager'] } });

        await expect(
            coordinator.runStartup(STARTUP_PHASE.RESUME_RUNTIME_MODULES, { signal: controller.signal })
        ).rejects.toBe(abortReason);
        expect(callbacks.errors.handleGlobalError).not.toHaveBeenCalled();
    });

    it('cancels a pending warmup timer when a rerun eagerly initializes EPG', async () => {
        jest.useFakeTimers();
        const epg = {
            initialize: jest.fn(),
        } as unknown as InitializationDependencies['modules']['epg'];
        const epgReadiness = {
            ensureReady: jest.fn(async () => undefined),
        } as NonNullable<InitializationDependencies['readiness']['epg']>;
        const {
            coordinator,
            mocks: { plexAuth, plexDiscovery },
        } = makeCoordinator({ modules: { epg }, readiness: { epg: epgReadiness } });

        try {
            plexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(
                createStoredCredentials('active-token', 'account-token')
            );
            plexAuth.validateToken.mockResolvedValue(true);
            plexDiscovery.initialize.mockResolvedValue(createSelectedSavedServerRestore());
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

    it('cancels deferred EPG warmup and keeps ordinary startup admission closed until recovery release', async () => {
        jest.useFakeTimers();
        const epgReadiness = { ensureReady: jest.fn(async () => undefined) } as NonNullable<InitializationDependencies['readiness']['epg']>;
        const {
            coordinator,
            mocks: { plexDiscovery },
        } = makeCoordinator({ modules: { epg: { initialize: jest.fn() } as unknown as InitializationDependencies['modules']['epg'] }, readiness: { epg: epgReadiness } });
        try {
            plexDiscovery.initialize.mockResolvedValue(createSelectedSavedServerRestore());
            plexDiscovery.isConnected.mockReturnValue(true);
            await coordinator.runStartup(STARTUP_PHASE.FULL_STARTUP);

            await coordinator.prepareForSelectedServerQuarantine();
            await jest.advanceTimersByTimeAsync(1500);
            expect(epgReadiness.ensureReady).not.toHaveBeenCalled();
            await expect(coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY)).rejects.toThrow(
                'Ordinary startup is unavailable during selected-server recovery.'
            );

            coordinator.releaseSelectedServerQuarantine();
            await expect(coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY)).resolves.toBeUndefined();
        } finally {
            jest.useRealTimers();
        }
    });

    it('cancels EPG readiness while draining warmup for quarantine preparation', async () => {
        jest.useFakeTimers();
        let readinessSignal: AbortSignal | null = null;
        const epgReadiness = {
            ensureReady: jest.fn((signal?: AbortSignal | null) => new Promise<void>((_resolve, reject) => {
                readinessSignal = signal ?? null;
                signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
            })),
        } as NonNullable<InitializationDependencies['readiness']['epg']>;
        const {
            coordinator,
            callbacks,
            mocks: { plexDiscovery },
        } = makeCoordinator({ modules: { epg: { initialize: jest.fn() } as unknown as InitializationDependencies['modules']['epg'] }, readiness: { epg: epgReadiness } });
        try {
            plexDiscovery.initialize.mockResolvedValue(createSelectedSavedServerRestore());
            plexDiscovery.isConnected.mockReturnValue(true);
            await coordinator.runStartup(STARTUP_PHASE.FULL_STARTUP);
            await jest.advanceTimersByTimeAsync(1500);
            expect(epgReadiness.ensureReady).toHaveBeenCalledTimes(1);

            const preparation = coordinator.prepareForSelectedServerQuarantine();
            let prepared = false;
            void preparation.then(() => { prepared = true; });
            await advanceTimersUntil(() => expect(prepared).toBe(true), { stepMs: 1, timeoutMs: 10 });
            await preparation;

            expect((readinessSignal as AbortSignal | null)?.aborted).toBe(true);
            expect(prepared).toBe(true);
            expect(callbacks.epgWarmup.warmCurrentViewportForStartup).not.toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });

    it('warms the current viewport after deferred EPG init while playback is playing', async () => {
        jest.useFakeTimers();
        let playing = true;
        const epgReadiness = {
            ensureReady: jest.fn(async () => undefined),
        } as NonNullable<InitializationDependencies['readiness']['epg']>;
        const {
            coordinator,
            callbacks,
            mocks: { plexDiscovery },
        } = makeCoordinator({
            modules: {
                epg: { initialize: jest.fn() } as unknown as InitializationDependencies['modules']['epg'],
                videoPlayer: {
                    initialize: jest.fn(async () => undefined),
                    requestMediaSession: jest.fn(),
                    isPlaying: jest.fn(() => playing),
                } as unknown as InitializationDependencies['modules']['videoPlayer'],
            },
            readiness: { epg: epgReadiness },
        });
        try {
            plexDiscovery.initialize.mockResolvedValue(createSelectedSavedServerRestore());
            plexDiscovery.isConnected.mockReturnValue(true);
            await coordinator.runStartup(STARTUP_PHASE.FULL_STARTUP);
            await jest.advanceTimersByTimeAsync(1500);

            expect(epgReadiness.ensureReady).toHaveBeenCalledTimes(1);
            const warm = callbacks.epgWarmup.warmCurrentViewportForStartup as jest.Mock;
            expect(warm).toHaveBeenCalledTimes(1);
            const options = warm.mock.calls[0]?.[0] as {
                signal?: AbortSignal | null;
                shouldContinue?: () => boolean;
            };
            expect(options.signal).toBeInstanceOf(AbortSignal);
            expect(options.shouldContinue?.()).toBe(true);
            playing = false;
            expect(options.shouldContinue?.()).toBe(false);
        } finally {
            jest.useRealTimers();
        }
    });

    it('initializes EPG but skips schedule warming when playback is not playing', async () => {
        jest.useFakeTimers();
        const epgReadiness = {
            ensureReady: jest.fn(async () => undefined),
        } as NonNullable<InitializationDependencies['readiness']['epg']>;
        const {
            coordinator,
            callbacks,
            mocks: { plexDiscovery },
        } = makeCoordinator({
            modules: {
                epg: { initialize: jest.fn() } as unknown as InitializationDependencies['modules']['epg'],
                videoPlayer: {
                    initialize: jest.fn(async () => undefined),
                    requestMediaSession: jest.fn(),
                    isPlaying: jest.fn(() => false),
                } as unknown as InitializationDependencies['modules']['videoPlayer'],
            },
            readiness: { epg: epgReadiness },
        });
        try {
            plexDiscovery.initialize.mockResolvedValue(createSelectedSavedServerRestore());
            plexDiscovery.isConnected.mockReturnValue(true);
            await coordinator.runStartup(STARTUP_PHASE.FULL_STARTUP);
            await jest.advanceTimersByTimeAsync(1500);
            await jest.advanceTimersByTimeAsync(10_000);

            expect(epgReadiness.ensureReady).toHaveBeenCalledTimes(1);
            expect(callbacks.epgWarmup.warmCurrentViewportForStartup).not.toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });

    it('aborts active viewport warming and drains it for shutdown', async () => {
        jest.useFakeTimers();
        let observedSignal: AbortSignal | null = null;
        const epgReadiness = {
            ensureReady: jest.fn(async () => undefined),
        } as NonNullable<InitializationDependencies['readiness']['epg']>;
        const {
            coordinator,
            callbacks,
            mocks: { plexDiscovery },
        } = makeCoordinator({
            modules: {
                epg: { initialize: jest.fn() } as unknown as InitializationDependencies['modules']['epg'],
                videoPlayer: {
                    initialize: jest.fn(async () => undefined),
                    requestMediaSession: jest.fn(),
                    isPlaying: jest.fn(() => true),
                } as unknown as InitializationDependencies['modules']['videoPlayer'],
            },
            readiness: { epg: epgReadiness },
        });
        (callbacks.epgWarmup.warmCurrentViewportForStartup as jest.Mock).mockImplementation(
            (options?: { signal?: AbortSignal | null }) =>
                new Promise<void>((_resolve, reject) => {
                    observedSignal = options?.signal ?? null;
                    observedSignal?.addEventListener('abort', () => {
                        reject(observedSignal?.reason ?? new DOMException('aborted', 'AbortError'));
                    });
                })
        );
        try {
            plexDiscovery.initialize.mockResolvedValue(createSelectedSavedServerRestore());
            plexDiscovery.isConnected.mockReturnValue(true);
            await coordinator.runStartup(STARTUP_PHASE.FULL_STARTUP);
            await jest.advanceTimersByTimeAsync(1500);
            expect(callbacks.epgWarmup.warmCurrentViewportForStartup).toHaveBeenCalledTimes(1);

            await coordinator.drainEpgWarmupForShutdown();

            const wasAborted = (observedSignal as AbortSignal | null)?.aborted === true;
            expect(wasAborted).toBe(true);
        } finally {
            jest.useRealTimers();
        }
    });

    it('cancels pending EPG readiness and drains it for shutdown', async () => {
        jest.useFakeTimers();
        let readinessSignal: AbortSignal | null = null;
        const epgReadiness = {
            ensureReady: jest.fn((signal?: AbortSignal | null) => new Promise<void>((_resolve, reject) => {
                readinessSignal = signal ?? null;
                signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
            })),
        } as NonNullable<InitializationDependencies['readiness']['epg']>;
        const {
            coordinator,
            callbacks,
            mocks: { plexDiscovery },
        } = makeCoordinator({
            modules: {
                epg: { initialize: jest.fn() } as unknown as InitializationDependencies['modules']['epg'],
            },
            readiness: { epg: epgReadiness },
        });
        try {
            plexDiscovery.initialize.mockResolvedValue(createSelectedSavedServerRestore());
            plexDiscovery.isConnected.mockReturnValue(true);
            await coordinator.runStartup(STARTUP_PHASE.FULL_STARTUP);
            await jest.advanceTimersByTimeAsync(1500);
            expect(epgReadiness.ensureReady).toHaveBeenCalledTimes(1);

            const drainage = coordinator.drainEpgWarmupForShutdown();
            let drained = false;
            void drainage.then(() => { drained = true; });
            await advanceTimersUntil(() => expect(drained).toBe(true), { stepMs: 1, timeoutMs: 10 });
            await drainage;

            expect((readinessSignal as AbortSignal | null)?.aborted).toBe(true);
            expect(callbacks.epgWarmup.warmCurrentViewportForStartup).not.toHaveBeenCalled();
            expect(callbacks.status.updateModuleStatus.mock.calls.some(
                ([id, status]) => id === 'epg-ui' && (status === 'ready' || status === 'error')
            )).toBe(false);
        } finally {
            jest.useRealTimers();
        }
    });

    it('disposes resume admission and prevents a stale resume callback from publishing during quarantine', async () => {
        const {
            coordinator,
            callbacks,
            mocks: { plexDiscovery },
        } = makeCoordinator();
        let connectionHandler: ((uri: string | null) => void) | null = null;
        const dispose = jest.fn();
        plexDiscovery.on.mockImplementation((event: string, handler: (uri: string | null) => void) => {
            if (event === 'connectionChange') connectionHandler = handler;
            return { dispose };
        });
        plexDiscovery.initialize.mockResolvedValue(SKIPPED_SAVED_SERVER_RESTORE);
        plexDiscovery.isConnected.mockReturnValue(false);
        await coordinator.runStartup(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
        if (!connectionHandler) throw new Error('Expected server resume handler.');
        const { setupEventWiring } = callbacks.state;
        const { reportRecoverableAsyncFailure } = callbacks.diagnostics;
        const setupCalls = setupEventWiring.mock.calls.length;

        await coordinator.prepareForSelectedServerQuarantine();
        expect(dispose).toHaveBeenCalledTimes(1);
        (connectionHandler as (uri: string) => void)('https://server.example.invalid');
        await flushUntil(() => reportRecoverableAsyncFailure.mock.calls.length > 0);

        expect(setupEventWiring).toHaveBeenCalledTimes(setupCalls);
        expect(callbacks.state.transferSelectedServerTuningToStartup).not.toHaveBeenCalled();
    });

	    describe('post-ready routing policy', () => {
        it('does not schedule deferred EPG warmup when full-startup final routing fails', async () => {
            jest.useFakeTimers();
            const epg = {
                initialize: jest.fn(),
            } as unknown as InitializationDependencies['modules']['epg'];
            const epgReadiness = {
                ensureReady: jest.fn(async () => undefined),
            } as NonNullable<InitializationDependencies['readiness']['epg']>;
            const {
                coordinator,
                callbacks,
                mocks: { plexAuth, plexDiscovery },
            } = makeCoordinator({ modules: { epg, channelManager: {
                    loadChannels: jest.fn().mockResolvedValue(undefined),
                    getCurrentChannel: jest.fn().mockReturnValue({ id: 'current-channel-id' }),
                    getAllChannels: jest.fn().mockReturnValue([]),
                } as unknown as InitializationDependencies['modules']['channelManager'] }, readiness: { epg: epgReadiness } });
            try {
                plexAuth.readStoredCredentialsAndClearCorruption.mockReturnValue(
                    createStoredCredentials('active-token', 'account-token')
                );
                plexAuth.validateToken.mockResolvedValue(true);
                plexDiscovery.initialize.mockResolvedValue(createSelectedSavedServerRestore());
                plexDiscovery.isConnected.mockReturnValue(true);
                callbacks.routing.switchToChannel.mockRejectedValueOnce(new Error('route failed'));

                await expect(coordinator.runStartup(STARTUP_PHASE.FULL_STARTUP)).rejects.toThrow('route failed');
                await jest.advanceTimersByTimeAsync(1500);

                expect((epg as unknown as { initialize: jest.Mock }).initialize).not.toHaveBeenCalled();
                expect(epgReadiness.ensureReady).not.toHaveBeenCalled();
            } finally {
                jest.useRealTimers();
            }
        });

	        it('routes to audio-setup when audio and channel setup are both required', async () => {
	            const {
	                coordinator,
	                callbacks,
	                mocks: { navigation },
	            } = makeCoordinator();

            callbacks.routing.shouldRunAudioSetup.mockReturnValue(true);
            callbacks.routing.shouldRunChannelSetup.mockReturnValue(true);

            await coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY);

            expect(navigation.replaceScreen).toHaveBeenCalledWith('audio-setup');
        });

	        it('routes to channel-setup when only channel setup is required', async () => {
	            const {
	                coordinator,
	                callbacks,
	                mocks: { navigation },
	            } = makeCoordinator();

            callbacks.routing.shouldRunAudioSetup.mockReturnValue(false);
            callbacks.routing.shouldRunChannelSetup.mockReturnValue(true);

            await coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY);

	            expect(navigation.replaceScreen).toHaveBeenCalledWith('channel-setup');
	        });

	        it('opens server select when channel manager is unavailable', async () => {
	            const {
	                coordinator,
	                callbacks,
	                mocks: { navigation },
	            } = makeCoordinator({ modules: { channelManager: null } });

	            await coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY);

	            expect(callbacks.routing.openServerSelect).toHaveBeenCalled();
	            expect(navigation.replaceScreen).not.toHaveBeenCalled();
	        });

        it('routes to player and switches to current channel when present', async () => {
            const currentChannel = { id: 'current-channel-id' };
            const {
                coordinator,
                callbacks,
                mocks: { navigation },
            } = makeCoordinator({ modules: { channelManager: {
                    getCurrentChannel: jest.fn().mockReturnValue(currentChannel),
                    getAllChannels: jest.fn().mockReturnValue([]),
                } as unknown as InitializationDependencies['modules']['channelManager'] } });
            await coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY);

            expect(navigation.replaceScreen).toHaveBeenCalledWith('player');
            expect(callbacks.routing.switchToChannel).toHaveBeenCalledWith(currentChannel.id);
            expect(callbacks.routing.openServerSelect).not.toHaveBeenCalled();
        });

        it('does not route to player when caller cancellation wins during initial tune', async () => {
            const abortReason = new DOMException('server selection hidden', 'AbortError');
            const controller = new AbortController();
            const currentChannel = { id: 'current-channel-id' };
            const {
                coordinator,
                callbacks,
                mocks: { navigation },
            } = makeCoordinator({ modules: { channelManager: {
                    getCurrentChannel: jest.fn().mockReturnValue(currentChannel),
                    getAllChannels: jest.fn().mockReturnValue([]),
                } as unknown as InitializationDependencies['modules']['channelManager'] } });
            callbacks.routing.switchToChannel.mockImplementationOnce(async () => {
                controller.abort(abortReason);
                return { kind: 'switched' };
            });

            await expect(
                coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY, { signal: controller.signal })
            ).rejects.toBe(abortReason);

            expect(callbacks.routing.switchToChannel).toHaveBeenCalledWith(currentChannel.id);
            expect(navigation.replaceScreen).not.toHaveBeenCalledWith('player');
            expect(callbacks.routing.openServerSelect).not.toHaveBeenCalled();
            expect(callbacks.state.setReady).not.toHaveBeenCalledWith(true);
            expect(callbacks.errors.handleGlobalError).not.toHaveBeenCalled();
        });

        it('routes to player and switches to first channel when no current channel exists', async () => {
            const firstChannel = { id: 'first-channel-id' };
            const {
                coordinator,
                callbacks,
                mocks: { navigation },
            } = makeCoordinator({ modules: { channelManager: {
                    getCurrentChannel: jest.fn().mockReturnValue(null),
                    getAllChannels: jest.fn().mockReturnValue([firstChannel]),
                } as unknown as InitializationDependencies['modules']['channelManager'] } });
            await coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY);

            expect(navigation.replaceScreen).toHaveBeenCalledWith('player');
            expect(callbacks.routing.switchToChannel).toHaveBeenCalledWith(firstChannel.id);
            expect(callbacks.routing.openServerSelect).not.toHaveBeenCalled();
        });

	        it('opens server select when no channels exist', async () => {
            const {
                coordinator,
                callbacks,
                mocks: { navigation },
            } = makeCoordinator({ modules: { channelManager: {
                    getCurrentChannel: jest.fn().mockReturnValue(null),
                    getAllChannels: jest.fn().mockReturnValue([]),
                } as unknown as InitializationDependencies['modules']['channelManager'] } });
            await coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY);

            expect(navigation.replaceScreen).not.toHaveBeenCalled();
            expect(callbacks.routing.switchToChannel).not.toHaveBeenCalled();
            expect(callbacks.routing.openServerSelect).toHaveBeenCalledTimes(1);
	        });

	        it('does not publish ready or ready lifecycle phase when post-ready routing throws', async () => {
	            const lifecycle = {
	                setPhase: jest.fn(),
	            } as unknown as InitializationDependencies['modules']['lifecycle'];
            const { coordinator, deps, callbacks } = makeCoordinator({ modules: { lifecycle, channelManager: {
	                    getCurrentChannel: jest.fn().mockReturnValue({ id: 'current-channel-id' }),
	                    getAllChannels: jest.fn().mockReturnValue([]),
	                } as unknown as InitializationDependencies['modules']['channelManager'] } });

	            callbacks.routing.switchToChannel.mockRejectedValueOnce(new Error('route failed'));

	            await expect(coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY)).rejects.toThrow('route failed');

	            expect(callbacks.state.setReady).not.toHaveBeenCalledWith(true);
	            expect((deps.modules.lifecycle as unknown as { setPhase: jest.Mock }).setPhase).not.toHaveBeenCalledWith('ready');
	            expect(callbacks.errors.handleGlobalError).toHaveBeenCalledWith(
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
	            } as unknown as InitializationDependencies['modules']['lifecycle'];
		            const {
		                coordinator,
		                deps,
		                callbacks,
		                mocks: { navigation },
		            } = makeCoordinator({ modules: { lifecycle, channelManager: {
	                    getCurrentChannel: jest.fn().mockReturnValue({ id: 'current-channel-id' }),
	                    getAllChannels: jest.fn().mockReturnValue([]),
	                } as unknown as InitializationDependencies['modules']['channelManager'] } });
	            callbacks.routing.switchToChannel.mockResolvedValueOnce({
                kind: 'failed',
                reason: 'missing_channel',
            });

	            await expect(coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY)).resolves.toBeUndefined();

	            expect(navigation.replaceScreen).toHaveBeenCalledWith('channel-setup');
	            expect(navigation.replaceScreen).not.toHaveBeenCalledWith('player');
	            expect(callbacks.routing.openServerSelect).not.toHaveBeenCalled();
	            expect(callbacks.state.setReady).toHaveBeenCalledWith(true);
	            expect((deps.modules.lifecycle as unknown as { setPhase: jest.Mock }).setPhase).toHaveBeenCalledWith('ready');
	            expect(callbacks.errors.handleGlobalError).not.toHaveBeenCalled();
	        });

	        it('does not publish ready or open server select when the initial tune aborts', async () => {
	            const lifecycle = {
	                setPhase: jest.fn(),
	            } as unknown as InitializationDependencies['modules']['lifecycle'];
		            const {
		                coordinator,
		                deps,
		                callbacks,
		                mocks: { navigation },
		            } = makeCoordinator({ modules: { lifecycle, channelManager: {
	                    getCurrentChannel: jest.fn().mockReturnValue({ id: 'current-channel-id' }),
	                    getAllChannels: jest.fn().mockReturnValue([]),
	                } as unknown as InitializationDependencies['modules']['channelManager'] } });
	            callbacks.routing.switchToChannel.mockResolvedValueOnce({ kind: 'aborted' });

	            await expect(coordinator.runStartup(STARTUP_PHASE.RESUME_EPG_ONLY)).rejects.toThrow(
	                'Initial channel switch aborted for current-channel-id.'
	            );

            expect(navigation.replaceScreen).not.toHaveBeenCalledWith('player');
            expect(callbacks.routing.openServerSelect).not.toHaveBeenCalled();
            expect(callbacks.state.setReady).not.toHaveBeenCalledWith(true);
            expect((deps.modules.lifecycle as unknown as { setPhase: jest.Mock }).setPhase).not.toHaveBeenCalledWith('ready');
	            expect(callbacks.errors.handleGlobalError).toHaveBeenCalledWith(
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

            const epg = { initialize: jest.fn() } as unknown as InitializationDependencies['modules']['epg'];
            const { coordinator } = makeCoordinator({ modules: { epg, plexLibrary: null } });

            await coordinator.ensureEPGInitialized();

	            expect((epg as unknown as { initialize: jest.Mock }).initialize).toHaveBeenCalledWith(
	                expect.objectContaining({ layoutMode: 'classic' })
	            );
	        });

        it('uses overlay only when storage is exactly overlay', async () => {
            localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE, 'overlay');

            const epg = { initialize: jest.fn() } as unknown as InitializationDependencies['modules']['epg'];
            const { coordinator } = makeCoordinator({ modules: { epg, plexLibrary: null } });

            await coordinator.ensureEPGInitialized();

            expect((epg as unknown as { initialize: jest.Mock }).initialize).toHaveBeenCalledWith(
                expect.objectContaining({ layoutMode: 'overlay' })
            );
        });

	        it('treats invalid stored values as classic', async () => {
	            localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE, 'weird');

            const epg = { initialize: jest.fn() } as unknown as InitializationDependencies['modules']['epg'];
            const { coordinator } = makeCoordinator({ modules: { epg, plexLibrary: null } });

            await coordinator.ensureEPGInitialized();

	            expect((epg as unknown as { initialize: jest.Mock }).initialize).toHaveBeenCalledWith(
	                expect.objectContaining({ layoutMode: 'classic' })
	            );
	        });

	        it('preserves supplied onLayoutModeChange when shaping EPG config', async () => {
	            const onLayoutModeChange = jest.fn();
	            const epg = { initialize: jest.fn() } as unknown as InitializationDependencies['modules']['epg'];
	            const { coordinator } = makeCoordinator(
	                { modules: { epg, plexLibrary: null } },
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
	            const epg = { initialize: jest.fn() } as unknown as InitializationDependencies['modules']['epg'];
	            const { coordinator } = makeCoordinator({ modules: { epg, plexLibrary: null } });
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
