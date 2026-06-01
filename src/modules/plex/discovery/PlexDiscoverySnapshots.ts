import type { PlexConnection, PlexServer } from './types';

export function clonePlexConnection(connection: PlexConnection | null): PlexConnection | null {
    return connection ? { ...connection } : null;
}

export function cloneSelectedPlexServer(
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

export function clonePlexServer(server: PlexServer): PlexServer {
    return {
        ...server,
        connections: server.connections.map((connection) => ({ ...connection })),
        preferredConnection: clonePlexConnection(server.preferredConnection),
    };
}

export function clonePlexServers(servers: PlexServer[]): PlexServer[] {
    return servers.map((server) => clonePlexServer(server));
}

export function awaitPlexDiscoverySnapshot(
    promise: Promise<PlexServer[]>,
    signal: AbortSignal | null
): Promise<PlexServer[]> {
    if (!signal) {
        return promise.then(clonePlexServers);
    }
    if (signal.aborted) {
        return Promise.reject(signal.reason);
    }
    return new Promise((resolve, reject) => {
        const onAbort = (): void => {
            reject(signal.reason);
        };
        signal.addEventListener('abort', onAbort, { once: true });
        promise.then(
            (servers) => {
                signal.removeEventListener('abort', onAbort);
                resolve(clonePlexServers(servers));
            },
            (error: unknown) => {
                signal.removeEventListener('abort', onAbort);
                reject(error);
            }
        );
    });
}
