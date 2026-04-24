import {
    applyPlexSessionQueryParams,
    buildPlexClientCapabilities,
    buildPlexMetadataPath,
    buildPlexTranscodeStartUrl,
    classifyPlexTranscodeLocation,
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

    it('treats whitespace-only override names as absent and falls back to HTML TV App', () => {
        const fallback = new URLSearchParams();

        ensurePlexClientProfileName(fallback, '   ');

        expect(fallback.get('X-Plex-Client-Profile-Name')).toBe('HTML TV App');
    });

    it('classifies relay-backed transcode requests as WAN without guessing unknown origins', () => {
        expect(classifyPlexTranscodeLocation({
            baseUri: 'https://relay.plex.direct:32400',
            selectedConnection: null,
            relayConnectionUri: 'https://relay.plex.direct:32400',
        })).toBe('wan');

        expect(classifyPlexTranscodeLocation({
            baseUri: 'http://192.168.1.100:32400',
            selectedConnection: null,
            relayConnectionUri: null,
        })).toBeNull();
    });

    it('builds transcode query policy while preserving auth header precedence', () => {
        const { url } = buildPlexTranscodeStartUrl({
            baseUri: 'http://192.168.1.100:32400',
            metadataPath: '/library/metadata/12345',
            options: {
                sessionId: 'sess-1',
                maxBitrate: 4000,
                mediaIndex: 1,
                partIndex: 2,
                subtitleMode: 'burn',
                subtitleStreamId: 'sub-1',
            },
            compatMode: false,
            quality: {
                storageValue: '8000-1080p',
                label: '8 Mbps (1080p)',
                maxVideoBitrateKbps: 8000,
                videoResolution: '1920x1080',
            },
            selectedConnection: { uri: 'http://192.168.1.100:32400', local: true, relay: false },
            relayConnectionUri: null,
            clientCapabilities: 'computed-capabilities',
            authHeaders: {
                'X-Plex-Token': 'token-1',
                'X-Plex-Client-Capabilities': 'header-capabilities',
            },
            forcedProfileName: 'Generic',
            defaultIdentityParams: {
                'X-Plex-Client-Identifier': 'client-1',
                'X-Plex-Platform': 'webOS',
            },
        });

        const parsed = new URL(url);

        expect(parsed.pathname).toBe('/video/:/transcode/universal/start.m3u8');
        expect(parsed.searchParams.get('path')).toBe('/library/metadata/12345');
        expect(parsed.searchParams.get('session')).toBe('sess-1');
        expect(parsed.searchParams.get('X-Plex-Session-Identifier')).toBe('sess-1');
        expect(parsed.searchParams.get('mediaIndex')).toBe('1');
        expect(parsed.searchParams.get('partIndex')).toBe('2');
        expect(parsed.searchParams.get('directPlay')).toBe('0');
        expect(parsed.searchParams.get('directStream')).toBe('1');
        expect(parsed.searchParams.get('directStreamAudio')).toBe('1');
        expect(parsed.searchParams.get('maxVideoBitrate')).toBe('4000');
        expect(parsed.searchParams.get('videoResolution')).toBe('1920x1080');
        expect(parsed.searchParams.get('location')).toBe('lan');
        expect(parsed.searchParams.get('subtitles')).toBe('burn');
        expect(parsed.searchParams.get('subtitleStreamID')).toBe('sub-1');
        expect(parsed.searchParams.get('X-Plex-Token')).toBe('token-1');
        expect(parsed.searchParams.get('X-Plex-Client-Capabilities')).toBe('header-capabilities');
        expect(parsed.searchParams.get('X-Plex-Client-Profile-Name')).toBe('Generic');
        expect(parsed.searchParams.get('X-Plex-Client-Identifier')).toBe('client-1');
    });

    it('builds conservative client capabilities from runtime capability probes', () => {
        const capabilities = buildPlexClientCapabilities({
            is4K: true,
            canPlayMimeType: (mime) => mime.includes('hvc1.2.4') || mime.includes('vp9'),
            chromeMajor: null,
            isWebOs: false,
            dtsPassthroughEnabled: true,
            hideDolbyVision: true,
        });

        expect(capabilities).toContain('h264{profile:high&level:51}');
        expect(capabilities).toContain('hevc{profile:main10&level:150}');
        expect(capabilities).toContain('hevc{profile:main&level:150}');
        expect(capabilities).toContain('vp9');
        expect(capabilities).toContain('dca-ma{bitrate:1536000}');
        expect(capabilities).not.toContain('dvhe');
    });
});
