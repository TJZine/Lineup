import { readOptionalAbortSignalReason } from '../../../utils/abortSignalReason';
import { cancelAndReleaseResponseReader } from './boundedResponseText';

export interface FetchWithTimeoutCoreArgs {
    url: string;
    init: RequestInit;
    timeoutMs: number;
    upstreamSignal?: AbortSignal | null;
}

export interface FetchWithTimeoutCoreConsumeArgs<T> extends FetchWithTimeoutCoreArgs {
    consume: (response: Response, signal: AbortSignal) => Promise<T>;
}

async function runFetchWithTimeoutCore<T>({
    url,
    init,
    timeoutMs,
    upstreamSignal = null,
    consume,
}: FetchWithTimeoutCoreConsumeArgs<T>, cancelUnreadBody: boolean): Promise<T> {
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
        const response = await fetch(url, { ...init, signal: controller.signal });
        try {
            return await consume(response, controller.signal);
        } finally {
            if (cancelUnreadBody) {
                cancelUnreadResponseBody(response);
            }
        }
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

function cancelUnreadResponseBody(response: Response): void {
    try {
        const body = response.body;
        if (!body || response.bodyUsed || body.locked) {
            return;
        }
        cancelAndReleaseResponseReader(body.getReader());
    } catch {
        // Unread response cleanup must not replace the operation outcome.
    }
}

export async function fetchWithTimeoutCore({
    url,
    init,
    timeoutMs,
    upstreamSignal = null,
}: FetchWithTimeoutCoreArgs): Promise<Response> {
    return runFetchWithTimeoutCore({
        url,
        init,
        timeoutMs,
        upstreamSignal,
        consume: async (response) => response,
    }, false);
}

export async function fetchWithTimeoutCoreAndConsume<T>(
    args: FetchWithTimeoutCoreConsumeArgs<T>
): Promise<T> {
    return runFetchWithTimeoutCore(args, true);
}
