import { fetchWithTimeout } from '../fetchWithTimeout';

describe('fetchWithTimeout', () => {
    let mockFetch: jest.Mock;

    beforeEach(() => {
        mockFetch = jest.fn();
        global.fetch = mockFetch;
    });

    afterEach(() => {
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
});
