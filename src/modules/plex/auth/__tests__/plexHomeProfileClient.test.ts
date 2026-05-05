import { AppErrorCode } from '../../../../types/app-errors';
import type { PlexAuthConfig } from '../interfaces';
import { PlexHomeProfileClient } from '../plexHomeProfileClient';
import { PlexApiError } from '../plexAuthTransport';

const mockConfig: PlexAuthConfig = {
    clientIdentifier: 'test-client-id',
    product: 'Lineup',
    version: '1.0.0',
    platform: 'webOS',
    platformVersion: '6.0',
    device: 'LG Smart TV',
    deviceName: 'Living Room TV',
};

function createJsonResponse(status: number, payload: unknown): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => 'application/json' },
        json: async () => payload,
        text: async () => JSON.stringify(payload),
    } as unknown as Response;
}

describe('PlexHomeProfileClient', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('falls back from empty successful v2 Home users to v1 before returning users', async () => {
        const client = new PlexHomeProfileClient({
            config: mockConfig,
            validateAccountToken: jest.fn(),
        });
        const fetchMock = jest.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(createJsonResponse(200, { MediaContainer: {} }))
            .mockResolvedValueOnce(createJsonResponse(200, {
                MediaContainer: {
                    User: [
                        { id: '1', title: 'Admin', admin: true, protected: false },
                    ],
                },
            }));

        const users = await client.getHomeUsers('account-token');

        expect(users).toHaveLength(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(String(fetchMock.mock.calls[0]![0])).toBe('https://plex.tv/api/v2/home/users');
        expect(String(fetchMock.mock.calls[1]![0])).toBe('https://plex.tv/api/home/users');
    });

    it('classifies Home users 401 as AUTH_REQUIRED and 403 as AUTH_INVALID', async () => {
        const client = new PlexHomeProfileClient({
            config: mockConfig,
            validateAccountToken: jest.fn(),
        });
        const fetchMock = jest.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(createJsonResponse(401, { error: 'unauthorized' }))
            .mockResolvedValueOnce(createJsonResponse(403, { error: 'forbidden' }));

        await expect(client.getHomeUsers('account-token')).rejects.toMatchObject({
            code: AppErrorCode.AUTH_REQUIRED,
            httpStatus: 401,
        });
        await expect(client.getHomeUsers('account-token')).rejects.toMatchObject({
            code: AppErrorCode.AUTH_INVALID,
            httpStatus: 403,
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('classifies switch 401 with a valid account token and PIN as AUTH_FAILED', async () => {
        const validateAccountToken = jest.fn().mockResolvedValue(true);
        const client = new PlexHomeProfileClient({
            config: mockConfig,
            validateAccountToken,
        });
        const fetchMock = jest.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(createJsonResponse(401, { error: 'unauthorized' }));

        await expect(client.requestHomeUserSwitch({
            userId: 'kid',
            accountToken: 'account-token',
            pin: ' 1234 ',
        })).rejects.toMatchObject({
            code: AppErrorCode.AUTH_FAILED,
            httpStatus: 401,
        });

        expect(validateAccountToken).toHaveBeenCalledWith('account-token');
        expect(String(fetchMock.mock.calls[0]![0])).toBe('https://plex.tv/api/v2/home/users/kid/switch?pin=1234');
    });

    it('classifies unsupported switch endpoints as RESOURCE_NOT_FOUND', async () => {
        const client = new PlexHomeProfileClient({
            config: mockConfig,
            validateAccountToken: jest.fn(),
        });
        jest.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(createJsonResponse(404, { error: 'not found' }))
            .mockResolvedValueOnce(createJsonResponse(405, { error: 'not allowed' }));

        await expect(client.requestHomeUserSwitch({
            userId: 'kid',
            accountToken: 'account-token',
        })).rejects.toMatchObject({
            code: AppErrorCode.RESOURCE_NOT_FOUND,
        });
    });

    it('redacts token and PIN values from switch transport causes', async () => {
        const client = new PlexHomeProfileClient({
            config: mockConfig,
            validateAccountToken: jest.fn(),
        });
        const leakedUrl = 'https://plex.tv/api/home/users/kid/switch?pin=1234';
        const cause = new TypeError(`Network error X-Plex-Token=secret url=${leakedUrl}`);
        cause.stack = `TypeError: Network error X-Plex-Token=secret url=${leakedUrl}`;
        jest.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(createJsonResponse(400, { error: 'bad request' }))
            .mockRejectedValueOnce(cause);

        let thrown: unknown;
        try {
            await client.requestHomeUserSwitch({
                userId: 'kid',
                accountToken: 'account-token',
                pin: '1234',
            });
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(PlexApiError);
        expect(thrown).toMatchObject({
            code: AppErrorCode.SERVER_UNREACHABLE,
            cause: {
                message: 'Network error X-Plex-Token=REDACTED url=https://plex.tv/api/home/users/kid/switch?pin=REDACTED',
                stack: 'TypeError: Network error X-Plex-Token=REDACTED url=https://plex.tv/api/home/users/kid/switch?pin=REDACTED',
            },
        });
    });
});
