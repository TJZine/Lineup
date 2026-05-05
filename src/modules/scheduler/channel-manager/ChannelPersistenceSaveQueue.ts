import { TIMING_CONFIG } from '../../../config/timing';
import { AppErrorCode, getAppErrorCode } from '../../../types/app-errors';
import { summarizeErrorForLog } from '../../../utils/errors';
import { PersistenceWarningBackoffPolicy } from '../../../utils/persistenceWarningBackoffPolicy';
import { STORAGE_CONFIG } from '../../lifecycle/constants';
import type { ChannelManagerEventMap } from './types';

type PersistenceLogger = {
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
};

type ChannelPersistenceSaveQueueConfig = {
    runSave: () => void;
    createDisposedError: () => Error;
    emitPersistenceWarning: (payload: ChannelManagerEventMap['persistenceWarning']) => void;
    logger: PersistenceLogger;
};

export class ChannelPersistenceSaveQueue {
    private _runSave: () => void;
    private readonly _createDisposedError: () => Error;
    private readonly _emitPersistenceWarning: (payload: ChannelManagerEventMap['persistenceWarning']) => void;
    private readonly _logger: PersistenceLogger;
    private readonly _reportedPersistenceFailures = new WeakSet<object>();

    private _saveTimer: ReturnType<typeof setTimeout> | null = null;
    private _pendingSavePromise: Promise<void> | null = null;
    private _pendingSaveResolve: (() => void) | null = null;
    private _pendingSaveReject: ((error: unknown) => void) | null = null;
    private _queuedSaveCatchPromise: Promise<void> | null = null;
    private readonly _persistenceWarningPolicy = new PersistenceWarningBackoffPolicy();
    private _isDisposed = false;

    constructor(config: ChannelPersistenceSaveQueueConfig) {
        this._runSave = config.runSave;
        this._createDisposedError = config.createDisposedError;
        this._emitPersistenceWarning = config.emitPersistenceWarning;
        this._logger = config.logger;
    }

    save(): Promise<void> {
        if (this._isDisposed) {
            const disposedError = this._createDisposedError();
            this._markPersistenceFailureReported(disposedError);
            return Promise.reject(disposedError);
        }

        const pendingSave = this._ensurePendingSavePromise();
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
        }

        this._saveTimer = setTimeout(() => {
            this._saveTimer = null;
            try {
                this._runPendingSaveNow();
            } catch {
                // Errors are propagated to the pending promise and handled by callers.
            }
        }, TIMING_CONFIG.SAVE_DEBOUNCE_MS);

