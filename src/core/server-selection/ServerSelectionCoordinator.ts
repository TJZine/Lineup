import type {
    PlexDiscoverySelectedServerSnapshot,
    PlexDiscoverySelectionReceipt,
    PlexDiscoverySignalOptions,
    PlexServerSelectionResult,
} from '../../modules/plex/discovery';
import type { ChannelInitialTuneLineage } from '../channel-tuning/ChannelInitialTuneAuthority';
import { RetainedOperationContext, type OperationContextUpstream } from '../../utils/RetainedOperationContext';
import type { SelectedServerInitializationResult } from '../initialization/InitializationSelectedServerTransaction';
import type { InitializationSelectedServerLineage } from '../initialization/InitializationStartupHandoff';
import { throwIfSelectionAborted } from './ServerSelectionAbort';
import { readAbortSignalReason } from '../../utils/abortSignalReason';
import type {
    SelectedServerPersistenceEvidence,
    SelectedServerPersistenceProof,
} from './SelectedServerPersistenceAdapter';
import {
    SelectedServerQuarantineRecoveryState,
    type SelectedServerQuarantineCommandState,
    type SelectedServerQuarantinePhase,
    type SelectedServerQuarantineRecovery,
} from './SelectedServerQuarantineRecoveryState';
import {
    createSelectedServerRecoveryDiagnostic,
    retainSelectedServerPreparationFailures,
    withSelectedServerPreparationFailures,
    type SelectedServerRecoveryDiagnostic,
} from './SelectedServerRecoveryDiagnostics';
import type {
    OrchestratorServerSelectionResult,
    SelectedServerPersistenceResult,
} from './ServerSelectionTypes';
import { createSelectedServerTransactionOperation } from './SelectedServerTransactionOperation';
import { restoreSelectedServerRuntime } from './SelectedServerRuntimeRestoration';
import {
    assertSelectedServerRollbackScopeCoherent,
    classifySelectedServerRollbackScope,
} from './SelectedServerScopeCoherence';

type CurrentOperation = OperationContextUpstream & { signal: AbortSignal };
export interface ServerSelectionCoordinatorDeps {
    captureDiscoverySelectionSnapshot(): PlexDiscoverySelectedServerSnapshot;
    restoreDiscoverySelectionSnapshot(
        snapshot: PlexDiscoverySelectedServerSnapshot
    ): PlexDiscoverySelectionReceipt;
    getSelectionReceiptSignal(receipt: PlexDiscoverySelectionReceipt): AbortSignal;
    assertSelectionReceiptCurrent(receipt: PlexDiscoverySelectionReceipt): void;
    capturePersistenceEvidence(): SelectedServerPersistenceEvidence;
    persistCandidateSelection(
        evidence: SelectedServerPersistenceEvidence,
        serverId: string,
        serverUri: string
    ): SelectedServerPersistenceProof;
    restorePersistenceEvidence(evidence: SelectedServerPersistenceEvidence): SelectedServerPersistenceProof;
    assertPersistenceEvidenceCurrent(evidence: SelectedServerPersistenceEvidence): void;
    selectServer(serverId: string, options?: PlexDiscoverySignalOptions): Promise<PlexServerSelectionResult>;
    getSelectedServerUri(): string | null;
    suspendAndDrainForScopeTransition(): Promise<void>;
    resumeAfterScopeTransition(): void;
    beginInitialTuneLineage(validators: readonly OperationContextUpstream[]): ChannelInitialTuneLineage;
    completeInitialTuneLineage(lineage: ChannelInitialTuneLineage): void;
    beginSelectedServerLineage(): InitializationSelectedServerLineage;
    releaseSelectedServerLineage(lineage: InitializationSelectedServerLineage): void;
    getSupersedingStartupHandoff(lineage: InitializationSelectedServerLineage): Promise<void> | null;
    runSelectedServerInitialization(options: {
        lineage: ChannelInitialTuneLineage;
        startupLineage: InitializationSelectedServerLineage;
        operation: CurrentOperation;
    }): Promise<SelectedServerInitializationResult>;
    restoreUnselectedRuntime(operation: CurrentOperation): Promise<void>;
    clearSelectedServerSelection(): Promise<void>;
    restoreClearedUnselectedRuntime(): Promise<void>;
    prepareQuarantineRuntime(): Promise<void>;
    releaseQuarantineRuntimeGate(): void;
    exitQuarantine(): Promise<void>;
}
export class ServerSelectionCoordinator {
    private _selectionTail: Promise<void> = Promise.resolve();
    private readonly _quarantine: SelectedServerQuarantineRecoveryState;
    constructor(private readonly _deps: ServerSelectionCoordinatorDeps) {
        this._quarantine = new SelectedServerQuarantineRecoveryState(_deps.exitQuarantine);
    }

