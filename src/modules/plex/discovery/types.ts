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
    /** true for Plex relay connections (bandwidth limited) */
    relay: boolean;
    /** Measured latency in ms - null until tested */
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
    /** Best available connection after testing - null until tested */
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
    /** Prefer HTTPS connections when available (default: true) */
    preferHttps: boolean;
    /** Attempt HTTP upgrade to HTTPS for local connections (default: true) */
    tryHttpsUpgrade: boolean;
    /** Allow HTTP for local connections only (default: true) */
    allowLocalHttp: boolean;
    /** Log mixed content warnings (default: true) */
    logWarnings: boolean;
}

export interface PlexServerDiscoveryEvents extends Record<string, unknown> {
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
