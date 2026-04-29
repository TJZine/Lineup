import { EventEmitter } from '../../../utils/EventEmitter';
import { PLEX_DISCOVERY_CONSTANTS, DEFAULT_MIXED_CONTENT_CONFIG } from './constants';
import {
    IPlexServerDiscovery,
    PlexServerSelectionResult,
    PlexServerDiscoveryConfig,
} from './interfaces';
import {
    PlexServer,
    PlexConnection,
    PlexServerDiscoveryState,
    PlexServerDiscoveryEvents,
    PlexApiResource,
    PlexApiConnection,
    MixedContentConfig,
    PlexDiscoverySelectedServerSnapshot,
} from './types';
import {
    findFastestConnectionProbe,
    PlexConnectionProbeResult,
} from './discoveryProbe';
import { AppErrorCode } from '../../../types/app-errors';
import { PlexApiError } from '../auth/plexAuthTransport';
import { redactSensitiveTokens, redactUrlForLog } from '../../../utils/redact';
import { ServerSelectionStore } from './ServerSelectionStore';
import { logPlexError, logPlexWarning } from '../shared/plexLogging';
import { discoverPlexResourcesWithRequestPolicy } from './PlexResourceDiscoveryRequestPolicy';

// Re-export for consumers
export { PlexApiError };

export class PlexServerDiscovery implements IPlexServerDiscovery {
    private _state: PlexServerDiscoveryState;
    private _emitter: EventEmitter<PlexServerDiscoveryEvents>;
    private _getAuthHeaders: () => Record<string, string>;
    private _mixedContentConfig: MixedContentConfig;
    private _serverSelectionStore: ServerSelectionStore;
    private _discoveryPromise: Promise<PlexServer[]> | null = null;
    private _discoveryContextVersion = 0;
    private _selectedServerStorageKey: string;
    private _serverHealthStorageKey: string;

    constructor(config: PlexServerDiscoveryConfig) {
        this._getAuthHeaders = config.getAuthHeaders;
        this._emitter = new EventEmitter<PlexServerDiscoveryEvents>();
        this._mixedContentConfig = { ...DEFAULT_MIXED_CONTENT_CONFIG };
        this._selectedServerStorageKey = PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY;
        this._serverHealthStorageKey = PLEX_DISCOVERY_CONSTANTS.SERVER_HEALTH_KEY;
        this._serverSelectionStore = new ServerSelectionStore(() => ({
            selectedServerKey: this._selectedServerStorageKey,
            serverHealthKey: this._serverHealthStorageKey,
        }));
        this._state = {
            servers: [],
            selectedServer: null,
            selectedConnection: null,
            lastRefreshAt: null,
            isDiscovering: false,
        };
    }

    public discoverServers(): Promise<PlexServer[]> {
        // Return cached servers if still fresh (avoid unnecessary plex.tv calls)
        if (
            this._state.lastRefreshAt !== null &&
            this._state.servers.length > 0 &&
            Date.now() - this._state.lastRefreshAt < PLEX_DISCOVERY_CONSTANTS.SERVER_CACHE_DURATION_MS
        ) {
            return Promise.resolve([...this._state.servers]);
        }

        // Return pending promise if discovery already in progress
        if (this._discoveryPromise) {
            return this._discoveryPromise;
        }

        const contextVersion = this._discoveryContextVersion;
        const discoveryPromise = this._doDiscoverServers(contextVersion).finally(() => {
            if (this._discoveryPromise === discoveryPromise) {
                this._discoveryPromise = null;
            }
        });
        this._discoveryPromise = discoveryPromise;

        return discoveryPromise;
    }

    private async _doDiscoverServers(contextVersion: number): Promise<PlexServer[]> {
        this._state.isDiscovering = true;

        try {
            const headers = this._getAuthHeaders();
            const resources = await discoverPlexResourcesWithRequestPolicy(headers);
            const servers = this._parseResources(resources);

            // Discovery can race with profile/storage-key switches. Ignore results
            // from stale contexts so they cannot overwrite the active user's state.
            if (contextVersion !== this._discoveryContextVersion) {
                return [...this._state.servers];
            }

            this._state.servers = servers;
            this._state.lastRefreshAt = Date.now();

            return servers;
        } catch (error) {
            if (error instanceof PlexApiError) {
                logPlexError(
                    `[Discovery] Discovery failed (API Error): ${error.message}`
                );
                throw error;
            }
            const message = redactSensitiveTokens(error instanceof Error ? error.message : String(error));
            logPlexError(
                `[Discovery] Discovery failed (Network/Other): ${message}`
            );
            throw new PlexApiError(
                AppErrorCode.SERVER_UNREACHABLE,
                `Failed to discover servers: ${message}`,
                undefined,
                true,
                error
            );
        } finally {
            this._state.isDiscovering = false;
        }
    }

