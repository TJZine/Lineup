export type PlaybackCapabilitySupport = 'supported' | 'unsupported' | 'unknown';
export type PlaybackCapabilityConfidence = 'explicit' | 'inferred' | 'assumed';
export type DolbyVisionDecoderProfile = 'dvhe.05' | 'dvhe.08';

export interface PlaybackCapabilityEntry {
    support: PlaybackCapabilitySupport;
    confidence: PlaybackCapabilityConfidence;
    evidence: string[];
}

export interface PlaybackCapabilityProfile {
    display: {
        is4K: boolean;
        maxResolution: {
            width: number;
            height: number;
        };
    };
    browser: {
        isWebOs: boolean;
        chromeMajor: number | null;
        userAgent: string | null;
    };
    video: {
        h264: PlaybackCapabilityEntry;
        hevcMain: PlaybackCapabilityEntry;
        hevcMain10: PlaybackCapabilityEntry;
        hdr10: PlaybackCapabilityEntry;
        vp9: PlaybackCapabilityEntry;
        av1: PlaybackCapabilityEntry;
        dolbyVision: PlaybackCapabilityEntry & {
            profiles: Record<DolbyVisionDecoderProfile, PlaybackCapabilityEntry>;
        };
    };
    audio: {
        dtsPassthrough: PlaybackCapabilityEntry;
    };
}

export interface PlaybackCapabilityProfileInput {
    is4K: boolean;
    canPlayMimeType: (mime: string) => boolean;
    chromeMajor: number | null;
    isWebOs: boolean;
    dtsPassthroughEnabled: boolean;
    userAgent?: string | null;
    declaredDolbyVisionProfiles?: readonly DolbyVisionDecoderProfile[];
}

export interface BrowserPlaybackCapabilityProfileInput {
    isWebOs: boolean;
    dtsPassthroughEnabled: boolean;
}

const PLEX_HEVC_MAIN_MIME_PROBES = [
    'video/mp4; codecs="hvc1.1.6.L93.B0"',
    'video/mp4; codecs="hev1.1.6.L93.B0"',
] as const;

const PLEX_HEVC_MAIN10_MIME_PROBES = [
    'video/mp4; codecs="hvc1.2.4.L93.B0"',
    'video/mp4; codecs="hev1.2.4.L93.B0"',
    'video/mp4; codecs="hvc1.2.4.L150.B0"',
    'video/mp4; codecs="hev1.2.4.L150.B0"',
] as const;

const DOLBY_VISION_PROFILE_PROBES: Record<DolbyVisionDecoderProfile, readonly string[]> = {
    'dvhe.05': ['video/mp4; codecs="dvh1.05.06"'],
    'dvhe.08': ['video/mp4; codecs="dvh1.08.06"'],
};

const PLEX_VP9_MIME_PROBES = [
    'video/webm; codecs="vp9"',
    'video/mp4; codecs="vp09.00.10.08"',
] as const;

const PLEX_AV1_MIME_PROBES = [
    'video/mp4; codecs="av01.0.05M.08"',
    'video/webm; codecs="av01.0.05M.08"',
] as const;

const DISPLAY_4K_MAX_RESOLUTION = { width: 3840, height: 2160 } as const;
const DISPLAY_HD_MAX_RESOLUTION = { width: 1920, height: 1080 } as const;

