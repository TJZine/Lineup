import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    readStoredBooleanAndClean,
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSetWithResult,
    safeLocalStorageRemoveWithResult,
    type SafeLocalStorageMutationResult,
} from '../../utils/storage';
import {
    parseSubtitleMode,
    type SubtitleMode,
} from '../../shared/subtitle-mode';
import { normalizeSubtitleLanguage } from '../../shared/subtitle-language';

export class SubtitlePreferencesStore {
    readSubtitleModeAndClean(fallback: SubtitleMode = 'full'): SubtitleMode {
        const raw = safeLocalStorageGet(LINEUP_STORAGE_KEYS.SUBTITLE_MODE);
        const parsed = parseSubtitleMode(raw);
        if (parsed) {
            return parsed;
        }
        if (raw !== null) {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.SUBTITLE_MODE);
        }
        return fallback;
    }

    writeSubtitleMode(mode: SubtitleMode): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, mode);
    }

    readSubtitlePreferForcedAndClean(fallback: boolean = false): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.SUBTITLE_PREFER_FORCED, fallback);
    }

    writeSubtitlePreferForced(enabled: boolean): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.SUBTITLE_PREFER_FORCED, enabled ? '1' : '0');
    }

    readSubtitleLanguageAndClean(): string | null {
        const raw = safeLocalStorageGet(LINEUP_STORAGE_KEYS.SUBTITLE_LANGUAGE);
        if (raw === null) {
            return null;
        }
        const normalized = normalizeSubtitleLanguage(raw);
        if (!normalized) {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.SUBTITLE_LANGUAGE);
            return null;
        }
        return normalized;
    }

    writeSubtitleLanguage(languageCode: string | null): SafeLocalStorageMutationResult {
        if (typeof languageCode !== 'string') {
            return safeLocalStorageRemoveWithResult(LINEUP_STORAGE_KEYS.SUBTITLE_LANGUAGE);
        }
        const normalized = normalizeSubtitleLanguage(languageCode);
        if (!normalized) {
            return safeLocalStorageRemoveWithResult(LINEUP_STORAGE_KEYS.SUBTITLE_LANGUAGE);
        }
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.SUBTITLE_LANGUAGE, normalized);
    }
}