        return pendingSave;
    }

    saveWithSnapshot(runSave: () => void): Promise<void> {
        this._runSave = runSave;
        return this.save();
    }

    queue(): void {
        if (this._isDisposed) {
            this._markPersistenceFailureReported(this._createDisposedError());
            return;
        }

        const pendingSave = this.save();
        if (this._queuedSaveCatchPromise === pendingSave) {
            return;
        }
        this._queuedSaveCatchPromise = pendingSave;
        void pendingSave.catch((error) => {
            if (this._wasPersistenceFailureReported(error)) {
                return;
            }
            this._markPersistenceFailureReported(error);

            const didEmitWarning = this.emitWarning(error);
            const isQuotaError = this._isQuotaError(error);
            const summary = summarizeErrorForLog(error);

            if (isQuotaError) {
                if (didEmitWarning) {
                    this._logger.warn('Debounced save failed (quota)', summary);
                }
                return;
            }

            if (didEmitWarning) {
                this._logger.error('Debounced save failed', summary);
            }
        });
    }

    queueWithSnapshot(runSave: () => void): void {
        this._runSave = runSave;
        this.queue();
    }

    flush(): void {
        if (this._isDisposed || !this._saveTimer) {
            return;
        }

        clearTimeout(this._saveTimer);
        this._saveTimer = null;
        this._runPendingSaveNow();
    }

    flushWithSnapshot(runSave: () => void): void {
        this._runSave = runSave;
        this.flush();
    }

    supersedePendingSave(): void {
        if (this._isDisposed || !this._saveTimer) {
            return;
        }

        clearTimeout(this._saveTimer);
        this._saveTimer = null;
        this.markSuccess();
        this._resolvePendingSave();
    }

    dispose(): void {
        this._isDisposed = true;
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
        }
        const disposedError = this._createDisposedError();
        this._markPersistenceFailureReported(disposedError);
        this._rejectPendingSave(disposedError);
    }

    reportFailure(message: string, error: unknown): void {
        this._markPersistenceFailureReported(error);

        const didEmitWarning = this.emitWarning(error);
        const isQuotaError = this._isQuotaError(error);
        const summary = summarizeErrorForLog(error);

        if (isQuotaError) {
            if (didEmitWarning) {
                this._logger.warn(message, summary);
            }
            return;
        }

        this._logger.error(message, summary);
    }

    markSuccess(): void {
        this._persistenceWarningPolicy.resetAll();
    }

    emitWarning(error: unknown): boolean {
        const isQuotaError = this._isQuotaError(error);
        if (!this._shouldEmitPersistenceWarning(isQuotaError)) {
            return false;
        }
        const code = isQuotaError
            ? AppErrorCode.STORAGE_QUOTA_EXCEEDED
            : (this._getErrorCode(error) ?? AppErrorCode.UNKNOWN);
        this._emitPersistenceWarning({
            message: isQuotaError
                ? STORAGE_CONFIG.STORAGE_QUOTA_EXCEEDED
                : 'Failed to persist channels; some changes may not be saved',
            code,
            isQuotaError,
            timestamp: Date.now(),
        });
        return true;
    }

    private _ensurePendingSavePromise(): Promise<void> {
        if (this._pendingSavePromise) {
            return this._pendingSavePromise;
        }
        this._pendingSavePromise = new Promise((resolve, reject) => {
            this._pendingSaveResolve = resolve;
            this._pendingSaveReject = reject;
        });
        return this._pendingSavePromise;
    }

    private _clearPendingSavePromise(): void {
        this._pendingSavePromise = null;
        this._pendingSaveResolve = null;
        this._pendingSaveReject = null;
        this._queuedSaveCatchPromise = null;
    }

    private _resolvePendingSave(): void {
        const resolve = this._pendingSaveResolve;
        this._clearPendingSavePromise();
        if (resolve) {
            resolve();
        }
    }

    private _rejectPendingSave(error: unknown): void {
        const reject = this._pendingSaveReject;
        this._clearPendingSavePromise();
        if (reject) {
            reject(error);
        }
    }

    private _runPendingSaveNow(): void {
        try {
            this._runSave();
            this.markSuccess();
            this._resolvePendingSave();
        } catch (error) {
            this._rejectPendingSave(error);
            throw error;
        }
    }

    private _shouldEmitPersistenceWarning(isQuotaError: boolean): boolean {
        return this._persistenceWarningPolicy.shouldEmitWarning(isQuotaError);
    }

    private _markPersistenceFailureReported(error: unknown): void {
        if (error && (typeof error === 'object' || typeof error === 'function')) {
            this._reportedPersistenceFailures.add(error as object);
        }
    }

    private _wasPersistenceFailureReported(error: unknown): boolean {
        if (!error || (typeof error !== 'object' && typeof error !== 'function')) {
            return false;
        }
        return this._reportedPersistenceFailures.has(error as object);
    }

    private _isQuotaError(error: unknown): boolean {
        return (
            this._getErrorCode(error) === AppErrorCode.STORAGE_QUOTA_EXCEEDED ||
            (
                typeof DOMException !== 'undefined' &&
                error instanceof DOMException &&
                (
                    error.code === 22 ||
                    error.code === 1014 ||
                    error.name === 'QuotaExceededError' ||
                    error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
                )
            )
        );
    }

    private _getErrorCode(error: unknown): AppErrorCode | null {
        if (error && typeof error === 'object' && 'code' in error) {
            return getAppErrorCode((error as { code: unknown }).code);
        }
        return null;
    }
}
