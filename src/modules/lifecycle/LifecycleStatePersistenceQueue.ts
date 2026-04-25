import { TIMING_CONFIG } from './constants';
import type { StateManager } from './StateManager';
import type { LifecycleEventMap, PersistentState } from './types';
import { summarizeErrorForLog } from '../../utils/errors';

type PendingSaveWaiter = {
    resolve: () => void;
    reject: (error: unknown) => void;
};

export interface LifecycleStatePersistenceQueueDeps {
    stateManager: StateManager;
    buildState: () => PersistentState;
    emitPersistenceWarning: (warning: LifecycleEventMap['persistenceWarning']) => void;
}

export class LifecycleStatePersistenceQueue {
    private readonly _stateManager: StateManager;
    private readonly _buildState: () => PersistentState;
    private readonly _emitPersistenceWarning: (warning: LifecycleEventMap['persistenceWarning']) => void;
    private _saveDebounceTimer: number | null = null;
    private _pendingState: PersistentState | null = null;
    private _pendingSaveWaiters: PendingSaveWaiter[] = [];
    private _nextPersistenceWarningAt: number = 0;
    private _persistenceWarningBackoffMs: number = TIMING_CONFIG.PERSISTENCE_WARNING_BACKOFF_MS;

    public constructor(deps: LifecycleStatePersistenceQueueDeps) {
        this._stateManager = deps.stateManager;
        this._buildState = deps.buildState;
        this._emitPersistenceWarning = deps.emitPersistenceWarning;
    }

    public saveState(): Promise<void> {
        let state: PersistentState;
        try {
            state = this._buildState();
        } catch (error) {
            return Promise.reject(error);
        }
        this._pendingState = state;

        if (this._saveDebounceTimer !== null) {
            clearTimeout(this._saveDebounceTimer);
        }

        this._saveDebounceTimer = window.setTimeout(() => {
            void this.flush();
        }, TIMING_CONFIG.SAVE_DEBOUNCE_MS) as unknown as number;

        return new Promise<void>((resolve, reject) => {
            this._pendingSaveWaiters.push({ resolve, reject });
        });
    }

    public async flush(options?: { finalShutdown?: boolean }): Promise<void> {
        if (this._saveDebounceTimer !== null) {
            clearTimeout(this._saveDebounceTimer);
            this._saveDebounceTimer = null;
        }

        if (this._pendingState === null) {
            return;
        }

        try {
            this._stateManager.save(this._pendingState);
            this._pendingState = null;
            this._persistenceWarningBackoffMs = TIMING_CONFIG.PERSISTENCE_WARNING_BACKOFF_MS;
            this._resolvePendingSaveWaiters();
        } catch (error) {
            if (options?.finalShutdown === true) {
                console.warn('[AppLifecycle] Final shutdown flush failed', summarizeErrorForLog(error));
            }
            this._rejectPendingSaveWaiters(error);
            this._handleSaveError(error);
        }
    }

    private _handleSaveError(error: unknown): void {
        const isQuotaError = this._isQuotaError(error);
        if (!this._shouldEmitPersistenceWarning(isQuotaError)) {
            return;
        }

        const message = isQuotaError
            ? 'Persistent storage quota exceeded; save deferred'
            : 'Failed to persist state; will retry on next save';
        try {
            this._emitPersistenceWarning({
                message,
                isQuotaError,
                timestamp: Date.now(),
            });
        } catch (handlerError) {
            console.warn('[AppLifecycle] Persistence warning handler failed', handlerError);
        }
    }

    private _resolvePendingSaveWaiters(): void {
        const waiters = this._pendingSaveWaiters;
        this._pendingSaveWaiters = [];
        waiters.forEach(({ resolve }) => resolve());
    }

    private _rejectPendingSaveWaiters(error: unknown): void {
        const waiters = this._pendingSaveWaiters;
        this._pendingSaveWaiters = [];
        waiters.forEach(({ reject }) => reject(error));
    }

    private _shouldEmitPersistenceWarning(isQuotaError: boolean): boolean {
        const now = Date.now();
        if (now < this._nextPersistenceWarningAt) {
            return false;
        }
        const backoff = isQuotaError
            ? this._persistenceWarningBackoffMs
            : TIMING_CONFIG.PERSISTENCE_WARNING_BACKOFF_MS;
        this._nextPersistenceWarningAt = now + backoff;
        if (isQuotaError) {
            this._persistenceWarningBackoffMs = Math.min(
                this._persistenceWarningBackoffMs * 2,
                TIMING_CONFIG.PERSISTENCE_WARNING_MAX_BACKOFF_MS
            );
        } else {
            this._persistenceWarningBackoffMs = TIMING_CONFIG.PERSISTENCE_WARNING_BACKOFF_MS;
        }
        return true;
    }

    private _isQuotaError(error: unknown): boolean {
        if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
            return (
                error.code === 22 ||
                error.code === 1014 ||
                error.name === 'QuotaExceededError'
            );
        }
        return false;
    }
}
