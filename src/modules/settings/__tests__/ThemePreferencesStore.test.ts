/**
 * @jest-environment jsdom
 */

import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { ThemePreferencesStore } from '../ThemePreferencesStore';

describe('ThemePreferencesStore', () => {
    let store: ThemePreferencesStore;

    beforeEach(() => {
        localStorage.clear();
        store = new ThemePreferencesStore();
    });

    it('reads trimmed themes and removes blank persisted values', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.THEME, '  swiss  ');
        expect(store.readTheme()).toBe('swiss');

        localStorage.setItem(LINEUP_STORAGE_KEYS.THEME, '   ');
        expect(store.readTheme()).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.THEME)).toBeNull();
    });

    it('writes trimmed values and removes empty themes', () => {
        store.writeTheme('  directv ');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.THEME)).toBe('directv');

        store.writeTheme('  ');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.THEME)).toBeNull();
    });
});
