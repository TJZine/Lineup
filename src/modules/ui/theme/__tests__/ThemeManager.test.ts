/**
 * @jest-environment jsdom
 */

import { ThemeManager } from '../ThemeManager';
import { RETUNE_STORAGE_KEYS } from '../../../../config/storageKeys';

function resetThemeManagerSingleton(): void {
    ThemeManager.__resetForTests();
}

describe('ThemeManager', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.className = '';
        resetThemeManagerSingleton();
    });

    afterEach(() => {
        document.body.className = '';
        resetThemeManagerSingleton();
    });

    it('applies saved directv theme and removes other theme classes', () => {
        localStorage.setItem(RETUNE_STORAGE_KEYS.THEME, 'directv');

        ThemeManager.getInstance();

        expect(document.body.classList.contains('theme-directv')).toBe(true);
        expect(document.body.classList.contains('theme-broadcast')).toBe(false);
        expect(document.body.classList.contains('theme-swiss')).toBe(false);
    });

    it('removes previous theme class when switching themes', () => {
        localStorage.setItem(RETUNE_STORAGE_KEYS.THEME, 'broadcast');

        const manager = ThemeManager.getInstance();
        expect(document.body.classList.contains('theme-broadcast')).toBe(true);

        manager.setTheme('swiss');
        expect(document.body.classList.contains('theme-swiss')).toBe(true);
        expect(document.body.classList.contains('theme-broadcast')).toBe(false);

        manager.setTheme('directv');
        expect(document.body.classList.contains('theme-directv')).toBe(true);
        expect(document.body.classList.contains('theme-swiss')).toBe(false);
    });
});
