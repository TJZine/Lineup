import { TIMING_CONFIG } from './constants';
import type { LifecycleStateStore } from './LifecycleStateStore';
import type { LifecycleEventMap, PersistentState } from './types';
import { emitBestEffortWarning, summarizeErrorForLog } from '../../utils/errors';
import { PersistenceWarningBackoffPolicy } from '../../utils/persistenceWarningBackoffPolicy';

type PendingSaveWaiter = {
    resolve: () => void;
    reject: (error: unknown) => void;
};

export interface LifecycleStatePersistenceQueueDeps {
    lifecycleStateStore: LifecycleStateStore;
    buildState: () => PersistentState;
    emitPersistenceWarning: (warning: LifecycleEventMap['persistenceWarning']) => void;
}

export class LifecycleStatePersistenceQueue {
    private readonly _lifecycleStateStore: LifecycleStateStore;
    private readonly _buildState: () => PersistentState;
    private readonly _emitPersistenceWarning: (warning: LifecycleEventMap['persistenceWarning']) => void;
    private _saveDebounceTimer: number | null = null;
    private _pendingState: PersistentState | null = null;
    private _pendingSaveWaiters: PendingSaveWaiter[] = [];
    private readonly _persistenceWarningPolicy = new PersistenceWarningBackoffPolicy();

    public constructor(deps: LifecycleStatePersistenceQueueDeps) {
        this._lifecycleStateStore = deps.lifecycleStateStore;
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
            void this.flush().catch(() => undefined);
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
            this._lifecycleStateStore.save(this._pendingState);
            this._pendingState = null;
            this._persistenceWarningPolicy.resetQuotaBackoff();
            this._resolvePendingSaveWaiters();
        } catch (error) {
            if (options?.finalShutdown === true) {
                emitBestEffortWarning('Final shutdown flush failed', {
                    subsystem: 'lifecycle',
                    error: summarizeErrorForLog(error),
                });
                this._rejectPendingSaveWaiters(error);
                return;
            }
            this._rejectPendingSaveWaiters(error);
            this._handleSaveError(error);
            throw error;
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
            emitBestEffortWarning('Persistence warning handler failed', {
                subsystem: 'lifecycle',
                error: summarizeErrorForLog(handlerError),
            });
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
        return this._persistenceWarningPolicy.shouldEmitWarning(isQuotaError);
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
