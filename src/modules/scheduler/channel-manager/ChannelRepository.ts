import { ChannelPersistenceStore, type CurrentChannelWriteResult, type StoredChannelWriteResult } from './ChannelPersistenceStore';
import { CURRENT_CHANNEL_KEY, STORAGE_KEY } from './constants';
import type { StoredChannelData } from './types';

export type LoadedChannelPersistence = {
    stored: Partial<StoredChannelData> | null;
    savedCurrentChannelId: string | null;
};

export class ChannelRepository {
    private readonly _store: ChannelPersistenceStore;

    constructor(storageKey: string = STORAGE_KEY, currentChannelKey: string = CURRENT_CHANNEL_KEY) {
        this._store = new ChannelPersistenceStore(storageKey, currentChannelKey);
    }

    setStorageKeys(storageKey: string, currentChannelKey: string): void {
        this._store.setStorageKeys(storageKey, currentChannelKey);
    }

    load(): LoadedChannelPersistence {
        const stored = this._store.readStoredChannelData();
        if (stored === null) {
            return { stored: null, savedCurrentChannelId: null };
        }

        return {
            stored,
            savedCurrentChannelId: this._store.readCurrentChannelId(),
        };
    }

    saveStoredChannelData(data: StoredChannelData): StoredChannelWriteResult {
        return this._store.writeStoredChannelData(data);
    }

    saveCurrentChannelId(channelId: string): CurrentChannelWriteResult {
        return this._store.writeCurrentChannelId(channelId);
    }
}
