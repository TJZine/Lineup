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

    it('keeps listener wiring and cleanup fail-open when upstream signal APIs throw', async () => {
        const upstreamController = new AbortController();
        const addEventListenerSpy = jest.spyOn(upstreamController.signal, 'addEventListener').mockImplementation(() => {
            throw new Error('add failed');
        });
        const removeEventListenerSpy = jest.spyOn(upstreamController.signal, 'removeEventListener').mockImplementation(() => {
            throw new Error('remove failed');
        });
        const response = { ok: true, status: 200 } as Response;
        mockFetch.mockResolvedValue(response);

        await expect(
            fetchWithTimeoutCore(
                'http://example.test/core-listener-fail-open',
                { method: 'GET' },
                5_000,
                upstreamController.signal
            )
        ).resolves.toBe(response);
        expect(addEventListenerSpy).toHaveBeenCalled();
        expect(removeEventListenerSpy).toHaveBeenCalled();
    });

    it('keeps the abort path fail-open when AbortController.abort throws', async () => {
        const upstreamController = new AbortController();
        const originalAbort = AbortController.prototype.abort;
        const abortSpy = jest.spyOn(AbortController.prototype, 'abort').mockImplementation(function (
            this: AbortController
        ) {
            if (this === upstreamController) {
                return originalAbort.call(this);
            }
            throw new Error('abort failed');
        });
        let resolveFetch: ((value: Response | PromiseLike<Response>) => void) | undefined;
        const response = { ok: true, status: 200 } as Response;
        mockFetch.mockImplementation(
            () => new Promise<Response>((resolve) => {
                resolveFetch = resolve;
            })
        );

        try {
            const request = fetchWithTimeoutCore(
                'http://example.test/core-abort-fail-open',
                { method: 'GET' },
                5_000,
                upstreamController.signal
            );

            upstreamController.abort();
            expect(abortSpy).toHaveBeenCalled();
            resolveFetch?.(response);

            await expect(request).resolves.toBe(response);
        } finally {
            abortSpy.mockRestore();
        }
    });
});
