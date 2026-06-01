import { isAbortLikeError } from '../../utils/errors';

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
    return error === readSelectionAbortReason(signal) || isAbortLikeError(error);
}

function readSelectionAbortReason(signal: AbortSignal): unknown {
    return signal.reason ?? createAbortError();
}

function createAbortError(): Error | DOMException {
    if (typeof DOMException !== 'undefined') {
        return new DOMException('Aborted', 'AbortError');
    }
    const error = new Error('Aborted');
    error.name = 'AbortError';
    return error;
}
