import { EventEmitter } from '../../../../utils/EventEmitter';
import { AppErrorCode } from '../../../../types/app-errors';
import type { Hdr10FallbackMode } from '../../../settings/PlaybackSettingsStore';
import type { IDisposable } from '../../../../utils/interfaces';
import type {
    IPlexStreamResolver,
    PlexStreamResolverConfig,
    StreamResolverError,
    StreamResolverEventMap,
} from '../contracts/interfaces';
import type {
    PlexStreamMediaItem,
    StreamRequest,
    StreamDecision,
    HlsOptions,
} from '../contracts/types';
import { generatePlexSessionId } from './plexSessionId';
import { summarizeErrorForLog } from '../../../../utils/errors';
import {
    getDirectPlayDecision,
} from '../policy/playbackCompatibilityPolicy';
import type { PlaybackCapabilityProfile } from '../capabilities/PlaybackCapabilityProfile';
import {
    createBrowserPlaybackCapabilityProfile,
    getBrowserChromeMajor,
} from '../capabilities/PlaybackCapabilityProfile';
import { fetchWithTimeout } from '../../shared/fetchWithTimeout';
import { detectHdrLabel } from '../policy/hdr';
import type { PlatformIdentityService } from '../../../../platform';
import { createPlatformIdentityService } from '../../../../platform';
import { resolveStreamPipeline } from '../pipeline/resolveStreamPipeline';
import type { TranscodeUrlResolution } from '../pipeline/resolveStreamPipeline';
import {
    applyXPlexQueryParamsFromHeaders,
    applyXPlexTokenQueryParam,
    buildPlexUrlFromKey,
    PLEX_TOKEN_QUERY_PARAM,
} from '../../shared/plexUrl';
import {
    buildPlexClientCapabilities,
    buildPlexMetadataPath,
    buildPlexTranscodeStartUrl,
} from '../url/plexStreamUrlPolicy';
import { logPlexWarning } from '../../shared/plexLogging';
import { SubtitleStreamDebugProbeCoordinator } from '../diagnostics/SubtitleStreamDebugProbeCoordinator';
import { applyServerDecisionToStreamDecision, UniversalTranscodeDecisionClient } from '../diagnostics/UniversalTranscodeDecisionClient';
import { updatePlexPartSubtitleSelection } from './PlexPartSubtitleSelector';
import { selectBestMedia } from '../policy/mediaSelectionPolicy';

// Re-export types for consumers
export { PlexStreamErrorCode } from '../contracts/types';

export class PlexStreamResolver implements IPlexStreamResolver {
    private readonly _config: PlexStreamResolverConfig;
    private readonly _emitter: EventEmitter<StreamResolverEventMap>;
    private readonly _identityService: PlatformIdentityService;
    private readonly _subtitleDebugProbeCoordinator: SubtitleStreamDebugProbeCoordinator;
    private readonly _universalTranscodeDecisionClient: UniversalTranscodeDecisionClient;

    constructor(config: PlexStreamResolverConfig) {
        this._config = config;
        this._emitter = new EventEmitter<StreamResolverEventMap>();
        this._identityService = config.identityService ?? createPlatformIdentityService();
        this._subtitleDebugProbeCoordinator = new SubtitleStreamDebugProbeCoordinator({
            getServerUri: config.getServerUri,
            getAuthHeaders: config.getAuthHeaders,
            subtitleDebugLogPort: config.subtitleDebugLogPort,
        });
        this._universalTranscodeDecisionClient = new UniversalTranscodeDecisionClient({
            getAuthHeaders: config.getAuthHeaders,
            getTranscodeUrl: (itemKey, options): string => this.getTranscodeUrl(itemKey, options),
            throwIfAuthFailure: (response): void => this._throwIfAuthFailure(response, false),
        });
    }

    private _isDtsPassthroughEnabled(): boolean {
        try {
            const userEnabled = this._config.audioPolicyReader.readDtsPassthroughEnabledAndClean(false);
            const chromeMajor = getBrowserChromeMajor();
            return userEnabled && chromeMajor !== null && chromeMajor >= 108;
        } catch {
            return false;
        }
    }

    private _isWebOs(): boolean {
        return this._identityService.isWebOs();
    }

