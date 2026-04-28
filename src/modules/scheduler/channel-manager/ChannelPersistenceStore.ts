import {
    type SafeLocalStorageMutationResult,
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageRemoveWithResult,
    safeLocalStorageSetWithResult,
} from '../../../utils/storage';
import { CURRENT_CHANNEL_KEY, STORAGE_KEY } from './constants';
import type { StoredChannelData } from './types';
import { decodeStoredChannelData, encodeStoredChannelData } from './StoredChannelDataCodec';

export class ChannelPersistenceStore {
    private _storageKey: string;
    private _currentChannelKey: string;

    constructor(storageKey: string = STORAGE_KEY, currentChannelKey: string = CURRENT_CHANNEL_KEY) {
        this._storageKey = STORAGE_KEY;
        this._currentChannelKey = CURRENT_CHANNEL_KEY;
        this.setStorageKeys(storageKey, currentChannelKey);
    }

    setStorageKeys(storageKey: string, currentChannelKey: string): void {
        const normalizedStorageKey = storageKey.trim();
        const normalizedCurrentChannelKey = currentChannelKey.trim();
        if (normalizedStorageKey.length === 0 || normalizedCurrentChannelKey.length === 0) {
            throw new Error('Storage keys must be non-empty strings');
        }
        this._storageKey = normalizedStorageKey;
        this._currentChannelKey = normalizedCurrentChannelKey;
    }

    readStoredChannelData(): Partial<StoredChannelData> | null {
        const raw = safeLocalStorageGet(this._storageKey);
        if (raw === null) {
            return null;
        }
        if (raw === '') {
            safeLocalStorageRemove(this._storageKey);
            return null;
        }

        const parsed = decodeStoredChannelData(raw);
        if (parsed === null) {
            safeLocalStorageRemove(this._storageKey);
            return null;
        }

        return parsed as Partial<StoredChannelData>;
    }

    writeStoredChannelData(data: StoredChannelData): SafeLocalStorageMutationResult {
        const encoded = encodeStoredChannelData(data);
        return safeLocalStorageSetWithResult(this._storageKey, encoded);
    }

    clearStoredChannelData(): void {
        safeLocalStorageRemove(this._storageKey);
    }

    readCurrentChannelId(): string | null {
        const raw = safeLocalStorageGet(this._currentChannelKey);
        if (raw === null) {
            return null;
        }

        const normalized = raw.trim();
        if (normalized.length === 0) {
            safeLocalStorageRemoveWithResult(this._currentChannelKey);
            return null;
        }

        if (normalized !== raw) {
            safeLocalStorageSetWithResult(this._currentChannelKey, normalized);
        }

        return normalized;
    }

    writeCurrentChannelId(channelId: string): SafeLocalStorageMutationResult {
        const normalized = channelId.trim();
        if (normalized.length === 0) {
            return safeLocalStorageRemoveWithResult(this._currentChannelKey);
        }

        return safeLocalStorageSetWithResult(this._currentChannelKey, normalized);
    }
}
