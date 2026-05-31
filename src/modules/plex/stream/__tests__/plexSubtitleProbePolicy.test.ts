import {
    buildPlexSubtitleProbeCacheKey,
    buildPlexSubtitleProbeRequest,
    resolvePlexSubtitleProbeBaseUrl,
} from '../policy/plexSubtitleProbePolicy';
import { PLEX_TOKEN_HEADER } from '../../shared/plexUrl';

describe('plexSubtitleProbePolicy', () => {
    it('uses resolvedBaseUrl before serverUri for subtitle probe requests and cache scope', () => {
        const request = buildPlexSubtitleProbeRequest({
            context: {
                serverUri: 'http://server-a:32400',
                resolvedBaseUrl: 'https://10-0-0-1.plex.direct:32400',
                authHeaders: {
                    [PLEX_TOKEN_HEADER]: 'secret-token',
                    'X-Plex-Client-Identifier': 'client-1',
                },
                itemKey: 'item-1',
            },
            fallbackItemKey: null,
            target: {
                id: 'sub-1',
                key: '/library/streams/sub-1',
            },
        });

        expect(request?.url.toString()).toBe(
            'https://10-0-0-1.plex.direct:32400/library/streams/sub-1?X-Plex-Token=secret-token'
        );
        expect(request?.headers).toEqual({
            Accept: 'text/vtt, text/plain, */*',
        });
        expect(request?.cacheKey).toContain('https://10-0-0-1.plex.direct:32400');
        expect(request?.cacheKey).toContain('item-1');
        expect(request?.cacheKey).toContain('sub-1');
        expect(request?.cacheKey).not.toContain('secret-token');
    });

    it('keeps cache decisions separated across resolved transport variants', () => {
        const baseContext = {
            serverUri: 'http://server-a:32400',
            authHeaders: { [PLEX_TOKEN_HEADER]: 'secret-token' },
            itemKey: 'item-1',
        };

        const serverUriKey = buildPlexSubtitleProbeCacheKey({
            context: baseContext,
            fallbackItemKey: null,
            target: { id: 'sub-1' },
        });
        const resolvedKey = buildPlexSubtitleProbeCacheKey({
            context: {
                ...baseContext,
                resolvedBaseUrl: 'https://10-0-0-1.plex.direct:32400',
            },
            fallbackItemKey: null,
            target: { id: 'sub-1' },
        });

        expect(serverUriKey).not.toBe(resolvedKey);
        expect(serverUriKey).toContain('http://server-a:32400');
        expect(resolvedKey).toContain('https://10-0-0-1.plex.direct:32400');
    });

    it('falls back to the selected Plex stream path for foreign absolute subtitle keys', () => {
        const resolved = resolvePlexSubtitleProbeBaseUrl({
            context: {
                serverUri: 'http://server-a:32400',
                resolvedBaseUrl: 'https://10-0-0-1.plex.direct:32400',
            },
            target: {
                id: 'foreign',
                key: 'https://foreign.example/library/streams/foreign',
            },
        });

        expect(resolved?.baseUrl.toString()).toBe(
            'https://10-0-0-1.plex.direct:32400/library/streams/foreign'
        );
        expect(resolved?.urlSource).toBe('id_fallback');
    });

    it('falls back to the selected Plex stream path for malformed relative keys', () => {
        const resolved = resolvePlexSubtitleProbeBaseUrl({
            context: {
                serverUri: 'http://server-a:32400',
            },
            target: {
                id: 'sub-1',
                key: 'not-a-plex-stream-key',
            },
        });

        expect(resolved?.baseUrl.toString()).toBe('http://server-a:32400/library/streams/sub-1');
        expect(resolved?.urlSource).toBe('id_fallback');
    });

    it('returns null when no valid transport base exists', () => {
        expect(
            buildPlexSubtitleProbeRequest({
                context: {
                    serverUri: null,
                    authHeaders: {},
                },
                fallbackItemKey: null,
                target: { id: 'sub-1' },
            })
        ).toBeNull();
        expect(
            buildPlexSubtitleProbeRequest({
                context: {
                    serverUri: 'not a url',
                    authHeaders: {},
                },
                fallbackItemKey: null,
                target: { id: 'sub-1' },
            })
        ).toBeNull();
    });
});
