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
