/**
 * @jest-environment jsdom
 */

import { ThemeManager } from '../ThemeManager';
import { LINEUP_STORAGE_KEYS } from '../../../../config/storageKeys';

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

        expect(manager.getTheme()).toBe('ember-steel');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.THEME)).toBe('ember-steel');
        expect(document.body.classList.contains('theme-directv')).toBe(false);
        expect(document.body.classList.contains('theme-ember-steel')).toBe(true);
    });

    it('applies saved directv theme and removes other theme classes', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.THEME, 'directv');

        ThemeManager.getInstance();

        expect(document.body.classList.contains('theme-directv')).toBe(true);
        expect(document.body.classList.contains('theme-slate-pine')).toBe(false);
        expect(document.body.classList.contains('theme-swiss')).toBe(false);
    });

    it('removes previous theme class when switching themes', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.THEME, 'slate-pine');

        const manager = ThemeManager.getInstance();
        expect(document.body.classList.contains('theme-slate-pine')).toBe(true);

        manager.setTheme('swiss');
        expect(document.body.classList.contains('theme-swiss')).toBe(true);
        expect(document.body.classList.contains('theme-slate-pine')).toBe(false);

        manager.setTheme('directv');
        expect(document.body.classList.contains('theme-directv')).toBe(true);
        expect(document.body.classList.contains('theme-swiss')).toBe(false);
    });

    it('applies glass theme and removes previous theme class', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.THEME, 'directv');

        const manager = ThemeManager.getInstance();
        expect(document.body.classList.contains('theme-directv')).toBe(true);

        manager.setTheme('glass');
        expect(document.body.classList.contains('theme-glass')).toBe(true);
        expect(document.body.classList.contains('theme-directv')).toBe(false);
    });

    it('applies ember-steel theme and removes previous theme class', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.THEME, 'glass');

        const manager = ThemeManager.getInstance();
        expect(document.body.classList.contains('theme-glass')).toBe(true);

        manager.setTheme('ember-steel');
        expect(document.body.classList.contains('theme-ember-steel')).toBe(true);
        expect(document.body.classList.contains('theme-glass')).toBe(false);
    });
});
