import {
    buildPlexSubtitleFetchAttempts,
    buildPlexSubtitleTranscodeUrl,
    expandPlexSubtitleFetchAttemptVariants,
} from '../policy/plexSubtitleFallbackPolicy';
import { PLEX_TOKEN_HEADER, PLEX_TOKEN_QUERY_PARAM } from '../../shared/plexUrl';

describe('plexSubtitleFallbackPolicy', () => {
    it('builds query/header/download subtitle fetch attempts from Plex auth headers', () => {
        const initialUrl = new URL(
            'http://example.com/library/streams/1?X-Plex-Token=token'
        );

        const attempts = buildPlexSubtitleFetchAttempts(initialUrl, {
            [PLEX_TOKEN_HEADER]: 'token',
            'X-Plex-Client-Identifier': 'client-1',
        });

        expect(attempts.map((attempt) => attempt.name)).toEqual([
            'query',
            'header',
            'query_download',
            'header_download',
        ]);
        expect(attempts[0]?.headers).toEqual({
            Accept: 'text/vtt, text/plain, */*',
        });
        expect(attempts[0]?.url).not.toBe(initialUrl);
        attempts[0]!.url.searchParams.set('mutated', '1');
        expect(initialUrl.searchParams.get('mutated')).toBeNull();
        expect(attempts[1]?.headers).toEqual({
            Accept: 'text/vtt, text/plain, */*',
            [PLEX_TOKEN_HEADER]: 'token',
        });
        expect(attempts[1]?.url.searchParams.get(PLEX_TOKEN_QUERY_PARAM)).toBeNull();
        expect(attempts[2]?.url.searchParams.get('download')).toBe('1');
        expect(attempts[3]?.url.searchParams.get('download')).toBe('1');
        expect(attempts[3]?.url.searchParams.get(PLEX_TOKEN_QUERY_PARAM)).toBeNull();
    });

    it('expands a non-token subtitle request to include a LAN HTTP retry candidate', () => {
        const [attempt] = buildPlexSubtitleFetchAttempts(
            new URL('https://10-0-0-1.plex.direct:32400/library/streams/1'),
            {}
        );

        const requests = expandPlexSubtitleFetchAttemptVariants(
            attempt!,
            () => new URL('http://192.168.50.19:32400/library/streams/1')
        );

        expect(requests).toEqual([
            expect.objectContaining({
                variant: 'primary',
                url: expect.objectContaining({ href: 'https://10-0-0-1.plex.direct:32400/library/streams/1' }),
            }),
            expect.objectContaining({
                variant: 'lan_http',
                url: expect.objectContaining({ href: 'http://192.168.50.19:32400/library/streams/1' }),
            }),
        ]);
    });

    it('keeps token-bearing HTTPS subtitle requests on secure origins only', () => {
        const [attempt] = buildPlexSubtitleFetchAttempts(
            new URL('https://10-0-0-1.plex.direct:32400/library/streams/1?X-Plex-Token=token'),
            { [PLEX_TOKEN_HEADER]: 'token' }
        );

        const requests = expandPlexSubtitleFetchAttemptVariants(
            attempt!,
            (url) => new URL(`http://192.168.50.19:32400${url.pathname}${url.search}`)
        );

        expect(requests).toEqual([
            expect.objectContaining({
                variant: 'primary',
                url: expect.objectContaining({
                    href: 'https://10-0-0-1.plex.direct:32400/library/streams/1?X-Plex-Token=token',
                }),
            }),
        ]);
    });

    it('builds a universal subtitle transcode url from a metadata path and applies Plex query params', () => {
        const url = buildPlexSubtitleTranscodeUrl('sub-1', {
            serverUri: 'http://example.com',
            authHeaders: {
                [PLEX_TOKEN_HEADER]: 'token',
                'X-Plex-Client-Identifier': 'client-1',
            },
            itemKey: '/library/metadata/999',
            mediaIndex: 1,
            partIndex: 2,
            sessionId: 'sess-1',
        }, 'srt');

        expect(url).not.toBeNull();
        expect(url?.pathname).toBe('/video/:/transcode/universal/subtitles');
        expect(url?.searchParams.get('path')).toBe('/library/metadata/999');
        expect(url?.searchParams.get('mediaIndex')).toBe('1');
        expect(url?.searchParams.get('partIndex')).toBe('2');
        expect(url?.searchParams.get('subtitleStreamID')).toBe('sub-1');
        expect(url?.searchParams.get('format')).toBe('srt');
        expect(url?.searchParams.get('download')).toBe('1');
        expect(url?.searchParams.get(PLEX_TOKEN_QUERY_PARAM)).toBe('token');
        expect(url?.searchParams.get('X-Plex-Client-Identifier')).toBe('client-1');
        expect(url?.searchParams.get('X-Plex-Session-Identifier')).toBe('sess-1');
        expect(url?.searchParams.get('session')).toBe('sess-1');
        expect(url?.searchParams.get('X-Plex-Client-Profile-Name')).toBe('HTML TV App');
    });

    it('prefers a resolved playback base url over the raw server uri for subtitle transcode fallback', () => {
        const url = buildPlexSubtitleTranscodeUrl('sub-1', {
            serverUri: 'http://192.168.1.20:32400',
            resolvedBaseUrl: 'https://relay.plex.tv',
            authHeaders: {
                [PLEX_TOKEN_HEADER]: 'token',
                'X-Plex-Client-Identifier': 'client-1',
            },
            itemKey: '/library/metadata/999',
            mediaIndex: 1,
            partIndex: 2,
            sessionId: 'sess-1',
        }, 'vtt');

        expect(url).not.toBeNull();
        expect(url?.origin).toBe('https://relay.plex.tv');
        expect(url?.searchParams.get('path')).toBe('/library/metadata/999');
    });
});
