import { EventEmitter } from '../../../utils/EventEmitter';
import { PLEX_DISCOVERY_CONSTANTS, DEFAULT_MIXED_CONTENT_CONFIG } from './constants';
import {
    IPlexServerDiscovery,
    PlexDiscoverySignalOptions,
    PlexSavedServerRestoreResult,
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
import { findFastestPlexConnection } from './discoveryProbe';
import { throwIfAborted, throwIfCallerAbort } from './PlexDiscoveryAbort';
import type { PlexConnectionProbeResult } from './PlexConnectionProbeTypes';
import { AppErrorCode } from '../../../types/app-errors';
import { PlexApiError } from '../auth/plexAuthTransport';
import { redactSensitiveTokens, redactUrlForLog } from '../../../utils/redact';
import { ServerSelectionStore } from './ServerSelectionStore';
import {
    clonePlexConnection,
    clonePlexServers,
    cloneSelectedPlexServer,
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
} from './PlexDiscoverySelectionContext';
import { PlexDiscoverySelectionState } from './PlexDiscoverySelectionState';
export { PlexApiError };
export class PlexServerDiscovery implements IPlexServerDiscovery {
    private _state: PlexServerDiscoveryState;
    private _emitter: EventEmitter<PlexServerDiscoveryEvents>;
    private _getAuthHeaders: () => Record<string, string>;
    private _mixedContentConfig: MixedContentConfig;
    private _serverSelectionStore: ServerSelectionStore;
    private _discoveryRequest: PlexDiscoverySharedRequest<PlexServer[]> | null = null;
    private _discoveryContextVersion = 0;
    private readonly _selectionContext = new PlexDiscoverySelectionContext();
    private readonly _selectionState: PlexDiscoverySelectionState;
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
        if (
            this._state.lastRefreshAt !== null &&
            this._state.servers.length > 0 &&
            Date.now() - this._state.lastRefreshAt < PLEX_DISCOVERY_CONSTANTS.SERVER_CACHE_DURATION_MS
        ) {
            return Promise.resolve(clonePlexServers(this._state.servers));
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
            const headers = this._getAuthHeaders();
            const resources = await discoverPlexResourcesWithRequestPolicy(headers, { signal });
            throwIfAborted(signal);
            const servers = this._parseResources(resources);
            throwIfAborted(signal);
            // Discovery can race with profile/storage-key switches. Ignore results
            // from stale contexts so they cannot overwrite the active user's state.
            if (contextVersion !== this._discoveryContextVersion) {
                return clonePlexServers(this._state.servers);
            }
            this._state.servers = servers;
            this._state.lastRefreshAt = Date.now();
            return clonePlexServers(servers);
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
        _server: PlexServer,
        connection: PlexConnection,
        options?: PlexDiscoverySignalOptions
    ): Promise<number | 'auth_required' | 'access_denied' | null> {
        const probe = await this._probeConnection(connection, options);
        if (probe.outcome === 'reachable') return probe.connection.latencyMs;
        if (probe.outcome === 'auth_required' || probe.outcome === 'access_denied') {
            return probe.outcome;
        }
        return null;
    }
    private async _probeConnection(
        connection: PlexConnection,
        options?: PlexDiscoverySignalOptions
    ): Promise<PlexConnectionProbeResult> {
        return probePlexConnection({
            connection,
            headers: this._getAuthHeaders(),
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
        throwIfAborted(signal);
        return this._selectServer(serverId, options, this._selectionContext.advanceSelection());
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
        const { connection, authRequired, authState } = await this._findFastestConnection(
            server,
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
        const serverWithConnection: PlexServer = {
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
        return this._selectionState.captureSnapshot();
    }
    public restoreSelectedServerSnapshot(
        snapshot: PlexDiscoverySelectedServerSnapshot
    ): PlexDiscoverySelectionReceipt {
        return this._selectionState.restoreSnapshot(snapshot);
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
        return cloneSelectedPlexServer(this._state.selectedServer, this._state.selectedConnection);
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
        return clonePlexServers(this._state.servers);
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
