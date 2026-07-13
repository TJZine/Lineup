import type { SelectedServerPersistenceResult } from './ServerSelectionTypes';
import type { SelectedServerCredentialsPort } from './SelectedServerPersistenceAdapter';

export function clearPersistedSelectedServer(
    port: SelectedServerCredentialsPort | null
): SelectedServerPersistenceResult {
    if (!port) return 'skipped_missing_credentials';
    const stored = port.readStoredCredentialsAndClearCorruption();
    if (stored.kind === 'missing') return 'skipped_missing_credentials';
    if (stored.kind === 'corrupted') return 'skipped_corrupted_credentials';
    const credentials = stored.credentials;
    const activeUserId = port.getActiveUserId() ?? credentials.activeUserId;
    if (!activeUserId) return 'skipped_missing_credentials';
    port.storeCredentials({
        accountToken: credentials.accountToken,
        activeToken: credentials.activeToken,
        activeUserId,
        selectedServerByUserId: {
            ...credentials.selectedServerByUserId,
            [activeUserId]: { serverId: null, serverUri: null },
        },
        deviceKey: credentials.deviceKey ?? null,
    }, { emitAuthChange: false });
    return 'updated';
}
