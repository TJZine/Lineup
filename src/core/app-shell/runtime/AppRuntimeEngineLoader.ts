import type { PlatformServices } from '../../../platform';
import type { AppShellOrchestratorRuntime } from './AppShellRuntimeContracts';

export interface AppRuntimeEngineLoader {
    load(platformServices: PlatformServices): Promise<AppShellOrchestratorRuntime>;
}

export function createAppRuntimeEngineLoader(): AppRuntimeEngineLoader {
    return {
        async load(platformServices: PlatformServices): Promise<AppShellOrchestratorRuntime> {
            const { AppOrchestrator } = await import('../../../Orchestrator');
            return new AppOrchestrator(platformServices);
        },
    };
}
