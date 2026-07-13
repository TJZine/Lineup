import type {
    PlexDiscoverySelectedServerSnapshot,
    PlexDiscoverySelectionReceipt,
} from '../../../modules/plex/discovery';
import { PlexDiscoverySelectionContext } from '../../../modules/plex/discovery/PlexDiscoverySelectionContext';
import { ChannelInitialTuneAuthority } from '../../channel-tuning/ChannelInitialTuneAuthority';
import type { SelectedServerInitializationResult } from '../../initialization/InitializationSelectedServerTransaction';
import { InitializationStartupHandoff } from '../../initialization/InitializationStartupHandoff';
import { ServerSelectionCoordinator, type ServerSelectionCoordinatorDeps } from '../ServerSelectionCoordinator';
import type { SelectedServerPersistenceEvidence } from '../SelectedServerPersistenceAdapter';

const READY_REFRESH = {
    readiness: 'ready' as const,
    attemptedChannelCount: 1,
    immediateReadyChannelCount: 1,
    backgroundQueuedChannelCount: 0,
    failedChannelCount: 0,
    staleCacheChannelCount: 0,
    firstVisibleScheduleReady: true,
};
const COMPLETED: SelectedServerInitializationResult = {
    kind: 'completed',
    payload: { epgRefresh: { kind: 'succeeded', result: READY_REFRESH } },
};

interface CoordinatorHarness {
    deps: jest.Mocked<ServerSelectionCoordinatorDeps>;
    candidateReceipt: PlexDiscoverySelectionReceipt;
    selectionContext: PlexDiscoverySelectionContext;
    rollbackReceipts: PlexDiscoverySelectionReceipt[];
    startupHandoff: InitializationStartupHandoff;
    transferSelectedServerTuningToStartup: jest.Mock;
}

function createHarness(snapshot?: PlexDiscoverySelectedServerSnapshot): CoordinatorHarness {
    const selectionContext = new PlexDiscoverySelectionContext();
    const candidateReceipt = selectionContext.issueReceipt(selectionContext.capture(), 'selected');
    const rollbackReceipts: PlexDiscoverySelectionReceipt[] = [];
    const evidence = Object.freeze({}) as SelectedServerPersistenceEvidence;
    const tuneAuthority = new ChannelInitialTuneAuthority();
    const transferSelectedServerTuningToStartup = jest.fn();
    const startupHandoff = new InitializationStartupHandoff(transferSelectedServerTuningToStartup);
    const deps: jest.Mocked<ServerSelectionCoordinatorDeps> = {
        captureDiscoverySelectionSnapshot: jest.fn(() => snapshot ?? ({
            server: { id: 'old-server' },
            connection: { uri: 'https://old.example.invalid' },
            storedServerId: 'old-server',
        } as PlexDiscoverySelectedServerSnapshot)),
        restoreDiscoverySelectionSnapshot: jest.fn((_snapshot: PlexDiscoverySelectedServerSnapshot) => {
            const receipt = selectionContext.issueReceipt(selectionContext.advance(), 'selected');
            rollbackReceipts.push(receipt);
            return receipt;
        }),
        getSelectionReceiptSignal: jest.fn((receipt: PlexDiscoverySelectionReceipt) =>
            selectionContext.getReceiptSignal(receipt)),
        assertSelectionReceiptCurrent: jest.fn((receipt: PlexDiscoverySelectionReceipt) =>
            selectionContext.assertReceiptCurrent(receipt)),
        capturePersistenceEvidence: jest.fn(() => evidence),
        persistCandidateSelection: jest.fn((
            _evidence: SelectedServerPersistenceEvidence,
            _serverId: string,
            _serverUri: string
        ) => ({
            phase: 'candidate' as const,
            state: 'updated' as const,
            publicResult: 'updated' as const,
        })),
        restorePersistenceEvidence: jest.fn((_evidence: SelectedServerPersistenceEvidence) => snapshot?.server === null
            ? {
                phase: 'rollback' as const,
                state: 'restored_available_unselected' as const,
                selection: { serverId: null, serverUri: null },
            }
            : {
                phase: 'rollback' as const,
                state: 'restored_available_selected' as const,
                selection: {
                    serverId: snapshot?.server?.id ?? 'old-server',
                    serverUri: snapshot?.connection?.uri ?? 'https://old.example.invalid',
                },
            }),
        assertPersistenceEvidenceCurrent: jest.fn(),
        selectServer: jest.fn().mockResolvedValue({ kind: 'selected', receipt: candidateReceipt }),
        getSelectedServerUri: jest.fn(() => 'https://candidate.example.invalid'),
        suspendAndDrainForScopeTransition: jest.fn().mockResolvedValue(undefined),
        resumeAfterScopeTransition: jest.fn(),
        beginInitialTuneLineage: jest.fn((validators) => tuneAuthority.beginLineage(validators)),
        completeInitialTuneLineage: jest.fn((lineage) => tuneAuthority.completeLineage(lineage)),
        beginSelectedServerLineage: jest.fn(() => startupHandoff.beginSelectedServerLineage()),
        releaseSelectedServerLineage: jest.fn((lineage) =>
            startupHandoff.releaseSelectedServerLineage(lineage)),
        getSupersedingStartupHandoff: jest.fn((lineage) =>
            startupHandoff.getSupersedingStartupHandoff(lineage)),
        runSelectedServerInitialization: jest.fn().mockResolvedValue(COMPLETED),
        restoreUnselectedRuntime: jest.fn().mockResolvedValue(undefined),
        prepareQuarantineRuntime: jest.fn().mockResolvedValue(undefined),
        releaseQuarantineRuntimeGate: jest.fn(),
        exitQuarantine: jest.fn().mockResolvedValue(undefined),
    };
    return {
        deps, candidateReceipt, selectionContext, rollbackReceipts,
        startupHandoff, transferSelectedServerTuningToStartup,
    };
}

