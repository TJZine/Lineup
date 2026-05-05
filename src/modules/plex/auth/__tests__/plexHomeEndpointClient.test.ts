import { requestFirstSupportedHomeEndpoint } from '../plexHomeEndpointClient';

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

    it('returns the actual retryable response endpoint index when later endpoints are unsupported', async () => {
        const retryableResponse = createResponse(500);
        const fetchMock = jest.fn()
            .mockResolvedValueOnce(retryableResponse)
            .mockResolvedValueOnce(createResponse(404));
        (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

        const result = await requestFirstSupportedHomeEndpoint(
            ['https://plex.tv/api/v2/home/users', 'https://plex.tv/api/home/users'],
            { method: 'GET' },
            null
        );

        expect(result).toEqual({
            kind: 'response',
            response: retryableResponse,
            endpointIndex: 0,
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
