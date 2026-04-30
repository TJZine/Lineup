import { PLEX_DISCOVERY_CONSTANTS } from '../../modules/plex/discovery/constants';
import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    SelectedServerScreenStateProjection,
    type SelectedServerScreenState,
} from '../server-selection/SelectedServerScreenStateProjection';

export interface OrchestratorStorageContextDeps {
    getActiveUserId: () => string | null;
    getSelectedServerId: () => string | null;
    setDiscoveryStorageKeys: (selectedKey: string, healthKey: string) => void;
    setChannelManagerStorageKeys: (channelsKey: string, currentChannelKey: string) => void;
}

export class OrchestratorStorageContext {
    private readonly _selectedServerScreenStateProjection = new SelectedServerScreenStateProjection(() => ({
        selectedServerKey: this.getSelectedServerStorageKey(),
        serverHealthKey: this.getServerHealthStorageKey(),
    }));

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

    getSelectedServerScreenState(): SelectedServerScreenState {
        return this._selectedServerScreenStateProjection.readAndClean();
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
            ? `${LINEUP_STORAGE_KEYS.CHANNELS_SERVER}:${serverId}:${userId}`
            : `${LINEUP_STORAGE_KEYS.CHANNELS_SERVER}:${serverId}`;
        const currentKey = userId
            ? `${LINEUP_STORAGE_KEYS.CURRENT_CHANNEL}:${serverId}:${userId}`
            : `${LINEUP_STORAGE_KEYS.CURRENT_CHANNEL}:${serverId}`;

        this._deps.setChannelManagerStorageKeys(channelsKey, currentKey);
    }
}
