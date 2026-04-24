/**
 * Resolves playback URLs, handles direct play detection, and manages sessions.
 */

import { EventEmitter } from '../../../utils/EventEmitter';
import { AppErrorCode } from '../../../types/app-errors';
import type {
    IPlexStreamResolver,
    PlexStreamResolverConfig,
    StreamResolverError,
    StreamResolverEventMap,
} from './interfaces';
import type {
    PlexMediaItem,
    PlexStream,
    StreamRequest,
    StreamDecision,
    HlsOptions,
} from './types';
import { isTextSubtitleFormat } from './constants';
import { generatePlexSessionId } from './plexSessionId';
import { AudioSettingsStore } from '../../settings/AudioSettingsStore';
import { PlaybackSettingsStore } from '../../settings/PlaybackSettingsStore';
import { DeveloperSettingsStore } from '../../settings/DeveloperSettingsStore';
import { summarizeErrorForLog } from '../../../utils/errors';
import { redactSensitiveTokens } from '../../../utils/redact';
import {
    getDirectPlayDecision,
} from './playbackCompatibilityPolicy';
import { fetchWithTimeout } from '../shared/fetchWithTimeout';
import { detectHdrLabel } from './hdr';
import type { PlatformIdentityService } from '../../../platform';
import { createPlatformIdentityService } from '../../../platform';
import { resolveStreamPipeline } from './resolveStreamPipeline';
import {
    applyXPlexQueryParamsFromHeaders,
    applyXPlexTokenQueryParam,
    buildPlexUrlFromKey,
} from '../shared/plexUrl';
import {
    buildPlexClientCapabilities,
    buildPlexMetadataPath,
    buildPlexTranscodeStartUrl,
} from './plexStreamUrlPolicy';
import { logPlexWarning } from '../shared/plexLogging';
import { SubtitleDebugLogger } from '../../debug/SubtitleDebugLogger';
import { probeSubtitleStreamDelivery } from './SubtitleStreamProbe';

// Re-export types for consumers
export { PlexStreamErrorCode } from './types';

/**
 * Plex Stream Resolver implementation.
 * Resolves stream URLs and manages playback sessions.
 * @implements {IPlexStreamResolver}
 */
export class PlexStreamResolver implements IPlexStreamResolver {
    private readonly _config: PlexStreamResolverConfig;
    private readonly _emitter: EventEmitter<StreamResolverEventMap>;
    private readonly _identityService: PlatformIdentityService;
    private readonly _audioSettingsStore = new AudioSettingsStore();
    private readonly _playbackSettingsStore = new PlaybackSettingsStore();
    private readonly _developerSettingsStore = new DeveloperSettingsStore();
    private readonly _subtitleDebugLogger = new SubtitleDebugLogger({
        scope: 'PlexStreamResolver',
        sink: (scope, event, payload): void => {
            logPlexWarning('subtitle_debug', scope, event, payload);
        },
        settingsReader: this._developerSettingsStore,
    });

    /**
     * Create a new PlexStreamResolver instance.
     * @param config - Configuration with auth and server accessors
     */
    constructor(config: PlexStreamResolverConfig) {
        this._config = config;
        this._emitter = new EventEmitter<StreamResolverEventMap>();
        this._identityService = config.identityService ?? createPlatformIdentityService();
    }

    private _getChromeMajor(): number | null {
        try {
            if (typeof navigator === 'undefined') return null;
            const ua = navigator.userAgent || '';
            const chromeMatch = ua.match(/Chrome\/(\d+)/);
            if (!chromeMatch) return null;
            const n = Number(chromeMatch[1]);
            return Number.isFinite(n) ? n : null;
        } catch {
            return null;
        }
    }

    private _getBrowserUserAgent(): string | null {
        try {
            if (typeof navigator === 'undefined') {
                return null;
            }
            return navigator.userAgent || null;
        } catch {
            return null;
        }
    }

