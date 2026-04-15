/**
 * @jest-environment jsdom
 */

import { AppThemeController } from '../AppThemeController';
import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';

describe('AppThemeController', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.className = '';
    });

    afterEach(() => {
        document.body.className = '';
    });

    it('normalizes missing persisted theme to default and persists once', () => {
        const controller = new AppThemeController();
        const writeSpy = jest.spyOn(Storage.prototype, 'setItem');

        expect(controller.initialize()).toBe('ember-steel');
        expect(writeSpy).toHaveBeenCalledWith(LINEUP_STORAGE_KEYS.THEME, 'ember-steel');
        expect(document.body.classList.contains('theme-ember-steel')).toBe(true);
        writeSpy.mockRestore();
    });

    it('normalizes invalid persisted theme to default and persists once', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.THEME, 'invalid-theme');
        const controller = new AppThemeController();

        expect(controller.initialize()).toBe('ember-steel');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.THEME)).toBe('ember-steel');
        expect(document.body.classList.contains('theme-ember-steel')).toBe(true);
    });

    it('switches body class immediately when setTheme is called', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.THEME, 'directv');
        const controller = new AppThemeController();

        controller.initialize();
        expect(document.body.classList.contains('theme-directv')).toBe(true);

        controller.setTheme('glass');
        expect(controller.getTheme()).toBe('glass');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.THEME)).toBe('glass');
        expect(document.body.classList.contains('theme-glass')).toBe(true);
        expect(document.body.classList.contains('theme-directv')).toBe(false);
    });
});
