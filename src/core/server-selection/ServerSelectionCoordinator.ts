import type { PlexDiscoverySignalOptions, PlexServerSelectionResult } from '../../modules/plex/discovery';
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
    resumeStartupAfterSelection(): Promise<SelectedServerStartupResumeResult>;
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
        const discoverySnapshot = this._deps.captureDiscoverySelectionSnapshot();
        const selectionResult = await this._deps.selectServer(serverId, options);
        if (selectionResult.kind !== 'selected') {
            return {
                kind: 'selection_failed',
                reason:
                    selectionResult.kind === 'server_not_found'
                        ? 'server_not_found'
                        : selectionResult.reason,
            };
        }

        let persistedSelectionSnapshot: PersistedSelectedServerSnapshot;
        let persistedSelection: SelectedServerPersistenceResult;
        try {
            persistedSelectionSnapshot = await this._deps.capturePersistedSelectionSnapshot();
            const selectedServerUri = this._deps.getSelectedServerUri();
            persistedSelection = await this._deps.persistSelection(serverId, selectedServerUri);
        } catch (error) {
            this._tryRestoreDiscoverySelectionSnapshot(discoverySnapshot);
            throw error;
        }

        try {
            const startupResume = await this._deps.resumeStartupAfterSelection();
            return {
                kind: 'selected',
                readiness: this._deps.getReadiness(),
                persistedSelection,
                startupResume,
            };
        } catch (error) {
            this._tryRestoreDiscoverySelectionSnapshot(discoverySnapshot);
            await this._tryRestorePersistedSelectionSnapshot(persistedSelectionSnapshot);
            throw error;
        }
    }
}
