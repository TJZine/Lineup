import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    readStoredBooleanAndClean,
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSet,
} from '../../utils/storage';
import {
    parseSubtitleMode,
    type SubtitleMode,
} from '../../shared/subtitle-mode';

export class SubtitlePreferencesStore {
    readSubtitleMode(fallback: SubtitleMode = 'full'): SubtitleMode {
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

    writeSubtitleMode(mode: SubtitleMode): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, mode);
    }

    readSubtitlePreferForced(fallback: boolean = false): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.SUBTITLE_PREFER_FORCED, fallback);
    }

    writeSubtitlePreferForced(enabled: boolean): void {
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.SUBTITLE_PREFER_FORCED, enabled ? '1' : '0');
    }

    readSubtitleLanguage(): string | null {
        const raw = safeLocalStorageGet(LINEUP_STORAGE_KEYS.SUBTITLE_LANGUAGE);
        if (raw === null) {
            return null;
        }
        const normalized = raw.trim().toLowerCase();
        if (!normalized) {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.SUBTITLE_LANGUAGE);
            return null;
        }
        return normalized;
    }

    writeSubtitleLanguage(languageCode: string | null): void {
        if (typeof languageCode !== 'string') {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.SUBTITLE_LANGUAGE);
            return;
        }
        const normalized = languageCode.trim().toLowerCase();
        if (!normalized) {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.SUBTITLE_LANGUAGE);
            return;
        }
        safeLocalStorageSet(LINEUP_STORAGE_KEYS.SUBTITLE_LANGUAGE, normalized);
    }
}
