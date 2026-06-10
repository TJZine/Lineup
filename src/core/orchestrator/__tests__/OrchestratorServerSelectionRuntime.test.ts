import type { InitializationCoordinator } from '../../initialization/InitializationCoordinator';
import { STARTUP_PHASE } from '../../initialization/InitializationCoordinator';
import type { IPlexAuth, PlexAuthData, PlexAuthToken } from '../../../modules/plex/auth';
import type { IPlexServerDiscovery } from '../../../modules/plex/discovery';
import type { EPGCoordinator, IEPGComponent } from '../../../modules/ui/epg';
import { AppErrorCode } from '../../../types/app-errors';
import {
    OrchestratorServerSelectionRuntime,
    type OrchestratorServerSelectionRuntimeDeps,
} from '../runtime/OrchestratorServerSelectionRuntime';

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
    clearServerResume: jest.fn(),
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

        expect(initCoordinator.runStartup).toHaveBeenCalledWith(
            STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION,
            undefined
        );
        expect(epg.clearSchedules).not.toHaveBeenCalled();
    });

    it('passes caller discovery options through to Plex discovery selection', async () => {
        const plexDiscovery = createPlexDiscovery();
        const initCoordinator = createInitializationCoordinator();
        const deps = createDeps({
            getPlexDiscovery: jest.fn(() => plexDiscovery),
            getInitializationCoordinator: jest.fn(() => initCoordinator),
        });
        const runtime = new OrchestratorServerSelectionRuntime(deps);
        const options = { signal: new AbortController().signal };

        await expect(runtime.selectServer('server-1', options)).resolves.toEqual({
            kind: 'selected',
            readiness: 'startup_pending',
            persistedSelection: 'updated',
            startupResume: {
                startup: 'completed',
                epgRefresh: { kind: 'skipped_no_coordinator' },
            },
        });

        expect(plexDiscovery.selectServer).toHaveBeenCalledWith('server-1', options);
        expect(initCoordinator.runStartup).toHaveBeenCalledWith(
            STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION,
            options
        );
    });

    it('clears pending server resume listeners before mutating discovery selection', async () => {
        const plexDiscovery = createPlexDiscovery();
        const initCoordinator = createInitializationCoordinator();
        const deps = createDeps({
            getPlexDiscovery: jest.fn(() => plexDiscovery),
            getInitializationCoordinator: jest.fn(() => initCoordinator),
        });
        const runtime = new OrchestratorServerSelectionRuntime(deps);

        await expect(runtime.selectServer('server-1')).resolves.toMatchObject({ kind: 'selected' });

        expect(initCoordinator.clearServerResume).toHaveBeenCalledTimes(1);
        expect(plexDiscovery.selectServer).toHaveBeenCalledTimes(1);
        expect(initCoordinator.clearServerResume.mock.invocationCallOrder[0]).toBeLessThan(
            plexDiscovery.selectServer.mock.invocationCallOrder[0] as number
        );
    });

    it('skips selected-server startup resume when the initialization coordinator is unavailable', async () => {
        const plexDiscovery = createPlexDiscovery();
        const initCoordinator = createInitializationCoordinator();
        const deps = createDeps({
            getPlexDiscovery: jest.fn(() => plexDiscovery),
            getInitializationCoordinator: jest.fn(() => null),
        });
        const runtime = new OrchestratorServerSelectionRuntime(deps);

        await expect(runtime.selectServer('server-1')).resolves.toEqual({
            kind: 'selected',
            readiness: 'startup_pending',
            persistedSelection: 'updated',
            startupResume: {
                startup: 'skipped_no_coordinator',
                epgRefresh: { kind: 'skipped_no_coordinator' },
            },
        });

        expect(deps.getInitializationCoordinator).toHaveBeenCalled();
        expect(initCoordinator.runStartup).not.toHaveBeenCalled();
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

    it('stops server-swap EPG mutations when the caller aborts after startup resumes', async () => {
        const abortReason = new DOMException('server selection hidden', 'AbortError');
        const controller = new AbortController();
        const plexAuth = createPlexAuth();
        const plexDiscovery = createPlexDiscovery();
        const initCoordinator = createInitializationCoordinator();
        initCoordinator.runStartup.mockImplementation(async () => {
            controller.abort(abortReason);
        });
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
            getPlexAuth: jest.fn(() => plexAuth),
            getPlexDiscovery: jest.fn(() => plexDiscovery),
            getInitializationCoordinator: jest.fn(() => initCoordinator),
            getEpg: jest.fn(() => epg),
            getEpgCoordinator: jest.fn(() => epgCoordinator),
        });
        const runtime = new OrchestratorServerSelectionRuntime(deps);

        await expect(
            runtime.selectServer('server-1', { signal: controller.signal })
        ).rejects.toBe(abortReason);

        expect(initCoordinator.runStartup).toHaveBeenCalledWith(
            STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION,
            { signal: controller.signal }
        );
        expect(epgCoordinator.clearSelectedChannelScheduleSnapshot).not.toHaveBeenCalled();
        expect(epgCoordinator.clearScheduleCaches).not.toHaveBeenCalled();
        expect(epg.clearSchedules).not.toHaveBeenCalled();
        expect(epgCoordinator.primeEpgChannels).not.toHaveBeenCalled();
        expect(epgCoordinator.refreshEpgSchedules).not.toHaveBeenCalled();
        expect(plexDiscovery.restoreSelectedServerSnapshot).toHaveBeenCalledWith({
            server: null,
            connection: null,
            storedServerId: 'old-server',
        });
        expect(plexAuth.storeCredentials).toHaveBeenCalledTimes(2);
        expect(plexAuth.storeCredentials).toHaveBeenLastCalledWith(createCredentials());
        expect(deps.reportError).not.toHaveBeenCalled();
    });

    it('aborts pending server-swap EPG refresh without reporting rollback as a runtime failure', async () => {
        const abortReason = new DOMException('server selection hidden', 'AbortError');
        const controller = new AbortController();
        const plexAuth = createPlexAuth();
        const plexDiscovery = createPlexDiscovery();
        const initCoordinator = createInitializationCoordinator();
        let releaseRefresh: (() => void) | null = null;
        let capturedRefreshSignal: AbortSignal | null | undefined;
        let markRefreshStarted: (() => void) | null = null;
        const refreshStarted = new Promise<void>((resolve) => {
            markRefreshStarted = resolve;
        });
        const epg = {
            clearSchedules: jest.fn(),
        } as unknown as jest.Mocked<IEPGComponent>;
        const epgCoordinator = {
            clearSelectedChannelScheduleSnapshot: jest.fn(),
            clearScheduleCaches: jest.fn(),
            primeEpgChannels: jest.fn(),
            refreshEpgSchedules: jest.fn((options?: { signal?: AbortSignal | null }) => {
                capturedRefreshSignal = options?.signal;
                markRefreshStarted?.();
                return new Promise<void>((_resolve, reject) => {
                    releaseRefresh = (): void => reject(abortReason);
                    options?.signal?.addEventListener('abort', () => reject(abortReason), { once: true });
                });
            }),
        } as unknown as jest.Mocked<EPGCoordinator>;
        const deps = createDeps({
            getPlexAuth: jest.fn(() => plexAuth),
            getPlexDiscovery: jest.fn(() => plexDiscovery),
            getInitializationCoordinator: jest.fn(() => initCoordinator),
            getEpg: jest.fn(() => epg),
            getEpgCoordinator: jest.fn(() => epgCoordinator),
        });
        const runtime = new OrchestratorServerSelectionRuntime(deps);

        const selection = runtime.selectServer('server-1', { signal: controller.signal });
        await refreshStarted;

        expect(capturedRefreshSignal).toBe(controller.signal);
        controller.abort(abortReason);
        (releaseRefresh as unknown as () => void)();

        await expect(selection).rejects.toBe(abortReason);
        expect(epgCoordinator.refreshEpgSchedules).toHaveBeenCalledWith({
            reason: 'server-swap',
            signal: controller.signal,
        });
        expect(plexDiscovery.restoreSelectedServerSnapshot).toHaveBeenCalledWith({
            server: null,
            connection: null,
            storedServerId: 'old-server',
        });
        expect(plexAuth.storeCredentials).toHaveBeenLastCalledWith(createCredentials());
        expect(epgCoordinator.clearSelectedChannelScheduleSnapshot).toHaveBeenCalledTimes(2);
        expect(epgCoordinator.clearScheduleCaches).toHaveBeenCalledTimes(2);
        expect(epg.clearSchedules).toHaveBeenCalledTimes(2);
        expect(epgCoordinator.primeEpgChannels).toHaveBeenCalledTimes(1);
        expect(
            plexDiscovery.restoreSelectedServerSnapshot.mock.invocationCallOrder[0]
        ).toBeLessThan(
            epgCoordinator.clearSelectedChannelScheduleSnapshot.mock.invocationCallOrder[1] as number
        );
        expect(deps.reportError).not.toHaveBeenCalled();
    });

    it('returns failed EPG refresh status after clearing server-scoped schedule state', async () => {
        const plexDiscovery = createPlexDiscovery();
        const initCoordinator = createInitializationCoordinator();
        const refreshError = new Error('refresh failed');
        const epg = {
            clearSchedules: jest.fn(),
        } as unknown as jest.Mocked<IEPGComponent>;
        const epgCoordinator = {
            clearSelectedChannelScheduleSnapshot: jest.fn(),
            clearScheduleCaches: jest.fn(),
            primeEpgChannels: jest.fn(),
            refreshEpgSchedules: jest.fn().mockRejectedValue(refreshError),
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
                epgRefresh: { kind: 'failed', error: refreshError },
            },
        });

        expect(initCoordinator.runStartup).toHaveBeenCalledWith(
            STARTUP_PHASE.RESUME_AFTER_SERVER_SELECTION,
            undefined
        );
        expect(epgCoordinator.clearSelectedChannelScheduleSnapshot).toHaveBeenCalledTimes(1);
        expect(epgCoordinator.clearScheduleCaches).toHaveBeenCalledTimes(1);
        expect(epg.clearSchedules).toHaveBeenCalledTimes(1);
        expect(epgCoordinator.primeEpgChannels).toHaveBeenCalledTimes(1);
        expect(epgCoordinator.refreshEpgSchedules).toHaveBeenCalledWith({ reason: 'server-swap' });
        expect(deps.reportError).toHaveBeenCalledWith(
            'orchestrator.serverSwap.refreshEpgSchedules',
            'Post-selection EPG refresh failed',
            refreshError,
            { step: 'refreshEpgSchedules' }
        );
    });

    it('reports a captured non-abort EPG refresh failure even when caller aborts before classification', async () => {
        const abortReason = new DOMException('server selection hidden', 'AbortError');
        const controller = new AbortController();
        const plexAuth = createPlexAuth();
        const plexDiscovery = createPlexDiscovery();
        const initCoordinator = createInitializationCoordinator();
        const refreshError = new Error('refresh failed before abort classification');
        const epg = {
            clearSchedules: jest.fn(),
        } as unknown as jest.Mocked<IEPGComponent>;
        const epgCoordinator = {
            clearSelectedChannelScheduleSnapshot: jest.fn(),
            clearScheduleCaches: jest.fn(),
            primeEpgChannels: jest.fn(),
            refreshEpgSchedules: jest.fn(async () => {
                controller.abort(abortReason);
                throw refreshError;
            }),
        } as unknown as jest.Mocked<EPGCoordinator>;
        const deps = createDeps({
            getPlexAuth: jest.fn(() => plexAuth),
            getPlexDiscovery: jest.fn(() => plexDiscovery),
            getInitializationCoordinator: jest.fn(() => initCoordinator),
            getEpg: jest.fn(() => epg),
            getEpgCoordinator: jest.fn(() => epgCoordinator),
        });
        const runtime = new OrchestratorServerSelectionRuntime(deps);

        await expect(runtime.selectServer('server-1', { signal: controller.signal })).resolves.toEqual({
            kind: 'selected',
            readiness: 'startup_pending',
            persistedSelection: 'updated',
            startupResume: {
                startup: 'completed',
                epgRefresh: { kind: 'failed', error: refreshError },
            },
        });

        expect(plexDiscovery.restoreSelectedServerSnapshot).not.toHaveBeenCalled();
        expect(plexAuth.storeCredentials).toHaveBeenCalledTimes(1);
        expect(deps.reportError).toHaveBeenCalledWith(
            'orchestrator.serverSwap.refreshEpgSchedules',
            'Post-selection EPG refresh failed',
            refreshError,
            { step: 'refreshEpgSchedules' }
        );
    });

    it('reports internal abort-like EPG refresh failures that race with caller cancellation', async () => {
        const abortReason = new DOMException('server selection hidden', 'AbortError');
        const controller = new AbortController();
        const plexAuth = createPlexAuth();
        const plexDiscovery = createPlexDiscovery();
        const initCoordinator = createInitializationCoordinator();
        const refreshError = new DOMException('internal EPG refresh abort', 'AbortError');
        const epg = {
            clearSchedules: jest.fn(),
        } as unknown as jest.Mocked<IEPGComponent>;
        const epgCoordinator = {
            clearSelectedChannelScheduleSnapshot: jest.fn(),
            clearScheduleCaches: jest.fn(),
            primeEpgChannels: jest.fn(),
            refreshEpgSchedules: jest.fn(async () => {
                controller.abort(abortReason);
                throw refreshError;
            }),
        } as unknown as jest.Mocked<EPGCoordinator>;
        const deps = createDeps({
            getPlexAuth: jest.fn(() => plexAuth),
            getPlexDiscovery: jest.fn(() => plexDiscovery),
            getInitializationCoordinator: jest.fn(() => initCoordinator),
            getEpg: jest.fn(() => epg),
            getEpgCoordinator: jest.fn(() => epgCoordinator),
        });
        const runtime = new OrchestratorServerSelectionRuntime(deps);

        await expect(runtime.selectServer('server-1', { signal: controller.signal })).resolves.toEqual({
            kind: 'selected',
            readiness: 'startup_pending',
            persistedSelection: 'updated',
            startupResume: {
                startup: 'completed',
                epgRefresh: { kind: 'failed', error: refreshError },
            },
        });

        expect(plexDiscovery.restoreSelectedServerSnapshot).not.toHaveBeenCalled();
        expect(plexAuth.storeCredentials).toHaveBeenCalledTimes(1);
        expect(deps.reportError).toHaveBeenCalledWith(
            'orchestrator.serverSwap.refreshEpgSchedules',
            'Post-selection EPG refresh failed',
            refreshError,
            { step: 'refreshEpgSchedules' }
        );
    });

    it('reports startup abort-like failures when no caller signal requested cancellation', async () => {
        const plexDiscovery = createPlexDiscovery();
        const initCoordinator = createInitializationCoordinator();
        const abortError = new DOMException('internal startup abort', 'AbortError');
        initCoordinator.runStartup.mockRejectedValue(abortError);
        const deps = createDeps({
            getPlexDiscovery: jest.fn(() => plexDiscovery),
            getInitializationCoordinator: jest.fn(() => initCoordinator),
        });
        const runtime = new OrchestratorServerSelectionRuntime(deps);

        await expect(runtime.selectServer('server-1')).rejects.toBe(abortError);

        expect(deps.reportError).toHaveBeenCalledWith(
            'orchestrator.serverSwap.runStartup',
            'Post-selection runtime swap failed',
            abortError,
            { step: 'runStartup' }
        );
    });

    it('reports non-abort startup failures that race with caller cancellation', async () => {
        const controller = new AbortController();
        const plexDiscovery = createPlexDiscovery();
        const initCoordinator = createInitializationCoordinator();
        const startupError = new Error('startup failed after abort');
        initCoordinator.runStartup.mockImplementation(async () => {
            controller.abort(new DOMException('server selection hidden', 'AbortError'));
            throw startupError;
        });
        const deps = createDeps({
            getPlexDiscovery: jest.fn(() => plexDiscovery),
            getInitializationCoordinator: jest.fn(() => initCoordinator),
        });
        const runtime = new OrchestratorServerSelectionRuntime(deps);

        await expect(runtime.selectServer('server-1', { signal: controller.signal })).rejects.toBe(startupError);

        expect(deps.reportError).toHaveBeenCalledWith(
            'orchestrator.serverSwap.runStartup',
            'Post-selection runtime swap failed',
            startupError,
            { step: 'runStartup' }
        );
    });

    it('reports internal abort-like startup failures that race with caller cancellation', async () => {
        const controller = new AbortController();
        const plexDiscovery = createPlexDiscovery();
        const initCoordinator = createInitializationCoordinator();
        const startupError = new DOMException('internal startup abort after caller abort', 'AbortError');
        initCoordinator.runStartup.mockImplementation(async () => {
            controller.abort(new DOMException('server selection hidden', 'AbortError'));
            throw startupError;
        });
        const deps = createDeps({
            getPlexDiscovery: jest.fn(() => plexDiscovery),
            getInitializationCoordinator: jest.fn(() => initCoordinator),
        });
        const runtime = new OrchestratorServerSelectionRuntime(deps);

        await expect(runtime.selectServer('server-1', { signal: controller.signal })).rejects.toBe(startupError);

        expect(deps.reportError).toHaveBeenCalledWith(
            'orchestrator.serverSwap.runStartup',
            'Post-selection runtime swap failed',
            startupError,
            { step: 'runStartup' }
        );
    });
});
