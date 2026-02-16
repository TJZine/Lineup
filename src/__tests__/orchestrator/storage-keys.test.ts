import { AppOrchestrator } from '../../Orchestrator';
import { PLEX_DISCOVERY_CONSTANTS } from '../../modules/plex/discovery/constants';
import { STORAGE_KEYS } from '../../types';

type PlexAuthLike = {
    getActiveUserId: () => string | null;
    getAccountUserId: () => string | null;
};

type OrchestratorWithPlexAuth = {
    _plexAuth: PlexAuthLike | null;
};

type ChannelManagerLike = {
    setStorageKeys: jest.Mock;
};

type PlexDiscoveryLike = {
    getSelectedServer: () => { id: string } | null;
};

type OrchestratorStorageInternals = {
    _plexAuth: PlexAuthLike | null;
    _channelManager: ChannelManagerLike | null;
    _plexDiscovery: PlexDiscoveryLike | null;
    _configureChannelManagerStorageForSelectedServer: () => Promise<void>;
};

describe('AppOrchestrator storage key characterization', () => {
    const setAuth = (
        orchestrator: AppOrchestrator,
        activeUserId: string | null,
        accountUserId: string | null
    ): void => {
        const orchestratorWithAuth = orchestrator as unknown as OrchestratorWithPlexAuth;
        orchestratorWithAuth._plexAuth = {
            getActiveUserId: (): string | null => activeUserId,
            getAccountUserId: (): string | null => accountUserId,
        };
    };

    const setSelectedServer = (orchestrator: AppOrchestrator, serverId: string | null): void => {
        const internals = orchestrator as unknown as OrchestratorStorageInternals;
        internals._plexDiscovery = {
            getSelectedServer: (): { id: string } | null => {
                if (!serverId) {
                    return null;
                }
                return { id: serverId };
            },
        };
    };

    const setChannelManager = (
        orchestrator: AppOrchestrator,
        channelManager: ChannelManagerLike | null
    ): void => {
        const internals = orchestrator as unknown as OrchestratorStorageInternals;
        internals._channelManager = channelManager;
    };

    it('namespaces selected server and health keys by active user when present', () => {
        const orchestrator = new AppOrchestrator();
        setAuth(orchestrator, 'user-1', 'account-1');

        expect(orchestrator.getSelectedServerStorageKey())
            .toBe(`${PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY}:user-1`);
        expect(orchestrator.getServerHealthStorageKey())
            .toBe(`${PLEX_DISCOVERY_CONSTANTS.SERVER_HEALTH_KEY}:user-1`);
    });

    it('falls back to account user id when active user id is unavailable', () => {
        const orchestrator = new AppOrchestrator();
        setAuth(orchestrator, null, 'account-1');

        expect(orchestrator.getSelectedServerStorageKey())
            .toBe(`${PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY}:account-1`);
        expect(orchestrator.getServerHealthStorageKey())
            .toBe(`${PLEX_DISCOVERY_CONSTANTS.SERVER_HEALTH_KEY}:account-1`);
    });

    it('falls back to base keys when both active/account ids are unavailable', () => {
        const orchestrator = new AppOrchestrator();
        setAuth(orchestrator, null, null);

        expect(orchestrator.getSelectedServerStorageKey())
            .toBe(PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY);
        expect(orchestrator.getServerHealthStorageKey())
            .toBe(PLEX_DISCOVERY_CONSTANTS.SERVER_HEALTH_KEY);
    });

    it('scopes channel manager storage keys by selected server and active user', async () => {
        const orchestrator = new AppOrchestrator();
        const channelManager: ChannelManagerLike = { setStorageKeys: jest.fn() };

        setAuth(orchestrator, 'user-1', 'account-1');
        setSelectedServer(orchestrator, 'server-1');
        setChannelManager(orchestrator, channelManager);

        const internals = orchestrator as unknown as OrchestratorStorageInternals;
        await internals._configureChannelManagerStorageForSelectedServer();

        expect(channelManager.setStorageKeys).toHaveBeenCalledWith(
            `${STORAGE_KEYS.CHANNELS_SERVER}:server-1:user-1`,
            `${STORAGE_KEYS.CURRENT_CHANNEL}:server-1:user-1`
        );
    });

    it('falls back to account user id for channel manager storage keys', async () => {
        const orchestrator = new AppOrchestrator();
        const channelManager: ChannelManagerLike = { setStorageKeys: jest.fn() };

        setAuth(orchestrator, null, 'account-1');
        setSelectedServer(orchestrator, 'server-1');
        setChannelManager(orchestrator, channelManager);

        const internals = orchestrator as unknown as OrchestratorStorageInternals;
        await internals._configureChannelManagerStorageForSelectedServer();

        expect(channelManager.setStorageKeys).toHaveBeenCalledWith(
            `${STORAGE_KEYS.CHANNELS_SERVER}:server-1:account-1`,
            `${STORAGE_KEYS.CURRENT_CHANNEL}:server-1:account-1`
        );
    });

    it('uses server-scoped channel manager keys when user ids are unavailable', async () => {
        const orchestrator = new AppOrchestrator();
        const channelManager: ChannelManagerLike = { setStorageKeys: jest.fn() };

        setAuth(orchestrator, null, null);
        setSelectedServer(orchestrator, 'server-1');
        setChannelManager(orchestrator, channelManager);

        const internals = orchestrator as unknown as OrchestratorStorageInternals;
        await internals._configureChannelManagerStorageForSelectedServer();

        expect(channelManager.setStorageKeys).toHaveBeenCalledWith(
            `${STORAGE_KEYS.CHANNELS_SERVER}:server-1`,
            `${STORAGE_KEYS.CURRENT_CHANNEL}:server-1`
        );
    });

    it('does not reconfigure channel manager storage keys when no server is selected', async () => {
        const orchestrator = new AppOrchestrator();
        const channelManager: ChannelManagerLike = { setStorageKeys: jest.fn() };

        setAuth(orchestrator, 'user-1', 'account-1');
        setSelectedServer(orchestrator, null);
        setChannelManager(orchestrator, channelManager);

        const internals = orchestrator as unknown as OrchestratorStorageInternals;
        await internals._configureChannelManagerStorageForSelectedServer();

        expect(channelManager.setStorageKeys).not.toHaveBeenCalled();
    });
});
