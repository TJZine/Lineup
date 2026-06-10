import {
    applyPlexSessionQueryParams,
    buildPlexClientCapabilities,
    buildPlexMetadataPath,
    buildPlexTranscodeStartUrl,
    classifyPlexTranscodeLocation,
    ensurePlexClientProfileName,
} from '../url/plexStreamUrlPolicy';
import { PLEX_TOKEN_HEADER, PLEX_TOKEN_QUERY_PARAM } from '../../shared/plexUrl';
import {
    createPlaybackCapabilityProfile,
    type PlaybackCapabilityProfileInput,
} from '../capabilities/PlaybackCapabilityProfile';

const createTranscodeInput = (
    overrides: Partial<Parameters<typeof buildPlexTranscodeStartUrl>[0]> = {}
): Parameters<typeof buildPlexTranscodeStartUrl>[0] => ({
    baseUri: 'http://192.168.1.100:32400',
    metadataPath: '/library/metadata/12345',
        options: {
            sessionId: 'sess-1',
            maxBitrate: 4000,
            startOffsetMs: 123_456,
            mediaIndex: 1,
            partIndex: 2,
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
        [PLEX_TOKEN_HEADER]: 'token-1',
        'X-Plex-Client-Capabilities': 'header-capabilities',
    },
    forcedProfileName: 'Generic',
    defaultIdentityParams: {
        'X-Plex-Client-Identifier': 'client-1',
        'X-Plex-Platform': 'webOS',
    },
    ...overrides,
});

