import type {
    PlexDiscoverySignalOptions,
} from '../../modules/plex/discovery';
import type {
    PersistedSelectedServerSnapshot,
    SelectedServerPersistenceResult,
    SelectedServerStartupResumeResult,
} from './ServerSelectionTypes';

export interface SelectedServerRuntimeControllerDeps {
    capturePersistedSelectionSnapshot(): Promise<PersistedSelectedServerSnapshot>;
    persistSelection(
        serverId: string | null,
        serverUri: string | null
    ): Promise<SelectedServerPersistenceResult>;
    restorePersistedSelectionSnapshot(
        snapshot: PersistedSelectedServerSnapshot
    ): Promise<SelectedServerPersistenceResult>;
    resumeStartupAfterSelection(options?: PlexDiscoverySignalOptions): Promise<SelectedServerStartupResumeResult>;
    clearDiscoverySelection(): void;
}

export class SelectedServerRuntimeController {
    constructor(private readonly _deps: SelectedServerRuntimeControllerDeps) {}

    async capturePersistedSelectionSnapshot(): Promise<PersistedSelectedServerSnapshot> {
        return this._deps.capturePersistedSelectionSnapshot();
    }

    async persistSelection(
        serverId: string,
        serverUri: string | null
    ): Promise<SelectedServerPersistenceResult> {
        return this._deps.persistSelection(serverId, serverUri);
    }

    async restorePersistedSelectionSnapshot(
        snapshot: PersistedSelectedServerSnapshot
    ): Promise<SelectedServerPersistenceResult> {
        return this._deps.restorePersistedSelectionSnapshot(snapshot);
    }

    async resumeStartupAfterSelection(
        options?: PlexDiscoverySignalOptions
    ): Promise<SelectedServerStartupResumeResult> {
        return this._deps.resumeStartupAfterSelection(options);
    }

    async clearSelection(): Promise<SelectedServerPersistenceResult> {
        const result = await this._deps.persistSelection(null, null);
        this._deps.clearDiscoverySelection();
        return result;
    }
}
