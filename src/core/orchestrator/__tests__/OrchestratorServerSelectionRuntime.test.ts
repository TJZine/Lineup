import type { InitializationCoordinator } from '../../initialization/InitializationCoordinator';
import { STARTUP_PHASE } from '../../initialization/InitializationCoordinator';
import type { IPlexAuth, PlexAuthData, PlexAuthToken } from '../../../modules/plex/auth';
import type { IPlexServerDiscovery } from '../../../modules/plex/discovery';
import type { EPGCoordinator, IEPGComponent } from '../../../modules/ui/epg';
import { AppErrorCode } from '../../../types/app-errors';
import {
    OrchestratorServerSelectionRuntime,
    type OrchestratorServerSelectionRuntimeDeps,
} from '../OrchestratorServerSelectionRuntime';

const createToken = (userId: string): PlexAuthToken => ({
    token: `${userId}-token`,
    userId,
    username: userId,
    email: `${userId}@example.test`,
    thumb: '',
    expiresAt: null,
    issuedAt: new Date('2026-04-30T00:00:00.000Z'),
});

const createCredentials = (): PlexAuthData => ({
    accountToken: createToken('account-user'),
    activeToken: createToken('user-1'),
    activeUserId: 'user-1',
    selectedServerByUserId: {
        'user-1': { serverId: 'old-server', serverUri: 'http://old.example' },
    },
    deviceKey: null,
});

const createPlexAuth = (): jest.Mocked<IPlexAuth> => ({
    getActiveUserId: jest.fn(() => 'user-1'),
    readStoredCredentialsAndClearCorruption: jest.fn(() => ({
        kind: 'available',
        credentials: createCredentials(),
    })),
    storeCredentials: jest.fn(),
} as unknown as jest.Mocked<IPlexAuth>);

const createPlexDiscovery = (): jest.Mocked<IPlexServerDiscovery> => ({
    selectServer: jest.fn().mockResolvedValue({ kind: 'selected' }),
    getServerUri: jest.fn(() => 'http://next.example'),
    clearSelection: jest.fn(),
    captureSelectedServerSnapshot: jest.fn(() => ({
        server: null,
        connection: null,
        storedServerId: 'old-server',
    })),
    restoreSelectedServerSnapshot: jest.fn(),
    getSelectedServer: jest.fn(() => null),
} as unknown as jest.Mocked<IPlexServerDiscovery>);

const createInitializationCoordinator = (): jest.Mocked<InitializationCoordinator> => ({
    runStartup: jest.fn().mockResolvedValue(undefined),
} as unknown as jest.Mocked<InitializationCoordinator>);

