import type { PlexServerSelectionResult } from '../../modules/plex/discovery';
import type {
    OrchestratorServerSelectionReadiness,
    OrchestratorServerSelectionResult,
    SelectedServerPersistenceResult,
} from './ServerSelectionTypes';

export interface ServerSelectionCoordinatorDeps {
    selectServer(serverId: string): Promise<PlexServerSelectionResult>;
    getSelectedServerUri(): string | null;
    persistSelection(
        serverId: string,
        serverUri: string | null
    ): Promise<SelectedServerPersistenceResult>;
    runPostSelectionRuntimeSwap(): Promise<void>;
    getReadiness(): OrchestratorServerSelectionReadiness;
}

export class ServerSelectionCoordinator {
    constructor(private readonly _deps: ServerSelectionCoordinatorDeps) {}

    async selectServer(serverId: string): Promise<OrchestratorServerSelectionResult> {
        const selectionResult = await this._deps.selectServer(serverId);
        if (selectionResult.kind !== 'selected') {
            return {
                kind: 'selection_failed',
                reason:
                    selectionResult.kind === 'server_not_found'
                        ? 'server_not_found'
                        : selectionResult.reason,
            };
        }

        const persistedSelection = await this._deps.persistSelection(
            serverId,
            this._deps.getSelectedServerUri()
        );
        await this._deps.runPostSelectionRuntimeSwap();

        return {
            kind: 'selected',
            readiness: this._deps.getReadiness(),
            persistedSelection,
        };
    }
}
