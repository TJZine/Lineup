import {
    isPlexDiscoverySelectionSupersededError,
    type PlexDiscoverySignalOptions,
    type PlexServerSelectionResult,
} from '../../modules/plex/discovery';
import { throwIfSelectionAborted } from './ServerSelectionAbort';
import type {
    DiscoverySelectedServerSnapshot,
    OrchestratorServerSelectionReadiness,
    OrchestratorServerSelectionResult,
    PersistedSelectedServerSnapshot,
    SelectedServerPersistenceResult,
    SelectedServerStartupResumeResult,
} from './ServerSelectionTypes';

export interface ServerSelectionCoordinatorDeps {
    captureDiscoverySelectionSnapshot(): DiscoverySelectedServerSnapshot;
    restoreDiscoverySelectionSnapshot(snapshot: DiscoverySelectedServerSnapshot): void;
    capturePersistedSelectionSnapshot(): Promise<PersistedSelectedServerSnapshot>;
    selectServer(serverId: string, options?: PlexDiscoverySignalOptions): Promise<PlexServerSelectionResult>;
    getSelectedServerUri(): string | null;
    persistSelection(
        serverId: string,
        serverUri: string | null
    ): Promise<SelectedServerPersistenceResult>;
    restorePersistedSelectionSnapshot(
        snapshot: PersistedSelectedServerSnapshot
    ): Promise<SelectedServerPersistenceResult>;
    resumeStartupAfterSelection(options?: PlexDiscoverySignalOptions): Promise<SelectedServerStartupResumeResult>;
    rollbackStartupAfterSelectionFailure(): void;
    getReadiness(): OrchestratorServerSelectionReadiness;
}

export class ServerSelectionCoordinator {
    private _selectionTail: Promise<void> = Promise.resolve();

    constructor(private readonly _deps: ServerSelectionCoordinatorDeps) {}

    private _tryRestoreDiscoverySelectionSnapshot(snapshot: DiscoverySelectedServerSnapshot): void {
        try {
            this._deps.restoreDiscoverySelectionSnapshot(snapshot);
        } catch {
            // Rollback is best-effort; preserve the original selection failure.
        }
    }

    private async _tryRestorePersistedSelectionSnapshot(
        snapshot: PersistedSelectedServerSnapshot
    ): Promise<void> {
        try {
            await this._deps.restorePersistedSelectionSnapshot(snapshot);
        } catch {
            // Rollback is best-effort; preserve the original runtime-resume failure.
        }
    }

    private _tryRollbackStartupAfterSelectionFailure(): void {
        try {
            this._deps.rollbackStartupAfterSelectionFailure();
        } catch {
            // Rollback is best-effort; preserve the original runtime-resume failure.
        }
    }

    selectServer(
        serverId: string,
        options?: PlexDiscoverySignalOptions
    ): Promise<OrchestratorServerSelectionResult> {
        const selection = this._selectionTail.then(() => this._selectServerTransaction(serverId, options));
        this._selectionTail = selection.then(
            () => undefined,
            () => undefined
        );
        return selection;
    }

    private async _selectServerTransaction(
        serverId: string,
        options?: PlexDiscoverySignalOptions
    ): Promise<OrchestratorServerSelectionResult> {
        throwIfSelectionAborted(options?.signal);
        const discoverySnapshot = this._deps.captureDiscoverySelectionSnapshot();
        let selectionResult: PlexServerSelectionResult;
        try {
            selectionResult = await this._deps.selectServer(serverId, options);
        } catch (error) {
            if (isPlexDiscoverySelectionSupersededError(error)) throw error;
            this._tryRestoreDiscoverySelectionSnapshot(discoverySnapshot);
            throw error;
        }
        if (selectionResult.kind !== 'selected') {
            this._tryRestoreDiscoverySelectionSnapshot(discoverySnapshot);
            return {
                kind: 'selection_failed',
                reason:
                    selectionResult.kind === 'server_not_found'
                        ? 'server_not_found'
                        : selectionResult.reason,
            };
        }
        try {
            throwIfSelectionAborted(options?.signal);
        } catch (error) {
            this._tryRestoreDiscoverySelectionSnapshot(discoverySnapshot);
            throw error;
        }

        let persistedSelectionSnapshot: PersistedSelectedServerSnapshot;
        let persistedSelection: SelectedServerPersistenceResult;
        try {
            persistedSelectionSnapshot = await this._deps.capturePersistedSelectionSnapshot();
            throwIfSelectionAborted(options?.signal);
            const selectedServerUri = this._deps.getSelectedServerUri();
            persistedSelection = await this._deps.persistSelection(serverId, selectedServerUri);
        } catch (error) {
            this._tryRestoreDiscoverySelectionSnapshot(discoverySnapshot);
            throw error;
        }

        try {
            throwIfSelectionAborted(options?.signal);
            const startupResume = await this._deps.resumeStartupAfterSelection(options);
            return {
                kind: 'selected',
                readiness: this._deps.getReadiness(),
                persistedSelection,
                startupResume,
            };
        } catch (error) {
            this._tryRestoreDiscoverySelectionSnapshot(discoverySnapshot);
            await this._tryRestorePersistedSelectionSnapshot(persistedSelectionSnapshot);
            this._tryRollbackStartupAfterSelectionFailure();
            throw error;
        }
    }
}
