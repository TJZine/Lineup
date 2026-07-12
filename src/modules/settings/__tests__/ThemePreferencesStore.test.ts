/**
 * @jest-environment jsdom
 */

import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { ThemePreferencesStore } from '../ThemePreferencesStore';

describe('ThemePreferencesStore', () => {
    let store: ThemePreferencesStore;

    beforeEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
        store = new ThemePreferencesStore();
    });

    it('reads trimmed themes and removes blank persisted values', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.THEME, '  swiss  ');
        expect(store.readThemeAndClean()).toBe('swiss');

        localStorage.setItem(LINEUP_STORAGE_KEYS.THEME, '   ');
        expect(store.readThemeAndClean()).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.THEME)).toBeNull();
    });

    it('writes trimmed values and removes empty themes', () => {
        store.writeTheme('  directv ');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.THEME)).toBe('directv');

        store.writeTheme('  ');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.THEME)).toBeNull();
    });

    it('reports blocked theme writes without throwing', () => {
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });

        expect(store.writeTheme('glass')).toEqual({ ok: false, reason: 'unavailable' });
    });
});
