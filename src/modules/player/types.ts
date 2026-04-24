import { AppErrorCode } from '../../types/app-errors';

interface PlayerError {
    code: AppErrorCode;
    message: string;
    recoverable: boolean;
    context?: Record<string, unknown>;
}

export interface VideoPlayerConfig {
    containerId: string;
    defaultVolume: number;
    bufferAheadMs: number;
    seekIncrementSec: number;
    hideControlsAfterMs: number;
    retryAttempts: number;
    retryDelayMs: number;
}

export interface MediaMetadata {
    title: string;
    subtitle?: string;
    durationMs: number;
    thumb?: string;
    year?: number;
    contentRating?: string;
}

export interface TimeRange {
    startMs: number;
    endMs: number;
}

export interface SubtitleTrack {
    id: string;
    label: string;
    languageCode: string;
    language: string;
    codec: string;
    format: string;
    key?: string;
    default?: boolean;
    forced?: boolean;
    isTextCandidate: boolean;
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
    id: string;
    title: string;
    languageCode: string;
    language: string;
    codec: string;
    channels: number;
    index: number;
    default?: boolean;
}

export interface StreamDescriptor {
    url: string;
    protocol: 'hls' | 'dash' | 'direct';
    mimeType: string;
    startPositionMs: number;
    mediaMetadata: MediaMetadata;
    subtitleTracks: SubtitleTrack[];
    audioTracks: AudioTrack[];
    subtitleContext?: {
        serverUri: string | null;
        resolvedBaseUrl?: string;
        authHeaders: Record<string, string>;
        itemKey?: string;
        mediaIndex?: number;
        partIndex?: number;
        partKey?: string;
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
    preferredSubtitleTrackId?: string | null;
    durationMs: number;
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
    status: PlayerStatus;
    currentTimeMs: number;
    durationMs: number;
    bufferPercent: number;
    volume: number;
    isMuted: boolean;
    playbackRate: number;
    activeSubtitleId: string | null;
    activeAudioId: string | null;
    errorInfo: PlaybackError | null;
}

export interface PlaybackError extends PlayerError {
    retryCount: number;
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
    status: PlayerStatus;
    currentTimeMs: number;
    durationMs: number;
    bufferPercent: number;
    volume: number;
    isMuted: boolean;
    playbackRate: number;
    activeSubtitleId: string | null;
    activeAudioId: string | null;
    errorInfo: PlaybackError | null;
    currentDescriptor: StreamDescriptor | null;
}
