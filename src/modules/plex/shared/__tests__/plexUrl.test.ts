/**
 * @fileoverview Unit tests for Plex URL helper functions.
 * @module modules/plex/stream/__tests__/plexUrl
 */

import {
    applyXPlexQueryParamsFromHeaders,
    applyXPlexTokenQueryParamIfTrusted,
    classifyPlexUrlOrigin,
    buildPlexUrlFromKey,
    isLikelyPlexServerKeyPath,
    PLEX_CLOUD_TRUSTED_ORIGINS,
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
            expect(isLikelyPlexServerKeyPath(':/metadata/456')).toBe(true);
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
                'X-Plex-Token': 'mock-token',
                'x-plex-version': 'ignored-key',
            });

            expect(params.get('X-Plex-Client-Identifier')).toBe('client-id');
            expect(params.get('X-Plex-Token')).toBe('mock-token');
            expect(params.get('X-Plex-Product')).toBeNull();
            expect(params.get('Accept')).toBeNull();
            expect(params.get('x-plex-version')).toBeNull();
        });

        it('overwrites existing values to mirror current header behavior', () => {
            const params = new URLSearchParams();
            params.set('X-Plex-Client-Identifier', 'old-id');

            applyXPlexQueryParamsFromHeaders(params, {
                'X-Plex-Client-Identifier': 'new-id',
                'X-Plex-Token': 'token-1',
            });

            expect(params.get('X-Plex-Client-Identifier')).toBe('new-id');
            expect(params.get('X-Plex-Token')).toBe('token-1');
        });
    });

    describe('applyXPlexTokenQueryParamIfTrusted', () => {
        it('attaches the token only for trusted Plex cloud origins', () => {
            for (const origin of PLEX_CLOUD_TRUSTED_ORIGINS) {
                const url = new URL('/api/v2/resources', origin);
                applyXPlexTokenQueryParamIfTrusted(url, 'cloud-token', PLEX_CLOUD_TRUSTED_ORIGINS);
                expect(url.searchParams.get('X-Plex-Token')).toBe('cloud-token');
            }
        });

        it('does not attach tokens for untrusted origins', () => {
            const url = new URL('https://cdn.example/images/poster.jpg');
            applyXPlexTokenQueryParamIfTrusted(url, 'cloud-token', PLEX_CLOUD_TRUSTED_ORIGINS);
            expect(url.searchParams.get('X-Plex-Token')).toBeNull();
        });
    });
});