    selectServer(
        serverId: string,
        options?: PlexDiscoverySignalOptions
    ): Promise<OrchestratorServerSelectionResult> {
        return this._enqueue(async () => {
            this._quarantine.assertSelectionAllowed();
            return this._selectServerTransaction(serverId, options);
        });
    }

    clearSelectedServer(): Promise<void> {
        return this._enqueue(async () => {
            this._quarantine.assertSelectionAllowed();
            await this._deps.clearSelectedServerSelection();
            try {
                await this._deps.restoreClearedUnselectedRuntime();
                this._deps.resumeAfterScopeTransition();
            } catch (error: unknown) {
                await this._enterQuarantine(this._createClearedRuntimeRecovery(error));
                throw error;
            }
        });
    }

    getQuarantineState(): SelectedServerQuarantineCommandState {
        return this._quarantine.getState();
    }

    async retryQuarantineRecovery(): Promise<void> {
        await this._quarantine.retry();
        this._deps.releaseQuarantineRuntimeGate();
    }

    exitQuarantine(): Promise<void> {
        return this._quarantine.exit();
    }

    private _enqueue<T>(command: () => Promise<T>): Promise<T> {
        const result = this._selectionTail.then(command);
        this._selectionTail = result.then(() => undefined, () => undefined);
        return result;
    }

    private async _selectServerTransaction(
        serverId: string,
        options?: PlexDiscoverySignalOptions
    ): Promise<OrchestratorServerSelectionResult> {
        throwIfSelectionAborted(options?.signal);
        const startupLineage = this._deps.beginSelectedServerLineage();
        const preDiscoveryOperation = this._createPreDiscoveryOperation(
            startupLineage,
            options?.signal
        );
        try {
            return await this._runSelectedServerTransaction(
                serverId,
                startupLineage,
                preDiscoveryOperation
            );
        } finally {
            preDiscoveryOperation.release();
            this._deps.releaseSelectedServerLineage(startupLineage);
        }
    }

