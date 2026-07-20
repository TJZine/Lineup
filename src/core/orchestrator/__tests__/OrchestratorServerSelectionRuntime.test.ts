import type { InitializationCoordinator } from '../../initialization/InitializationCoordinator';
import { InitializationStartupHandoff } from '../../initialization/InitializationStartupHandoff';
import type { IPlexAuth, PlexAuthData, PlexAuthToken } from '../../../modules/plex/auth';
import type { IPlexServerDiscovery } from '../../../modules/plex/discovery';
import { PlexDiscoverySelectionContext } from '../../../modules/plex/discovery/PlexDiscoverySelectionContext';
import type { EPGCoordinator, IEPGComponent } from '../../../modules/ui/epg';
import { ChannelInitialTuneAuthority } from '../../channel-tuning/ChannelInitialTuneAuthority';
import {
    OrchestratorServerSelectionRuntime,
    type OrchestratorServerSelectionRuntimeDeps,
} from '../runtime/OrchestratorServerSelectionRuntime';

const READY_EPG_REFRESH = {
    readiness: 'ready' as const,
    attemptedChannelCount: 2,
    immediateReadyChannelCount: 2,
    backgroundQueuedChannelCount: 0,
    failedChannelCount: 0,
    staleCacheChannelCount: 0,
    firstVisibleScheduleReady: true,
};

const createToken = (userId: string): PlexAuthToken => ({
    token: `${userId}-token`,
    userId,
    username: userId,
    email: `${userId}@example.test`,
    thumb: '',
    expiresAt: null,
    issuedAt: new Date(0),
});

function createPlexAuth(): jest.Mocked<IPlexAuth> {
    let credentials: PlexAuthData = {
        accountToken: createToken('account-user'),
        activeToken: createToken('user-1'),
        activeUserId: 'user-1',
        selectedServerByUserId: {
            'user-1': { serverId: 'old-server', serverUri: 'https://old.example' },
        },
        deviceKey: null,
    };
    const guard = { signal: new AbortController().signal, assertCurrent: jest.fn() };
    return {
        getActiveUserId: jest.fn(() => 'user-1'),
        readStoredCredentialsAndClearCorruption: jest.fn(() => ({ kind: 'available', credentials })),
        storeCredentials: jest.fn((next) => { credentials = next; }),
        validateStoredCredentials: jest.fn().mockResolvedValue({ kind: 'active_valid', guard }),
    } as unknown as jest.Mocked<IPlexAuth>;
}

function createDiscovery(): jest.Mocked<IPlexServerDiscovery> {
    const context = new PlexDiscoverySelectionContext();
    let selectedId: string | null = 'old-server';
    let selectedUri = 'https://old.example';
    const discovery = {
        selectServer: jest.fn(async (serverId: string) => {
            context.advance();
            selectedId = serverId;
            selectedUri = 'https://candidate.example';
            return { kind: 'selected' as const, receipt: context.issueReceipt(context.capture(), 'selected') };
        }),
        getServerUri: jest.fn(() => selectedUri),
        isConnected: jest.fn(() => selectedId !== null),
        getSelectedConnection: jest.fn(() => selectedId ? { uri: selectedUri } : null),
        clearSelection: jest.fn(() => { selectedId = null; }),
        captureSelectedServerSnapshot: jest.fn(() => ({
            server: selectedId ? { id: selectedId } : null,
            connection: selectedId ? { uri: selectedUri } : null,
            storedServerId: selectedId,
        })),
        restoreSelectedServerSnapshot: jest.fn((snapshot) => {
            context.advance();
            selectedId = snapshot.server?.id ?? null;
            selectedUri = snapshot.connection?.uri ?? '';
            return context.issueReceipt(context.capture(), snapshot.server ? 'selected' : 'unselected');
        }),
        getSelectionReceiptSignal: jest.fn((receipt) => context.getReceiptSignal(receipt)),
        assertSelectionReceiptCurrent: jest.fn((receipt) => context.assertReceiptCurrent(receipt)),
        getSelectedServer: jest.fn(() => selectedId ? { id: selectedId } : null),
    } as unknown as jest.Mocked<IPlexServerDiscovery>;
    return discovery;
}

