import type { AppError } from '../../types/app-errors';
export type { AppError } from '../../types/app-errors';
export { AppErrorCode } from '../../types/app-errors';

/**
 * Application phase states.
 * Forms a state machine with valid transitions.
 */
export type AppPhase =
    | 'initializing'
    | 'authenticating'
    | 'loading_data'
    | 'ready'
    | 'backgrounded'
    | 'resuming'
    | 'error'
    | 'terminating';

export type ConnectionStatus =
    | 'connected'
    | 'connecting'
    | 'disconnected'
    | 'unreachable';

export interface UserPreferences {
    theme: 'dark' | 'light';
    /** Audio volume level (0-100) */
    volume: number;
    subtitleLanguage: string | null;
    audioLanguage: string | null;
}

/**
 * Persistent state saved to localStorage.
 * Includes lifecycle-only fields and a schema version for migrations.
 */
export interface PersistentState {
    version: number;
    userPreferences: UserPreferences;
    lastUpdated: number;
}

/**
 * Lifecycle-specific error with additional context.
 */
export interface LifecycleAppError extends AppError {
    phase: AppPhase;
    timestamp: number;
    userMessage: string;
    actions: ErrorAction[];
}

export interface LifecycleAsyncError {
    /** Async lifecycle task context that failed */
    context: string;
    /** Log-safe error summary */
    error: unknown;
    /** Timestamp of async failure */
    timestamp: number;
}

/**
 * Event map for lifecycle events.
 * Used with EventEmitter for type-safe event handling.
 */
export interface LifecycleEventMap {
    phaseChange: { from: AppPhase; to: AppPhase };
    visibilityChange: { isVisible: boolean };
    networkChange: { isAvailable: boolean };
    plexConnectionChange: { status: ConnectionStatus };
    error: LifecycleAppError;
    /** Emitted when an async lifecycle task fails without necessarily changing app phase */
    asyncError: LifecycleAsyncError;
    /** Emitted when persistence fails but does not require blocking UI */
    persistenceWarning: { message: string; isQuotaError: boolean; timestamp: number };
    /** Emitted when network monitoring detects failures (throttled) */
    networkWarning: { message: string; isAvailable: boolean; timestamp: number };
    /** Emitted when state is restored from localStorage */
    stateRestored: PersistentState;
    /** Emitted before app terminates */
    beforeTerminate: undefined;
    /** Emitted when memory warning threshold is reached */
    memoryWarning: { level: 'warning' | 'critical'; used: number };
    /** Emitted to trigger cache clearing */
    clearCaches: undefined;
}

/**
 * Runtime state of the lifecycle manager.
 */
export interface AppLifecycleState {
    phase: AppPhase;
    isVisible: boolean;
    isNetworkAvailable: boolean;
    lastActiveTime: number;
    plexConnectionStatus: ConnectionStatus;
    currentError: AppError | null;
}

/**
 * Memory usage information.
 */
export interface MemoryUsage {
    /** Used heap size in bytes */
    used: number;
    /** Total heap limit in bytes */
    limit: number;
    /** Usage percentage (0-100) */
    percentage: number;
}

/**
 * Recovery action presented to user.
 */
export interface ErrorAction {
    label: string;
    action: () => void | Promise<void>;
    isPrimary: boolean;
    requiresNetwork: boolean;
}

export type LifecycleCallback = () => void | Promise<void>;