    private async _runSelectedServerTransaction(
        serverId: string,
        startupLineage: InitializationSelectedServerLineage,
        preDiscoveryOperation: RetainedOperationContext
    ): Promise<OrchestratorServerSelectionResult> {
        const discoverySnapshot = this._deps.captureDiscoverySelectionSnapshot();
        const evidence = this._deps.capturePersistenceEvidence();
        let result: PlexServerSelectionResult | null = null;
        let operation: RetainedOperationContext | null = null;
        let rollbackAttempted = false;
        try {
            result = await this._deps.selectServer(serverId, {
                signal: preDiscoveryOperation.signal,
            });
            preDiscoveryOperation.assertCurrent();
            if (result.kind !== 'selected') {
                rollbackAttempted = true;
                await this._rollbackOrQuarantine(
                    discoverySnapshot,
                    evidence,
                    new Error(`Server selection failed: ${
                        result.kind === 'server_not_found' ? 'server_not_found' : result.reason
                    }`)
                );
                return {
                    kind: 'selection_failed',
                    reason: result.kind === 'server_not_found' ? 'server_not_found' : result.reason,
                };
            }

            operation = this._createOperation(result.receipt, evidence, undefined, true, [
                preDiscoveryOperation,
            ]);
            let lineage: ChannelInitialTuneLineage | null = null;
            operation.assertCurrent();
            await this._deps.suspendAndDrainForScopeTransition();
            operation.assertCurrent();
            const serverUri = this._deps.getSelectedServerUri();
            if (!serverUri) throw new Error('Selected Plex server URI is unavailable.');
            const proof = this._deps.persistCandidateSelection(evidence, serverId, serverUri);
            operation.assertCurrent();
            lineage = this._deps.beginInitialTuneLineage([operation]);
            const initialized = await this._deps.runSelectedServerInitialization({
                lineage,
                startupLineage,
                operation,
            });
            operation.assertCurrent();
            if (initialized.kind === 'completed') {
                this._deps.completeInitialTuneLineage(lineage);
                lineage = null;
                operation.assertCurrent();
                this._deps.resumeAfterScopeTransition();
                operation.assertCurrent();
                return {
                    kind: 'selected',
                    persistedSelection: this._candidatePublicResult(proof),
                    epgRefresh: initialized.payload.epgRefresh,
                };
            }
            rollbackAttempted = true;
            const selectionFailure = initialized.kind === 'failed'
                ? initialized.error
                : new Error(`Selected-server initialization stopped: ${initialized.reason}`);
            await this._rollbackOrQuarantine(discoverySnapshot, evidence, selectionFailure);
            if (initialized.kind === 'failed') throw initialized.error;
            preDiscoveryOperation.assertCurrent();
            if (initialized.reason === 'auth_required') {
                return { kind: 'selection_failed', reason: 'auth_required' };
            }
            if (initialized.reason === 'server_unavailable') {
                return { kind: 'selection_failed', reason: 'unreachable' };
            }
            throw createSelectionSupersededError();
        } catch (error: unknown) {
            if (!rollbackAttempted) {
                try {
                    startupLineage.assertCurrent();
                } catch {
                    await this._handleSupersessionOrQuarantine(
                        startupLineage,
                        discoverySnapshot,
                        evidence,
                        error
                    );
                }
                if (result?.kind === 'selected') {
                    try {
                        this._deps.assertSelectionReceiptCurrent(result.receipt);
                    } catch {
                        await this._handleSupersessionOrQuarantine(
                            startupLineage,
                            discoverySnapshot,
                            evidence,
                            error
                        );
                    }
                }
                await this._rollbackOrQuarantine(discoverySnapshot, evidence, error);
            }
            throw error;
        } finally {
            operation?.release();
        }
    }

    private _createPreDiscoveryOperation(
        startupLineage: InitializationSelectedServerLineage,
        callerSignal?: AbortSignal | null
    ): RetainedOperationContext {
        return new RetainedOperationContext([
            startupLineage,
            ...(callerSignal ? [{
                signal: callerSignal,
                assertCurrent: (): void => {
                    if (callerSignal.aborted) throw readAbortSignalReason(callerSignal);
                },
            }] : []),
        ]);
    }

    private async _handleSupersessionOrQuarantine(
        startupLineage: InitializationSelectedServerLineage,
        discoverySnapshot: PlexDiscoverySelectedServerSnapshot,
        evidence: SelectedServerPersistenceEvidence,
        originalError: unknown
    ): Promise<never> {
        const handoff = this._deps.getSupersedingStartupHandoff(startupLineage);
        if (handoff) {
            await handoff;
            throw originalError;
        }
        const recoveryFailure = new Error('Selected-server scope was superseded without a startup handoff.');
        await this._enterQuarantine(this._createRollbackRecovery(
            discoverySnapshot,
            evidence,
            originalError,
            recoveryFailure,
            'discovery_restore'
        ));
        throw originalError;
    }

