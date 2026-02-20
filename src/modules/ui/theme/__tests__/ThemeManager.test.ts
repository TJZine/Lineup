/**
 * @jest-environment jsdom
 */

import { ThemeManager } from '../ThemeManager';
import { RETUNE_STORAGE_KEYS } from '../../../../config/storageKeys';

describe('ThemeManager', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.className = '';
        ThemeManager.__resetForTests();
    });

    afterEach(() => {
        document.body.className = '';
        ThemeManager.__resetForTests();
    });

    it('falls back to DEFAULT_THEME when none is saved and persists it', () => {
        document.body.classList.add('theme-directv');

        const manager = ThemeManager.getInstance();

        expect(manager.getTheme()).toBe('obsidian');
        expect(localStorage.getItem(RETUNE_STORAGE_KEYS.THEME)).toBe('obsidian');
        expect(document.body.classList.contains('theme-directv')).toBe(false);
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

    it('applies glass theme and removes previous theme class', () => {
        localStorage.setItem(RETUNE_STORAGE_KEYS.THEME, 'directv');

        const manager = ThemeManager.getInstance();
        expect(document.body.classList.contains('theme-directv')).toBe(true);

        manager.setTheme('glass');
        expect(document.body.classList.contains('theme-glass')).toBe(true);
        expect(document.body.classList.contains('theme-directv')).toBe(false);
    });
});
