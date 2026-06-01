import {
    PersistentState,
    UserPreferences,
} from './types';
import {
    STORAGE_CONFIG,
    MIGRATIONS,
    DEFAULT_USER_PREFERENCES,
} from './constants';
import {
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSetWithResult,
} from '../../utils/storage';

type StorageMutationFailureReason = 'quota-exceeded' | 'unavailable';

export class LifecycleStateStore {
    private readonly _storageKey: string;
    private readonly _currentVersion: number;

    constructor(storageKey?: string) {
        this._storageKey = storageKey !== undefined ? storageKey : STORAGE_CONFIG.STATE_KEY;
        this._currentVersion = STORAGE_CONFIG.STATE_VERSION;
    }

    public save(state: PersistentState): void {
        const stateToSave: PersistentState = {
            ...state,
            version: this._currentVersion,
            lastUpdated: Date.now(),
        };

        const serialized = JSON.stringify(stateToSave);

        const initialResult = safeLocalStorageSetWithResult(this._storageKey, serialized);
        if (initialResult.ok) {
            return;
        }

        if (initialResult.reason !== 'quota-exceeded') {
            throw this._createStorageMutationError(initialResult.reason);
        }

        this._performStorageCleanup();

        const retryResult = safeLocalStorageSetWithResult(this._storageKey, serialized);
        if (!retryResult.ok) {
            throw this._createStorageMutationError(retryResult.reason);
        }
    }

    public load(): PersistentState | null {
        const serialized = safeLocalStorageGet(this._storageKey);
        if (serialized === null) {
            return null;
        }

        try {
            const parsed: unknown = JSON.parse(serialized);
            if (!this._isMinimalState(parsed)) {
                return null;
            }

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

    public clear(): void {
        safeLocalStorageRemove(this._storageKey);
    }

    public createDefaultState(): PersistentState {
        return {
            version: this._currentVersion,
            userPreferences: { ...DEFAULT_USER_PREFERENCES } as UserPreferences,
            lastUpdated: Date.now(),
        };
    }

    private _migrateState(state: Record<string, unknown>): Record<string, unknown> | null {
        const version = state['version'];
        if (typeof version !== 'number') {
            return null;
        }

        // Future versions are accepted and repaired without downgrading.
        if (version > this._currentVersion) {
            return state;
        }

        let currentState = state;
        let currentVersion = version;

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

    private _createStorageMutationError(reason: StorageMutationFailureReason): Error {
        if (typeof DOMException !== 'undefined') {
            return new DOMException(
                reason === 'quota-exceeded'
                    ? 'Storage quota exceeded'
                    : 'Persistent storage unavailable',
                reason === 'quota-exceeded' ? 'QuotaExceededError' : 'SecurityError'
            );
        }
        return new Error(
            reason === 'quota-exceeded'
                ? 'Storage quota exceeded'
                : 'Persistent storage unavailable'
        );
    }

    private _performStorageCleanup(): void {
        for (const key of STORAGE_CONFIG.CLEANUP_KEYS) {
            safeLocalStorageRemove(key);
        }
    }

    private _isMinimalState(data: unknown): data is Record<string, unknown> {
        if (!this._isRecord(data)) {
            return false;
        }
        return typeof data['version'] === 'number';
    }

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
