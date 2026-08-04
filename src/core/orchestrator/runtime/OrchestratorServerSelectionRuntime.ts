import type { IPlexAuth } from '../../../modules/plex/auth';
import type {
    IPlexServerDiscovery,
    PlexDiscoverySelectedServerSnapshot,
    PlexDiscoverySelectionReceipt,
    PlexDiscoverySignalOptions,
    PlexServerSelectionResult,
} from '../../../modules/plex/discovery';
import type { EPGCoordinator, IEPGComponent } from '../../../modules/ui/epg';
import { createEpgRetainedOperationContext } from '../../../modules/ui/epg/runtime/EPGRetainedOperationContext';
import type { ChannelSwitchOutcome } from '../../../types/channelSwitch';
import type { EpgScheduleRefreshResult } from '../../../shared/epgRefresh';
import type { OperationContextUpstream } from '../../../utils/RetainedOperationContext';
import type {
    ChannelInitialTuneLineage,
    ChannelInitialTunePermit,
} from '../../channel-tuning/ChannelInitialTuneAuthority';
import type {
    SelectedServerInitializationResult,
} from '../../initialization/InitializationSelectedServerTransaction';
import type { InitializationSelectedServerLineage } from '../../initialization/InitializationStartupHandoff';
import { InitializationCoordinator } from '../../initialization/InitializationCoordinator';
import { ServerSelectionCoordinator } from '../../server-selection/ServerSelectionCoordinator';
import {
    SelectedServerPersistenceAdapter,
    type SelectedServerPersistenceEvidence,
    type SelectedServerPersistenceProof,
} from '../../server-selection/SelectedServerPersistenceAdapter';
import type {
    SelectedServerQuarantineCommandState,
    SelectedServerQuarantineRecoveryPresentation,
} from '../../server-selection/SelectedServerQuarantineRecoveryState';
import { restoreUnselectedServerRuntime } from '../../server-selection/SelectedServerUnselectedRestoration';
import type {
    OrchestratorServerSelectionResult,
} from '../../server-selection/ServerSelectionTypes';

export interface OrchestratorServerSelectionRuntimeDeps {
    assertNotShutdown(method: string): void;
    getPlexAuth(): IPlexAuth | null;
    getPlexDiscovery(): IPlexServerDiscovery | null;
    getInitializationCoordinator(): InitializationCoordinator | null;
    getEpg(): IEPGComponent | null;
    getEpgCoordinator(): EPGCoordinator | null;
    suspendAndDrainForScopeTransition(): Promise<void>;
    resumeAfterScopeTransition(): void;
    beginInitialTuneLineage(validators: readonly OperationContextUpstream[]): ChannelInitialTuneLineage;
    mintInitialTunePermit(lineage: ChannelInitialTuneLineage): ChannelInitialTunePermit;
    completeInitialTuneLineage(lineage: ChannelInitialTuneLineage): void;
    switchToInitialChannel(channelId: string, permit: ChannelInitialTunePermit): Promise<ChannelSwitchOutcome>;
    clearIdentityScopedRuntime(): void;
    prepareQuarantineRuntime(): Promise<void>;
    releaseQuarantineRuntimeGate(): void;
    configureChannelManagerStorage(): Promise<void>;
    publishPendingServerModules(): void;
    setReady(ready: boolean): void;
    publishLoadingLifecycle(): Promise<void>;
    openServerSelect(): void;
    exitApplication(): Promise<void>;
    throwModuleInitPreconditionError(message: string, context: Record<string, unknown>): never;
}

export class OrchestratorServerSelectionRuntime {
    private readonly _persistence: SelectedServerPersistenceAdapter;
    private readonly _coordinator: ServerSelectionCoordinator;

