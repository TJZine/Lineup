import type {
    PlexDiscoverySignalOptions,
    PlexSavedServerRestoreResult,
    PlexServerSelectionResult,
} from './interfaces';

export interface PlexSavedServerRestoreDeps {
    hasDiscoveredServers(): boolean;
    readSavedServerId(): string | null;
    clearSavedServerId(): void;
    isSavedServerAlreadySelected(serverId: string): boolean;
    selectSavedServer(
        serverId: string,
        options?: PlexDiscoverySignalOptions
    ): Promise<PlexServerSelectionResult>;
}

export async function restoreSavedPlexServerSelection(
    deps: PlexSavedServerRestoreDeps,
    options?: PlexDiscoverySignalOptions
): Promise<PlexSavedServerRestoreResult> {
    const serverId = deps.readSavedServerId();
    if (!serverId) {
        return deps.hasDiscoveredServers()
            ? { kind: 'skipped_no_saved_server' }
            : { kind: 'skipped_no_servers' };
    }
    if (!deps.hasDiscoveredServers()) {
        deps.clearSavedServerId();
        return { kind: 'selection_failed', serverId, reason: 'server_not_found' };
    }
    if (deps.isSavedServerAlreadySelected(serverId)) return { kind: 'already_selected', serverId };

    const result = await deps.selectSavedServer(serverId, options);
    if (result.kind === 'selected') return { kind: 'selected', serverId };

    const reason = result.kind === 'server_not_found' ? 'server_not_found' : result.reason;
    if (reason === 'server_not_found') deps.clearSavedServerId();
    return { kind: 'selection_failed', serverId, reason };
}
