import type { ModuleStatus } from './core/orchestrator/contracts/OrchestratorTypes';
import type { Screen } from './modules/navigation';

export { AppOrchestrator } from './core/orchestrator/AppOrchestrator';
export type { PlaybackInfoSnapshot } from './core/orchestrator/runtime/OrchestratorPlaybackInfoSnapshot';
export type { ModuleStatus } from './core/orchestrator/contracts/OrchestratorTypes';

export interface AppOrchestratorRuntime {
    getModuleStatus(): Map<string, ModuleStatus>;
    isReady(): boolean;
    getCurrentScreen(): Screen | null;
    openEPG(): void;
    closeEPG(): void;
    toggleEPG(): void;
}
