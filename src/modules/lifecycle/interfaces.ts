import {
    AppPhase,
    AppError,
    PersistentState,
    AppLifecycleState,
    MemoryUsage,
    ErrorAction,
    LifecycleCallback,
    LifecycleEventMap,
    AppErrorCode,
} from './types';
import type { IDisposable } from '../../utils/interfaces';

export interface IAppLifecycle {
    initialize(): Promise<void>;

    shutdown(): Promise<void>;

    saveState(): Promise<void>;

    restoreState(): Promise<PersistentState | null>;

    clearState(): Promise<void>;

    onPause(callback: LifecycleCallback): IDisposable;

    onResume(callback: LifecycleCallback): IDisposable;

    onTerminate(callback: LifecycleCallback): IDisposable;

    /** Uses navigator.onLine for quick access. */
    isNetworkAvailable(): boolean;

    checkNetworkStatus(): Promise<boolean>;

    /** Uses performance.memory when available (for example Chrome/webOS). */
    getMemoryUsage(): MemoryUsage;

    performMemoryCleanup(): void;

    getPhase(): AppPhase;

    getState(): AppLifecycleState;

    setPhase(phase: AppPhase): void;

    reportError(error: AppError): void;

    getLastError(): AppError | null;

    on<K extends keyof LifecycleEventMap>(
        event: K,
        handler: (payload: LifecycleEventMap[K]) => void
    ): IDisposable;

    getErrorRecovery(): IErrorRecovery;
}

export interface IErrorRecovery {
    handleError(error: AppError): ErrorAction[];

    executeRecovery(action: ErrorAction): Promise<boolean>;

    createError(
        code: AppErrorCode,
        message: string,
        context?: Record<string, unknown>
    ): AppError;

    getUserMessage(code: AppErrorCode): string;
}

/** Handles lifecycle-only localStorage persistence with versioning and migrations. */
export interface IStateManager {
    save(state: PersistentState): Promise<void>;

    /** Applies migrations when needed during async load. */
    load(): Promise<PersistentState | null>;

    /** Sync load path for contexts where async restore is unavailable. */
    loadSync(): PersistentState | null;

    clear(): Promise<void>;

    createDefaultState(): PersistentState;
}
