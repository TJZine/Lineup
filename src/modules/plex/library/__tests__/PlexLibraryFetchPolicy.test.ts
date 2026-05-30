import { buildFetchRequestInit } from '../PlexLibraryFetchPolicy';

describe('buildFetchRequestInit', () => {
    it('normalizes Headers objects while preserving caller-provided overrides', () => {
        const init = buildFetchRequestInit(
            'http://example.com/library/sections/1/all?X-Plex-Container-Start=50&X-Plex-Container-Size=25',
            {
                headers: new Headers([
                    ['Accept', 'text/plain'],
                    ['X-Test-Header', 'test-value'],
                ]),
                signal: new AbortController().signal,
            },
            {
                'X-Plex-Token': 'mock-token',
            }
        );

        expect(init.signal).toBeUndefined();

        const headers = new Headers(init.headers);
        expect(headers.get('accept')).toBe('text/plain');
        expect(headers.get('x-test-header')).toBe('test-value');
        expect(headers.get('x-plex-token')).toBe('mock-token');
        expect(headers.get('x-plex-container-start')).toBe('50');
        expect(headers.get('x-plex-container-size')).toBe('25');
    });

    it('normalizes tuple-form headers without dropping values', () => {
        const init = buildFetchRequestInit(
            'http://example.com/library/sections/1/all',
            {
                headers: [
                    ['X-Test-Header', 'tuple-value'],
                ],
            },
            {}
        );

        const headers = new Headers(init.headers);
        expect(headers.get('x-test-header')).toBe('tuple-value');
        expect(headers.get('accept')).toBe('application/json');
    });
});
