import {
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSet,
    safeLocalStorageSetWithResult,
} from '../../../utils/storage';
import { CURRENT_CHANNEL_KEY, STORAGE_KEY } from './constants';
import type { StoredChannelData } from './types';

export type StoredChannelWriteResult = 'ok' | 'quota-exceeded' | 'unavailable';
export type CurrentChannelWriteResult = 'ok' | 'unavailable';

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

        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            safeLocalStorageRemove(this._storageKey);
            return null;
        }

        if (!this._isValidStoredShape(parsed)) {
            safeLocalStorageRemove(this._storageKey);
            return null;
        }

        return parsed as Partial<StoredChannelData>;
    }

    writeStoredChannelData(data: StoredChannelData): StoredChannelWriteResult {
        const result = safeLocalStorageSetWithResult(this._storageKey, JSON.stringify(data));
        if (result.ok) {
            return 'ok';
        }
        return result.reason;
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
            safeLocalStorageRemove(this._currentChannelKey);
            return null;
        }

        if (normalized !== raw) {
            safeLocalStorageSet(this._currentChannelKey, normalized);
        }

        return normalized;
    }

    writeCurrentChannelId(channelId: string): CurrentChannelWriteResult {
        const normalized = channelId.trim();
        if (normalized.length === 0) {
            return safeLocalStorageRemove(this._currentChannelKey) ? 'ok' : 'unavailable';
        }

        return safeLocalStorageSet(this._currentChannelKey, normalized) ? 'ok' : 'unavailable';
    }

    private _isValidStoredShape(value: unknown): value is Partial<StoredChannelData> {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return false;
        }

        const record = value as Record<string, unknown>;
        return Array.isArray(record.channels) && Array.isArray(record.channelOrder);
    }

}
