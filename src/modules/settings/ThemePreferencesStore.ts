import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSet,
} from '../../utils/storage';

export class ThemePreferencesStore {
    readTheme(): string | null {
        const raw = safeLocalStorageGet(LINEUP_STORAGE_KEYS.THEME);
        if (typeof raw !== 'string') {
            return null;
        }
        const trimmed = raw.trim();
        if (!trimmed) {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.THEME);
            return null;
        }
        return trimmed;
    }

    writeTheme(theme: string): void {
        const trimmed = theme.trim();
        if (!trimmed) {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.THEME);
            return;
        }
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.THEME, trimmed);
    }
}