describe('ServerSelectionCoordinator', () => {
    it.each(['discovery', 'persistence'] as const)(
        'releases selected lineage when %s evidence capture throws',
        async (capture) => {
            const harness = createHarness();
            const captureError = new Error(`${capture} capture failed`);
            if (capture === 'discovery') {
                harness.deps.captureDiscoverySelectionSnapshot.mockImplementationOnce(() => { throw captureError; });
            } else {
                harness.deps.capturePersistenceEvidence.mockImplementationOnce(() => { throw captureError; });
            }
            const coordinator = new ServerSelectionCoordinator(harness.deps);

            await expect(coordinator.selectServer('candidate')).rejects.toBe(captureError);
            expect(harness.deps.releaseSelectedServerLineage).toHaveBeenCalledTimes(1);
            harness.startupHandoff.beginStartup();
            expect(harness.transferSelectedServerTuningToStartup).not.toHaveBeenCalled();
        }
    );

    it('constructs the exact selected result after strict forward commit', async () => {
        const { deps } = createHarness();
        const epgRefresh = COMPLETED.kind === 'completed' ? COMPLETED.payload.epgRefresh : neverValue();
        const coordinator = new ServerSelectionCoordinator(deps);

        const result = await coordinator.selectServer('candidate');

        expect(result).toEqual({ kind: 'selected', persistedSelection: 'updated', epgRefresh });
        expect(Object.keys(result).sort()).toEqual(['epgRefresh', 'kind', 'persistedSelection']);
        expect((result as Record<string, unknown>).startupResume).toBeUndefined();
        expect((result as Record<string, unknown>).readiness).toBeUndefined();
        expect(deps.suspendAndDrainForScopeTransition).toHaveBeenCalled();
        expect(deps.completeInitialTuneLineage).toHaveBeenCalledTimes(1);
        expect(deps.resumeAfterScopeTransition).toHaveBeenCalledTimes(1);
        expect(deps.restoreDiscoverySelectionSnapshot).not.toHaveBeenCalled();
    });

    it('restores the old selected scope with a fresh receipt after initialization failure', async () => {
        const harness = createHarness();
        const error = new Error('startup failed');
        harness.deps.runSelectedServerInitialization
            .mockResolvedValueOnce({ kind: 'failed', error })
            .mockResolvedValueOnce(COMPLETED);
        const coordinator = new ServerSelectionCoordinator(harness.deps);

        await expect(coordinator.selectServer('candidate')).rejects.toBe(error);

        expect(harness.deps.restoreDiscoverySelectionSnapshot).toHaveBeenCalledTimes(1);
        expect(harness.deps.restorePersistenceEvidence).toHaveBeenCalledTimes(1);
        expect(harness.deps.runSelectedServerInitialization).toHaveBeenCalledTimes(2);
        expect(harness.rollbackReceipts).toHaveLength(1);
    });

    it('restores an unselected scope without running selected startup', async () => {
        const harness = createHarness({ server: null, connection: null, storedServerId: null });
        const error = new Error('candidate failed');
        harness.deps.runSelectedServerInitialization.mockResolvedValueOnce({ kind: 'failed', error });
        const coordinator = new ServerSelectionCoordinator(harness.deps);

        await expect(coordinator.selectServer('candidate')).rejects.toBe(error);

        expect(harness.deps.runSelectedServerInitialization).toHaveBeenCalledTimes(1);
        expect(harness.deps.restoreUnselectedRuntime).toHaveBeenCalledTimes(1);
    });

    it('lets caller abort win while still restoring the previous scope', async () => {
        const harness = createHarness();
        const caller = new AbortController();
        const reason = new DOMException('selection cancelled', 'AbortError');
        harness.deps.runSelectedServerInitialization.mockImplementationOnce(async () => {
            caller.abort(reason);
            return COMPLETED;
        });
        const coordinator = new ServerSelectionCoordinator(harness.deps);

        await expect(coordinator.selectServer('candidate', { signal: caller.signal })).rejects.toBe(reason);
        expect(harness.deps.restoreDiscoverySelectionSnapshot).toHaveBeenCalledTimes(1);
    });

    it('treats candidate receipt invalidation as supersession and publishes no result', async () => {
        const harness = createHarness();
        harness.deps.runSelectedServerInitialization.mockImplementationOnce(async () => {
            harness.selectionContext.advance();
            return COMPLETED;
        });
        const coordinator = new ServerSelectionCoordinator(harness.deps);

        await expect(coordinator.selectServer('candidate')).rejects.toBeDefined();
        expect(harness.deps.restoreDiscoverySelectionSnapshot).not.toHaveBeenCalled();
        expect(coordinator.getQuarantineState()).toEqual({
            kind: 'quarantined',
            phase: 'discovery_restore',
            commandPending: false,
        });
    });

    it('awaits only an initialization-owned strictly newer startup handoff', async () => {
        const harness = createHarness();
        let settleStartup!: () => void;
        harness.deps.runSelectedServerInitialization.mockImplementationOnce(async () => {
            const startupRequest = harness.startupHandoff.beginStartup();
            const startup = new Promise<void>((resolve) => { settleStartup = resolve; });
            harness.startupHandoff.trackStartup(startupRequest, startup);
            return COMPLETED;
        });
        const coordinator = new ServerSelectionCoordinator(harness.deps);

        const selection = coordinator.selectServer('candidate');
        for (let index = 0; index < 8; index += 1) await Promise.resolve();
        expect(harness.deps.restoreDiscoverySelectionSnapshot).not.toHaveBeenCalled();
        expect(coordinator.getQuarantineState()).toEqual({ kind: 'clear' });
        settleStartup();

        await expect(selection).rejects.toBeDefined();
        expect(harness.deps.getSupersedingStartupHandoff).toHaveBeenCalledTimes(1);
        expect(harness.deps.restoreDiscoverySelectionSnapshot).not.toHaveBeenCalled();
        expect(coordinator.getQuarantineState()).toEqual({ kind: 'clear' });
    });

    it('quarantines selected-lineage invalidation when no newer startup owns settlement', async () => {
        const harness = createHarness();
        harness.deps.runSelectedServerInitialization.mockImplementationOnce(async () => {
            harness.startupHandoff.beginStartup();
            return COMPLETED;
        });
        const coordinator = new ServerSelectionCoordinator(harness.deps);

        await expect(coordinator.selectServer('candidate')).rejects.toBeDefined();

        expect(coordinator.getQuarantineState()).toMatchObject({
            kind: 'quarantined',
            phase: 'discovery_restore',
        });
        expect(harness.deps.prepareQuarantineRuntime).toHaveBeenCalledTimes(1);
    });

    it.each([
        [
            { server: null, connection: null, storedServerId: null },
            'restored_available_selected',
        ],
        [
            {
                server: { id: 'old-server' },
                connection: { uri: 'https://old.example.invalid' },
                storedServerId: 'old-server',
            },
            'restored_available_unselected',
        ],
    ] as const)('quarantines rollback scope mismatch %#', async (snapshot, proofState) => {
        const harness = createHarness(snapshot as PlexDiscoverySelectedServerSnapshot);
        harness.deps.runSelectedServerInitialization.mockResolvedValueOnce({
            kind: 'failed', error: new Error('forward failed'),
        });
        harness.deps.restorePersistenceEvidence.mockReturnValue(proofState === 'restored_available_selected'
            ? {
                phase: 'rollback',
                state: proofState,
                selection: { serverId: 'old-server', serverUri: 'https://old.example.invalid' },
            }
            : { phase: 'rollback', state: proofState, selection: { serverId: null, serverUri: null } });
        const coordinator = new ServerSelectionCoordinator(harness.deps);

        await expect(coordinator.selectServer('candidate')).rejects.toThrow('persistence_restore');
        expect(coordinator.getQuarantineState().kind).toBe('quarantined');
    });

    it('quarantines rollback when discovery and persistence restore different selected identities', async () => {
        const harness = createHarness();
        harness.deps.runSelectedServerInitialization.mockResolvedValueOnce({
            kind: 'failed', error: new Error('forward failed'),
        });
        harness.deps.restorePersistenceEvidence.mockReturnValue({
            phase: 'rollback',
            state: 'restored_available_selected',
            selection: { serverId: 'other-server', serverUri: 'https://other.example.invalid' },
        });
        const coordinator = new ServerSelectionCoordinator(harness.deps);

        await expect(coordinator.selectServer('candidate')).rejects.toThrow('persistence_restore');
        expect(coordinator.getQuarantineState().kind).toBe('quarantined');
    });

    it('rejects a partial discovery snapshot before restoring it and quarantines', async () => {
        const harness = createHarness({
            server: { id: 'old-server' },
            connection: null,
            storedServerId: 'old-server',
        } as PlexDiscoverySelectedServerSnapshot);
        harness.deps.runSelectedServerInitialization.mockResolvedValueOnce({
            kind: 'failed', error: new Error('forward failed'),
        });
        const coordinator = new ServerSelectionCoordinator(harness.deps);

        await expect(coordinator.selectServer('candidate')).rejects.toThrow('discovery_restore');
        expect(harness.deps.restoreDiscoverySelectionSnapshot).not.toHaveBeenCalled();
        expect(coordinator.getQuarantineState().kind).toBe('quarantined');
    });

    it('serializes selection transactions through a settling tail', async () => {
        const harness = createHarness();
        let resolveFirst!: (value: SelectedServerInitializationResult) => void;
        harness.deps.runSelectedServerInitialization.mockImplementationOnce(() =>
            new Promise((resolve) => { resolveFirst = resolve; }));
        const coordinator = new ServerSelectionCoordinator(harness.deps);

        const first = coordinator.selectServer('first');
        const second = coordinator.selectServer('second');
        for (let index = 0; index < 8; index += 1) await Promise.resolve();
        expect(harness.deps.selectServer).toHaveBeenCalledTimes(1);
        resolveFirst(COMPLETED);
        await first;
        await second;
        expect(harness.deps.selectServer).toHaveBeenCalledTimes(2);
    });

    it('enters quarantine on rollback failure and Retry clears it only after full recovery', async () => {
        const harness = createHarness();
        const forwardError = new Error('startup failed');
        const rollbackError = new Error('restore failed');
        harness.deps.runSelectedServerInitialization.mockResolvedValueOnce({ kind: 'failed', error: forwardError });
        harness.deps.restorePersistenceEvidence.mockImplementationOnce(() => { throw rollbackError; });
        const coordinator = new ServerSelectionCoordinator(harness.deps);

        await expect(coordinator.selectServer('candidate')).rejects.toMatchObject({
            message: 'Selected-server recovery failed during persistence_restore.',
        });
        expect(coordinator.getQuarantineState()).toEqual({
            kind: 'quarantined',
            phase: 'persistence_restore',
            commandPending: false,
        });
        await expect(coordinator.selectServer('blocked')).rejects.toThrow('quarantined');

        harness.deps.runSelectedServerInitialization.mockResolvedValueOnce(COMPLETED);
        await coordinator.retryQuarantineRecovery();
        expect(coordinator.getQuarantineState()).toEqual({ kind: 'clear' });
        expect(harness.rollbackReceipts).toHaveLength(2);
        expect(harness.rollbackReceipts[1]).not.toBe(harness.rollbackReceipts[0]);
        expect(harness.deps.releaseQuarantineRuntimeGate).toHaveBeenCalledTimes(1);
    });

    it('keeps quarantine after a failed Retry and exposes awaited Exit', async () => {
        const harness = createHarness();
        harness.deps.runSelectedServerInitialization.mockResolvedValueOnce({
            kind: 'failed',
            error: new Error('forward failed'),
        });
        harness.deps.restoreDiscoverySelectionSnapshot.mockImplementationOnce(() => {
            throw new Error('restore failed');
        });
        const coordinator = new ServerSelectionCoordinator(harness.deps);
        await expect(coordinator.selectServer('candidate')).rejects.toThrow('discovery_restore');
        harness.deps.restoreDiscoverySelectionSnapshot.mockImplementationOnce(() => {
            throw new Error('retry failed');
        });

        await expect(coordinator.retryQuarantineRecovery()).rejects.toThrow('discovery_restore');
        expect(coordinator.getQuarantineState().kind).toBe('quarantined');
        expect(harness.deps.releaseQuarantineRuntimeGate).not.toHaveBeenCalled();
        await coordinator.exitQuarantine();
        expect(harness.deps.exitQuarantine).toHaveBeenCalledTimes(1);
    });

    it('reruns failed quarantine preparation before rollback recovery and gate release', async () => {
        const harness = createHarness();
        harness.deps.runSelectedServerInitialization.mockResolvedValueOnce({
            kind: 'failed', error: new Error('forward failed'),
        });
        harness.deps.restoreDiscoverySelectionSnapshot.mockImplementationOnce(() => {
            throw new Error('restore failed');
        });
        harness.deps.prepareQuarantineRuntime
            .mockRejectedValueOnce(new Error('preparation failed'))
            .mockResolvedValueOnce(undefined);
        const coordinator = new ServerSelectionCoordinator(harness.deps);

        await expect(coordinator.selectServer('candidate')).rejects.toThrow('preparation');
        expect(coordinator.getQuarantineState()).toMatchObject({ kind: 'quarantined', phase: 'preparation' });
        harness.deps.runSelectedServerInitialization.mockResolvedValueOnce(COMPLETED);
        await coordinator.retryQuarantineRecovery();

        expect(harness.deps.prepareQuarantineRuntime).toHaveBeenCalledTimes(2);
        expect(harness.deps.restoreDiscoverySelectionSnapshot).toHaveBeenCalledTimes(2);
        expect(harness.deps.releaseQuarantineRuntimeGate).toHaveBeenCalledTimes(1);
        expect(coordinator.getQuarantineState()).toEqual({ kind: 'clear' });
    });
});

function neverValue(): never {
    throw new Error('Unexpected result branch.');
}