export function createPlaybackCapabilityProfile(
    input: PlaybackCapabilityProfileInput
): PlaybackCapabilityProfile {
    const hevcMain = resolveVideoCapability(input, PLEX_HEVC_MAIN_MIME_PROBES, {
        inferred: supportsWebOsHevcFallback(input),
        assumedEvidence: 'lineup_hevc_direct_play_baseline',
    });
    const hevcMain10 = resolveVideoCapability(input, PLEX_HEVC_MAIN10_MIME_PROBES, {
        inferred: supportsWebOsHevcFallback(input),
        assumedEvidence: 'lineup_hevc_main10_direct_play_baseline',
    });
    const dolbyVisionProfiles = resolveDolbyVisionProfiles(input);
    const supportedDvProfiles = Object.values(dolbyVisionProfiles).filter(
        (entry) => entry.support === 'supported'
    );

    return {
        display: {
            is4K: input.is4K,
            maxResolution: input.is4K
                ? DISPLAY_4K_MAX_RESOLUTION
                : DISPLAY_HD_MAX_RESOLUTION,
        },
        browser: {
            isWebOs: input.isWebOs,
            chromeMajor: input.chromeMajor,
            userAgent: input.userAgent ?? null,
        },
        video: {
            h264: supported('assumed', 'lineup_h264_direct_play_baseline'),
            hevcMain,
            hevcMain10,
            hdr10: hevcMain10.support === 'supported'
                ? supported(confidenceNoStrongerThanInferred(hevcMain10.confidence), 'hevc_main10_hdr10_proxy')
                : unknown('hevc_main10_unavailable'),
            vp9: resolveVideoCapability(input, PLEX_VP9_MIME_PROBES, {
                assumedEvidence: 'lineup_vp9_direct_play_baseline',
            }),
            av1: resolveVideoCapability(input, PLEX_AV1_MIME_PROBES, {
                assumedEvidence: 'lineup_av1_direct_play_baseline',
            }),
            dolbyVision: {
                ...(supportedDvProfiles.length > 0
                    ? supported('explicit', 'dolby_vision_profile_supported')
                    : unknown('dolby_vision_not_explicitly_supported')),
                profiles: dolbyVisionProfiles,
            },
        },
        audio: {
            dtsPassthrough: input.dtsPassthroughEnabled
                ? supported('explicit', 'dts_passthrough_enabled')
                : unsupported('dts_passthrough_disabled'),
        },
    };
}

export function createBrowserPlaybackCapabilityProfile(
    input: BrowserPlaybackCapabilityProfileInput
): PlaybackCapabilityProfile {
    const videoEl = createVideoProbeElement();
    return createPlaybackCapabilityProfile({
        is4K: resolveBrowserDisplayIs4K(input),
        isWebOs: input.isWebOs,
        dtsPassthroughEnabled: input.dtsPassthroughEnabled,
        chromeMajor: getBrowserChromeMajor(),
        userAgent: getBrowserUserAgent(),
        canPlayMimeType: (mime: string): boolean => {
            try {
                return !!videoEl && videoEl.canPlayType(mime) !== '';
            } catch {
                return false;
            }
        },
    });
}

function resolveBrowserDisplayIs4K(input: BrowserPlaybackCapabilityProfileInput): boolean {
    if (input.isWebOs) {
        return true;
    }

    const screenSize = getBrowserScreenSize();
    if (!screenSize) {
        return false;
    }

    const longSide = Math.max(screenSize.width, screenSize.height);
    const shortSide = Math.min(screenSize.width, screenSize.height);
    return longSide >= DISPLAY_4K_MAX_RESOLUTION.width &&
        shortSide >= DISPLAY_4K_MAX_RESOLUTION.height;
}

export function getBrowserChromeMajor(): number | null {
    const ua = getBrowserUserAgent();
    const chromeMatch = ua?.match(/Chrome\/(\d+)/);
    if (!chromeMatch) {
        return null;
    }
    const chromeMajor = Number(chromeMatch[1]);
    return Number.isFinite(chromeMajor) ? chromeMajor : null;
}

export function getBrowserUserAgent(): string | null {
    try {
        if (typeof navigator === 'undefined') {
            return null;
        }
        return navigator.userAgent || null;
    } catch {
        return null;
    }
}

export function isCapabilitySupported(capability: PlaybackCapabilityEntry): boolean {
    return capability.support === 'supported';
}

export function isCapabilityAdvertisable(capability: PlaybackCapabilityEntry): boolean {
    return capability.support === 'supported' && capability.confidence !== 'assumed';
}

export function getDolbyVisionProfileSupport(
    profile: PlaybackCapabilityProfile,
    dolbyVisionProfile: DolbyVisionDecoderProfile
): PlaybackCapabilityEntry {
    return profile.video.dolbyVision.profiles[dolbyVisionProfile] ?? unknown('unknown_dolby_vision_profile');
}

