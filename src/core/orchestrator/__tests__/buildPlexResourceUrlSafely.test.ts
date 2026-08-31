import { buildPlexResourceUrlSafely } from '../runtime/buildPlexResourceUrlSafely';

describe('buildPlexResourceUrlSafely', () => {
    it('returns null and reports redacted accessor failure context', () => {
        const reportError = jest.fn();
        const result = buildPlexResourceUrlSafely(
            {
                getServerUri: () => 'http://localhost:32400?X-Plex-Token=base-secret',
                getAuthHeaders: () => { throw new Error('auth headers failed'); },
                reportError,
            },
            '/library/metadata/1/thumb?X-Plex-Token=path-secret'
        );

        expect(result).toBeNull();
        expect(reportError).toHaveBeenCalledWith(
            'orchestrator.plexResourceUrl.build',
            'buildPlexResourceUrlWithAuth failed',
            expect.objectContaining({ message: 'auth headers failed' }),
            {
                pathOrUrl: '/library/metadata/1/thumb?X-Plex-Token=REDACTED',
                baseUri: 'http://localhost:32400?X-Plex-Token=REDACTED',
            }
        );
    });
});