    private _createOperation(
        receipt: PlexDiscoverySelectionReceipt,
        evidence: SelectedServerPersistenceEvidence,
        callerSignal?: AbortSignal | null,
        includePersistenceEvidence = true,
        upstreams: readonly OperationContextUpstream[] = []
    ): RetainedOperationContext {
        return createSelectedServerTransactionOperation({
            receipt,
            evidence,
            ...(callerSignal ? { callerSignal } : {}),
            includePersistenceEvidence,
            getSelectionReceiptSignal: this._deps.getSelectionReceiptSignal,
            assertSelectionReceiptCurrent: this._deps.assertSelectionReceiptCurrent,
            assertPersistenceEvidenceCurrent: this._deps.assertPersistenceEvidenceCurrent,
            upstreams,
        });
    }

    private async _rollbackOrQuarantine(
        snapshot: PlexDiscoverySelectedServerSnapshot,
        evidence: SelectedServerPersistenceEvidence,
        selectionFailure: unknown
    ): Promise<void> {
        try {
            await this._restorePreviousScope(snapshot, evidence);
        } catch (error: unknown) {
            const phase = getRecoveryFailurePhase(error);
            await this._enterQuarantine(this._createRollbackRecovery(
                snapshot,
                evidence,
                selectionFailure,
                error,
                phase
            ));
            throw error;
        }
    }

    private _createRollbackRecovery(
        snapshot: PlexDiscoverySelectedServerSnapshot,
        evidence: SelectedServerPersistenceEvidence,
        selectionFailure: unknown,
        recoveryFailure: unknown,
        phase: SelectedServerQuarantinePhase
    ): SelectedServerQuarantineRecovery {
        const diagnostic = createSelectedServerRecoveryDiagnostic(
            'selection',
            selectionFailure,
            phase,
            recoveryFailure
        );
        return {
            phase,
            diagnostic,
            retry: async (priorDiagnostic): Promise<void> => {
                try {
                    await this._restorePreviousScope(snapshot, evidence);
                } catch (error: unknown) {
                    const retryPhase = getRecoveryFailurePhase(error);
                    const nextRecovery = this._createRollbackRecovery(
                        snapshot,
                        evidence,
                        selectionFailure,
                        error,
                        retryPhase
                    );
                    this._quarantine.enter(this._retainPreparationHistory(
                        nextRecovery,
                        priorDiagnostic
                    ));
                    throw error;
                }
            },
        };
    }

    private _createClearedRuntimeRecovery(
        operationFailure: unknown,
        recoveryFailure: unknown = operationFailure
    ): SelectedServerQuarantineRecovery {
        const diagnostic = createSelectedServerRecoveryDiagnostic(
            'clear',
            operationFailure,
            'unselected_runtime_restore',
            recoveryFailure
        );
        return {
            phase: 'unselected_runtime_restore',
            diagnostic,
            retry: async (priorDiagnostic): Promise<void> => {
                try {
                    await this._deps.restoreClearedUnselectedRuntime();
                    this._deps.resumeAfterScopeTransition();
                } catch (error: unknown) {
                    const nextRecovery = this._createClearedRuntimeRecovery(
                        operationFailure,
                        error
                    );
                    this._quarantine.enter(this._retainPreparationHistory(
                        nextRecovery,
                        priorDiagnostic
                    ));
                    throw new SelectedServerRecoveryError('unselected_runtime_restore', error);
                }
            },
        };
    }

    private async _enterQuarantine(recovery: SelectedServerQuarantineRecovery): Promise<void> {
        this._quarantine.enter(recovery);
        try {
            await this._deps.prepareQuarantineRuntime();
        } catch (error: unknown) {
            this._quarantine.enter(this._createPreparationRecovery(recovery, error));
            throw new SelectedServerRecoveryError('preparation', error);
        }
    }

    private _retainPreparationHistory(
        recovery: SelectedServerQuarantineRecovery,
        priorDiagnostic?: SelectedServerRecoveryDiagnostic
    ): SelectedServerQuarantineRecovery {
        const diagnostic = retainSelectedServerPreparationFailures(
            recovery.diagnostic,
            priorDiagnostic
        );
        if (diagnostic === recovery.diagnostic) return recovery;
        return {
            ...recovery,
            diagnostic,
            retry: () => recovery.retry(diagnostic),
        };
    }

