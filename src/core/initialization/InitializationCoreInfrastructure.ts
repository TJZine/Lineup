import type { IAppLifecycle, AppError } from '../../modules/lifecycle';
import type { INavigationManager } from '../../modules/navigation';
import type { OrchestratorConfig, ModuleStatus } from '../orchestrator/contracts/OrchestratorTypes';
import { throwIfStartupAborted } from './InitializationAbort';

export async function initializeCoreInfrastructure(options: {
    config: OrchestratorConfig;
    lifecycle: IAppLifecycle | null;
    navigation: INavigationManager | null;
    updateModuleStatus(
        id: string,
        status: ModuleStatus['status'],
        error?: AppError,
        loadTimeMs?: number
    ): void;
    signal: AbortSignal | null | undefined;
}): Promise<void> {
    const startTime = Date.now();
    throwIfStartupAborted(options.signal);
    options.updateModuleStatus('event-emitter', 'ready', undefined, 0);
    const promises: Promise<void>[] = [];
    if (options.lifecycle) {
        options.updateModuleStatus('app-lifecycle', 'initializing');
        promises.push(options.lifecycle.initialize().then(() => {
            throwIfStartupAborted(options.signal);
            options.updateModuleStatus('app-lifecycle', 'ready', undefined, Date.now() - startTime);
        }));
    }
    if (options.navigation) {
        throwIfStartupAborted(options.signal);
        options.updateModuleStatus('navigation', 'initializing');
        options.navigation.initialize(options.config.navConfig);
        throwIfStartupAborted(options.signal);
        options.updateModuleStatus('navigation', 'ready', undefined, Date.now() - startTime);
    }
    await Promise.all(promises);
    throwIfStartupAborted(options.signal);
}
