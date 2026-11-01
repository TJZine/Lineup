/**
 * @jest-environment jsdom
 */

import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import {
    EPG_PAST_ITEMS_WINDOWS,
    EpgPreferencesStore,
} from '../EpgPreferencesStore';

describe('EpgPreferencesStore', () => {
    let store: EpgPreferencesStore;

    beforeEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
        store = new EpgPreferencesStore();
    });

    it('ignores a retired Overlay choice while preserving now watching preference', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE, 'overlay');
        expect(store.readNowWatchingEnabledAndClean(true)).toBe(true);

        expect(store.writeNowWatchingEnabled(false)).toEqual({ ok: true });

        expect(store.readGuideHoursAndMigrate()).toEqual({ ok: true, value: 2, source: 'default' });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED)).toBe('0');
        expect(store.readNowWatchingEnabledAndClean(true)).toBe(false);
    });

    it('reads/writes library filter with trim/remove normalization', () => {
        store.setLibraryFilterScope({ serverId: 'server-1', userId: 'user-1' });
        expect(store.writeSelectedLibraryId('  lib-1 ')).toEqual({ ok: true });
        expect(store.readSelectedLibraryIdAndClean()).toBe('lib-1');

        expect(store.writeSelectedLibraryId(' ')).toEqual({ ok: true });
        expect(store.readSelectedLibraryIdAndClean()).toBeNull();
        expect(localStorage.getItem(`${LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER}:server-1:user-1`)).toBeNull();
    });

    it('fails closed for library filter reads and writes without selected server and active user scope', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER, 'global-lib');

        expect(store.readSelectedLibraryIdAndClean()).toBeNull();
        expect(store.writeSelectedLibraryId('lib-1')).toEqual({
            ok: false,
            reason: 'unavailable',
        });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER)).toBe('global-lib');
    });

    it('scopes library filter by selected server and active user without affecting global display preferences', () => {
        store.setLibraryFilterScope({ serverId: 'server-a', userId: 'user-a' });
        expect(store.writeSelectedLibraryId('lib-a')).toEqual({ ok: true });
        expect(store.writeGuideHours(3)).toEqual({ ok: true });

        store.setLibraryFilterScope({ serverId: 'server-b', userId: 'user-a' });
        expect(store.readSelectedLibraryIdAndClean()).toBeNull();
        expect(store.writeSelectedLibraryId('lib-b')).toEqual({ ok: true });
        expect(store.readGuideHoursAndMigrate()).toEqual({ ok: true, value: 3, source: 'stored' });

        store.setLibraryFilterScope({ serverId: 'server-a', userId: 'user-b' });
        expect(store.readSelectedLibraryIdAndClean()).toBeNull();

        store.setLibraryFilterScope({ serverId: 'server-a', userId: 'user-a' });
        expect(store.readSelectedLibraryIdAndClean()).toBe('lib-a');
        expect(localStorage.getItem(`${LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER}:server-a:user-a`)).toBe('lib-a');
        expect(localStorage.getItem(`${LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER}:server-b:user-a`)).toBe('lib-b');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER)).toBeNull();
    });

    it('normalizes invalid legacy density only after durable replacement and cleans background', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY, 'weird');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '99');

        expect(store.readGuideHoursAndMigrate()).toEqual({ ok: true, value: 2, source: 'default' });
        expect(store.readInfoBackgroundModeAndClean(0)).toBe(0);

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE)).toBeNull();
    });

    it.each([
        ['detailed', 2],
        ['wide', 3],
    ] as const)('migrates legacy %s density to %i hours then removes it', (legacy, hours) => {
        const scopedLibraryKey = `${LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER}:server-1:user-1`;
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY, legacy);
        localStorage.setItem(scopedLibraryKey, 'library-1');
        localStorage.setItem(LINEUP_STORAGE_KEYS.CHANNELS_REAL, 'lineup-bytes');
        localStorage.setItem(LINEUP_STORAGE_KEYS.LAST_PROFILE_ID, 'profile-1');
        const setSpy = jest.spyOn(Storage.prototype, 'setItem');

        expect(store.readGuideHoursAndMigrate()).toEqual({
            ok: true,
            value: hours,
            source: 'legacy',
        });
        expect(store.readGuideHoursAndMigrate()).toEqual({
            ok: true,
            value: hours,
            source: 'stored',
        });
        expect(setSpy).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_HOURS)).toBe(String(hours));
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY)).toBeNull();

        expect(store.completeGuideHoursMigrationAfterConsumerCutover()).toEqual({
            ok: true,
            value: hours,
            legacyRemoved: false,
        });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY)).toBeNull();
        expect(localStorage.getItem(scopedLibraryKey)).toBe('library-1');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.CHANNELS_REAL)).toBe('lineup-bytes');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.LAST_PROFILE_ID)).toBe('profile-1');
    });

    it('uses a typed two-hour default without persisting a value when no density exists', () => {
        expect(store.readGuideHoursAndMigrate()).toEqual({
            ok: true,
            value: 2,
            source: 'default',
        });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_HOURS)).toBeNull();
    });

    it('normalizes unsupported current and legacy hours using the current default policy', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_HOURS, '5');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY, 'future-wide');

        expect(store.readGuideHoursAndMigrate()).toEqual({
            ok: true,
            value: 2,
            source: 'default',
        });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_HOURS)).toBe('2');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY)).toBeNull();

        expect(store.completeGuideHoursMigrationAfterConsumerCutover()).toEqual({
            ok: true,
            value: 2,
            legacyRemoved: false,
        });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_HOURS)).toBe('2');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY)).toBeNull();
    });

    it('keeps a valid wide selection when replacement write fails and retries on restart', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY, 'wide');
        const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('quota', 'QuotaExceededError');
        });

        expect(store.readGuideHoursAndMigrate()).toEqual({
            ok: false,
            reason: 'quota-exceeded',
            stage: 'replacement-write',
            effectiveValue: 3,
        });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY)).toBe('wide');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_HOURS)).toBeNull();

        setSpy.mockRestore();
        const restartedStore = new EpgPreferencesStore();
        expect(restartedStore.readGuideHoursAndMigrate()).toEqual({
            ok: true,
            value: 3,
            source: 'legacy',
        });
        expect(restartedStore.completeGuideHoursMigrationAfterConsumerCutover()).toEqual({
            ok: true,
            value: 3,
            legacyRemoved: false,
        });
    });

    it('reports and retries legacy cleanup failure only after the replacement value is durable', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY, 'wide');
        const removeSpy = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw new DOMException('blocked', 'SecurityError');
        });

        expect(store.readGuideHoursAndMigrate()).toEqual({
            ok: false,
            reason: 'unavailable',
            stage: 'legacy-cleanup',
            effectiveValue: 3,
        });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_HOURS)).toBe('3');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY)).toBe('wide');

        removeSpy.mockRestore();
        expect(store.completeGuideHoursMigrationAfterConsumerCutover()).toEqual({
            ok: true,
            value: 3,
            legacyRemoved: true,
        });
    });

    it('distinguishes a blocked migration read and leaves both keys untouched', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY, 'wide');
        const getSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('blocked', 'SecurityError');
        });
        const setSpy = jest.spyOn(Storage.prototype, 'setItem');
        const removeSpy = jest.spyOn(Storage.prototype, 'removeItem');

        expect(store.readGuideHoursAndMigrate()).toEqual({
            ok: false,
            reason: 'unavailable',
            stage: 'read',
            effectiveValue: 2,
        });
        expect(setSpy).not.toHaveBeenCalled();
        expect(removeSpy).not.toHaveBeenCalled();
        getSpy.mockRestore();
    });

    it('bounds new Guide hours and keeps source-label preference false by default', () => {
        expect(store.readSourceLabelsEnabledAndClean()).toBe(false);
        expect(store.writeSourceLabelsEnabled(true)).toEqual({ ok: true });
        expect(store.readSourceLabelsEnabledAndClean()).toBe(true);

        expect(store.writeGuideHours(4)).toEqual({ ok: true });
        expect(store.readGuideHoursAndMigrate()).toEqual({ ok: true, value: 4, source: 'stored' });
        expect(store.writeGuideHours(5 as 2 | 3 | 4)).toEqual({ ok: false, reason: 'invalid-value' });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_HOURS)).toBe('4');
    });

    it('uses the typed default without persisting retired layout or density choices', () => {
        expect(store.readGuideHoursAndMigrate()).toEqual({ ok: true, value: 2, source: 'default' });

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBeNull();
    });

    it('removes blank stored library filters when reading', () => {
        store.setLibraryFilterScope({ serverId: 'server-1', userId: 'user-1' });
        localStorage.setItem(`${LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER}:server-1:user-1`, '');

        expect(store.readSelectedLibraryIdAndClean()).toBeNull();
        expect(localStorage.getItem(`${LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER}:server-1:user-1`)).toBeNull();
    });

    it('returns normalized schedule-range snapshots from storage-backed preferences', () => {
        store.setLibraryFilterScope({ serverId: 'server-1', userId: 'user-1' });
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW, 'bad-value');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, '0');
        localStorage.setItem(`${LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER}:server-1:user-1`, '   ');

        expect(store.readScheduleRangeSnapshotAndClean()).toEqual({
            pastItemsWindowSetting: 'auto',
            tabsEnabled: false,
            selectedLibraryId: null,
        });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW)).toBeNull();
        expect(localStorage.getItem(`${LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER}:server-1:user-1`)).toBeNull();
    });

    it('reads a schedule-range snapshot without cleaning or writing storage', () => {
        store.setLibraryFilterScope({ serverId: 'server-1', userId: 'user-1' });
        const selectedLibraryKey = `${LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER}:server-1:user-1`;
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW, 'bad-value');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, 'unexpected');
        localStorage.setItem(selectedLibraryKey, '  library-1  ');

        const setSpy = jest.spyOn(Storage.prototype, 'setItem');
        const removeSpy = jest.spyOn(Storage.prototype, 'removeItem');
        expect(store.readScheduleRangeSnapshot()).toEqual({
            pastItemsWindowSetting: 'auto',
            tabsEnabled: true,
            selectedLibraryId: 'library-1',
        });
        expect(setSpy).not.toHaveBeenCalled();
        expect(removeSpy).not.toHaveBeenCalled();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW)).toBe('bad-value');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED)).toBe('unexpected');
        expect(localStorage.getItem(selectedLibraryKey)).toBe('  library-1  ');
    });

    it('round-trips the canonical past-items storage values', () => {
        EPG_PAST_ITEMS_WINDOWS.forEach((windowValue) => {
            expect(store.writePastItemsWindow(windowValue)).toEqual({ ok: true });
            expect(store.readPastItemsWindowAndClean()).toBe(windowValue);
        });
    });

    it('returns unavailable when storage writes are blocked', () => {
        store.setLibraryFilterScope({ serverId: 'server-1', userId: 'user-1' });
        const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('blocked', 'SecurityError');
        });
        try {
            expect(store.writeGuideHours(3)).toEqual({
                ok: false,
                reason: 'unavailable',
            });
            expect(store.writeSelectedLibraryId('lib-2')).toEqual({
                ok: false,
                reason: 'unavailable',
            });
        } finally {
            setSpy.mockRestore();
        }
    });

    it('returns quota-exceeded when setItem throws QuotaExceededError', () => {
        const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('quota', 'QuotaExceededError');
        });
        try {
            expect(store.writeInfoBackgroundMode(1)).toEqual({
                ok: false,
                reason: 'quota-exceeded',
            });
        } finally {
            setSpy.mockRestore();
        }
    });
});
