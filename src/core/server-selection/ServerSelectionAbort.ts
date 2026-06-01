export function throwIfSelectionAborted(signal: AbortSignal | null | undefined): void {
    if (!signal?.aborted) {
        return;
    }
    throw signal.reason ?? createAbortError();
}

function createAbortError(): Error | DOMException {
    if (typeof DOMException !== 'undefined') {
        return new DOMException('Aborted', 'AbortError');
    }
    const error = new Error('Aborted');
    error.name = 'AbortError';
    return error;
}
