import { readAbortSignalReason } from '../../../../utils/abortSignalReason';

export function throwIfEpgRefreshAborted(signal: AbortSignal | null | undefined): void {
    if (!signal?.aborted) return;
    throw readEpgRefreshAbortReason(signal);
}

export function readEpgRefreshAbortReason(signal: AbortSignal): unknown {
    return readAbortSignalReason(signal);
}
