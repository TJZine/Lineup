import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSetWithResult,
    safeLocalStorageRemoveWithResult,
    type SafeLocalStorageMutationResult,
} from '../../utils/storage';

export class ThemePreferencesStore {
    readThemeAndClean(): string | null {
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

    writeTheme(theme: string): SafeLocalStorageMutationResult {
        const trimmed = theme.trim();
        if (!trimmed) {
            return safeLocalStorageRemoveWithResult(LINEUP_STORAGE_KEYS.THEME);
        }
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.THEME, trimmed);
    }
}
