import type { PlexMediaFile, PlexStream } from '../contracts/types';
import type { Hdr10FallbackMode } from '../../../settings/PlaybackSettingsStore';
import { SUPPORTED_AUDIO_CODECS, SUPPORTED_CONTAINERS, SUPPORTED_VIDEO_CODECS } from './constants';
import { detectHdrLabel } from './hdr';
import { inferHdr10BaseLayer, shouldApplyHdr10Fallback } from './dvHdr10Fallback';
import type {
    PlaybackCapabilityEntry,
    PlaybackCapabilityProfile,
} from '../capabilities/PlaybackCapabilityProfile';
import {
    getDolbyVisionProfileSupport,
    isCapabilitySupported,
    mapDoviProfileToDecoderProfile,
} from '../capabilities/PlaybackCapabilityProfile';

export type DirectPlayDecision = {
    canDirect: boolean;
    reasons: string[];
};

const FALLBACK_AUDIO_CODECS = ['eac3', 'ac3', 'aac'] as const;

export function getDirectPlayDecision(options: {
    media: PlexMediaFile;
    videoStream?: PlexStream | null;
    audioCodecOverride?: string | null;
    capabilityProfile: PlaybackCapabilityProfile;
}): DirectPlayDecision {
    const reasons: string[] = [];
    const { media } = options;
    const audioCodec = normalizeCompatibilityValue(options.audioCodecOverride ?? media.audioCodec);

    appendContainerCompatibilityReasons(reasons, media.container, options.capabilityProfile);
    appendVideoCompatibilityReasons(reasons, media.videoCodec, options.videoStream ?? null, options.capabilityProfile);
    appendAudioCompatibilityReasons(reasons, audioCodec, options.capabilityProfile);
    appendResolutionCompatibilityReasons(reasons, media.width, media.height, options.capabilityProfile);

    return { canDirect: reasons.length === 0, reasons };
}

export function selectCompatibleAudioTrack(
    streams: PlexStream[],
    requestedId?: string
): PlexStream | null {
    const audioStreams = streams.filter((s) => s.streamType === 2);
    if (audioStreams.length === 0) {
        return null;
    }

    const requested = requestedId
        ? audioStreams.find((stream) => stream.id === requestedId) ?? null
        : null;
    if (requested) {
        return requested;
    }

    const defaultTrack = audioStreams.find((s) => s.default) || audioStreams[0];
    if (!defaultTrack) {
        return null;
    }
    if (!isTrueHdCodec(defaultTrack.codec)) {
        return defaultTrack;
    }

    const fallbackCandidates = getCompatibleFallbackAudioTracks(audioStreams, defaultTrack);
    return fallbackCandidates[0] || defaultTrack;
}

export function shouldForceTranscodeAudioStreamId(
    streams: PlexStream[],
    requestedId?: string
): boolean {
    if (requestedId) return true;
    const defaultAudio = findStream(streams, 2);
    return defaultAudio ? isTrueHdCodec(defaultAudio.codec) : false;
}

export function isTrueHdCodec(codec: string | null | undefined): boolean {
    const normalized = (codec || '').toLowerCase().replace(/[\s-]/g, '');
    return normalized === 'truehd' || normalized === 'mlp';
}

type HdrCompatibilityReason = 'force' | 'smart' | 'none';
export type HdrCompatibilityInputs = {
    media: PlexMediaFile;
    videoStream: PlexStream | null;
    hdr10FallbackMode: Hdr10FallbackMode;
};

export type HdrCompatibilityDecision = {
    isDolbyVision: boolean;
    applyHdr10Fallback: boolean;
    forceTranscodeForHdr10Fallback: boolean;
    fallbackReason: HdrCompatibilityReason;
    fallbackDebugWhy: string;
};

export function getHdrCompatibilityDecision(
    inputs: HdrCompatibilityInputs
): HdrCompatibilityDecision {
    const videoStream = inputs.videoStream;
    const isDolbyVision = detectHdrLabel(videoStream) === 'Dolby Vision';
    const sourceContainer = normalizeCompatibilityValue(inputs.media.container);

    const fallback = shouldApplyHdr10Fallback(
        buildHdr10FallbackRequest(inputs, isDolbyVision, sourceContainer)
    );

    return {
        isDolbyVision,
        applyHdr10Fallback: fallback.apply,
        forceTranscodeForHdr10Fallback: fallback.apply && fallback.reason === 'force',
        fallbackReason: fallback.reason,
        fallbackDebugWhy: fallback.debugWhy,
    };
}

