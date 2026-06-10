import { readOptionalAbortSignalReason } from '../../../utils/abortSignalReason';

export interface FetchWithTimeoutCoreArgs {
    url: string;
    init: RequestInit;
    timeoutMs: number;
    upstreamSignal?: AbortSignal | null;
}

export async function fetchWithTimeoutCore({
    url,
    init,
    timeoutMs,
    upstreamSignal = null,
}: FetchWithTimeoutCoreArgs): Promise<Response> {
    const controller = new AbortController();
    const abortRequest = (reason?: unknown): void => {
        try {
            controller.abort(reason);
        } catch {
            // Abort cleanup must remain fail-open.
        }
    };
    const onAbort = (): void => {
        abortRequest(readOptionalAbortSignalReason(upstreamSignal));
    };

    if (upstreamSignal) {
        if (upstreamSignal.aborted) {
            onAbort();
        } else {
            try {
                upstreamSignal.addEventListener('abort', onAbort, { once: true });
                if (upstreamSignal.aborted) {
                    onAbort();
                }
            } catch {
                // Listener wiring must remain fail-open.
            }
        }
    }

    const timeoutId = setTimeout(() => abortRequest(), timeoutMs);

    try {
        return await fetch(url, { ...init, signal: controller.signal });
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