    public async refreshServers(): Promise<PlexServer[]> {
        this._state.lastRefreshAt = null;
        return this.discoverServers();
    }
    public async testConnection(
        _server: PlexServer,
        connection: PlexConnection
    ): Promise<number | 'auth_required' | 'access_denied' | null> {
        const probe = await this._probeConnection(connection);
        return this._mapProbeToPublicTestResult(probe);
    }

    private async _probeConnection(connection: PlexConnection): Promise<PlexConnectionProbeResult> {
        const url = new URL(PLEX_DISCOVERY_CONSTANTS.IDENTITY_ENDPOINT, connection.uri).toString();
        const headers = this._getAuthHeaders();
        const startTime = Date.now();

        const controller = new AbortController();
        const timeoutId = setTimeout(function () {
            controller.abort();
        }, PLEX_DISCOVERY_CONSTANTS.CONNECTION_TEST_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: headers,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.status === 401) {
                return { connection, outcome: 'auth_required' };
            }
            if (response.status === 403) {
                return { connection, outcome: 'access_denied' };
            }
            if (!response.ok) {
                return { connection, outcome: 'unreachable' };
            }

            const latency = Date.now() - startTime;
            return {
                connection: this._createConnectionWithLatency(connection, latency),
                outcome: 'reachable',
            };
        } catch {
            clearTimeout(timeoutId);
            return { connection, outcome: 'unreachable' };
        }
    }

    public async findFastestConnection(
        server: PlexServer
    ): Promise<{
        connection: PlexConnection | null;
        authRequired: boolean;
        authState: 'auth_required' | 'access_denied' | null;
    }> {
        const probeSummary = await findFastestConnectionProbe({
            server,
            mixedContentConfig: this._mixedContentConfig,
            probeConnection: (connection) => this._probeConnectionFromTestConnection(server, connection),
        });

        return {
            connection: probeSummary.selectedProbe?.connection ?? null,
            authRequired: probeSummary.authRequired,
            authState: probeSummary.authState,
        };
    }

    private _mapProbeToPublicTestResult(
        probe: PlexConnectionProbeResult
    ): number | 'auth_required' | 'access_denied' | null {
        if (probe.outcome === 'reachable') {
            return probe.connection.latencyMs;
        }
        if (probe.outcome === 'auth_required' || probe.outcome === 'access_denied') {
            return probe.outcome;
        }
        return null;
    }

    private async _probeConnectionFromTestConnection(
        server: PlexServer,
        connection: PlexConnection
    ): Promise<PlexConnectionProbeResult> {
        const publicResult = await this.testConnection(server, connection);

        if (typeof publicResult === 'number') {
            return {
                connection: this._createConnectionWithLatency(connection, publicResult),
                outcome: 'reachable',
            };
        }
        if (publicResult === 'auth_required' || publicResult === 'access_denied') {
            return {
                connection,
                outcome: publicResult,
            };
        }
        return {
            connection,
            outcome: 'unreachable',
        };
    }

    private _createConnectionWithLatency(conn: PlexConnection, latency: number): PlexConnection {
        return {
            uri: conn.uri,
            protocol: conn.protocol,
            address: conn.address,
            port: conn.port,
            local: conn.local,
            relay: conn.relay,
            latencyMs: latency,
        };
    }

    public async selectServer(serverId: string): Promise<PlexServerSelectionResult> {
        const server = this._findServerById(serverId);

        if (!server) {
            return { kind: 'server_not_found' };
        }

        const { connection, authRequired, authState } = await this.findFastestConnection(server);

        if (!connection) {
            const reason = authState ?? (authRequired ? 'auth_required' : 'unreachable');
            this._persistServerHealth(serverId, reason);
            return {
                kind: 'connection_unavailable',
                reason,
            };
        }

        const serverWithConnection: PlexServer = {
            ...server,
            preferredConnection: connection,
        };

        this._state.selectedServer = serverWithConnection;
        this._state.selectedConnection = connection;

        this._serverSelectionStore.writeSelectedServerId(serverId);

        // Emit events
        this._emitter.emit('serverChange', serverWithConnection);
        this._emitter.emit('connectionChange', connection.uri);

        this._persistServerHealth(serverId, 'ok', {
            connection: connection,
            latency: connection.latencyMs ?? 0
        });

        return { kind: 'selected' };
    }

    public captureSelectedServerSnapshot(): PlexDiscoverySelectedServerSnapshot {
        return {
            server: this._cloneSelectedServer(this._state.selectedServer, this._state.selectedConnection),
            connection: this._cloneConnection(this._state.selectedConnection),
            storedServerId: this._serverSelectionStore.readSelectedServerId(),
        };
    }

    public restoreSelectedServerSnapshot(snapshot: PlexDiscoverySelectedServerSnapshot): void {
        const previousServerId = this._state.selectedServer?.id ?? null;
        const previousConnectionUri = this._state.selectedConnection?.uri ?? null;
        const nextConnection = this._cloneConnection(snapshot.connection);
        const nextServer = this._cloneSelectedServer(snapshot.server, nextConnection);

        this._state.selectedServer = nextServer;
        this._state.selectedConnection = nextConnection;

        if (snapshot.storedServerId) {
            this._serverSelectionStore.writeSelectedServerId(snapshot.storedServerId);
        } else {
            this._serverSelectionStore.clearSelectedServerId();
        }

        const nextServerId = nextServer?.id ?? null;
        const nextConnectionUri = nextConnection?.uri ?? null;
        if (previousServerId !== nextServerId) {
            this._emitter.emit('serverChange', nextServer);
        }
        if (previousConnectionUri !== nextConnectionUri) {
            this._emitter.emit('connectionChange', nextConnectionUri);
        }
    }

    public getSelectedServer(): PlexServer | null {
        return this._state.selectedServer;
    }

    public getSelectedConnection(): PlexConnection | null {
        return this._state.selectedConnection;
    }

    public getServerUri(): string | null {
        if (this._state.selectedConnection) {
            return this._state.selectedConnection.uri;
        }
        return null;
    }
    public getHttpsConnection(): PlexConnection | null {
        const server = this._state.selectedServer;
        if (!server) {
            return null;
        }

        for (const conn of server.connections) {
            if (conn.protocol === 'https' && !conn.relay) {
                return conn;
            }
        }
        return null;
    }

    public getRelayConnection(): PlexConnection | null {
        const server = this._state.selectedServer;
        if (!server) {
            return null;
        }

        for (const conn of server.connections) {
            if (conn.relay) {
                return conn;
            }
        }
        return null;
    }

    public getActiveConnectionUri(): string | null {
        return this.getServerUri();
    }

    public clearSelection(): void {
        this._state.selectedServer = null;
        this._state.selectedConnection = null;
        this._serverSelectionStore.clearSelectedServerId();
        this._emitter.emit('serverChange', null);
        this._emitter.emit('connectionChange', null);
    }

    public getServers(): PlexServer[] {
        return this._state.servers;
    }

    public isConnected(): boolean {
        return this._state.selectedServer !== null &&
            this._state.selectedConnection !== null;
    }
    public on(
        event: 'serverChange',
        handler: (server: PlexServer | null) => void
    ): { dispose: () => void };
    public on(
        event: 'connectionChange',
        handler: (uri: string | null) => void
    ): { dispose: () => void };
    public on(
        event: 'serverChange' | 'connectionChange',
        handler: ((server: PlexServer | null) => void) | ((uri: string | null) => void)
    ): { dispose: () => void } {
        return this._emitter.on(event, handler as (payload: unknown) => void);
    }

    public async initialize(): Promise<void> {
        const previousRefreshAt = this._state.lastRefreshAt;
        await this.discoverServers();
        const refreshedDiscovery = this._state.lastRefreshAt !== previousRefreshAt;
        await this._restoreSelectionAsync({ forceReselect: refreshedDiscovery });
    }

    public setStorageKeys(selectedServerKey: string, serverHealthKey: string): void {
        const normalizedSelectedServerKey = selectedServerKey.trim();
        if (normalizedSelectedServerKey.length === 0) {
            throw new Error('selectedServerKey must be a non-empty string');
        }
        const normalizedServerHealthKey = serverHealthKey.trim();
        if (normalizedServerHealthKey.length === 0) {
            throw new Error('serverHealthKey must be a non-empty string');
        }
        // Bump context to invalidate any in-flight discovery started under the
        // previous profile/user storage namespace.
        this._discoveryContextVersion += 1;
        this._discoveryPromise = null;
        this._selectedServerStorageKey = normalizedSelectedServerKey;
        this._serverHealthStorageKey = normalizedServerHealthKey;
        this._state.selectedServer = null;
        this._state.selectedConnection = null;
        this._state.lastRefreshAt = null;
        this._state.servers = [];
    }

    private _parseResources(resources: PlexApiResource[]): PlexServer[] {
        const servers: PlexServer[] = [];

        for (const resource of resources) {
            // Filter for server capability
            if (!resource.provides || !resource.provides.includes('server')) {
                continue;
            }

            const connections = this._parseConnections(resource.connections || []);
            const capabilities = resource.provides.split(',');

            servers.push({
                id: resource.clientIdentifier,
                name: resource.name,
                sourceTitle: resource.sourceTitle,
                ownerId: resource.ownerId,
                owned: resource.owned,
                connections: connections,
                capabilities: capabilities,
                preferredConnection: null,
            });
        }

        return servers;
    }

    private _parseConnections(apiConnections: PlexApiConnection[]): PlexConnection[] {
        const connections: PlexConnection[] = [];

        for (const conn of apiConnections) {
            const normalizedUri = this._normalizeConnectionUri(conn.uri);
            if (!normalizedUri) {
                logPlexWarning(
                    'Skipping invalid Plex connection URI:',
                    this._redactUrl(conn.uri)
                );
                continue;
            }

            const parsed = new URL(normalizedUri);
            const protocol: 'https' | 'http' = parsed.protocol === 'https:' ? 'https' : 'http';

            connections.push({
                uri: normalizedUri,
                protocol,
                address: conn.address,
                port: conn.port,
                local: Boolean(conn.local),
                relay: Boolean(conn.relay),
                latencyMs: null,
            });
        }

        return connections;
    }

    private _cloneConnection(connection: PlexConnection | null): PlexConnection | null {
        return connection ? { ...connection } : null;
    }

    private _cloneSelectedServer(
        server: PlexServer | null,
        selectedConnection: PlexConnection | null
    ): PlexServer | null {
        if (!server) {
            return null;
        }

        return {
            ...server,
            connections: server.connections.map((connection) => ({ ...connection })),
            preferredConnection: selectedConnection ? { ...selectedConnection } : null,
        };
    }

    private _normalizeConnectionUri(uri: string): string | null {
        try {
            const parsed = new URL(uri);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return null;
            }
            if (parsed.username || parsed.password) {
                return null;
            }
            if (!parsed.hostname) {
                return null;
            }
            // Normalize to origin to avoid path/query surprises and to strip trailing slashes.
            return parsed.origin;
        } catch {
            return null;
        }
    }

    private _findServerById(serverId: string): PlexServer | undefined {
        for (const server of this._state.servers) {
            if (server.id === serverId) {
                return server;
            }
        }
        return undefined;
    }

    private _persistServerHealth(
        serverId: string,
        status: 'ok' | 'unreachable' | 'auth_required' | 'access_denied',
        details?: { connection?: PlexConnection; latency?: number }
    ): void {
        const input = {
            serverId,
            status,
            testedAt: Date.now(),
            ...(details ? { details } : {}),
        };
        this._serverSelectionStore.writeServerHealthRecord(input);
    }

    private _redactUrl(url: string | undefined): string {
        if (!url) return '';
        return redactUrlForLog(url);
    }

    private async _restoreSelectionAsync(options?: { forceReselect?: boolean }): Promise<void> {
        if (this._state.servers.length === 0) {
            return;
        }

        // Storage at initialize-time is the source of truth.
        const savedServerId = this._serverSelectionStore.readSelectedServerIdAndClean();

        if (!savedServerId) {
            return;
        }

        if (
            options?.forceReselect !== true &&
            this._state.selectedServer?.id === savedServerId &&
            this._state.selectedConnection !== null
        ) {
            return;
        }

        await this.selectServer(savedServerId);
    }
}
