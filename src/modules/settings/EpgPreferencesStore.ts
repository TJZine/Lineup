import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    type SafeLocalStorageWriteResult,
    parseStoredEpgInfoBackgroundMode,
    readStoredBooleanAndClean,
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSetWithResult,
    readTrimmedStringAndClean,
    writeTrimmedStringOrRemoveWithResult,
} from '../../utils/storage';

export type EpgLayoutMode = 'overlay' | 'classic';
export type EpgGuideDensity = 'detailed' | 'wide';
export type EpgPastItemsWindow = 'auto' | '0' | '15' | '30';
export type EpgScheduleRangeSnapshot = {
    pastItemsWindowSetting: EpgPastItemsWindow;
    tabsEnabled: boolean;
    selectedLibraryId: string | null;
};

const EPG_PAST_ITEMS_WINDOWS: readonly EpgPastItemsWindow[] = ['auto', '0', '15', '30'];

export class EpgPreferencesStore {
    readLibraryTabsEnabled(fallback: boolean = true): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, fallback);
    }

    writeLibraryTabsEnabled(enabled: boolean): SafeLocalStorageWriteResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, enabled ? '1' : '0');
    }

    readAggressivePreloadEnabled(fallback: boolean = false): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.EPG_AGGRESSIVE_PRELOAD_ENABLED, fallback);
    }

    writeAggressivePreloadEnabled(enabled: boolean): SafeLocalStorageWriteResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.EPG_AGGRESSIVE_PRELOAD_ENABLED, enabled ? '1' : '0');
    }

    readSelectedLibraryId(): string | null {
        return readTrimmedStringAndClean(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER);
    }

    writeSelectedLibraryId(libraryId: string | null): SafeLocalStorageWriteResult {
        return writeTrimmedStringOrRemoveWithResult(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER, libraryId);
    }

    readGuideDensity(fallback: EpgGuideDensity = 'detailed'): EpgGuideDensity {
        const raw = safeLocalStorageGet(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY);
        if (raw === 'wide' || raw === 'detailed') {
            return raw;
        }
        if (raw !== null) {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY);
        }
        return fallback;
    }

    writeGuideDensity(density: EpgGuideDensity): SafeLocalStorageWriteResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY, density);
    }

    readLayoutMode(fallback: EpgLayoutMode = 'classic'): EpgLayoutMode {
        const raw = safeLocalStorageGet(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE);
        if (raw === 'overlay' || raw === 'classic') {
            return raw;
        }
        if (raw !== null) {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE);
        }
        return fallback;
    }

    writeLayoutMode(mode: EpgLayoutMode): SafeLocalStorageWriteResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE, mode);
    }

    readNowWatchingEnabled(fallback: boolean = true): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED, fallback);
    }

    writeNowWatchingEnabled(enabled: boolean): SafeLocalStorageWriteResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED, enabled ? '1' : '0');
    }

    readGuideCategoryColorsEnabled(fallback: boolean = true): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.GUIDE_CATEGORY_COLORS, fallback);
    }

    writeGuideCategoryColorsEnabled(enabled: boolean): SafeLocalStorageWriteResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.GUIDE_CATEGORY_COLORS, enabled ? '1' : '0');
    }

    readPastItemsWindow(fallback: EpgPastItemsWindow = 'auto'): EpgPastItemsWindow {
        const raw = safeLocalStorageGet(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW);
        if (raw && EPG_PAST_ITEMS_WINDOWS.includes(raw as EpgPastItemsWindow)) {
            return raw as EpgPastItemsWindow;
        }
        if (raw !== null) {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW);
        }
        return fallback;
    }

    writePastItemsWindow(window: EpgPastItemsWindow): SafeLocalStorageWriteResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW, window);
    }

    readScheduleRangeSnapshot(): EpgScheduleRangeSnapshot {
        return {
            pastItemsWindowSetting: this.readPastItemsWindow('auto'),
            tabsEnabled: this.readLibraryTabsEnabled(true),
            selectedLibraryId: this.readSelectedLibraryId(),
        };
    }

    readInfoBackgroundMode(fallback: 0 | 1 | 2 = 0): 0 | 1 | 2 {
        const raw = safeLocalStorageGet(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE);
        const parsed = parseStoredEpgInfoBackgroundMode(raw);
        if (parsed !== null) {
            return parsed;
        }
        if (raw !== null) {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE);
        }
        return fallback;
    }

    writeInfoBackgroundMode(mode: 0 | 1 | 2): SafeLocalStorageWriteResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, String(mode));
    }
}
