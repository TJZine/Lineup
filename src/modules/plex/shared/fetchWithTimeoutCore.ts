export async function fetchWithTimeoutCore(
    url: string,
    options: RequestInit,
    timeoutMs: number,
    upstreamSignal: AbortSignal | null = null
): Promise<Response> {
    const controller = new AbortController();
    const onAbort = (): void => {
        controller.abort();
    };

    if (upstreamSignal) {
        if (upstreamSignal.aborted) {
            onAbort();
        } else {
            upstreamSignal.addEventListener('abort', onAbort, { once: true });
        }
    }

    const timeoutId = setTimeout(() => onAbort(), timeoutMs);

    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
        if (upstreamSignal) {
            upstreamSignal.removeEventListener('abort', onAbort);
        }
    }
}
