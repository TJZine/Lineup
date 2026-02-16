import { PLEX_DISCOVERY_CONSTANTS } from '../../modules/plex/discovery/constants';
import { STORAGE_KEYS } from '../../types';

export interface OrchestratorStorageContextDeps {
    getActiveUserId: () => string | null;
    getSelectedServerId: () => string | null;
    setDiscoveryStorageKeys: (selectedKey: string, healthKey: string) => void;
    setChannelManagerStorageKeys: (channelsKey: string, currentChannelKey: string) => void;
}

export class OrchestratorStorageContext {
    constructor(private readonly _deps: OrchestratorStorageContextDeps) {}

    getSelectedServerStorageKey(): string {
        const userId = this._deps.getActiveUserId();
        if (!userId) {
            return PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY;
        }
        return `${PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY}:${userId}`;
    }

    getServerHealthStorageKey(): string {
        const userId = this._deps.getActiveUserId();
        if (!userId) {
            return PLEX_DISCOVERY_CONSTANTS.SERVER_HEALTH_KEY;
        }
        return `${PLEX_DISCOVERY_CONSTANTS.SERVER_HEALTH_KEY}:${userId}`;
    }

    configureDiscoveryStorageKeysForActiveUser(): void {
        this._deps.setDiscoveryStorageKeys(
            this.getSelectedServerStorageKey(),
            this.getServerHealthStorageKey()
        );
    }

    async configureChannelManagerStorageForSelectedServer(): Promise<void> {
        const serverId = this._deps.getSelectedServerId();
        if (!serverId) {
            return;
        }

        const userId = this._deps.getActiveUserId();
        const channelsKey = userId
            ? `${STORAGE_KEYS.CHANNELS_SERVER}:${serverId}:${userId}`
            : `${STORAGE_KEYS.CHANNELS_SERVER}:${serverId}`;
        const currentKey = userId
            ? `${STORAGE_KEYS.CURRENT_CHANNEL}:${serverId}:${userId}`
            : `${STORAGE_KEYS.CURRENT_CHANNEL}:${serverId}`;

        this._deps.setChannelManagerStorageKeys(channelsKey, currentKey);
    }
}
