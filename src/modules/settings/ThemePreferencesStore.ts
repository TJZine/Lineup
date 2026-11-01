import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    safeLocalStorageGetWithResult,
    safeLocalStorageRemoveWithResult,
    safeLocalStorageSetWithResult,
    type SafeLocalStorageGetResult,
    type SafeLocalStorageMutationResult,
} from '../../utils/storage';

export class ThemePreferencesStore {
    readTheme(): SafeLocalStorageGetResult {
        const result = safeLocalStorageGetWithResult(LINEUP_STORAGE_KEYS.THEME);
        if (!result.ok) {
            return result;
        }

        const trimmed = result.value?.trim() ?? '';
        return { ok: true, value: trimmed.length > 0 ? trimmed : null };
    }

    writeTheme(theme: string): SafeLocalStorageMutationResult {
        const trimmed = theme.trim();
        if (!trimmed) {
            return safeLocalStorageRemoveWithResult(LINEUP_STORAGE_KEYS.THEME);
        }
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.THEME, trimmed);
    }
}
