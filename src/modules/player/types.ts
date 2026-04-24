import { AppErrorCode } from '../../types/app-errors';

interface PlayerError {
    /** Canonical playback error code. */
    code: AppErrorCode;
    /** Technical error message */
    message: string;
    /** Whether recovery might succeed */
    recoverable: boolean;
    /** Additional context for debugging */
    context?: Record<string, unknown>;
}

export interface VideoPlayerConfig {
    /** Container element ID to append video element */
    containerId: string;
    /** Default volume level (0.0 to 1.0) */
    defaultVolume: number;
    /** Buffer ahead target in milliseconds */
    bufferAheadMs: number;
    /** Seek increment in seconds for relative seek */
    seekIncrementSec: number;
    /** Time in ms before hiding controls */
    hideControlsAfterMs: number;
    /** Maximum retry attempts for recoverable errors */
    retryAttempts: number;
    /** Base delay between retries in milliseconds */
    retryDelayMs: number;
}

export interface MediaMetadata {
    /** Media title */
    title: string;
    /** Media subtitle (e.g., episode name) */
    subtitle?: string;
    /** Duration in milliseconds */
    durationMs: number;
    /** Thumbnail URL */
    thumb?: string;
    /** Release year */
    year?: number;
    /** Content rating (e.g., "PG-13") */
    contentRating?: string;
}

export interface TimeRange {
    /** Start time in milliseconds */
    startMs: number;
    /** End time in milliseconds */
    endMs: number;
}

export interface SubtitleTrack {
    /** Unique track identifier */
    id: string;
    /** Display label for UI */
    label: string;
    /** Language code (e.g., "en") */
    languageCode: string;
    /** Language name (e.g., "English") */
    language: string;
    /** Subtitle codec (e.g., "srt") */
    codec: string;
    /** Subtitle format (srt, vtt, pgs, ass) */
    format: string;
    /** Plex subtitle stream key (relative or absolute) */
    key?: string;
    /** Whether this is the default track */
    default?: boolean;
    /** Whether these are forced subtitles */
    forced?: boolean;
    /** True when codec is a supported text format */
    isTextCandidate: boolean;
    /** True when a key-backed subtitle stream can be fetched */
    fetchableViaKey: boolean;
}

export type SubtitleFallbackUnsupportedReason =
    | 'missing_context'
    | 'invalid_url'
    | 'invalid_source'
    | 'not_found'
    | 'client_error';

export type SubtitleFallbackTransientReason =
    | 'timeout'
    | 'network_error'
    | 'server_error'
    | 'unknown_error';

export type SubtitleFallbackAuthReason = 'unauthorized' | 'forbidden';

export type SubtitleFallbackResult =
    | { kind: 'success'; vtt: string }
    | { kind: 'stale' }
    | { kind: 'unsupported'; reason: SubtitleFallbackUnsupportedReason; status?: number }
    | { kind: 'transient'; reason: SubtitleFallbackTransientReason; status?: number }
    | { kind: 'auth'; reason: SubtitleFallbackAuthReason; status: 401 | 403 };

export type SubtitleExtractabilityProbeResult =
    | 'supported'
    | 'unsupported'
    | 'transient_failure'
    | 'auth_failure'
    | 'unknown';

export interface AudioTrack {
    /** Unique track identifier */
    id: string;
    /** Human-readable title */
    title: string;
    /** Language code (e.g., "en") */
    languageCode: string;
    /** Language name (e.g., "English") */
    language: string;
    /** Audio codec (e.g., "aac") */
    codec: string;
    /** Number of audio channels */
    channels: number;
    /** Track index in the media */
    index: number;
    /** Whether this is the default track */
    default?: boolean;
}

