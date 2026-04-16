import { fetchWithTimeoutCore } from '../fetchWithTimeoutCore';

describe('fetchWithTimeoutCore', () => {
    let mockFetch: jest.Mock;
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        mockFetch = jest.fn();
        global.fetch = mockFetch as unknown as typeof global.fetch;
        jest.useFakeTimers();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.useRealTimers();
        jest.resetAllMocks();
    });

    it('aborts when the upstream signal aborts', async () => {
        const upstreamController = new AbortController();
        mockFetch.mockImplementation((_url: string, options?: RequestInit) => new Promise((_resolve, reject) => {
            const signal = options?.signal as AbortSignal | undefined;
            signal?.addEventListener(
                'abort',
                () => reject(new DOMException('The operation was aborted.', 'AbortError')),
                { once: true }
            );
        }));

        const request = fetchWithTimeoutCore(
            'http://example.test/core-upstream-abort',
            { method: 'GET' },
            5_000,
            upstreamController.signal
        );
        const rejection = request.catch((error) => error);

        const passedSignal = mockFetch.mock.calls[0]?.[1]?.signal as AbortSignal | undefined;
        expect(passedSignal).toBeDefined();

        upstreamController.abort();
        expect(passedSignal?.aborted).toBe(true);

        await jest.advanceTimersByTimeAsync(5_001);
        await expect(rejection).resolves.toMatchObject({ name: 'AbortError' });
    });
});