function isCommentaryStream(stream: PlexStream): boolean {
    const title = (stream.title || '').toLowerCase();
    return title.includes('commentary');
}

function appendContainerCompatibilityReasons(
    reasons: string[],
    container: string,
    capabilityProfile: PlaybackCapabilityProfile
): void {
    const normalizedContainer = normalizeCompatibilityValue(container);
    if (!SUPPORTED_CONTAINERS.includes(normalizedContainer)) {
        reasons.push(`unsupported_container:${normalizedContainer}`);
    }

    if (normalizedContainer === 'mkv' && isLegacyWebOsCapability(capabilityProfile)) {
        reasons.push('mkv_legacy_webos');
    }
}

function appendVideoCompatibilityReasons(
    reasons: string[],
    videoCodec: string,
    videoStream: PlexStream | null,
    capabilityProfile: PlaybackCapabilityProfile
): void {
    const normalizedVideoCodec = normalizeCompatibilityValue(videoCodec);
    if (!SUPPORTED_VIDEO_CODECS.includes(normalizedVideoCodec)) {
        reasons.push(`unsupported_video_codec:${normalizedVideoCodec}`);
        return;
    }

    const codecCapability = getVideoCodecCapability(normalizedVideoCodec, videoStream, capabilityProfile);
    if (codecCapability && !isCapabilitySupported(codecCapability)) {
        reasons.push(`unsupported_video_codec:${normalizedVideoCodec}`);
        return;
    }

    appendDolbyVisionCompatibilityReasons(reasons, videoStream, capabilityProfile);
}

function appendDolbyVisionCompatibilityReasons(
    reasons: string[],
    videoStream: PlexStream | null,
    capabilityProfile: PlaybackCapabilityProfile
): void {
    if (detectHdrLabel(videoStream) !== 'Dolby Vision') {
        return;
    }

    const hdr10BaseLayer = inferHdr10BaseLayer({
        doviProfile: videoStream?.doviProfile ?? null,
        codecProfileString: videoStream?.profile ?? null,
        hdr: videoStream?.hdr ?? null,
        dynamicRange: videoStream?.dynamicRange ?? null,
        colorTrc: videoStream?.colorTrc ?? null,
        displayTitle: videoStream?.displayTitle ?? null,
        extendedDisplayTitle: videoStream?.extendedDisplayTitle ?? null,
    });

    if (!hdr10BaseLayer.isKnownNoHdr10BaseLayer) {
        return;
    }

    const decoderProfile = mapDoviProfileToDecoderProfile(hdr10BaseLayer.profileInfo.profileId);
    if (!decoderProfile) {
        reasons.push('unknown_dolby_vision_support');
        return;
    }

    const support = getDolbyVisionProfileSupport(capabilityProfile, decoderProfile);
    if (!isCapabilitySupported(support) || support.confidence !== 'explicit') {
        reasons.push(`unknown_dolby_vision_support:${decoderProfile}`);
    }
}

