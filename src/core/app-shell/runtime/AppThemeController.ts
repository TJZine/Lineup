import { ThemePreferencesStore } from '../../../modules/settings/ThemePreferencesStore';
import { DEFAULT_THEME, THEME_CLASSES, type ThemeName } from '../../../modules/ui/theme/themeDefinitions';
import type { SettingsPersistenceResult } from '../../../modules/ui/settings/types';

const isThemeName = (value: string | null): value is ThemeName =>
    !!value && Object.prototype.hasOwnProperty.call(THEME_CLASSES, value);

/**
 * App-shell-owned runtime theme controller.
 * Keeps theme persistence and DOM class application behind an explicit seam.
 */
export class AppThemeController {
    private _currentTheme: ThemeName = DEFAULT_THEME;
    private readonly _themePreferencesStore: ThemePreferencesStore;

    constructor(themePreferencesStore: ThemePreferencesStore = new ThemePreferencesStore()) {
        this._themePreferencesStore = themePreferencesStore;
    }

    initialize(): ThemeName {
        const stored = this._themePreferencesStore.readThemeAndClean();
        this._currentTheme = isThemeName(stored) ? stored : DEFAULT_THEME;

        if (stored !== this._currentTheme) {
            this._themePreferencesStore.writeTheme(this._currentTheme);
        }

        this._applyTheme(this._currentTheme);
        return this._currentTheme;
    }

    getTheme(): ThemeName {
        return this._currentTheme;
    }

    setTheme(theme: ThemeName): SettingsPersistenceResult {
        if (theme === this._currentTheme) {
            return { ok: true };
        }

        const result = this._themePreferencesStore.writeTheme(theme);
        if (!result.ok) {
            return { ok: false };
        }

        this._currentTheme = theme;
        this._applyTheme(theme);
        return { ok: true };
    }

    private _applyTheme(theme: ThemeName): void {
        if (typeof document === 'undefined') return;

        const root = document.body ?? document.documentElement;
        if (!root) return;

        const classes = Object.values(THEME_CLASSES);
        if (classes.length > 0) {
            root.classList.remove(...classes);
        }

        const themeClass = THEME_CLASSES[theme];
        if (themeClass) {
            root.classList.add(themeClass);
        }
    }
}