    private _isDtsPassthroughEnabled(): boolean {
        try {
            const userEnabled = this._audioSettingsStore.readDtsPassthroughEnabledAndClean(false);
            const chromeMajor = this._getChromeMajor();
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

    private _isSubtitleDebugEnabled(): boolean {
        return this._subtitleDebugLogger.isEnabled();
    }

    private _logSubtitleDebug(event: string, context: Record<string, unknown>): void {
        this._subtitleDebugLogger.log(event, context);
    }

    // ========================================
    // Stream Resolution
    // ========================================

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
        const allowDirectPlayAudioFallback = this._audioSettingsStore.readDirectPlayAudioFallbackEnabledAndClean();
        const dtsPassthroughEnabled = this._isDtsPassthroughEnabled();
        const userAgent = this._getBrowserUserAgent();
        const hdr10FallbackMode = this._getHdr10FallbackMode();
        const debugEnabled = this._isDebugLoggingEnabled();

        const pipeline = resolveStreamPipeline({
            item,
            request,
            sessionId,
            allowDirectPlayAudioFallback,
            dtsPassthroughEnabled,
            userAgent,
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
                applyHdr10Fallback
            ),
            getTranscodeUrl: (itemKey, options) => this.getTranscodeUrl(itemKey, options),
        });

        const {
            decision,
            media,
            videoStream,
            subtitleStream,
            availableSubtitleStreams,
        } = pipeline;

        if (this._isSubtitleDebugEnabled()) {
            const isTextCandidate = (s: PlexStream): boolean => {
                return isTextSubtitleFormat(s.codec) || isTextSubtitleFormat(s.format);
            };
            const hasKey = (s: PlexStream): boolean => typeof s.key === 'string' && s.key.length > 0;
            const codecCounts = availableSubtitleStreams.reduce<Record<string, number>>((acc, stream) => {
                const codec = (stream.codec ?? stream.format ?? 'unknown').toLowerCase();
                acc[codec] = (acc[codec] ?? 0) + 1;
                return acc;
            }, {});
            const withKeyCount = availableSubtitleStreams.filter(hasKey).length;
            this._logSubtitleDebug('subtitle_tracks_discovered', {
                count: availableSubtitleStreams.length,
                codecs: codecCounts,
                withKeyCount,
                withoutKeyCount: Math.max(0, availableSubtitleStreams.length - withKeyCount),
            });
            this._logSubtitleDebug('subtitle_streams_discovered', {
                itemKey: request.itemKey,
                subtitlesCount: availableSubtitleStreams.length,
                subtitleStreams: availableSubtitleStreams.map((s) => ({
                    id: s.id,
                    codec: s.codec,
                    format: s.format,
                    language: s.language,
                    languageCode: s.languageCode,
                    title: s.title,
                    default: s.default,
                    forced: s.forced,
                    selected: subtitleStream?.id === s.id,
                    isTextCandidate: isTextCandidate(s),
                    fetchableViaKey: hasKey(s),
                    key: typeof s.key === 'string' ? redactSensitiveTokens(s.key) : null,
                })),
            });

            const candidates = availableSubtitleStreams.filter(isTextCandidate);
            if (candidates.length > 0) {
                const pickPreferred = (streams: PlexStream[]): PlexStream => {
                    const forced = streams.find((s) => s.forced);
                    if (forced) return forced;
                    const english = streams.find(
                        (s) => (s.language ?? '').toLowerCase() === 'english' || (s.languageCode ?? '').toLowerCase() === 'en'
                    );
                    if (english) return english;
                    return streams[0]!;
                };

                // Probe both a key-backed and keyless candidate when possible, to categorize behavior.
                const withKey = candidates.filter(hasKey);
                const withoutKey = candidates.filter((s) => !hasKey(s));
                const toProbe: PlexStream[] = [];
                if (withKey.length > 0) toProbe.push(pickPreferred(withKey));
                if (withoutKey.length > 0 && toProbe.length < 2) toProbe.push(pickPreferred(withoutKey));
                while (toProbe.length < 2) {
                    const next = candidates.find((s) => !toProbe.some((p) => p.id === s.id));
                    if (!next) break;
                    toProbe.push(next);
                }
                for (const s of toProbe) {
                    void probeSubtitleStreamDelivery(
                        {
                            itemKey: request.itemKey,
                            subtitleStreamId: s.id,
                            ...(typeof s.key === 'string' ? { subtitleStreamKey: s.key } : {}),
                            codec: s.codec,
                            ...(typeof s.language === 'string' ? { language: s.language } : {}),
                        },
                        {
                            serverUri: this._config.getServerUri(),
                            getAuthHeaders: this._config.getAuthHeaders,
                            logDebug: (event, context) => this._logSubtitleDebug(event, context),
                        }
                    );
                }
            }
        }

        if (debugEnabled) {
            if (pipeline.hdrFallbackReason) {
                logPlexWarning('HDR10 fallback applied:', {
                    itemKey: request.itemKey,
                    reason: pipeline.hdrFallbackReason,
                    container: media.container,
                    isDolbyVision: videoStream?.doviPresent === true,
                });
            }
            if (pipeline.forceHlsForDvNoHdr10BaseLayer) {
                logPlexWarning('HDR10 base-layer fallback forced:', {
                    itemKey: request.itemKey,
                    reason: 'dv_profile_no_hdr10_base_layer',
                    container: media.container,
                });
            }
        }
        const hdrLabel = decision.source?.hdr || detectHdrLabel(videoStream);
        if (hdrLabel && decision.source && !decision.source.hdr) {
            decision.source.hdr = hdrLabel;
        }

        if (debugEnabled) {
            logPlexWarning('Stream decision:', {
                itemKey: request.itemKey,
                mode: decision.isTranscoding ? 'transcode' : 'direct_play',
                protocol: decision.protocol,
                subtitleDelivery: decision.subtitleDelivery,
                reasonCount: decision.directPlay?.reasons.length ?? 0,
            });
        }

        // Optional (debug-only): ask PMS why it chose to transcode vs direct-stream.
        // This helps explain cases where HDR10 fallback unexpectedly results in SDR H.264 transcodes.
        if (debugEnabled && decision.isTranscoding && decision.transcodeRequest) {
            try {
                decision.serverDecision = await this.fetchUniversalTranscodeDecision(
                    request.itemKey,
                    decision.transcodeRequest
                );
            } catch (error) {
                logPlexWarning('PMS universal decision fetch failed:', {
                    itemKey: request.itemKey,
                    sessionId: decision.transcodeRequest.sessionId,
                    error: summarizeErrorForLog(error),
                });
            }
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
            this._throwIfAuthFailure(response);
        } catch (error) {
            logPlexWarning('stopTranscodeSession failed:', {
                sessionId: trimmedSessionId,
                error: summarizeErrorForLog(error),
            });
        }
    }

