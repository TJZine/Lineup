import type { PlatformServices } from '../../../platform';
import type { AppShellOrchestratorRuntime } from './AppShellRuntimeContracts';

const RUNTIME_IMPORT_START_MARK = 'lineup.runtime_import.start';
const RUNTIME_IMPORT_END_MARK = 'lineup.runtime_import.end';
const RUNTIME_IMPORT_MEASURE = 'lineup.runtime_import';

export interface AppRuntimeEngineLoader {
    load(platformServices: PlatformServices): Promise<AppShellOrchestratorRuntime>;
}

function markTiming(name: string): void {
    const performanceApi = globalThis.performance;
    if (typeof performanceApi?.mark !== 'function') {
        return;
    }
    try {
        performanceApi.mark(name);
    } catch {
        return;
    }
}

function measureTiming(name: string, startMark: string, endMark: string): void {
    const performanceApi = globalThis.performance;
    if (typeof performanceApi?.measure !== 'function') {
        return;
    }
    try {
        performanceApi.measure(name, startMark, endMark);
    } catch {
        return;
    }
}

export function createAppRuntimeEngineLoader(): AppRuntimeEngineLoader {
    return {
        async load(platformServices: PlatformServices): Promise<AppShellOrchestratorRuntime> {
            markTiming(RUNTIME_IMPORT_START_MARK);
            const { AppOrchestrator } = await import('../../orchestrator/AppOrchestrator');
            markTiming(RUNTIME_IMPORT_END_MARK);
            measureTiming(RUNTIME_IMPORT_MEASURE, RUNTIME_IMPORT_START_MARK, RUNTIME_IMPORT_END_MARK);
            return new AppOrchestrator(platformServices);
        },
    };
}
