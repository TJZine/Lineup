export function throwIfEpgRefreshAborted(signal: AbortSignal | null | undefined): void {
    if (!signal?.aborted) return;
    throw readEpgRefreshAbortReason(signal);
}

export function readEpgRefreshAbortReason(signal: AbortSignal): unknown {
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
