/**
 * @jest-environment jsdom
 */

import { AppThemeController } from '../runtime/AppThemeController';
import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { ThemePreferencesStore } from '../../../modules/settings/ThemePreferencesStore';

describe('AppThemeController', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.className = '';
        document.body.removeAttribute('data-player-overlay-transparency');
    });

    afterEach(() => {
        document.body.className = '';
        document.body.removeAttribute('data-player-overlay-transparency');
    });

    it('normalizes a missing preference to Ember & Steel and persists it once', () => {
        const controller = new AppThemeController();
        const writeSpy = jest.spyOn(Storage.prototype, 'setItem');

        expect(controller.initialize()).toBe('ember-steel');
        expect(writeSpy).toHaveBeenCalledWith(LINEUP_STORAGE_KEYS.THEME, 'ember-steel');
        expect(controller.getPersistenceResult()).toEqual({
            ok: true,
            effectiveValue: 'ember-steel',
            migration: null,
        });
        expect(document.body.classList.contains('theme-ember-steel')).toBe(true);
        writeSpy.mockRestore();
    });

    it('normalizes malformed persisted themes to the safe default', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.THEME, 'not-a-theme');
        const controller = new AppThemeController();

        expect(controller.initialize()).toBe('ember-steel');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.THEME)).toBe('ember-steel');
        expect(document.body.classList.contains('theme-ember-steel')).toBe(true);
    });

    it.each(['ember-steel', 'slate-pine', 'swiss', 'directv'] as const)(
        'retains the valid stored theme %s without rewriting it',
        (theme) => {
            localStorage.setItem(LINEUP_STORAGE_KEYS.THEME, theme);
            const controller = new AppThemeController();
            const writeSpy = jest.spyOn(Storage.prototype, 'setItem');

            expect(controller.initialize()).toBe(theme);
            expect(controller.getPersistenceResult()).toEqual({
                ok: true,
                effectiveValue: theme,
                migration: null,
            });
            expect(writeSpy).not.toHaveBeenCalled();
            expect(document.body.classList.contains(`theme-${theme}`)).toBe(true);
            writeSpy.mockRestore();
        }
    );

    it('migrates the retired Glass preference to Ember & Steel', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.THEME, 'glass');
        const controller = new AppThemeController();
        const writeSpy = jest.spyOn(Storage.prototype, 'setItem');

        expect(controller.initialize()).toBe('ember-steel');
        expect(writeSpy).toHaveBeenCalledWith(LINEUP_STORAGE_KEYS.THEME, 'ember-steel');
        expect(controller.getPersistenceResult()).toEqual({
            ok: true,
            effectiveValue: 'ember-steel',
            migration: 'glass-to-ember-steel',
        });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.THEME)).toBe('ember-steel');
        expect(document.body.classList.contains('theme-ember-steel')).toBe(true);
        expect(document.body.classList.contains('theme-glass')).toBe(false);
        writeSpy.mockRestore();
    });

    it('keeps the safe runtime theme and exposes a retryable Glass migration failure', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.THEME, 'glass');
        const originalSetItem = Storage.prototype.setItem;
        let failMigrationWrite = true;
        const writeSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
            this: Storage,
            key,
            value
        ) {
            if (key === LINEUP_STORAGE_KEYS.THEME && value === 'ember-steel' && failMigrationWrite) {
                failMigrationWrite = false;
                throw new DOMException('Blocked', 'SecurityError');
            }
            originalSetItem.call(this, key, value);
        });
        const controller = new AppThemeController();

        expect(controller.initialize()).toBe('ember-steel');
        expect(controller.getPersistenceResult()).toEqual({
            ok: false,
            effectiveValue: 'ember-steel',
            migration: 'glass-to-ember-steel',
            reason: 'unavailable',
            retryable: true,
        });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.THEME)).toBe('glass');
        expect(controller.getTheme()).toBe('ember-steel');
        expect(document.body.classList.contains('theme-ember-steel')).toBe(true);

        expect(controller.retryPersistence()).toEqual({
            ok: true,
            effectiveValue: 'ember-steel',
            migration: 'glass-to-ember-steel',
        });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.THEME)).toBe('ember-steel');
        writeSpy.mockClear();

        expect(controller.retryPersistence()).toEqual({
            ok: true,
            effectiveValue: 'ember-steel',
            migration: 'glass-to-ember-steel',
        });
        expect(writeSpy).not.toHaveBeenCalled();
        writeSpy.mockRestore();
    });

    it('does not overwrite a stored choice when the preference read fails', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.THEME, 'directv');
        const preferences = new ThemePreferencesStore();
        const readTheme = jest
            .spyOn(preferences, 'readTheme')
            .mockReturnValueOnce({ ok: false, reason: 'unavailable' })
            .mockReturnValue({ ok: true, value: 'directv' });
        const writeTheme = jest.spyOn(preferences, 'writeTheme');
        const controller = new AppThemeController(preferences);

        expect(controller.initialize()).toBe('ember-steel');
        expect(controller.getPersistenceResult()).toEqual({
            ok: false,
            effectiveValue: 'ember-steel',
            migration: null,
            reason: 'unavailable',
            retryable: true,
        });
        expect(writeTheme).not.toHaveBeenCalled();
        expect(controller.retryPersistence()).toEqual({
            ok: true,
            effectiveValue: 'directv',
            migration: null,
        });
        expect(readTheme).toHaveBeenCalledTimes(2);
        expect(writeTheme).not.toHaveBeenCalled();
        expect(document.body.classList.contains('theme-directv')).toBe(true);
    });

    it('reports the effective theme after a requested theme write fails and retries that choice', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.THEME, 'directv');
        const preferences = new ThemePreferencesStore();
        const originalWriteTheme = preferences.writeTheme.bind(preferences);
        const writeTheme = jest.spyOn(preferences, 'writeTheme');
        let failNextWrite = true;
        writeTheme.mockImplementation((theme) => {
            if (theme === 'swiss' && failNextWrite) {
                failNextWrite = false;
                return { ok: false, reason: 'quota-exceeded' };
            }
            return originalWriteTheme(theme);
        });
        const controller = new AppThemeController(preferences);
        controller.initialize();

        expect(controller.setTheme('swiss')).toEqual({
            ok: false,
            effectiveValue: 'directv',
            migration: null,
            reason: 'quota-exceeded',
            retryable: true,
        });
        expect(controller.getTheme()).toBe('directv');
        expect(document.body.classList.contains('theme-directv')).toBe(true);
        expect(document.body.classList.contains('theme-swiss')).toBe(false);

        expect(controller.retryPersistence()).toEqual({
            ok: true,
            effectiveValue: 'swiss',
            migration: null,
        });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.THEME)).toBe('swiss');
        expect(document.body.classList.contains('theme-swiss')).toBe(true);
        expect(document.body.classList.contains('theme-directv')).toBe(false);
    });

    it('accepts the already-active theme without writing again', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.THEME, 'directv');
        const preferences = new ThemePreferencesStore();
        const controller = new AppThemeController(preferences);
        controller.initialize();
        const writeTheme = jest.spyOn(preferences, 'writeTheme');

        expect(controller.setTheme('directv')).toEqual({
            ok: true,
            effectiveValue: 'directv',
            migration: null,
        });
        expect(writeTheme).not.toHaveBeenCalled();
    });
});
