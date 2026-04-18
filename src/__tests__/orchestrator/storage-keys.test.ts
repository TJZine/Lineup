import { OrchestratorStorageContext } from '../../core/orchestrator/OrchestratorStorageContext';
import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import { PLEX_DISCOVERY_CONSTANTS } from '../../modules/plex/discovery/constants';

describe('OrchestratorStorageContext', () => {
    const createContext = (input: { userId: string | null; serverId: string | null }): {
        context: OrchestratorStorageContext;
        setDiscoveryStorageKeys: jest.Mock;
        setChannelManagerStorageKeys: jest.Mock;
    } => {
        const setDiscoveryStorageKeys = jest.fn();
        const setChannelManagerStorageKeys = jest.fn();
        const context = new OrchestratorStorageContext({
            getActiveUserId: (): string | null => input.userId,
            getSelectedServerId: (): string | null => input.serverId,
            setDiscoveryStorageKeys,
            setChannelManagerStorageKeys,
        });
        return { context, setDiscoveryStorageKeys, setChannelManagerStorageKeys };
    };

    it('namespaces selected server and health keys by active user when present', () => {
        const { context } = createContext({ userId: 'user-1', serverId: null });
        expect(context.getSelectedServerStorageKey())
            .toBe(`${PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY}:user-1`);
        expect(context.getServerHealthStorageKey())
            .toBe(`${PLEX_DISCOVERY_CONSTANTS.SERVER_HEALTH_KEY}:user-1`);
    });

    it('falls back to base keys when user id is unavailable', () => {
        const { context } = createContext({ userId: null, serverId: null });
        expect(context.getSelectedServerStorageKey())
            .toBe(PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY);
        expect(context.getServerHealthStorageKey())
            .toBe(PLEX_DISCOVERY_CONSTANTS.SERVER_HEALTH_KEY);
    });

    it('configures discovery storage keys for active user', () => {
        const { context, setDiscoveryStorageKeys } = createContext({ userId: 'user-1', serverId: null });
        context.configureDiscoveryStorageKeysForActiveUser();
        expect(setDiscoveryStorageKeys).toHaveBeenCalledWith(
            `${PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY}:user-1`,
            `${PLEX_DISCOVERY_CONSTANTS.SERVER_HEALTH_KEY}:user-1`
        );
    });

    it('scopes channel manager storage keys by selected server and active user', () => {
        const { context, setChannelManagerStorageKeys } = createContext({ userId: 'user-1', serverId: 'server-1' });
        context.configureChannelManagerStorageForSelectedServer();
        expect(setChannelManagerStorageKeys).toHaveBeenCalledWith(
            `${LINEUP_STORAGE_KEYS.CHANNELS_SERVER}:server-1:user-1`,
            `${LINEUP_STORAGE_KEYS.CURRENT_CHANNEL}:server-1:user-1`
        );
    });

    it('uses server-scoped channel manager keys when user id is unavailable', () => {
        const { context, setChannelManagerStorageKeys } = createContext({ userId: null, serverId: 'server-1' });
        context.configureChannelManagerStorageForSelectedServer();
        expect(setChannelManagerStorageKeys).toHaveBeenCalledWith(
            `${LINEUP_STORAGE_KEYS.CHANNELS_SERVER}:server-1`,
            `${LINEUP_STORAGE_KEYS.CURRENT_CHANNEL}:server-1`
        );
    });

    it('does not configure channel manager storage keys when no server is selected', () => {
        const { context, setChannelManagerStorageKeys } = createContext({ userId: 'user-1', serverId: null });
        context.configureChannelManagerStorageForSelectedServer();
        expect(setChannelManagerStorageKeys).not.toHaveBeenCalled();
    });
});