    constructor(private readonly _deps: OrchestratorServerSelectionRuntimeDeps) {
        this._persistence = new SelectedServerPersistenceAdapter({
            getCredentialsPort: (): IPlexAuth | null => this._deps.getPlexAuth(),
        });
        this._coordinator = new ServerSelectionCoordinator({
            captureDiscoverySelectionSnapshot: (): PlexDiscoverySelectedServerSnapshot =>
                this._requireDiscovery('selectServer')
                .captureSelectedServerSnapshot(),
            restoreDiscoverySelectionSnapshot: (snapshot): PlexDiscoverySelectionReceipt =>
                this._requireDiscovery('selectServer')
                .restoreSelectedServerSnapshot(snapshot),
            getSelectionReceiptSignal: (receipt): AbortSignal => this._requireDiscovery('selectServer')
                .getSelectionReceiptSignal(receipt),
            assertSelectionReceiptCurrent: (receipt): void => this._requireDiscovery('selectServer')
                .assertSelectionReceiptCurrent(receipt),
            capturePersistenceEvidence: (): SelectedServerPersistenceEvidence =>
                this._persistence.capturePersistenceEvidence(),
            persistCandidateSelection: (evidence, serverId, serverUri): SelectedServerPersistenceProof =>
                this._persistence.persistCandidateSelection(evidence, serverId, serverUri),
            clearPersistedServerSelection: (evidence): SelectedServerPersistenceProof =>
                this._persistence.clearCandidateSelection(evidence),
            clearDiscoverySelection: (): void =>
                this._requireDiscovery('clearSelectedServer').clearSelection(),
            restorePersistenceEvidence: (evidence): SelectedServerPersistenceProof =>
                this._persistence.restorePersistenceEvidence(evidence),
            assertPersistenceEvidenceCurrent: (evidence): void =>
                this._persistence.assertPersistenceEvidenceCurrent(evidence),
            selectServer: (serverId, options): Promise<PlexServerSelectionResult> =>
                this._requireDiscovery('selectServer')
                .selectServer(serverId, options),
            getSelectedServerUri: (): string | null =>
                this._requireDiscovery('selectServer').getServerUri(),
            suspendAndDrainForScopeTransition: this._deps.suspendAndDrainForScopeTransition,
            resumeAfterScopeTransition: this._deps.resumeAfterScopeTransition,
            beginInitialTuneLineage: this._deps.beginInitialTuneLineage,
            completeInitialTuneLineage: this._deps.completeInitialTuneLineage,
            beginSelectedServerLineage: (): InitializationSelectedServerLineage =>
                this._requireInitialization()
                .beginSelectedServerLineage(),
            releaseSelectedServerLineage: (lineage): void => this._requireInitialization()
                .releaseSelectedServerLineage(lineage),
            getSupersedingStartupHandoff: (
                lineage: InitializationSelectedServerLineage
            ): Promise<void> | null => this._requireInitialization()
                .getSupersedingStartupHandoff(lineage),
            runSelectedServerInitialization: (options): Promise<SelectedServerInitializationResult> =>
                this._runSelectedServerInitialization(options),
            restoreUnselectedRuntime: (operation): Promise<void> =>
                this._restoreUnselectedRuntime(operation),
            restoreClearedUnselectedRuntime: (): Promise<void> =>
                this._restoreUnselectedRuntime({
                    signal: new AbortController().signal,
                    assertCurrent: (): void => undefined,
                }),
            publishUnselectedRuntimePresentation: this._deps.openServerSelect,
            prepareQuarantineRuntime: this._deps.prepareQuarantineRuntime,
            releaseQuarantineRuntimeGate: this._deps.releaseQuarantineRuntimeGate,
            exitQuarantine: this._deps.exitApplication,
        });
    }

    getSelectedServerId(): string | null {
        const discovery = this._deps.getPlexDiscovery();
        if (!discovery?.isConnected() || !discovery.getSelectedConnection()) return null;
        return discovery.getSelectedServer()?.id ?? null;
    }

    selectServer(
        serverId: string,
        options?: PlexDiscoverySignalOptions
    ): Promise<OrchestratorServerSelectionResult> {
        this._requireDiscovery('selectServer');
        return this._coordinator.selectServer(serverId, options);
    }

