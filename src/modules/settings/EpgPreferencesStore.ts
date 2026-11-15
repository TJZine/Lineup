import { LINEUP_STORAGE_KEYS } from '../../config/storageKeys';
import {
    type SafeLocalStorageMutationResult,
    parseStoredEpgInfoBackgroundMode,
    readStoredBoolean,
    readStoredBooleanAndClean,
    safeLocalStorageGet,
    safeLocalStorageGetWithResult,
    safeLocalStorageRemove,
    safeLocalStorageRemoveWithResult,
    safeLocalStorageSetWithResult,
    readTrimmedStringAndClean,
    writeTrimmedStringOrRemoveWithResult,
} from '../../utils/storage';

export const EPG_GUIDE_HOURS_OPTIONS = [2, 3, 4] as const;
export type EpgGuideHours = (typeof EPG_GUIDE_HOURS_OPTIONS)[number];
export const DEFAULT_EPG_GUIDE_HOURS: EpgGuideHours = 2;

export type EpgGuideHoursReadResult =
    | { ok: true; value: EpgGuideHours; source: 'stored' | 'legacy' | 'default' }
    | {
        ok: false;
        reason: 'quota-exceeded' | 'unavailable';
        stage: 'read' | 'replacement-write' | 'invalid-value-cleanup' | 'legacy-cleanup';
        effectiveValue: EpgGuideHours;
    };