const createCapabilityInput = (
    supportedMimeTypes: Iterable<string>,
    overrides: Partial<PlaybackCapabilityProfileInput> & { hideDolbyVision?: boolean } = {}
): Parameters<typeof buildPlexClientCapabilities>[0] => {
    const mimeTypes = new Set(supportedMimeTypes);
    const { hideDolbyVision = false, ...profileOverrides } = overrides;

    return {
        profile: createPlaybackCapabilityProfile({
            is4K: true,
            canPlayMimeType: (mime) => mimeTypes.has(mime),
            chromeMajor: null,
            isWebOs: false,
            dtsPassthroughEnabled: false,
            ...profileOverrides,
        }),
        hideDolbyVision,
    };
};

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

    it('classifies non-local selected transcode connections as WAN', () => {
        expect(classifyPlexTranscodeLocation({
            baseUri: 'http://x',
            selectedConnection: { uri: 'http://x', local: false, relay: false },
            relayConnectionUri: null,
        })).toBe('wan');
    });

    it('builds transcode query policy while preserving computed capability precedence', () => {
        const result = buildPlexTranscodeStartUrl(createTranscodeInput({
            options: {
                sessionId: 'sess-1',
                maxBitrate: 4000,
                startOffsetMs: 183_000,
                mediaIndex: 1,
                partIndex: 2,
                subtitleMode: 'burn',
                subtitleStreamId: 'sub-1',
            },
        }));
        const { url } = result;

        const parsed = new URL(url);

        expect(parsed.pathname).toBe('/video/:/transcode/universal/start.m3u8');
        expect(result.startOffsetMs).toBe(183_000);
        expect(result.startOffsetSeconds).toBe(183);
        expect(result.maxBitrate).toBe(4000);
        expect(result.maxBitrateReason).toBe('explicit_quality');
        expect(parsed.searchParams.get('path')).toBe('/library/metadata/12345');
        expect(parsed.searchParams.get('offset')).toBe('183');
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
        expect(parsed.searchParams.get(PLEX_TOKEN_QUERY_PARAM)).toBe('token-1');
        expect(parsed.searchParams.get('X-Plex-Client-Capabilities')).toBe('computed-capabilities');
        expect(parsed.searchParams.get('X-Plex-Client-Profile-Name')).toBe('Generic');
        expect(parsed.searchParams.get('X-Plex-Client-Identifier')).toBe('client-1');
    });

    it('omits extended transcode tuning params in compat mode', () => {
        const { url } = buildPlexTranscodeStartUrl(createTranscodeInput({
            compatMode: true,
        }));

        const parsed = new URL(url);

        for (const key of [
            'fastSeek',
            'directStreamAudio',
            'subtitleSize',
            'audioBoost',
            'addDebugOverlay',
            'autoAdjustQuality',
            'mediaBufferSize',
            'Accept-Language',
        ]) {
            expect(parsed.searchParams.has(key)).toBe(false);
        }
        expect(parsed.searchParams.get('session')).toBe('sess-1');
        expect(parsed.searchParams.get('path')).toBe('/library/metadata/12345');
        expect(parsed.searchParams.get('directPlay')).toBe('0');
        expect(parsed.searchParams.get('directStream')).toBe('1');
        expect(parsed.searchParams.get('location')).toBe('lan');
    });

    it('omits maxVideoBitrate for original-quality HLS requests without an explicit cap', () => {
        const result = buildPlexTranscodeStartUrl(createTranscodeInput({
            options: {
                sessionId: 'sess-1',
                mediaIndex: 1,
                partIndex: 2,
            },
            quality: null,
        }));

        const parsed = new URL(result.url);

        expect(result.maxBitrate).toBeUndefined();
        expect(result.maxBitrateReason).toBe('none');
        expect(parsed.searchParams.has('maxVideoBitrate')).toBe(false);
    });

    it('normalizes non-finite numeric inputs before serializing Plex query params', () => {
        const result = buildPlexTranscodeStartUrl(createTranscodeInput({
            options: {
                sessionId: 'sess-1',
                maxBitrate: Number.NaN,
                startOffsetMs: Number.NaN,
                mediaIndex: Number.POSITIVE_INFINITY,
                partIndex: Number.NEGATIVE_INFINITY,
            },
            quality: {
                storageValue: 'bad-quality',
                label: 'Bad quality',
                maxVideoBitrateKbps: Number.NaN,
            },
        }));

        const parsed = new URL(result.url);

        expect(result.startOffsetMs).toBe(0);
        expect(result.startOffsetSeconds).toBe(0);
        expect(result.maxBitrate).toBeUndefined();
        expect(result.maxBitrateReason).toBe('none');
        expect(parsed.searchParams.get('offset')).toBe('0');
        expect(parsed.searchParams.get('mediaIndex')).toBe('0');
        expect(parsed.searchParams.get('partIndex')).toBe('0');
        expect(parsed.searchParams.has('maxVideoBitrate')).toBe(false);
    });

    it('applies configured quality as the only cap when no request cap is provided', () => {
        const result = buildPlexTranscodeStartUrl(createTranscodeInput({
            options: {
                sessionId: 'sess-1',
                mediaIndex: 1,
                partIndex: 2,
            },
        }));

        const parsed = new URL(result.url);

        expect(result.maxBitrate).toBe(8000);
        expect(result.maxBitrateReason).toBe('quality');
        expect(parsed.searchParams.get('maxVideoBitrate')).toBe('8000');
    });

    it('serializes client capabilities with stable decoder ordering', () => {
        const capabilities = buildPlexClientCapabilities(createCapabilityInput([
            'video/mp4; codecs="hvc1.2.4.L93.B0"',
            'video/mp4; codecs="hvc1.2.4.L150.B0"',
            'video/mp4; codecs="hvc1.1.6.L93.B0"',
            'video/mp4; codecs="dvh1.05.06"',
            'video/mp4; codecs="dvh1.08.06"',
            'video/webm; codecs="vp9"',
            'video/mp4; codecs="av01.0.05M.08"',
        ], {
            dtsPassthroughEnabled: true,
        }));

        expect(capabilities).toBe(
            'protocols=http-live-streaming,http-mp4-streaming,http-streaming-video;' +
            'videoDecoders=' +
            'h264{profile:high&level:51},' +
            'hevc{profile:main10&level:150},' +
            'hevc{profile:main&level:150},' +
            'hevc{profile:dvhe.05},' +
            'hevc{profile:dvhe.08},' +
            'vp9,' +
            'av1;' +
            'audioDecoders=' +
            'mp3,' +
            'aac{bitrate:800000},' +
            'ac3{bitrate:800000},' +
            'eac3{bitrate:800000},' +
            'dts{bitrate:1536000},' +
            'dca{bitrate:1536000},' +
            'dca-ma{bitrate:1536000}'
        );
    });

    it('advertises Dolby Vision profiles only when supported and not hidden', () => {
        const advertised = buildPlexClientCapabilities(createCapabilityInput([
            'video/mp4; codecs="hvc1.1.6.L93.B0"',
            'video/mp4; codecs="dvh1.08.06"',
        ], {
            is4K: false,
            hideDolbyVision: false,
        }));
        const hidden = buildPlexClientCapabilities(createCapabilityInput([
            'video/mp4; codecs="hvc1.1.6.L93.B0"',
            'video/mp4; codecs="dvh1.08.06"',
        ], {
            is4K: false,
            hideDolbyVision: true,
        }));

        expect(advertised).toContain('hevc{profile:dvhe.08}');
        expect(advertised).not.toContain('hevc{profile:dvhe.05}');
        expect(hidden).not.toContain('dvhe');
    });

    it('advertises explicit Dolby Vision support without over-advertising assumed generic HEVC', () => {
        const capabilities = buildPlexClientCapabilities(createCapabilityInput([
            'video/mp4; codecs="dvh1.05.06"',
        ], {
            is4K: false,
        }));

        expect(capabilities).toContain(
            'videoDecoders=h264{profile:high&level:42},hevc{profile:dvhe.05};'
        );
        expect(capabilities).not.toContain('hevc{profile:main&');
        expect(capabilities).not.toContain('hevc{profile:main10&');
    });

    it('advertises declared Dolby Vision support without generic HEVC capability evidence', () => {
        const capabilities = buildPlexClientCapabilities(createCapabilityInput([], {
            is4K: false,
            declaredDolbyVisionProfiles: ['dvhe.08'],
        }));

        expect(capabilities).toContain(
            'videoDecoders=h264{profile:high&level:42},hevc{profile:dvhe.08};'
        );
        expect(capabilities).not.toContain('hevc{profile:main&');
        expect(capabilities).not.toContain('hevc{profile:main10&');
    });

    it('includes AV1 only when an approved AV1 probe succeeds', () => {
        const unsupported = buildPlexClientCapabilities(createCapabilityInput([]));
        const mp4Supported = buildPlexClientCapabilities(createCapabilityInput([
            'video/mp4; codecs="av01.0.05M.08"',
        ]));
        const webmSupported = buildPlexClientCapabilities(createCapabilityInput([
            'video/webm; codecs="av01.0.05M.08"',
        ]));

        expect(unsupported).not.toContain('av1');
        expect(mp4Supported).toContain('videoDecoders=h264{profile:high&level:51},av1');
        expect(webmSupported).toContain('videoDecoders=h264{profile:high&level:51},av1');
    });

    it('preserves HEVC explicit probe behavior and webOS Chrome fallback', () => {
        const explicitMain = buildPlexClientCapabilities(createCapabilityInput([
            'video/mp4; codecs="hev1.1.6.L93.B0"',
        ], {
            is4K: false,
        }));
        const explicitMain10 = buildPlexClientCapabilities(createCapabilityInput([
            'video/mp4; codecs="hev1.2.4.L150.B0"',
        ], {
            is4K: false,
        }));
        const oldWebOsChrome = buildPlexClientCapabilities(createCapabilityInput([], {
            is4K: false,
            isWebOs: true,
            chromeMajor: 93,
        }));
        const fallbackWebOsChrome = buildPlexClientCapabilities(createCapabilityInput([], {
            is4K: false,
            isWebOs: true,
            chromeMajor: 94,
        }));

        expect(explicitMain).toContain(
            'videoDecoders=h264{profile:high&level:42},hevc{profile:main&level:120};'
        );
        expect(explicitMain10).toContain(
            'videoDecoders=h264{profile:high&level:42},hevc{profile:main10&level:120},hevc{profile:main&level:120};'
        );
        expect(oldWebOsChrome).toContain(
            'videoDecoders=h264{profile:high&level:42};'
        );
        expect(fallbackWebOsChrome).toContain(
            'videoDecoders=h264{profile:high&level:42},hevc{profile:main10&level:120},hevc{profile:main&level:120};'
        );
    });

    it('includes DTS passthrough decoders only when passthrough is enabled', () => {
        const disabled = buildPlexClientCapabilities(createCapabilityInput([], {
            dtsPassthroughEnabled: false,
        }));
        const enabled = buildPlexClientCapabilities(createCapabilityInput([], {
            dtsPassthroughEnabled: true,
        }));

        expect(disabled).toContain(
            'audioDecoders=mp3,aac{bitrate:800000},ac3{bitrate:800000},eac3{bitrate:800000}'
        );
        expect(disabled).not.toContain('dts{bitrate:1536000}');
        expect(disabled).not.toContain('dca{bitrate:1536000}');
        expect(disabled).not.toContain('dca-ma{bitrate:1536000}');
        expect(enabled).toContain(
            'audioDecoders=mp3,aac{bitrate:800000},ac3{bitrate:800000},eac3{bitrate:800000},' +
            'dts{bitrate:1536000},dca{bitrate:1536000},dca-ma{bitrate:1536000}'
        );
    });

    it('rejects blank metadata paths before building transcode URLs', () => {
        expect(() => buildPlexTranscodeStartUrl(createTranscodeInput({
            metadataPath: '   ',
        }))).toThrow('Plex transcode metadataPath must be a non-empty string');
    });

    it('rejects invalid base URIs before building transcode URLs', () => {
        expect(() => buildPlexTranscodeStartUrl(createTranscodeInput({
            baseUri: 'not a url',
        }))).toThrow('Plex transcode baseUri must be a valid absolute URL');
    });
});
