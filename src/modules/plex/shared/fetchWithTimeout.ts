import { fetchWithTimeoutCore } from './fetchWithTimeoutCore';

function mergeAbortSignals(
    optionsSignal: AbortSignal | null,
    upstreamSignal: AbortSignal | null
): AbortSignal | null {
    if (!optionsSignal) return upstreamSignal;
    if (!upstreamSignal) return optionsSignal;
    if (optionsSignal === upstreamSignal) return optionsSignal;

    const controller = new AbortController();
    const abortCombined = (): void => {
        try {
            controller.abort();
        } catch {
            // ignore
        }
    };

    if (optionsSignal.aborted || upstreamSignal.aborted) {
        abortCombined();
        return controller.signal;
    }

    optionsSignal.addEventListener('abort', abortCombined, { once: true });
    upstreamSignal.addEventListener('abort', abortCombined, { once: true });

    return controller.signal;
}

export async function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number,
    upstreamSignal: AbortSignal | null = null
): Promise<Response> {
    const mergedSignal = mergeAbortSignals(options.signal ?? null, upstreamSignal);
    return fetchWithTimeoutCore(url, options, timeoutMs, mergedSignal);
}
