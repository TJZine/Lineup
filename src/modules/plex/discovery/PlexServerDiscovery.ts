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
} from './types';
import { AppErrorCode } from '../../lifecycle/types';
import { PlexApiError } from '../auth/plexAuthTransport';
import { redactSensitiveTokens, redactUrlForLog } from '../../../utils/redact';
import { ServerSelectionStore } from './ServerSelectionStore';
import {
    applyXPlexTokenQueryParamIfTrusted,
    PLEX_CLOUD_TRUSTED_ORIGINS,
} from '../shared/plexUrl';
import { logPlexError, logPlexWarning } from '../shared/plexLogging';

// Re-export for consumers
export { AppErrorCode, PlexApiError };

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
        let lastUrl = '';

        try {
            const baseUrl = new URL(
                PLEX_DISCOVERY_CONSTANTS.PLEX_TV_BASE_URL + PLEX_DISCOVERY_CONSTANTS.RESOURCES_ENDPOINT
            );
            baseUrl.search = `?${PLEX_DISCOVERY_CONSTANTS.RESOURCES_PARAMS}`;

            const headers = this._getAuthHeaders();
            const token = headers['X-Plex-Token'];
            const baseUrlString = baseUrl.toString();
            const clientsBaseUrl = new URL('https://clients.plex.tv/api/v2/resources');
            clientsBaseUrl.search = `?${PLEX_DISCOVERY_CONSTANTS.RESOURCES_PARAMS}`;

            const variants: Array<{ url: string; headers?: Record<string, string> }> = [
                { url: baseUrlString, headers: headers },
            ];
            if (token) {
                const urlWithToken = new URL(baseUrlString);
                // Only attach X-Plex-Token to URLs on the trusted Plex cloud origin allowlist.
                applyXPlexTokenQueryParamIfTrusted(urlWithToken, token, PLEX_CLOUD_TRUSTED_ORIGINS);
                variants.push({ url: urlWithToken.toString(), headers });

                const clientsUrlWithToken = new URL(clientsBaseUrl.toString());
                // The same trusted-origin rule applies to clients.plex.tv fallback variants.
                applyXPlexTokenQueryParamIfTrusted(clientsUrlWithToken, token, PLEX_CLOUD_TRUSTED_ORIGINS);
                variants.push({ url: clientsUrlWithToken.toString(), headers });
            }

            const maxAttempts = PLEX_DISCOVERY_CONSTANTS.MAX_DISCOVERY_ATTEMPTS;
            let response: Response | null = null;
            let lastError: unknown = null;
            let lastNonOkResponse: Response | null = null;

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                let retryScheduled = false;
                for (const variant of variants) {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(
                        () => controller.abort(),
                        PLEX_DISCOVERY_CONSTANTS.DISCOVERY_TIMEOUT_MS
                    );
                    try {
                        lastUrl = variant.url;
                        const init: RequestInit = {
                            method: 'GET',
                            signal: controller.signal,
                        };
                        if (variant.headers) {
                            init.headers = variant.headers;
                        }
                        response = await fetch(variant.url, init);
                    } catch (error) {
                        lastError = error;
                        continue;
                    } finally {
                        clearTimeout(timeoutId);
                    }

                    if (response.status === 429 && attempt < maxAttempts - 1) {
                        const retryAfter = response.headers.get('Retry-After');
                        const parsed = retryAfter ? parseInt(retryAfter, 10) : NaN;
                        const delayMs = Number.isFinite(parsed) && parsed > 0
                            ? parsed * 1000
                            : PLEX_DISCOVERY_CONSTANTS.RATE_LIMIT_DEFAULT_DELAY_MS;
                        await new Promise((resolve) => setTimeout(resolve, delayMs));
                        response = null;
                        retryScheduled = true;
                        break;
                    }

                    // If one variant is temporarily unhealthy (5xx), try the next variant in the same attempt.
                    if (response.status >= 500 && response.status <= 599) {
                        lastNonOkResponse = response;
                        lastError = new Error(`Request failed with status ${response.status}`);
                        response = null;
                        continue;
                    }

                    break;
                }

                if (response) {
                    break;
                }
                if (retryScheduled) {
                    continue;
                }
                // Brief backoff if all variants in this attempt failed with 5xx to avoid hammering plex.tv.
                if (lastNonOkResponse && attempt < maxAttempts - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 500));
                }
            }

            if (!response) {
                if (lastNonOkResponse) {
                    this._handleResponseError(lastNonOkResponse);
                }
                const message = redactSensitiveTokens(
                    lastError instanceof Error
                        ? lastError.message
                        : 'unknown error'
                );
                throw new PlexApiError(
                    AppErrorCode.SERVER_UNREACHABLE,
                    `Failed to discover servers: ${message} (last url: ${this._redactUrl(lastUrl) || 'unknown'})`,
                    undefined,
                    true
                );
            }
            if (!response.ok) {
                this._handleResponseError(response);
            }

            const resources = await this._parseResourcesResponse(response);
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
            const lastUrlInfo = this._redactUrl(lastUrl) || 'unknown';
            if (error instanceof PlexApiError) {
                logPlexError(
                    `[Discovery] Discovery failed (API Error): ${error.message} (last url: ${lastUrlInfo})`
                );
                throw error;
            }
            const message = redactSensitiveTokens(error instanceof Error ? error.message : String(error));
            logPlexError(
                `[Discovery] Discovery failed (Network/Other): ${message} (last url: ${lastUrlInfo})`
            );
            throw new PlexApiError(
                AppErrorCode.SERVER_UNREACHABLE,
                `Failed to discover servers: ${message} (last url: ${lastUrlInfo})`,
                undefined,
                true
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
    ): Promise<number | 'auth_required' | 'auth_invalid' | null> {
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
                return 'auth_required';
            }
            if (response.status === 403) {
                return 'auth_invalid';
            }
            if (!response.ok) {
                return null;
            }

            const latency = Date.now() - startTime;
            return latency;
        } catch {
            clearTimeout(timeoutId);
            return null;
        }
    }

    public async findFastestConnection(
        server: PlexServer
    ): Promise<{
        connection: PlexConnection | null;
        authRequired: boolean;
        authState: 'auth_required' | 'auth_invalid' | null;
    }> {
        const config = this._mixedContentConfig;
        let authRequired = false;
        let authState: 'auth_required' | 'auth_invalid' | null = null;
        const noteAuthState = (state: 'auth_required' | 'auth_invalid'): void => {
            if (state === 'auth_invalid') {
                authState = 'auth_invalid';
                return;
            }
            authRequired = true;
            if (authState === null) {
                authState = 'auth_required';
            }
        };

        // Separate connections by protocol per mixed-content handling requirements
        const httpsConns = server.connections.filter(c => c.protocol === 'https');
        const httpConns = server.connections.filter(c => c.protocol === 'http');

        // If preferHttps is true (default), test HTTPS first
        if (config.preferHttps) {
            // Within HTTPS, prioritize: local > remote > relay
            const localHttps = httpsConns.filter(c => c.local && !c.relay);
            const remoteHttps = httpsConns.filter(c => !c.local && !c.relay);
            const relayHttps = httpsConns.filter(c => c.relay);

            // Test HTTPS connections in priority order
            for (const conn of localHttps) {
                const latency = await this.testConnection(server, conn);
                if (latency === 'auth_required') {
                    noteAuthState('auth_required');
                } else if (latency === 'auth_invalid') {
                    noteAuthState('auth_invalid');
                } else if (latency !== null) {
                    return {
                        connection: this._createConnectionWithLatency(conn, latency),
                        authRequired,
                        authState,
                    };
                }
            }

            for (const conn of remoteHttps) {
                const latency = await this.testConnection(server, conn);
                if (latency === 'auth_required') {
                    noteAuthState('auth_required');
                } else if (latency === 'auth_invalid') {
                    noteAuthState('auth_invalid');
                } else if (latency !== null) {
                    return {
                        connection: this._createConnectionWithLatency(conn, latency),
                        authRequired,
                        authState,
                    };
                }
            }

            for (const conn of relayHttps) {
                const latency = await this.testConnection(server, conn);
                if (latency === 'auth_required') {
                    noteAuthState('auth_required');
                } else if (latency === 'auth_invalid') {
                    noteAuthState('auth_invalid');
                } else if (latency !== null) {
                    return {
                        connection: this._createConnectionWithLatency(conn, latency),
                        authRequired,
                        authState,
                    };
                }
            }
        }

        // Try HTTPS upgrade for HTTP connections if enabled
        if (config.tryHttpsUpgrade) {
            for (const conn of httpConns) {
                const httpsUri = conn.uri.replace('http://', 'https://');
                const upgradedConn: PlexConnection = {
                    uri: httpsUri,
                    protocol: 'https',
                    address: conn.address,
                    port: conn.port,
                    local: conn.local,
                    relay: conn.relay,
                    latencyMs: null,
                };
                const latency = await this.testConnection(server, upgradedConn);
                if (latency === 'auth_required') {
                    noteAuthState('auth_required');
                } else if (latency === 'auth_invalid') {
                    noteAuthState('auth_invalid');
                } else if (latency !== null) {
                    return {
                        connection: this._createConnectionWithLatency(upgradedConn, latency),
                        authRequired,
                        authState,
                    };
                }
            }
        }

        // Only try HTTP as last resort if allowLocalHttp is true
        if (config.allowLocalHttp) {
            const localHttp = httpConns.filter(c => c.local && !c.relay);
            for (const conn of localHttp) {
                const latency = await this.testConnection(server, conn);
                if (latency === 'auth_required') {
                    noteAuthState('auth_required');
                } else if (latency === 'auth_invalid') {
                    noteAuthState('auth_invalid');
                } else if (latency !== null) {
                    if (config.logWarnings) {
                        logPlexWarning('Selected HTTP connection (last resort)', {
                            local: conn.local,
                            relay: conn.relay,
                        });
                    }
                    return {
                        connection: this._createConnectionWithLatency(conn, latency),
                        authRequired,
                        authState,
                    };
                }
            }
        }

        if (config.logWarnings) {
            logPlexWarning('No working connections found', {
                serverId: server.id,
                authRequired,
                httpsCount: httpsConns.length,
                httpCount: httpConns.length,
            });
        }
        return { connection: null, authRequired, authState };
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

        // Update state
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

    private async _parseResourcesResponse(response: Response): Promise<PlexApiResource[]> {
        const contentType =
            response.headers && typeof response.headers.get === 'function'
                ? response.headers.get('Content-Type') || ''
                : '';
        if (typeof response.text !== 'function') {
            if (typeof response.json === 'function') {
                const parsed = await response.json();
                return Array.isArray(parsed) ? (parsed as PlexApiResource[]) : [];
            }
            return [];
        }

        const text = await response.text();
        if (!text) {
            return [];
        }

        // Prefer JSON parsing but tolerate XML payloads from plex.tv.
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
                return parsed as PlexApiResource[];
            }
        } catch {
            // Fall through to XML parsing.
        }

        if (!contentType.includes('xml') && !text.trim().startsWith('<')) {
            throw new PlexApiError(
                AppErrorCode.PARSE_ERROR,
                'Failed to parse server discovery response',
                response.status,
                false
            );
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length > 0) {
            throw new PlexApiError(
                AppErrorCode.PARSE_ERROR,
                'Invalid XML response from server discovery',
                response.status,
                false
            );
        }

        const devices = Array.from(doc.getElementsByTagName('Device'));
        const resources: PlexApiResource[] = [];
        for (const device of devices) {
            const provides = device.getAttribute('provides') || '';
            const connections: PlexApiConnection[] = [];
            const connectionNodes = Array.from(device.getElementsByTagName('Connection'));
            for (const conn of connectionNodes) {
                const portRaw = conn.getAttribute('port');
                const port = portRaw ? Number(portRaw) : 0;
                connections.push({
                    uri: conn.getAttribute('uri') || '',
                    protocol: conn.getAttribute('protocol') || '',
                    address: conn.getAttribute('address') || '',
                    port: Number.isFinite(port) ? port : 0,
                    local: this._parseXmlBoolean(conn.getAttribute('local')),
                    relay: this._parseXmlBoolean(conn.getAttribute('relay')),
                });
            }

            resources.push({
                clientIdentifier: device.getAttribute('clientIdentifier') || '',
                name: device.getAttribute('name') || '',
                sourceTitle: device.getAttribute('sourceTitle') || '',
                ownerId: device.getAttribute('ownerId') || '',
                owned: this._parseXmlBoolean(device.getAttribute('owned')),
                provides: provides,
                connections: connections,
            });
        }

        return resources;
    }

    private _parseXmlBoolean(value: string | null): boolean {
        if (!value) return false;
        return value === '1';
    }

    private _parseConnections(apiConnections: PlexApiConnection[]): PlexConnection[] {
        const connections: PlexConnection[] = [];

        for (const conn of apiConnections) {
            const normalizedUri = this._normalizeConnectionUri(conn.uri);
            if (!normalizedUri) {
                logPlexWarning('[Discovery] Skipping invalid connection URI:', conn.uri);
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

    private _handleResponseError(response: Response): never {
        if (response.status === 401) {
            throw new PlexApiError(
                AppErrorCode.AUTH_REQUIRED,
                'Unauthorized: authentication required',
                401,
                false
            );
        }
        if (response.status === 403) {
            throw new PlexApiError(
                AppErrorCode.AUTH_INVALID,
                'Forbidden: access denied',
                403,
                false
            );
        }
        if (response.status === 429) {
            throw new PlexApiError(
                AppErrorCode.RATE_LIMITED,
                'Request failed with status 429',
                429,
                true
            );
        }
        if (response.status >= 500) {
            throw new PlexApiError(
                AppErrorCode.SERVER_UNREACHABLE,
                'Server error: ' + String(response.status),
                response.status,
                true
            );
        }
        if (response.status >= 400 && response.status < 500) {
            throw new PlexApiError(
                AppErrorCode.SERVER_UNREACHABLE,
                'Client error during server discovery: ' + String(response.status),
                response.status,
                false
            );
        }
        throw new PlexApiError(
            AppErrorCode.SERVER_UNREACHABLE,
            'Unknown error during server discovery',
            response.status,
            true
        );
    }

    private _persistServerHealth(
        serverId: string,
        status: 'ok' | 'unreachable' | 'auth_required' | 'auth_invalid',
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
