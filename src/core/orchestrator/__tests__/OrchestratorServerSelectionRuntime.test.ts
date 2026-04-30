import type { IPlexServerDiscovery } from '../../../modules/plex/discovery';
import { AppErrorCode } from '../../../types/app-errors';
import { OrchestratorServerSelectionRuntime } from '../OrchestratorServerSelectionRuntime';

describe('OrchestratorServerSelectionRuntime', () => {
    it('uses the typed discovery precondition when discovery disappears during selection', async () => {
        const discovery = {
            captureSelectedServerSnapshot: jest.fn(() => ({
                server: null,
                connection: null,
                storedServerId: null,
            })),
            selectServer: jest.fn(),
        } as unknown as IPlexServerDiscovery;
        const getPlexDiscovery = jest
            .fn<IPlexServerDiscovery | null, []>()
            .mockReturnValueOnce(discovery)
            .mockReturnValue(null);
        const runtime = new OrchestratorServerSelectionRuntime({
            assertNotShutdown: jest.fn(),
            getPlexAuth: jest.fn(() => null),
            getPlexDiscovery,
            getInitializationCoordinator: jest.fn(() => null),
            getEpg: jest.fn(() => null),
            getEpgCoordinator: jest.fn(() => null),
            isReady: jest.fn(() => false),
            reportError: jest.fn(),
            throwModuleInitPreconditionError: (message, context): never => {
                throw Object.assign(new Error(message), {
                    code: AppErrorCode.MODULE_INIT_FAILED,
                    recoverable: true,
                    context,
                });
            },
        });

        await expect(runtime.selectServer('server-1')).rejects.toMatchObject({
            code: AppErrorCode.MODULE_INIT_FAILED,
            recoverable: true,
            message: expect.stringContaining('PlexServerDiscovery not initialized'),
            context: expect.objectContaining({
                method: 'selectServer',
                dependency: 'PlexServerDiscovery',
            }),
        });
        expect(discovery.selectServer).not.toHaveBeenCalled();
    });
});