    async clearSelectedServer(): Promise<void> {
        this._requireDiscovery('clearSelectedServer');
        await this._coordinator.clearSelectedServer();
    }

    getQuarantineState(): SelectedServerQuarantineCommandState {
        return this._coordinator.getQuarantineState();
    }

    retryQuarantineRecovery(): Promise<SelectedServerQuarantineRecoveryPresentation> {
        return this._coordinator.retryQuarantineRecovery();
    }

    exitQuarantine(): Promise<void> {
        return this._coordinator.exitQuarantine();
    }

    private async _runSelectedServerInitialization(options: {
        lineage: ChannelInitialTuneLineage;
        startupLineage: InitializationSelectedServerLineage;
        operation: OperationContextUpstream & { signal: AbortSignal };
        commitOperation: OperationContextUpstream & { signal: AbortSignal };
    }): Promise<SelectedServerInitializationResult> {
        const initialization = this._deps.getInitializationCoordinator();
        if (!initialization) return { kind: 'failed', error: new Error('Initialization unavailable.') };
        return initialization.runSelectedServerTransaction({
            lineage: options.lineage,
            signal: options.operation.signal,
            assertCurrent: (): void => options.operation.assertCurrent(),
            commitOperation: options.commitOperation,
            beforeCommit: (operation) => this._refreshEpgForSelectedServer(operation),
            initialTune: (channelId, lineage) => this._runInitialTune(channelId, lineage),
        });
    }

    private async _refreshEpgForSelectedServer(
        operation: OperationContextUpstream
    ): Promise<EpgScheduleRefreshResult> {
        operation.assertCurrent();
        const epgCoordinator = this._deps.getEpgCoordinator();
        if (!epgCoordinator) throw new Error('EPG coordinator unavailable.');
        const epgOperation = createEpgRetainedOperationContext([operation]);
        try {
            epgCoordinator.clearSelectedChannelScheduleSnapshot();
            operation.assertCurrent();
            epgCoordinator.clearScheduleCaches();
            operation.assertCurrent();
            this._deps.getEpg()?.clearSchedules();
            operation.assertCurrent();
            epgCoordinator.primeEpgChannels(epgOperation);
            operation.assertCurrent();
            return await epgCoordinator.refreshEpgSchedules({
                reason: 'server-swap',
                operationContext: epgOperation,
            });
        } finally {
            epgOperation.release();
        }
    }

    private _runInitialTune(
        channelId: string,
        lineage: ChannelInitialTuneLineage
    ): Promise<ChannelSwitchOutcome> {
        const permit = this._deps.mintInitialTunePermit(lineage);
        return this._deps.switchToInitialChannel(channelId, permit);
    }

    private _restoreUnselectedRuntime(
        operation: OperationContextUpstream & { signal: AbortSignal }
    ): Promise<void> {
        return restoreUnselectedServerRuntime({
            cancelRuntimeWork: this._deps.suspendAndDrainForScopeTransition,
            clearIdentityScopedRuntime: this._deps.clearIdentityScopedRuntime,
            configureChannelManagerStorage: this._deps.configureChannelManagerStorage,
            publishPendingServerModules: this._deps.publishPendingServerModules,
            setReady: this._deps.setReady,
            publishLoadingLifecycle: this._deps.publishLoadingLifecycle,
        }, (): void => operation.assertCurrent());
    }

    private _requireDiscovery(method: 'selectServer' | 'clearSelectedServer'): IPlexServerDiscovery {
        this._deps.assertNotShutdown(method);
        const discovery = this._deps.getPlexDiscovery();
        if (discovery) return discovery;
        return this._deps.throwModuleInitPreconditionError('PlexServerDiscovery not initialized', {
            method,
            dependency: 'PlexServerDiscovery',
        });
    }

    private _requireInitialization(): InitializationCoordinator {
        const initialization = this._deps.getInitializationCoordinator();
        if (initialization) return initialization;
        return this._deps.throwModuleInitPreconditionError('InitializationCoordinator not initialized', {
            method: 'selectServer',
            dependency: 'InitializationCoordinator',
        });
    }
}
