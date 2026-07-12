import { readBoundedResponseText } from '../boundedResponseText';
import { fetchWithTimeoutAndConsume } from '../fetchWithTimeout';

describe('bounded response text consumption', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('rejects an oversized declared content length and cancels the body', async () => {
        const cancel = jest.fn();
        const response = new Response(new ReadableStream<Uint8Array>({ cancel }), {
            headers: { 'content-length': '11' },
        });

        await expect(readBoundedResponseText(response, {
            maxBytes: 10,
            signal: new AbortController().signal,
        })).rejects.toThrow('10-byte limit');
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('rejects a chunked body before decoding beyond the byte limit and cancels it', async () => {
        const cancel = jest.fn();
        const stream = new ReadableStream<Uint8Array>({
            start(controller): void {
                controller.enqueue(new Uint8Array(6));
                controller.enqueue(new Uint8Array(5));
            },
            cancel,
        });

        await expect(readBoundedResponseText(new Response(stream), {
            maxBytes: 10,
            signal: new AbortController().signal,
        })).rejects.toThrow('10-byte limit');
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('keeps the total deadline active after response headers arrive', async () => {
        jest.useFakeTimers();
        const cancel = jest.fn();
        const response = new Response(new ReadableStream<Uint8Array>({ cancel }));
        global.fetch = jest.fn().mockResolvedValue(response);

        const request = fetchWithTimeoutAndConsume({
            url: 'http://plex.local/library',
            init: {},
            timeoutMs: 1000,
            consume: (resolvedResponse, signal) => readBoundedResponseText(resolvedResponse, {
                maxBytes: 10,
                signal,
            }),
        });
        const expectation = expect(request).rejects.toMatchObject({ name: 'AbortError' });

        await jest.advanceTimersByTimeAsync(1000);
        await expectation;
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('preserves the exact upstream abort reason during body consumption', async () => {
        const upstream = new AbortController();
        const reason = new Error('caller stopped request');
        const cancel = jest.fn();
        const response = new Response(new ReadableStream<Uint8Array>({ cancel }));
        global.fetch = jest.fn().mockResolvedValue(response);

        const request = fetchWithTimeoutAndConsume({
            url: 'http://plex.local/library',
            init: {},
            timeoutMs: 10000,
            upstreamSignal: upstream.signal,
            consume: (resolvedResponse, signal) => readBoundedResponseText(resolvedResponse, {
                maxBytes: 10,
                signal,
            }),
        });
        await Promise.resolve();
        upstream.abort(reason);

        await expect(request).rejects.toBe(reason);
        expect(cancel).toHaveBeenCalledTimes(1);
    });
});
