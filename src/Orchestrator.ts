import type { ModuleStatus } from './core/orchestrator/OrchestratorTypes';
import type { Screen } from './modules/navigation';

export { AppOrchestrator, type PlaybackInfoSnapshot } from './core/orchestrator/AppOrchestrator';
export type { ModuleStatus } from './core/orchestrator/OrchestratorTypes';

export interface AppOrchestratorRuntime {
    getModuleStatus(): Map<string, ModuleStatus>;
    isReady(): boolean;
    getCurrentScreen(): Screen | null;
    openEPG(): void;
    closeEPG(): void;
    toggleEPG(): void;
}
