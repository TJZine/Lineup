/**
 * @fileoverview Centralized theme management.
 * @module modules/ui/theme/ThemeManager
 */

import { THEME_CLASSES } from '../settings/theme';
import type { ThemeName } from '../settings/theme';
import { DEFAULT_THEME } from '../settings/theme';
import { safeLocalStorageGet, safeLocalStorageSet } from '../../../utils/storage';
import { RETUNE_STORAGE_KEYS } from '../../../config/storageKeys';

/**
 * Manages application theming.
 * Applies/removes theme classes on document.body.
 */
export class ThemeManager {
    private static _instance: ThemeManager | null = null;
    private _currentTheme: ThemeName = DEFAULT_THEME;

    static getInstance(): ThemeManager {
        if (!ThemeManager._instance) {
            ThemeManager._instance = new ThemeManager();
        }
        return ThemeManager._instance;
    }

    /**
     * Test-only helper to clear singleton state between test cases.
     * Do not call from application runtime code.
     */
    static __resetForTests(): void {
        ThemeManager._instance = null;
    }

    private constructor() {
        this._loadSavedTheme();
    }

    private _loadSavedTheme(): void {
        const saved = safeLocalStorageGet(RETUNE_STORAGE_KEYS.THEME);
        const isThemeName = (value: string | null): value is ThemeName =>
            !!value && Object.prototype.hasOwnProperty.call(THEME_CLASSES, value);
        if (isThemeName(saved)) {
            this._currentTheme = saved;
            this._applyTheme(saved);
            return;
        }

        this._currentTheme = DEFAULT_THEME;
        safeLocalStorageSet(RETUNE_STORAGE_KEYS.THEME, this._currentTheme);
        this._applyTheme(this._currentTheme);
    }

    getTheme(): ThemeName {
        return this._currentTheme;
    }

    setTheme(theme: ThemeName): void {
        if (theme === this._currentTheme) return;
        this._currentTheme = theme;
        safeLocalStorageSet(RETUNE_STORAGE_KEYS.THEME, theme);
        this._applyTheme(theme);
    }

    private _applyTheme(theme: ThemeName): void {
        if (typeof document === 'undefined') return;
        const root = document.body ?? document.documentElement;
        if (!root) return;

        const classes = Object.values(THEME_CLASSES).filter((value) => value !== '');
        if (classes.length > 0) {
            root.classList.remove(...classes);
        }

        const themeClass = THEME_CLASSES[theme];
        if (themeClass) {
            root.classList.add(themeClass);
        }
    }
}
