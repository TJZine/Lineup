import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    readStoredBooleanAndClean,
    readStoredBooleanMaybeAndClean,
    safeLocalStorageRemove,
    safeLocalStorageSet,
} from '../../utils/storage';

export class DeveloperSettingsStore {
    readDebugLoggingEnabledAndClean(fallback: boolean = false): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, fallback);
    }

    hasDebugLoggingEnabledValue(): boolean {
        return readStoredBooleanMaybeAndClean(LINEUP_STORAGE_KEYS.DEBUG_LOGGING) !== null;
    }

    writeDebugLoggingEnabled(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.DEBUG_LOGGING, enabled ? '1' : '0');
    }

    clearDebugLoggingEnabled(): void {
        safeLocalStorageRemove(LINEUP_STORAGE_KEYS.DEBUG_LOGGING);
    }

    readSubtitleDebugLoggingEnabledAndClean(fallback: boolean = false): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING, fallback);
    }

    writeSubtitleDebugLoggingEnabled(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING, enabled ? '1' : '0');
    }

    clearSubtitleDebugLoggingEnabled(): void {
        safeLocalStorageRemove(LINEUP_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING);
    }
}
