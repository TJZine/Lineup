import { fetchWithTimeout } from '../../shared/fetchWithTimeout';
import { fetchWithTimeoutCore } from '../../shared/fetchWithTimeoutCore';

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

        const request = fetchWithTimeout({
            url: 'http://example.test/slow',
            init: { method: 'GET' },
            timeoutMs: 50,
        });
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
            fetchWithTimeout({
                url: 'http://example.test/fast',
                init: { method: 'GET' },
                timeoutMs: 200,
            })
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

    it('aborts the request when options signal aborts', async () => {
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

        const request = fetchWithTimeout({
            url: 'http://example.test/upstream-abort',
            init: { method: 'GET', signal: upstreamController.signal },
            timeoutMs: 100_000,
        });
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

    it('rejects immediately when options signal is already aborted', async () => {
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

        const request = fetchWithTimeout({
            url: 'http://example.test/pre-aborted',
            init: { method: 'GET', signal: upstreamController.signal },
            timeoutMs: 100_000,
        });

        await expect(request).rejects.toMatchObject({ name: 'AbortError' });

        const passedSignal = (mockFetch.mock.calls[0]?.[1] as RequestInit | undefined)?.signal as AbortSignal | undefined;
        if (!passedSignal) {
            throw new Error('Expected fetch to be called with a RequestInit.signal');
        }
        expect(passedSignal.aborted).toBe(true);
    });

    it('aborts when 4th-arg upstream signal aborts and options.signal is unset', async () => {
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

        const request = fetchWithTimeout({
            url: 'http://example.test/upstream-only',
            init: { method: 'GET' },
            timeoutMs: 100_000,
            upstreamSignal: upstreamController.signal,
        });
        const requestRejection = request.catch((error) => error);

        const passedSignal = (mockFetch.mock.calls[0]?.[1] as RequestInit | undefined)?.signal as AbortSignal | undefined;
        if (!passedSignal) {
            throw new Error('Expected fetch to be called with a RequestInit.signal');
        }

        upstreamController.abort();
        expect(passedSignal.aborted).toBe(true);

        await jest.advanceTimersByTimeAsync(100_001);
        await requestRejection;
    });

    it('aborts the core request when the upstream signal aborts', async () => {
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

        const request = fetchWithTimeoutCore(
            'http://example.test/core-upstream-abort',
            { method: 'GET' },
            100_000,
            upstreamController.signal
        );
        const requestRejection = request.catch((error) => error);

        const passedSignal = (mockFetch.mock.calls[0]?.[1] as RequestInit | undefined)?.signal as AbortSignal | undefined;
        if (!passedSignal) {
            throw new Error('Expected fetchWithTimeoutCore to pass a RequestInit.signal');
        }

        upstreamController.abort();
        expect(passedSignal.aborted).toBe(true);

        await jest.advanceTimersByTimeAsync(100_001);
        await requestRejection;
    });

    it('uses OR semantics when both options.signal and upstream signal are set', async () => {
        jest.useFakeTimers();
        const optionsController = new AbortController();
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

        const request = fetchWithTimeout({
            url: 'http://example.test/dual-signal',
            init: { method: 'GET', signal: optionsController.signal },
            timeoutMs: 100_000,
            upstreamSignal: upstreamController.signal,
        });
        const requestRejection = request.catch((error) => error);

        const passedSignal = (mockFetch.mock.calls[0]?.[1] as RequestInit | undefined)?.signal as AbortSignal | undefined;
        if (!passedSignal) {
            throw new Error('Expected fetch to be called with a RequestInit.signal');
        }
        expect(passedSignal).not.toBe(optionsController.signal);
        expect(passedSignal).not.toBe(upstreamController.signal);

        upstreamController.abort();
        expect(passedSignal.aborted).toBe(true);

        await jest.advanceTimersByTimeAsync(100_001);
        await requestRejection;
    });

    it('removes merged abort listeners after a successful request', async () => {
        const optionsController = new AbortController();
        const upstreamController = new AbortController();

        const optionsRemoveSpy = jest.spyOn(optionsController.signal, 'removeEventListener');
        const upstreamRemoveSpy = jest.spyOn(upstreamController.signal, 'removeEventListener');

        const response = { ok: true, status: 200 } as Response;
        mockFetch.mockResolvedValue(response);

        await expect(
            fetchWithTimeout({
                url: 'http://example.test/cleanup',
                init: { method: 'GET', signal: optionsController.signal },
                timeoutMs: 200,
                upstreamSignal: upstreamController.signal,
            })
        ).resolves.toBe(response);

        expect(optionsRemoveSpy).toHaveBeenCalledWith('abort', expect.any(Function));
        expect(upstreamRemoveSpy).toHaveBeenCalledWith('abort', expect.any(Function));

        optionsRemoveSpy.mockRestore();
        upstreamRemoveSpy.mockRestore();
    });
});
