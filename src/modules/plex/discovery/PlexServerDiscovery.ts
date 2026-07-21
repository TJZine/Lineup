import { EventEmitter } from '../../../utils/EventEmitter';
import { PLEX_DISCOVERY_CONSTANTS, DEFAULT_MIXED_CONTENT_CONFIG } from './constants';
import {
    IPlexServerDiscovery,
    PlexDiscoverySignalOptions,
    PlexSavedServerRestoreResult,
    PlexSelectedServerAccessTokenRefreshResult,
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
    PlexServerResource,
} from './types';
import { findFastestPlexConnection } from './discoveryProbe';
import { throwIfAborted, throwIfCallerAbort } from './PlexDiscoveryAbort';
import type { PlexConnectionProbeResult } from './PlexConnectionProbeTypes';
import { AppErrorCode } from '../../../types/app-errors';
import { PlexApiError } from '../auth/plexAuthTransport';
import { redactSensitiveTokens, redactUrlForLog } from '../../../utils/redact';
import { ServerSelectionStore } from './ServerSelectionStore';
import {
    clonePlexConnection,
    clonePlexServerView,
    clonePlexServerViews,
    clonePlexServers,
} from './PlexDiscoverySnapshots';
import { PlexDiscoverySharedRequest } from './PlexDiscoverySharedRequest';
import { logPlexError, logPlexWarning } from '../shared/plexLogging';
import { discoverPlexResourcesWithRequestPolicy } from './PlexResourceDiscoveryRequestPolicy';
import { probePlexConnection } from './PlexConnectionProbeRequest';
import { restoreSavedPlexServerSelection } from './PlexSavedServerRestore';
import {
    PlexDiscoverySelectionCapture,
    PlexDiscoverySelectionContext,
    PlexDiscoverySelectionReceipt,
    PlexDiscoverySelectionSupersededError,
} from './PlexDiscoverySelectionContext';
import { PlexDiscoverySelectionState } from './PlexDiscoverySelectionState';
import { PLEX_TOKEN_HEADER, readXPlexTokenFromHeaders } from '../shared/plexUrl';
export { PlexApiError };
export class PlexServerDiscovery implements IPlexServerDiscovery {
    private _state: PlexServerDiscoveryState;
    private _emitter: EventEmitter<PlexServerDiscoveryEvents>;
    private _getCloudAuthHeaders: () => Record<string, string>;
    private _mixedContentConfig: MixedContentConfig;
    private _serverSelectionStore: ServerSelectionStore;
    private _discoveryRequest: PlexDiscoverySharedRequest<PlexServer[]> | null = null;
    private _discoveryContextVersion = 0;
    private _cloudCredentialIdentity: string | null = null;
    private readonly _selectionContext = new PlexDiscoverySelectionContext();
    private readonly _selectionState: PlexDiscoverySelectionState;
    private readonly _snapshotAccessTokens = new WeakMap<PlexDiscoverySelectedServerSnapshot, string>();
    private _selectedServerStorageKey: string;
    private _serverHealthStorageKey: string;
    constructor(config: PlexServerDiscoveryConfig) {
        this._getCloudAuthHeaders = config.getCloudAuthHeaders;
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
        this._selectionState = new PlexDiscoverySelectionState(
            this._state,
            this._serverSelectionStore,
            this._emitter,
            this._selectionContext
        );
    }
    public discoverServers(options?: PlexDiscoverySignalOptions): Promise<PlexServer[]> {
        const signal = options?.signal ?? null;
        throwIfAborted(signal);
        this._synchronizeCloudCredentialScope();
        if (
            this._state.lastRefreshAt !== null &&
            this._state.servers.length > 0 &&
            Date.now() - this._state.lastRefreshAt < PLEX_DISCOVERY_CONSTANTS.SERVER_CACHE_DURATION_MS
        ) {
            return Promise.resolve(clonePlexServerViews(this._state.servers));
        }
        if (this._discoveryRequest) {
            return this._discoveryRequest.awaitSnapshot(signal, clonePlexServers);
        }
        const contextVersion = this._discoveryContextVersion;
        const discoveryAbortController = new AbortController();
        let discoveryRequest: PlexDiscoverySharedRequest<PlexServer[]> | null = null;
        const clearDiscoveryRequest = (): void => {
            if (this._discoveryRequest === discoveryRequest) this._discoveryRequest = null;
        };
        const discoveryPromise = this._doDiscoverServers(contextVersion, discoveryAbortController.signal)
            .finally(clearDiscoveryRequest);
        discoveryRequest = new PlexDiscoverySharedRequest(discoveryPromise, discoveryAbortController, clearDiscoveryRequest);
        this._discoveryRequest = discoveryRequest;
        return discoveryRequest.awaitSnapshot(signal, clonePlexServers);
    }
    private async _doDiscoverServers(contextVersion: number, signal: AbortSignal | null = null): Promise<PlexServer[]> {
        this._state.isDiscovering = true;
        try {
            throwIfAborted(signal);
            const headers = this._getCloudAuthHeaders();
            const resources = await discoverPlexResourcesWithRequestPolicy(headers, { signal });
            throwIfAborted(signal);
            this._synchronizeCloudCredentialScope();
            const servers = this._parseResources(resources);
            throwIfAborted(signal);
            // Discovery can race with profile/storage-key switches. Ignore results
            // from stale contexts so they cannot overwrite the active user's state.
            if (contextVersion !== this._discoveryContextVersion) {
                return clonePlexServerViews(this._state.servers);
            }
            this._commitDiscoveredServers(servers);
            this._state.lastRefreshAt = Date.now();
            return clonePlexServerViews(servers);
        } catch (error) {
            throwIfCallerAbort(error, signal);
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

    public async refreshServers(options?: PlexDiscoverySignalOptions): Promise<PlexServer[]> {
        this._state.lastRefreshAt = null;
        return this.discoverServers(options);
    }
    public async testConnection(
        server: PlexServer,
        connection: PlexConnection,
        options?: PlexDiscoverySignalOptions
    ): Promise<number | 'auth_required' | 'access_denied' | null> {
        const accessToken = this._findServerById(server.id)?.accessToken ?? '';
        const probe = await this._probeConnection(accessToken, connection, options);
        if (probe.outcome === 'reachable') return probe.connection.latencyMs;
        if (probe.outcome === 'auth_required' || probe.outcome === 'access_denied') {
            return probe.outcome;
        }
        return null;
    }
    private async _probeConnection(
        accessToken: string,
        connection: PlexConnection,
        options?: PlexDiscoverySignalOptions
    ): Promise<PlexConnectionProbeResult> {
        return probePlexConnection({
            connection,
            headers: this._buildServerAuthHeaders(accessToken),
            timeoutMs: PLEX_DISCOVERY_CONSTANTS.CONNECTION_TEST_TIMEOUT_MS,
            signal: options?.signal ?? null,
        });
    }
    public async findFastestConnection(
        server: PlexServer,
        options?: PlexDiscoverySignalOptions
    ): Promise<{
        connection: PlexConnection | null;
        authRequired: boolean;
        authState: 'auth_required' | 'access_denied' | null;
    }> {
        return this._findFastestConnection(server, options);
    }
    private async _findFastestConnection(
        server: PlexServer,
        options?: PlexDiscoverySignalOptions,
        assertCurrent?: () => void
    ): Promise<{
        connection: PlexConnection | null;
        authRequired: boolean;
        authState: 'auth_required' | 'access_denied' | null;
    }> {
        return findFastestPlexConnection({
            server,
            mixedContentConfig: this._mixedContentConfig,
            testConnection: (connection) => this.testConnection(server, connection, options),
            signal: options?.signal ?? null,
            ...(assertCurrent ? { assertCurrent } : {}),
        });
    }
    public async selectServer(
        serverId: string,
        options?: PlexDiscoverySignalOptions
    ): Promise<PlexServerSelectionResult> {
        const signal = options?.signal ?? null;
        const context = this._selectionContext.advanceSelection();
        throwIfAborted(signal);
        return this._selectServer(serverId, options, context);
    }
    private async _selectServer(
        serverId: string,
        options: PlexDiscoverySignalOptions | undefined,
        context: PlexDiscoverySelectionCapture
    ): Promise<PlexServerSelectionResult> {
        const signal = options?.signal ?? null;
        const assertCurrent = (): void => this._assertSelectionCurrent(signal, context);
        assertCurrent();
        const server = this._findServerById(serverId);
        if (!server) {
            assertCurrent();
            return { kind: 'server_not_found' };
        }
        const serverView = clonePlexServerView(server);
        if (!serverView) throw new Error('Expected selected Plex server view.');
        const { connection, authRequired, authState } = await this._findFastestConnection(
            serverView,
            options,
            assertCurrent
        );
        assertCurrent();
        if (!connection) {
            const reason = authState ?? (authRequired ? 'auth_required' : 'unreachable');
            assertCurrent();
            this._persistServerHealth(serverId, reason);
            assertCurrent();
            return {
                kind: 'connection_unavailable',
                reason,
            };
        }
        const serverWithConnection: PlexServerResource = {
            ...server,
            preferredConnection: connection,
        };
        const receipt = this._selectionState.commitSelection(
            serverId,
            serverWithConnection,
            connection,
            context,
            signal
        );
        return { kind: 'selected', receipt };
    }

    public captureSelectedServerSnapshot(): PlexDiscoverySelectedServerSnapshot {
        const snapshot = this._selectionState.captureSnapshot();
        const accessToken = this._state.selectedServer?.accessToken;
        if (snapshot.server && accessToken !== undefined) {
            this._snapshotAccessTokens.set(snapshot, accessToken);
        }
        return snapshot;
    }
    public restoreSelectedServerSnapshot(
        snapshot: PlexDiscoverySelectedServerSnapshot
    ): PlexDiscoverySelectionReceipt {
        const accessToken = snapshot.server
            ? this._snapshotAccessTokens.get(snapshot) ?? null
            : null;
        return this._selectionState.restoreSnapshot(snapshot, accessToken);
    }

    public captureCurrentSelectionReceipt(): PlexDiscoverySelectionReceipt | null {
        return this._selectionState.captureCurrentReceipt();
    }

    public getSelectionReceiptSignal(receipt: PlexDiscoverySelectionReceipt): AbortSignal {
        return this._selectionState.getReceiptSignal(receipt);
    }

    public assertSelectionReceiptCurrent(receipt: PlexDiscoverySelectionReceipt): void {
        this._selectionState.assertReceiptCurrent(receipt);
    }
    public getSelectedServer(): PlexServer | null {
        return clonePlexServerView(this._state.selectedServer);
    }
    public getSelectedConnection(): PlexConnection | null {
        return clonePlexConnection(this._state.selectedConnection);
    }
    public getServerUri(): string | null {
        if (this._state.selectedConnection) {
            return this._state.selectedConnection.uri;
        }
        return null;
    }
    public getSelectedServerAuthHeaders(): Record<string, string> {
        const accessToken = this._state.selectedServer?.accessToken ?? null;
        return accessToken ? this._buildServerAuthHeaders(accessToken) : {};
    }
    public getSelectedServerAccessToken(): string | null {
        return this._state.selectedServer?.accessToken ?? null;
    }
    public async refreshSelectedServerAccessToken(
        expectedAccessToken: string,
        options?: PlexDiscoverySignalOptions
    ): Promise<PlexSelectedServerAccessTokenRefreshResult> {
        const signal = options?.signal ?? null;
        throwIfAborted(signal);
        const selectedServer = this._state.selectedServer;
        const selectedConnection = this._state.selectedConnection;
        const receipt = this.captureCurrentSelectionReceipt();
        if (
            !selectedServer
            || !selectedConnection
            || !receipt
            || selectedServer.accessToken !== expectedAccessToken
        ) {
            throw new PlexDiscoverySelectionSupersededError();
        }

        const resources = await discoverPlexResourcesWithRequestPolicy(
            this._getCloudAuthHeaders(),
            { signal }
        );
        this._synchronizeCloudCredentialScope();
        this._assertReceiptCurrent(signal, receipt);
        const servers = this._parseResources(resources);
        this._assertReceiptCurrent(signal, receipt);
        const refreshedServer = servers.find((server) => server.id === selectedServer.id);
        if (!refreshedServer) {
            return { kind: 'selected_server_unavailable' };
        }

        const refreshedSelectedServer: PlexServerResource = {
            ...refreshedServer,
            preferredConnection: clonePlexConnection(selectedConnection),
        };
        this._assertReceiptCurrent(signal, receipt);
        this._state.servers = servers;
        this._assertReceiptCurrent(signal, receipt);
        this._state.selectedServer = refreshedSelectedServer;
        this._state.lastRefreshAt = Date.now();
        this._assertReceiptCurrent(signal, receipt);
        return refreshedServer.accessToken === expectedAccessToken
            ? { kind: 'unchanged' }
            : { kind: 'updated' };
    }
    public getHttpsConnection(): PlexConnection | null {
        const server = this._state.selectedServer;
        if (!server) {
            return null;
        }
        for (const conn of server.connections) {
            if (conn.protocol === 'https' && !conn.relay) {
                return clonePlexConnection(conn);
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
                return clonePlexConnection(conn);
            }
        }
        return null;
    }
    public getActiveConnectionUri(): string | null {
        return this.getServerUri();
    }
    public clearSelection(): void {
        this._selectionState.clear();
    }
    public getServers(): PlexServer[] {
        return clonePlexServerViews(this._state.servers);
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

    public async initialize(options?: PlexDiscoverySignalOptions): Promise<PlexSavedServerRestoreResult> {
        const signal = options?.signal ?? null;
        throwIfAborted(signal);
        this._synchronizeCloudCredentialScope();
        const context = this._selectionContext.capture();
        const previousRefreshAt = this._state.lastRefreshAt;
        await this._discoverServersForInitialize(signal);
        this._assertSelectionCurrent(signal, context);
        const refreshedDiscovery = this._state.lastRefreshAt !== previousRefreshAt;
        return this._restoreSelectionAsync({
            forceReselect: refreshedDiscovery,
            signal,
        }, context);
    }

    private async _discoverServersForInitialize(signal: AbortSignal | null): Promise<void> {
        throwIfAborted(signal);
        if (
            this._state.lastRefreshAt !== null &&
            this._state.servers.length > 0 &&
            Date.now() - this._state.lastRefreshAt < PLEX_DISCOVERY_CONSTANTS.SERVER_CACHE_DURATION_MS
        ) {
            return;
        }

        if (this._discoveryRequest) {
            await this._discoveryRequest.awaitSnapshot(signal, clonePlexServers);
            return;
        }

        await this.discoverServers({ signal });
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
        if (
            normalizedSelectedServerKey === this._selectedServerStorageKey
            && normalizedServerHealthKey === this._serverHealthStorageKey
        ) {
            return;
        }
        // Bump context to invalidate any in-flight discovery started under the
        // previous profile/user storage namespace.
        this._selectionContext.advanceStorageNamespace();
        this._discoveryContextVersion += 1;
        this._discoveryRequest = null;
        this._selectedServerStorageKey = normalizedSelectedServerKey;
        this._serverHealthStorageKey = normalizedServerHealthKey;
        this._state.selectedServer = null;
        this._state.selectedConnection = null;
        this._state.lastRefreshAt = null;
        this._state.servers = [];
        this._cloudCredentialIdentity = this._readCloudCredentialIdentity();
    }

    private _parseResources(resources: PlexApiResource[]): PlexServerResource[] {
        const servers: PlexServerResource[] = [];

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
                accessToken: resource.accessToken,
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

    private _findServerById(serverId: string): PlexServerResource | undefined {
        for (const server of this._state.servers) {
            if (server.id === serverId) {
                return server;
            }
        }
        return undefined;
    }

    private _buildServerAuthHeaders(accessToken: string): Record<string, string> {
        const headers = { ...this._getCloudAuthHeaders() };
        if (accessToken) {
            headers[PLEX_TOKEN_HEADER] = accessToken;
        } else {
            delete headers[PLEX_TOKEN_HEADER];
        }
        return headers;
    }

    private _readCloudCredentialIdentity(): string {
        return readXPlexTokenFromHeaders(this._getCloudAuthHeaders()) ?? '';
    }

    private _synchronizeCloudCredentialScope(): void {
        const credentialIdentity = this._readCloudCredentialIdentity();
        if (this._cloudCredentialIdentity === null) {
            this._cloudCredentialIdentity = credentialIdentity;
            return;
        }
        if (this._cloudCredentialIdentity === credentialIdentity) {
            return;
        }
        this._cloudCredentialIdentity = credentialIdentity;
        this._selectionContext.advance();
        this._discoveryContextVersion += 1;
        this._discoveryRequest = null;
        this._state.selectedServer = null;
        this._state.selectedConnection = null;
        this._state.lastRefreshAt = null;
        this._state.servers = [];
    }

    private _commitDiscoveredServers(servers: PlexServerResource[]): void {
        const selectedServer = this._state.selectedServer;
        const selectedConnection = this._state.selectedConnection;
        const refreshedSelectedServer = selectedServer && selectedConnection
            ? servers.find((server) => server.id === selectedServer.id) ?? null
            : null;
        this._state.servers = servers;
        if (refreshedSelectedServer && selectedConnection) {
            this._state.selectedServer = {
                ...refreshedSelectedServer,
                preferredConnection: clonePlexConnection(selectedConnection),
            };
        }
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

    private async _restoreSelectionAsync(
        options: { forceReselect?: boolean; signal?: AbortSignal | null } | undefined,
        context: PlexDiscoverySelectionCapture
    ): Promise<PlexSavedServerRestoreResult> {
        const signal = options?.signal ?? null;
        const assertCurrent = (): void => this._assertSelectionCurrent(signal, context);
        assertCurrent();
        const result = await restoreSavedPlexServerSelection({
            hasDiscoveredServers: (): boolean => {
                assertCurrent();
                return this._state.servers.length > 0;
            },
            readSavedServerId: (): string | null => {
                assertCurrent();
                return this._serverSelectionStore.readSelectedServerIdAndClean();
            },
            clearSavedServerId: (): void => {
                assertCurrent();
                this._serverSelectionStore.clearSelectedServerId();
            },
            isSavedServerAlreadySelected: (serverId): boolean => {
                assertCurrent();
                return options?.forceReselect !== true &&
                    this._state.selectedServer?.id === serverId &&
                    this._state.selectedConnection !== null;
            },
            captureCurrentSelectionReceipt: (): PlexDiscoverySelectionReceipt | null => {
                assertCurrent();
                return this.captureCurrentSelectionReceipt();
            },
            assertSelectionReceiptCurrent: (receipt): void => {
                this._assertReceiptCurrent(signal, receipt);
            },
            selectSavedServer: (serverId, restoreOptions): Promise<PlexServerSelectionResult> =>
                this._selectServer(serverId, restoreOptions, this._selectionContext.advanceSelection()),
        }, { signal });
        if (result.kind !== 'selected') assertCurrent();
        return result;
    }

    private _assertSelectionCurrent(
        signal: AbortSignal | null,
        context: PlexDiscoverySelectionCapture
    ): void {
        throwIfAborted(signal);
        this._selectionContext.assertCurrent(context);
    }

    private _assertReceiptCurrent(
        signal: AbortSignal | null,
        receipt: PlexDiscoverySelectionReceipt
    ): void {
        throwIfAborted(signal);
        this._selectionContext.assertReceiptCurrent(receipt);
    }
}
