import { isAbortLikeError } from '../../../utils/errors';

export function readAbortReason(signal: AbortSignal): unknown {
    return signal.reason ?? createAbortError();
}

export function throwIfAborted(signal: AbortSignal | null): void {
    if (signal?.aborted) {
        throw readAbortReason(signal);
    }
}

export function isCallerAbortError(error: unknown, signal: AbortSignal | null): boolean {
    return isCallerAbort(error, signal, false);
}

export function throwIfCallerAbort(
    error: unknown,
    signal: AbortSignal | null,
    forwardedFromCaller = false
): void {
    if (isCallerAbort(error, signal, forwardedFromCaller) && signal) {
        throw readAbortReason(signal);
    }
}

function isCallerAbort(
    error: unknown,
    signal: AbortSignal | null,
    forwardedFromCaller: boolean
): boolean {
    if (!signal?.aborted) {
        return false;
    }
    return error === readAbortReason(signal) || (forwardedFromCaller && isAbortLikeError(error));
}

function createAbortError(): Error | DOMException {
    if (typeof DOMException !== 'undefined') {
        return new DOMException('Aborted', 'AbortError');
    }
    const error = new Error('Aborted');
    error.name = 'AbortError';
    return error;
}
