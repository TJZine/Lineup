/**
 * @jest-environment jsdom
 */

import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { EpgPreferencesStore } from '../EpgPreferencesStore';

describe('EpgPreferencesStore', () => {
    let store: EpgPreferencesStore;

    beforeEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
        store = new EpgPreferencesStore();
    });

    it('reads/writes layout mode and now watching banner defaults', () => {
        expect(store.readLayoutMode()).toBe('classic');
        expect(store.readNowWatchingEnabled(true)).toBe(true);

        store.writeLayoutMode('overlay');
        store.writeNowWatchingEnabled(false);

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBe('overlay');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED)).toBe('0');
        expect(store.readLayoutMode()).toBe('overlay');
        expect(store.readNowWatchingEnabled(true)).toBe(false);
    });

    it('reads/writes library filter with trim/remove normalization', () => {
        store.writeSelectedLibraryId('  lib-1 ');
        expect(store.readSelectedLibraryId()).toBe('lib-1');

        store.writeSelectedLibraryId(' ');
        expect(store.readSelectedLibraryId()).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER)).toBeNull();
    });

    it('normalizes invalid density/background keys by removing and falling back', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY, 'weird');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '99');

        expect(store.readGuideDensity()).toBe('detailed');
        expect(store.readInfoBackgroundMode(0)).toBe(0);

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE)).toBeNull();
    });

    it('returns caller fallbacks for missing layout and density values without persisting them', () => {
        expect(store.readGuideDensity('wide')).toBe('wide');
        expect(store.readLayoutMode('overlay')).toBe('overlay');

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_LAYOUT_MODE)).toBeNull();
    });

    it('removes blank stored library filters when reading', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER, '');

        expect(store.readSelectedLibraryId()).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_LIBRARY_FILTER)).toBeNull();
    });
});
