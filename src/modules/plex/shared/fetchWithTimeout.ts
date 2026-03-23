import { fetchWithTimeoutCore } from './fetchWithTimeoutCore';

type MergedAbortSignal = {
    signal: AbortSignal | null;
    cleanup: () => void;
};

function mergeAbortSignals(
    optionsSignal: AbortSignal | null,
    upstreamSignal: AbortSignal | null
): MergedAbortSignal {
    if (!optionsSignal) {
        return { signal: upstreamSignal, cleanup: () => undefined };
    }
    if (!upstreamSignal) {
        return { signal: optionsSignal, cleanup: () => undefined };
    }
    if (optionsSignal === upstreamSignal) {
        return { signal: optionsSignal, cleanup: () => undefined };
    }

    const controller = new AbortController();
    let cleanedUp = false;

    const cleanup = (): void => {
        if (cleanedUp) {
            return;
        }
        cleanedUp = true;
        try {
            optionsSignal.removeEventListener('abort', abortCombined);
        } catch {
            // ignore
        }
        try {
            upstreamSignal.removeEventListener('abort', abortCombined);
        } catch {
            // ignore
        }
    };

    const abortCombined = (): void => {
        cleanup();
        try {
            controller.abort();
        } catch {
            // ignore
        }
    };

    if (optionsSignal.aborted || upstreamSignal.aborted) {
        abortCombined();
        return { signal: controller.signal, cleanup };
    }

    optionsSignal.addEventListener('abort', abortCombined, { once: true });
    upstreamSignal.addEventListener('abort', abortCombined, { once: true });

    return { signal: controller.signal, cleanup };
}

export async function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number,
    upstreamSignal: AbortSignal | null = null
): Promise<Response> {
    const merged = mergeAbortSignals(options.signal ?? null, upstreamSignal);
    try {
        return await fetchWithTimeoutCore(url, options, timeoutMs, merged.signal);
    } finally {
        merged.cleanup();
    }
}
