import type { PlexServer } from '../../plex/discovery/types';
import type { PlexServerSelectionFailureReason } from '../../plex/discovery';
import type { ServerSelectScreenNavigationPort } from '../../navigation';
import type { EpgScheduleRefreshOutcome } from '../../../shared/epgRefresh';

export type ServerSelectHealthRecord = {
    status?: string;
    type?: string;
    protocol?: 'http' | 'https';
    latencyMs?: number;
    testedAt?: number;
};

export type ServerSelectDisplayState = {
    selectedServerId: string | null;
    serverHealth: Record<string, ServerSelectHealthRecord | undefined>;
};

export type ServerSelectEmptyStateReason = 'no_servers' | 'discovery_failed';

export type ServerSelectSelectionFailureReason = 'server_not_found' | PlexServerSelectionFailureReason;

export type ServerSelectSelectionResult =
    | {
        kind: 'selection_failed';
        reason: ServerSelectSelectionFailureReason;
    }
    | {
        kind: 'selected';
        persistedSelection:
            | 'updated'
            | 'skipped_missing_credentials'
            | 'skipped_corrupted_credentials';
        epgRefresh: EpgScheduleRefreshOutcome;
    };

export type ServerSelectRerunSetupResult =
    | { ok: true; serverId: string }
    | { ok: false; reason: 'missing-selected-server' };

export interface ServerSelectScreenPorts {
    discoverServers(options?: { forceRefresh?: boolean; signal?: AbortSignal | null }): Promise<PlexServer[]>;
    selectServer(serverId: string, options?: { signal?: AbortSignal | null }): Promise<ServerSelectSelectionResult>;
    clearSelectedServer(): Promise<void>;
    getSelectedServerScreenState(): ServerSelectDisplayState;
    requestChannelSetupRerun(): ServerSelectRerunSetupResult;
    getNavigation(): ServerSelectScreenNavigationPort | null;
}