export interface StreamDescriptor {
    /** Playback URL */
    url: string;
    /** Stream protocol */
    protocol: 'hls' | 'dash' | 'direct';
    /** MIME type for the stream */
    mimeType: string;
    /** Start position in milliseconds */
    startPositionMs: number;
    /** Media metadata for display */
    mediaMetadata: MediaMetadata;
    /** Available subtitle tracks */
    subtitleTracks: SubtitleTrack[];
    /** Available audio tracks */
    audioTracks: AudioTrack[];
    /** Subtitle fetch context (for fallback) */
    subtitleContext?: {
        serverUri: string | null;
        resolvedBaseUrl?: string;
        authHeaders: Record<string, string>;
        /** ratingKey for the media item (used for PMS subtitle transcode fallback) */
        itemKey?: string;
        /** Selected media version index (used for PMS subtitle transcode fallback) */
        mediaIndex?: number;
        /** Selected part index (used for PMS subtitle transcode fallback) */
        partIndex?: number;
        /** Plex part key (diagnostics / future-proofing) */
        partKey?: string;
        /** Playback session identifier (used for PMS subtitle transcode fallback) */
        sessionId?: string;
        /**
         * When a stream is playing with subtitles burned into the video, this records which subtitle track
         * triggered the burn-in request so the player does not attempt slow extract-based rendering for it.
         */
        burnedInSubtitleTrackId?: string | null;
        onUnavailable?: () => void;
        /**
         * Called when the selected subtitle track is deactivated due to failure.
         * Return true if the failure was handled (e.g., a recovery path was triggered) to suppress
         * the generic "unavailable" toast.
         */
        onDeactivate?: (args: { trackId: string; reason: string }) => boolean;
        /**
         * Runs the async recovery flow after a handled subtitle deactivation.
         * Return `'failed'` to surface the generic unavailable warning.
         */
        onDeactivateRecovery?: (args: {
            trackId: string;
            reason: string;
        }) => Promise<'handled' | 'failed'>;
    };
    /** Preferred subtitle track ID (default selection) */
    preferredSubtitleTrackId?: string | null;
    /** Total duration in milliseconds */
    durationMs: number;
    /** Whether this is a live stream */
    isLive: boolean;
}

export type PlayerStatus =
    | 'idle'
    | 'loading'
    | 'buffering'
    | 'playing'
    | 'paused'
    | 'seeking'
    | 'ended'
    | 'error';

export interface PlaybackState {
    /** Current player status */
    status: PlayerStatus;
    /** Current playback position in milliseconds */
    currentTimeMs: number;
    /** Total duration in milliseconds */
    durationMs: number;
    /** Buffer percentage (0-100) */
    bufferPercent: number;
    /** Current volume (0.0 to 1.0) */
    volume: number;
    /** Whether audio is muted */
    isMuted: boolean;
    /** Playback rate (1.0 = normal) */
    playbackRate: number;
    /** ID of active subtitle track, null if disabled */
    activeSubtitleId: string | null;
    /** ID of active audio track */
    activeAudioId: string | null;
    /** Error info if status is 'error' */
    errorInfo: PlaybackError | null;
}

export interface PlaybackError extends PlayerError {
    /** Number of retry attempts made */
    retryCount: number;
    /** Suggested delay before retry in milliseconds */
    retryAfterMs?: number;
}

/** Index signature required for EventEmitter<TEventMap extends Record<string, unknown>> constraint. */
export interface PlayerEventMap {
    /** Emitted on any state change */
    stateChange: PlaybackState;
    /** Emitted every ~250ms during playback */
    timeUpdate: { currentTimeMs: number; durationMs: number };
    /** Emitted when buffer level changes */
    bufferUpdate: { percent: number; bufferedRanges: TimeRange[] };
    /** Emitted when audio or subtitle track changes */
    trackChange: { type: 'audio' | 'subtitle'; trackId: string | null };
    /** Emitted when playback reaches the end */
    ended: undefined;
    /** Emitted on unrecoverable error */
    error: PlaybackError;
    /** Emitted when media metadata is loaded */
    mediaLoaded: { durationMs: number; tracks: { audio: AudioTrack[]; subtitle: SubtitleTrack[] } };
    /** Index signature for EventEmitter compatibility */
    [key: string]: unknown;
}

export interface VideoPlayerInternalState {
    /** Current player status */
    status: PlayerStatus;
    /** Current playback position in milliseconds */
    currentTimeMs: number;
    /** Total duration in milliseconds */
    durationMs: number;
    /** Buffer percentage (0-100) */
    bufferPercent: number;
    /** Current volume (0.0 to 1.0) */
    volume: number;
    /** Whether audio is muted */
    isMuted: boolean;
    /** Playback rate (1.0 = normal) */
    playbackRate: number;
    /** ID of active subtitle track */
    activeSubtitleId: string | null;
    /** ID of active audio track */
    activeAudioId: string | null;
    /** Current error info */
    errorInfo: PlaybackError | null;
    /** Currently loaded stream descriptor */
    currentDescriptor: StreamDescriptor | null;
}
