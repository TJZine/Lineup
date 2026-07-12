import type { PlexDiscoverySelectedServerSnapshot } from '../../modules/plex/discovery';
import {
    classifyPlexDiscoverySelectionSnapshot,
    type PlexDiscoverySelectionSnapshotScope,
} from '../../modules/plex/discovery/PlexDiscoverySelectionSnapshot';
import type { SelectedServerPersistenceProof } from './SelectedServerPersistenceAdapter';

export function classifySelectedServerRollbackScope(
    snapshot: PlexDiscoverySelectedServerSnapshot
): PlexDiscoverySelectionSnapshotScope {
    return classifyPlexDiscoverySelectionSnapshot(snapshot);
}

export function assertSelectedServerRollbackScopeCoherent(
    scope: PlexDiscoverySelectionSnapshotScope,
    proof: SelectedServerPersistenceProof
): void {
    if (proof.phase !== 'rollback') throw new Error('Selected-server rollback proof is required.');
    if (
        (proof.state === 'restored_available_selected' && scope.kind !== 'selected')
        || (proof.state === 'restored_available_unselected' && scope.kind !== 'unselected')
    ) {
        throw new Error('Selected-server discovery and persistence rollback scopes disagree.');
    }
    if (
        proof.state === 'restored_available_selected'
        && scope.kind === 'selected'
        && (proof.selection.serverId !== scope.serverId || proof.selection.serverUri !== scope.serverUri)
    ) {
        throw new Error('Selected-server discovery and persistence rollback identities disagree.');
    }
}
