import type { PlexDiscoverySelectionReceipt } from '../../modules/plex/discovery';
import { readAbortSignalReason } from '../../utils/abortSignalReason';
import { RetainedOperationContext } from '../../utils/RetainedOperationContext';
import type { SelectedServerPersistenceEvidence } from './SelectedServerPersistenceAdapter';
import type { OperationContextUpstream } from '../../utils/RetainedOperationContext';

export function createSelectedServerTransactionOperation(options: {
    receipt: PlexDiscoverySelectionReceipt;
    evidence: SelectedServerPersistenceEvidence;
    callerSignal?: AbortSignal | null;
    includePersistenceEvidence?: boolean;
    getSelectionReceiptSignal(receipt: PlexDiscoverySelectionReceipt): AbortSignal;
    assertSelectionReceiptCurrent(receipt: PlexDiscoverySelectionReceipt): void;
    assertPersistenceEvidenceCurrent(evidence: SelectedServerPersistenceEvidence): void;
    upstreams?: readonly OperationContextUpstream[];
}): RetainedOperationContext {
    const receiptSignal = options.getSelectionReceiptSignal(options.receipt);
    return new RetainedOperationContext([
        ...(options.upstreams ?? []),
        ...(options.callerSignal ? [{
            signal: options.callerSignal,
            assertCurrent: (): void => {
                if (options.callerSignal?.aborted) {
                    throw readAbortSignalReason(options.callerSignal);
                }
            },
        }] : []),
        {
            signal: receiptSignal,
            assertCurrent: (): void => options.assertSelectionReceiptCurrent(options.receipt),
        },
        ...(options.includePersistenceEvidence === false ? [] : [{
            assertCurrent: (): void => options.assertPersistenceEvidenceCurrent(options.evidence),
        }]),
    ]);
}
