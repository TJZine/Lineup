import type { PlexServerSelectionFailureReason } from '../../modules/plex/discovery';

export type OrchestratorServerSelectionResult =
    | {
        kind: 'selection_failed';
        reason: 'server_not_found' | PlexServerSelectionFailureReason;
    }
    | {
        kind: 'selected';
        readiness: 'ready' | 'startup_pending';
        persistedSelection: 'updated' | 'skipped_missing_credentials' | 'skipped_corrupted_credentials';
    };