interface RuntimeHarness {
    deps: jest.Mocked<OrchestratorServerSelectionRuntimeDeps>;
    plexAuth: jest.Mocked<IPlexAuth>;
    discovery: jest.Mocked<IPlexServerDiscovery>;
    epg: IEPGComponent;
    epgCoordinator: jest.Mocked<EPGCoordinator>;
    initialization: jest.Mocked<InitializationCoordinator>;
    epgOutcome: { kind: 'succeeded'; result: typeof READY_EPG_REFRESH };
}

function createHarness(): RuntimeHarness {
    const plexAuth = createPlexAuth();
    const discovery = createDiscovery();
    const tuning = new ChannelInitialTuneAuthority();
    const epg = { clearSchedules: jest.fn() } as unknown as IEPGComponent;
    const epgCoordinator = {
        clearSelectedChannelScheduleSnapshot: jest.fn(),
        clearScheduleCaches: jest.fn(),
        primeEpgChannels: jest.fn(),
        refreshEpgSchedules: jest.fn().mockResolvedValue(READY_EPG_REFRESH),
    } as unknown as jest.Mocked<EPGCoordinator>;
    const epgOutcome = { kind: 'succeeded' as const, result: READY_EPG_REFRESH };
    const startupHandoff = new InitializationStartupHandoff();
    const initialization = {
        beginSelectedServerLineage: jest.fn(() => startupHandoff.beginSelectedServerLineage()),
        getSupersedingStartupHandoff: jest.fn((lineage) =>
            startupHandoff.getSupersedingStartupHandoff(lineage)),
        releaseSelectedServerLineage: jest.fn((lineage) =>
            startupHandoff.releaseSelectedServerLineage(lineage)),
        runSelectedServerTransaction: jest.fn(async (request) => {
            const raw = await request.beforeCommit({
                signal: request.signal,
                assertCurrent: request.assertCurrent,
            });
            expect(raw).toBe(READY_EPG_REFRESH);
            await request.initialTune('channel-1', request.lineage);
            return { kind: 'completed' as const, payload: { epgRefresh: epgOutcome } };
        }),
    } as unknown as jest.Mocked<InitializationCoordinator>;
    const deps: jest.Mocked<OrchestratorServerSelectionRuntimeDeps> = {
        assertNotShutdown: jest.fn(),
        getPlexAuth: jest.fn(() => plexAuth),
        getPlexDiscovery: jest.fn(() => discovery),
        getInitializationCoordinator: jest.fn(() => initialization),
        getEpg: jest.fn(() => epg),
        getEpgCoordinator: jest.fn(() => epgCoordinator),
        suspendAndDrainForScopeTransition: jest.fn().mockResolvedValue(undefined),
        resumeAfterScopeTransition: jest.fn(),
        beginInitialTuneLineage: jest.fn((validators) => tuning.beginLineage(validators)),
        mintInitialTunePermit: jest.fn((lineage) => tuning.mintPermit(lineage)),
        completeInitialTuneLineage: jest.fn((lineage) => tuning.completeLineage(lineage)),
        switchToInitialChannel: jest.fn().mockResolvedValue({ kind: 'switched' }),
        clearIdentityScopedRuntime: jest.fn(),
        prepareQuarantineRuntime: jest.fn().mockResolvedValue(undefined),
        releaseQuarantineRuntimeGate: jest.fn(),
        configureChannelManagerStorage: jest.fn().mockResolvedValue(undefined),
        publishPendingServerModules: jest.fn(),
        setReady: jest.fn(),
        publishLoadingLifecycle: jest.fn().mockResolvedValue(undefined),
        openServerSelect: jest.fn(),
        exitApplication: jest.fn().mockResolvedValue(undefined),
        throwModuleInitPreconditionError: jest.fn((
            message: string,
            _context: Record<string, unknown>
        ) => { throw new Error(message); }),
    };
    return { deps, plexAuth, discovery, epg, epgCoordinator, initialization, epgOutcome };
}

