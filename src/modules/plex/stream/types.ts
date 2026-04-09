/**
 * @fileoverview Type definitions for Plex Stream Resolver module.
 * @module modules/plex/stream/types
 * @version 1.0.0
 */

import { AppErrorCode } from '../../../types/app-errors';
import type { PlexStream, PlexMediaPart, PlexMediaFile } from '../shared/types';

// ============================================
// Shared Types (repo-local)
// These types are maintained in-repo for runtime use.
// ============================================

/**
 * Plex media item types
 */
export type PlexMediaType = 'movie' | 'show' | 'episode' | 'track' | 'clip';

export type { PlexStream, PlexMediaPart, PlexMediaFile };

/**
 * A media item from Plex (movie, episode, etc.)
 */
export interface PlexMediaItem {
    /** Unique item ID (ratingKey) */
    ratingKey: string;
    /** API path to item details */
    key: string;
    /** Item type */
    type: PlexMediaType;
    /** Display title */
    title: string;
    /** Original title (for foreign films) */
    originalTitle?: string;
    /** Sort title */
    sortTitle: string;
    /** Plot summary */
    summary: string;
    /** Release year */
    year: number;
    /** Duration in milliseconds */
    durationMs: number;
    /** When item was added to library */
    addedAt: Date;
    /** Last metadata update time */
    updatedAt: Date;
    /** Poster image path */
    thumb: string | null;
    /** Background art path */
    art: string | null;
    /** Banner image path (TV shows) */
    banner?: string | null;
    /** Plex rating (0-10) */
    rating?: number;
    /** Audience rating (0-10) */
    audienceRating?: number;
    /** Content rating (e.g., "PG-13", "TV-MA") */
    contentRating?: string;
    /** Show name (for episodes) */
    grandparentTitle?: string;
    /** Season name (for episodes) */
    parentTitle?: string;
    /** Season number (1-based) */
    seasonNumber?: number;
    /** Episode number (1-based) */
    episodeNumber?: number;
    /** Resume position in ms (0 if not started) */
    viewOffset?: number;
    /** Number of times watched */
    viewCount?: number;
    /** Last watched time */
    lastViewedAt?: Date;
    /** Available media files/versions */
    media: PlexMediaFile[];
}

/**
 * Unified error codes
 */
export const PlexStreamErrorCode = {
    AUTH_REQUIRED: AppErrorCode.AUTH_REQUIRED,
    AUTH_EXPIRED: AppErrorCode.AUTH_EXPIRED,
    AUTH_INVALID: AppErrorCode.AUTH_INVALID,
    NETWORK_TIMEOUT: AppErrorCode.NETWORK_TIMEOUT,
    NETWORK_OFFLINE: AppErrorCode.NETWORK_OFFLINE,
    SERVER_UNREACHABLE: AppErrorCode.SERVER_UNREACHABLE,
    MIXED_CONTENT_BLOCKED: AppErrorCode.MIXED_CONTENT_BLOCKED,
    PLAYBACK_SOURCE_NOT_FOUND: AppErrorCode.PLAYBACK_SOURCE_NOT_FOUND,
    SUBTITLE_STREAM_NOT_FOUND: 'SUBTITLE_STREAM_NOT_FOUND',
    PLAYBACK_FORMAT_UNSUPPORTED: AppErrorCode.PLAYBACK_FORMAT_UNSUPPORTED,
    TRANSCODE_FAILED: AppErrorCode.TRANSCODE_FAILED,
    PARSE_ERROR: AppErrorCode.PARSE_ERROR,
    ITEM_NOT_FOUND: AppErrorCode.ITEM_NOT_FOUND,
    SERVER_ERROR: AppErrorCode.SERVER_ERROR,
    UNKNOWN: AppErrorCode.UNKNOWN,
} as const;

export type PlexStreamErrorCode = typeof PlexStreamErrorCode[keyof typeof PlexStreamErrorCode];

export function mapPlexStreamErrorCodeToAppErrorCode(
    code: PlexStreamErrorCode | string
): AppErrorCode {
    if (code === PlexStreamErrorCode.SUBTITLE_STREAM_NOT_FOUND) {
        // Keep user-facing error mapping consistent while enabling more precise internal branching.
        return AppErrorCode.PLAYBACK_SOURCE_NOT_FOUND;
    }
    switch (code) {
        case PlexStreamErrorCode.AUTH_REQUIRED:
        case PlexStreamErrorCode.AUTH_EXPIRED:
        case PlexStreamErrorCode.AUTH_INVALID:
        case PlexStreamErrorCode.NETWORK_TIMEOUT:
        case PlexStreamErrorCode.NETWORK_OFFLINE:
        case PlexStreamErrorCode.SERVER_UNREACHABLE:
        case PlexStreamErrorCode.MIXED_CONTENT_BLOCKED:
        case PlexStreamErrorCode.PLAYBACK_SOURCE_NOT_FOUND:
        case PlexStreamErrorCode.PLAYBACK_FORMAT_UNSUPPORTED:
        case PlexStreamErrorCode.TRANSCODE_FAILED:
        case PlexStreamErrorCode.PARSE_ERROR:
        case PlexStreamErrorCode.ITEM_NOT_FOUND:
        case PlexStreamErrorCode.SERVER_ERROR:
        case PlexStreamErrorCode.UNKNOWN:
            return code;
    }

    return AppErrorCode.UNKNOWN;
}

// ============================================
// Stream Resolution Types
// ============================================

/**
 * Request parameters for resolving a playback stream
 */
export interface StreamRequest {
    /** ratingKey of media item */
    itemKey: string;
    /** Specific part ID if multi-part */
    partId?: string;
    /** Resume position in ms */
    startOffsetMs?: number;
    /** Preferred audio track ID */
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
    /** Subtitle delivery override (burn-in forces transcoding). */
    subtitleMode?: 'none' | 'burn';
    /** Maximum bitrate in kbps */
    maxBitrate?: number;
    /** Prefer direct play (no transcoding) */
    directPlay?: boolean;
    /** Prefer direct stream (remux only) */
    directStream?: boolean;
}

/**
 * Resolved stream decision from Plex
 */
export interface StreamDecision {
    /** Final playback URL */
    playbackUrl: string;
    /** Stream protocol */
    protocol: 'hls' | 'dash' | 'http';
    /** true if playing original file directly */
    isDirectPlay: boolean;
    /** true if server is transcoding */
    isTranscoding: boolean;
    /** Container format */
    container: string;
    /** Video codec being delivered */
    videoCodec: string;
    /** Audio codec being delivered */
    audioCodec: string;
    /** How subtitles are delivered */
    subtitleDelivery: 'embed' | 'sidecar' | 'burn' | 'none';
    /** Plex session ID for tracking */
    sessionId: string;
    /** Selected media version index */
    mediaIndex: number;
    /** Selected part index */
    partIndex: number;
    /** Plex part key (useful for diagnostics and future subtitle extraction fallbacks) */
    partKey: string;
    /** Selected audio stream */
    selectedAudioStream: PlexStream | null;
    /** Selected subtitle stream */
    selectedSubtitleStream: PlexStream | null;
    /** Available audio streams for UI selection */
    availableAudioStreams?: PlexStream[];
    /** Available subtitle streams for UI selection */
    availableSubtitleStreams?: PlexStream[];
    /** Output video width */
    width: number;
    /** Output video height */
    height: number;
    /** Output bitrate in kbps */
    bitrate: number;

    // ========================================
    // Diagnostics (best-effort)
    // ========================================

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
