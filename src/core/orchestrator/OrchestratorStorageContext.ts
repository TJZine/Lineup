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

    private _userScopedKey(baseKey: string): string {
        const userId = this._deps.getActiveUserId();
        return userId ? `${baseKey}:${userId}` : baseKey;
    }

    getSelectedServerStorageKey(): string {
        return this._userScopedKey(PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY);
    }

    getServerHealthStorageKey(): string {
        return this._userScopedKey(PLEX_DISCOVERY_CONSTANTS.SERVER_HEALTH_KEY);
    }

    configureDiscoveryStorageKeysForActiveUser(): void {
        this._deps.setDiscoveryStorageKeys(
            this.getSelectedServerStorageKey(),
            this.getServerHealthStorageKey()
        );
    }

    configureChannelManagerStorageForSelectedServer(): void {
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
