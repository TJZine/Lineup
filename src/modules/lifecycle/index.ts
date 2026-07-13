export { AppLifecycle } from './AppLifecycle';
export { LifecycleErrorMessageCatalog } from './LifecycleErrorMessageCatalog';
export {
    FutureLifecycleStateVersionError,
    LifecycleStateStore,
    type LifecycleStateLoadResult,
} from './LifecycleStateStore';

export type { IAppLifecycle } from './interfaces';

export type {
    AppPhase,
    ConnectionStatus,
    PersistentState,
    UserPreferences,
    LifecycleEventMap,
    LifecycleAppError,
    AppLifecycleState,
    MemoryUsage,
    ErrorAction,
    LifecycleCallback,
    AppError,
} from './types';

export { AppErrorCode } from './types';

export {
    STORAGE_CONFIG,
    MEMORY_THRESHOLDS,
    TIMING_CONFIG,
    ERROR_MESSAGES,
    VALID_PHASE_TRANSITIONS,
} from './constants';
