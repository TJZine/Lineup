/**
 * @jest-environment jsdom
 */

import { InitializationCoordinator } from '../InitializationCoordinator';
import type { InitializationDependencies, InitializationCallbacks } from '../InitializationCoordinator';
import type { PlexAuthDataV2 } from '../../modules/plex/auth';
import { CHANNEL_BADGE_CONTAINER_ID } from '../../modules/ui/channel-badge';
import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';

const createStoredCredentials = (
    activeToken: string,
    accountToken: string,
    userId: string = 'user-1'
): PlexAuthDataV2 => ({
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
});

describe('InitializationCoordinator (Plex Home)', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    });

    type CoordinatorHarness = {
        coordinator: InitializationCoordinator;
        deps: InitializationDependencies;
        callbacks: InitializationCallbacks;
    };

    const makeCoordinator = (
        depsOverrides: Partial<InitializationDependencies> = {}
    ): CoordinatorHarness => {
        const navigation = {
            getCurrentScreen: jest.fn().mockReturnValue('splash'),
            goTo: jest.fn(),
            replaceScreen: jest.fn(),
            getScreenParams: jest.fn().mockReturnValue({}),
            getState: jest.fn().mockReturnValue({ screenStack: [] }),
        } as unknown as InitializationDependencies['navigation'];

        const plexAuth = {
            getStoredCredentials: jest.fn().mockResolvedValue(null),
            validateToken: jest.fn().mockResolvedValue(true),
            getCurrentUser: jest.fn().mockReturnValue(null),
            storeCredentials: jest.fn().mockResolvedValue(undefined),
            getHomeUsers: jest.fn().mockResolvedValue([]),
            on: jest.fn(() => ({ dispose: jest.fn() })),
        } as unknown as InitializationDependencies['plexAuth'];

        const plexDiscovery = {
            initialize: jest.fn().mockResolvedValue(undefined),
            isConnected: jest.fn().mockReturnValue(false),
            on: jest.fn(() => ({ dispose: jest.fn() })),
        } as unknown as InitializationDependencies['plexDiscovery'];

        const deps: InitializationDependencies = {
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
            nowPlayingInfo: null,
            playerOsd: null,
            channelNumberOverlay: null,
            channelBadgeOverlay: null,
            miniGuide: null,
            channelTransition: null,
            playbackOptions: null,
            exitConfirm: null,
            ...depsOverrides,
        };

        const callbacks: InitializationCallbacks = {
            updateModuleStatus: jest.fn(),
            getModuleStatus: jest.fn(),
            handleGlobalError: jest.fn(),
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

        const coordinator = new InitializationCoordinator(
            {
                plexConfig: {} as never,
                navConfig: {} as never,
                playerConfig: {} as never,
                epgConfig: {} as never,
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

        return { coordinator, deps, callbacks };
    };

    it('routes to server-select when active token is valid and picker is disabled', async () => {
        const { coordinator, deps } = makeCoordinator();
        const plexAuth = deps.plexAuth as unknown as {
            getStoredCredentials: jest.Mock;
            validateToken: jest.Mock;
        };
        const navigation = deps.navigation as unknown as { goTo: jest.Mock };
        const plexDiscovery = deps.plexDiscovery as unknown as { isConnected: jest.Mock };

        plexAuth.getStoredCredentials.mockResolvedValue(createStoredCredentials('active-token', 'account-token'));
        plexAuth.validateToken.mockResolvedValue(true);
        plexDiscovery.isConnected.mockReturnValue(false);

        await coordinator.runStartup(2);

        expect(navigation.goTo).toHaveBeenCalledWith('server-select');
        expect(navigation.goTo).not.toHaveBeenCalledWith('profile-select');
    });

    it('routes to profile-select when active token is invalid but account is valid', async () => {
        const { coordinator, deps } = makeCoordinator();
        const plexAuth = deps.plexAuth as unknown as {
            getStoredCredentials: jest.Mock;
            validateToken: jest.Mock;
        };
        const navigation = deps.navigation as unknown as { goTo: jest.Mock };

        plexAuth.getStoredCredentials.mockResolvedValue(createStoredCredentials('bad-token', 'account-token'));
        plexAuth.validateToken
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);

        await coordinator.runStartup(2);

        expect(navigation.goTo).toHaveBeenCalledWith('profile-select');
    });

    it('configures discovery storage before resuming Phase 3 on profileChange', async () => {
        const { coordinator, deps, callbacks } = makeCoordinator();

        const order: string[] = [];

        // Arrange deps: stored creds + valid active token, and ensure startup shows profile-select
        const plexAuth = deps.plexAuth as unknown as {
            getStoredCredentials: jest.Mock;
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
        });

        navigation.getCurrentScreen.mockReturnValue('auth');
        plexAuth.getStoredCredentials.mockResolvedValue(
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
        await coordinator.runStartup(2);
        expect(navigation.goTo).toHaveBeenCalledWith('profile-select');
        expect(profileChangeHandler).toBeTruthy();

        // Clear any ordering noise from Phase 2 (which also configures discovery storage).
        order.length = 0;

        // Act: simulate user switch emitting profileChange
        profileChangeHandler!();

        // Wait for the Phase 3 startup triggered by the handler.
        const phase3CallIndex = runSpy.mock.calls.findIndex((args) => args[0] === 3);
        expect(phase3CallIndex).toBeGreaterThanOrEqual(0);
        const phase3Promise = runSpy.mock.results[phase3CallIndex]?.value as Promise<void>;
        await phase3Promise;

        // Assert: storage configured before discovery initialize reads from localStorage
        expect(order[0]).toBe('configure');
        expect(order).toContain('init');
    });

    describe('Phase 3 startup policy branches', () => {
        it('marks discovery error, navigates to server-select, and does not register server resume when discovery init fails', async () => {
            const { coordinator, deps, callbacks } = makeCoordinator();
            const navigation = deps.navigation as unknown as { goTo: jest.Mock };
            const plexDiscovery = deps.plexDiscovery as unknown as {
                initialize: jest.Mock;
                on: jest.Mock;
            };

            plexDiscovery.initialize.mockRejectedValue(new Error('discovery init failed'));

            await coordinator.runStartup(3);

            expect(callbacks.updateModuleStatus).toHaveBeenCalledWith(
                'plex-server-discovery',
                'error'
            );
            expect(navigation.goTo).toHaveBeenCalledWith('server-select');
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

            plexDiscovery.initialize.mockResolvedValue(undefined);
            plexDiscovery.isConnected.mockReturnValue(false);

            await coordinator.runStartup(3);

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

    describe('post-ready routing policy', () => {
        it('routes to audio-setup when audio and channel setup are both required', async () => {
            const { coordinator, deps, callbacks } = makeCoordinator();
            const navigation = deps.navigation as unknown as { replaceScreen: jest.Mock };

            (callbacks.shouldRunAudioSetup as jest.Mock).mockReturnValue(true);
            (callbacks.shouldRunChannelSetup as jest.Mock).mockReturnValue(true);

            await coordinator.runStartup(5);

            expect(navigation.replaceScreen).toHaveBeenCalledWith('audio-setup');
        });

        it('routes to channel-setup when only channel setup is required', async () => {
            const { coordinator, deps, callbacks } = makeCoordinator();
            const navigation = deps.navigation as unknown as { replaceScreen: jest.Mock };

            (callbacks.shouldRunAudioSetup as jest.Mock).mockReturnValue(false);
            (callbacks.shouldRunChannelSetup as jest.Mock).mockReturnValue(true);

            await coordinator.runStartup(5);

            expect(navigation.replaceScreen).toHaveBeenCalledWith('channel-setup');
        });

        it('routes to player and switches to current channel when present', async () => {
            const currentChannel = { id: 'current-channel-id' };
            const { coordinator, deps, callbacks } = makeCoordinator({
                channelManager: {
                    getCurrentChannel: jest.fn().mockReturnValue(currentChannel),
                    getAllChannels: jest.fn().mockReturnValue([]),
                } as unknown as InitializationDependencies['channelManager'],
            });
            const navigation = deps.navigation as unknown as { replaceScreen: jest.Mock };

            await coordinator.runStartup(5);

            expect(navigation.replaceScreen).toHaveBeenCalledWith('player');
            expect(callbacks.switchToChannel).toHaveBeenCalledWith(currentChannel.id);
            expect(callbacks.openServerSelect).not.toHaveBeenCalled();
        });

        it('routes to player and switches to first channel when no current channel exists', async () => {
            const firstChannel = { id: 'first-channel-id' };
            const { coordinator, deps, callbacks } = makeCoordinator({
                channelManager: {
                    getCurrentChannel: jest.fn().mockReturnValue(null),
                    getAllChannels: jest.fn().mockReturnValue([firstChannel]),
                } as unknown as InitializationDependencies['channelManager'],
            });
            const navigation = deps.navigation as unknown as { replaceScreen: jest.Mock };

            await coordinator.runStartup(5);

            expect(navigation.replaceScreen).toHaveBeenCalledWith('player');
            expect(callbacks.switchToChannel).toHaveBeenCalledWith(firstChannel.id);
            expect(callbacks.openServerSelect).not.toHaveBeenCalled();
        });

        it('routes to player and opens server select when no channels exist', async () => {
            const { coordinator, deps, callbacks } = makeCoordinator({
                channelManager: {
                    getCurrentChannel: jest.fn().mockReturnValue(null),
                    getAllChannels: jest.fn().mockReturnValue([]),
                } as unknown as InitializationDependencies['channelManager'],
            });
            const navigation = deps.navigation as unknown as { replaceScreen: jest.Mock };

            await coordinator.runStartup(5);

            expect(navigation.replaceScreen).toHaveBeenCalledWith('player');
            expect(callbacks.switchToChannel).not.toHaveBeenCalled();
            expect(callbacks.openServerSelect).toHaveBeenCalled();
        });
    });

    describe('EPG layoutMode fallback injection', () => {
        it('defaults to classic when storage is unset', async () => {
            localStorage.removeItem(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE);

            const epg = { initialize: jest.fn() } as unknown as InitializationDependencies['epg'];
            const { coordinator } = makeCoordinator({ epg, plexLibrary: null });

            await coordinator.runStartup(5);

            expect((epg as unknown as { initialize: jest.Mock }).initialize).toHaveBeenCalledWith(
                expect.objectContaining({ layoutMode: 'classic' })
            );
        });

        it('uses overlay only when storage is exactly overlay', async () => {
            localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE, 'overlay');

            const epg = { initialize: jest.fn() } as unknown as InitializationDependencies['epg'];
            const { coordinator } = makeCoordinator({ epg, plexLibrary: null });

            await coordinator.runStartup(5);

            expect((epg as unknown as { initialize: jest.Mock }).initialize).toHaveBeenCalledWith(
                expect.objectContaining({ layoutMode: 'overlay' })
            );
        });

        it('treats invalid stored values as classic', async () => {
            localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE, 'weird');

            const epg = { initialize: jest.fn() } as unknown as InitializationDependencies['epg'];
            const { coordinator } = makeCoordinator({ epg, plexLibrary: null });

            await coordinator.runStartup(5);

            expect((epg as unknown as { initialize: jest.Mock }).initialize).toHaveBeenCalledWith(
                expect.objectContaining({ layoutMode: 'classic' })
            );
        });
    });
});
