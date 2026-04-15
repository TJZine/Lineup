import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    readStoredBooleanAndClean,
    safeLocalStorageSet,
    readTrimmedStringAndClean,
    writeTrimmedStringOrRemove,
} from '../../utils/storage';

export class ProfileSessionStore {
    readShowProfilePickerOnStartupAndClean(fallback: boolean = false): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.SHOW_PROFILE_PICKER_ON_STARTUP, fallback);
    }

    writeShowProfilePickerOnStartup(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.SHOW_PROFILE_PICKER_ON_STARTUP, enabled ? '1' : '0');
    }

    readKeepPlayingInSettingsAndClean(fallback: boolean = false): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.KEEP_PLAYING_IN_SETTINGS, fallback);
    }

    writeKeepPlayingInSettings(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.KEEP_PLAYING_IN_SETTINGS, enabled ? '1' : '0');
    }

    readLastProfileIdAndClean(): string | null {
        return readTrimmedStringAndClean(LINEUP_STORAGE_KEYS.LAST_PROFILE_ID);
    }

    writeLastProfileId(profileId: string | null): void {
        writeTrimmedStringOrRemove(LINEUP_STORAGE_KEYS.LAST_PROFILE_ID, profileId);
    }
}
