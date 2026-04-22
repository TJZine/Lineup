export async function fetchWithTimeoutCore(
    url: string,
    options: RequestInit,
    timeoutMs: number,
    upstreamSignal: AbortSignal | null = null
): Promise<Response> {
    const controller = new AbortController();
    const onAbort = (): void => {
        try {
            controller.abort();
        } catch {
            // Abort cleanup must remain fail-open.
        }
    };

    if (upstreamSignal) {
        if (upstreamSignal.aborted) {
            onAbort();
        } else {
            try {
                upstreamSignal.addEventListener('abort', onAbort, { once: true });
            } catch {
                // Listener wiring must remain fail-open.
            }
        }
    }

    const timeoutId = setTimeout(() => onAbort(), timeoutMs);

    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
        if (upstreamSignal) {
            try {
                upstreamSignal.removeEventListener('abort', onAbort);
            } catch {
                // Listener cleanup must remain fail-open.
            }
        }
    }
}
