import {
    createPlaybackCapabilityProfile,
    getDolbyVisionProfileSupport,
    isCapabilityAdvertisable,
    isCapabilitySupported,
    mapDoviProfileToDecoderProfile,
    type DolbyVisionDecoderProfile,
    type PlaybackCapabilityProfile,
} from '../capabilities/PlaybackCapabilityProfile';

function createProfile(options: {
    is4K?: boolean;
    supportedMimeTypes?: readonly string[];
    chromeMajor?: number | null;
    isWebOs?: boolean;
    dtsPassthroughEnabled?: boolean;
    declaredDolbyVisionProfiles?: readonly DolbyVisionDecoderProfile[];
} = {}): PlaybackCapabilityProfile {
    const supportedMimeTypes = new Set(options.supportedMimeTypes ?? []);
    const input = {
        is4K: options.is4K ?? true,
        canPlayMimeType: (mime: string): boolean => supportedMimeTypes.has(mime),
        chromeMajor: options.chromeMajor ?? null,
        isWebOs: options.isWebOs ?? false,
        dtsPassthroughEnabled: options.dtsPassthroughEnabled ?? false,
        userAgent: options.isWebOs === true
            ? 'Mozilla/5.0 (webOS) AppleWebKit/537.36 Chrome/108.0.0.0 Safari/537.36'
            : null,
    };

    return createPlaybackCapabilityProfile(options.declaredDolbyVisionProfiles
        ? { ...input, declaredDolbyVisionProfiles: options.declaredDolbyVisionProfiles }
        : input);
}

describe('PlaybackCapabilityProfile', () => {
    it('keeps display max resolution coherent with 4K capability', () => {
        const hdProfile = createProfile({ is4K: false });
        const uhdProfile = createProfile({ is4K: true });

        expect(hdProfile.display).toMatchObject({
            is4K: false,
            maxResolution: { width: 1920, height: 1080 },
        });
        expect(uhdProfile.display).toMatchObject({
            is4K: true,
            maxResolution: { width: 3840, height: 2160 },
        });
    });

    it('records explicit HEVC probes as advertizable capability evidence', () => {
        const profile = createProfile({
            supportedMimeTypes: [
                'video/mp4; codecs="hvc1.1.6.L93.B0"',
                'video/mp4; codecs="hvc1.2.4.L150.B0"',
            ],
        });

        expect(profile.video.hevcMain).toMatchObject({
            support: 'supported',
            confidence: 'explicit',
        });
        expect(profile.video.hevcMain10).toMatchObject({
            support: 'supported',
            confidence: 'explicit',
        });
        expect(profile.video.hdr10).toMatchObject({
            support: 'supported',
            confidence: 'inferred',
        });
        expect(isCapabilityAdvertisable(profile.video.hevcMain10)).toBe(true);
    });

    it('keeps webOS Chrome HEVC fallback advertizable but generic assumed support local-only', () => {
        const webOsProfile = createProfile({ isWebOs: true, chromeMajor: 94 });
        const genericProfile = createProfile();

        expect(webOsProfile.video.hevcMain10).toMatchObject({
            support: 'supported',
            confidence: 'inferred',
        });
        expect(isCapabilityAdvertisable(webOsProfile.video.hevcMain10)).toBe(true);

        expect(genericProfile.video.hevcMain10).toMatchObject({
            support: 'supported',
            confidence: 'assumed',
        });
        expect(isCapabilitySupported(genericProfile.video.hevcMain10)).toBe(true);
        expect(isCapabilityAdvertisable(genericProfile.video.hevcMain10)).toBe(false);
    });

    it('requires explicit Dolby Vision profile evidence per advertised decoder profile', () => {
        const profile = createProfile({
            supportedMimeTypes: ['video/mp4; codecs="dvh1.05.06"'],
        });

        expect(getDolbyVisionProfileSupport(profile, 'dvhe.05')).toMatchObject({
            support: 'supported',
            confidence: 'explicit',
        });
        expect(getDolbyVisionProfileSupport(profile, 'dvhe.08')).toMatchObject({
            support: 'unknown',
        });
    });

    it('accepts declared device Dolby Vision profiles as explicit support', () => {
        const profile = createProfile({
            declaredDolbyVisionProfiles: ['dvhe.08'],
        });

        expect(getDolbyVisionProfileSupport(profile, 'dvhe.08')).toMatchObject({
            support: 'supported',
            confidence: 'explicit',
            evidence: ['declared_device:dvhe.08'],
        });
    });

    it('maps Plex DOVI profile ids to decoder profiles without inferring unsupported ids', () => {
        expect(mapDoviProfileToDecoderProfile(5)).toBe('dvhe.05');
        expect(mapDoviProfileToDecoderProfile(8)).toBe('dvhe.08');
        expect(mapDoviProfileToDecoderProfile(7)).toBeNull();
        expect(mapDoviProfileToDecoderProfile(null)).toBeNull();
    });

    it('models DTS passthrough from the effective platform setting', () => {
        const disabled = createProfile({ dtsPassthroughEnabled: false });
        const enabled = createProfile({ dtsPassthroughEnabled: true });

        expect(disabled.audio.dtsPassthrough).toMatchObject({
            support: 'unsupported',
            confidence: 'explicit',
        });
        expect(enabled.audio.dtsPassthrough).toMatchObject({
            support: 'supported',
            confidence: 'explicit',
        });
    });
});
