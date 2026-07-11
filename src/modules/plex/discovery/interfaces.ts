import { PlexServer, PlexConnection, PlexDiscoverySelectedServerSnapshot } from './types';
import { IDisposable } from '../../../utils/interfaces';

export type PlexServerSelectionFailureReason =
    | 'unreachable'
    | 'auth_required'
    | 'access_denied';

export type PlexServerSelectionResult =
    | { kind: 'selected' }
    | { kind: 'server_not_found' }
    | { kind: 'connection_unavailable'; reason: PlexServerSelectionFailureReason };

export type PlexSavedServerRestoreResult =
    | { kind: 'skipped_no_servers' }
    | { kind: 'skipped_no_saved_server' }
    | { kind: 'already_selected'; serverId: string }
    | { kind: 'selected'; serverId: string }
    | {
        kind: 'selection_failed';
        serverId: string;
        reason: 'server_not_found' | PlexServerSelectionFailureReason;
    };

export interface PlexDiscoverySignalOptions {
    signal?: AbortSignal | null;
}

export interface IPlexServerDiscovery {
    discoverServers(options?: PlexDiscoverySignalOptions): Promise<PlexServer[]>;
    refreshServers(options?: PlexDiscoverySignalOptions): Promise<PlexServer[]>;
    initialize(options?: PlexDiscoverySignalOptions): Promise<PlexSavedServerRestoreResult>;
    setStorageKeys(selectedServerKey: string, serverHealthKey: string): void;

    /**
     * Returns latency in ms, an auth failure state, or null when the endpoint is unusable.
     */
    testConnection(
        server: PlexServer,
        connection: PlexConnection,
        options?: PlexDiscoverySignalOptions
    ): Promise<number | 'auth_required' | 'access_denied' | null>;

    /**
     * Find the fastest working connection for a server.
     * Tests connections in priority order: local > remote > relay.
     * @param server - Server to test connections for
     * @returns Promise resolving to best connection info.
     * authRequired indicates whether any tested connection required auth.
     */
    findFastestConnection(server: PlexServer, options?: PlexDiscoverySignalOptions): Promise<{
        connection: PlexConnection | null;
        authRequired: boolean;
        authState: 'auth_required' | 'access_denied' | null;
    }>;

    /**
     * Persists the selection and reports a structured outcome instead of relying on side effects alone.
     * Rejects with PlexDiscoverySelectionSupersededError when its storage context changes.
     */
    selectServer(serverId: string, options?: PlexDiscoverySignalOptions): Promise<PlexServerSelectionResult>;
    getSelectedServer(): PlexServer | null;
    getSelectedConnection(): PlexConnection | null;
    getServerUri(): string | null;

    /**
     * Used by the stream resolver when direct playback needs an HTTPS fallback.
     */
    getHttpsConnection(): PlexConnection | null;

    /**
     * Used by the stream resolver when only relay playback can satisfy the request.
     */
    getRelayConnection(): PlexConnection | null;

    getActiveConnectionUri(): string | null;
    clearSelection(): void;

    /**
     * Capture selected-server state for a transactional rollback.
     */
    captureSelectedServerSnapshot(): PlexDiscoverySelectedServerSnapshot;

    /**
     * Restore selected-server state captured by captureSelectedServerSnapshot.
     * Throws PlexDiscoverySelectionSupersededError when the snapshot belongs to an older storage context.
     */
    restoreSelectedServerSnapshot(snapshot: PlexDiscoverySelectedServerSnapshot): void;
    getServers(): PlexServer[];
    isConnected(): boolean;

    /**
     * Registers a disposable server-change listener.
     */
    on(event: 'serverChange', handler: (server: PlexServer | null) => void): IDisposable;

    /**
     * Registers a disposable connection-change listener.
     */
    on(event: 'connectionChange', handler: (uri: string | null) => void): IDisposable;
}

export interface PlexServerDiscoveryConfig {
    getAuthHeaders: () => Record<string, string>;
}
