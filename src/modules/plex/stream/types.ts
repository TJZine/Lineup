import { AppErrorCode, getAppErrorCode } from '../../../types/app-errors';
import type { PlexStream, PlexMediaPart, PlexMediaFile, PlexMediaType } from '../shared/types';

export type { PlexStream, PlexMediaPart, PlexMediaFile, PlexMediaType };

export interface PlexStreamMediaItem {
    ratingKey: string;
    key: string;
    type: PlexMediaType;
    title: string;
    originalTitle?: string;
    sortTitle: string;
    summary: string;
    year: number;
    durationMs: number;
    addedAt: Date;
    updatedAt: Date;
    thumb: string | null;
    art: string | null;
    banner?: string | null;
    rating?: number;
    audienceRating?: number;
    contentRating?: string;
    grandparentTitle?: string;
    parentTitle?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    viewOffset?: number;
    viewCount?: number;
    lastViewedAt?: Date;
    media: PlexMediaFile[];
}

export const PlexStreamErrorCode = {
    SUBTITLE_STREAM_NOT_FOUND: 'SUBTITLE_STREAM_NOT_FOUND',
} as const;

export type PlexStreamLocalErrorCode = typeof PlexStreamErrorCode[keyof typeof PlexStreamErrorCode];
export type PlexStreamErrorCode = AppErrorCode | PlexStreamLocalErrorCode;

export function mapPlexStreamErrorCodeToAppErrorCode(
    code: unknown
): AppErrorCode {
    if (code === PlexStreamErrorCode.SUBTITLE_STREAM_NOT_FOUND) {
        // Keep user-facing error mapping consistent while enabling more precise internal branching.
        return AppErrorCode.PLAYBACK_SOURCE_NOT_FOUND;
    }

    return getAppErrorCode(code) ?? AppErrorCode.UNKNOWN;
}

export interface StreamRequest {
    itemKey: string;
    partId?: string;
    startOffsetMs?: number;
    audioStreamId?: string;
    /**
     * Preferred subtitle track ID (used for out-of-band extraction/fetching; does not imply burn-in).
     *
     * Contract: when provided, Lineup treats this as strict. If no media version/part contains the
     * requested subtitle stream id, `PlexStreamResolver.resolveStream()` throws
     * `PlexStreamErrorCode.SUBTITLE_STREAM_NOT_FOUND` (instead of silently dropping the request).
     *
     * Burn-in is only requested when `subtitleMode === 'burn'` or the selected subtitle format requires it.
     */
    subtitleStreamId?: string;
    subtitleMode?: 'none' | 'burn';
    maxBitrate?: number;
    directPlay?: boolean;
    directStream?: boolean;
}

export interface StreamDecision {
    playbackUrl: string;
    /** Resolved Plex base origin used to build playback URLs for this decision. */
    resolvedBaseUrl?: string;
    protocol: 'hls' | 'dash' | 'http';
    isDirectPlay: boolean;
    isTranscoding: boolean;
    container: string;
    videoCodec: string;
    audioCodec: string;
    subtitleDelivery: 'embed' | 'sidecar' | 'burn' | 'none';
    sessionId: string;
    mediaIndex: number;
    partIndex: number;
    /** Plex part key (useful for diagnostics and future subtitle extraction fallbacks) */
    partKey: string;
    selectedAudioStream: PlexStream | null;
    selectedSubtitleStream: PlexStream | null;
    availableAudioStreams?: PlexStream[];
    availableSubtitleStreams?: PlexStream[];
    width: number;
    height: number;
    bitrate: number;


    /**
     * Summary of the selected source media version (before any server-side transcode/remux).
     * This is what Lineup evaluated for direct play capability.
     */
    source?: {
        container: string;
        videoCodec: string;
        audioCodec: string;
        width: number;
        height: number;
        bitrate: number;
        hdr?: string;
        dynamicRange?: string;
        doviPresent?: boolean;
        doviProfile?: string;
    };

    /**
     * Lineup's local direct-play eligibility decision for the selected media version.
     * If `allowed` is false, `reasons` explains which constraint blocked direct play.
     */
    directPlay?: {
        allowed: boolean;
        reasons: string[];
    };

    /**
     * When the default Plex audio track is TrueHD/MLP, Lineup will prefer an AC3/EAC3/AAC
     * fallback track (non-commentary) if available. This records that selection.
     */
    audioFallback?: {
        fromCodec: string;
        toCodec: string;
        reason: string;
    };

    /**
     * Parameters Lineup used when requesting an HLS session (transcode or direct-stream).
     * Note: Plex may still decide to direct-stream video while transcoding only audio.
     */
    transcodeRequest?: StreamDecisionTranscodeRequest;

    /**
     * Parsed response from Plex's universal transcode decision endpoint (if fetched).
     * Useful for showing what PMS actually decided (video vs audio transcode).
     */
    serverDecision?: {
        fetchedAt: number;
        videoDecision?: string;
        audioDecision?: string;
        subtitleDecision?: string;
        decisionCode?: string;
        decisionText?: string;
    };
}

export type StreamDecisionTranscodeRequest = {
    sessionId: string;
    maxBitrate: number;
    mediaIndex?: number;
    partIndex?: number;
    audioStreamId?: string;
    hideDolbyVision?: true;
} & (
    | {
        subtitleStreamId?: undefined;
        subtitleMode?: undefined;
    }
    | {
        subtitleStreamId: string;
        subtitleMode: 'burn';
    }
);

/**
 * HLS stream options
 */
export interface HlsOptions {
    /** Maximum bitrate in kbps */
    maxBitrate?: number;
    /** Subtitle size (100 = normal) */
    subtitleSize?: number;
    /** Audio boost percentage */
    audioBoost?: number;
    /** Preferred audio stream ID (Plex stream id) */
    audioStreamId?: string;
    /** Subtitle stream to burn-in when transcoding */
    subtitleStreamId?: string;
    /** Subtitle mode for the transcode session */
    subtitleMode?: 'none' | 'burn';
    /** Selected media index (for multi-version items) */
    mediaIndex?: number;
    /** Selected part index (for multi-part items) */
    partIndex?: number;
    /**
     * Optional Plex session identifier to bind the transcode session to.
     * When provided, `getTranscodeUrl()` will use this value for both
     * `session` and `X-Plex-Session-Identifier` query params.
     */
    sessionId?: string;
    /** When true, omit Dolby Vision decoder profiles from X-Plex-Client-Capabilities (capability hiding). */
    hideDolbyVision?: boolean;
}
