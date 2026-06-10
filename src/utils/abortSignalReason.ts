const fallbackAbortReasons = new WeakMap<AbortSignal, unknown>();

export function readAbortSignalReason(signal: AbortSignal): unknown {
    if (signal.reason !== undefined) {
        return signal.reason;
    }

    let fallback = fallbackAbortReasons.get(signal);
    if (!fallback) {
        fallback = createAbortError();
        fallbackAbortReasons.set(signal, fallback);
    }
    return fallback;
}

export function readOptionalAbortSignalReason(signal: AbortSignal | null | undefined): unknown {
    return signal ? readAbortSignalReason(signal) : undefined;
}

function createAbortError(): Error | DOMException {
    if (typeof DOMException !== 'undefined') {
        return new DOMException('Aborted', 'AbortError');
    }
    const error = new Error('Aborted');
    error.name = 'AbortError';
    return error;
}
