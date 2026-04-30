import {
    ServerSelectionStore,
    type ServerHealthMap,
} from '../../modules/plex/discovery/ServerSelectionStore';

type SelectedServerScreenStateStorageKeys = {
    selectedServerKey: string;
    serverHealthKey: string;
};

export type SelectedServerScreenState = {
    selectedServerId: string | null;
    serverHealth: ServerHealthMap;
};

export class SelectedServerScreenStateProjection {
    private readonly _store: ServerSelectionStore;

    constructor(getStorageKeys?: () => SelectedServerScreenStateStorageKeys) {
        this._store = new ServerSelectionStore(getStorageKeys);
    }

    readAndClean(): SelectedServerScreenState {
        return {
            selectedServerId: this._store.readSelectedServerIdAndClean(),
            serverHealth: this._store.readServerHealthMapAndClean(),
        };
    }
}
