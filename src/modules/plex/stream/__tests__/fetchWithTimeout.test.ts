import { fetchWithTimeout } from '../fetchWithTimeout';

describe('fetchWithTimeout', () => {
    let mockFetch: jest.Mock;
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        mockFetch = jest.fn();
        global.fetch = mockFetch as unknown as typeof global.fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.useRealTimers();
        jest.resetAllMocks();
    });

    it('aborts the request when timeout elapses', async () => {
        jest.useFakeTimers();
        mockFetch.mockImplementation((_url: string, options?: RequestInit) => {
            return new Promise((_resolve, reject) => {
                const signal = options?.signal as AbortSignal | undefined;
                signal?.addEventListener(
                    'abort',
                    () => reject(new DOMException('The operation was aborted.', 'AbortError')),
                    { once: true }
                );
            });
        });

        const request = fetchWithTimeout('http://example.test/slow', { method: 'GET' }, 50);
        const rejectedRequest = expect(request).rejects.toMatchObject({ name: 'AbortError' });
        await jest.advanceTimersByTimeAsync(51);
        await rejectedRequest;
        expect(mockFetch).toHaveBeenCalledWith(
            'http://example.test/slow',
            expect.objectContaining({
                method: 'GET',
                signal: expect.any(AbortSignal),
            })
        );
    });

    it('clears the timeout when fetch resolves', async () => {
        jest.useFakeTimers();
        const response = { ok: true, status: 200 } as Response;
        mockFetch.mockResolvedValue(response);

        await expect(
            fetchWithTimeout('http://example.test/fast', { method: 'GET' }, 200)
        ).resolves.toBe(response);

        expect(jest.getTimerCount()).toBe(0);
        expect(mockFetch).toHaveBeenCalledWith(
            'http://example.test/fast',
            expect.objectContaining({
                method: 'GET',
                signal: expect.any(AbortSignal),
            })
        );
    });

    it('aborts the request when upstream signal aborts', async () => {
        jest.useFakeTimers();

        const upstreamController = new AbortController();
        mockFetch.mockImplementation((_url: string, options?: RequestInit) => {
            return new Promise((_resolve, reject) => {
                const signal = options?.signal as AbortSignal | undefined;
                signal?.addEventListener(
                    'abort',
                    () => reject(new DOMException('The operation was aborted.', 'AbortError')),
                    { once: true }
                );
            });
        });

        const request = fetchWithTimeout(
            'http://example.test/upstream-abort',
            { method: 'GET', signal: upstreamController.signal },
            100_000
        );
        const requestRejection = request.catch((error) => error);

        const passedSignal = (mockFetch.mock.calls[0]?.[1] as RequestInit | undefined)?.signal as AbortSignal | undefined;
        if (!passedSignal) {
            throw new Error('Expected fetch to be called with a RequestInit.signal');
        }

        try {
            upstreamController.abort();
            expect(passedSignal.aborted).toBe(true);
        } finally {
            await jest.advanceTimersByTimeAsync(100_001);
            await requestRejection;
        }
    });

    it('rejects immediately when upstream signal is already aborted', async () => {
        jest.useFakeTimers();

        const upstreamController = new AbortController();
        upstreamController.abort();

        mockFetch.mockImplementation((_url: string, options?: RequestInit) => {
            return new Promise((_resolve, reject) => {
                const signal = options?.signal as AbortSignal | undefined;
                if (signal?.aborted) {
                    reject(new DOMException('The operation was aborted.', 'AbortError'));
                    return;
                }
                signal?.addEventListener(
                    'abort',
                    () => reject(new DOMException('The operation was aborted.', 'AbortError')),
                    { once: true }
                );
            });
        });

        const request = fetchWithTimeout(
            'http://example.test/pre-aborted',
            { method: 'GET', signal: upstreamController.signal },
            100_000
        );

        await expect(request).rejects.toMatchObject({ name: 'AbortError' });

        const passedSignal = (mockFetch.mock.calls[0]?.[1] as RequestInit | undefined)?.signal as AbortSignal | undefined;
        if (!passedSignal) {
            throw new Error('Expected fetch to be called with a RequestInit.signal');
        }
        expect(passedSignal.aborted).toBe(true);
    });
});