describe('OrchestratorServerSelectionRuntime', () => {
    it('reports a selected id only with an active selected connection', () => {
        const harness = createHarness();
        const runtime = new OrchestratorServerSelectionRuntime(harness.deps);
        expect(runtime.getSelectedServerId()).toBe('old-server');
        harness.discovery.getSelectedConnection.mockReturnValue(null);
        expect(runtime.getSelectedServerId()).toBeNull();
    });

    it('wires strict selection, initialization-owned EPG mapping, and initial tune authority', async () => {
        const harness = createHarness();
        const runtime = new OrchestratorServerSelectionRuntime(harness.deps);

        const result = await runtime.selectServer('candidate');

        expect(result).toEqual({
            kind: 'selected',
            persistedSelection: 'updated',
            epgRefresh: harness.epgOutcome,
        });
        expect(harness.epgCoordinator.clearSelectedChannelScheduleSnapshot).toHaveBeenCalledTimes(1);
        expect(harness.epgCoordinator.clearScheduleCaches).toHaveBeenCalledTimes(1);
        expect(harness.epg.clearSchedules).toHaveBeenCalledTimes(1);
        expect(harness.epgCoordinator.primeEpgChannels).toHaveBeenCalledTimes(1);
        expect(harness.epgCoordinator.refreshEpgSchedules).toHaveBeenCalledWith(expect.objectContaining({
            reason: 'server-swap',
            operationContext: expect.any(Object),
        }));
        expect(harness.deps.mintInitialTunePermit).toHaveBeenCalledTimes(1);
        expect(harness.deps.switchToInitialChannel).toHaveBeenCalledWith('channel-1', expect.any(Object));
    });

    it('clears persisted selection before discovery selection', async () => {
        const harness = createHarness();
        const runtime = new OrchestratorServerSelectionRuntime(harness.deps);

        await runtime.clearSelectedServer();

        expect(harness.plexAuth.storeCredentials).toHaveBeenCalledWith(
            expect.objectContaining({
                selectedServerByUserId: expect.objectContaining({
                    'user-1': { serverId: null, serverUri: null },
                }),
            }),
            { emitAuthChange: false }
        );
        expect(harness.discovery.clearSelection).toHaveBeenCalledTimes(1);
        expect(harness.deps.suspendAndDrainForScopeTransition).toHaveBeenCalledTimes(1);
        expect(harness.deps.clearIdentityScopedRuntime).toHaveBeenCalledTimes(1);
        expect(harness.deps.configureChannelManagerStorage).toHaveBeenCalledTimes(1);
        expect(harness.deps.publishPendingServerModules).toHaveBeenCalledTimes(1);
        expect(harness.deps.setReady).toHaveBeenCalledWith(false);
        expect(harness.deps.publishLoadingLifecycle).toHaveBeenCalledTimes(1);
        expect(harness.deps.openServerSelect).toHaveBeenCalledTimes(1);
        expect(harness.deps.resumeAfterScopeTransition).toHaveBeenCalledTimes(1);
    });

    it('completes clear then selects another server through the public runtime seam', async () => {
        const harness = createHarness();
        const runtime = new OrchestratorServerSelectionRuntime(harness.deps);

        await runtime.clearSelectedServer();
        const result = await runtime.selectServer('candidate');

        expect(result).toEqual({
            kind: 'selected',
            persistedSelection: 'updated',
            epgRefresh: harness.epgOutcome,
        });
        expect(harness.discovery.clearSelection).toHaveBeenCalledTimes(1);
        expect(harness.discovery.selectServer).toHaveBeenCalledWith(
            'candidate',
            expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
        expect(harness.deps.publishLoadingLifecycle).toHaveBeenCalledTimes(1);
        expect(harness.deps.resumeAfterScopeTransition).toHaveBeenCalledTimes(2);
        expect(runtime.getQuarantineState()).toEqual({ kind: 'clear' });
    });

    it('restores the coherent unselected runtime after post-clear selection failure', async () => {
        const harness = createHarness();
        const runtime = new OrchestratorServerSelectionRuntime(harness.deps);
        const selectionError = new Error('candidate initialization failed');

        await runtime.clearSelectedServer();
        harness.initialization.runSelectedServerTransaction.mockResolvedValueOnce({
            kind: 'failed',
            error: selectionError,
        });

        await expect(runtime.selectServer('candidate')).rejects.toBe(selectionError);

        expect(runtime.getSelectedServerId()).toBeNull();
        expect(runtime.getQuarantineState()).toEqual({ kind: 'clear' });
        expect(harness.deps.clearIdentityScopedRuntime).toHaveBeenCalledTimes(2);
        expect(harness.deps.publishPendingServerModules).toHaveBeenCalledTimes(2);
        expect(harness.deps.setReady).toHaveBeenLastCalledWith(false);
        expect(harness.deps.publishLoadingLifecycle).toHaveBeenCalledTimes(2);
        expect(harness.deps.openServerSelect).toHaveBeenCalledTimes(2);
    });
});
