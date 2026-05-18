/**
 * @fileoverview Unit tests for Plex URL helper functions.
 * @module modules/plex/shared/__tests__/plexUrl
 */

import {
    applyXPlexQueryParamsFromHeaders,
    applyXPlexTokenQueryParamFromHeaders,
    applyXPlexTokenQueryParamIfTrusted,
    buildPlexResourceUrlWithAuth,
    classifyPlexUrlOrigin,
    buildPlexUrlFromKey,
    isLikelyPlexServerKeyPath,
    PLEX_CLOUD_TRUSTED_ORIGINS,
    PLEX_TOKEN_HEADER,
    PLEX_TOKEN_QUERY_PARAM,
    readXPlexTokenFromHeaders,
    tryBuildPlexServerUrlFromKey,
} from '../plexUrl';

describe('shared plexUrl helpers', () => {
    describe('buildPlexUrlFromKey', () => {
        it('normalizes relative keys to the provided base origin', () => {
            const url = buildPlexUrlFromKey(
                'http://192.168.1.100:32400',
                '/library/parts/12345/file.mp4?audioStreamID=audio-1'
            );

            expect(url.origin).toBe('http://192.168.1.100:32400');
            expect(url.pathname).toBe('/library/parts/12345/file.mp4');
            expect(url.search).toBe('?audioStreamID=audio-1');
        });

        it('normalizes absolute keys to the provided base origin', () => {
            const url = buildPlexUrlFromKey(
                'http://192.168.1.100:32400',
                'http://malicious.example/library/parts/9999/file.mp4?token=abc'
            );

            expect(url.origin).toBe('http://192.168.1.100:32400');
            expect(url.pathname).toBe('/library/parts/9999/file.mp4');
            expect(url.search).toBe('?token=abc');
        });
    });

    describe('isLikelyPlexServerKeyPath', () => {
        it('returns true for known Plex server key prefixes', () => {
            expect(isLikelyPlexServerKeyPath('/library/metadata/123')).toBe(true);
            expect(isLikelyPlexServerKeyPath('/:/metadata/456')).toBe(true);
        });

        it('returns false for external non-Plex URLs', () => {
            expect(isLikelyPlexServerKeyPath('https://malicious.example/library/parts/9999/file.mp4?token=abc')).toBe(false);
            expect(isLikelyPlexServerKeyPath('https://cdn.example/images/poster.jpg')).toBe(false);
            expect(isLikelyPlexServerKeyPath('')).toBe(false);
        });
    });

    describe('classifyPlexUrlOrigin', () => {
        it('classifies same-origin Plex-looking absolute URLs as server-bound', () => {
            expect(classifyPlexUrlOrigin(
                'http://192.168.1.100:32400',
                'http://192.168.1.100:32400/library/parts/12345/file.mp4'
            )).toBe('server-absolute');
        });

        it('classifies foreign Plex-looking absolute URLs as external', () => {
            expect(classifyPlexUrlOrigin(
                'http://192.168.1.100:32400',
                'https://malicious.example/library/parts/12345/file.mp4'
            )).toBe('foreign-absolute');
        });

        it('classifies relative Plex keys as server-bound', () => {
            expect(classifyPlexUrlOrigin(
                'http://192.168.1.100:32400',
                '/library/parts/12345/file.mp4'
            )).toBe('server-relative');
        });

        it('classifies non-Plex absolute URLs as external', () => {
            expect(classifyPlexUrlOrigin(
                'http://192.168.1.100:32400',
                'https://cdn.example/images/poster.jpg'
            )).toBe('foreign-absolute');
        });
    });

    describe('tryBuildPlexServerUrlFromKey', () => {
        it('rebases same-origin absolute URLs onto the server origin', () => {
            const url = tryBuildPlexServerUrlFromKey(
                'http://192.168.1.100:32400',
                'http://192.168.1.100:32400/library/parts/9999/file.mp4?token=abc'
            );

            expect(url?.origin).toBe('http://192.168.1.100:32400');
            expect(url?.pathname).toBe('/library/parts/9999/file.mp4');
            expect(url?.search).toBe('?token=abc');
        });

        it('returns null for truly external absolute URLs', () => {
            expect(
                tryBuildPlexServerUrlFromKey(
                    'http://192.168.1.100:32400',
                    'https://cdn.example/images/poster.jpg'
                )
            ).toBeNull();
        });
    });

    describe('applyXPlexQueryParamsFromHeaders', () => {
        it('copies only non-empty X-Plex-* header values', () => {
            const params = new URLSearchParams();
            applyXPlexQueryParamsFromHeaders(params, {
                Accept: 'application/json',
                'X-Plex-Client-Identifier': 'client-id',
                'X-Plex-Product': '',
                [PLEX_TOKEN_HEADER]: 'mock-token',
                'x-plex-version': 'ignored-key',
            });

            expect(params.get('X-Plex-Client-Identifier')).toBe('client-id');
            expect(params.get(PLEX_TOKEN_QUERY_PARAM)).toBe('mock-token');
            expect(params.get('X-Plex-Product')).toBeNull();
            expect(params.get('Accept')).toBeNull();
            expect(params.get('x-plex-version')).toBeNull();
        });

        it('overwrites existing values to mirror current header behavior', () => {
            const params = new URLSearchParams();
            params.set('X-Plex-Client-Identifier', 'old-id');

            applyXPlexQueryParamsFromHeaders(params, {
                'X-Plex-Client-Identifier': 'new-id',
                [PLEX_TOKEN_HEADER]: 'token-1',
            });

            expect(params.get('X-Plex-Client-Identifier')).toBe('new-id');
            expect(params.get(PLEX_TOKEN_QUERY_PARAM)).toBe('token-1');
        });

        it('ignores malformed X-Plex header values at the URL boundary', () => {
            const params = new URLSearchParams();

            applyXPlexQueryParamsFromHeaders(params, {
                [PLEX_TOKEN_HEADER]: null,
                'X-Plex-Product': undefined,
                'X-Plex-Client-Identifier': 'client-id',
            });

            expect(params.get(PLEX_TOKEN_QUERY_PARAM)).toBeNull();
            expect(params.get('X-Plex-Product')).toBeNull();
            expect(params.get('X-Plex-Client-Identifier')).toBe('client-id');
        });
    });

    describe('applyXPlexTokenQueryParamIfTrusted', () => {
        it('attaches the token only for trusted Plex cloud origins', () => {
            for (const origin of PLEX_CLOUD_TRUSTED_ORIGINS) {
                const url = new URL('/api/v2/resources', origin);
                applyXPlexTokenQueryParamIfTrusted(url, 'cloud-token', PLEX_CLOUD_TRUSTED_ORIGINS);
                expect(url.searchParams.get(PLEX_TOKEN_QUERY_PARAM)).toBe('cloud-token');
            }
        });

        it('does not attach tokens for untrusted origins', () => {
            const url = new URL('https://cdn.example/images/poster.jpg');
            applyXPlexTokenQueryParamIfTrusted(url, 'cloud-token', PLEX_CLOUD_TRUSTED_ORIGINS);
            expect(url.searchParams.get(PLEX_TOKEN_QUERY_PARAM)).toBeNull();
        });
    });

    describe('X-Plex-Token header helpers', () => {
        it('reads only non-empty canonical token header values', () => {
            expect(readXPlexTokenFromHeaders({ [PLEX_TOKEN_HEADER]: 'token-1' })).toBe('token-1');
            expect(readXPlexTokenFromHeaders({ [PLEX_TOKEN_HEADER]: '' })).toBeNull();
            expect(readXPlexTokenFromHeaders({ [PLEX_TOKEN_HEADER]: null })).toBeNull();
            expect(readXPlexTokenFromHeaders({ 'x-plex-token': 'lowercase-token' })).toBeNull();
        });

        it('applies the canonical token header value to URL search params', () => {
            const params = new URLSearchParams();

            applyXPlexTokenQueryParamFromHeaders(params, { [PLEX_TOKEN_HEADER]: 'token-1' });

            expect(params.get(PLEX_TOKEN_QUERY_PARAM)).toBe('token-1');
        });

        it('does not apply a token query param when the canonical token header is absent or empty', () => {
            const absentParams = new URLSearchParams();
            const emptyParams = new URLSearchParams();

            applyXPlexTokenQueryParamFromHeaders(absentParams, {});
            applyXPlexTokenQueryParamFromHeaders(emptyParams, { [PLEX_TOKEN_HEADER]: '' });

            expect(absentParams.has(PLEX_TOKEN_QUERY_PARAM)).toBe(false);
            expect(emptyParams.has(PLEX_TOKEN_QUERY_PARAM)).toBe(false);
        });
    });

    describe('buildPlexResourceUrlWithAuth', () => {
        it('returns null when no base server URI is available', () => {
            const result = buildPlexResourceUrlWithAuth(null, '/library/metadata/1', {
                [PLEX_TOKEN_HEADER]: 'token-1',
            });
            expect(result).toBeNull();
        });

        it('builds authenticated URLs for rooted relative metadata paths outside Plex server-key prefixes', () => {
            const thumb = buildPlexResourceUrlWithAuth(
                'http://192.168.1.100:32400',
                '/thumb/path',
                { [PLEX_TOKEN_HEADER]: 'token-1' }
            );
            const art = buildPlexResourceUrlWithAuth(
                'http://192.168.1.100:32400',
                '/art/1',
                { [PLEX_TOKEN_HEADER]: 'token-1' }
            );
            const clearLogo = buildPlexResourceUrlWithAuth(
                'http://192.168.1.100:32400',
                '/clearlogo.png',
                { [PLEX_TOKEN_HEADER]: 'token-1' }
            );

            expect(thumb).toBe('http://192.168.1.100:32400/thumb/path?X-Plex-Token=token-1');
            expect(art).toBe('http://192.168.1.100:32400/art/1?X-Plex-Token=token-1');
            expect(clearLogo).toBe('http://192.168.1.100:32400/clearlogo.png?X-Plex-Token=token-1');
        });

        it('still returns null for malformed non-rooted relative resource strings', () => {
            const result = buildPlexResourceUrlWithAuth(
                'http://192.168.1.100:32400',
                'thumb/path',
                { [PLEX_TOKEN_HEADER]: 'token-1' }
            );

            expect(result).toBeNull();
        });

        it('rejects foreign absolute URLs', () => {
            const result = buildPlexResourceUrlWithAuth(
                'http://192.168.1.100:32400',
                'https://cdn.example/images/poster.jpg',
                { [PLEX_TOKEN_HEADER]: 'token-1' }
            );
            expect(result).toBeNull();
        });

        it('normalizes server-relative and server-absolute URLs and applies token query param', () => {
            const relative = buildPlexResourceUrlWithAuth(
                'http://192.168.1.100:32400',
                '/library/metadata/1?includeChildren=1',
                { [PLEX_TOKEN_HEADER]: 'token-1' }
            );
            const sameOriginAbsolute = buildPlexResourceUrlWithAuth(
                'http://192.168.1.100:32400',
                'http://192.168.1.100:32400/library/metadata/2',
                { [PLEX_TOKEN_HEADER]: 'token-1' }
            );

            expect(relative).toBe(
                'http://192.168.1.100:32400/library/metadata/1?includeChildren=1&X-Plex-Token=token-1'
            );
            expect(sameOriginAbsolute).toBe(
                'http://192.168.1.100:32400/library/metadata/2?X-Plex-Token=token-1'
            );
        });
    });
});
