import type {
    PlexDiscoverySelectedServerSnapshot,
    PlexDiscoverySelectionReceipt,
} from '../../../modules/plex/discovery';
import { PlexDiscoverySelectionContext } from '../../../modules/plex/discovery/PlexDiscoverySelectionContext';
import { ChannelInitialTuneAuthority } from '../../channel-tuning/ChannelInitialTuneAuthority';
import type { SelectedServerInitializationResult } from '../../initialization/InitializationSelectedServerTransaction';
import { InitializationStartupHandoff } from '../../initialization/InitializationStartupHandoff';
import { ServerSelectionCoordinator, type ServerSelectionCoordinatorDeps } from '../ServerSelectionCoordinator';
import {
    SelectedServerPersistenceAdapter,
    type SelectedServerPersistenceEvidence,
} from '../SelectedServerPersistenceAdapter';
import { SelectedServerQuarantinePreparationError } from '../SelectedServerRecoveryDiagnostics';

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
    const evidence = new SelectedServerPersistenceAdapter({
        getCredentialsPort: (): null => null,
    }).capturePersistenceEvidence();
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
        clearSelectedServerSelection: jest.fn().mockResolvedValue(undefined),
        restoreClearedUnselectedRuntime: jest.fn().mockResolvedValue(undefined),
        publishUnselectedRuntimePresentation: jest.fn(),
        prepareQuarantineRuntime: jest.fn().mockResolvedValue(undefined),
        releaseQuarantineRuntimeGate: jest.fn(),
        exitQuarantine: jest.fn().mockResolvedValue(undefined),
    };
    return {
        deps, candidateReceipt, selectionContext, rollbackReceipts,
        startupHandoff, transferSelectedServerTuningToStartup,
    };
}