export function mapDoviProfileToDecoderProfile(
    profileId: number | null | undefined
): DolbyVisionDecoderProfile | null {
    if (profileId === 5) {
        return 'dvhe.05';
    }
    if (profileId === 8) {
        return 'dvhe.08';
    }
    return null;
}

function resolveVideoCapability(
    input: PlaybackCapabilityProfileInput,
    mimeProbes: readonly string[],
    options: { inferred?: boolean; assumedEvidence?: string } = {}
): PlaybackCapabilityEntry {
    const explicitProbe = mimeProbes.find((mime) => safeCanPlay(input, mime));
    if (explicitProbe) {
        return supported('explicit', `mime:${explicitProbe}`);
    }
    if (options.inferred) {
        return supported('inferred', 'webos_chrome_hevc_fallback');
    }
    if (options.assumedEvidence) {
        return supported('assumed', options.assumedEvidence);
    }
    return unknown('mime_probe_unavailable');
}

function resolveDolbyVisionProfiles(
    input: PlaybackCapabilityProfileInput
): Record<DolbyVisionDecoderProfile, PlaybackCapabilityEntry> {
    const declared = new Set(input.declaredDolbyVisionProfiles ?? []);
    return {
        'dvhe.05': resolveDolbyVisionProfile(input, 'dvhe.05', declared),
        'dvhe.08': resolveDolbyVisionProfile(input, 'dvhe.08', declared),
    };
}

function resolveDolbyVisionProfile(
    input: PlaybackCapabilityProfileInput,
    profile: DolbyVisionDecoderProfile,
    declaredProfiles: ReadonlySet<DolbyVisionDecoderProfile>
): PlaybackCapabilityEntry {
    if (declaredProfiles.has(profile)) {
        return supported('explicit', `declared_device:${profile}`);
    }

    const explicitProbe = DOLBY_VISION_PROFILE_PROBES[profile].find((mime) => safeCanPlay(input, mime));
    if (explicitProbe) {
        return supported('explicit', `mime:${explicitProbe}`);
    }

    return unknown(`dolby_vision_${profile}_not_explicitly_supported`);
}

function supportsWebOsHevcFallback(input: PlaybackCapabilityProfileInput): boolean {
    return input.isWebOs && input.chromeMajor !== null && input.chromeMajor >= 94;
}

function safeCanPlay(input: PlaybackCapabilityProfileInput, mime: string): boolean {
    try {
        return input.canPlayMimeType(mime);
    } catch {
        return false;
    }
}

function createVideoProbeElement(): { canPlayType(mime: string): string } | null {
    try {
        if (typeof document === 'undefined') {
            return null;
        }
        return document.createElement('video');
    } catch {
        return null;
    }
}

function getBrowserScreenSize(): { width: number; height: number } | null {
    try {
        if (typeof window === 'undefined') {
            return null;
        }

        const width = window.screen?.width;
        const height = window.screen?.height;
        if (typeof width !== 'number' || typeof height !== 'number') {
            return null;
        }
        if (!Number.isFinite(width) || !Number.isFinite(height)) {
            return null;
        }

        return { width, height };
    } catch {
        return null;
    }
}

function supported(
    confidence: PlaybackCapabilityConfidence,
    evidence: string
): PlaybackCapabilityEntry {
    return { support: 'supported', confidence, evidence: [evidence] };
}

function unsupported(evidence: string): PlaybackCapabilityEntry {
    return { support: 'unsupported', confidence: 'explicit', evidence: [evidence] };
}

function unknown(evidence: string): PlaybackCapabilityEntry {
    return { support: 'unknown', confidence: 'assumed', evidence: [evidence] };
}

function confidenceNoStrongerThanInferred(
    confidence: PlaybackCapabilityConfidence
): PlaybackCapabilityConfidence {
    return confidence === 'explicit' ? 'inferred' : confidence;
}