    private _applyDefaultIdentityParams(params: URLSearchParams): void {
        const defaults = this._identityService.getDefaultPlexIdentity(this._config.clientIdentifier);
        for (const [key, value] of Object.entries(defaults)) {
            if (!params.has(key)) {
                params.set(key, value);
            }
        }
    }

    /**
     * Resolve the best stream URL for a media item.
     * @param request - Stream request parameters
     * @returns Promise resolving to stream decision
     */
    async resolveStream(request: StreamRequest): Promise<StreamDecision> {
        const item = await this._config.getItem(request.itemKey);
        if (!item) {
            throw this._createError(
                AppErrorCode.ITEM_NOT_FOUND,
                `Item not found: ${request.itemKey}`,
                false
            );
        }

        const sessionId = generatePlexSessionId();
        const allowDirectPlayAudioFallback = this._config.audioPolicyReader.readDirectPlayAudioFallbackEnabledAndClean();
        const capabilityProfile = this._createPlaybackCapabilityProfile();
        const hdr10FallbackMode = this._getHdr10FallbackMode();
        const debugEnabled = this._isDebugLoggingEnabled();

        const pipeline = resolveStreamPipeline({
            item,
            request,
            sessionId,
            allowDirectPlayAudioFallback,
            capabilityProfile,
            hdr10FallbackMode,
            createError: (
                code,
                message,
                recoverable,
                retryAfterMs,
                stage
            ) => this._createError(code, message, recoverable, retryAfterMs, stage),
            buildDirectPlayUrl: (
                partKey,
                pipelineSessionId,
                directPlayAudioStreamId,
                applyHdr10Fallback
            ) => this._buildDirectPlayUrl(
                partKey,
                pipelineSessionId,
                directPlayAudioStreamId,
                applyHdr10Fallback,
                capabilityProfile
            ),
            getTranscodeUrl: (itemKey, options) => this._buildTranscodeUrlWithProfile(itemKey, options, capabilityProfile),
        });

        return this._finalizeResolvedStreamDecision({ request, pipeline, debugEnabled });
    }

    private async _finalizeResolvedStreamDecision(input: {
        request: StreamRequest;
        pipeline: ReturnType<typeof resolveStreamPipeline>;
        debugEnabled: boolean;
    }): Promise<StreamDecision> {
        const { request, pipeline, debugEnabled } = input;
        const {
            decision,
            media,
            videoStream,
            subtitleStream,
            availableSubtitleStreams,
        } = pipeline;

        this._subtitleDebugProbeCoordinator.scheduleDebugProbes({
            itemKey: request.itemKey,
            selectedSubtitleStream: subtitleStream ?? null,
            availableSubtitleStreams,
        });

        if (debugEnabled && pipeline.hdrFallbackReason) {
            logPlexWarning('HDR10 fallback applied:', {
                itemKey: request.itemKey,
                reason: pipeline.hdrFallbackReason,
                debugWhy: decision.hdr10Fallback?.debugWhy,
                hideDolbyVision: decision.hdr10Fallback?.hideDolbyVision === true,
                forcedHls: decision.hdr10Fallback?.forcedHls === true,
                container: media.container,
                isDolbyVision: videoStream?.doviPresent === true,
            });
        }

        const hdrLabel = decision.source?.hdr || detectHdrLabel(videoStream);
        if (hdrLabel && decision.source && !decision.source.hdr) {
            decision.source.hdr = hdrLabel;
        }

        const burnInSubtitleStreamId =
            decision.transcodeRequest?.subtitleMode === 'burn' &&
            typeof decision.transcodeRequest.subtitleStreamId === 'string'
                ? decision.transcodeRequest.subtitleStreamId
                : null;
        const mustPersistBurnInSelection =
            decision.subtitleBurnIn?.requested === true &&
            burnInSubtitleStreamId !== null;
        const shouldClearPartSubtitleSelection = request.subtitleMode === 'none';
        const updatePartSubtitleSelection = (subtitleStreamId: string | null): Promise<void> =>
            updatePlexPartSubtitleSelection({
                partId: pipeline.part.id,
                subtitleStreamId,
                getServerUri: this._config.getServerUri,
                getAuthHeaders: this._config.getAuthHeaders,
                selectBaseUriForMixedContent: (serverUri) => this._selectBaseUriForMixedContent(serverUri),
                throwIfAuthFailure: (response) => this._throwIfAuthFailure(response),
                createError: (code, message, recoverable) => this._createError(code, message, recoverable),
            });
        if (mustPersistBurnInSelection) {
            await updatePartSubtitleSelection(burnInSubtitleStreamId);
        } else if (shouldClearPartSubtitleSelection) {
            void updatePartSubtitleSelection(null).catch((error: unknown) => {
                logPlexWarning('Failed to clear PMS part subtitle selection:', {
                    itemKey: request.itemKey,
                    partId: pipeline.part.id,
                    error: summarizeErrorForLog(error),
                });
            });
        }

        // Ask PMS why it chose to transcode vs direct-stream for debug surfaces, and always
        // confirm burn-in requests before player subtitle state assumes PMS rendered them.
        const shouldFetchServerDecision =
            decision.isTranscoding &&
            Boolean(decision.transcodeRequest) &&
            (debugEnabled || decision.subtitleBurnIn?.requested === true);
        if (shouldFetchServerDecision && decision.transcodeRequest) {
            try {
                const serverDecision = await this.fetchUniversalTranscodeDecision(
                    request.itemKey,
                    decision.transcodeRequest
                );
                applyServerDecisionToStreamDecision(decision, serverDecision);
            } catch (error) {
                if (debugEnabled) {
                    logPlexWarning('PMS universal decision fetch failed:', {
                        itemKey: request.itemKey,
                        sessionId: decision.transcodeRequest.sessionId,
                        error: summarizeErrorForLog(error),
                    });
                }
            }
        }

        if (debugEnabled) {
            logPlexWarning('Stream decision:', {
                itemKey: request.itemKey,
                mode: decision.isTranscoding ? 'transcode' : 'direct_play',
                protocol: decision.protocol,
                subtitleDelivery: decision.subtitleDelivery,
                hdr10Fallback: decision.hdr10Fallback,
                subtitleBurnIn: decision.subtitleBurnIn,
                serverDecision: decision.serverDecision ?? null,
                reasonCount: decision.directPlay?.reasons.length ?? 0,
            });
        }

        return decision;
    }

