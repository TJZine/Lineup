import { AppErrorCode, AppOrchestrator } from '../../Orchestrator';

type ModuleInitError = Error & {
    code?: AppErrorCode;
    recoverable?: boolean;
    context?: Record<string, unknown>;
};

const expectModuleInitError = (error: unknown, messagePart: string): void => {
    const moduleInitError = error as ModuleInitError;
    expect(moduleInitError).toBeInstanceOf(Error);
    expect(moduleInitError.message).toContain(messagePart);
    expect(moduleInitError.code).toBe(AppErrorCode.MODULE_INIT_FAILED);
    expect(moduleInitError.recoverable).toBe(true);
    expect(moduleInitError.context).toEqual(expect.any(Object));
};

describe('AppOrchestrator precondition errors', () => {
    it('throws AppError-shaped precondition errors before initialization', async () => {
        const orchestrator = new AppOrchestrator();

        await expect(orchestrator.start()).rejects.toMatchObject({
            code: AppErrorCode.MODULE_INIT_FAILED,
            recoverable: true,
        });
        await expect(orchestrator.requestAuthPin()).rejects.toMatchObject({
            code: AppErrorCode.MODULE_INIT_FAILED,
            recoverable: true,
        });
        await expect(orchestrator.discoverServers()).rejects.toMatchObject({
            code: AppErrorCode.MODULE_INIT_FAILED,
            recoverable: true,
        });
    });

    it('preserves recognizable precondition messages while normalizing error shape', async () => {
        const orchestrator = new AppOrchestrator();

        try {
            await orchestrator.start();
        } catch (error: unknown) {
            expectModuleInitError(error, 'Orchestrator must be initialized before starting');
        }

        try {
            await orchestrator.requestAuthPin();
        } catch (error: unknown) {
            expectModuleInitError(error, 'PlexAuth not initialized');
        }

        try {
            await orchestrator.discoverServers();
        } catch (error: unknown) {
            expectModuleInitError(error, 'PlexServerDiscovery not initialized');
        }
    });
});
