import {
    type SafeLocalStorageMutationResult,
    safeLocalStorageGet,
    safeLocalStorageGetWithResult,
    safeLocalStorageRemove,
    safeLocalStorageRemoveWithResult,
    safeLocalStorageSetWithResult,
} from '../../../../utils/storage';
import { CURRENT_CHANNEL_KEY, STORAGE_KEY } from '../constants';
import type { StoredChannelData } from '../contracts/types';
import { decodeStoredChannelBody, encodeStoredChannelData } from './StoredChannelDataCodec';

export type StoredChannelBodyRead =
    | { kind: 'absent' | 'read-failed' }
    | { kind: 'unreadable' | 'unsupported'; raw: string }
    | { kind: 'readable'; data: Partial<StoredChannelData>; raw: string };

export class ChannelPersistenceStore {
    private _storageKey!: string;
    private _currentChannelKey!: string;

    constructor(storageKey: string = STORAGE_KEY, currentChannelKey: string = CURRENT_CHANNEL_KEY) {
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

    readStoredChannelData(): StoredChannelBodyRead {
        const result = safeLocalStorageGetWithResult(this._storageKey);
        if (!result.ok) return { kind: 'read-failed' };
        if (result.value === null) return { kind: 'absent' };
        const decoded = decodeStoredChannelBody(result.value);
        return decoded.kind === 'readable'
            ? { ...decoded, raw: result.value }
            : { kind: decoded.kind, raw: result.value };
    }

    readRawBody(): { ok: true; value: string | null } | { ok: false } {
        const result = safeLocalStorageGetWithResult(this._storageKey);
        return result.ok ? result : { ok: false };
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
