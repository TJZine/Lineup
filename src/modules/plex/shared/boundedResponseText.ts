import { readAbortSignalReason } from '../../../utils/abortSignalReason';

export interface BoundedResponseTextOptions {
    maxBytes: number;
    signal: AbortSignal;
    rejectOversizedContentLength?: boolean;
}

function throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) {
        throw readAbortSignalReason(signal);
    }
}

function readDeclaredContentLength(response: Response): number | null {
    const rawLength = response.headers.get('content-length');
    if (!rawLength || !/^\d+$/.test(rawLength.trim())) {
        return null;
    }
    const parsed = Number(rawLength);
    return Number.isSafeInteger(parsed) ? parsed : null;
}

export function readResponseBodyChunkWithAbort(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    signal: AbortSignal
): Promise<ReadableStreamReadResult<Uint8Array>> {
    throwIfAborted(signal);

    return new Promise((resolve, reject) => {
        let settled = false;
        const cleanup = (): void => {
            signal.removeEventListener('abort', onAbort);
        };
        const settle = (
            action: (value: ReadableStreamReadResult<Uint8Array>) => void,
            value: ReadableStreamReadResult<Uint8Array>
        ): void => {
            if (settled) return;
            settled = true;
            cleanup();
            action(value);
        };
        const rejectOnce = (reason: unknown): void => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(reason);
        };
        const onAbort = (): void => rejectOnce(readAbortSignalReason(signal));

        signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) {
            onAbort();
            return;
        }

        reader.read().then(
            (result) => settle(resolve, result),
            rejectOnce
        );
    });
}

export function cancelAndReleaseResponseReader(
    reader: ReadableStreamDefaultReader<Uint8Array>
): void {
    const release = (): void => {
        try {
            reader.releaseLock();
        } catch {
            // A pending read may keep the lock until cancellation settles.
        }
    };

    try {
        const cancellation = reader.cancel();
        release();
        void cancellation.catch(() => undefined).finally(release);
    } catch {
        release();
    }
}

export async function readBoundedResponseText(
    response: Response,
    options: BoundedResponseTextOptions
): Promise<string> {
    const { maxBytes, signal, rejectOversizedContentLength = true } = options;
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
        throw new RangeError('Response byte limit must be a non-negative safe integer');
    }

    throwIfAborted(signal);
    if (!response.body) {
        return '';
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const chunks: string[] = [];
    let receivedBytes = 0;

    try {
        if (rejectOversizedContentLength) {
            const contentLength = readDeclaredContentLength(response);
            if (contentLength !== null && contentLength > maxBytes) {
                throw new RangeError(`Response body exceeds the ${maxBytes}-byte limit`);
            }
        }
        while (true) {
            const { value, done } = await readResponseBodyChunkWithAbort(reader, signal);
            if (done) break;
            if (!value) continue;

            receivedBytes += value.byteLength;
            if (receivedBytes > maxBytes) {
                throw new RangeError(`Response body exceeds the ${maxBytes}-byte limit`);
            }
            chunks.push(decoder.decode(value, { stream: true }));
        }
        chunks.push(decoder.decode());
        throwIfAborted(signal);
        return chunks.join('');
    } finally {
        cancelAndReleaseResponseReader(reader);
    }
}