    private _createPreparationRecovery(
        recovery: SelectedServerQuarantineRecovery,
        preparationFailure: unknown
    ): SelectedServerQuarantineRecovery {
        const diagnostic = withSelectedServerPreparationFailures(
            recovery.diagnostic,
            preparationFailure
        );
        return {
            phase: 'preparation',
            diagnostic,
            retry: async (): Promise<void> => {
                try {
                    await this._deps.prepareQuarantineRuntime();
                } catch (error: unknown) {
                    this._quarantine.enter(this._createPreparationRecovery(recovery, error));
                    throw new SelectedServerRecoveryError('preparation', error);
                }
                await recovery.retry(diagnostic);
            },
        };
    }

    private async _restorePreviousScope(
        snapshot: PlexDiscoverySelectedServerSnapshot,
        evidence: SelectedServerPersistenceEvidence
    ): Promise<void> {
        let phase: SelectedServerQuarantinePhase = 'discovery_restore';
        try {
            const rollbackScope = classifySelectedServerRollbackScope(snapshot);
            const receipt = this._deps.restoreDiscoverySelectionSnapshot(snapshot);
            const receiptOperation = this._createOperation(receipt, evidence, undefined, false);
            try {
                receiptOperation.assertCurrent();
                phase = 'persistence_restore';
                const persistenceProof = this._deps.restorePersistenceEvidence(evidence);
                assertSelectedServerRollbackScopeCoherent(rollbackScope, persistenceProof);
                receiptOperation.assertCurrent();
                const operation = new RetainedOperationContext([
                    receiptOperation,
                    { assertCurrent: (): void => this._deps.assertPersistenceEvidenceCurrent(evidence) },
                ]);
                try {
                    operation.assertCurrent();
                    if (rollbackScope.kind === 'selected') {
                        phase = 'selected_runtime_restore';
                    const startupLineage = this._deps.beginSelectedServerLineage();
                    try {
                    await restoreSelectedServerRuntime({
                        operation,
                        startupLineage,
                        suspendAndDrain: this._deps.suspendAndDrainForScopeTransition,
                        beginInitialTuneLineage: this._deps.beginInitialTuneLineage,
                        runInitialization: this._deps.runSelectedServerInitialization,
                        completeInitialTuneLineage: this._deps.completeInitialTuneLineage,
                    });
                    } finally {
                        this._deps.releaseSelectedServerLineage(startupLineage);
                    }
                    } else {
                        phase = 'unselected_runtime_restore';
                        await this._deps.restoreUnselectedRuntime(operation);
                    }
                    operation.assertCurrent();
                    this._deps.resumeAfterScopeTransition();
                    operation.assertCurrent();
                } finally {
                    operation.release();
                }
            } finally {
                receiptOperation.release();
            }
        } catch (error: unknown) {
            throw new SelectedServerRecoveryError(phase, error);
        }
    }

    private _candidatePublicResult(proof: SelectedServerPersistenceProof): SelectedServerPersistenceResult {
        if (proof.phase !== 'candidate') throw new Error('Candidate persistence proof is required.');
        return proof.publicResult;
    }
}

class SelectedServerRecoveryError extends Error {
    constructor(readonly phase: SelectedServerQuarantinePhase, readonly cause: unknown) {
        super(`Selected-server recovery failed during ${phase}.`);
        this.name = 'SelectedServerRecoveryError';
    }
}

function getRecoveryFailurePhase(error: unknown): SelectedServerQuarantinePhase {
    return error instanceof SelectedServerRecoveryError ? error.phase : 'proof';
}

function createSelectionSupersededError(): Error {
    if (typeof DOMException !== 'undefined') {
        return new DOMException('Selected-server transaction was superseded.', 'AbortError');
    }
    const error = new Error('Selected-server transaction was superseded.');
    error.name = 'AbortError';
    return error;
}