    /**
     * Best-effort: stop an active transcode session without reporting playback progress.
     * @param sessionId - Plex transcode session identifier
     */
    async stopTranscodeSession(sessionId: string): Promise<void> {
        const trimmedSessionId = sessionId.trim();
        if (!trimmedSessionId) {
            return;
        }
        const serverUri = this._config.getServerUri();
        if (!serverUri) {
            return;
        }

        try {
            const baseUri = this._selectBaseUriForMixedContent(serverUri);
            const stopUrl = new URL(`/transcode/sessions/${encodeURIComponent(trimmedSessionId)}`, baseUri);
            const response = await fetchWithTimeout({
                url: stopUrl.toString(),
                init: { method: 'DELETE', headers: this._config.getAuthHeaders() },
                timeoutMs: 5000,
            });
            this._throwIfAuthFailure(response, false);
        } catch (error) {
            logPlexWarning('stopTranscodeSession failed:', {
                sessionId: trimmedSessionId,
                error: summarizeErrorForLog(error),
            });
        }
    }

    /**
     * Check if a media item can be played directly without transcoding.
     * Uses the selected media policy for the public interface.
     * @param item - Media item to check
     * @returns true if direct play is supported
     */
    canDirectPlay(item: PlexStreamMediaItem): boolean {
        if (!item.media || item.media.length === 0) {
            return false;
        }

        const selectedMedia = selectBestMedia(item.media);
        if (!selectedMedia) {
            return false;
        }
        const { media, partIndex } = selectedMedia;
        const videoStream = media.parts[partIndex]?.streams.find((stream) => stream.streamType === 1) ?? null;
        const capabilityProfile = this._createPlaybackCapabilityProfile();
        return getDirectPlayDecision({
            media,
            videoStream,
            capabilityProfile,
        }).canDirect;
    }


    /**
     * Generate an HLS transcode URL for a media item.
     * @param itemKey - ratingKey of the media item
     * @param options - HLS transcoding options (required per SSOT)
     * @returns Full transcode URL
     * @throws StreamResolverError synchronously when a transcode URL cannot be built.
     */
    getTranscodeUrl(itemKey: string, options: HlsOptions): string {
        return this._buildTranscodeUrlWithProfile(
            itemKey,
            options,
            this._createPlaybackCapabilityProfile()
        ).url;
    }

