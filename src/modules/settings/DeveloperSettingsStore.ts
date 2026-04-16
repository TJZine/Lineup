import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    readStoredBooleanAndClean,
    readStoredBooleanMaybeAndClean,
    safeLocalStorageRemove,
    safeLocalStorageSet,
} from '../../utils/storage';

export class DeveloperSettingsStore {
    readDebugLoggingEnabledAndClean(fallback: boolean = false): boolean {
        return this._readBooleanKey(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, fallback);
    }

    hasDebugLoggingEnabledValue(): boolean {
        return this._readBooleanKeyMaybe(LINEUP_STORAGE_KEYS.DEBUG_LOGGING) !== null;
    }

    writeDebugLoggingEnabled(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, enabled ? '1' : '0');
    }

    clearDebugLoggingEnabled(): void {
        safeLocalStorageRemove(LINEUP_STORAGE_KEYS.DEBUG_LOGGING);
    }

    readSubtitleDebugLoggingEnabledAndClean(fallback: boolean = false): boolean {
        return this._readBooleanKey(LINEUP_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING, fallback);
    }

    writeSubtitleDebugLoggingEnabled(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING, enabled ? '1' : '0');
    }

    clearSubtitleDebugLoggingEnabled(): void {
        safeLocalStorageRemove(LINEUP_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING);
    }

    private _readBooleanKey(key: string, fallback: boolean): boolean {
        return readStoredBooleanAndClean(key, fallback);
    }

    private _readBooleanKeyMaybe(key: string): boolean | null {
        return readStoredBooleanMaybeAndClean(key);
    }
}
