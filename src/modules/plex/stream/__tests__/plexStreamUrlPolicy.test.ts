import {
    applyPlexSessionQueryParams,
    buildPlexMetadataPath,
    ensurePlexClientProfileName,
} from '../plexStreamUrlPolicy';

describe('plexStreamUrlPolicy', () => {
    it('normalizes rating keys and metadata paths into one canonical metadata path', () => {
        expect(buildPlexMetadataPath('999')).toBe('/library/metadata/999');
        expect(buildPlexMetadataPath('/library/metadata/999')).toBe('/library/metadata/999');
        expect(buildPlexMetadataPath('  /library/metadata/999  ')).toBe('/library/metadata/999');
    });

    it('applies Plex session query params only when a session id is provided', () => {
        const withSession = new URLSearchParams();
        applyPlexSessionQueryParams(withSession, 'sess-1');

        expect(withSession.get('session')).toBe('sess-1');
        expect(withSession.get('X-Plex-Session-Identifier')).toBe('sess-1');

        const withoutSession = new URLSearchParams();
        applyPlexSessionQueryParams(withoutSession, null);

        expect(withoutSession.get('session')).toBeNull();
        expect(withoutSession.get('X-Plex-Session-Identifier')).toBeNull();
    });

    it('preserves explicit profile names and otherwise defaults to HTML TV App', () => {
        const preserved = new URLSearchParams();
        preserved.set('X-Plex-Client-Profile-Name', 'Generic');
        ensurePlexClientProfileName(preserved);
        expect(preserved.get('X-Plex-Client-Profile-Name')).toBe('Generic');

        const fallback = new URLSearchParams();
        ensurePlexClientProfileName(fallback);
        expect(fallback.get('X-Plex-Client-Profile-Name')).toBe('HTML TV App');
    });
});