    private _buildTranscodeUrlWithProfile(
        itemKey: string,
        options: HlsOptions,
        capabilityProfile: PlaybackCapabilityProfile
    ): TranscodeUrlResolution {
        const serverUri = this._config.getServerUri();
        if (!serverUri) {
            throw this._createError(
                AppErrorCode.SERVER_UNREACHABLE,
                'No server connection available',
                true
            );
        }

        const baseUri = this._selectBaseUriForMixedContent(serverUri);

        const metadataPath = buildPlexMetadataPath(itemKey);
        if (!metadataPath) {
            throw this._createError(
                AppErrorCode.PARSE_ERROR,
                `Invalid item key for transcode URL: ${itemKey}`,
                false
            );
        }

        const compatMode = options.transcodeCompatMode ??
            this._config.playbackPolicyReader.readTranscodeCompatEnabledAndClean(false);
        const quality = Object.prototype.hasOwnProperty.call(options, 'transcodeQuality')
            ? options.transcodeQuality ?? null
            : this._config.playbackPolicyReader.readTranscodeQualityOptionAndClean();
        const forcedProfileName = this._config.debugOverridesReader.readTranscodeProfileNameAndClean();
        const transcodeUrl = buildPlexTranscodeStartUrl({
            baseUri,
            metadataPath,
            options: {
                ...options,
                sessionId: options.sessionId ?? generatePlexSessionId(),
            },
            compatMode,
            quality,
            selectedConnection: this._config.getSelectedConnection?.() ?? null,
            relayConnectionUri: this._config.getRelayConnection()?.uri ?? null,
            clientCapabilities: this._buildClientCapabilities({
                hideDolbyVision: options.hideDolbyVision === true,
                capabilityProfile,
            }),
            authHeaders: this._config.getAuthHeaders(),
            forcedProfileName,
            defaultIdentityParams: this._identityService.getDefaultPlexIdentity(this._config.clientIdentifier),
        });
        const { url } = transcodeUrl;
        try {
            if (this._isDebugLoggingEnabled()) {
                const debugUrl = new URL(url);
                if (debugUrl.searchParams.has(PLEX_TOKEN_QUERY_PARAM)) {
                    applyXPlexTokenQueryParam(debugUrl.searchParams, 'REDACTED');
                }
                logPlexWarning(
                    `Transcode URL (compat=${compatMode ? '1' : '0'}):`,
                    debugUrl.toString()
                );
            }
        } catch {
            // Ignore debug logging failures
        }
        return { ...transcodeUrl, transcodeCompatMode: compatMode, transcodeQuality: quality };
    }

    async fetchUniversalTranscodeDecision(
        itemKey: string,
        request: NonNullable<StreamDecision['transcodeRequest']>
    ): Promise<NonNullable<StreamDecision['serverDecision']>> {
        return this._universalTranscodeDecisionClient.fetchDecision(itemKey, request);
    }

    on<K extends keyof StreamResolverEventMap>(
        event: K,
        handler: (payload: StreamResolverEventMap[K]) => void
    ): IDisposable {
        return this._emitter.on(event, handler);
    }

    off<K extends keyof StreamResolverEventMap>(
        event: K,
        handler: (payload: StreamResolverEventMap[K]) => void
    ): void {
        this._emitter.off(event, handler);
    }

    private _buildDirectPlayUrl(
        partKey: string,
        sessionId: string,
        audioStreamId?: string,
        hideDolbyVision?: boolean,
        capabilityProfile: PlaybackCapabilityProfile = this._createPlaybackCapabilityProfile()
    ): string {
        const serverUri = this._config.getServerUri();
        if (!serverUri) {
            throw this._createError(
                AppErrorCode.SERVER_UNREACHABLE,
                'No server connection available',
                true
            );
        }

        const baseUri = this._selectBaseUriForMixedContent(serverUri);
        return this._buildUrlWithToken(baseUri, partKey, sessionId, audioStreamId, hideDolbyVision, capabilityProfile);
    }

