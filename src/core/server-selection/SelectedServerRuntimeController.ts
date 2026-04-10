import type { SelectedServerPersistenceResult } from './ServerSelectionTypes';

export interface SelectedServerRuntimeControllerDeps {
    persistSelection(
        serverId: string | null,
        serverUri: string | null
    ): Promise<SelectedServerPersistenceResult>;
    runPostSelectionRuntimeSwap(): Promise<void>;
    clearDiscoverySelection(): void;
}

export class SelectedServerRuntimeController {
    constructor(private readonly _deps: SelectedServerRuntimeControllerDeps) {}

    async persistSelection(
        serverId: string,
        serverUri: string | null
    ): Promise<SelectedServerPersistenceResult> {
        return this._deps.persistSelection(serverId, serverUri);
    }

    async applySelectionRuntimeSwap(): Promise<void> {
        await this._deps.runPostSelectionRuntimeSwap();
    }

    async clearSelection(): Promise<SelectedServerPersistenceResult> {
        this._deps.clearDiscoverySelection();
        return this._deps.persistSelection(null, null);
    }
}
