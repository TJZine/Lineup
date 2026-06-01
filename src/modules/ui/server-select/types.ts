import type { PlexServer } from '../../plex/discovery/types';
import type { PlexServerSelectionFailureReason } from '../../plex/discovery';
import type { ServerSelectScreenNavigationPort } from '../../navigation';

export type ServerSelectHealthRecord = {
    status?: string;
    type?: string;
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
    };

export interface ServerSelectScreenPorts {
    discoverServers(options?: { forceRefresh?: boolean; signal?: AbortSignal | null }): Promise<PlexServer[]>;
    selectServer(serverId: string, options?: { signal?: AbortSignal | null }): Promise<ServerSelectSelectionResult>;
    clearSelectedServer(): Promise<void>;
    getSelectedServerScreenState(): ServerSelectDisplayState;
    requestChannelSetupRerun(): void;
    getNavigation(): ServerSelectScreenNavigationPort | null;
}
