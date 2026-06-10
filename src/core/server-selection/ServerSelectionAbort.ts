import { readAbortSignalReason } from '../../utils/abortSignalReason';

export function throwIfSelectionAborted(signal: AbortSignal | null | undefined): void {
    if (!signal?.aborted) {
        return;
    }
    throw readSelectionAbortReason(signal);
}

export function isSelectionAbortError(
    error: unknown,
    signal: AbortSignal | null | undefined
): boolean {
    if (!signal?.aborted) {
        return false;
    }
    return error === readSelectionAbortReason(signal);
}

function readSelectionAbortReason(signal: AbortSignal): unknown {
    return readAbortSignalReason(signal);
}
