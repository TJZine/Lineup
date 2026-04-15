/**
 * @fileoverview State Manager for localStorage persistence with versioning.
 * @module modules/lifecycle/StateManager
 * @version 1.0.0
 */

import {
    PersistentState,
    UserPreferences,
} from './types';
import {
    STORAGE_CONFIG,
    MIGRATIONS,
    DEFAULT_USER_PREFERENCES,
} from './constants';
import { safeLocalStorageRemove } from '../../utils/storage';

/**
 * Manages application state persistence to localStorage.
 * Handles versioning, migrations, and quota errors.
 */
export class StateManager {
    private readonly _storageKey: string;
    private readonly _currentVersion: number;

    /**
     * Create a new StateManager.
     * @param storageKey - Override storage key (for testing)
     */
    constructor(storageKey?: string) {
        this._storageKey = storageKey !== undefined ? storageKey : STORAGE_CONFIG.STATE_KEY;
        this._currentVersion = STORAGE_CONFIG.STATE_VERSION;
    }

    /**
     * Save state to localStorage.
     * Handles QuotaExceededError by attempting cleanup and retry.
     * @param state - State to save
     */
    public save(state: PersistentState): void {
        const stateToSave: PersistentState = {
            ...state,
            version: this._currentVersion,
            lastUpdated: Date.now(),
        };

        const serialized = JSON.stringify(stateToSave);

        try {
            localStorage.setItem(this._storageKey, serialized);
        } catch (error) {
            if (this._isQuotaError(error)) {
                this._performStorageCleanup();

                // Retry once after cleanup
                localStorage.setItem(this._storageKey, serialized);
            } else {
                throw error;
            }
        }
    }

    /**
     * Load state from localStorage and apply migrations if needed.
     * @returns Loaded state, or null if not available/invalid
     */
    public load(): PersistentState | null {
        try {
            const serialized = localStorage.getItem(this._storageKey);
            if (serialized === null) {
                return null;
            }

            const parsed: unknown = JSON.parse(serialized);
            if (!this._isMinimalState(parsed)) {
                return null;
            }

            // Apply migrations if needed
            const migrated = this._migrateState(parsed as Record<string, unknown>);
            if (migrated === null) {
                return null;
            }

            return this._repairState(migrated);
        } catch {
            // Parse errors are non-fatal; state will be treated as absent.
            return null;
        }
    }

    /**
     * Clear stored state.
     */
    public clear(): void {
        safeLocalStorageRemove(this._storageKey);
    }

    /**
     * Create a default persistent state.
     * @returns Default state object
     */
    public createDefaultState(): PersistentState {
        return {
            version: this._currentVersion,
            userPreferences: { ...DEFAULT_USER_PREFERENCES } as UserPreferences,
            lastUpdated: Date.now(),
        };
    }

    /**
     * Apply version migrations to state.
     * @param state - State to migrate
     * @returns Migrated state, or null if migration fails
     */
    private _migrateState(state: Record<string, unknown>): Record<string, unknown> | null {
        const version = state['version'];
        if (typeof version !== 'number') {
            return null;
        }

        // Handle future versions gracefully (don't downgrade)
        if (version > this._currentVersion) {
            return state;
        }

        let currentState = state;
        let currentVersion = version;

        // Apply migrations sequentially
        while (currentVersion < this._currentVersion) {
            const migration = MIGRATIONS[currentVersion];
            if (!migration) {
                return null;
            }

            currentState = migration(currentState);
            currentVersion = currentVersion + 1;
        }

        return currentState;
    }

    /**
     * Check if error is a quota exceeded error.
     */
    private _isQuotaError(error: unknown): boolean {
        if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
            // Different browsers use different error codes
            return (
                error.code === 22 || // Legacy
                error.code === 1014 || // Firefox
                error.name === 'QuotaExceededError'
            );
        }
        return false;
    }

    /**
     * Perform storage cleanup to free space.
     * Removes non-critical cached data defined in STORAGE_CONFIG.CLEANUP_KEYS.
     */
    private _performStorageCleanup(): void {
        for (const key of STORAGE_CONFIG.CLEANUP_KEYS) {
            try {
                localStorage.removeItem(key);
            } catch {
                // Ignore cleanup errors
            }
        }
    }

    /**
     * Minimal validation: must be an object with a numeric version.
     */
    private _isMinimalState(data: unknown): data is Record<string, unknown> {
        if (!this._isRecord(data)) {
            return false;
        }
        return typeof data['version'] === 'number';
    }

    /**
     * Repair state shape after migration to ensure a safe PersistentState.
     */
    private _repairState(state: Record<string, unknown>): PersistentState {
        const version =
            typeof state['version'] === 'number' ? state['version'] : this._currentVersion;
        const lastUpdated =
            typeof state['lastUpdated'] === 'number' ? state['lastUpdated'] : Date.now();

        const userPreferences = this._isValidUserPreferences(state['userPreferences'])
            ? (state['userPreferences'] as UserPreferences)
            : ({ ...DEFAULT_USER_PREFERENCES } as UserPreferences);

        return {
            version,
            userPreferences,
            lastUpdated,
        };
    }

    private _isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null;
    }

    private _isValidUserPreferences(value: unknown): value is UserPreferences {
        if (!this._isRecord(value)) {
            return false;
        }
        const theme = value['theme'];
        const volume = value['volume'];
        if (theme !== 'dark' && theme !== 'light') {
            return false;
        }
        if (typeof volume !== 'number' || !Number.isFinite(volume) || volume < 0 || volume > 100) {
            return false;
        }
        const subtitleLanguage = value['subtitleLanguage'];
        const audioLanguage = value['audioLanguage'];
        if (subtitleLanguage !== null && typeof subtitleLanguage !== 'string') {
            return false;
        }
        if (audioLanguage !== null && typeof audioLanguage !== 'string') {
            return false;
        }
        return true;
    }

}
