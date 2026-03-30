import { AppErrorCode, AppOrchestrator } from '../../Orchestrator';

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

        await expect(orchestrator.start()).rejects.toMatchObject({
            code: AppErrorCode.MODULE_INIT_FAILED,
            recoverable: true,
            message: expect.stringContaining('Orchestrator must be initialized before starting'),
        });

        await expect(orchestrator.requestAuthPin()).rejects.toMatchObject({
            code: AppErrorCode.MODULE_INIT_FAILED,
            recoverable: true,
            message: expect.stringContaining('PlexAuth not initialized'),
        });

        await expect(orchestrator.discoverServers()).rejects.toMatchObject({
            code: AppErrorCode.MODULE_INIT_FAILED,
            recoverable: true,
            message: expect.stringContaining('PlexServerDiscovery not initialized'),
        });
    });

    it('reports PlexAuth as the missing dependency for profile switching when auth is absent', async () => {
        const orchestrator = new AppOrchestrator();

        await expect(orchestrator.switchHomeUser('user-1')).rejects.toMatchObject({
            code: AppErrorCode.MODULE_INIT_FAILED,
            recoverable: true,
            message: expect.stringContaining('PlexAuth not initialized'),
            context: expect.objectContaining({
                method: 'switchHomeUser',
                dependency: 'PlexAuth',
            }),
        });

        await expect(orchestrator.useMainAccountProfile()).rejects.toMatchObject({
            code: AppErrorCode.MODULE_INIT_FAILED,
            recoverable: true,
            message: expect.stringContaining('PlexAuth not initialized'),
            context: expect.objectContaining({
                method: 'useMainAccountProfile',
                dependency: 'PlexAuth',
            }),
        });
    });
});
