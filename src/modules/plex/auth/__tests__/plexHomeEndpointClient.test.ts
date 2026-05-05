import { requestFirstSupportedHomeEndpoint } from '../plexHomeEndpointClient';

const HOME_ENDPOINTS = [
    'https://plex.tv/api/v2/home/users',
    'https://plex.tv/api/home/users',
];

function createResponse(status: number): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => null },
        json: async () => ({}),
        text: async () => '{}',
    } as unknown as Response;
}

describe('requestFirstSupportedHomeEndpoint', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns unsupported when every endpoint is explicitly unsupported', async () => {
        const fetchSpy = jest.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(createResponse(404))
            .mockResolvedValueOnce(createResponse(405));

        const result = await requestFirstSupportedHomeEndpoint(
            HOME_ENDPOINTS,
            { method: 'GET' },
            null
        );

        expect(result).toEqual({ kind: 'unsupported' });
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('returns the first successful response without probing later endpoints', async () => {
        const response = createResponse(200);
        const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response);

        const result = await requestFirstSupportedHomeEndpoint(
            HOME_ENDPOINTS,
            { method: 'GET' },
            null
        );

        expect(result).toEqual({
            kind: 'response',
            response,
            endpointIndex: 0,
        });
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('returns the actual retryable response endpoint index when later endpoints are unsupported', async () => {
        const retryableResponse = createResponse(500);
        const fetchSpy = jest.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(retryableResponse)
            .mockResolvedValueOnce(createResponse(404));

        const result = await requestFirstSupportedHomeEndpoint(
            HOME_ENDPOINTS,
            { method: 'GET' },
            null
        );

        expect(result).toEqual({
            kind: 'response',
            response: retryableResponse,
            endpointIndex: 0,
        });
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('returns the later successful response endpoint index after unsupported endpoints', async () => {
        const response = createResponse(200);
        const fetchSpy = jest.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(createResponse(404))
            .mockResolvedValueOnce(response);

        const result = await requestFirstSupportedHomeEndpoint(
            HOME_ENDPOINTS,
            { method: 'GET' },
            null
        );

        expect(result).toEqual({
            kind: 'response',
            response,
            endpointIndex: 1,
        });
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('throws the last network error when every endpoint fetch fails', async () => {
        const firstError = new TypeError('first network failure');
        const lastError = new TypeError('last network failure');
        jest.spyOn(globalThis, 'fetch')
            .mockRejectedValueOnce(firstError)
            .mockRejectedValueOnce(lastError);

        await expect(requestFirstSupportedHomeEndpoint(
            HOME_ENDPOINTS,
            { method: 'GET' },
            null
        )).rejects.toBe(lastError);
    });

    it('throws an already-aborted signal reason without fetching', async () => {
        const abortReason = new DOMException('user cancelled', 'AbortError');
        const controller = new AbortController();
        controller.abort(abortReason);
        const fetchSpy = jest.spyOn(globalThis, 'fetch');

        await expect(requestFirstSupportedHomeEndpoint(
            ['https://plex.tv/api/v2/home/users'],
            { method: 'GET' },
            controller.signal
        )).rejects.toBe(abortReason);

        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
