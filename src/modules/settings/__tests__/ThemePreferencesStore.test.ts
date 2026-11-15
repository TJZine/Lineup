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

    it('reads trimmed themes while leaving normalization writes to the controller', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.THEME, '  swiss  ');
        expect(store.readTheme()).toEqual({ ok: true, value: 'swiss' });

        localStorage.setItem(LINEUP_STORAGE_KEYS.THEME, '   ');
        expect(store.readTheme()).toEqual({ ok: true, value: null });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.THEME)).toBe('   ');
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

        expect(store.writeTheme('directv')).toEqual({ ok: false, reason: 'unavailable' });
    });

    it('reports blocked reads separately from missing values', () => {
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });

        expect(store.readTheme()).toEqual({ ok: false, reason: 'unavailable' });
    });
});
