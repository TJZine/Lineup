/**
 * @fileoverview Unit tests for Plex Authentication module.
 * @module modules/plex/auth/__tests__/PlexAuth.test
 */

import { PlexAuth } from '../PlexAuth';
import { PlexAuthConfig, PlexAuthToken } from '../interfaces';
import { PLEX_AUTH_CONSTANTS } from '../constants';
import { PlexApiError } from '../plexAuthTransport';
import { AppErrorCode } from '../../../../types/app-errors';

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

async function expectRetryableServerUnreachable(promise: Promise<unknown>): Promise<void> {
    let thrown: unknown;
    try {
        await promise;
    } catch (error) {
        thrown = error;
    }

    expect(thrown).toBeInstanceOf(PlexApiError);
    const plexError = thrown as PlexApiError;
    expect(plexError.code).toBe(AppErrorCode.SERVER_UNREACHABLE);
    expect(plexError.retryable).toBe(true);
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

    describe('constructor', () => {
        it('uses the provided resolved client identifier without re-resolution', () => {
            const config = { ...mockConfig, clientIdentifier: 'resolved-client-from-config' };
            const auth = new PlexAuth(config);

            expect(auth.getAuthHeaders()['X-Plex-Client-Identifier']).toBe('resolved-client-from-config');
        });
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
                const cause = new Error('Network error X-Plex-Token=super-secret');
                cause.stack = 'Error: Network error X-Plex-Token=super-secret\n    at requestPin';
                mockFetchFailure(cause);

                const promise = auth.requestPin();
                const rejection = expect(promise).rejects.toMatchObject({
                    code: 'SERVER_UNREACHABLE',
                    cause: {
                        name: 'Error',
                        message: 'Network error X-Plex-Token=REDACTED',
                        stack: 'Error: Network error X-Plex-Token=REDACTED\n    at requestPin',
                    },
                });

                await jest.runAllTimersAsync();

                await rejection;
            } finally {
                jest.useRealTimers();
            }
        });

        it('throws PARSE_ERROR when a successful PIN payload is malformed', async () => {
            const auth = new PlexAuth(mockConfig);
            mockFetchJson({
                id: 'not-a-number',
                code: 'ABCD',
                expiresAt: '2026-01-15T12:15:00Z',
            });

            await expect(auth.requestPin()).rejects.toMatchObject({
                code: 'PARSE_ERROR',
            });
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

        it('aborts claimed PIN handling before fetching the token profile', async () => {
            const auth = new PlexAuth(mockConfig);
            const storeCredentialsSpy = jest.spyOn(auth, 'storeCredentials');
            const controller = new AbortController();
            const fetchMock = jest.fn().mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async function () {
                    controller.abort();
                    return {
                        id: 12345,
                        code: 'ABCD',
                        expiresAt: '2026-01-15T12:15:00Z',
                        authToken: 'xyzToken123',
                        clientIdentifier: mockConfig.clientIdentifier,
                    };
                },
            });

            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            await expect(auth.checkPinStatus(12345, { signal: controller.signal })).rejects.toMatchObject({
                name: 'AbortError',
            });
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(storeCredentialsSpy).not.toHaveBeenCalled();
            expect(auth.isAuthenticated()).toBe(false);
        });

        it('aborts claimed PIN handling after profile fetch before storing credentials', async () => {
            const auth = new PlexAuth(mockConfig);
            const storeCredentialsSpy = jest.spyOn(auth, 'storeCredentials');
            const controller = new AbortController();
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
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async function () {
                        controller.abort();
                        return {
                            id: 99999,
                            username: 'testuser',
                            email: 'test@example.com',
                            thumb: 'https://plex.tv/avatar.jpg',
                        };
                    },
                });

            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            await expect(auth.checkPinStatus(12345, { signal: controller.signal })).rejects.toMatchObject({
                name: 'AbortError',
            });
            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(storeCredentialsSpy).not.toHaveBeenCalled();
            expect(auth.isAuthenticated()).toBe(false);
        });

        it('throws PARSE_ERROR when a claimed PIN returns an invalid user profile payload', async () => {
            const auth = new PlexAuth(mockConfig);
            const storeCredentialsSpy = jest.spyOn(auth, 'storeCredentials');
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
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async function () {
                        return {
                            id: 99999,
                            username: 'testuser',
                        };
                    },
                });

            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            await expect(auth.checkPinStatus(12345)).rejects.toMatchObject({
                code: AppErrorCode.PARSE_ERROR,
            });
            expect(storeCredentialsSpy).not.toHaveBeenCalled();
            expect(auth.isAuthenticated()).toBe(false);
        });

        it('does not treat a blank authToken as a claimed PIN', async () => {
            const auth = new PlexAuth(mockConfig);
            const storeCredentialsSpy = jest.spyOn(auth, 'storeCredentials');
            mockFetchJson({
                id: 12345,
                code: 'ABCD',
                expiresAt: '2026-01-15T12:15:00Z',
                authToken: '   ',
                clientIdentifier: mockConfig.clientIdentifier,
            });

            const pin = await auth.checkPinStatus(12345);

            expect(pin.authToken).toBeNull();
            expect(storeCredentialsSpy).not.toHaveBeenCalled();
            expect(auth.isAuthenticated()).toBe(false);
        });

        it('throws PARSE_ERROR when a success payload is missing required PIN fields', async () => {
            const auth = new PlexAuth(mockConfig);
            mockFetchJson({
                id: 12345,
                authToken: null,
                clientIdentifier: mockConfig.clientIdentifier,
            });

            await expect(auth.checkPinStatus(12345)).rejects.toMatchObject({
                code: 'PARSE_ERROR',
            });
        });
    });

    describe('pollForPin', () => {
        it('preserves the last retryable PlexApiError instead of collapsing to timeout auth required', async () => {
            jest.useFakeTimers();
            try {
                const auth = new PlexAuth(mockConfig);
                const retryableError = new PlexApiError(
                    AppErrorCode.SERVER_UNREACHABLE,
                    'Temporary network issue',
                    undefined,
                    true
                );
                jest.spyOn(auth, 'checkPinStatus').mockRejectedValue(retryableError);

                const promise = auth.pollForPin(12345);
                const rejection = expect(promise).rejects.toBe(retryableError);
                await jest.advanceTimersByTimeAsync(PLEX_AUTH_CONSTANTS.PIN_TIMEOUT_MS + 1_000);

                await rejection;
            } finally {
                jest.useRealTimers();
            }
        });

        it('falls back to timeout auth required after a retryable error is followed by later unclaimed polls', async () => {
            jest.useFakeTimers();
            try {
                const auth = new PlexAuth(mockConfig);
                const retryableError = new PlexApiError(
                    AppErrorCode.SERVER_UNREACHABLE,
                    'Temporary network issue',
                    undefined,
                    true
                );
                const unclaimedPin = {
                    id: 12345,
                    code: 'ABCD',
                    expiresAt: new Date('2026-01-15T12:15:00Z'),
                    authToken: null,
                    clientIdentifier: mockConfig.clientIdentifier,
                };
                const checkPinStatusSpy = jest
                    .spyOn(auth, 'checkPinStatus')
                    .mockRejectedValueOnce(retryableError)
                    .mockResolvedValue(unclaimedPin);

                const promise = auth.pollForPin(12345);
                const rejection = expect(promise).rejects.toMatchObject({
                    code: AppErrorCode.AUTH_REQUIRED,
                    retryable: false,
                });
                await jest.advanceTimersByTimeAsync(PLEX_AUTH_CONSTANTS.PIN_TIMEOUT_MS + 1_000);

                await rejection;
                expect(checkPinStatusSpy.mock.calls.length).toBeGreaterThan(1);
                expect(checkPinStatusSpy.mock.calls.length).toBeLessThanOrEqual(
                    Math.ceil(
                        PLEX_AUTH_CONSTANTS.PIN_TIMEOUT_MS /
                            PLEX_AUTH_CONSTANTS.PIN_POLL_INTERVAL_MS
                    )
                );
            } finally {
                jest.useRealTimers();
            }
        });

        it('still throws non-retryable PIN errors immediately', async () => {
            jest.useFakeTimers();
            try {
                const auth = new PlexAuth(mockConfig);
                const terminalError = new PlexApiError(
                    AppErrorCode.AUTH_REQUIRED,
                    'PIN expired',
                    undefined,
                    false
                );
                jest.spyOn(auth, 'checkPinStatus').mockRejectedValue(terminalError);

                const promise = auth.pollForPin(12345);

                await expect(promise).rejects.toBe(terminalError);
            } finally {
                jest.useRealTimers();
            }
        });

        it('aborts polling without checking PIN status when the signal is already cancelled', async () => {
            const auth = new PlexAuth(mockConfig);
            const checkPinStatusSpy = jest.spyOn(auth, 'checkPinStatus');
            const controller = new AbortController();
            controller.abort();

            await expect(auth.pollForPin(12345, { signal: controller.signal })).rejects.toMatchObject({
                name: 'AbortError',
            });
            expect(checkPinStatusSpy).not.toHaveBeenCalled();
        });

        it('aborts polling while waiting between unclaimed PIN checks', async () => {
            jest.useFakeTimers();
            try {
                const auth = new PlexAuth(mockConfig);
                const unclaimedPin = {
                    id: 12345,
                    code: 'ABCD',
                    expiresAt: new Date('2026-01-15T12:15:00Z'),
                    authToken: null,
                    clientIdentifier: mockConfig.clientIdentifier,
                };
                const checkPinStatusSpy = jest.spyOn(auth, 'checkPinStatus').mockResolvedValue(unclaimedPin);
                const controller = new AbortController();

                const promise = auth.pollForPin(12345, { signal: controller.signal });
                await Promise.resolve();
                controller.abort();

                await expect(promise).rejects.toMatchObject({
                    name: 'AbortError',
                });
                expect(checkPinStatusSpy).toHaveBeenCalledTimes(1);
            } finally {
                jest.useRealTimers();
            }
        });

        it('aborts polling immediately when the signal aborts during sleep listener registration', async () => {
            jest.useFakeTimers();
            const auth = new PlexAuth(mockConfig);
            const unclaimedPin = {
                id: 12345,
                code: 'ABCD',
                expiresAt: new Date('2026-01-15T12:15:00Z'),
                authToken: null,
                clientIdentifier: mockConfig.clientIdentifier,
            };
            jest.spyOn(auth, 'checkPinStatus').mockResolvedValue(unclaimedPin);

            let aborted = false;
            const abortReason = new DOMException('Aborted', 'AbortError');
            const signal = {
                get aborted(): boolean {
                    return aborted;
                },
                get reason(): DOMException {
                    return abortReason;
                },
                addEventListener: jest.fn(() => {
                    aborted = true;
                }),
                removeEventListener: jest.fn(),
            } as unknown as AbortSignal;
            const request = auth.pollForPin(12345, { signal });

            try {
                await Promise.resolve();
                await Promise.resolve();

                await expect(request).rejects.toMatchObject({ name: 'AbortError' });
            } finally {
                jest.runOnlyPendingTimers();
                await request.catch(() => undefined);
                jest.useRealTimers();
            }
        });

        it('rethrows non-PlexApiError polling failures immediately', async () => {
            jest.useFakeTimers();
            try {
                const auth = new PlexAuth(mockConfig);
                const terminalError = new Error('unexpected parser failure');
                const checkPinStatusSpy = jest.spyOn(auth, 'checkPinStatus').mockRejectedValue(terminalError);

                await expect(auth.pollForPin(12345)).rejects.toThrow('unexpected parser failure');
                expect(checkPinStatusSpy).toHaveBeenCalledTimes(1);
            } finally {
                jest.useRealTimers();
            }
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

        it('should throw RATE_LIMITED for 429 responses', async () => {
            const auth = new PlexAuth(mockConfig);
            mockFetchJson({ error: 'rate_limited' }, 429);

            await expect(auth.validateToken('busy-token')).rejects.toMatchObject({
                code: 'RATE_LIMITED',
            });
        });

        it('should throw SERVER_ERROR for 5xx responses', async () => {
            const auth = new PlexAuth(mockConfig);
            mockFetchJson({ error: 'server_error' }, 503);

            await expect(auth.validateToken('server-token')).rejects.toMatchObject({
                code: 'SERVER_ERROR',
                httpStatus: 503,
            });
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

        it('should throw NETWORK_TIMEOUT when token validation times out', async () => {
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
                const rejection = expect(promise).rejects.toMatchObject({
                    code: 'NETWORK_TIMEOUT',
                    cause: {
                        name: 'AbortError',
                        message: 'The operation was aborted.',
                    },
                });
                await jest.advanceTimersByTimeAsync(PLEX_AUTH_CONSTANTS.TOKEN_VALIDATION_TIMEOUT_MS + 50);
                await rejection;
            } finally {
                jest.useRealTimers();
            }
        });

        it('should throw SERVER_UNREACHABLE on network failure during validation', async () => {
            const auth = new PlexAuth(mockConfig);
            const cause = new TypeError('Network error X-Plex-Token=validation-secret');
            cause.stack = 'TypeError: Network error X-Plex-Token=validation-secret\n    at validateToken';
            mockFetchFailure(cause);

            await expect(auth.validateToken('valid-token')).rejects.toMatchObject({
                code: 'SERVER_UNREACHABLE',
                cause: {
                    name: 'TypeError',
                    message: 'Network error X-Plex-Token=REDACTED',
                    stack: 'TypeError: Network error X-Plex-Token=REDACTED\n    at validateToken',
                },
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
            auth.storeCredentials(createAuthData(testToken));

            const headers = auth.getAuthHeaders();

            expect(headers['X-Plex-Token']).toBe('my-secret-token');
            expect((headers as Record<string, string>)['x-plex-token']).toBeUndefined();
        });
    });

    describe('persistence', () => {
        it('leaves in-memory auth state unauthenticated until stored credentials are explicitly read', async () => {
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

            expect(auth.isAuthenticated()).toBe(false);
            expect(auth.getCurrentUser()).toBeNull();
            expect(auth.readStoredCredentialsAndClearCorruption()).toEqual({
                kind: 'available',
                credentials: expect.objectContaining({
                    activeUserId: 'user1',
                    activeToken: expect.objectContaining({
                        token: 'stored-token',
                        username: 'storeduser',
                    }),
                }),
            });
        });

        it('should clear localStorage on clearCredentials', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('token-to-clear');

            auth.storeCredentials(createAuthData(testToken));
            expect(auth.isAuthenticated()).toBe(true);

            auth.clearCredentials();

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

            auth.storeCredentials(createAuthData(testToken));
            auth.clearCredentials();

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
            auth.storeCredentials(createAuthData(testToken));

            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('readStoredCredentialsAndClearCorruption', () => {
        it('should return missing when no credentials stored', async () => {
            const auth = new PlexAuth(mockConfig);

            const result = auth.readStoredCredentialsAndClearCorruption();

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
            const result = auth.readStoredCredentialsAndClearCorruption();

            expect(result.kind).toBe('available');
            if (result.kind !== 'available') return;
            expect(result.credentials.activeToken.token).toBe('test-token');
            expect(result.credentials.activeToken.issuedAt).toBeInstanceOf(Date);
            expect(result.credentials.activeToken.expiresAt).toBeInstanceOf(Date);
            expect(result.credentials.selectedServerByUserId.user1).toBeDefined();
            expect(result.credentials.selectedServerByUserId.user1?.serverId).toBe('server1');
        });

        it('does not hydrate runtime auth state from storage before an explicit startup write', async () => {
            const now = new Date();
            mockLocalStorage.setItem(
                PLEX_AUTH_CONSTANTS.STORAGE_KEY,
                JSON.stringify({
                    version: PLEX_AUTH_CONSTANTS.STORAGE_VERSION,
                    data: {
                        accountToken: {
                            token: 'account-token',
                            userId: 'account-user',
                            username: 'account',
                            email: 'account@example.com',
                            thumb: '',
                            expiresAt: null,
                            issuedAt: now.toISOString(),
                        },
                        activeToken: {
                            token: 'active-token',
                            userId: 'active-user',
                            username: 'active',
                            email: 'active@example.com',
                            thumb: '',
                            expiresAt: null,
                            issuedAt: now.toISOString(),
                        },
                        activeUserId: 'active-user',
                        selectedServerByUserId: {
                            'active-user': {
                                serverId: null,
                                serverUri: null,
                            },
                        },
                    },
                })
            );

            const auth = new PlexAuth(mockConfig);

            expect(auth.isAuthenticated()).toBe(false);
            expect(auth.getCurrentUser()).toBeNull();
            expect(auth.getActiveUserId()).toBeNull();
        });

        it('normalizes malformed persisted deviceKey payloads to null', async () => {
            const auth = new PlexAuth(mockConfig);
            const token = createAuthToken('account-token', 'user-1');

            mockLocalStorage.setItem(
                PLEX_AUTH_CONSTANTS.STORAGE_KEY,
                JSON.stringify({
                    version: PLEX_AUTH_CONSTANTS.STORAGE_VERSION,
                    data: {
                        ...createAuthData(token),
                        deviceKey: {},
                    },
                })
            );

            expect(auth.readStoredCredentialsAndClearCorruption()).toEqual({
                kind: 'available',
                credentials: expect.objectContaining({
                    activeUserId: 'user-1',
                    deviceKey: null,
                }),
            });
        });

        it('preserves valid persisted deviceKey payloads', async () => {
            const auth = new PlexAuth(mockConfig);
            const token = createAuthToken('account-token', 'user-1');
            const createdAt = new Date('2026-04-08T12:00:00.000Z');

            mockLocalStorage.setItem(
                PLEX_AUTH_CONSTANTS.STORAGE_KEY,
                JSON.stringify({
                    version: PLEX_AUTH_CONSTANTS.STORAGE_VERSION,
                    data: {
                        ...createAuthData(token),
                        deviceKey: {
                            kid: 'device-key-1',
                            privateKey: 'base64url-private-key',
                            createdAt: createdAt.toISOString(),
                            publicJwk: {
                                kty: 'OKP',
                                crv: 'Ed25519',
                                x: 'public-x',
                                alg: 'EdDSA',
                                use: 'sig',
                                kid: 'jwk-kid-1',
                            },
                        },
                    },
                })
            );

            expect(auth.readStoredCredentialsAndClearCorruption()).toEqual({
                kind: 'available',
                credentials: expect.objectContaining({
                    activeUserId: 'user-1',
                    deviceKey: {
                        kid: 'device-key-1',
                        privateKey: 'base64url-private-key',
                        createdAt,
                        publicJwk: {
                            kty: 'OKP',
                            crv: 'Ed25519',
                            x: 'public-x',
                            alg: 'EdDSA',
                            use: 'sig',
                            kid: 'jwk-kid-1',
                        },
                    },
                }),
            });
        });

        it('normalizes deviceKey to null when persisted publicJwk is malformed', async () => {
            const auth = new PlexAuth(mockConfig);
            const token = createAuthToken('account-token', 'user-1');

            mockLocalStorage.setItem(
                PLEX_AUTH_CONSTANTS.STORAGE_KEY,
                JSON.stringify({
                    version: PLEX_AUTH_CONSTANTS.STORAGE_VERSION,
                    data: {
                        ...createAuthData(token),
                        deviceKey: {
                            kid: 'device-key-1',
                            privateKey: 'base64url-private-key',
                            createdAt: '2026-04-08T12:00:00.000Z',
                            publicJwk: {
                                kty: 'OKP',
                                crv: 'Ed25519',
                                x: 42,
                                alg: 'EdDSA',
                            },
                        },
                    },
                })
            );

            expect(auth.readStoredCredentialsAndClearCorruption()).toEqual({
                kind: 'available',
                credentials: expect.objectContaining({
                    activeUserId: 'user-1',
                    deviceKey: null,
                }),
            });
        });

        it('should return missing when storage access throws', async () => {
            jest.spyOn(mockLocalStorage, 'getItem').mockImplementation(() => {
                throw new Error('blocked');
            });
            const auth = new PlexAuth(mockConfig);

            expect(auth.readStoredCredentialsAndClearCorruption()).toEqual({ kind: 'missing' });
        });

        it('returns corrupted invalid-json and clears stored key', async () => {
            mockLocalStorage.setItem(PLEX_AUTH_CONSTANTS.STORAGE_KEY, '{not-json');
            const auth = new PlexAuth(mockConfig);

            const result = auth.readStoredCredentialsAndClearCorruption();

            expect(result).toEqual({ kind: 'corrupted', reason: 'invalid-json' });
            expect(mockLocalStorage.getItem(PLEX_AUTH_CONSTANTS.STORAGE_KEY)).toBeNull();
            expect(auth.readStoredCredentialsAndClearCorruption()).toEqual({ kind: 'missing' });
        });

        it('returns corrupted invalid-shape for malformed payloads', async () => {
            mockLocalStorage.setItem(
                PLEX_AUTH_CONSTANTS.STORAGE_KEY,
                JSON.stringify({
                    version: PLEX_AUTH_CONSTANTS.STORAGE_VERSION,
                    data: {
                        accountToken: null,
                    },
                })
            );
            const auth = new PlexAuth(mockConfig);

            const result = auth.readStoredCredentialsAndClearCorruption();

            expect(result).toEqual({ kind: 'corrupted', reason: 'invalid-shape' });
            expect(mockLocalStorage.getItem(PLEX_AUTH_CONSTANTS.STORAGE_KEY)).toBeNull();
        });

        it('returns corrupted unsupported-version for unsupported storage version', async () => {
            const now = new Date().toISOString();
            mockLocalStorage.setItem(
                PLEX_AUTH_CONSTANTS.STORAGE_KEY,
                JSON.stringify({
                    version: 999,
                    data: {
                        accountToken: {
                            token: 'test-token',
                            userId: 'user1',
                            username: 'testuser',
                            email: 'test@example.com',
                            thumb: '',
                            expiresAt: null,
                            issuedAt: now,
                        },
                        activeToken: {
                            token: 'test-token',
                            userId: 'user1',
                            username: 'testuser',
                            email: 'test@example.com',
                            thumb: '',
                            expiresAt: null,
                            issuedAt: now,
                        },
                        activeUserId: 'user1',
                        selectedServerByUserId: {
                            user1: { serverId: null, serverUri: null },
                        },
                    },
                })
            );
            const auth = new PlexAuth(mockConfig);

            const result = auth.readStoredCredentialsAndClearCorruption();

            expect(result).toEqual({ kind: 'corrupted', reason: 'unsupported-version' });
            expect(mockLocalStorage.getItem(PLEX_AUTH_CONSTANTS.STORAGE_KEY)).toBeNull();
        });

        it('surfaces corruption on the first explicit read and clears it for later reads', async () => {
            mockLocalStorage.setItem(PLEX_AUTH_CONSTANTS.STORAGE_KEY, '{not-json');
            const auth = new PlexAuth(mockConfig);

            expect(auth.readStoredCredentialsAndClearCorruption()).toEqual({
                kind: 'corrupted',
                reason: 'invalid-json',
            });
            expect(auth.readStoredCredentialsAndClearCorruption()).toEqual({ kind: 'missing' });
        });
    });

    describe('storage failures', () => {
        it('keeps in-memory auth state when storage writes are blocked', async () => {
            jest.spyOn(mockLocalStorage, 'setItem').mockImplementation(() => {
                throw new Error('blocked');
            });

            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('blocked-storage-token');
            auth.storeCredentials(createAuthData(testToken));

            expect(auth.isAuthenticated()).toBe(true);
            expect(auth.getCurrentUser()?.token).toBe('blocked-storage-token');
            expect(auth.readStoredCredentialsAndClearCorruption()).toEqual({ kind: 'missing' });
        });
    });

    describe('Plex Home', () => {
        it('should parse home users from XML response', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            auth.storeCredentials(createAuthData(testToken));

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
            auth.storeCredentials(createAuthData(testToken));

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
            auth.storeCredentials(createAuthData(testToken));

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
            auth.storeCredentials(createAuthData(testToken));

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
            auth.storeCredentials(createAuthData(testToken));
            const payload = {
                MediaContainer: {
                    homeUsers: {
                        HomeUser: [
                            { id: '1', username: 'Admin', admin: true, hasPassword: true },
                            { id: '2', title: 'Kid', admin: false, protected: false, restricted: true },
                        ],
                    },
                },
            };

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => payload,
                text: async () => JSON.stringify(payload),
            });

            const users = await auth.getHomeUsers();

            expect(users).toHaveLength(2);
            expect(users[0]).toMatchObject({ id: '1', title: 'Admin', protected: true });
            expect(users[1]).toMatchObject({ id: '2', title: 'Kid', protected: false, restricted: true });
        });

        it('should throw PARSE_ERROR when home-user payload is malformed JSON text', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            auth.storeCredentials(createAuthData(testToken));

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
            auth.storeCredentials(createAuthData(testToken));

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

        it.each([404, 405])(
            'preserves SERVER_UNREACHABLE when getHomeUsers sees a v2 transport failure followed by v1 unsupported %s',
            async (unsupportedStatus) => {
                const auth = new PlexAuth(mockConfig);
                const testToken = createAuthToken('account-token', 'admin');
                auth.storeCredentials(createAuthData(testToken));

                const fetchMock = jest.fn()
                    .mockRejectedValueOnce(new TypeError('Network error'))
                    .mockResolvedValueOnce({
                        ok: false,
                        status: unsupportedStatus,
                        headers: { get: () => 'application/json' },
                        json: async () => ({}),
                        text: async () => '{}',
                    });
                (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

                await expect(auth.getHomeUsers()).rejects.toMatchObject({
                    code: 'SERVER_UNREACHABLE',
                    retryable: true,
                });
                expect(fetchMock).toHaveBeenCalledTimes(2);
            }
        );

        it.each([404, 405])(
            'preserves SERVER_UNREACHABLE when getHomeUsers sees v2 unsupported %s followed by v1 transport failure',
            async (unsupportedStatus) => {
                const auth = new PlexAuth(mockConfig);
                const testToken = createAuthToken('account-token', 'admin');
                auth.storeCredentials(createAuthData(testToken));

                const fetchMock = jest.fn()
                    .mockResolvedValueOnce({
                        ok: false,
                        status: unsupportedStatus,
                        headers: { get: () => 'application/json' },
                        json: async () => ({}),
                        text: async () => '{}',
                    })
                    .mockRejectedValueOnce(new TypeError('Network error'));
                (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

                await expect(auth.getHomeUsers()).rejects.toMatchObject({
                    code: 'SERVER_UNREACHABLE',
                    retryable: true,
                });
                expect(fetchMock).toHaveBeenCalledTimes(2);
            }
        );

        it.each([404, 405])(
            'preserves SERVER_UNREACHABLE status when getHomeUsers sees v2 500 followed by v1 %s',
            async (unsupportedStatus) => {
                const auth = new PlexAuth(mockConfig);
                const testToken = createAuthToken('account-token', 'admin');
                auth.storeCredentials(createAuthData(testToken));

                const fetchMock = jest.fn()
                    .mockResolvedValueOnce({
                        ok: false,
                        status: 500,
                        headers: { get: () => 'application/json' },
                        json: async () => ({ error: 'server failure' }),
                        text: async () => '{}',
                    })
                    .mockResolvedValueOnce({
                        ok: false,
                        status: unsupportedStatus,
                        headers: { get: () => 'application/json' },
                        json: async () => ({}),
                        text: async () => '{}',
                    });
                (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

                await expect(auth.getHomeUsers()).rejects.toMatchObject({
                    code: 'SERVER_UNREACHABLE',
                    httpStatus: 500,
                    retryable: true,
                });
                expect(fetchMock).toHaveBeenCalledTimes(2);
            }
        );

        it('preserves the later transport failure when getHomeUsers sees v2 400 followed by v1 transport failure', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            auth.storeCredentials(createAuthData(testToken));

            const cause = new TypeError('Network error X-Plex-Token=home-secret');
            cause.stack = 'TypeError: Network error X-Plex-Token=home-secret\n    at getHomeUsers';
            const fetchMock = jest.fn()
                .mockResolvedValueOnce({
                    ok: false,
                    status: 400,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ error: 'bad request' }),
                    text: async () => '{}',
                })
                .mockRejectedValueOnce(cause);
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            await expect(auth.getHomeUsers()).rejects.toMatchObject({
                code: 'SERVER_UNREACHABLE',
                retryable: true,
                cause: {
                    name: 'TypeError',
                    message: 'Network error X-Plex-Token=REDACTED',
                    stack: 'TypeError: Network error X-Plex-Token=REDACTED\n    at getHomeUsers',
                },
            });
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('propagates AbortError when getHomeUsers is cancelled by the caller', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            auth.storeCredentials(createAuthData(testToken));

            const controller = new AbortController();
            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockImplementation(
                (_url: string, options?: RequestInit) =>
                    new Promise((_resolve, reject) => {
                        const signal = options?.signal as AbortSignal | undefined;
                        if (!signal) {
                            return;
                        }
                        signal.addEventListener('abort', () => {
                            reject(new DOMException('Aborted', 'AbortError'));
                        }, { once: true });
                    })
            );

            const request = auth.getHomeUsers({ signal: controller.signal });
            controller.abort();

            await expect(request).rejects.toMatchObject({ name: 'AbortError' });
        });

        it('maps fetchWithTimeout AbortError timeouts from getHomeUsers to retryable SERVER_UNREACHABLE', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            auth.storeCredentials(createAuthData(testToken));

            const fetchMock = jest.fn()
                .mockRejectedValue(new DOMException('Aborted', 'AbortError'));
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            await expectRetryableServerUnreachable(auth.getHomeUsers());
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('should build switch URL with pin query param', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            auth.storeCredentials(createAuthData(testToken));

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

        it('falls back to the v1 switch endpoint when the v2 PIN-protected switch returns 500', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            auth.storeCredentials(createAuthData(testToken));

            const fetchMock = jest.fn()
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ error: 'server failure' }),
                    text: async () => '{}',
                })
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
                        id: 'kid',
                        username: 'kid',
                        email: 'kid@example.com',
                        thumb: '',
                    }),
                    text: async () => JSON.stringify({ id: 'kid' }),
                });
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            await auth.switchHomeUser('kid', { pin: '1234' });

            expect(fetchMock).toHaveBeenCalledTimes(3);
            expect(String(fetchMock.mock.calls[0][0])).toBe('https://plex.tv/api/v2/home/users/kid/switch?pin=1234');
            expect(String(fetchMock.mock.calls[1][0])).toBe('https://plex.tv/api/home/users/kid/switch?pin=1234');
            expect(auth.getCurrentUser()?.token).toBe('child-token');
        });

        it.each([404, 405])(
            'preserves SERVER_UNREACHABLE when switchHomeUser sees a v2 transport failure followed by v1 unsupported %s',
            async (unsupportedStatus) => {
                const auth = new PlexAuth(mockConfig);
                const testToken = createAuthToken('account-token', 'admin');
                auth.storeCredentials(createAuthData(testToken));

                const fetchMock = jest.fn()
                    .mockRejectedValueOnce(new TypeError('Network error'))
                    .mockResolvedValueOnce({
                        ok: false,
                        status: unsupportedStatus,
                        headers: { get: () => 'application/json' },
                        json: async () => ({}),
                        text: async () => '{}',
                    });
                (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

                await expect(auth.switchHomeUser('2')).rejects.toMatchObject({
                    code: 'SERVER_UNREACHABLE',
                    retryable: true,
                });
                expect(fetchMock).toHaveBeenCalledTimes(2);
            }
        );

        it.each([404, 405])(
            'preserves SERVER_UNREACHABLE when switchHomeUser sees v2 unsupported %s followed by v1 transport failure',
            async (unsupportedStatus) => {
                const auth = new PlexAuth(mockConfig);
                const testToken = createAuthToken('account-token', 'admin');
                auth.storeCredentials(createAuthData(testToken));

                const fetchMock = jest.fn()
                    .mockResolvedValueOnce({
                        ok: false,
                        status: unsupportedStatus,
                        headers: { get: () => 'application/json' },
                        json: async () => ({}),
                        text: async () => '{}',
                    })
                    .mockRejectedValueOnce(new TypeError('Network error'));
                (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

                await expect(auth.switchHomeUser('2')).rejects.toMatchObject({
                    code: 'SERVER_UNREACHABLE',
                    retryable: true,
                });
                expect(fetchMock).toHaveBeenCalledTimes(2);
            }
        );

        it.each([404, 405])(
            'preserves SERVER_UNREACHABLE status when switchHomeUser sees v2 500 followed by v1 %s',
            async (unsupportedStatus) => {
                const auth = new PlexAuth(mockConfig);
                const testToken = createAuthToken('account-token', 'admin');
                auth.storeCredentials(createAuthData(testToken));

                const fetchMock = jest.fn()
                    .mockResolvedValueOnce({
                        ok: false,
                        status: 500,
                        headers: { get: () => 'application/json' },
                        json: async () => ({ error: 'server failure' }),
                        text: async () => '{}',
                    })
                    .mockResolvedValueOnce({
                        ok: false,
                        status: unsupportedStatus,
                        headers: { get: () => 'application/json' },
                        json: async () => ({}),
                        text: async () => '{}',
                    });
                (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

                await expect(auth.switchHomeUser('2')).rejects.toMatchObject({
                    code: 'SERVER_UNREACHABLE',
                    httpStatus: 500,
                    retryable: true,
                });
                expect(fetchMock).toHaveBeenCalledTimes(2);
            }
        );

        it('preserves the later transport failure when switchHomeUser sees v2 400 followed by v1 transport failure', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            auth.storeCredentials(createAuthData(testToken));

            const leakedUrl = 'https://plex.tv/api/home/users/2/switch?pin=1234';
            const cause = new TypeError(`Network error X-Plex-Token=switch-secret url=${leakedUrl}`);
            cause.stack = `TypeError: Network error X-Plex-Token=switch-secret url=${leakedUrl}\n    at switchHomeUser`;
            const fetchMock = jest.fn()
                .mockResolvedValueOnce({
                    ok: false,
                    status: 400,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ error: 'bad request' }),
                    text: async () => '{}',
                })
                .mockRejectedValueOnce(cause);
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            await expect(auth.switchHomeUser('2')).rejects.toMatchObject({
                code: 'SERVER_UNREACHABLE',
                retryable: true,
                cause: {
                    name: 'TypeError',
                    message: 'Network error X-Plex-Token=REDACTED url=https://plex.tv/api/home/users/2/switch?pin=REDACTED',
                    stack: 'TypeError: Network error X-Plex-Token=REDACTED url=https://plex.tv/api/home/users/2/switch?pin=REDACTED\n    at switchHomeUser',
                },
            });
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('redacts token and PIN values from object-shaped switch transport causes', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            auth.storeCredentials(createAuthData(testToken));

            const leakedUrl = 'https://plex.tv/api/home/users/2/switch?pin=2468';
            const fetchMock = jest.fn()
                .mockResolvedValueOnce({
                    ok: false,
                    status: 400,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ error: 'bad request' }),
                    text: async () => '{}',
                })
                .mockRejectedValueOnce({
                    message: `Network error X-Plex-Token=object-secret url=${leakedUrl}`,
                    request: {
                        url: leakedUrl,
                        params: {
                            pin: '2468',
                        },
                        body: {
                            PIN: '1357',
                        },
                    },
                });
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            let thrown: unknown;
            try {
                await auth.switchHomeUser('2');
            } catch (error) {
                thrown = error;
            }

            expect(thrown).toBeInstanceOf(PlexApiError);
            const cause = (thrown as PlexApiError).cause as { summary?: string };
            expect(cause.summary).toContain('X-Plex-Token=REDACTED');
            expect(cause.summary).toContain('pin=REDACTED');
            expect(cause.summary).not.toContain('object-secret');
            expect(cause.summary).not.toContain('pin=2468');
            expect(cause.summary).not.toContain('"pin":"2468"');
            expect(cause.summary).not.toContain('"PIN":"1357"');
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('treats 401 + valid account token as wrong PIN', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            auth.storeCredentials(createAuthData(testToken));

            const fetchMock = jest.fn()
                .mockResolvedValueOnce({
                    ok: false,
                    status: 401,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ error: 'unauthorized' }),
                    text: async () => '{}',
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({
                        id: 'admin',
                        username: 'admin',
                        email: 'admin@example.com',
                    }),
                    text: async () => '{}',
                });
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            await expect(auth.switchHomeUser('2', { pin: '1234' })).rejects.toMatchObject({
                code: 'AUTH_FAILED',
                httpStatus: 401,
            });
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('treats 401 + invalid account token as auth required', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            auth.storeCredentials(createAuthData(testToken));

            const fetchMock = jest.fn()
                .mockResolvedValueOnce({
                    ok: false,
                    status: 401,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ error: 'unauthorized' }),
                    text: async () => '{}',
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 401,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ error: 'unauthorized' }),
                    text: async () => '{}',
                });
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            await expect(auth.switchHomeUser('2', { pin: '1234' })).rejects.toMatchObject({
                code: 'AUTH_REQUIRED',
                httpStatus: 401,
            });
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('treats 403 + invalid account token as auth invalid', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            auth.storeCredentials(createAuthData(testToken));

            const fetchMock = jest.fn()
                .mockResolvedValueOnce({
                    ok: false,
                    status: 403,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ error: 'forbidden' }),
                    text: async () => '{}',
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 403,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ error: 'forbidden' }),
                    text: async () => '{}',
                });
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            await expect(auth.switchHomeUser('2', { pin: '1234' })).rejects.toMatchObject({
                code: 'AUTH_INVALID',
                httpStatus: 403,
            });
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('propagates service/network failures from validateToken during PIN disambiguation', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            auth.storeCredentials(createAuthData(testToken));

            const fetchMock = jest.fn()
                .mockResolvedValueOnce({
                    ok: false,
                    status: 401,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ error: 'unauthorized' }),
                    text: async () => '{}',
                })
                .mockRejectedValueOnce(new TypeError('Network error'));
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            await expect(auth.switchHomeUser('2', { pin: '1234' })).rejects.toMatchObject({
                code: 'SERVER_UNREACHABLE',
            });
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('propagates AbortError when switchHomeUser is cancelled before the switch request completes', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            auth.storeCredentials(createAuthData(testToken));

            const controller = new AbortController();
            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockImplementation(
                (_url: string, options?: RequestInit) =>
                    new Promise((_resolve, reject) => {
                        const signal = options?.signal as AbortSignal | undefined;
                        if (!signal) {
                            return;
                        }
                        signal.addEventListener('abort', () => {
                            reject(new DOMException('Aborted', 'AbortError'));
                        }, { once: true });
                    })
            );

            const request = auth.switchHomeUser('2', { signal: controller.signal });
            controller.abort();

            await expect(request).rejects.toMatchObject({ name: 'AbortError' });
        });

        it('maps fetchWithTimeout AbortError timeouts from switchHomeUser to retryable SERVER_UNREACHABLE', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            auth.storeCredentials(createAuthData(testToken));

            const fetchMock = jest.fn()
                .mockRejectedValue(new DOMException('Aborted', 'AbortError'));
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            await expectRetryableServerUnreachable(auth.switchHomeUser('2'));
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('propagates AbortError when switchHomeUser is cancelled during profile fetch', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            auth.storeCredentials(createAuthData(testToken));

            const controller = new AbortController();
            let notifySecondFetchStarted: (() => void) | null = null;
            const secondFetchStarted = new Promise<void>((resolve) => {
                notifySecondFetchStarted = resolve;
            });
            const fetchMock = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => ({ authToken: 'switched-token' }),
                    text: async () => JSON.stringify({ authToken: 'switched-token' }),
                })
                .mockImplementationOnce((_url: string, options?: RequestInit) =>
                    new Promise((_resolve, reject) => {
                        notifySecondFetchStarted?.();
                        const signal = options?.signal as AbortSignal | undefined;
                        if (!signal) {
                            return;
                        }
                        signal.addEventListener('abort', () => {
                            reject(new DOMException('Aborted', 'AbortError'));
                        }, { once: true });
                    })
                );
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            const request = auth.switchHomeUser('2', { signal: controller.signal });
            await secondFetchStarted;
            controller.abort();

            await expect(request).rejects.toMatchObject({ name: 'AbortError' });
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('should throw not-supported when both home switch endpoints return 404', async () => {
            const auth = new PlexAuth(mockConfig);
            const testToken = createAuthToken('account-token', 'admin');
            auth.storeCredentials(createAuthData(testToken));

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
            auth.storeCredentials(createAuthData(testToken));

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
            auth.storeCredentials(createAuthData(testToken));

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
