import { safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from '../../../utils/storage';
import { CURRENT_CHANNEL_KEY, STORAGE_KEY } from './constants';
import type { StoredChannelData } from './types';

export type StoredChannelWriteResult = 'ok' | 'quota-exceeded' | 'unavailable';
export type CurrentChannelWriteResult = 'ok' | 'unavailable';

export class ChannelPersistenceStore {
    private _storageKey: string;
    private _currentChannelKey: string;

    constructor(storageKey: string = STORAGE_KEY, currentChannelKey: string = CURRENT_CHANNEL_KEY) {
        this._storageKey = storageKey;
        this._currentChannelKey = currentChannelKey;
    }

    setStorageKeys(storageKey: string, currentChannelKey: string): void {
        if (!storageKey || !currentChannelKey) {
            throw new Error('Storage keys must be non-empty strings');
        }
        this._storageKey = storageKey;
        this._currentChannelKey = currentChannelKey;
    }

    readStoredChannelData(): Partial<StoredChannelData> | null {
        const raw = safeLocalStorageGet(this._storageKey);
        if (!raw) {
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
        try {
            localStorage.setItem(this._storageKey, JSON.stringify(data));
            return 'ok';
        } catch (error) {
            if (this._isQuotaExceeded(error)) {
                return 'quota-exceeded';
            }
            return 'unavailable';
        }
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

    private _isQuotaExceeded(error: unknown): boolean {
        if (!(error instanceof DOMException)) {
            return false;
        }

        return (
            error.name === 'QuotaExceededError' ||
            error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
        );
    }
}
