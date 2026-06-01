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

    const primarySignal = optionsSignal;
    const secondarySignal = upstreamSignal;
    const controller = new AbortController();
    let cleanedUp = false;

    function readAbortReason(signal: AbortSignal): unknown {
        return signal.reason ?? new DOMException('Aborted', 'AbortError');
    }

    function abortCombined(sourceSignal: AbortSignal): void {
        cleanup();
        try {
            controller.abort(readAbortReason(sourceSignal));
        } catch {
            // Abort cleanup must remain fail-open.
        }
    }

    function abortFromOptions(): void {
        abortCombined(primarySignal);
    }

    function abortFromUpstream(): void {
        abortCombined(secondarySignal);
    }

    function cleanup(): void {
        if (cleanedUp) {
            return;
        }
        cleanedUp = true;
        try {
            primarySignal.removeEventListener('abort', abortFromOptions);
        } catch {
            // Listener cleanup must remain fail-open.
        }
        try {
            secondarySignal.removeEventListener('abort', abortFromUpstream);
        } catch {
            // Listener cleanup must remain fail-open.
        }
    }

    if (primarySignal.aborted || secondarySignal.aborted) {
        abortCombined(primarySignal.aborted ? primarySignal : secondarySignal);
        return { signal: controller.signal, cleanup };
    }

    try {
        primarySignal.addEventListener('abort', abortFromOptions, { once: true });
    } catch {
        // Listener wiring must remain fail-open.
    }
    try {
        secondarySignal.addEventListener('abort', abortFromUpstream, { once: true });
    } catch {
        // Listener wiring must remain fail-open.
    }
    if (primarySignal.aborted || secondarySignal.aborted) {
        abortCombined(primarySignal.aborted ? primarySignal : secondarySignal);
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
