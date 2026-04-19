import { findFastestConnectionProbe } from '../discoveryProbe';
import type { PlexConnectionProbeResult } from '../discoveryProbe';
import type { MixedContentConfig } from '../types';
import { createMockConnection, createMockServer } from './discoveryTestUtils';

const defaultMixedContentConfig: MixedContentConfig = {
    preferHttps: true,
    tryHttpsUpgrade: true,
    allowLocalHttp: true,
    logWarnings: false,
};

describe('discoveryProbe', () => {
    it('selects the first reachable probe from the mixed-content tier order', async () => {
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
            .mockResolvedValueOnce({ connection: remoteHttpsConnection, outcome: 'unreachable' })
            .mockResolvedValueOnce({
                connection: {
                    ...localHttpConnection,
                    uri: 'https://192.168.1.20:32400',
                    protocol: 'https',
                },
                outcome: 'reachable',
            });

        const result = await findFastestConnectionProbe({
            server,
            mixedContentConfig: defaultMixedContentConfig,
            probeConnection,
        });

        expect(probeConnection).toHaveBeenCalledTimes(2);
        expect(result).toEqual({
            selectedProbe: {
                connection: expect.objectContaining({
                    uri: 'https://192.168.1.20:32400',
                    protocol: 'https',
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
            .mockResolvedValueOnce({ connection: secondConnection, outcome: 'auth_invalid' });

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
            authState: 'auth_invalid',
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

    it('prefers local HTTP over local HTTPS when preferHttps is false', async () => {
        const localHttpConnection = createMockConnection({
            uri: 'http://192.168.1.20:32400',
            protocol: 'http',
            address: '192.168.1.20',
        });
        const localHttpsConnection = createMockConnection({
            uri: 'https://192.168.1.20:32400',
            protocol: 'https',
            address: '192.168.1.20',
        });
        const server = createMockServer({
            connections: [localHttpsConnection, localHttpConnection],
        });

        const probeConnection = jest.fn<Promise<PlexConnectionProbeResult>, [typeof localHttpConnection]>()
            .mockResolvedValueOnce({ connection: localHttpConnection, outcome: 'reachable' });

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

        expect(probeConnection).toHaveBeenCalledTimes(1);
        expect(probeConnection).toHaveBeenCalledWith(localHttpConnection);
        expect(result.selectedProbe).toEqual({
            connection: localHttpConnection,
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
                    uri: 'https://192.168.1.20:32400',
                    protocol: 'https',
                },
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

        expect(probeConnection).toHaveBeenCalledTimes(1);
        expect(result.selectedProbe).toEqual({
            connection: expect.objectContaining({
                uri: 'https://192.168.1.20:32400',
                protocol: 'https',
            }),
            outcome: 'reachable',
        });
    });
});
