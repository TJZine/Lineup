import type {
    PlexAuthData,
    PlexStoredCredentialsReadResult,
} from '../../modules/plex/auth';
import type {
    PersistedSelectedServerSnapshot,
    SelectedServerPersistenceResult,
} from './ServerSelectionTypes';

export interface SelectedServerCredentialsPort {
    getActiveUserId(): string | null;
    readStoredCredentialsAndClearCorruption(): PlexStoredCredentialsReadResult;
    storeCredentials(auth: PlexAuthData, options?: { emitAuthChange?: boolean }): void;
}

export interface SelectedServerPersistenceAdapterDeps {
    getCredentialsPort(): SelectedServerCredentialsPort | null;
}

export class SelectedServerPersistenceAdapter {
    constructor(private readonly _deps: SelectedServerPersistenceAdapterDeps) {}

    async persistSelection(
        serverId: string | null,
        serverUri: string | null
    ): Promise<SelectedServerPersistenceResult> {
        const port = this._deps.getCredentialsPort();
        if (!port) {
            return 'skipped_missing_credentials';
        }
        const stored = port.readStoredCredentialsAndClearCorruption();
        if (stored.kind === 'missing') {
            return 'skipped_missing_credentials';
        }
        if (stored.kind === 'corrupted') {
            return 'skipped_corrupted_credentials';
        }
        const credentials = stored.credentials;
        const activeUserId = port.getActiveUserId() ?? credentials.activeUserId;
        if (!activeUserId) {
            return 'skipped_missing_credentials';
        }
        const selectedServerByUserId = {
            ...(credentials.selectedServerByUserId ?? {}),
        };
        selectedServerByUserId[activeUserId] = { serverId, serverUri };
        port.storeCredentials(
            {
                accountToken: credentials.accountToken,
                activeToken: credentials.activeToken,
                activeUserId,
                selectedServerByUserId,
                deviceKey: credentials.deviceKey ?? null,
            },
            { emitAuthChange: false }
        );
        return 'updated';
    }

    async capturePersistedSelectionSnapshot(): Promise<PersistedSelectedServerSnapshot> {
        const port = this._deps.getCredentialsPort();
        if (!port) {
            return { kind: 'missing_credentials' };
        }

        const stored = port.readStoredCredentialsAndClearCorruption();
        if (stored.kind === 'missing') {
            return { kind: 'missing_credentials' };
        }
        if (stored.kind === 'corrupted') {
            return { kind: 'corrupted_credentials' };
        }

        const credentials = stored.credentials;
        const activeUserId = port.getActiveUserId() ?? credentials.activeUserId;
        if (!activeUserId) {
            return { kind: 'missing_credentials' };
        }

        const selection = credentials.selectedServerByUserId?.[activeUserId] ?? {
            serverId: null,
            serverUri: null,
        };
        return {
            kind: 'available',
            selection: {
                serverId: selection.serverId ?? null,
                serverUri: selection.serverUri ?? null,
            },
        };
    }

    async restorePersistedSelectionSnapshot(
        snapshot: PersistedSelectedServerSnapshot
    ): Promise<SelectedServerPersistenceResult> {
        if (snapshot.kind === 'corrupted_credentials') {
            return 'skipped_corrupted_credentials';
        }
        if (snapshot.kind === 'missing_credentials') {
            return 'skipped_missing_credentials';
        }

        return this.persistSelection(
            snapshot.selection.serverId,
            snapshot.selection.serverUri
        );
    }
}
