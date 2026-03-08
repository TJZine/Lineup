/**
 * @fileoverview Unit tests for Plex URL helper functions.
 * @module modules/plex/stream/__tests__/plexUrl
 */

import {
    applyXPlexQueryParamsFromHeaders,
    buildPlexUrlFromKey,
} from '../plexUrl';

describe('plexUrl helpers', () => {
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
});
