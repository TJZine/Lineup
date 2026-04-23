/**
 * @fileoverview Unit tests for Plex Server Discovery module.
 * @module modules/plex/discovery/__tests__/PlexServerDiscovery.test
 */

import { PlexServerDiscovery } from '../PlexServerDiscovery';
import { PLEX_DISCOVERY_CONSTANTS } from '../constants';
import { expectConsoleError, expectConsoleWarn } from '../../../../__tests__/helpers';
import { mockLocalStorage, installMockLocalStorage } from '../../../../__tests__/mocks/localStorage';
import {
    createMockConnection,
    createMockFetchResponse,
    createMockServer,
    expectDefined,
    mockConfig,
    mockFetchFailure,
    mockFetchJson,
} from './discoveryTestUtils';

// Install mock localStorage
installMockLocalStorage();

describe('PlexServerDiscovery', () => {
    beforeEach(() => {
        mockLocalStorage.clear();
        jest.clearAllMocks();
        jest.useRealTimers();
        (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn();
    });

    describe('discoverServers', () => {
        it('should fetch servers from plex.tv API', async () => {
            const mockServers = [
                {
                    clientIdentifier: 'srv1',
                    name: 'Test Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'https://test:32400',
                            protocol: 'https',
                            address: 'test',
                            port: 32400,
                            local: false,
                            relay: false,
                        },
                    ],
                },
            ];
            mockFetchJson(mockServers);
            const discovery = new PlexServerDiscovery(mockConfig);

            const result = await discovery.discoverServers();

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/resources'),
                expect.objectContaining({
                    method: 'GET',
                    headers: expect.objectContaining({ 'X-Plex-Token': 'mock-token' }),
                })
            );
            expect(result).toHaveLength(1);
            expect(expectDefined(result[0], 'Expected discovered server')).toMatchObject({ id: 'srv1' });
        });

        it('should only append token query params for trusted Plex cloud discovery origins', async () => {
            const fetchMock = jest.fn()
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    headers: { get: () => null },
                    json: async () => [],
                    text: async () => '[]',
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: { get: () => null },
                    json: async () => [],
                    text: async () => '[]',
                });
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            const discovery = new PlexServerDiscovery(mockConfig);

            await discovery.discoverServers();

            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(String(fetchMock.mock.calls[0]?.[0])).toContain('https://plex.tv/api/v2/resources');
            expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('X-Plex-Token=');
            expect(String(fetchMock.mock.calls[1]?.[0])).toContain('https://plex.tv/api/v2/resources');
            expect(String(fetchMock.mock.calls[1]?.[0])).toContain('X-Plex-Token=mock-token');
        });

        it('preserves Plex headers on tokenized discovery variants', async () => {
            const fetchMock = jest.fn()
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    headers: { get: () => null },
                    json: async () => [],
                    text: async () => '[]',
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: { get: () => null },
                    json: async () => [],
                    text: async () => '[]',
                });
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            const discovery = new PlexServerDiscovery(mockConfig);
            await discovery.discoverServers();

            expect(fetchMock).toHaveBeenCalledTimes(2);

            for (const [, init] of fetchMock.mock.calls as Array<[string, RequestInit]>) {
                expect(init).toEqual(
                    expect.objectContaining({
                        method: 'GET',
                        headers: expect.objectContaining({
                            Accept: 'application/json',
                            'X-Plex-Token': 'mock-token',
                            'X-Plex-Client-Identifier': 'mock-client-id',
                        }),
                    })
                );
            }
        });

        it('should parse server connections correctly', async () => {
            const mockServers = [
                {
                    clientIdentifier: 'srv1',
                    name: 'Test Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'http://test:32400',
                            protocol: 'http',
                            address: 'test',
                            port: 32400,
                            local: true,
                            relay: false,
                        },
                    ],
                },
            ];
            mockFetchJson(mockServers);
            const discovery = new PlexServerDiscovery(mockConfig);

            const result = await discovery.discoverServers();

            const server = expectDefined(result[0], 'Expected parsed server');
            const connection = expectDefined(server.connections[0], 'Expected parsed connection');
            expect(connection.uri).toBe('http://test:32400');
            expect(connection.local).toBe(true);
        });

        it('should handle empty server list', async () => {
            mockFetchJson([]);
            const discovery = new PlexServerDiscovery(mockConfig);

            const result = await discovery.discoverServers();

            expect(result).toEqual([]);
        });

        it('should handle network errors gracefully', async () => {
            expectConsoleError('Server error: 500');
            jest.useFakeTimers();
            try {
                mockFetchJson({ error: 'Server Error' }, 500);
                const discovery = new PlexServerDiscovery(mockConfig);
                const promise = discovery.discoverServers();
                const rejection = expect(promise).rejects.toThrow();

                await jest.advanceTimersByTimeAsync(PLEX_DISCOVERY_CONSTANTS.DISCOVERY_RETRY_BACKOFF_MS);

                await rejection;
            } finally {
                jest.useRealTimers();
            }
        });

        it('should filter for server capability only', async () => {
            const mockResources = [
                {
                    clientIdentifier: 'srv1',
                    name: 'Server',
                    provides: 'server',
                    connections: [],
                    sourceTitle: 'user',
                    ownerId: 'owner',
                    owned: true,
                },
                {
                    clientIdentifier: 'player1',
                    name: 'Player',
                    provides: 'player',
                    connections: [],
                    sourceTitle: 'user',
                    ownerId: 'owner',
                    owned: true,
                },
            ];
            mockFetchJson(mockResources);
            const discovery = new PlexServerDiscovery(mockConfig);

            const result = await discovery.discoverServers();

            expect(result).toHaveLength(1);
            expect(expectDefined(result[0], 'Expected server resource')).toMatchObject({ id: 'srv1' });
        });

        it('should return same promise for concurrent discovery calls', async () => {
            const mockServers = [
                {
                    clientIdentifier: 'srv1',
                    name: 'Test Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [],
                },
            ];
            mockFetchJson(mockServers);
            const discovery = new PlexServerDiscovery(mockConfig);

            // Start two discoveries concurrently
            const promise1 = discovery.discoverServers();
            const promise2 = discovery.discoverServers();

            // Should be the exact same promise
            expect(promise1).toBe(promise2);

            const result1 = await promise1;
            const result2 = await promise2;

            // Results should be identical
            expect(result1).toBe(result2);
            // Should only have made one fetch call
            expect(fetch).toHaveBeenCalledTimes(1);
        });

        it('should ignore stale in-flight discovery results after storage key switch', async () => {
            const firstResources = [
                {
                    clientIdentifier: 'srv-stale',
                    name: 'Stale Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'https://stale:32400',
                            protocol: 'https',
                            address: 'stale',
                            port: 32400,
                            local: false,
                            relay: false,
                        },
                    ],
                },
            ];
            const secondResources = [
                {
                    clientIdentifier: 'srv-fresh',
                    name: 'Fresh Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'https://fresh:32400',
                            protocol: 'https',
                            address: 'fresh',
                            port: 32400,
                            local: false,
                            relay: false,
                        },
                    ],
                },
            ];

            const pendingFirstFetch: { resolve?: (value: unknown) => void } = {};
            const firstFetchPromise = new Promise((resolve) => {
                pendingFirstFetch.resolve = resolve;
            });

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn()
                .mockImplementationOnce(() => firstFetchPromise)
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: { get: () => null },
                    json: async () => secondResources,
                    text: async () => JSON.stringify(secondResources),
                });

            const discovery = new PlexServerDiscovery(mockConfig);

            const staleDiscovery = discovery.discoverServers();
            discovery.setStorageKeys('lineup_selected_server_alt', 'lineup_server_health_alt');
            const freshDiscovery = discovery.discoverServers();

            const freshResult = await freshDiscovery;
            expect(expectDefined(freshResult[0], 'Expected fresh discovery result')).toMatchObject({
                id: 'srv-fresh',
            });

            expectDefined(pendingFirstFetch.resolve, 'Expected first discovery fetch resolver')(
                createMockFetchResponse(firstResources)
            );

            const staleResult = await staleDiscovery;
            expect(expectDefined(staleResult[0], 'Expected stale discovery to preserve fresh cache')).toMatchObject({
                id: 'srv-fresh',
            });
            expect(expectDefined(discovery.getServers()[0], 'Expected cached server after stale completion')).toMatchObject({
                id: 'srv-fresh',
            });
            expect(fetch).toHaveBeenCalledTimes(2);
        });

        it('classifies malformed discovery payloads as PARSE_ERROR without retrying', async () => {
            expectConsoleError('Failed to parse server discovery response');
            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: { get: () => 'text/plain' },
                json: async () => {
                    throw new SyntaxError('Unexpected token');
                },
                text: async () => 'not-a-json-or-xml-payload',
            });

            const discovery = new PlexServerDiscovery(mockConfig);
            await expect(discovery.discoverServers()).rejects.toMatchObject({
                code: 'PARSE_ERROR',
            });
            expect(fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('testConnection', () => {
        it('should return latency for working connection', async () => {
            mockFetchJson({ machineIdentifier: 'test' });
            const discovery = new PlexServerDiscovery(mockConfig);
            const mockServer = createMockServer();
            const mockConnection = createMockConnection();

            const lat = await discovery.testConnection(mockServer, mockConnection);

            expect(typeof lat).toBe('number');
            expect(lat).toBeGreaterThanOrEqual(0);
        });

        it('should return null for failed connection', async () => {
            mockFetchJson({ error: 'failed' }, 502);
            const discovery = new PlexServerDiscovery(mockConfig);
            const mockServer = createMockServer();
            const mockConnection = createMockConnection();

            const lat = await discovery.testConnection(mockServer, mockConnection);

            expect(lat).toBeNull();
        });

        it('should classify 401 as auth_required', async () => {
            mockFetchJson({ error: 'unauthorized' }, 401);
            const discovery = new PlexServerDiscovery(mockConfig);
            const mockServer = createMockServer();
            const mockConnection = createMockConnection();

            const result = await discovery.testConnection(mockServer, mockConnection);

            expect(result).toBe('auth_required');
        });

        it('should classify 403 as auth_invalid', async () => {
            mockFetchJson({ error: 'forbidden' }, 403);
            const discovery = new PlexServerDiscovery(mockConfig);
            const mockServer = createMockServer();
            const mockConnection = createMockConnection();

            const result = await discovery.testConnection(mockServer, mockConnection);

            expect(result).toBe('auth_invalid');
        });

        it('should timeout after the configured timeout', async () => {
            jest.useFakeTimers();
            try {
                // Mock fetch that never resolves until aborted
                (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockImplementation((_url: string, options: RequestInit) => {
                    return new Promise((_resolve, reject) => {
                        if (options.signal) {
                            options.signal.addEventListener('abort', () => {
                                reject(new DOMException('The operation was aborted', 'AbortError'));
                            });
                        }
                    });
                });

                const discovery = new PlexServerDiscovery(mockConfig);
                const mockServer = createMockServer();
                const mockConnection = createMockConnection();

                const promise = discovery.testConnection(mockServer, mockConnection);

                // Advance timers past the configured timeout
                await jest.advanceTimersByTimeAsync(PLEX_DISCOVERY_CONSTANTS.CONNECTION_TEST_TIMEOUT_MS + 100);

                const lat = await promise;

                // AbortController should have aborted the request
                expect(lat).toBeNull();
            } finally {
                jest.useRealTimers();
            }
        });

        it('should call identity endpoint', async () => {
            mockFetchJson({ machineIdentifier: 'test' });
            const discovery = new PlexServerDiscovery(mockConfig);
            const mockServer = createMockServer();
            const mockConnection = createMockConnection({ uri: 'https://myserver:32400' });

            await discovery.testConnection(mockServer, mockConnection);

            expect(fetch).toHaveBeenCalledWith(
                'https://myserver:32400/identity',
                expect.any(Object)
            );
        });
    });

    describe('findFastestConnection', () => {
        it('should prefer local over remote connections', async () => {
            const fetchMock = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ machineIdentifier: 'test' }),
            });
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            const discovery = new PlexServerDiscovery(mockConfig);
            const mockServer = createMockServer({
                connections: [
                    createMockConnection({ uri: 'https://remote:32400', local: false }),
                    createMockConnection({ uri: 'https://local:32400', local: true }),
                ],
            });

            const result = await discovery.findFastestConnection(mockServer);

            expect(expectDefined(result.connection, 'Expected local connection')).toMatchObject({
                uri: 'https://local:32400',
            });
        });

        it('should prefer remote over relay connections', async () => {
            const fetchMock = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ machineIdentifier: 'test' }),
            });
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            const discovery = new PlexServerDiscovery(mockConfig);
            const mockServer = createMockServer({
                connections: [
                    createMockConnection({ uri: 'https://relay:32400', relay: true, local: false }),
                    createMockConnection({ uri: 'https://remote:32400', relay: false, local: false }),
                ],
            });

            const result = await discovery.findFastestConnection(mockServer);

            expect(expectDefined(result.connection, 'Expected remote connection')).toMatchObject({
                uri: 'https://remote:32400',
            });
        });

        it('should fall back to relay when others fail', async () => {
            const fetchMock = jest.fn().mockImplementation((url: string) => {
                if (url.includes('local')) {
                    return Promise.reject(new Error('Connection failed'));
                }
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ machineIdentifier: 'test' }),
                });
            });
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            const discovery = new PlexServerDiscovery(mockConfig);
            const mockServer = createMockServer({
                connections: [
                    createMockConnection({ uri: 'https://local:32400', local: true, relay: false }),
                    createMockConnection({ uri: 'https://relay:32400', local: false, relay: true }),
                ],
            });

            const result = await discovery.findFastestConnection(mockServer);

            expect(expectDefined(result.connection, 'Expected relay connection')).toMatchObject({
                uri: 'https://relay:32400',
            });
        });

        it('should return null when all connections fail', async () => {
            expectConsoleWarn([
                'No working connections found',
                expect.objectContaining({
                    serverId: 'srv1',
                    authRequired: false,
                    httpsCount: 2,
                    httpCount: 0,
                }),
            ]);
            mockFetchFailure(new Error('Connection failed'));
            const discovery = new PlexServerDiscovery(mockConfig);
            const mockServer = createMockServer({
                connections: [
                    createMockConnection({ uri: 'https://a:32400' }),
                    createMockConnection({ uri: 'https://b:32400' }),
                ],
            });

            const result = await discovery.findFastestConnection(mockServer);

            expect(result.connection).toBeNull();
        });

        it('tracks auth_invalid as the most severe auth state when probes mix 401 and 403', async () => {
            expectConsoleWarn([
                'No working connections found',
                expect.objectContaining({
                    serverId: 'srv1',
                    authRequired: true,
                    httpsCount: 2,
                    httpCount: 0,
                }),
            ]);
            const discovery = new PlexServerDiscovery(mockConfig);
            const mockServer = createMockServer({
                connections: [
                    createMockConnection({ uri: 'https://one:32400', local: true, relay: false }),
                    createMockConnection({ uri: 'https://two:32400', local: false, relay: false }),
                ],
            });
            jest.spyOn(discovery, 'testConnection')
                .mockResolvedValueOnce('auth_required')
                .mockResolvedValueOnce('auth_invalid');

            const result = await discovery.findFastestConnection(mockServer);

            expect(result.connection).toBeNull();
            expect(result.authRequired).toBe(true);
            expect(result.authState).toBe('auth_invalid');
        });

        it('keeps authRequired false when probes only return auth_invalid', async () => {
            expectConsoleWarn([
                'No working connections found',
                expect.objectContaining({
                    serverId: 'srv1',
                    authRequired: false,
                    httpsCount: 2,
                    httpCount: 0,
                }),
            ]);
            const discovery = new PlexServerDiscovery(mockConfig);
            const mockServer = createMockServer({
                connections: [
                    createMockConnection({ uri: 'https://one:32400', local: true, relay: false }),
                    createMockConnection({ uri: 'https://two:32400', local: false, relay: false }),
                ],
            });

            jest.spyOn(discovery, 'testConnection')
                .mockResolvedValueOnce('auth_invalid')
                .mockResolvedValueOnce('auth_invalid');

            const result = await discovery.findFastestConnection(mockServer);

            expect(result.connection).toBeNull();
            expect(result.authRequired).toBe(false);
            expect(result.authState).toBe('auth_invalid');
        });

        it('keeps authRequired false when local HTTP fallback succeeds after an auth_invalid HTTPS-upgrade probe', async () => {
            expectConsoleWarn([
                'Selected HTTP connection (last resort)',
                expect.objectContaining({
                    local: true,
                    relay: false,
                }),
            ]);
            const discovery = new PlexServerDiscovery(mockConfig);
            const localHttpConnection = createMockConnection({
                uri: 'http://local-http:32400',
                protocol: 'http',
                local: true,
                relay: false,
            });
            const mockServer = createMockServer({
                connections: [localHttpConnection],
            });

            const testConnectionSpy = jest.spyOn(discovery, 'testConnection')
                .mockResolvedValueOnce('auth_invalid')
                .mockResolvedValueOnce(42);

            const result = await discovery.findFastestConnection(mockServer);

            expect(testConnectionSpy).toHaveBeenNthCalledWith(
                1,
                mockServer,
                expect.objectContaining({
                    uri: 'https://local-http:32400',
                    protocol: 'https',
                    local: true,
                    relay: false,
                })
            );
            expect(testConnectionSpy).toHaveBeenNthCalledWith(2, mockServer, localHttpConnection);
            expect(result.connection).toEqual(
                expect.objectContaining({
                    uri: 'http://local-http:32400',
                    protocol: 'http',
                    local: true,
                    relay: false,
                    latencyMs: 42,
                })
            );
            expect(result.authRequired).toBe(false);
            expect(result.authState).toBe('auth_invalid');
        });

        it('warns once when no working connections are found', async () => {
            expectConsoleWarn([
                'No working connections found',
                expect.objectContaining({
                    serverId: 'srv1',
                    authRequired: false,
                    httpsCount: 1,
                    httpCount: 1,
                }),
            ]);
            mockFetchFailure(new Error('Connection failed'));
            const discovery = new PlexServerDiscovery(mockConfig);
            const mockServer = createMockServer({
                connections: [
                    createMockConnection({ uri: 'https://a:32400', protocol: 'https' }),
                    createMockConnection({ uri: 'http://b:32400', protocol: 'http' }),
                ],
            });

            const result = await discovery.findFastestConnection(mockServer);

            expect(result.connection).toBeNull();
        });

        it('warns when HTTP is selected as last resort', async () => {
            expectConsoleWarn([
                'Selected HTTP connection (last resort)',
                expect.objectContaining({
                    local: true,
                    relay: false,
                }),
            ]);
            const fetchMock = jest.fn().mockImplementation((url: string) => {
                if (url.startsWith('https://')) {
                    return Promise.reject(new Error('HTTPS failed'));
                }
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ machineIdentifier: 'test' }),
                });
            });
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            const discovery = new PlexServerDiscovery(mockConfig);
            const mockServer = createMockServer({
                connections: [
                    createMockConnection({
                        uri: 'http://local-http:32400',
                        protocol: 'http',
                        local: true,
                        relay: false,
                    }),
                ],
            });

            const result = await discovery.findFastestConnection(mockServer);

            expect(expectDefined(result.connection, 'Expected HTTP fallback connection')).toMatchObject({
                protocol: 'http',
            });
        });
    });

    describe('selectServer', () => {
        it('should persist selection to localStorage', async () => {
            // First, mock discoverServers
            const mockServers = [
                {
                    clientIdentifier: 'srv1',
                    name: 'Test Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'https://test:32400',
                            protocol: 'https',
                            address: 'test',
                            port: 32400,
                            local: true,
                            relay: false,
                        },
                    ],
                },
            ];

            const fetchMock = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockServers,
            });
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            const discovery = new PlexServerDiscovery(mockConfig);
            await discovery.discoverServers();

            // Now mock connection test
            fetchMock.mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ machineIdentifier: 'srv1' }),
            });

            await discovery.selectServer('srv1');

            expect(mockLocalStorage.getItem(PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY)).toBe('srv1');
        });

        it('persists server health record after successful selection', async () => {
            const mockServers = [
                {
                    clientIdentifier: 'srv1',
                    name: 'Test Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'https://test:32400',
                            protocol: 'https',
                            address: 'test',
                            port: 32400,
                            local: true,
                            relay: false,
                        },
                    ],
                },
            ];

            const fetchMock = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockServers,
                headers: { get: () => null },
                text: async () => JSON.stringify(mockServers),
            });
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            const discovery = new PlexServerDiscovery(mockConfig);
            await discovery.discoverServers();

            fetchMock.mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ machineIdentifier: 'srv1' }),
                headers: { get: () => null },
                text: async () => JSON.stringify({ machineIdentifier: 'srv1' }),
            });

            await discovery.selectServer('srv1');

            const rawHealth = mockLocalStorage.getItem(PLEX_DISCOVERY_CONSTANTS.SERVER_HEALTH_KEY);
            expect(rawHealth).toBeTruthy();
            const parsed = rawHealth ? JSON.parse(rawHealth) : {};
            expect(parsed['srv1']).toEqual(
                expect.objectContaining({
                    status: 'ok',
                    type: 'local',
                })
            );
        });

        it('should emit serverChange event', async () => {
            const mockServers = [
                {
                    clientIdentifier: 'srv1',
                    name: 'Test Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'https://test:32400',
                            protocol: 'https',
                            address: 'test',
                            port: 32400,
                            local: true,
                            relay: false,
                        },
                    ],
                },
            ];

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockServers,
            });

            const discovery = new PlexServerDiscovery(mockConfig);
            await discovery.discoverServers();

            // Now mock connection test
            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ machineIdentifier: 'srv1' }),
            });

            const handler = jest.fn();
            discovery.on('serverChange', handler);

            await discovery.selectServer('srv1');

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: 'srv1' }));
        });

        it('should emit connectionChange event', async () => {
            const mockServers = [
                {
                    clientIdentifier: 'srv1',
                    name: 'Test Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'https://test:32400',
                            protocol: 'https',
                            address: 'test',
                            port: 32400,
                            local: true,
                            relay: false,
                        },
                    ],
                },
            ];

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockServers,
            });

            const discovery = new PlexServerDiscovery(mockConfig);
            await discovery.discoverServers();

            // Now mock connection test
            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ machineIdentifier: 'srv1' }),
            });

            const handler = jest.fn();
            discovery.on('connectionChange', handler);

            await discovery.selectServer('srv1');

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(expect.any(String));
        });

        it('returns server_not_found for unknown server ID', async () => {
            mockFetchJson([]);
            const discovery = new PlexServerDiscovery(mockConfig);
            await discovery.discoverServers();

            const result = await discovery.selectServer('unknown');

            expect(result).toEqual({ kind: 'server_not_found' });
        });

        it('preserves the previous successful selection when a later switch attempt fails', async () => {
            const discovery = new PlexServerDiscovery(mockConfig);

            mockFetchJson([
                {
                    clientIdentifier: 'srv1',
                    name: 'Server One',
                    sourceTitle: 'user',
                    ownerId: 'owner',
                    owned: true,
                    provides: 'server',
                    connections: [createMockConnection({ uri: 'https://srv1:32400', address: 'srv1' })],
                },
                {
                    clientIdentifier: 'srv2',
                    name: 'Server Two',
                    sourceTitle: 'user',
                    ownerId: 'owner',
                    owned: true,
                    provides: 'server',
                    connections: [createMockConnection({ uri: 'https://srv2:32400', address: 'srv2' })],
                },
            ]);

            await discovery.discoverServers();

            const connectionSpy = jest.spyOn(discovery, 'findFastestConnection');
            connectionSpy.mockImplementation(async (server) => {
                if (server.id === 'srv1') {
                    return {
                        connection: createMockConnection({ uri: 'https://srv1:32400', address: 'srv1' }),
                        authRequired: false,
                        authState: null,
                    };
                }

                return {
                    connection: null,
                    authRequired: false,
                    authState: null,
                };
            });

            await expect(discovery.selectServer('srv1')).resolves.toEqual({ kind: 'selected' });
            await expect(discovery.selectServer('srv2')).resolves.toEqual({
                kind: 'connection_unavailable',
                reason: 'unreachable',
            });

            expect(discovery.getSelectedServer()?.id).toBe('srv1');
            expect(discovery.getServerUri()).toBe('https://srv1:32400');
            expect(mockLocalStorage.getItem(PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY)).toBe('srv1');
        });
    });

    describe('initialization', () => {
        it('should restore selected server from localStorage', async () => {
            mockLocalStorage.setItem(PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY, 'srv1');

            const mockServers = [
                {
                    clientIdentifier: 'srv1',
                    name: 'Test Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'https://test:32400',
                            protocol: 'https',
                            address: 'test',
                            port: 32400,
                            local: true,
                            relay: false,
                        },
                    ],
                },
            ];

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockServers,
            });

            const discovery = new PlexServerDiscovery(mockConfig);
            await discovery.initialize();

            expect(expectDefined(discovery.getSelectedServer(), 'Expected restored selected server')).toMatchObject({
                id: 'srv1',
            });
        });

        it('does not revert to a stale pending server id on subsequent initialize after selecting a new server', async () => {
            mockLocalStorage.setItem(PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY, 'srvA');

            const mockServers = [
                {
                    clientIdentifier: 'srvA',
                    name: 'A',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'https://a:32400',
                            protocol: 'https',
                            address: 'a',
                            port: 32400,
                            local: true,
                            relay: false,
                        },
                    ],
                },
                {
                    clientIdentifier: 'srvB',
                    name: 'B',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'https://b:32400',
                            protocol: 'https',
                            address: 'b',
                            port: 32400,
                            local: true,
                            relay: false,
                        },
                    ],
                },
            ];

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: { get: () => null },
                json: async () => mockServers,
                text: async () => JSON.stringify(mockServers),
            });

            const discovery = new PlexServerDiscovery(mockConfig);
            const fastestSpy = jest.spyOn(discovery, 'findFastestConnection').mockImplementation(async (server) => ({
                connection: {
                    ...server.connections[0]!,
                    latencyMs: 1,
                },
                authRequired: false,
                authState: null,
            }));

            const connectionChanges: Array<string | null> = [];
            discovery.on('connectionChange', (uri) => {
                connectionChanges.push(uri);
            });

            await discovery.initialize();
            expect(discovery.getSelectedServer()?.id).toBe('srvA');

            await discovery.selectServer('srvB');
            expect(discovery.getSelectedServer()?.id).toBe('srvB');
            expect(mockLocalStorage.getItem(PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY)).toBe('srvB');

            await discovery.initialize();

            expect(discovery.getSelectedServer()?.id).toBe('srvB');
            expect(mockLocalStorage.getItem(PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY)).toBe('srvB');
            expect(fastestSpy).toHaveBeenCalledTimes(2);
            expect(connectionChanges).toHaveLength(2);
        });

        it('should re-test connection on restore', async () => {
            mockLocalStorage.setItem(PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY, 'srv1');

            const mockServers = [
                {
                    clientIdentifier: 'srv1',
                    name: 'Test Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'https://test:32400',
                            protocol: 'https',
                            address: 'test',
                            port: 32400,
                            local: true,
                            relay: false,
                        },
                    ],
                },
            ];

            const fetchMock = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockServers,
            });
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            const discovery = new PlexServerDiscovery(mockConfig);
            const testSpy = jest.spyOn(discovery, 'testConnection');

            await discovery.initialize();

            expect(testSpy).toHaveBeenCalled();
        });

        it('re-tests the saved server after discovery cache expiry so the selected connection can change', async () => {
            mockLocalStorage.setItem(PLEX_DISCOVERY_CONSTANTS.SELECTED_SERVER_KEY, 'srv1');

            const initialServers = [
                {
                    clientIdentifier: 'srv1',
                    name: 'Test Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'https://old-host:32400',
                            protocol: 'https',
                            address: 'old-host',
                            port: 32400,
                            local: true,
                            relay: false,
                        },
                    ],
                },
            ];
            const refreshedServers = [
                {
                    clientIdentifier: 'srv1',
                    name: 'Test Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'https://new-host:32400',
                            protocol: 'https',
                            address: 'new-host',
                            port: 32400,
                            local: true,
                            relay: false,
                        },
                    ],
                },
            ];

            const fetchMock = jest
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: { get: () => null },
                    json: async () => initialServers,
                    text: async () => JSON.stringify(initialServers),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    headers: { get: () => null },
                    json: async () => refreshedServers,
                    text: async () => JSON.stringify(refreshedServers),
                });
            (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

            const discovery = new PlexServerDiscovery(mockConfig);
            const fastestSpy = jest.spyOn(discovery, 'findFastestConnection').mockImplementation(async (server) => ({
                connection: {
                    ...server.connections[0]!,
                    latencyMs: 1,
                },
                authRequired: false,
                authState: null,
            }));
            const nowSpy = jest.spyOn(Date, 'now');
            let nowMs = 0;
            nowSpy.mockImplementation(() => nowMs);

            try {
                await discovery.initialize();
                expect(discovery.getServerUri()).toBe('https://old-host:32400');

                nowMs = PLEX_DISCOVERY_CONSTANTS.SERVER_CACHE_DURATION_MS + 1;
                await discovery.initialize();

                expect(discovery.getServerUri()).toBe('https://new-host:32400');
                expect(fastestSpy).toHaveBeenCalledTimes(2);
            } finally {
                nowSpy.mockRestore();
            }
        });

        it('persists auth_invalid when connection probes fail with forbidden state', async () => {
            const mockServers = [
                {
                    clientIdentifier: 'srv1',
                    name: 'Test Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [createMockConnection()],
                },
            ];

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: { get: () => null },
                json: async () => mockServers,
                text: async () => JSON.stringify(mockServers),
            });

            const discovery = new PlexServerDiscovery(mockConfig);
            await discovery.discoverServers();
            jest.spyOn(discovery, 'findFastestConnection').mockResolvedValue({
                connection: null,
                authRequired: false,
                authState: 'auth_invalid',
            });

            const selected = await discovery.selectServer('srv1');

            expect(selected).toEqual({
                kind: 'connection_unavailable',
                reason: 'auth_invalid',
            });
            const rawHealth = mockLocalStorage.getItem(PLEX_DISCOVERY_CONSTANTS.SERVER_HEALTH_KEY);
            expect(rawHealth).toBeTruthy();
            const parsed = rawHealth ? JSON.parse(rawHealth) : {};
            expect(parsed['srv1']).toEqual(
                expect.objectContaining({
                    status: 'auth_invalid',
                })
            );
        });
    });

    describe('state methods', () => {
        it('isConnected returns false when no server selected', () => {
            const discovery = new PlexServerDiscovery(mockConfig);

            expect(discovery.isConnected()).toBe(false);
        });

        it('isConnected returns true when server is selected', async () => {
            const mockServers = [
                {
                    clientIdentifier: 'srv1',
                    name: 'Test Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'https://test:32400',
                            protocol: 'https',
                            address: 'test',
                            port: 32400,
                            local: true,
                            relay: false,
                        },
                    ],
                },
            ];

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockServers,
            });

            const discovery = new PlexServerDiscovery(mockConfig);
            await discovery.discoverServers();

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ machineIdentifier: 'srv1' }),
            });

            await discovery.selectServer('srv1');

            expect(discovery.isConnected()).toBe(true);
        });

        it('getServerUri returns null when no connection', () => {
            const discovery = new PlexServerDiscovery(mockConfig);

            expect(discovery.getServerUri()).toBeNull();
        });

        it('getServerUri returns URI when connected', async () => {
            const mockServers = [
                {
                    clientIdentifier: 'srv1',
                    name: 'Test Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'https://test:32400',
                            protocol: 'https',
                            address: 'test',
                            port: 32400,
                            local: true,
                            relay: false,
                        },
                    ],
                },
            ];

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockServers,
            });

            const discovery = new PlexServerDiscovery(mockConfig);
            await discovery.discoverServers();

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ machineIdentifier: 'srv1' }),
            });

            await discovery.selectServer('srv1');

            expect(discovery.getServerUri()).toBe('https://test:32400');
        });
    });

    describe('mixed content fallback', () => {
        it('getHttpsConnection returns HTTPS connection when available', async () => {
            const mockServers = [
                {
                    clientIdentifier: 'srv1',
                    name: 'Test Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'http://local:32400',
                            protocol: 'http',
                            address: 'local',
                            port: 32400,
                            local: true,
                            relay: false,
                        },
                        {
                            uri: 'https://secure:32400',
                            protocol: 'https',
                            address: 'secure',
                            port: 32400,
                            local: false,
                            relay: false,
                        },
                    ],
                },
            ];

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockServers,
            });

            const discovery = new PlexServerDiscovery(mockConfig);
            await discovery.discoverServers();

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ machineIdentifier: 'srv1' }),
            });

            await discovery.selectServer('srv1');

            const httpsConn = discovery.getHttpsConnection();
            expect(expectDefined(httpsConn, 'Expected HTTPS connection')).toMatchObject({
                protocol: 'https',
            });
        });

        it('getRelayConnection returns relay connection when available', async () => {
            const mockServers = [
                {
                    clientIdentifier: 'srv1',
                    name: 'Test Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'https://local:32400',
                            protocol: 'https',
                            address: 'local',
                            port: 32400,
                            local: true,
                            relay: false,
                        },
                        {
                            uri: 'https://relay.plex.direct:32400',
                            protocol: 'https',
                            address: 'relay.plex.direct',
                            port: 32400,
                            local: false,
                            relay: true,
                        },
                    ],
                },
            ];

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockServers,
            });

            const discovery = new PlexServerDiscovery(mockConfig);
            await discovery.discoverServers();

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ machineIdentifier: 'srv1' }),
            });

            await discovery.selectServer('srv1');

            const relayConn = discovery.getRelayConnection();
            expect(expectDefined(relayConn, 'Expected relay connection')).toMatchObject({
                relay: true,
            });
        });

        it('getActiveConnectionUri is alias for getServerUri', async () => {
            const mockServers = [
                {
                    clientIdentifier: 'srv1',
                    name: 'Test Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'https://test:32400',
                            protocol: 'https',
                            address: 'test',
                            port: 32400,
                            local: true,
                            relay: false,
                        },
                    ],
                },
            ];

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => mockServers,
            });

            const discovery = new PlexServerDiscovery(mockConfig);
            await discovery.discoverServers();

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ machineIdentifier: 'srv1' }),
            });

            await discovery.selectServer('srv1');

            expect(discovery.getActiveConnectionUri()).toBe(discovery.getServerUri());
        });
    });

    // ============================================
    // DISC-001: URI Sanitization Tests
    // ============================================

    describe('connection URI sanitization', () => {
        it('should reject file:// URIs', async () => {
            expectConsoleWarn([
                'Skipping invalid Plex connection URI:',
                'file:///etc/passwd',
            ]);
            const mockServers = [
                {
                    clientIdentifier: 'srv1',
                    name: 'Test Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'file:///etc/passwd',
                            protocol: 'file',
                            address: 'localhost',
                            port: 0,
                            local: true,
                            relay: false,
                        },
                        {
                            uri: 'https://valid:32400',
                            protocol: 'https',
                            address: 'valid',
                            port: 32400,
                            local: true,
                            relay: false,
                        },
                    ],
                },
            ];
            mockFetchJson(mockServers);
            const discovery = new PlexServerDiscovery(mockConfig);

            const result = await discovery.discoverServers();

            // file:// connection should be filtered out
            const server = expectDefined(result[0], 'Expected server to be defined');
            expect(server.connections).toHaveLength(1);
            expect(server.connections[0]?.uri).toBe('https://valid:32400');
        });

        it('should reject URIs with embedded credentials', async () => {
            expectConsoleWarn([
                'Skipping invalid Plex connection URI:',
                'https://server:32400/',
            ]);
                const mockServers = [
                    {
                        clientIdentifier: 'srv1',
                        name: 'Test Server',
                        sourceTitle: 'testuser',
                        ownerId: 'owner1',
                        owned: true,
                        provides: 'server',
                        connections: [
                            {
                                uri: 'https://user:pass@server:32400',
                                protocol: 'https',
                                address: 'server',
                                port: 32400,
                                local: false,
                                relay: false,
                            },
                            {
                                uri: 'https://clean:32400',
                                protocol: 'https',
                                address: 'clean',
                                port: 32400,
                                local: true,
                                relay: false,
                            },
                        ],
                    },
                ];
                mockFetchJson(mockServers);
                const discovery = new PlexServerDiscovery(mockConfig);

                const result = await discovery.discoverServers();

                // Credentialed URI should be filtered out
                const server = expectDefined(result[0], 'Expected server to be defined');
                expect(server.connections).toHaveLength(1);
                expect(server.connections[0]?.uri).toBe('https://clean:32400');
        });

        it('redacts sensitive fragments when logging invalid credentialed connection URIs', async () => {
            expectConsoleWarn([
                'Skipping invalid Plex connection URI:',
                'https://server:32400/#REDACTED_FRAGMENT',
            ]);
                const mockServers = [
                    {
                        clientIdentifier: 'srv1',
                        name: 'Test Server',
                        sourceTitle: 'testuser',
                        ownerId: 'owner1',
                        owned: true,
                        provides: 'server',
                        connections: [
                            {
                                uri: 'https://user:pass@server:32400/#token=secret',
                                protocol: 'https',
                                address: 'server',
                                port: 32400,
                                local: false,
                                relay: false,
                            },
                            {
                                uri: 'https://clean:32400',
                                protocol: 'https',
                                address: 'clean',
                                port: 32400,
                                local: false,
                                relay: false,
                            },
                        ],
                    },
                ];
                mockFetchJson(mockServers);
                const discovery = new PlexServerDiscovery(mockConfig);

                const result = await discovery.discoverServers();

                const server = expectDefined(result[0], 'Expected server to be defined');
                expect(server.connections).toHaveLength(1);
                expect(server.connections[0]?.uri).toBe('https://clean:32400');
        });

        it('should reject non-standard protocol schemes', async () => {
            expectConsoleWarn([
                'Skipping invalid Plex connection URI:',
                'ftp://server/',
            ]);
            expectConsoleWarn([
                'Skipping invalid Plex connection URI:',
                'javascript:alert(1)',
            ]);
                const mockServers = [
                    {
                        clientIdentifier: 'srv1',
                        name: 'Test Server',
                        sourceTitle: 'testuser',
                        ownerId: 'owner1',
                        owned: true,
                        provides: 'server',
                        connections: [
                            {
                                uri: 'ftp://server:21',
                                protocol: 'ftp',
                                address: 'server',
                                port: 21,
                                local: false,
                                relay: false,
                            },
                            {
                                uri: 'javascript:alert(1)',
                                protocol: 'javascript',
                                address: '',
                                port: 0,
                                local: false,
                                relay: false,
                            },
                            {
                                uri: 'http://valid:32400',
                                protocol: 'http',
                                address: 'valid',
                                port: 32400,
                                local: true,
                                relay: false,
                            },
                        ],
                    },
                ];
                mockFetchJson(mockServers);
                const discovery = new PlexServerDiscovery(mockConfig);

                const result = await discovery.discoverServers();

                // Only http:// connection should remain
                const server = expectDefined(result[0], 'Expected server to be defined');
                expect(server.connections).toHaveLength(1);
                expect(server.connections[0]?.protocol).toBe('http');
        });

        it('should reject data: URIs', async () => {
            expectConsoleWarn([
                'Skipping invalid Plex connection URI:',
                'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
            ]);
                const mockServers = [
                    {
                        clientIdentifier: 'srv1',
                        name: 'Test Server',
                        sourceTitle: 'testuser',
                        ownerId: 'owner1',
                        owned: true,
                        provides: 'server',
                        connections: [
                            {
                                uri: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
                                protocol: 'data',
                                address: '',
                                port: 0,
                                local: false,
                                relay: false,
                            },
                            {
                                uri: 'https://valid:32400',
                                protocol: 'https',
                                address: 'valid',
                                port: 32400,
                                local: true,
                                relay: false,
                            },
                        ],
                    },
                ];
                mockFetchJson(mockServers);
                const discovery = new PlexServerDiscovery(mockConfig);

                const result = await discovery.discoverServers();

                const server = expectDefined(result[0], 'Expected server to be defined');
                expect(server.connections).toHaveLength(1);
                expect(server.connections[0]?.uri).toBe('https://valid:32400');
        });

        it('should normalize URIs to origin (strip paths and query strings)', async () => {
            const mockServers = [
                {
                    clientIdentifier: 'srv1',
                    name: 'Test Server',
                    sourceTitle: 'testuser',
                    ownerId: 'owner1',
                    owned: true,
                    provides: 'server',
                    connections: [
                        {
                            uri: 'https://server:32400/some/path?query=value',
                            protocol: 'https',
                            address: 'server',
                            port: 32400,
                            local: false,
                            relay: false,
                        },
                    ],
                },
            ];
            mockFetchJson(mockServers);
            const discovery = new PlexServerDiscovery(mockConfig);

            const result = await discovery.discoverServers();

            // URI should be normalized to origin only
            const server = expectDefined(result[0], 'Expected server to be defined');
            expect(server.connections[0]?.uri).toBe('https://server:32400');
        });

        it('should handle malformed URIs gracefully', async () => {
            expectConsoleWarn([
                'Skipping invalid Plex connection URI:',
                'not-a-valid-uri',
            ]);
            expectConsoleWarn([
                'Skipping invalid Plex connection URI:',
                '://missing-protocol',
            ]);
                const mockServers = [
                    {
                        clientIdentifier: 'srv1',
                        name: 'Test Server',
                        sourceTitle: 'testuser',
                        ownerId: 'owner1',
                        owned: true,
                        provides: 'server',
                        connections: [
                            {
                                uri: 'not-a-valid-uri',
                                protocol: 'unknown',
                                address: '',
                                port: 0,
                                local: false,
                                relay: false,
                            },
                            {
                                uri: '://missing-protocol',
                                protocol: 'unknown',
                                address: '',
                                port: 0,
                                local: false,
                                relay: false,
                            },
                            {
                                uri: 'https://valid:32400',
                                protocol: 'https',
                                address: 'valid',
                                port: 32400,
                                local: true,
                                relay: false,
                            },
                        ],
                    },
                ];
                mockFetchJson(mockServers);
                const discovery = new PlexServerDiscovery(mockConfig);

                const result = await discovery.discoverServers();

                // Only valid URI should remain
                const server = expectDefined(result[0], 'Expected server to be defined');
                expect(server.connections).toHaveLength(1);
                expect(server.connections[0]?.uri).toBe('https://valid:32400');
        });
    });

    // ============================================
    // DISC-002: Rate Limit Backoff Tests
    // ============================================

    describe('rate limit handling', () => {
        it('should retry after 429 with Retry-After header', async () => {
            jest.useFakeTimers();
            try {
                const mockServers = [
                    {
                        clientIdentifier: 'srv1',
                        name: 'Test Server',
                        provides: 'server',
                        connections: [],
                        sourceTitle: 'user',
                        ownerId: 'owner',
                        owned: true,
                    },
                ];

                let callCount = 0;
                (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockImplementation(() => {
                    callCount++;
                    if (callCount === 1) {
                        // First call returns 429 with Retry-After: 3 seconds
                        return Promise.resolve({
                            ok: false,
                            status: 429,
                            headers: { get: (name: string) => name === 'Retry-After' ? '3' : null },
                            json: async () => ({ error: 'rate limited' }),
                        });
                    }
                    // Second call succeeds
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        headers: { get: () => null },
                        json: async () => mockServers,
                    });
                });

                const discovery = new PlexServerDiscovery(mockConfig);
                const discoverPromise = discovery.discoverServers();

                // Advance past the 3-second delay from Retry-After header
                await jest.advanceTimersByTimeAsync(3000);

                const result = await discoverPromise;

                expect(callCount).toBe(2);
                expect(result).toHaveLength(1);
            } finally {
                jest.useRealTimers();
            }
        });

        it('should use default delay when Retry-After is missing', async () => {
            jest.useFakeTimers();
            try {
                const mockServers = [
                    {
                        clientIdentifier: 'srv1',
                        name: 'Test Server',
                        provides: 'server',
                        connections: [],
                        sourceTitle: 'user',
                        ownerId: 'owner',
                        owned: true,
                    },
                ];

                let callCount = 0;
                (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockImplementation(() => {
                    callCount++;
                    if (callCount === 1) {
                        // First call returns 429 without Retry-After
                        return Promise.resolve({
                            ok: false,
                            status: 429,
                            headers: { get: () => null },
                            json: async () => ({ error: 'rate limited' }),
                        });
                    }
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        headers: { get: () => null },
                        json: async () => mockServers,
                    });
                });

                const discovery = new PlexServerDiscovery(mockConfig);
                const discoverPromise = discovery.discoverServers();

                // Advance past the 2-second default delay
                await jest.advanceTimersByTimeAsync(PLEX_DISCOVERY_CONSTANTS.RATE_LIMIT_DEFAULT_DELAY_MS);

                const result = await discoverPromise;

                expect(callCount).toBe(2);
                expect(result).toHaveLength(1);
            } finally {
                jest.useRealTimers();
            }
        });

        it('should fail after max retries on persistent 429', async () => {
            expectConsoleError('Request failed with status 429');
            jest.useFakeTimers();
            try {
                let callCount = 0;
                (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockImplementation(() => {
                    callCount++;
                    return Promise.resolve({
                        ok: false,
                        status: 429,
                        headers: { get: () => null },
                        json: async () => ({ error: 'rate limited' }),
                    });
                });

                const discovery = new PlexServerDiscovery(mockConfig);

                let caughtError: Error | null = null;
                const discoverPromise = discovery.discoverServers().catch((e: Error) => {
                    caughtError = e;
                });

                // Advance past retry delay to allow both attempts
                await jest.advanceTimersByTimeAsync(PLEX_DISCOVERY_CONSTANTS.RATE_LIMIT_DEFAULT_DELAY_MS);
                await discoverPromise;

                // Should throw after max attempts (2 attempts per code)
                expect(expectDefined(caughtError, 'Expected discovery failure')).toMatchObject({
                    message: expect.stringContaining('Request failed with status 429'),
                });
                // Verify it tried twice (maxAttempts = 2)
                expect(callCount).toBe(2);
            } finally {
                jest.useRealTimers();
            }
        });
    });
});
