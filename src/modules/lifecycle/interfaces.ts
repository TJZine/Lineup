import {
    AppPhase,
    AppError,
    AppLifecycleState,
    MemoryUsage,
    LifecycleCallback,
    LifecycleEventMap,
    AppErrorCode,
} from './types';
import type { IDisposable } from '../../utils/interfaces';

export interface IAppLifecycle {
    initialize(): Promise<void>;

    shutdown(): Promise<void>;

    /**
     * Resolves when the latest debounced lifecycle state save flushes.
     * Rejects with the error thrown by StateManager.save(), such as QuotaExceededError.
     */
    saveState(): Promise<void>;

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

    /** Awaitable test/runtime seam for callers that need phase transition completion. */
    setPhaseAndWait(phase: AppPhase): Promise<boolean>;

    /** Resolves after the latest tracked phase, pause, resume, or error transition settles. */
    waitForPendingTransition(): Promise<void>;

    reportError(error: AppError): void;

    getLastError(): AppError | null;

    on<K extends keyof LifecycleEventMap>(
        event: K,
        handler: (payload: LifecycleEventMap[K]) => void
    ): IDisposable;

    getErrorUserMessage(code: AppErrorCode): string;
}
