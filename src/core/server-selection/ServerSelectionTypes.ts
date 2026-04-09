import type { PlexServerSelectionFailureReason } from '../../modules/plex/discovery';

export type OrchestratorServerSelectionReadiness = 'ready' | 'startup_pending';
export type SelectedServerPersistenceResult =
    'updated'
    | 'skipped_missing_credentials'
    | 'skipped_corrupted_credentials';

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
