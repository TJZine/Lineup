import type { AppError, AppPhase, LifecycleAppError } from '../../modules/lifecycle';
import type { AppErrorCode } from '../../types/app-errors';

/** User-facing action button for error recovery overlay. */
export interface ErrorRecoveryAction {
    id?: string;
    label: string;
    action: () => void | Promise<void>;
    isPrimary: boolean;
    requiresNetwork: boolean;
}

export interface RecoveryActionDeps {
    goToAuth: () => void; // must internally no-op if navigation missing
    goToServerSelect: () => void; // must internally no-op if navigation missing
    goToChannelEdit: () => void; // must internally no-op if navigation missing
    goToSettings: () => void; // must internally no-op if navigation missing
    retryStart: () => Promise<void>;
    retryPlayback: () => void; // must retry the current loaded program and internally no-op if unavailable
    exitApp: () => Promise<void>;
    skipToNext: () => void; // must internally no-op if scheduler missing
}

export interface LifecycleErrorAdapterDeps {
    getPhase: () => AppPhase; // if lifecycle missing, Orchestrator must pass () => 'error'
    getUserMessage: (code: AppErrorCode) => string; // if lifecycle missing, Orchestrator must pass fallback
    getRecoveryActions: (code: AppErrorCode) => ErrorRecoveryAction[];
    nowMs: () => number; // MUST be Date.now in production
}

export type { AppError, LifecycleAppError, AppPhase };
