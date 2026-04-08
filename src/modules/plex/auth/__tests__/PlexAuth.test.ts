/**
 * @fileoverview Unit tests for Plex Authentication module.
 * @module modules/plex/auth/__tests__/PlexAuth.test
 */

import { PlexAuth } from '../PlexAuth';
import { PlexAuthConfig, PlexAuthToken } from '../interfaces';
import { PLEX_AUTH_CONSTANTS } from '../constants';

// Mock localStorage
const mockLocalStorage = (function (): Storage {
    let store: Record<string, string> = {};
    return {
        get length(): number {
            return Object.keys(store).length;
        },
        key: function (index: number): string | null {
            const keys = Object.keys(store);
            return keys[index] !== undefined ? keys[index] : null;
        },
        getItem: function (key: string): string | null {
            const value = store[key];
            return value !== undefined ? value : null;
        },
        setItem: function (key: string, value: string): void {
            store[key] = value;
        },
        removeItem: function (key: string): void {
            delete store[key];
        },
        clear: function (): void {
            store = {};
        },
    };
})();

Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
});

// Helper to mock fetch responses
function mockFetchJson(json: unknown, status: number = 200): void {
    (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status: status,
        headers: { get: function () { return null; } },
        json: async function () { return json; },
        text: async function () { return JSON.stringify(json); },
    });
}

