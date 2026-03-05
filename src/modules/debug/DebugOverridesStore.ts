import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSet,
} from '../../utils/storage';

const PROFILE_MAX_LENGTH = 128;
const INVALID_PROFILE_CHARS = /[\r\n\0]/;

export class DebugOverridesStore {
    readNowPlayingStreamDebugEnabled(): boolean {
        return this._readBooleanKey(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG, false);
    }

    writeNowPlayingStreamDebugEnabled(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG, enabled ? '1' : '0');
    }

    readNowPlayingStreamDebugAutoShowEnabled(): boolean {
        return this._readBooleanKey(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG_AUTO_SHOW, false);
    }

    writeNowPlayingStreamDebugAutoShowEnabled(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG_AUTO_SHOW, enabled ? '1' : '0');
    }

    readTranscodeProfileName(): string | null {
        const raw = safeLocalStorageGet(LINEUP_STORAGE_KEYS.TRANSCODE_PROFILE_NAME);
        if (raw === null) return null;

        const normalized = this._normalizeProfileName(raw);
        if (!normalized) {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.TRANSCODE_PROFILE_NAME);
            return null;
        }

        if (normalized !== raw) {
            safeLocalStorageSet(LINEUP_STORAGE_KEYS.TRANSCODE_PROFILE_NAME, normalized);
        }

        return normalized;
    }

    writeTranscodeProfileName(value: string): void {
        const normalized = this._normalizeProfileName(value);
        if (!normalized) {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.TRANSCODE_PROFILE_NAME);
            return;
        }

        safeLocalStorageSet(LINEUP_STORAGE_KEYS.TRANSCODE_PROFILE_NAME, normalized);
    }

    clearTranscodeProfileName(): void {
        safeLocalStorageRemove(LINEUP_STORAGE_KEYS.TRANSCODE_PROFILE_NAME);
    }

    clearDebugOverrides(): void {
        safeLocalStorageRemove(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG);
        safeLocalStorageRemove(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG_AUTO_SHOW);
        safeLocalStorageRemove(LINEUP_STORAGE_KEYS.TRANSCODE_PROFILE_NAME);
    }

    private _readBooleanKey(key: string, fallback: boolean): boolean {
        const raw = safeLocalStorageGet(key);
        if (raw === '1') return true;
        if (raw === '0') return false;

        if (raw !== null) {
            safeLocalStorageRemove(key);
        }

        return fallback;
    }

    private _normalizeProfileName(value: string): string | null {
        const normalized = value.trim().slice(0, PROFILE_MAX_LENGTH);
        if (normalized.length === 0) return null;
        if (INVALID_PROFILE_CHARS.test(normalized)) return null;
        return normalized;
    }
}
