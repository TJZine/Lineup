/**
 * @fileoverview Playback compatibility policy helpers for media, audio, and HDR decisions.
 */

import type { PlexMediaFile, PlexStream } from './types';
import { SUPPORTED_AUDIO_CODECS, SUPPORTED_CONTAINERS, SUPPORTED_VIDEO_CODECS, MAX_RESOLUTION } from './constants';
import { detectHdrLabel } from './hdr';
import { inferHdr10BaseLayer, shouldApplyHdr10Fallback } from './dvHdr10Fallback';

export type DirectPlayDecision = {
    canDirect: boolean;
    reasons: string[];
};

export function getDirectPlayDecision(options: {
    media: PlexMediaFile;
    audioCodecOverride?: string | null;
    dtsPassthroughEnabled: boolean;
    userAgent?: string | null;
}): DirectPlayDecision {
    const reasons: string[] = [];
    const { media } = options;
    const audioCodec = (options.audioCodecOverride ?? media.audioCodec).toLowerCase();

    if (!SUPPORTED_CONTAINERS.includes(media.container)) {
        reasons.push(`unsupported_container:${media.container}`);
    }

    if (media.container === 'mkv') {
        const isLegacyWebOs = ((): boolean => {
            if (typeof options.userAgent !== 'string' || !options.userAgent) {
                return false;
            }
            const ua = options.userAgent;
            if (!/Web0S|webOS/i.test(ua)) {
                return false;
            }
            const chromeMatch = ua.match(/Chrome\/(\d+)/);
            const chromeMajor = chromeMatch ? Number(chromeMatch[1]) : NaN;
            return Number.isFinite(chromeMajor) && chromeMajor < 87;
        })();
        if (isLegacyWebOs) {
            reasons.push('mkv_legacy_webos');
        }
    }

    if (!SUPPORTED_VIDEO_CODECS.includes(media.videoCodec)) {
        reasons.push(`unsupported_video_codec:${media.videoCodec}`);
    }

    const isDtsFamily =
        audioCodec.startsWith('dts') ||
        audioCodec.startsWith('dca');
    if (isDtsFamily) {
        if (!options.dtsPassthroughEnabled) {
            reasons.push('dts_passthrough_disabled');
        }
    } else if (!SUPPORTED_AUDIO_CODECS.includes(audioCodec)) {
        reasons.push(`unsupported_audio_codec:${audioCodec}`);
    }

    if (media.width > MAX_RESOLUTION.width || media.height > MAX_RESOLUTION.height) {
        reasons.push(`unsupported_resolution:${media.width}x${media.height}`);
    }

    return { canDirect: reasons.length === 0, reasons };
}

export function selectCompatibleAudioTrack(
    streams: PlexStream[],
    requestedId?: string
): PlexStream | null {
    const audioStreams = streams.filter((s) => s.streamType === 2);
    if (audioStreams.length === 0) return null;

    if (requestedId) {
        const requested = audioStreams.find((s) => s.id === requestedId);
        if (requested) {
            return requested;
        }
    }

    const fallbackCodecs = ['eac3', 'ac3', 'aac'];
    const defaultTrack = audioStreams.find((s) => s.default) || audioStreams[0];
    if (!defaultTrack) return null;

    if (!isTrueHdCodec(defaultTrack.codec)) {
        return defaultTrack;
    }

    const defaultLang = (defaultTrack.languageCode || defaultTrack.language || '').toLowerCase();
    const fallbackCandidates = audioStreams
        .filter((stream) => {
            const codec = (stream.codec || '').toLowerCase();
            if (stream.id === defaultTrack.id) return false;
            if (!fallbackCodecs.includes(codec)) return false;
            if (isCommentaryStream(stream)) return false;
            return true;
        })
        .sort((a, b) => {
            const aLang = (a.languageCode || a.language || '').toLowerCase();
            const bLang = (b.languageCode || b.language || '').toLowerCase();
            if (aLang === defaultLang && bLang !== defaultLang) return -1;
            if (bLang === defaultLang && aLang !== defaultLang) return 1;

            const codecPriority = ['eac3', 'ac3', 'aac'];
            const aCodec = (a.codec || '').toLowerCase();
            const bCodec = (b.codec || '').toLowerCase();
            const aPriority = codecPriority.indexOf(aCodec);
            const bPriority = codecPriority.indexOf(bCodec);
            return (aPriority === -1 ? 99 : aPriority) - (bPriority === -1 ? 99 : bPriority);
        });

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
    hdr10FallbackMode: 'off' | 'smart' | 'force';
};

export type HdrCompatibilityDecision = {
    isDolbyVision: boolean;
    applyHdr10Fallback: boolean;
    forceTranscodeForHdr10Fallback: boolean;
    forceHlsForDvNoHdr10BaseLayer: boolean;
    fallbackReason: HdrCompatibilityReason;
};

export function getHdrCompatibilityDecision(
    inputs: HdrCompatibilityInputs
): HdrCompatibilityDecision {
    const videoStream = inputs.videoStream;
    const isDolbyVision = detectHdrLabel(videoStream) === 'Dolby Vision';
    const sourceContainer = (inputs.media.container ?? '').toLowerCase();

    const hdr10BaseLayerInfo = inferHdr10BaseLayer({
        doviProfile: videoStream?.doviProfile ?? null,
        codecProfileString: videoStream?.profile ?? null,
        hdr: videoStream?.hdr ?? null,
        dynamicRange: videoStream?.dynamicRange ?? null,
        colorTrc: videoStream?.colorTrc ?? null,
        displayTitle: videoStream?.displayTitle ?? null,
        extendedDisplayTitle: videoStream?.extendedDisplayTitle ?? null,
    });

    const forceHlsForDvNoHdr10BaseLayer = isDolbyVision
        && sourceContainer === 'mkv'
        && hdr10BaseLayerInfo.isKnownNoHdr10BaseLayer;

    const fallback = shouldApplyHdr10Fallback({
        mode: inputs.hdr10FallbackMode,
        container: inputs.media.container,
        isDolbyVision,
        doviProfile: videoStream?.doviProfile ?? null,
        codecProfileString: videoStream?.profile ?? null,
        hdr: videoStream?.hdr ?? null,
        dynamicRange: videoStream?.dynamicRange ?? null,
        colorTrc: videoStream?.colorTrc ?? null,
        displayTitle: videoStream?.displayTitle ?? null,
        extendedDisplayTitle: videoStream?.extendedDisplayTitle ?? null,
        aspectRatio: typeof inputs.media.aspectRatio === 'number' ? inputs.media.aspectRatio : null,
        width: inputs.media.width,
        height: inputs.media.height,
    });

    return {
        isDolbyVision,
        applyHdr10Fallback: fallback.apply,
        forceTranscodeForHdr10Fallback: fallback.apply && fallback.reason === 'force',
        forceHlsForDvNoHdr10BaseLayer,
        fallbackReason: fallback.reason,
    };
}

function isCommentaryStream(stream: PlexStream): boolean {
    const title = (stream.title || '').toLowerCase();
    return title.includes('commentary');
}

function findStream(streams: PlexStream[], streamType: 1 | 2 | 3): PlexStream | null {
    const ofType = streams.filter((s) => s.streamType === streamType);
    const defaultStream = ofType.find((s) => s.default);
    return defaultStream || ofType[0] || null;
}
