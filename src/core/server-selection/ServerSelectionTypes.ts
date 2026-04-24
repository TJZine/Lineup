import type {
    PlexDiscoverySelectedServerSnapshot,
    PlexServerSelectionFailureReason,
} from '../../modules/plex/discovery';

export type OrchestratorServerSelectionReadiness = 'ready' | 'startup_pending';
export type SelectedServerPersistenceResult =
    'updated'
    | 'skipped_missing_credentials'
    | 'skipped_corrupted_credentials';

export type SelectedServerStartupResumeResult = {
    startup: 'completed' | 'skipped_no_coordinator';
    epgRefresh:
        | { kind: 'succeeded' }
        | { kind: 'failed'; error: unknown }
        | { kind: 'skipped_no_coordinator' };
};

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

export type DiscoverySelectedServerSnapshot = PlexDiscoverySelectedServerSnapshot;

export type OrchestratorServerSelectionResult =
    | {
        kind: 'selection_failed';
        reason: 'server_not_found' | PlexServerSelectionFailureReason;
    }
    | {
        kind: 'selected';
        readiness: OrchestratorServerSelectionReadiness;
        persistedSelection: SelectedServerPersistenceResult;
        startupResume: SelectedServerStartupResumeResult;
    };