    /**
     * Build URL with auth token.
     */
    private _buildUrlWithToken(
        baseUri: string,
        partKey: string,
        sessionId: string,
        audioStreamId?: string,
        hideDolbyVision?: boolean,
        capabilityProfile: PlaybackCapabilityProfile = this._createPlaybackCapabilityProfile()
    ): string {
        const headers = this._config.getAuthHeaders();
        const url = buildPlexUrlFromKey(baseUri, partKey);
        url.searchParams.set('X-Plex-Session-Identifier', sessionId);
        if (typeof audioStreamId === 'string' && audioStreamId.length > 0) {
            url.searchParams.set('audioStreamID', audioStreamId);
        }
        applyXPlexQueryParamsFromHeaders(url.searchParams, headers);

        // Include explicit capabilities on direct-play requests too, so PMS can prefer HDR10
        // over DV when fallback mode asks us to hide Dolby Vision decoders.
        url.searchParams.set(
            'X-Plex-Client-Capabilities',
            this._buildClientCapabilities({
                hideDolbyVision: hideDolbyVision === true,
                capabilityProfile,
            })
        );
        this._applyDefaultIdentityParams(url.searchParams);
        return url.toString();
    }

    private _buildClientCapabilities(options?: {
        hideDolbyVision?: boolean;
        capabilityProfile?: PlaybackCapabilityProfile;
    }): string {
        const profile = options?.capabilityProfile ?? this._createPlaybackCapabilityProfile();

        return buildPlexClientCapabilities({
            profile,
            hideDolbyVision: options?.hideDolbyVision === true,
        });
    }

    private _createPlaybackCapabilityProfile(): PlaybackCapabilityProfile {
        return createBrowserPlaybackCapabilityProfile({
            isWebOs: this._isWebOs(),
            dtsPassthroughEnabled: this._isDtsPassthroughEnabled(),
        });
    }

    private _selectBaseUriForMixedContent(serverUri: string): string {
        const serverUrl = new URL(serverUri);
        const isAppHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
        const isServerHttp = serverUrl.protocol === 'http:';

        if (!isAppHttps || !isServerHttp) {
            return serverUrl.origin;
        }

        const httpsConn = this._config.getHttpsConnection();
        if (httpsConn) {
            try {
                const url = new URL(httpsConn.uri);
                if (url.protocol === 'https:') {
                    return url.origin;
                }
            } catch {
                // Ignore invalid connection URIs and try other fallbacks.
            }
        }

        const relayConn = this._config.getRelayConnection();
        if (relayConn) {
            try {
                const url = new URL(relayConn.uri);
                if (url.protocol === 'https:') {
                    logPlexWarning('Using Plex relay due to mixed content restrictions');
                    return url.origin;
                }
            } catch {
                // Ignore invalid relay URIs and continue.
            }
        }

        throw this._createError(
            AppErrorCode.MIXED_CONTENT_BLOCKED,
            'Cannot access HTTP server from HTTPS app - no fallback available',
            false
        );
    }
    private _throwIfAuthFailure(response: Response, emitError = true): void {
        if (response.status === 401) {
            throw this._createAuthError(
                AppErrorCode.AUTH_EXPIRED,
                'Authentication expired',
                emitError
            );
        }
        if (response.status === 403) {
            throw this._createAuthError(
                AppErrorCode.ACCESS_DENIED,
                'Access denied',
                emitError
            );
        }
    }

    private _getHdr10FallbackMode(): Hdr10FallbackMode {
        return this._config.playbackPolicyReader.readHdr10FallbackModeAndClean();
    }

    private _isDebugLoggingEnabled(): boolean {
        return this._config.debugPolicyReader.readDebugLoggingEnabledAndClean(false);
    }

    private _createError(
        code: StreamResolverError['code'],
        message: string,
        recoverable: boolean,
        retryAfterMs?: number,
        stage?: StreamResolverError['stage']
    ): StreamResolverError {
        const error: StreamResolverError = {
            code,
            message,
            recoverable,
        };
        if (retryAfterMs !== undefined) {
            error.retryAfterMs = retryAfterMs;
        }
        if (stage !== undefined) {
            error.stage = stage;
        }
        this._emitter.emit('error', error);
        return error;
    }

    private _createAuthError(
        code: typeof AppErrorCode.AUTH_EXPIRED | typeof AppErrorCode.ACCESS_DENIED,
        message: string,
        emitError: boolean
    ): StreamResolverError {
        if (emitError) {
            return this._createError(code, message, false);
        }

        return {
            code,
            message,
            recoverable: false,
        };
    }
}