// Helper to mock fetch failure
function mockFetchFailure(error: Error): void {
    (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockRejectedValue(error);
}

function createAuthToken(
    token: string,
    userId: string = 'user1'
): PlexAuthToken {
    return {
        token,
        userId,
        username: 'testuser',
        email: 'test@example.com',
        thumb: '',
        expiresAt: null,
        issuedAt: new Date(),
    };
}

function createAuthData(token: PlexAuthToken): {
    accountToken: PlexAuthToken;
    activeToken: PlexAuthToken;
    activeUserId: string;
    selectedServerByUserId: Record<string, { serverId: string | null; serverUri: string | null }>;
} {
    return {
        accountToken: token,
        activeToken: token,
        activeUserId: token.userId,
        selectedServerByUserId: {
            [token.userId]: { serverId: null, serverUri: null },
        },
    };
}

describe('PlexAuth', () => {
    const mockConfig: PlexAuthConfig = {
        clientIdentifier: 'test-client-id',
        product: 'Lineup',
        version: '1.0.0',
        platform: 'webOS',
        platformVersion: '6.0',
        device: 'LG Smart TV',
        deviceName: 'Living Room TV',
    };

    beforeEach(() => {
        mockLocalStorage.clear();
        jest.restoreAllMocks();
    });

    describe('requestPin', () => {
        it('should return a PlexPinRequest with a valid PIN code', async () => {
            const auth = new PlexAuth(mockConfig);
            mockFetchJson({
                id: 1234567890,
                code: 'A1b2',
                expiresAt: '2026-01-15T12:15:00Z',
                authToken: null,
                clientIdentifier: mockConfig.clientIdentifier,
            });

            const pin = await auth.requestPin();

            expect(pin.code).toMatch(/^[A-Za-z0-9]+$/);
            expect(pin.code.length).toBeGreaterThanOrEqual(4);
            expect(pin.id).toBe(1234567890);
            expect(pin.authToken).toBeNull();
        });

        it('should include client identification headers in request', async () => {
            const auth = new PlexAuth(mockConfig);
            mockFetchJson({
                id: 1,
                code: 'ABCD',
                expiresAt: '2026-01-15T12:15:00Z',
                authToken: null,
                clientIdentifier: mockConfig.clientIdentifier,
            });

            await auth.requestPin();

            const fetchMock = (globalThis as unknown as { fetch: jest.Mock }).fetch;
            expect(fetchMock).toHaveBeenCalledTimes(1);
            const callArgs = fetchMock.mock.calls[0];
            const options = callArgs[1] as RequestInit;
            const headers = options.headers as Record<string, string>;

            expect(headers['X-Plex-Client-Identifier']).toBe(mockConfig.clientIdentifier);
            expect(headers['X-Plex-Product']).toBe(mockConfig.product);
            expect(headers['X-Plex-Version']).toBe(mockConfig.version);
            expect(headers['X-Plex-Platform']).toBe(mockConfig.platform);
            expect(headers['Accept']).toBe('application/json');
        });

        it('should throw SERVER_UNREACHABLE on connection failure', async () => {
            jest.useFakeTimers();
            try {
                const auth = new PlexAuth(mockConfig);
                mockFetchFailure(new Error('Network error'));

                const promise = auth.requestPin();
                const rejection = expect(promise).rejects.toMatchObject({
                    code: 'SERVER_UNREACHABLE',
                });

                await jest.runAllTimersAsync();

                await rejection;
            } finally {
                jest.useRealTimers();
            }
        });
    });

    describe('checkPinStatus', () => {
        it('should return updated PIN when not yet claimed', async () => {
            const auth = new PlexAuth(mockConfig);
            mockFetchJson({
                id: 12345,
                code: 'ABCD',
                expiresAt: '2026-01-15T12:15:00Z',
                authToken: null,
                clientIdentifier: mockConfig.clientIdentifier,
            });

            const pin = await auth.checkPinStatus(12345);

            expect(pin.authToken).toBeNull();
            expect(pin.id).toBe(12345);
        });

        it('should store credentials when PIN is claimed', async () => {
            const auth = new PlexAuth(mockConfig);
            const storeCredentialsSpy = jest.spyOn(auth, 'storeCredentials');

            // First call returns claimed PIN
            const fetchMock = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async function () {
                        return {
                            id: 12345,
                            code: 'ABCD',
                            expiresAt: '2026-01-15T12:15:00Z',
                            authToken: 'xyzToken123',
                            clientIdentifier: mockConfig.clientIdentifier,
                        };
                    },
                })
                // Second call fetches user profile
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async function () {
                        return {
                            id: 99999,
                            username: 'testuser',
                            email: 'test@example.com',
                            thumb: 'https://plex.tv/avatar.jpg',
                        };
                    },
                });

            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            await auth.checkPinStatus(12345);

            expect(storeCredentialsSpy).toHaveBeenCalledTimes(1);
            expect(storeCredentialsSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    accountToken: expect.objectContaining({ userId: '99999' }),
                    activeToken: expect.objectContaining({ userId: '99999' }),
                    activeUserId: '99999',
                })
            );
            expect(auth.isAuthenticated()).toBe(true);
        });
    });

    describe('validateToken', () => {
        it('should return true for valid token', async () => {
            const auth = new PlexAuth(mockConfig);
            mockFetchJson({ id: 1, username: 'user', email: 'user@example.com' }, 200);

            const result = await auth.validateToken('valid-token');

            expect(result).toBe(true);
        });

        it('should return false for expired/invalid token', async () => {
            const auth = new PlexAuth(mockConfig);
            mockFetchJson({ error: 'unauthorized' }, 401);

            const result = await auth.validateToken('invalid-token');

            expect(result).toBe(false);
        });

        it('should return false for forbidden token', async () => {
            const auth = new PlexAuth(mockConfig);
            mockFetchJson({ error: 'forbidden' }, 403);

            const result = await auth.validateToken('forbidden-token');

            expect(result).toBe(false);
        });

        it('should update currentUser on successful validation', async () => {
            const auth = new PlexAuth(mockConfig);
            mockFetchJson({
                id: 12345,
                username: 'validateduser',
                email: 'validated@example.com',
                thumb: 'https://plex.tv/thumb.jpg',
            }, 200);

            const result = await auth.validateToken('valid-token');

            expect(result).toBe(true);
            const currentUser = auth.getCurrentUser();
            expect(currentUser).not.toBeNull();
            if (currentUser !== null) {
                expect(currentUser.username).toBe('validateduser');
                expect(currentUser.token).toBe('valid-token');
            }
        });

        it('should return false when token validation times out', async () => {
            jest.useFakeTimers();
            try {
                const auth = new PlexAuth(mockConfig);
                (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockImplementation(
                    (_url: string, options?: RequestInit) =>
                        new Promise((_resolve, reject) => {
                            const signal = options?.signal as AbortSignal | undefined;
                            if (!signal) return;
                            signal.addEventListener(
                                'abort',
                                () => {
                                    const abortError = new Error('The operation was aborted.');
                                    abortError.name = 'AbortError';
                                    reject(abortError);
                                },
                                { once: true }
                            );
                        })
                );

                const promise = auth.validateToken('slow-token');
                await jest.advanceTimersByTimeAsync(PLEX_AUTH_CONSTANTS.TOKEN_VALIDATION_TIMEOUT_MS + 50);
                await expect(promise).resolves.toBe(false);
            } finally {
                jest.useRealTimers();
            }
        });

        it('should throw SERVER_UNREACHABLE on network failure during validation', async () => {
            const auth = new PlexAuth(mockConfig);
            mockFetchFailure(new TypeError('Network error'));

            await expect(auth.validateToken('valid-token')).rejects.toMatchObject({
                code: 'SERVER_UNREACHABLE',
            });
        });

        it('should throw PARSE_ERROR when token validation payload is malformed', async () => {
            const auth = new PlexAuth(mockConfig);
            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: { get: function () { return null; } },
                json: async function () {
                    throw new SyntaxError('Unexpected token');
                },
                text: async function () { return 'not-json'; },
            });

            await expect(auth.validateToken('valid-token')).rejects.toMatchObject({
                code: 'PARSE_ERROR',
            });
        });

        it('should throw PARSE_ERROR when token validation payload has invalid structure', async () => {
            const auth = new PlexAuth(mockConfig);
            mockFetchJson({}, 200);

            await expect(auth.validateToken('valid-token')).rejects.toMatchObject({
                code: 'PARSE_ERROR',
            });
            expect(auth.getCurrentUser()).toBeNull();
            expect(auth.isAuthenticated()).toBe(false);
        });

    });

    describe('getAuthHeaders', () => {
        it('should include all required Plex headers', () => {
            const auth = new PlexAuth(mockConfig);

            const headers = auth.getAuthHeaders();

            expect(headers['Accept']).toBe('application/json');
            expect(headers['X-Plex-Client-Identifier']).toBe(mockConfig.clientIdentifier);
            expect(headers['X-Plex-Product']).toBe(mockConfig.product);
            expect(headers['X-Plex-Version']).toBe(mockConfig.version);
            expect(headers['X-Plex-Platform']).toBe(mockConfig.platform);
            expect(headers['X-Plex-Platform-Version']).toBe(mockConfig.platformVersion);
            expect(headers['X-Plex-Device']).toBe(mockConfig.device);
            expect(headers['X-Plex-Device-Name']).toBe(mockConfig.deviceName);
        });

        it('should not include token header when not authenticated', () => {
            const auth = new PlexAuth(mockConfig);

            const headers = auth.getAuthHeaders();

            expect(headers['X-Plex-Token']).toBeUndefined();
        });

        it('should include X-Plex-Token when authenticated', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('my-secret-token', 'user123');
            await auth.storeCredentials(createAuthData(testToken));

            const headers = auth.getAuthHeaders();

            expect(headers['X-Plex-Token']).toBe('my-secret-token');
            expect((headers as Record<string, string>)['x-plex-token']).toBeUndefined();
        });
    });

    describe('persistence', () => {
        it('should restore credentials from localStorage on init', () => {
            // Pre-populate localStorage
            const storedData = {
                version: PLEX_AUTH_CONSTANTS.STORAGE_VERSION,
                data: {
                    accountToken: {
                        token: 'stored-token',
                        userId: 'user1',
                        username: 'storeduser',
                        email: 'stored@example.com',
                        thumb: '',
                        expiresAt: null,
                        issuedAt: new Date().toISOString(),
                    },
                    activeToken: {
                        token: 'stored-token',
                        userId: 'user1',
                        username: 'storeduser',
                        email: 'stored@example.com',
                        thumb: '',
                        expiresAt: null,
                        issuedAt: new Date().toISOString(),
                    },
                    activeUserId: 'user1',
                    selectedServerByUserId: {
                        user1: { serverId: null, serverUri: null },
                    },
                },
            };
            mockLocalStorage.setItem(
                PLEX_AUTH_CONSTANTS.STORAGE_KEY,
                JSON.stringify(storedData)
            );

            const auth = new PlexAuth(mockConfig);

            expect(auth.isAuthenticated()).toBe(true);
            const currentUser = auth.getCurrentUser();
            expect(currentUser).not.toBeNull();
            if (currentUser !== null) {
                expect(currentUser.token).toBe('stored-token');
                expect(currentUser.username).toBe('storeduser');
            }
        });

        it('should clear localStorage on clearCredentials', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('token-to-clear');

            await auth.storeCredentials(createAuthData(testToken));
            expect(auth.isAuthenticated()).toBe(true);

            await auth.clearCredentials();

            expect(auth.isAuthenticated()).toBe(false);
            expect(auth.getCurrentUser()).toBeNull();
            expect(mockLocalStorage.getItem(PLEX_AUTH_CONSTANTS.STORAGE_KEY)).toBeNull();
        });
    });

    describe('events', () => {
        it('should emit authChange when credentials are stored and cleared', async () => {
            const auth = new PlexAuth(mockConfig);
            const handler = jest.fn();
            auth.on('authChange', handler);

            const testToken = createAuthToken('event-test-token');

            await auth.storeCredentials(createAuthData(testToken));
            await auth.clearCredentials();

            expect(handler).toHaveBeenCalledTimes(2);
            expect(handler).toHaveBeenNthCalledWith(1, true);
            expect(handler).toHaveBeenNthCalledWith(2, false);
        });

        it('should allow unsubscribing from events', async () => {
            const auth = new PlexAuth(mockConfig);
            const handler = jest.fn();
            const disposable = auth.on('authChange', handler);

            disposable.dispose();

            const testToken = createAuthToken('unsubscribe-test');
            await auth.storeCredentials(createAuthData(testToken));

            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('getStoredCredentials', () => {
        it('should return missing when no credentials stored', async () => {
            const auth = new PlexAuth(mockConfig);

            const result = await auth.getStoredCredentials();

            expect(result).toEqual({ kind: 'missing' });
        });

        it('should return available credentials with restored Date objects', async () => {
            const now = new Date();
            const storedData = {
                version: PLEX_AUTH_CONSTANTS.STORAGE_VERSION,
                data: {
                    accountToken: {
                        token: 'test-token',
                        userId: 'user1',
                        username: 'testuser',
                        email: 'test@example.com',
                        thumb: 'https://example.com/thumb.jpg',
                        expiresAt: now.toISOString(),
                        issuedAt: now.toISOString(),
                    },
                    activeToken: {
                        token: 'test-token',
                        userId: 'user1',
                        username: 'testuser',
                        email: 'test@example.com',
                        thumb: 'https://example.com/thumb.jpg',
                        expiresAt: now.toISOString(),
                        issuedAt: now.toISOString(),
                    },
                    activeUserId: 'user1',
                    selectedServerByUserId: {
                        user1: {
                            serverId: 'server1',
                            serverUri: 'https://192.168.1.1:32400',
                        },
                    },
                },
            };
            mockLocalStorage.setItem(
                PLEX_AUTH_CONSTANTS.STORAGE_KEY,
                JSON.stringify(storedData)
            );

            const auth = new PlexAuth(mockConfig);
            const result = await auth.getStoredCredentials();

            expect(result.kind).toBe('available');
            if (result.kind !== 'available') return;
            expect(result.credentials.activeToken.token).toBe('test-token');
            expect(result.credentials.activeToken.issuedAt).toBeInstanceOf(Date);
            expect(result.credentials.activeToken.expiresAt).toBeInstanceOf(Date);
            expect(result.credentials.selectedServerByUserId.user1).toBeDefined();
            expect(result.credentials.selectedServerByUserId.user1?.serverId).toBe('server1');
        });

        it('should return missing when storage access throws', async () => {
            jest.spyOn(mockLocalStorage, 'getItem').mockImplementation(() => {
                throw new Error('blocked');
            });
            const auth = new PlexAuth(mockConfig);

            await expect(auth.getStoredCredentials()).resolves.toEqual({ kind: 'missing' });
        });
    });

    describe('storage failures', () => {
        it('keeps in-memory auth state when storage writes are blocked', async () => {
            jest.spyOn(mockLocalStorage, 'setItem').mockImplementation(() => {
                throw new Error('blocked');
            });

            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('blocked-storage-token');
            await auth.storeCredentials(createAuthData(testToken));

            expect(auth.isAuthenticated()).toBe(true);
            expect(auth.getCurrentUser()?.token).toBe('blocked-storage-token');
        });
    });

    describe('Plex Home', () => {
        it('should parse home users from XML response', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            await auth.storeCredentials(createAuthData(testToken));

            const xml = `
                <MediaContainer size="2">
                  <User id="1" title="Admin" admin="1" protected="1" thumb="https://plex.tv/u1.png" />
                  <User id="2" title="Kid" admin="0" protected="0" restricted="1" />
                </MediaContainer>
            `;
            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: { get: () => 'application/xml' },
                json: async () => ({}),
                text: async () => xml,
            });

            const users = await auth.getHomeUsers();

            expect(users).toHaveLength(2);
            expect(users[0]).toMatchObject({ id: '1', title: 'Admin', admin: true, protected: true });
            expect(users[1]).toMatchObject({ id: '2', title: 'Kid', restricted: true });
        });

        it('should parse home users from XML response with single-quoted attributes', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            await auth.storeCredentials(createAuthData(testToken));

            const xml = `
                <MediaContainer size='2'>
                  <User id='1' title='Admin' admin='1' protected='1' thumb='https://plex.tv/u1.png' />
                  <User id='2' title='Kid' admin='0' protected='0' restricted='1' />
                </MediaContainer>
            `;
            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: { get: () => 'application/xml' },
                json: async () => ({}),
                text: async () => xml,
            });

            const users = await auth.getHomeUsers();

            expect(users).toHaveLength(2);
            expect(users[0]).toMatchObject({ id: '1', title: 'Admin', admin: true, protected: true });
            expect(users[1]).toMatchObject({ id: '2', title: 'Kid', restricted: true });
        });

        it('should parse HomeUser XML tag variants with lowercase attributes', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            await auth.storeCredentials(createAuthData(testToken));

            const xml = `
                <MediaContainer size="2">
                  <HomeUser id="1" username="Admin" admin="1" hasPassword="1" />
                  <homeUser id="2" title="Kid" admin="0" protected="0" restricted="1" />
                </MediaContainer>
            `;
            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: { get: () => 'application/xml' },
                json: async () => ({}),
                text: async () => xml,
            });

            const users = await auth.getHomeUsers();

            expect(users).toHaveLength(2);
            expect(users[0]).toMatchObject({ id: '1', title: 'Admin', protected: true });
            expect(users[1]).toMatchObject({ id: '2', title: 'Kid', restricted: true });
        });

        it('should parse home users from JSON returned as text with non-JSON content-type', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            await auth.storeCredentials(createAuthData(testToken));

            const jsonText = JSON.stringify({
                MediaContainer: {
                    User: [
                        { id: 1, title: 'Admin', admin: 1, protected: 0, thumb: '' },
                        { id: 2, title: 'Kid', admin: 0, protected: 1, restricted: 1 },
                    ],
                },
            });

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: { get: () => 'application/xml' },
                json: async () => ({}),
                text: async () => jsonText,
            });

            const users = await auth.getHomeUsers();

            expect(users).toHaveLength(2);
            expect(users[0]).toMatchObject({ id: '1', title: 'Admin', admin: true, protected: false });
            expect(users[1]).toMatchObject({ id: '2', title: 'Kid', protected: true, restricted: true });
        });

        it('should parse home users from nested JSON HomeUser payloads', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            await auth.storeCredentials(createAuthData(testToken));

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({
                    MediaContainer: {
                        homeUsers: {
                            HomeUser: [
                                { id: '1', username: 'Admin', admin: true, hasPassword: true },
                                { id: '2', title: 'Kid', admin: false, protected: false, restricted: true },
                            ],
                        },
                    },
                }),
                text: async () => '{}',
            });

            const users = await auth.getHomeUsers();

            expect(users).toHaveLength(2);
            expect(users[0]).toMatchObject({ id: '1', title: 'Admin', protected: true });
            expect(users[1]).toMatchObject({ id: '2', title: 'Kid', protected: false, restricted: true });
        });

        it('should throw PARSE_ERROR when home-user payload is malformed JSON text', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            await auth.storeCredentials(createAuthData(testToken));

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: { get: () => 'text/plain' },
                json: async () => {
                    throw new SyntaxError('Unexpected token');
                },
                text: async () => '{"MediaContainer": {"User": [}',
            });

            await expect(auth.getHomeUsers()).rejects.toMatchObject({
                code: 'PARSE_ERROR',
            });
        });

        it('should fall back to v1 endpoint when v2 returns empty profile payload', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            await auth.storeCredentials(createAuthData(testToken));

            const fetchMock = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ MediaContainer: {} }),
                    text: async () => '{}',
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/xml' },
                    json: async () => ({}),
                    text: async () => `
                        <MediaContainer size="2">
                          <User id="1" title="Admin" admin="1" protected="1" />
                          <User id="2" title="Kid" admin="0" protected="0" />
                        </MediaContainer>
                    `,
                });
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            const users = await auth.getHomeUsers();

            expect(users).toHaveLength(2);
            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(String(fetchMock.mock.calls[0][0])).toBe('https://plex.tv/api/v2/home/users');
            expect(String(fetchMock.mock.calls[1][0])).toBe('https://plex.tv/api/home/users');
        });

        it('should build switch URL with pin query param', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            await auth.storeCredentials(createAuthData(testToken));

            const fetchMock = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ authToken: 'switched-token' }),
                    text: async () => JSON.stringify({ authToken: 'switched-token' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({
                        id: 2,
                        username: 'kid',
                        email: 'kid@example.com',
                        thumb: '',
                    }),
                    text: async () => JSON.stringify({ id: 2 }),
                });
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            await auth.switchHomeUser('2', { pin: '1234' });

            const firstUrl = String(fetchMock.mock.calls[0][0]);
            expect(firstUrl).toBe('https://plex.tv/api/v2/home/users/2/switch?pin=1234');
        });

        it('should throw not-supported when both home switch endpoints return 404', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            await auth.storeCredentials(createAuthData(testToken));

            const fetchMock = jest.fn()
                .mockResolvedValueOnce({
                    ok: false,
                    status: 404,
                    headers: { get: () => 'application/json' },
                    json: async () => ({}),
                    text: async () => '{}',
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 404,
                    headers: { get: () => 'application/json' },
                    json: async () => ({}),
                    text: async () => '{}',
                });
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            await expect(auth.switchHomeUser('2')).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('should update active token and emit profileChange on switch', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            await auth.storeCredentials(createAuthData(testToken));

            const handler = jest.fn();
            auth.on('profileChange', handler);

            const fetchMock = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ authToken: 'child-token' }),
                    text: async () => JSON.stringify({ authToken: 'child-token' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({
                        id: 99,
                        username: 'child',
                        email: 'child@example.com',
                        thumb: '',
                    }),
                    text: async () => JSON.stringify({ id: 99 }),
                });
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            await auth.switchHomeUser('99');

            const currentUser = auth.getCurrentUser();
            expect(currentUser?.userId).toBe('99');
            expect(currentUser?.token).toBe('child-token');
            expect(handler).toHaveBeenCalledWith({ fromUserId: 'admin', toUserId: '99' });
        });

        it('uses the selected Plex Home profile id for activeUserId scoping', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            await auth.storeCredentials(createAuthData(testToken));

            const handler = jest.fn();
            auth.on('profileChange', handler);

            const fetchMock = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ authToken: 'child-token' }),
                    text: async () => JSON.stringify({ authToken: 'child-token' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({
                        // Simulate a token profile payload that does not mirror the selected Home user id.
                        id: 'owner-account-id',
                        username: 'child',
                        email: 'child@example.com',
                        thumb: '',
                    }),
                    text: async () => JSON.stringify({ id: 'owner-account-id' }),
                });
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            await auth.switchHomeUser('kid-profile');

            expect(auth.getActiveUserId()).toBe('kid-profile');
            expect(handler).toHaveBeenCalledWith({ fromUserId: 'admin', toUserId: 'kid-profile' });
            const storedRaw = localStorage.getItem(PLEX_AUTH_CONSTANTS.STORAGE_KEY);
            expect(storedRaw).not.toBeNull();
            const stored = JSON.parse(storedRaw ?? '{}') as {
                data?: { activeUserId?: string; selectedServerByUserId?: Record<string, unknown> };
            };
            expect(stored.data?.activeUserId).toBe('kid-profile');
            expect(stored.data?.selectedServerByUserId).toHaveProperty('kid-profile');
        });
    });

    describe('cancelPin', () => {
        it('should clear pending PIN on cancel', async () => {
            const auth = new PlexAuth(mockConfig);

            // First request a PIN
            mockFetchJson({
                id: 12345,
                code: 'ABCD',
                expiresAt: '2026-01-15T12:15:00Z',
                authToken: null,
                clientIdentifier: mockConfig.clientIdentifier,
            });
            await auth.requestPin();

            // Then cancel it - method should complete without throwing
            mockFetchJson({}, 204);
            await auth.cancelPin(12345);

            // Verify PIN was cleared - pendingPin is internal, but a new requestPin
            // should work without conflict
            mockFetchJson({
                id: 67890,
                code: 'WXYZ',
                expiresAt: '2026-01-15T12:15:00Z',
                authToken: null,
                clientIdentifier: mockConfig.clientIdentifier,
            });
            const newPin = await auth.requestPin();
            expect(newPin.id).toBe(67890);
        });
    });
});