function observeNextSupersedingStartupHandoff(
    harness: CoordinatorHarness
): Promise<{ handoff: Promise<void> | null }> {
    let reportHandoff!: (observation: { handoff: Promise<void> | null }) => void;
    const handoffObserved = new Promise<{ handoff: Promise<void> | null }>((resolve) => {
        reportHandoff = resolve;
    });
    harness.deps.getSupersedingStartupHandoff.mockImplementationOnce((lineage) => {
        const handoff = harness.startupHandoff.getSupersedingStartupHandoff(lineage);
        reportHandoff({ handoff });
        return handoff;
    });
    return handoffObserved;
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
        expect(harness.deps.publishUnselectedRuntimePresentation).toHaveBeenCalledTimes(1);
        const resumeOrder = harness.deps.resumeAfterScopeTransition.mock.invocationCallOrder[0];
        const publicationOrder =
            harness.deps.publishUnselectedRuntimePresentation.mock.invocationCallOrder[0];
        if (resumeOrder === undefined || publicationOrder === undefined) {
            throw new Error('Expected rollback resume and presentation publication');
        }
        expect(resumeOrder).toBeLessThan(publicationOrder);
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

    it('hands off startup supersession while discovery is pending without restoring older state', async () => {
        const harness = createHarness();
        let discoverySignal: AbortSignal | null | undefined;
        let markDiscoveryStarted!: () => void;
        const discoveryStarted = new Promise<void>((resolve) => { markDiscoveryStarted = resolve; });
        harness.deps.selectServer.mockImplementationOnce((_serverId, options) => {
            discoverySignal = options?.signal;
            markDiscoveryStarted();
            return new Promise((_resolve, reject) => {
                options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), {
                    once: true,
                });
            });
        });
        const coordinator = new ServerSelectionCoordinator(harness.deps);
        const selection = coordinator.selectServer('candidate');
        await discoveryStarted;

        let settleStartup!: () => void;
        const startupRequest = harness.startupHandoff.beginStartup();
        harness.startupHandoff.trackStartup(startupRequest, new Promise<void>((resolve) => {
            settleStartup = resolve;
        }));
        expect(discoverySignal?.aborted).toBe(true);
        expect(harness.deps.restoreDiscoverySelectionSnapshot).not.toHaveBeenCalled();

        settleStartup();
        await expect(selection).rejects.toThrow('superseded by newer startup');
        expect(harness.deps.getSupersedingStartupHandoff).toHaveBeenCalledTimes(1);
        expect(harness.deps.restoreDiscoverySelectionSnapshot).not.toHaveBeenCalled();
        expect(harness.deps.restorePersistenceEvidence).not.toHaveBeenCalled();
    });

    it('hands off synchronous supersession after discovery commits before full operation construction', async () => {
        const harness = createHarness();
        const handoffObserved = observeNextSupersedingStartupHandoff(harness);
        let settleStartup!: () => void;
        harness.deps.selectServer.mockImplementationOnce(async () => {
            const startupRequest = harness.startupHandoff.beginStartup();
            harness.startupHandoff.trackStartup(startupRequest, new Promise<void>((resolve) => {
                settleStartup = resolve;
            }));
            return { kind: 'selected', receipt: harness.candidateReceipt };
        });
        const coordinator = new ServerSelectionCoordinator(harness.deps);
        const selection = coordinator.selectServer('candidate');
        const { handoff } = await handoffObserved;

        expect(handoff).not.toBeNull();
        expect(harness.deps.persistCandidateSelection).not.toHaveBeenCalled();
        expect(harness.deps.restoreDiscoverySelectionSnapshot).not.toHaveBeenCalled();
        settleStartup();

        await expect(selection).rejects.toThrow('superseded by newer startup');
        expect(harness.deps.restoreDiscoverySelectionSnapshot).not.toHaveBeenCalled();
        expect(harness.deps.restorePersistenceEvidence).not.toHaveBeenCalled();
    });

    it('preserves a caller abort reason during discovery and restores the previous scope', async () => {
        const harness = createHarness();
        const caller = new AbortController();
        const reason = new DOMException('cancel discovery', 'AbortError');
        let markDiscoveryStarted!: () => void;
        const discoveryStarted = new Promise<void>((resolve) => { markDiscoveryStarted = resolve; });
        harness.deps.selectServer.mockImplementationOnce((_serverId, options) => {
            markDiscoveryStarted();
            return new Promise((_resolve, reject) => {
                options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), {
                    once: true,
                });
            });
        });
        const coordinator = new ServerSelectionCoordinator(harness.deps);
        const selection = coordinator.selectServer('candidate', { signal: caller.signal });
        await discoveryStarted;

        caller.abort(reason);

        await expect(selection).rejects.toBe(reason);
        expect(harness.deps.restoreDiscoverySelectionSnapshot).toHaveBeenCalledTimes(1);
        expect(harness.deps.restorePersistenceEvidence).toHaveBeenCalledTimes(1);
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
        expect(coordinator.getQuarantineState()).toMatchObject({
            kind: 'quarantined',
            phase: 'discovery_restore',
            commandPending: false,
        });
    });

    it('awaits only an initialization-owned strictly newer startup handoff', async () => {
        const harness = createHarness();
        const handoffObserved = observeNextSupersedingStartupHandoff(harness);
        let settleStartup!: () => void;
        harness.deps.runSelectedServerInitialization.mockImplementationOnce(async () => {
            const startupRequest = harness.startupHandoff.beginStartup();
            const startup = new Promise<void>((resolve) => { settleStartup = resolve; });
            harness.startupHandoff.trackStartup(startupRequest, startup);
            return COMPLETED;
        });
        const coordinator = new ServerSelectionCoordinator(harness.deps);

        const selection = coordinator.selectServer('candidate');
        const { handoff } = await handoffObserved;
        expect(handoff).not.toBeNull();
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
        let markFirstInitializationStarted!: () => void;
        const firstInitializationStarted = new Promise<void>((resolve) => {
            markFirstInitializationStarted = resolve;
        });
        let resolveFirst!: (value: SelectedServerInitializationResult) => void;
        harness.deps.runSelectedServerInitialization.mockImplementationOnce(() => {
            markFirstInitializationStarted();
            return new Promise((resolve) => { resolveFirst = resolve; });
        });
        const coordinator = new ServerSelectionCoordinator(harness.deps);

        const first = coordinator.selectServer('first');
        const second = coordinator.selectServer('second');
        await firstInitializationStarted;
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
        expect(coordinator.getQuarantineState()).toMatchObject({
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

    it('reports the original operation and named preparation failures without secrets', async () => {
        const harness = createHarness();
        harness.deps.runSelectedServerInitialization.mockResolvedValueOnce({
            kind: 'failed',
            error: new Error(
                'GET https://candidate.example/library?X-Plex-Token=operation-secret failed'
            ),
        });
        harness.deps.restoreDiscoverySelectionSnapshot.mockImplementationOnce(() => {
            throw new Error('Authorization: Bearer recovery-secret');
        });
        harness.deps.prepareQuarantineRuntime.mockRejectedValueOnce(
            new SelectedServerQuarantinePreparationError([{
                step: 'lifecycle',
                error: new Error(
                    'GET https://candidate.example/status?X-Plex-Token=preparation-secret failed'
                ),
            }])
        );
        const coordinator = new ServerSelectionCoordinator(harness.deps);

        await expect(coordinator.selectServer('candidate')).rejects.toThrow('preparation');

        const state = coordinator.getQuarantineState();
        expect(state).toMatchObject({
            kind: 'quarantined',
            phase: 'preparation',
            diagnostic: {
                operationFailure: {
                    step: 'selection',
                    error: { message: 'GET [REDACTED_URL] failed' },
                },
                recoveryFailure: {
                    step: 'discovery_restore',
                    error: { message: 'Authorization: Bearer REDACTED' },
                },
                preparationFailures: [{
                    step: 'lifecycle',
                    error: { message: 'GET [REDACTED_URL] failed' },
                }],
            },
        });
        const serializedState = JSON.stringify(state);
        expect(serializedState).not.toContain('operation-secret');
        expect(serializedState).not.toContain('recovery-secret');
        expect(serializedState).not.toContain('preparation-secret');
        expect(serializedState).not.toContain('candidate.example');
    });

    it('retains preparation diagnostics when the later rollback Retry fails', async () => {
        const harness = createHarness();
        harness.deps.runSelectedServerInitialization.mockResolvedValueOnce({
            kind: 'failed',
            error: new Error('forward failed'),
        });
        harness.deps.restoreDiscoverySelectionSnapshot.mockImplementationOnce(() => {
            throw new Error('initial restore failed');
        });
        harness.deps.prepareQuarantineRuntime
            .mockRejectedValueOnce(new Error('preparation failed'))
            .mockResolvedValueOnce(undefined);
        const coordinator = new ServerSelectionCoordinator(harness.deps);
        await expect(coordinator.selectServer('candidate')).rejects.toThrow('preparation');

        harness.deps.restorePersistenceEvidence.mockImplementationOnce(() => {
            throw new Error('retry persistence failed');
        });
        await expect(coordinator.retryQuarantineRecovery()).rejects.toThrow('persistence_restore');

        expect(coordinator.getQuarantineState()).toMatchObject({
            kind: 'quarantined',
            phase: 'persistence_restore',
            diagnostic: {
                recoveryFailure: {
                    step: 'persistence_restore',
                    error: { message: 'retry persistence failed' },
                },
                preparationFailures: [{
                    step: 'preparation',
                    error: { message: 'preparation failed' },
                }],
            },
        });
        expect(harness.deps.releaseQuarantineRuntimeGate).not.toHaveBeenCalled();

        harness.deps.restorePersistenceEvidence.mockImplementationOnce(() => {
            throw new Error('second retry persistence failed');
        });
        await expect(coordinator.retryQuarantineRecovery()).rejects.toThrow(
            'persistence_restore'
        );
        expect(coordinator.getQuarantineState()).toMatchObject({
            kind: 'quarantined',
            phase: 'persistence_restore',
            diagnostic: {
                recoveryFailure: {
                    error: { message: 'second retry persistence failed' },
                },
                preparationFailures: [{
                    step: 'preparation',
                    error: { message: 'preparation failed' },
                }],
            },
        });
    });

    it('serializes clear with selection and completes a coherent unselected restoration', async () => {
        const harness = createHarness();
        let releaseSelection!: () => void;
        let markSelectionStarted!: () => void;
        const selectionStarted = new Promise<void>((resolve) => {
            markSelectionStarted = resolve;
        });
        harness.deps.runSelectedServerInitialization.mockImplementationOnce((): Promise<SelectedServerInitializationResult> =>
            new Promise((resolve) => {
                markSelectionStarted();
                releaseSelection = (): void => resolve(COMPLETED);
            })
        );
        const coordinator = new ServerSelectionCoordinator(harness.deps);

        const selection = coordinator.selectServer('candidate');
        const clear = coordinator.clearSelectedServer();
        await selectionStarted;

        expect(harness.deps.clearSelectedServerSelection).not.toHaveBeenCalled();
        releaseSelection();
        await selection;
        await clear;

        expect(harness.deps.clearSelectedServerSelection).toHaveBeenCalledTimes(1);
        expect(harness.deps.restoreClearedUnselectedRuntime).toHaveBeenCalledTimes(1);
        expect(harness.deps.resumeAfterScopeTransition).toHaveBeenCalledTimes(2);
        expect(harness.deps.publishUnselectedRuntimePresentation).toHaveBeenCalledTimes(1);
    });

    it('quarantines failed clear restoration and Retry clears only after full recovery', async () => {
        const harness = createHarness();
        const firstFailure = new Error('storage reconfiguration failed');
        harness.deps.restoreClearedUnselectedRuntime
            .mockRejectedValueOnce(firstFailure)
            .mockResolvedValueOnce(undefined);
        const coordinator = new ServerSelectionCoordinator(harness.deps);

        await expect(coordinator.clearSelectedServer()).rejects.toBe(firstFailure);

        expect(coordinator.getQuarantineState()).toMatchObject({
            kind: 'quarantined',
            phase: 'unselected_runtime_restore',
            diagnostic: {
                operationFailure: {
                    step: 'clear',
                    error: { message: 'storage reconfiguration failed' },
                },
                recoveryFailure: {
                    step: 'unselected_runtime_restore',
                    error: { message: 'storage reconfiguration failed' },
                },
            },
        });
        expect(harness.deps.resumeAfterScopeTransition).not.toHaveBeenCalled();

        await expect(coordinator.retryQuarantineRecovery()).resolves.toBe('server-select');

        expect(coordinator.getQuarantineState()).toEqual({ kind: 'clear' });
        expect(harness.deps.restoreClearedUnselectedRuntime).toHaveBeenCalledTimes(2);
        expect(harness.deps.resumeAfterScopeTransition).toHaveBeenCalledTimes(1);
        expect(harness.deps.publishUnselectedRuntimePresentation).not.toHaveBeenCalled();
        expect(harness.deps.releaseQuarantineRuntimeGate).toHaveBeenCalledTimes(1);
    });

    it('preserves the original clear cause when a later clear recovery Retry fails', async () => {
        const harness = createHarness();
        harness.deps.restoreClearedUnselectedRuntime
            .mockRejectedValueOnce(new Error('original clear restoration failed'))
            .mockRejectedValueOnce(new Error('retry restoration failed'));
        const coordinator = new ServerSelectionCoordinator(harness.deps);
        await expect(coordinator.clearSelectedServer()).rejects.toThrow(
            'original clear restoration failed'
        );

        await expect(coordinator.retryQuarantineRecovery()).rejects.toThrow(
            'unselected_runtime_restore'
        );

        expect(coordinator.getQuarantineState()).toMatchObject({
            kind: 'quarantined',
            phase: 'unselected_runtime_restore',
            diagnostic: {
                operationFailure: {
                    step: 'clear',
                    error: { message: 'original clear restoration failed' },
                },
                recoveryFailure: {
                    step: 'unselected_runtime_restore',
                    error: { message: 'retry restoration failed' },
                },
            },
        });
        expect(harness.deps.releaseQuarantineRuntimeGate).not.toHaveBeenCalled();
    });

    it('updates quarantine phase and safe cause when Retry fails in a later rollback step', async () => {
        const harness = createHarness();
        const tokenUrl = 'https://host/path?X-Plex-Token=secret';
        harness.deps.runSelectedServerInitialization.mockResolvedValueOnce({
            kind: 'failed',
            error: Object.assign(new Error(`initialization failed at ${tokenUrl}`), {
                code: 'PMS_INIT',
                headers: { 'X-Plex-Token': 'must-not-escape' },
            }),
        });
        harness.deps.restoreDiscoverySelectionSnapshot
            .mockImplementationOnce(() => {
                throw new Error('first discovery restore failed');
            });
        const coordinator = new ServerSelectionCoordinator(harness.deps);
        await expect(coordinator.selectServer('candidate')).rejects.toThrow('discovery_restore');

        harness.deps.restorePersistenceEvidence.mockImplementationOnce(() => {
            throw Object.assign(new Error(`retry persistence failed at ${tokenUrl}`), {
                payload: { token: 'must-not-escape' },
            });
        });
        await expect(coordinator.retryQuarantineRecovery()).rejects.toThrow('persistence_restore');

        const state = coordinator.getQuarantineState();
        expect(state).toMatchObject({
            kind: 'quarantined',
            phase: 'persistence_restore',
            diagnostic: {
                operationFailure: {
                    step: 'selection',
                    error: {
                        name: 'Error',
                        code: 'PMS_INIT',
                        message: 'initialization failed at [REDACTED_URL]',
                    },
                },
                recoveryFailure: {
                    step: 'persistence_restore',
                    error: {
                        name: 'Error',
                        message: 'retry persistence failed at [REDACTED_URL]',
                    },
                },
            },
        });
        expect(JSON.stringify(state)).not.toContain('secret');
        expect(JSON.stringify(state)).not.toContain('must-not-escape');
    });
});

function neverValue(): never {
    throw new Error('Unexpected result branch.');
}
