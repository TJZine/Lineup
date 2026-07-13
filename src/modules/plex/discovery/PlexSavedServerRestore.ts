import type {
    PlexDiscoverySignalOptions,
    PlexSavedServerRestoreResult,
    PlexServerSelectionResult,
} from './interfaces';
import {
    PlexDiscoverySelectionSupersededError,
    type PlexDiscoverySelectionReceipt,
} from './PlexDiscoverySelectionContext';

export interface PlexSavedServerRestoreDeps {
    hasDiscoveredServers(): boolean;
    readSavedServerId(): string | null;
    clearSavedServerId(): void;
    isSavedServerAlreadySelected(serverId: string): boolean;
    captureCurrentSelectionReceipt(): PlexDiscoverySelectionReceipt | null;
    assertSelectionReceiptCurrent(receipt: PlexDiscoverySelectionReceipt): void;
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
    if (deps.isSavedServerAlreadySelected(serverId)) {
        const receipt = deps.captureCurrentSelectionReceipt();
        if (!receipt) throw new PlexDiscoverySelectionSupersededError();
        deps.assertSelectionReceiptCurrent(receipt);
        return { kind: 'already_selected', serverId, receipt };
    }

    const result = await deps.selectSavedServer(serverId, options);
    if (result.kind === 'selected') {
        deps.assertSelectionReceiptCurrent(result.receipt);
        return { kind: 'selected', serverId, receipt: result.receipt };
    }

    const reason = result.kind === 'server_not_found' ? 'server_not_found' : result.reason;
    if (reason === 'server_not_found') deps.clearSavedServerId();
    return { kind: 'selection_failed', serverId, reason };
}
