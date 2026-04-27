import type {
    PlexStreamErrorCode,
    PlexMediaItem,
    StreamRequest,
    StreamDecision,
    HlsOptions,
} from './types';
import type { PlatformIdentityService } from '../../../platform';

/**
 * Stream resolver error structure.
 * Uses PlexStreamErrorCode for stream resolver errors.
 */
export type StreamResolverErrorStage =
    | 'media_selection'
    | 'burn_in_selected_part';

export interface StreamResolverError {
    /** Error code from stream resolver taxonomy */
    code: PlexStreamErrorCode;
    /** Human-readable error message */
    message: string;
    /** Whether recovery might succeed */
    recoverable: boolean;
    /** Milliseconds to wait before retry (if retryable) */
    retryAfterMs?: number;
    /**
     * Optional: disambiguates where `resolveStream()` failed.
     * Primarily used for diagnostics when a single error code can be thrown from multiple stages.
     */
    stage?: StreamResolverErrorStage;
}

/**
 * Event map for PlexStreamResolver events.
 */
export interface StreamResolverEventMap {
    error: StreamResolverError;
    /** Index signature for EventEmitter compatibility */
    [key: string]: StreamResolverError;
}

/**
 * Configuration for PlexStreamResolver.
 */
export interface PlexStreamDebugOverridesReader {
    readTranscodeProfileNameAndClean(): string | null;
}

export interface PlexStreamResolverConfig {
    /** Function to get auth headers for Plex API requests */
    getAuthHeaders: () => Record<string, string>;
    /** Function to get current server URI */
    getServerUri: () => string | null;
    /**
     * Optional: Function to get the currently selected server connection metadata.
     * Used to classify transcode requests as LAN vs WAN when possible.
     */
    getSelectedConnection?: () => { uri: string; local: boolean; relay: boolean } | null;
    /** Function to get an HTTPS connection (for mixed content fallback) */
    getHttpsConnection: () => { uri: string } | null;
    /** Function to get a relay connection (for mixed content fallback) */
    getRelayConnection: () => { uri: string } | null;
    /** Function to get a media item by ratingKey */
    getItem: (ratingKey: string) => Promise<PlexMediaItem | null>;
    /** Client identifier for session tracking */
    clientIdentifier: string;
    /** Debug override reader seam for profile-name injection */
    debugOverridesStore: PlexStreamDebugOverridesReader;
    /** Optional platform identity abstraction */
    identityService?: PlatformIdentityService;
}

/**
 * Plex Stream Resolver Interface.
 * Resolves playback URLs and manages playback sessions.
 */
export interface IPlexStreamResolver {
    /**
     * Resolve the best stream URL for a media item.
     * Determines direct play vs transcoding based on codec compatibility.
     * @param request - Stream request parameters
     * @returns Promise resolving to stream decision
     * @throws StreamResolverError on failure
     */
    resolveStream(request: StreamRequest): Promise<StreamDecision>;

    /**
     * Best-effort: stop an active transcode session without reporting progress.
     * @param sessionId - Plex transcode session identifier
     */
    stopTranscodeSession(sessionId: string): Promise<void>;

    /**
     * Check if a media item can be played directly without transcoding.
     * @param item - Media item to check
     * @returns true if direct play is supported
     */
    canDirectPlay(item: PlexMediaItem): boolean;

    /**
     * Generate an HLS transcode URL for a media item.
     * @param itemKey - ratingKey of the media item
     * @param options - HLS transcoding options (required per SSOT)
     * @returns Full transcode URL
     * @throws StreamResolverError synchronously when a transcode URL cannot be built.
     */
    getTranscodeUrl(itemKey: string, options: HlsOptions): string;

    /**
     * Fetch Plex's "universal transcode decision" response for a session.
     * This is a best-effort diagnostic helper to show whether PMS is copying
     * video (Direct Stream) vs transcoding video/audio.
     */
    fetchUniversalTranscodeDecision(
        itemKey: string,
        request: NonNullable<StreamDecision['transcodeRequest']>
    ): Promise<NonNullable<StreamDecision['serverDecision']>>;

    on<K extends keyof StreamResolverEventMap>(
        event: K,
        handler: (payload: StreamResolverEventMap[K]) => void
    ): void;

    off<K extends keyof StreamResolverEventMap>(
        event: K,
        handler: (payload: StreamResolverEventMap[K]) => void
    ): void;
}