function normalizeCompatibilityValue(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function appendAudioCompatibilityReasons(
    reasons: string[],
    audioCodec: string,
    capabilityProfile: PlaybackCapabilityProfile
): void {
    if (isDtsFamilyCodec(audioCodec)) {
        if (!isCapabilitySupported(capabilityProfile.audio.dtsPassthrough)) {
            reasons.push('dts_passthrough_disabled');
        }
        return;
    }

    if (!SUPPORTED_AUDIO_CODECS.includes(audioCodec)) {
        reasons.push(`unsupported_audio_codec:${audioCodec}`);
    }
}

function appendResolutionCompatibilityReasons(
    reasons: string[],
    width: number,
    height: number,
    capabilityProfile: PlaybackCapabilityProfile
): void {
    if (width > capabilityProfile.display.maxResolution.width || height > capabilityProfile.display.maxResolution.height) {
        reasons.push(`unsupported_resolution:${width}x${height}`);
    }
}

function isLegacyWebOsCapability(capabilityProfile: PlaybackCapabilityProfile): boolean {
    const userAgent = capabilityProfile.browser.userAgent;
    if (!capabilityProfile.browser.isWebOs || typeof userAgent !== 'string' || !userAgent || !/Web0S|webOS/i.test(userAgent)) {
        return false;
    }

    const chromeMajor = capabilityProfile.browser.chromeMajor;
    return chromeMajor !== null && chromeMajor < 87;
}

function isDtsFamilyCodec(audioCodec: string): boolean {
    return audioCodec.startsWith('dts') || audioCodec.startsWith('dca');
}

function getVideoCodecCapability(
    normalizedVideoCodec: string,
    videoStream: PlexStream | null,
    capabilityProfile: PlaybackCapabilityProfile
): PlaybackCapabilityEntry | null {
    if (normalizedVideoCodec === 'h264' || normalizedVideoCodec === 'avc') {
        return capabilityProfile.video.h264;
    }
    if (normalizedVideoCodec === 'hevc' || normalizedVideoCodec === 'h265') {
        return shouldRequireMain10(videoStream)
            ? capabilityProfile.video.hevcMain10
            : capabilityProfile.video.hevcMain;
    }
    if (normalizedVideoCodec === 'vp9') {
        return capabilityProfile.video.vp9;
    }
    if (normalizedVideoCodec === 'av1') {
        return capabilityProfile.video.av1;
    }
    return null;
}

function shouldRequireMain10(videoStream: PlexStream | null): boolean {
    if (typeof videoStream?.bitDepth === 'number' && videoStream.bitDepth >= 10) {
        return true;
    }
    const hdrLabel = detectHdrLabel(videoStream);
    return Boolean(hdrLabel);
}

function getCompatibleFallbackAudioTracks(
    audioStreams: PlexStream[],
    defaultTrack: PlexStream
): PlexStream[] {
    const defaultLang = normalizeLanguageCode(defaultTrack);

    return audioStreams
        .filter((stream) => isCompatibleFallbackAudioTrack(stream, defaultTrack.id))
        .sort((left, right) => compareFallbackAudioTracks(left, right, defaultLang));
}

function isCompatibleFallbackAudioTrack(
    stream: PlexStream,
    defaultTrackId: string
): boolean {
    const codec = normalizeCompatibilityValue(stream.codec);

    return (
        stream.id !== defaultTrackId &&
        FALLBACK_AUDIO_CODECS.includes(codec as (typeof FALLBACK_AUDIO_CODECS)[number]) &&
        !isCommentaryStream(stream)
    );
}

function compareFallbackAudioTracks(
    left: PlexStream,
    right: PlexStream,
    defaultLanguage: string
): number {
    const leftLang = normalizeLanguageCode(left);
    const rightLang = normalizeLanguageCode(right);
    const leftLanguageScore = leftLang === defaultLanguage ? 0 : 1;
    const rightLanguageScore = rightLang === defaultLanguage ? 0 : 1;

    if (leftLanguageScore !== rightLanguageScore) {
        return leftLanguageScore - rightLanguageScore;
    }

    return getFallbackCodecPriority(left) - getFallbackCodecPriority(right);
}

function normalizeLanguageCode(stream: PlexStream): string {
    return (stream.languageCode || stream.language || '').toLowerCase();
}

function getFallbackCodecPriority(stream: PlexStream): number {
    const index = FALLBACK_AUDIO_CODECS.indexOf(
        normalizeCompatibilityValue(stream.codec) as (typeof FALLBACK_AUDIO_CODECS)[number]
    );
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function buildHdr10FallbackRequest(
    inputs: HdrCompatibilityInputs,
    isDolbyVision: boolean,
    sourceContainer: string
): {
    mode: Hdr10FallbackMode;
    container: string;
    isDolbyVision: boolean;
    doviProfile: string | null;
    codecProfileString: string | null;
    hdr: string | null;
    dynamicRange: string | null;
    colorTrc: string | null;
    displayTitle: string | null;
    extendedDisplayTitle: string | null;
    aspectRatio: number | null;
    width: number;
    height: number;
} {
    return {
        mode: inputs.hdr10FallbackMode,
        container: sourceContainer,
        isDolbyVision,
        doviProfile: inputs.videoStream?.doviProfile ?? null,
        codecProfileString: inputs.videoStream?.profile ?? null,
        hdr: inputs.videoStream?.hdr ?? null,
        dynamicRange: inputs.videoStream?.dynamicRange ?? null,
        colorTrc: inputs.videoStream?.colorTrc ?? null,
        displayTitle: inputs.videoStream?.displayTitle ?? null,
        extendedDisplayTitle: inputs.videoStream?.extendedDisplayTitle ?? null,
        aspectRatio: typeof inputs.media.aspectRatio === 'number' ? inputs.media.aspectRatio : null,
        width: inputs.media.width,
        height: inputs.media.height,
    };
}

function findStream(streams: PlexStream[], streamType: 1 | 2 | 3): PlexStream | null {
    const ofType = streams.filter((s) => s.streamType === streamType);
    const defaultStream = ofType.find((s) => s.default);
    return defaultStream || ofType[0] || null;
}
