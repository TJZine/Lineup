import { ThemePreferencesStore } from '../../../modules/settings/ThemePreferencesStore';
import { DEFAULT_THEME, THEME_CLASSES, type ThemeName } from '../../../modules/ui/theme/themeDefinitions';
import type { SafeLocalStorageMutationResult } from '../../../utils/storage';

const isThemeName = (value: string | null): value is ThemeName =>
    !!value && Object.prototype.hasOwnProperty.call(THEME_CLASSES, value);

export type ThemePreferenceMigration = 'glass-to-ember-steel' | null;

export type ThemePersistenceResult =
    | { ok: true; effectiveValue: ThemeName; migration: ThemePreferenceMigration }
    | {
          ok: false;
          effectiveValue: ThemeName;
          migration: ThemePreferenceMigration;
          reason: 'quota-exceeded' | 'unavailable';
          retryable: true;
      };

const LEGACY_GLASS_THEME = 'glass';
const GLASS_MIGRATION: ThemePreferenceMigration = 'glass-to-ember-steel';

const successfulPersistence = (
    effectiveValue: ThemeName,
    migration: ThemePreferenceMigration = null
): ThemePersistenceResult => ({ ok: true, effectiveValue, migration });

const failedPersistence = (
    effectiveValue: ThemeName,
    migration: ThemePreferenceMigration,
    result: Extract<SafeLocalStorageMutationResult, { ok: false }>
): ThemePersistenceResult => ({
    ok: false,
    effectiveValue,
    migration,
    reason: result.reason,
    retryable: true,
});

/**
 * App-shell-owned runtime theme controller.
 * Keeps theme migration, persistence, and DOM class application behind an explicit seam.
 */
export class AppThemeController {
    private _currentTheme: ThemeName = DEFAULT_THEME;
    private readonly _themePreferencesStore: ThemePreferencesStore;
    private _lastPersistenceResult: ThemePersistenceResult = successfulPersistence(DEFAULT_THEME);
    private _pendingThemeWrite: ThemeName | null = null;
    private _pendingMigration: ThemePreferenceMigration = null;
    private _retryReadBeforeWrite = false;

    constructor(themePreferencesStore: ThemePreferencesStore = new ThemePreferencesStore()) {
        this._themePreferencesStore = themePreferencesStore;
    }

    initialize(): ThemeName {
        const storedResult = this._themePreferencesStore.readTheme();
        if (!storedResult.ok) {
            this._currentTheme = DEFAULT_THEME;
            this._pendingThemeWrite = null;
            this._pendingMigration = null;
            this._retryReadBeforeWrite = true;
            this._lastPersistenceResult = {
                ok: false,
                effectiveValue: this._currentTheme,
                migration: null,
                reason: storedResult.reason,
                retryable: true,
            };
            this._applyTheme(this._currentTheme);
            return this._currentTheme;
        }

        const stored = storedResult.value;
        const migration = stored === LEGACY_GLASS_THEME ? GLASS_MIGRATION : null;
        if (migration !== null) {
            this._currentTheme = DEFAULT_THEME;
        } else if (isThemeName(stored)) {
            this._currentTheme = stored;
        } else {
            this._currentTheme = DEFAULT_THEME;
        }
        this._applyTheme(this._currentTheme);

        if (stored === this._currentTheme) {
            this._pendingThemeWrite = null;
            this._pendingMigration = null;
            this._retryReadBeforeWrite = false;
            this._lastPersistenceResult = successfulPersistence(this._currentTheme);
            return this._currentTheme;
        }

        this._pendingThemeWrite = this._currentTheme;
        this._pendingMigration = migration;
        this._retryReadBeforeWrite = false;
        this._persistTheme(this._currentTheme, migration);
        return this._currentTheme;
    }

    getTheme(): ThemeName {
        return this._currentTheme;
    }

    getPersistenceResult(): ThemePersistenceResult {
        return this._lastPersistenceResult;
    }

    setTheme(theme: ThemeName): ThemePersistenceResult {
        if (
            theme === this._currentTheme &&
            this._pendingThemeWrite === null &&
            !this._retryReadBeforeWrite
        ) {
            return this._lastPersistenceResult;
        }

        const migration = theme === DEFAULT_THEME ? this._pendingMigration : null;
        return this._persistTheme(theme, migration);
    }

    retryPersistence(): ThemePersistenceResult {
        if (this._retryReadBeforeWrite) {
            this.initialize();
            return this._lastPersistenceResult;
        }

        if (this._pendingThemeWrite === null) {
            return this._lastPersistenceResult;
        }

        return this._persistTheme(this._pendingThemeWrite, this._pendingMigration);
    }

    private _persistTheme(theme: ThemeName, migration: ThemePreferenceMigration): ThemePersistenceResult {
        const result = this._themePreferencesStore.writeTheme(theme);
        if (!result.ok) {
            this._pendingThemeWrite = theme;
            this._pendingMigration = migration;
            this._retryReadBeforeWrite = false;
            this._lastPersistenceResult = failedPersistence(this._currentTheme, migration, result);
            return this._lastPersistenceResult;
        }

        this._currentTheme = theme;
        this._applyTheme(theme);
        this._pendingThemeWrite = null;
        this._pendingMigration = null;
        this._retryReadBeforeWrite = false;
        this._lastPersistenceResult = successfulPersistence(theme, migration);
        return this._lastPersistenceResult;
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
