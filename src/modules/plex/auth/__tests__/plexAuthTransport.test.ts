import { AppErrorCode } from '../../../../types/app-errors';
import { PLEX_AUTH_CONSTANTS } from '../constants';
import { fetchWithRetry, PlexApiError } from '../plexAuthTransport';

describe('fetchWithRetry', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        delete (globalThis as Partial<typeof globalThis>).fetch;
    });

    it('does not treat already-aborted external signals as aborts for non-abort network failures', async () => {
        jest.useFakeTimers();
        const controller = new AbortController();
        controller.abort();
        const networkError = new Error('network failed');
        const fetchMock = jest.fn().mockRejectedValue(networkError);
        (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

        const request = fetchWithRetry('https://plex.tv/api/test', {
            method: 'GET',
            signal: controller.signal,
        });
        const rejection = expect(request).rejects.toMatchObject({
            code: AppErrorCode.SERVER_UNREACHABLE,
            retryable: true,
            cause: {
                name: 'Error',
                message: 'network failed',
            },
        });

        await jest.runAllTimersAsync();

        await rejection;
        expect(fetchMock).toHaveBeenCalledTimes(PLEX_AUTH_CONSTANTS.RETRY_ATTEMPTS);
    });

    it('rethrows abort-named failures when the external signal was already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        const abortError = new DOMException('Aborted', 'AbortError');
        const fetchMock = jest.fn().mockRejectedValue(abortError);
        (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

        await expect(fetchWithRetry('https://plex.tv/api/test', {
            method: 'GET',
            signal: controller.signal,
        })).rejects.toBe(abortError);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('preserves retryable PlexApiError classification with an already-aborted external signal', async () => {
        jest.useFakeTimers();
        const controller = new AbortController();
        controller.abort();
        const serviceError = new PlexApiError(
            AppErrorCode.SERVER_ERROR,
            'Plex service error: 503',
            503,
            true
        );
        const fetchMock = jest.fn().mockRejectedValue(serviceError);
        (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

        const request = fetchWithRetry('https://plex.tv/api/test', {
            method: 'GET',
            signal: controller.signal,
        });
        const rejection = expect(request).rejects.toBe(serviceError);

        await jest.runAllTimersAsync();

        await rejection;
        expect(fetchMock).toHaveBeenCalledTimes(PLEX_AUTH_CONSTANTS.RETRY_ATTEMPTS);
    });
});