export type EpgGuideHoursMigrationCleanupResult =
    | { ok: true; value: EpgGuideHours; legacyRemoved: boolean }
    | {
        ok: false;
        reason: 'quota-exceeded' | 'unavailable';
        stage: 'read' | 'replacement-write' | 'legacy-cleanup';
        effectiveValue: EpgGuideHours;
    };

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

    /**
     * Read the current 2/3/4-hour preference, translating the legacy
     * detailed/wide value into the new key. Retire the old key only after the
     * replacement is durable; a failed cleanup remains visible and retryable.
     */
    readGuideHoursAndMigrate(): EpgGuideHoursReadResult {
        const current = safeLocalStorageGetWithResult(LINEUP_STORAGE_KEYS.EPG_GUIDE_HOURS);
        if (!current.ok) {
            return {
                ok: false,
                reason: current.reason,
                stage: 'read',
                effectiveValue: DEFAULT_EPG_GUIDE_HOURS,
            };
        }

        const storedHours = this._parseGuideHours(current.value);
        if (storedHours !== null) {
            const cleanup = this.completeGuideHoursMigrationAfterConsumerCutover();
            if (!cleanup.ok) return cleanup;
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE);
            return { ok: true, value: storedHours, source: 'stored' };
        }

        if (current.value !== null) {
            const legacy = this._readLegacyGuideHours();
            const effectiveValue = legacy.ok
                ? legacy.value ?? DEFAULT_EPG_GUIDE_HOURS
                : DEFAULT_EPG_GUIDE_HOURS;
            const cleanup = safeLocalStorageRemoveWithResult(LINEUP_STORAGE_KEYS.EPG_GUIDE_HOURS);
            if (!cleanup.ok) {
                return {
                    ok: false,
                    reason: cleanup.reason,
                    stage: 'invalid-value-cleanup',
                    effectiveValue,
                };
            }
        }

        const legacy = this._readLegacyGuideHours();
        if (!legacy.ok) {
            return {
                ok: false,
                reason: legacy.reason,
                stage: 'read',
                effectiveValue: DEFAULT_EPG_GUIDE_HOURS,
            };
        }
        if (legacy.value === null) {
            const cleanup = this.completeGuideHoursMigrationAfterConsumerCutover();
            if (!cleanup.ok) return cleanup;
            safeLocalStorageRemove(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE);
            return { ok: true, value: DEFAULT_EPG_GUIDE_HOURS, source: 'default' };
        }

        const replacement = safeLocalStorageSetWithResult(
            LINEUP_STORAGE_KEYS.EPG_GUIDE_HOURS,
            String(legacy.value)
        );
        if (!replacement.ok) {
            return {
                ok: false,
                reason: replacement.reason,
                stage: 'replacement-write',
                effectiveValue: legacy.value,
            };
        }

        const cleanup = this.completeGuideHoursMigrationAfterConsumerCutover();
        if (!cleanup.ok) return cleanup;
        safeLocalStorageRemove(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE);
        return { ok: true, value: legacy.value, source: 'legacy' };
    }

    writeGuideHours(hours: EpgGuideHours): SafeLocalStorageMutationResult | { ok: false; reason: 'invalid-value' } {
        if (!this._isGuideHours(hours)) {
            return { ok: false, reason: 'invalid-value' };
        }
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.EPG_GUIDE_HOURS, String(hours));
    }

    /**
     * Call only after Settings and viewing code no longer reads or writes the
     * legacy density API. A failed read/write/removal is retryable and leaves
     * the old selection intact until its replacement is durable.
     */
    completeGuideHoursMigrationAfterConsumerCutover(): EpgGuideHoursMigrationCleanupResult {
        const current = safeLocalStorageGetWithResult(LINEUP_STORAGE_KEYS.EPG_GUIDE_HOURS);
        if (!current.ok) {
            return {
                ok: false,
                reason: current.reason,
                stage: 'read',
                effectiveValue: DEFAULT_EPG_GUIDE_HOURS,
            };
        }

        const legacy = safeLocalStorageGetWithResult(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY);
        if (!legacy.ok) {
            return {
                ok: false,
                reason: legacy.reason,
                stage: 'read',
                effectiveValue: this._parseGuideHours(current.value) ?? DEFAULT_EPG_GUIDE_HOURS,
            };
        }

        const storedHours = this._parseGuideHours(current.value);
        if (legacy.value === null) {
            return {
                ok: true,
                value: storedHours ?? DEFAULT_EPG_GUIDE_HOURS,
                legacyRemoved: false,
            };
        }

        const effectiveValue = storedHours ?? this._legacyDensityToHours(legacy.value) ?? DEFAULT_EPG_GUIDE_HOURS;
        if (storedHours === null) {
            const replacement = safeLocalStorageSetWithResult(
                LINEUP_STORAGE_KEYS.EPG_GUIDE_HOURS,
                String(effectiveValue)
            );
            if (!replacement.ok) {
                return {
                    ok: false,
                    reason: replacement.reason,
                    stage: 'replacement-write',
                    effectiveValue,
                };
            }
        }

        const cleanup = safeLocalStorageRemoveWithResult(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY);
        if (!cleanup.ok) {
            return {
                ok: false,
                reason: cleanup.reason,
                stage: 'legacy-cleanup',
                effectiveValue,
            };
        }

        return { ok: true, value: effectiveValue, legacyRemoved: true };
    }

    readSourceLabelsEnabledAndClean(fallback: boolean = false): boolean {
        return readStoredBooleanAndClean(LINEUP_STORAGE_KEYS.EPG_SOURCE_LABELS_ENABLED, fallback);
    }

    writeSourceLabelsEnabled(enabled: boolean): SafeLocalStorageMutationResult {
        return safeLocalStorageSetWithResult(LINEUP_STORAGE_KEYS.EPG_SOURCE_LABELS_ENABLED, enabled ? '1' : '0');
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

    private _readLegacyGuideHours():
        | { ok: true; value: EpgGuideHours | null }
        | { ok: false; reason: 'unavailable' } {
        const result = safeLocalStorageGetWithResult(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY);
        if (!result.ok) return result;
        return { ok: true, value: this._legacyDensityToHours(result.value) };
    }

    private _legacyDensityToHours(value: string | null): EpgGuideHours | null {
        if (value === 'detailed') return 2;
        if (value === 'wide') return 3;
        return null;
    }

    private _parseGuideHours(value: string | null): EpgGuideHours | null {
        return EPG_GUIDE_HOURS_OPTIONS.find((hours) => String(hours) === value) ?? null;
    }

    private _isGuideHours(value: number): value is EpgGuideHours {
        return EPG_GUIDE_HOURS_OPTIONS.some((hours) => hours === value);
    }
}
