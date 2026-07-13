import type { SelectedServerPersistenceResult } from './ServerSelectionTypes';

export interface SelectedServerRuntimeControllerDeps {
    clearPersistedSelection(): Promise<SelectedServerPersistenceResult>;
    clearDiscoverySelection(): void;
}

export class SelectedServerRuntimeController {
    constructor(private readonly _deps: SelectedServerRuntimeControllerDeps) {}

    async clearSelection(): Promise<SelectedServerPersistenceResult> {
        const result = await this._deps.clearPersistedSelection();
        this._deps.clearDiscoverySelection();
        return result;
    }
}
