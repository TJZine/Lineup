import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    type SafeLocalStorageMutationResult,
    parseStoredEpgInfoBackgroundMode,
    readStoredBoolean,
    readStoredBooleanAndClean,
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSetWithResult,
    readTrimmedStringAndClean,
    writeTrimmedStringOrRemoveWithResult,
} from '../../utils/storage';

export type EpgLayoutMode = 'overlay' | 'classic';
export type EpgGuideDensity = 'detailed' | 'wide';
export const EPG_PAST_ITEMS_WINDOWS = ['auto', '0', '15', '30'] as const;
export type EpgPastItemsWindow = (typeof EPG_PAST_ITEMS_WINDOWS)[number];
export type EpgScheduleRangeSnapshot = {
    pastItemsWindowSetting: EpgPastItemsWindow;
    tabsEnabled: boolean;
    selectedLibraryId: string | null;
};

export interface EpgLibraryFilterScope {
    serverId: string;
    userId: string;
}

export class EpgPreferencesStore {
    private _libraryFilterScope: EpgLibraryFilterScope | null = null;

    setLibraryFilterScope(scope: EpgLibraryFilterScope | null): void {
        const serverId = scope?.serverId.trim() ?? '';
        const userId = scope?.userId.trim() ?? '';
        this._libraryFilterScope = serverId && userId ? { serverId, userId } : null;
    }

    readLibraryTabsEnabledAndClean(fallback: boolean = true): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, fallback);
    }

    writeLibraryTabsEnabled(enabled: boolean): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, enabled ? '1' : '0');
    }

    readAggressivePreloadEnabledAndClean(fallback: boolean = false): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.EPG_AGGRESSIVE_PRELOAD_ENABLED, fallback);
    }

    writeAggressivePreloadEnabled(enabled: boolean): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.EPG_AGGRESSIVE_PRELOAD_ENABLED, enabled ? '1' : '0');
    }

    readSelectedLibraryIdAndClean(): string | null {
        const key = this._getSelectedLibraryFilterKey();
        return key ? readTrimmedStringAndClean(key) : null;
    }

    writeSelectedLibraryId(libraryId: string | null): SafeLocalStorageMutationResult {
        const key = this._getSelectedLibraryFilterKey();
        if (!key) {
            return { ok: false, reason: 'unavailable' };
        }
        return writeTrimmedStringOrRemoveWithResult(key, libraryId);
    }

    readGuideDensityAndClean(fallback: EpgGuideDensity = 'detailed'): EpgGuideDensity {
        const raw = safeLocalStorageGet(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY);
        if (raw === 'wide' || raw === 'detailed') {
            return raw;
        }
        if (raw !== null) {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY);
        }
        return fallback;
    }

    writeGuideDensity(density: EpgGuideDensity): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY, density);
    }

    readLayoutModeAndClean(fallback: EpgLayoutMode = 'classic'): EpgLayoutMode {
        const raw = safeLocalStorageGet(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE);
        if (raw === 'overlay' || raw === 'classic') {
            return raw;
        }
        if (raw !== null) {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE);
        }
        return fallback;
    }

    writeLayoutMode(mode: EpgLayoutMode): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE, mode);
    }

    readNowWatchingEnabledAndClean(fallback: boolean = true): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED, fallback);
    }

    writeNowWatchingEnabled(enabled: boolean): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED, enabled ? '1' : '0');
    }

    readPastItemsWindowAndClean(fallback: EpgPastItemsWindow = 'auto'): EpgPastItemsWindow {
        const raw = safeLocalStorageGet(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW);
        if (raw && EPG_PAST_ITEMS_WINDOWS.includes(raw as EpgPastItemsWindow)) {
            return raw as EpgPastItemsWindow;
        }
        if (raw !== null) {
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW);
        }
        return fallback;
    }

    writePastItemsWindow(window: EpgPastItemsWindow): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW, window);
    }

    readScheduleRangeSnapshotAndClean(): EpgScheduleRangeSnapshot {
        return {
            pastItemsWindowSetting: this.readPastItemsWindowAndClean('auto'),
            tabsEnabled: this.readLibraryTabsEnabledAndClean(true),
            selectedLibraryId: this.readSelectedLibraryIdAndClean(),
        };
    }

    /**
     * Read the values used to compute a schedule range without mutating storage.
     * Startup warmup is best-effort and must not turn a read into persistence
     * cleanup while the foreground guide may be opening.
     */
    readScheduleRangeSnapshot(): EpgScheduleRangeSnapshot {
        const rawPastItemsWindow = safeLocalStorageGet(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW);
        const pastItemsWindowSetting = rawPastItemsWindow && EPG_PAST_ITEMS_WINDOWS.includes(
            rawPastItemsWindow as EpgPastItemsWindow
        )
            ? rawPastItemsWindow as EpgPastItemsWindow
            : 'auto';
        const selectedLibraryKey = this._getSelectedLibraryFilterKey();
        const rawSelectedLibraryId = selectedLibraryKey
            ? safeLocalStorageGet(selectedLibraryKey)
            : null;

        return {
            pastItemsWindowSetting,
            tabsEnabled: readStoredBoolean(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, true),
            selectedLibraryId: rawSelectedLibraryId?.trim() || null,
        };
    }

    readInfoBackgroundModeAndClean(fallback: 0 | 1 | 2 = 0): 0 | 1 | 2 {
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

    writeInfoBackgroundMode(mode: 0 | 1 | 2): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, String(mode));
    }

    private _getSelectedLibraryFilterKey(): string | null {
        if (!this._libraryFilterScope) {
            return null;
        }
        return `${LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER}:${this._libraryFilterScope.serverId}:${this._libraryFilterScope.userId}`;
    }
}
