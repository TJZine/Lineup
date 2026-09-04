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

    it('reads/writes layout mode and now watching banner defaults', () => {
        expect(store.readLayoutModeAndClean()).toBe('classic');
        expect(store.readNowWatchingEnabledAndClean(true)).toBe(true);

        expect(store.writeLayoutMode('overlay')).toEqual({ ok: true });
        expect(store.writeNowWatchingEnabled(false)).toEqual({ ok: true });

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('overlay');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED)).toBe('0');
        expect(store.readLayoutModeAndClean()).toBe('overlay');
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
        expect(store.writeGuideDensity('wide')).toEqual({ ok: true });

        store.setLibraryFilterScope({ serverId: 'server-b', userId: 'user-a' });
        expect(store.readSelectedLibraryIdAndClean()).toBeNull();
        expect(store.writeSelectedLibraryId('lib-b')).toEqual({ ok: true });
        expect(store.readGuideDensityAndClean()).toBe('wide');

        store.setLibraryFilterScope({ serverId: 'server-a', userId: 'user-b' });
        expect(store.readSelectedLibraryIdAndClean()).toBeNull();

        store.setLibraryFilterScope({ serverId: 'server-a', userId: 'user-a' });
        expect(store.readSelectedLibraryIdAndClean()).toBe('lib-a');
        expect(localStorage.getItem(`${LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER}:server-a:user-a`)).toBe('lib-a');
        expect(localStorage.getItem(`${LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER}:server-b:user-a`)).toBe('lib-b');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER)).toBeNull();
    });

    it('normalizes invalid density/background keys by removing and falling back', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY, 'weird');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '99');

        expect(store.readGuideDensityAndClean()).toBe('detailed');
        expect(store.readInfoBackgroundModeAndClean(0)).toBe(0);

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE)).toBeNull();
    });

    it('returns caller fallbacks for missing layout and density values without persisting them', () => {
        expect(store.readGuideDensityAndClean('wide')).toBe('wide');
        expect(store.readLayoutModeAndClean('overlay')).toBe('overlay');

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
            expect(store.writeGuideDensity('wide')).toEqual({
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
