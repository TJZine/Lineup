import { readAbortSignalReason } from '../../utils/abortSignalReason';

export interface StartupSignalOptions {
    signal?: AbortSignal | null | undefined;
}

export function throwIfStartupAborted(signal: AbortSignal | null | undefined): void {
    if (!signal?.aborted) {
        return;
    }
    throw readStartupAbortReason(signal);
}

export function isStartupAbortError(
    error: unknown,
    signal: AbortSignal | null | undefined
): boolean {
    if (!signal?.aborted) {
        return false;
    }
    return error === readStartupAbortReason(signal);
}

export function readStartupAbortReason(signal: AbortSignal): unknown {
    return readAbortSignalReason(signal);
}
