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
        expect(store.writeSelectedLibraryId('  lib-1 ')).toEqual({ ok: true });
        expect(store.readSelectedLibraryIdAndClean()).toBe('lib-1');

        expect(store.writeSelectedLibraryId(' ')).toEqual({ ok: true });
        expect(store.readSelectedLibraryIdAndClean()).toBeNull();
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
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER, '');

        expect(store.readSelectedLibraryIdAndClean()).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER)).toBeNull();
    });

    it('returns normalized schedule-range snapshots from storage-backed preferences', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW, 'bad-value');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, '0');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER, '   ');

        expect(store.readScheduleRangeSnapshotAndClean()).toEqual({
            pastItemsWindowSetting: 'auto',
            tabsEnabled: false,
            selectedLibraryId: null,
        });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER)).toBeNull();
    });

    it('round-trips the canonical past-items storage values', () => {
        EPG_PAST_ITEMS_WINDOWS.forEach((windowValue) => {
            expect(store.writePastItemsWindow(windowValue)).toEqual({ ok: true });
            expect(store.readPastItemsWindowAndClean()).toBe(windowValue);
        });
    });

    it('returns unavailable when storage writes are blocked', () => {
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
