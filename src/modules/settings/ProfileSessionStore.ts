import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    readStoredBooleanAndClean,
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSet,
} from '../../utils/storage';

export class ProfileSessionStore {
    readShowProfilePickerOnStartup(fallback: boolean = false): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.SHOW_PROFILE_PICKER_ON_STARTUP, fallback);
    }

    writeShowProfilePickerOnStartup(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.SHOW_PROFILE_PICKER_ON_STARTUP, enabled ? '1' : '0');
    }

    readKeepPlayingInSettings(fallback: boolean = false): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.KEEP_PLAYING_IN_SETTINGS, fallback);
    }

    writeKeepPlayingInSettings(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.KEEP_PLAYING_IN_SETTINGS, enabled ? '1' : '0');
    }

    readLastProfileId(): string | null {
        const raw = safeLocalStorageGet(LINEUP_STORAGE_KEYS.LAST_PROFILE_ID);
        if (typeof raw !== 'string') {
            return null;
        }
        const trimmed = raw.trim();
        if (!trimmed) {
            return null;
        }
        return trimmed;
    }

    writeLastProfileId(profileId: string | null): void {
        if (typeof profileId !== 'string') {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.LAST_PROFILE_ID);
            return;
        }

        const trimmed = profileId.trim();
        if (!trimmed) {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.LAST_PROFILE_ID);
            return;
        }

        safeLocalStorageSet(LINEUP_STORAGE_KEYS.LAST_PROFILE_ID, trimmed);
    }
}
