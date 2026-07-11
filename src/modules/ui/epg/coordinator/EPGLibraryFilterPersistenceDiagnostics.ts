import type { SafeLocalStorageMutationResult } from '../../../../utils/storage';
import type { AppendIssueDiagnostic } from '../../../debug/IssueDiagnosticsStore';

const QA_003B_ISSUE_ID = 'QA-003b';

export function reportLibraryFilterPersistenceResult(
    appendIssueDiagnostic: AppendIssueDiagnostic,
    result: SafeLocalStorageMutationResult,
    requestedLibraryId: string | null,
    source?: string
): void {
    if (result.ok) {
        return;
    }
    appendIssueDiagnostic(QA_003B_ISSUE_ID, 'epg.libraryFilterPersistenceFailed', {
        reason: result.reason,
        requestedLibraryId,
        ...(source ? { source } : {}),
    });
}
