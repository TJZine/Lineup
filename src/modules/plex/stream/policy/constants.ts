export {
    BASELINE_WEBOS_AUDIO_CODECS as SUPPORTED_AUDIO_CODECS,
} from '../../../../shared/audioCodecSupport';

// webOS Codec Support (MAJOR-002)

/**
 * Supported container formats for direct play on webOS.
 * All containers listed here can be played natively.
 * Strictly limited to formats with high native compatibility assurance.
 * Usage of legacy containers (AVI, WMV) generally triggers transcoding.
 */
export const SUPPORTED_CONTAINERS: readonly string[] = [
    'mp4',
    'm4v',
    'mkv',
    'ts',    // MPEG-TS
    'm2ts',  // MPEG-TS
    'mov',   // QuickTime
] as const;

/**
 * Supported video codecs for direct play on webOS.
 * Includes both canonical and alias names.
 */
export const SUPPORTED_VIDEO_CODECS: readonly string[] = [
    'h264',
    'avc',      // Alias for H.264
    'hevc',
    'h265',     // Alias for HEVC
    'vp9',      // Supported in modern webOS (MP4/MKV/WebM)
    'mpeg2video',
    'av1',      // Supported in webOS 22+
] as const;

/**
 * Maximum supported resolution for direct play.
 */
export const MAX_RESOLUTION = {
    width: 3840,
    height: 2160,
} as const;

// Subtitle Formats

// Re-export from shared module so Plex stream policy code and its tests can import from a single
// local boundary (`modules/plex/stream/constants`) instead of reaching into shared internals.
export {
    BURN_IN_SUBTITLE_FORMATS,
    isTextSubtitleFormat,
    TEXT_SUBTITLE_FORMATS,
} from '../../../../shared/subtitle-formats';

// Client Profile

/**
 * Default HLS options when not specified.
 */
export const DEFAULT_HLS_OPTIONS = {
    subtitleSize: 100,
    audioBoost: 100,
} as const;

// MIME Types

/**
 * MIME type mapping for stream protocols and containers.
 * Uses official IANA types where possible and robust defaults for native players.
 */
export const MIME_TYPES: Record<string, string> = {
    // Protocols
    hls: 'application/vnd.apple.mpegurl', // Preferred for native players

    // Video Containers
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    mkv: 'video/x-matroska',
    ts: 'video/mp2t',
    m2ts: 'video/mp2t',
    mov: 'video/quicktime',
    webm: 'video/webm',

    // Audio Containers
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    flac: 'audio/flac',
    aac: 'audio/aac',

    // Fallback
    direct: 'video/mp4',
    http: 'video/mp4',
} as const;
