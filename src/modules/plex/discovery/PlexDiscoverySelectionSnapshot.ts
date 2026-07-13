import type { PlexDiscoverySelectedServerSnapshot } from './types';

export type PlexDiscoverySelectionSnapshotScope =
    | { kind: 'selected'; serverId: string; serverUri: string }
    | { kind: 'unselected' };

export function classifyPlexDiscoverySelectionSnapshot(
    snapshot: PlexDiscoverySelectedServerSnapshot
): PlexDiscoverySelectionSnapshotScope {
    const { server, connection, storedServerId } = snapshot;
    if (server === null && connection === null && storedServerId === null) return { kind: 'unselected' };
    if (
        server === null
        || connection === null
        || storedServerId === null
        || server.id.trim().length === 0
        || connection.uri.trim().length === 0
        || storedServerId !== server.id
    ) {
        throw new Error('Selected-server discovery snapshot is incoherent.');
    }
    return { kind: 'selected', serverId: server.id, serverUri: connection.uri };
}
