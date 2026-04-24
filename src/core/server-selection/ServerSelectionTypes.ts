import type {
    PlexConnection,
    PlexServer,
    PlexServerSelectionFailureReason,
} from '../../modules/plex/discovery';

export type OrchestratorServerSelectionReadiness = 'ready' | 'startup_pending';
export type SelectedServerPersistenceResult =
    'updated'
    | 'skipped_missing_credentials'
    | 'skipped_corrupted_credentials';

export interface SelectedServerRecordSnapshot {
    serverId: string | null;
    serverUri: string | null;
}

export type PersistedSelectedServerSnapshot =
    | {
        kind: 'available';
        selection: SelectedServerRecordSnapshot;
    }
    | {
        kind: 'missing_credentials';
    }
    | {
        kind: 'corrupted_credentials';
    };

export interface DiscoverySelectedServerSnapshot {
    server: PlexServer | null;
    connection: PlexConnection | null;
    storedServerId: string | null;
}

export type OrchestratorServerSelectionResult =
    | {
        kind: 'selection_failed';
        reason: 'server_not_found' | PlexServerSelectionFailureReason;
    }
    | {
        kind: 'selected';
        readiness: OrchestratorServerSelectionReadiness;
        persistedSelection: SelectedServerPersistenceResult;
    };
