import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import { safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from '../../utils/storage';

export class DeveloperSettingsStore {
    readDebugLoggingEnabled(fallback: boolean = false): boolean {
        return this._readBooleanKey(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, fallback);
    }

    hasDebugLoggingEnabledValue(): boolean {
        return this._readBooleanKeyMaybe(LINEUP_STORAGE_KEYS.DEBUG_LOGGING) !== null;
    }

    writeDebugLoggingEnabled(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, enabled ? '1' : '0');
    }

    readSubtitleDebugLoggingEnabled(fallback: boolean = false): boolean {
        return this._readBooleanKey(LINEUP_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING, fallback);
    }

    writeSubtitleDebugLoggingEnabled(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING, enabled ? '1' : '0');
    }

    private _readBooleanKey(key: string, fallback: boolean): boolean {
        return this._readBooleanKeyMaybe(key) ?? fallback;
    }

    private _readBooleanKeyMaybe(key: string): boolean | null {
        const raw = safeLocalStorageGet(key);
        if (raw === '1') return true;
        if (raw === '0') return false;
        if (raw !== null) {
            safeLocalStorageRemove(key);
        }
        return null;
    }
}
