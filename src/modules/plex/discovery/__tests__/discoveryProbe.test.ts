import { findFastestConnectionProbe } from '../discoveryProbe';
import { PLEX_DISCOVERY_CONSTANTS } from '../constants';
import type { PlexConnectionProbeResult } from '../PlexConnectionProbeTypes';
import type { MixedContentConfig } from '../types';
import { createMockConnection, createMockServer } from './discoveryTestUtils';

const defaultMixedContentConfig: MixedContentConfig = {
    preferHttps: true,
    tryHttpsUpgrade: true,
    allowLocalHttp: true,
    logWarnings: false,
};

describe('discoveryProbe', () => {
    it('selects the fastest reachable probe within the first successful tier', async () => {
        const localHttpConnection = createMockConnection({
            uri: 'http://192.168.1.20:32400',
            protocol: 'http',
            address: '192.168.1.20',
        });
        const secondLocalHttpConnection = createMockConnection({
            uri: 'http://192.168.1.20:32401',
            protocol: 'http',
            address: '192.168.1.20',
            port: 32401,
        });
        const remoteHttpsConnection = createMockConnection({
            uri: 'https://plex.example:32400',
            protocol: 'https',
            address: 'plex.example',
            local: false,
        });
        const server = createMockServer({
            connections: [localHttpConnection, secondLocalHttpConnection, remoteHttpsConnection],
        });

        const probeConnection = jest.fn<Promise<PlexConnectionProbeResult>, [typeof localHttpConnection]>()
            .mockResolvedValueOnce({ connection: remoteHttpsConnection, outcome: 'unreachable' })
            .mockResolvedValueOnce({
                connection: {
                    ...localHttpConnection,
                    uri: 'https://192.168.1.20:32400',
                    protocol: 'https',
                    latencyMs: 35,
                },
                outcome: 'reachable',
            })
            .mockResolvedValueOnce({
                connection: {
                    ...secondLocalHttpConnection,
                    uri: 'https://192.168.1.20:32401',
                    protocol: 'https',
                    latencyMs: 12,
                },
                outcome: 'reachable',
            });

        const result = await findFastestConnectionProbe({
            server,
            mixedContentConfig: defaultMixedContentConfig,
            probeConnection,
        });

        expect(probeConnection).toHaveBeenCalledTimes(3);
        expect(result).toEqual({
            selectedProbe: {
                connection: expect.objectContaining({
                    uri: 'https://192.168.1.20:32401',
                    protocol: 'https',
                    latencyMs: 12,
                }),
                outcome: 'reachable',
            },
            authRequired: false,
            authState: null,
        });
    });

    it('keeps auth summary state when every probe fails', async () => {
        const firstConnection = createMockConnection({
            uri: 'http://192.168.1.21:32400',
            protocol: 'http',
            address: '192.168.1.21',
        });
        const secondConnection = createMockConnection({
            uri: 'http://192.168.1.22:32400',
            protocol: 'http',
            address: '192.168.1.22',
            port: 32401,
        });
        const server = createMockServer({
            connections: [firstConnection, secondConnection],
        });

        const probeConnection = jest.fn<Promise<PlexConnectionProbeResult>, [typeof firstConnection]>()
            .mockResolvedValueOnce({ connection: firstConnection, outcome: 'auth_required' })
            .mockResolvedValueOnce({ connection: secondConnection, outcome: 'access_denied' });

        const result = await findFastestConnectionProbe({
            server,
            mixedContentConfig: {
                preferHttps: false,
                tryHttpsUpgrade: false,
                allowLocalHttp: true,
                logWarnings: false,
            },
            probeConnection,
        });

        expect(result).toEqual({
            selectedProbe: null,
            authRequired: true,
            authState: 'access_denied',
        });
    });

    it('still probes HTTPS connections when preferHttps is false', async () => {
        const remoteHttpsConnection = createMockConnection({
            uri: 'https://plex.example:32400',
            protocol: 'https',
            address: 'plex.example',
            local: false,
        });
        const server = createMockServer({
            connections: [remoteHttpsConnection],
        });

        const probeConnection = jest.fn<Promise<PlexConnectionProbeResult>, [typeof remoteHttpsConnection]>()
            .mockResolvedValue({ connection: remoteHttpsConnection, outcome: 'reachable' });

        const result = await findFastestConnectionProbe({
            server,
            mixedContentConfig: {
                preferHttps: false,
                tryHttpsUpgrade: false,
                allowLocalHttp: true,
                logWarnings: false,
            },
            probeConnection,
        });

        expect(probeConnection).toHaveBeenCalledWith(remoteHttpsConnection);
        expect(result.selectedProbe).toEqual({
            connection: remoteHttpsConnection,
            outcome: 'reachable',
        });
    });

    it('prefers the fastest local HTTP probe when preferHttps is false', async () => {
        const localHttpConnection = createMockConnection({
            uri: 'http://192.168.1.20:32400',
            protocol: 'http',
            address: '192.168.1.20',
        });
        const secondLocalHttpConnection = createMockConnection({
            uri: 'http://192.168.1.20:32401',
            protocol: 'http',
            address: '192.168.1.20',
            port: 32401,
        });
        const localHttpsConnection = createMockConnection({
            uri: 'https://192.168.1.20:32400',
            protocol: 'https',
            address: '192.168.1.20',
        });
        const server = createMockServer({
            connections: [localHttpsConnection, localHttpConnection, secondLocalHttpConnection],
        });

        const probeConnection = jest.fn<Promise<PlexConnectionProbeResult>, [typeof localHttpConnection]>()
            .mockResolvedValueOnce({
                connection: { ...localHttpConnection, latencyMs: 45 },
                outcome: 'reachable',
            })
            .mockResolvedValueOnce({
                connection: { ...secondLocalHttpConnection, latencyMs: 10 },
                outcome: 'reachable',
            });

        const result = await findFastestConnectionProbe({
            server,
            mixedContentConfig: {
                preferHttps: false,
                tryHttpsUpgrade: true,
                allowLocalHttp: true,
                logWarnings: false,
            },
            probeConnection,
        });

        expect(probeConnection).toHaveBeenCalledTimes(2);
        expect(result.selectedProbe).toEqual({
            connection: expect.objectContaining({
                uri: 'http://192.168.1.20:32401',
                latencyMs: 10,
            }),
            outcome: 'reachable',
        });
    });

    it('orders local HTTPS upgrade ahead of remote HTTPS when preferHttps is false', async () => {
        const localHttpConnection = createMockConnection({
            uri: 'http://192.168.1.20:32400',
            protocol: 'http',
            address: '192.168.1.20',
        });
        const remoteHttpsConnection = createMockConnection({
            uri: 'https://plex.example:32400',
            protocol: 'https',
            address: 'plex.example',
            local: false,
        });
        const server = createMockServer({
            connections: [localHttpConnection, remoteHttpsConnection],
        });

        const probeConnection = jest.fn<Promise<PlexConnectionProbeResult>, [typeof localHttpConnection]>()
            .mockResolvedValueOnce({
                connection: {
                    ...localHttpConnection,
                    uri: 'http://192.168.1.20:32400',
                    protocol: 'http',
                },
                outcome: 'unreachable',
            })
            .mockImplementation(async (connection) => {
                if (connection.uri === 'https://192.168.1.20:32400') {
                    return {
                        connection,
                        outcome: 'unreachable',
                    };
                }

                if (connection.uri === 'https://plex.example:32400') {
                    return {
                        connection,
                        outcome: 'reachable',
                    };
                }

                throw new Error(`Unexpected probe uri: ${connection.uri}`);
            });

        const result = await findFastestConnectionProbe({
            server,
            mixedContentConfig: {
                preferHttps: false,
                tryHttpsUpgrade: true,
                allowLocalHttp: true,
                logWarnings: false,
            },
            probeConnection,
        });

        expect(probeConnection).toHaveBeenCalledTimes(3);
        expect(probeConnection.mock.calls.map(([connection]) => connection.uri)).toEqual([
            'http://192.168.1.20:32400',
            'https://192.168.1.20:32400',
            'https://plex.example:32400',
        ]);
        expect(result.selectedProbe).toEqual({
            connection: expect.objectContaining({
                uri: 'https://plex.example:32400',
                protocol: 'https',
            }),
            outcome: 'reachable',
        });
    });

    it('limits concurrent probes within a connection tier', async () => {
        const connections = Array.from({ length: PLEX_DISCOVERY_CONSTANTS.MAX_CONCURRENT_TESTS + 3 }, (_, index) =>
            createMockConnection({
                uri: `https://192.168.1.${index + 10}:32400`,
                address: `192.168.1.${index + 10}`,
                local: true,
                relay: false,
            })
        );
        const server = createMockServer({ connections });
        let active = 0;
        let maxActive = 0;
        const resolvers: Array<() => void> = [];
        const probeConnection = jest.fn((connection) => {
            active += 1;
            maxActive = Math.max(maxActive, active);
            return new Promise<PlexConnectionProbeResult>((resolve) => {
                resolvers.push((): void => {
                    active -= 1;
                    resolve({ connection: { ...connection, latencyMs: 10 }, outcome: 'reachable' });
                });
            });
        });

        const resultPromise = findFastestConnectionProbe({
            server,
            mixedContentConfig: defaultMixedContentConfig,
            probeConnection,
        });

        await Promise.resolve();
        expect(probeConnection).toHaveBeenCalledTimes(PLEX_DISCOVERY_CONSTANTS.MAX_CONCURRENT_TESTS);
        expect(maxActive).toBe(PLEX_DISCOVERY_CONSTANTS.MAX_CONCURRENT_TESTS);

        while (resolvers.length > 0) {
            const resolver = resolvers.shift();
            resolver?.();
            await Promise.resolve();
        }

        const result = await resultPromise;
        expect(probeConnection).toHaveBeenCalledTimes(connections.length);
        expect(maxActive).toBe(PLEX_DISCOVERY_CONSTANTS.MAX_CONCURRENT_TESTS);
        expect(result.selectedProbe?.outcome).toBe('reachable');
    });

    it('rejects and stops launching probes when a probe throws synchronously', async () => {
        const connections = Array.from({ length: PLEX_DISCOVERY_CONSTANTS.MAX_CONCURRENT_TESTS + 2 }, (_, index) =>
            createMockConnection({
                uri: `https://192.168.1.${index + 30}:32400`,
                address: `192.168.1.${index + 30}`,
                local: true,
                relay: false,
            })
        );
        const server = createMockServer({ connections });
        const failure = new Error('probe exploded');
        const probeConnection = jest.fn((connection) => {
            if (connection === connections[1]) {
                throw failure;
            }
            return new Promise<PlexConnectionProbeResult>(() => undefined);
        });

        await expect(findFastestConnectionProbe({
            server,
            mixedContentConfig: defaultMixedContentConfig,
            probeConnection,
        })).rejects.toBe(failure);

        expect(probeConnection).toHaveBeenCalledTimes(2);
    });

    it('does not launch pending probes after abort', async () => {
        const connections = Array.from({ length: PLEX_DISCOVERY_CONSTANTS.MAX_CONCURRENT_TESTS + 2 }, (_, index) =>
            createMockConnection({
                uri: `https://192.168.1.${index + 20}:32400`,
                address: `192.168.1.${index + 20}`,
                local: true,
                relay: false,
            })
        );
        const server = createMockServer({ connections });
        const controller = new AbortController();
        const abortReason = new DOMException('stop discovery', 'AbortError');
        const probeConnection = jest.fn(async (connection) => {
            controller.abort(abortReason);
            return { connection, outcome: 'unreachable' as const };
        });

        await expect(findFastestConnectionProbe({
            server,
            mixedContentConfig: defaultMixedContentConfig,
            probeConnection,
            signal: controller.signal,
        })).rejects.toBe(abortReason);

        expect(probeConnection).toHaveBeenCalledTimes(PLEX_DISCOVERY_CONSTANTS.MAX_CONCURRENT_TESTS);
    });
});
