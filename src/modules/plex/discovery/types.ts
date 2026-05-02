/**
 * A single connection endpoint to a Plex server.
 * Servers typically have multiple connections (LAN, WAN, relay).
 */
export interface PlexConnection {
    uri: string;
    protocol: 'http' | 'https';
    address: string;
    port: number;
    local: boolean;
    /** Plex relay connections are bandwidth limited. */
    relay: boolean;
    /** Measured latency in ms; null until tested. */
    latencyMs: number | null;
}

/**
 * Represents a Plex Media Server accessible to the user.
 * A user may have access to multiple servers (owned or shared).
 */
export interface PlexServer {
    id: string;
    name: string;
    sourceTitle: string;
    ownerId: string;
    owned: boolean;
    connections: PlexConnection[];
    capabilities: string[];
    preferredConnection: PlexConnection | null;
}

/**
 * Captures the selected-server state owned by discovery so callers can roll
 * back transactional selection attempts without reaching into discovery internals.
 */
export interface PlexDiscoverySelectedServerSnapshot {
    server: PlexServer | null;
    connection: PlexConnection | null;
    storedServerId: string | null;
}

export type ServerHealthStatus =
    | 'ok'
    | 'unreachable'
    | 'auth_required'
    | 'access_denied';

export type ServerHealthType = 'local' | 'remote' | 'relay' | 'unknown';

export type ServerHealthRecord = {
    status: ServerHealthStatus;
    type: ServerHealthType;
    latencyMs?: number;
    testedAt?: number;
};

export interface PlexServerDiscoveryState {
    servers: PlexServer[];
    selectedServer: PlexServer | null;
    selectedConnection: PlexConnection | null;
    lastRefreshAt: number | null;
    isDiscovering: boolean;
}

/**
 * Configuration for mixed HTTP/HTTPS content handling.
 * WebOS apps served over HTTPS can block HTTP requests due to browser security policies.
 */
export interface MixedContentConfig {
    preferHttps: boolean;
    tryHttpsUpgrade: boolean;
    /** HTTP is allowed only for local Plex connections. */
    allowLocalHttp: boolean;
    logWarnings: boolean;
}

export interface PlexServerDiscoveryEvents {
    serverChange: PlexServer | null;
    connectionChange: string | null;
}

export interface PlexApiConnection {
    uri: string;
    protocol: string;
    address: string;
    port: number;
    local: boolean;
    relay: boolean;
}

export interface PlexApiResource {
    clientIdentifier: string;
    name: string;
    sourceTitle: string;
    ownerId: string;
    owned: boolean;
    provides: string;
    connections: PlexApiConnection[];
}