const createDeps = (
    overrides: Partial<OrchestratorServerSelectionRuntimeDeps> = {}
): jest.Mocked<OrchestratorServerSelectionRuntimeDeps> => ({
    assertNotShutdown: jest.fn(),
    getPlexAuth: jest.fn(() => createPlexAuth()),
    getPlexDiscovery: jest.fn(() => createPlexDiscovery()),
    getInitializationCoordinator: jest.fn(() => createInitializationCoordinator()),
    getEpg: jest.fn(() => null),
    getEpgCoordinator: jest.fn(() => null),
    isReady: jest.fn(() => false),
    reportError: jest.fn(),
    throwModuleInitPreconditionError: jest.fn((message: string) => {
        throw new Error(message);
    }),
    ...overrides,
} as jest.Mocked<OrchestratorServerSelectionRuntimeDeps>);

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
        const runtime = new OrchestratorServerSelectionRuntime(createDeps({
            getPlexAuth: jest.fn(() => null),
            getPlexDiscovery,
            getInitializationCoordinator: jest.fn(() => null),
            throwModuleInitPreconditionError: (message, context): never => {
                throw Object.assign(new Error(message), {
                    code: AppErrorCode.MODULE_INIT_FAILED,
                    recoverable: true,
                    context,
                });
            },
        }));

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

    it('propagates a clear-selected-server failure when discovery disappears before runtime cleanup', async () => {
        const plexDiscovery = createPlexDiscovery();
        const preconditionError = new Error('IPlexServerDiscovery not initialized while clearing selected server');
        const deps = createDeps({
            getPlexDiscovery: jest.fn()
                .mockReturnValueOnce(plexDiscovery)
                .mockReturnValueOnce(null),
            throwModuleInitPreconditionError: jest.fn(() => {
                throw preconditionError;
            }),
        });
        const runtime = new OrchestratorServerSelectionRuntime(deps);

        await expect(runtime.clearSelectedServer()).rejects.toBe(preconditionError);

        expect(plexDiscovery.clearSelection).not.toHaveBeenCalled();
        expect(deps.throwModuleInitPreconditionError).toHaveBeenCalledWith(
            'IPlexServerDiscovery not initialized while clearing selected server',
            {
                method: 'clearSelectedServer',
                dependency: 'IPlexServerDiscovery',
            }
        );
    });

    it('skips EPG mutations when selected-server startup resumes without an EPG coordinator', async () => {
        const plexDiscovery = createPlexDiscovery();
        const initCoordinator = createInitializationCoordinator();
        const epg = {
            clearSchedules: jest.fn(),
        } as unknown as jest.Mocked<IEPGComponent>;
        const deps = createDeps({
            getPlexDiscovery: jest.fn(() => plexDiscovery),
            getInitializationCoordinator: jest.fn(() => initCoordinator),
            getEpg: jest.fn(() => epg),
            getEpgCoordinator: jest.fn(() => null),
        });
        const runtime = new OrchestratorServerSelectionRuntime(deps);

        await expect(runtime.selectServer('server-1')).resolves.toEqual({
            kind: 'selected',
            readiness: 'startup_pending',
            persistedSelection: 'updated',
            startupResume: {
                startup: 'completed',
                epgRefresh: { kind: 'skipped_no_coordinator' },
            },
        });

        expect(initCoordinator.runStartup).toHaveBeenCalledWith(STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION);
        expect(epg.clearSchedules).not.toHaveBeenCalled();
    });

    it('clears and refreshes EPG state through the coordinator when it exists', async () => {
        const plexDiscovery = createPlexDiscovery();
        const initCoordinator = createInitializationCoordinator();
        const epg = {
            clearSchedules: jest.fn(),
        } as unknown as jest.Mocked<IEPGComponent>;
        const epgCoordinator = {
            clearSelectedChannelScheduleSnapshot: jest.fn(),
            clearScheduleCaches: jest.fn(),
            primeEpgChannels: jest.fn(),
            refreshEpgSchedules: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<EPGCoordinator>;
        const deps = createDeps({
            getPlexDiscovery: jest.fn(() => plexDiscovery),
            getInitializationCoordinator: jest.fn(() => initCoordinator),
            getEpg: jest.fn(() => epg),
            getEpgCoordinator: jest.fn(() => epgCoordinator),
        });
        const runtime = new OrchestratorServerSelectionRuntime(deps);

        await expect(runtime.selectServer('server-1')).resolves.toEqual({
            kind: 'selected',
            readiness: 'startup_pending',
            persistedSelection: 'updated',
            startupResume: {
                startup: 'completed',
                epgRefresh: { kind: 'succeeded' },
            },
        });

        expect(epgCoordinator.clearSelectedChannelScheduleSnapshot).toHaveBeenCalledTimes(1);
        expect(epgCoordinator.clearScheduleCaches).toHaveBeenCalledTimes(1);
        expect(epg.clearSchedules).toHaveBeenCalledTimes(1);
        expect(epgCoordinator.primeEpgChannels).toHaveBeenCalledTimes(1);
        expect(epgCoordinator.refreshEpgSchedules).toHaveBeenCalledWith({ reason: 'server-swap' });
    });
});
