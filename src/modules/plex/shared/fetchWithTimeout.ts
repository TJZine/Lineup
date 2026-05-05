import { fetchWithTimeoutCore } from './fetchWithTimeoutCore';
import type { FetchWithTimeoutCoreArgs } from './fetchWithTimeoutCore';

export type FetchWithTimeoutArgs = FetchWithTimeoutCoreArgs;

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
            // Listener cleanup must remain fail-open.
        }
        try {
            upstreamSignal.removeEventListener('abort', abortCombined);
        } catch {
            // Listener cleanup must remain fail-open.
        }
    };

    const abortCombined = (): void => {
        cleanup();
        try {
            controller.abort();
        } catch {
            // Abort cleanup must remain fail-open.
        }
    };

    if (optionsSignal.aborted || upstreamSignal.aborted) {
        abortCombined();
        return { signal: controller.signal, cleanup };
    }

    try {
        optionsSignal.addEventListener('abort', abortCombined, { once: true });
    } catch {
        // Listener wiring must remain fail-open.
    }
    try {
        upstreamSignal.addEventListener('abort', abortCombined, { once: true });
    } catch {
        // Listener wiring must remain fail-open.
    }
    if (optionsSignal.aborted || upstreamSignal.aborted) {
        abortCombined();
    }

    return { signal: controller.signal, cleanup };
}

export async function fetchWithTimeout(
    args: FetchWithTimeoutArgs
): Promise<Response> {
    const merged = mergeAbortSignals(args.init.signal ?? null, args.upstreamSignal ?? null);
    try {
        return await fetchWithTimeoutCore({
            url: args.url,
            init: args.init,
            timeoutMs: args.timeoutMs,
            upstreamSignal: merged.signal,
        });
    } finally {
        merged.cleanup();
    }
}
