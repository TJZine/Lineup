import type {
    PlexDiscoverySelectedServerSnapshot,
    PlexServerSelectionFailureReason,
} from '../../modules/plex/discovery';
import type { EpgScheduleRefreshOutcome } from '../../shared/epgRefresh';
export type SelectedServerPersistenceResult =
    'updated'
    | 'skipped_missing_credentials'
    | 'skipped_corrupted_credentials';

export type DiscoverySelectedServerSnapshot = PlexDiscoverySelectedServerSnapshot;

export type OrchestratorServerSelectionResult =
    | {
        kind: 'selection_failed';
        reason: 'server_not_found' | PlexServerSelectionFailureReason;
    }
    | {
        kind: 'selected';
        persistedSelection: SelectedServerPersistenceResult;
        epgRefresh: EpgScheduleRefreshOutcome;
    };