    // ========================================
    // Direct Play Check
    // ========================================

    /**
     * Check if a media item can be played directly without transcoding.
     * Uses the first media version for the public interface.
     * @param item - Media item to check
     * @returns true if direct play is supported
     */
    canDirectPlay(item: PlexMediaItem): boolean {
        if (!item.media || item.media.length === 0) {
            return false;
        }

        const media = item.media[0];
        if (!media) {
            return false;
        }
        const dtsPassthroughEnabled = this._isDtsPassthroughEnabled();
        const userAgent = this._getBrowserUserAgent();
        return getDirectPlayDecision({
            media,
            dtsPassthroughEnabled,
            userAgent,
        }).canDirect;
    }

    // ========================================
    // Transcode URL
    // ========================================

    /**
     * Generate an HLS transcode URL for a media item.
     * @param itemKey - ratingKey of the media item
     * @param options - HLS transcoding options (required per SSOT)
     * @returns Full transcode URL
     */
    getTranscodeUrl(itemKey: string, options: HlsOptions): string {
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

        const compatMode = this._playbackSettingsStore.readTranscodeCompatEnabledAndClean(false);
        const quality = this._playbackSettingsStore.readTranscodeQualityOptionAndClean();
        const authHeaders = this._config.getAuthHeaders();
        const forcedProfileName = this._config.debugOverridesStore.readTranscodeProfileNameAndClean();
        const defaultIdentityParams = this._identityService.getDefaultPlexIdentity(
            this._config.clientIdentifier
        );
        const { url } = buildPlexTranscodeStartUrl({
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
            }),
            authHeaders,
            forcedProfileName,
            defaultIdentityParams,
        });
        try {
            const shouldLogTranscodeDebug = this._isDebugLoggingEnabled();
            if (!shouldLogTranscodeDebug) {
                return url;
            }

            const debugUrl = new URL(url);
            if (debugUrl.searchParams.has('X-Plex-Token')) {
                applyXPlexTokenQueryParam(debugUrl.searchParams, 'REDACTED');
            }
            logPlexWarning(
                `Transcode URL (compat=${compatMode ? '1' : '0'}):`,
                debugUrl.toString()
            );
        } catch {
            // Ignore debug logging failures
        }
        return url;
    }

    async fetchUniversalTranscodeDecision(
        itemKey: string,
        request: NonNullable<StreamDecision['transcodeRequest']>
    ): Promise<NonNullable<StreamDecision['serverDecision']>> {
        const hlsOptions: HlsOptions = {
            sessionId: request.sessionId,
            maxBitrate: request.maxBitrate,
        };
        if (typeof request.mediaIndex === 'number') {
            hlsOptions.mediaIndex = request.mediaIndex;
        }
        if (typeof request.partIndex === 'number') {
            hlsOptions.partIndex = request.partIndex;
        }
        if (typeof request.audioStreamId === 'string') {
            hlsOptions.audioStreamId = request.audioStreamId;
        }
        if (typeof request.subtitleStreamId === 'string') {
            hlsOptions.subtitleStreamId = request.subtitleStreamId;
        }
        if (request.subtitleMode === 'burn') {
            hlsOptions.subtitleMode = 'burn';
        }
        if (request.hideDolbyVision === true) {
            hlsOptions.hideDolbyVision = true;
        }

        const startUrl = this.getTranscodeUrl(itemKey, hlsOptions);

        const decisionUrl = ((): string => {
            const url = new URL(startUrl);
            url.pathname = '/video/:/transcode/universal/decision';
            return url.toString();
        })();

        const response = await fetchWithTimeout({
            url: decisionUrl,
            init: { method: 'GET', headers: this._config.getAuthHeaders() },
            timeoutMs: 4000,
        });
        this._throwIfAuthFailure(response);
        if (!response.ok) {
            throw new Error(`PMS decision request failed: ${response.status}`);
        }
        const raw = await response.text();

        const parsed = this._parseUniversalDecisionResponse(raw);
        return { fetchedAt: Date.now(), ...parsed };
    }

    private _parseUniversalDecisionResponse(
        raw: string
    ): Omit<NonNullable<StreamDecision['serverDecision']>, 'fetchedAt'> {
        // Best-effort parsing. Plex typically responds with XML for this endpoint.
        // We extract commonly used attributes: decisionCode/decisionText and video/audio/subtitle decisions.
        try {
            if (typeof DOMParser !== 'undefined') {
                const doc = new DOMParser().parseFromString(raw, 'text/xml');
                const container = doc.querySelector('MediaContainer');
                const transcode = doc.querySelector('TranscodeSession');

                const decisionCode =
                    container?.getAttribute('decisionCode') ??
                    transcode?.getAttribute('decisionCode') ??
                    undefined;
                const decisionText =
                    container?.getAttribute('decisionText') ??
                    container?.getAttribute('generalDecisionText') ??
                    transcode?.getAttribute('decisionText') ??
                    undefined;

                const videoDecision =
                    transcode?.getAttribute('videoDecision') ??
                    container?.getAttribute('videoDecision') ??
                    undefined;
                const audioDecision =
                    transcode?.getAttribute('audioDecision') ??
                    container?.getAttribute('audioDecision') ??
                    undefined;
                const subtitleDecision =
                    transcode?.getAttribute('subtitleDecision') ??
                    container?.getAttribute('subtitleDecision') ??
                    undefined;

                const result: Record<string, string> = {};
                if (decisionCode) result.decisionCode = decisionCode;
                if (decisionText) result.decisionText = decisionText;
                if (videoDecision) result.videoDecision = videoDecision;
                if (audioDecision) result.audioDecision = audioDecision;
                if (subtitleDecision) result.subtitleDecision = subtitleDecision;
                return result as Omit<NonNullable<StreamDecision['serverDecision']>, 'fetchedAt'>;
            }
        } catch {
            // fall through to regex parsing
        }

        const attr = (name: string): string | undefined => {
            const match = raw.match(new RegExp(`${name}=\"([^\"]+)\"`));
            return match?.[1];
        };
        const decisionCode = attr('decisionCode') ?? attr('generalDecisionCode');
        const decisionText = attr('decisionText') ?? attr('generalDecisionText');
        const videoDecision = attr('videoDecision');
        const audioDecision = attr('audioDecision');
        const subtitleDecision = attr('subtitleDecision');

        const result: Record<string, string> = {};
        if (decisionCode) result.decisionCode = decisionCode;
        if (decisionText) result.decisionText = decisionText;
        if (videoDecision) result.videoDecision = videoDecision;
        if (audioDecision) result.audioDecision = audioDecision;
        if (subtitleDecision) result.subtitleDecision = subtitleDecision;
        return result as Omit<NonNullable<StreamDecision['serverDecision']>, 'fetchedAt'>;
    }

    // ========================================
    // Events
    // ========================================

    /**
     * Register event handler.
     * @param event - Event name
     * @param handler - Handler function
     */
    on<K extends keyof StreamResolverEventMap>(
        event: K,
        handler: (payload: StreamResolverEventMap[K]) => void
    ): void {
        // Type assertion to handler union - EventEmitter accepts this via index signature
        type HandlerUnion = (payload: StreamResolverEventMap[keyof StreamResolverEventMap]) => void;
        this._emitter.on(event, handler as HandlerUnion);
    }

    /**
     * Remove event handler.
     * @param event - Event name
     * @param handler - Handler function
     */
    off<K extends keyof StreamResolverEventMap>(
        event: K,
        handler: (payload: StreamResolverEventMap[K]) => void
    ): void {
        type HandlerUnion = (payload: StreamResolverEventMap[keyof StreamResolverEventMap]) => void;
        this._emitter.off(event, handler as HandlerUnion);
    }

    // ========================================
    // Private: URL Building
    // ========================================

    /**
     * Build direct play URL with mixed content handling.
     * @param partKey - Media part key
     * @returns Full playback URL
     */
    private _buildDirectPlayUrl(
        partKey: string,
        sessionId: string,
        audioStreamId?: string,
        hideDolbyVision?: boolean
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
        return this._buildUrlWithToken(baseUri, partKey, sessionId, audioStreamId, hideDolbyVision);
    }

    /**
     * Build URL with auth token.
     */
    private _buildUrlWithToken(
        baseUri: string,
        partKey: string,
        sessionId: string,
        audioStreamId?: string,
        hideDolbyVision?: boolean
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
            this._buildClientCapabilities({ hideDolbyVision: hideDolbyVision === true })
        );
        this._applyDefaultIdentityParams(url.searchParams);
        return url.toString();
    }

    private _buildClientCapabilities(options?: { hideDolbyVision?: boolean }): string {
        const is4K = typeof window !== 'undefined' &&
            typeof window.screen?.width === 'number' &&
            window.screen.width >= 3840;

        const videoEl = typeof document !== 'undefined' ? document.createElement('video') : null;
        const canPlayMimeType = (mime: string): boolean => {
            try {
                return !!videoEl && videoEl.canPlayType(mime) !== '';
            } catch {
                return false;
            }
        };

        return buildPlexClientCapabilities({
            is4K,
            canPlayMimeType,
            chromeMajor: this._getChromeMajor(),
            isWebOs: this._isWebOs(),
            dtsPassthroughEnabled: this._isDtsPassthroughEnabled(),
            hideDolbyVision: options?.hideDolbyVision === true,
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

    private _throwIfAuthFailure(response: Response): void {
        if (response.status === 401) {
            throw this._createError(
                AppErrorCode.AUTH_EXPIRED,
                'Authentication expired',
                false
            );
        }
        if (response.status === 403) {
            throw this._createError(
                AppErrorCode.ACCESS_DENIED,
                'Access denied',
                false
            );
        }
    }

    // ========================================
    // Private: Media Selection
    // ========================================

    private _getHdr10FallbackMode(): 'off' | 'smart' | 'force' {
        return this._playbackSettingsStore.readHdr10FallbackModeAndClean();
    }

    private _isDebugLoggingEnabled(): boolean {
        return this._developerSettingsStore.readDebugLoggingEnabledAndClean(false);
    }

    // ========================================
    // Private: Error Handling
    // ========================================

    /**
     * Create a StreamResolverError.
     */
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
}
