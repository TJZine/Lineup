import type {
    PlexStreamErrorCode,
    PlexStreamMediaItem,
    StreamRequest,
    StreamDecision,
    HlsOptions,
} from './types';
import type { TranscodeQualityOption } from '../../../../config/transcodeQuality';
import type { PlatformIdentityService } from '../../../../platform';
import type { IDisposable } from '../../../../utils/interfaces';
import type { Hdr10FallbackMode } from '../../../settings/PlaybackSettingsStore';

export type StreamResolverErrorStage =
    | 'media_selection'
    | 'burn_in_selected_part';

export interface StreamResolverError {
    code: PlexStreamErrorCode;
    message: string;
    recoverable: boolean;
    retryAfterMs?: number;
    /**
     * Optional: disambiguates where `resolveStream()` failed.
     * Primarily used for diagnostics when a single error code can be thrown from multiple stages.
     */
    stage?: StreamResolverErrorStage;
}

export interface StreamResolverEventMap {
    error: StreamResolverError;
}

export interface PlexStreamDebugOverridesReader {
    readTranscodeProfileNameAndClean(): string | null;
}

export interface PlexStreamAudioPolicyReader {
    readDirectPlayAudioFallbackEnabledAndClean(): boolean;
    readDtsPassthroughEnabledAndClean(fallback?: boolean): boolean;
}

export interface PlexStreamPlaybackPolicyReader {
    readHdr10FallbackModeAndClean(): Hdr10FallbackMode;
    readTranscodeCompatEnabledAndClean(fallback?: boolean): boolean;
    readTranscodeQualityOptionAndClean(): TranscodeQualityOption | null;
}

export interface PlexStreamDebugPolicyReader {
    readDebugLoggingEnabledAndClean(fallback?: boolean): boolean;
}

export interface PlexStreamSubtitleDebugPolicyReader {
    readSubtitleDebugLoggingEnabledAndClean(fallback?: boolean): boolean;
}

export type PlexStreamSubtitleDebugLogContext = Record<string, unknown>;

export interface PlexStreamSubtitleDebugLogPort {
    isEnabled(): boolean;
    log(
        event: string,
        context: PlexStreamSubtitleDebugLogContext | (() => PlexStreamSubtitleDebugLogContext)
    ): void;
}

export type PlexStreamSelectedServerAccessTokenRefreshResult =
    | { kind: 'updated' }
    | { kind: 'unchanged' }
    | { kind: 'selected_server_unavailable' };

export type PlexStreamCurrentCredentialValidity =
    | { kind: 'active_valid' }
    | { kind: 'managed_profile_invalid'; accountValid: true }
    | { kind: 'account_expired' }
    | { kind: 'superseded' };

export interface PlexStreamResolverConfig {
    getAuthHeaders: () => Record<string, string>;
    getServerUri: () => string | null;
    refreshSelectedServerAccessToken: (
        expectedAccessToken: string
    ) => Promise<PlexStreamSelectedServerAccessTokenRefreshResult>;
    probeCurrentCredentialValidity: () => Promise<PlexStreamCurrentCredentialValidity>;
    captureSelectedServerScope: () => object | null;
    assertSelectedServerScopeCurrent: (scope: object) => void;
    /**
     * Optional: Function to get the currently selected server connection metadata.
     * Used to classify transcode requests as LAN vs WAN when possible.
     */
    getSelectedConnection?: () => { uri: string; local: boolean; relay: boolean } | null;
    getHttpsConnection: () => { uri: string } | null;
    getRelayConnection: () => { uri: string } | null;
    getItem: (ratingKey: string) => Promise<PlexStreamMediaItem | null>;
    /** Client identifier for Plex session tracking */
    clientIdentifier: string;
    audioPolicyReader: PlexStreamAudioPolicyReader;
    playbackPolicyReader: PlexStreamPlaybackPolicyReader;
    debugPolicyReader: PlexStreamDebugPolicyReader;
    subtitleDebugPolicyReader: PlexStreamSubtitleDebugPolicyReader;
    debugOverridesReader: PlexStreamDebugOverridesReader;
    subtitleDebugLogPort: PlexStreamSubtitleDebugLogPort;
    identityService?: PlatformIdentityService;
}

export interface IPlexStreamResolver {
    /**
     * Resolve the best stream URL for a media item.
     * Determines direct play vs transcoding based on codec compatibility.
     * @throws StreamResolverError on failure
     */
    resolveStream(request: StreamRequest): Promise<StreamDecision>;

    /**
     * Best-effort: stop an active transcode session without reporting progress.
     */
    stopTranscodeSession(sessionId: string): Promise<void>;

    /**
     * Check if a media item can be played directly without transcoding.
     */
    canDirectPlay(item: PlexStreamMediaItem): boolean;

    /**
     * Generate an HLS transcode URL for a media item.
     * @param options - HLS transcoding options (required per SSOT)
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
    ): IDisposable;

    off<K extends keyof StreamResolverEventMap>(
        event: K,
        handler: (payload: StreamResolverEventMap[K]) => void
    ): void;
}
