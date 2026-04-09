/**
 * Resolves playback URLs, handles direct play detection, and manages sessions.
 */

import { EventEmitter } from '../../../utils/EventEmitter';
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
import { PlexStreamErrorCode } from './types';
import { DEFAULT_HLS_OPTIONS } from './constants';
import { generateUUID } from './utils';
import { AudioSettingsStore } from '../../settings/AudioSettingsStore';
import { PlaybackSettingsStore } from '../../settings/PlaybackSettingsStore';
import { DeveloperSettingsStore } from '../../settings/DeveloperSettingsStore';
import { summarizeErrorForLog } from '../../../utils/errors';
import { redactSensitiveTokens, redactUrlForLog, safeStringifyForLog } from '../../../utils/redact';
import {
    getDirectPlayDecision,
} from './playbackCompatibilityPolicy';
import { fetchWithTimeout } from '../shared/fetchWithTimeout';
import { detectHdrLabel } from './hdr';
import type { PlatformIdentityService } from '../../../platform';
import { webosPlatformServices } from '../../../platform';
import { resolveStreamPipeline } from './resolveStreamPipeline';
import {
    applyXPlexQueryParamsFromHeaders,
    applyXPlexTokenQueryParam,
    buildPlexUrlFromKey,
    tryBuildPlexServerUrlFromKey,
} from '../shared/plexUrl';

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

    /**
     * Create a new PlexStreamResolver instance.
     * @param config - Configuration with auth and server accessors
     */
    constructor(config: PlexStreamResolverConfig) {
        this._config = config;
        this._emitter = new EventEmitter<StreamResolverEventMap>();
        this._identityService = config.identityService ?? webosPlatformServices.identity;
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
            const userEnabled = this._audioSettingsStore.readDtsPassthroughEnabled(false);
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
        return this._developerSettingsStore.readSubtitleDebugLoggingEnabled(false);
    }

    private _logSubtitleDebug(event: string, context: Record<string, unknown>): void {
        if (!this._isSubtitleDebugEnabled()) return;
        try {
            console.warn('[PlexStreamResolver] subtitle-debug:', event, safeStringifyForLog(context));
        } catch {
            // Ignore logging failures.
        }
    }

    private _detectSubtitleTextFormat(sample: string): 'webvtt' | 'srt' | 'unknown' {
        const trimmed = sample.replace(/^\uFEFF/, '').trimStart(); // strip UTF-8 BOM
        if (trimmed.startsWith('WEBVTT')) return 'webvtt';
        // Heuristic: SRT has timestamps with -->
        if (trimmed.includes('-->')) return 'srt';
        return 'unknown';
    }

    private async _probeSubtitleStreamDelivery(options: {
        itemKey: string;
        subtitleStreamId: string;
        subtitleStreamKey?: string;
        codec?: string;
        language?: string;
    }): Promise<void> {
        if (!this._isSubtitleDebugEnabled()) return;
        const serverUri = this._config.getServerUri();
        if (!serverUri) return;

        let urlSource: 'key' | 'id_fallback' = 'id_fallback';
        const baseUrl = ((): URL => {
            if (typeof options.subtitleStreamKey === 'string' && options.subtitleStreamKey.length > 0) {
                const normalized = tryBuildPlexServerUrlFromKey(serverUri, options.subtitleStreamKey);
                if (normalized) {
                    urlSource = 'key';
                    return normalized;
                }
            }
            return new URL(`/library/streams/${encodeURIComponent(options.subtitleStreamId)}`, serverUri);
        })();

        const tokenFromHeader = ((): string | null => {
            try {
                const headers = this._config.getAuthHeaders();
                const token = headers['X-Plex-Token'];
                return typeof token === 'string' && token.length > 0 ? token : null;
            } catch {
                return null;
            }
        })();

        const authMode = 'header' as const;
        const headers: Record<string, string> = {
            Accept: 'text/vtt, text/plain, */*',
            ...this._config.getAuthHeaders(),
        };

        const redactedUrl = redactUrlForLog(baseUrl.toString());
        const redactedTrackSrcQueryAuth = ((): string | null => {
            // NOTE: <track src="..."> cannot send X-Plex-Token headers. Prefer a blob URL
            // created from an authenticated fetch to avoid token-in-URL and CORS issues.
            if (!tokenFromHeader) return null;
            try {
                const u = new URL(baseUrl.toString());
                applyXPlexTokenQueryParam(u.searchParams, tokenFromHeader);
                return redactUrlForLog(u.toString());
            } catch {
                return null;
            }
        })();

        try {
            const response = await fetchWithTimeout(
                baseUrl.toString(),
                {
                    method: 'GET',
                    headers,
                    cache: 'no-store',
                    // Explicitly CORS so the behavior matches what the TV browser enforces.
                    mode: 'cors',
                    credentials: 'omit',
                },
                8000
            );

            const contentType = response.headers.get('content-type');
            const contentLength = response.headers.get('content-length');
            const acceptRanges = response.headers.get('accept-ranges');
            const contentRange = response.headers.get('content-range');
            const contentDisposition = response.headers.get('content-disposition');
            const accessControlAllowOrigin = response.headers.get('access-control-allow-origin');
            const accessControlExposeHeaders = response.headers.get('access-control-expose-headers');
            const responseType = response.type;
            const redirected = response.redirected;
            const finalUrl = redactUrlForLog(response.url);

            let detected: 'webvtt' | 'srt' | 'unknown' = 'unknown';
            let sampleLength = 0;
            let sampleCapped = false;
            let looksLikeHtml = false;
            try {
                const reader = response.body?.getReader?.();
                if (reader) {
                    const decoder = new TextDecoder('utf-8');
                    let sample = '';
                    const MAX_SAMPLE_CHARS = 2048;
                    while (sample.length < MAX_SAMPLE_CHARS) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        if (value) {
                            const chunk = decoder.decode(value, { stream: true });
                            const remaining = MAX_SAMPLE_CHARS - sample.length;
                            if (chunk.length > remaining) {
                                sample += chunk.slice(0, remaining);
                                sampleCapped = true;
                                break;
                            }
                            sample += chunk;
                        }
                    }
                    try {
                        // Stop downloading if more data exists.
                        await reader.cancel();
                    } catch {
                        // Ignore cancel errors.
                    }
                    sampleLength = sample.length;
                    looksLikeHtml = sample.replace(/^\uFEFF/, '').trimStart().startsWith('<');
                    detected = this._detectSubtitleTextFormat(sample);
                } else {
                    // Some client stacks may not expose a streaming body. Avoid downloading full subtitle
                    // payloads in debug mode; fall back to codec-based detection.
                    detected =
                        ((): 'webvtt' | 'srt' | 'unknown' => {
                            const c = (options.codec ?? '').toLowerCase();
                            if (c === 'vtt' || c === 'webvtt') return 'webvtt';
                            if (c === 'srt') return 'srt';
                            return 'unknown';
                        })();
                }
            } catch {
                // Ignore read errors; still log status/headers.
            }

            this._logSubtitleDebug('subtitle_stream_probe', {
                itemKey: options.itemKey,
                subtitleStreamId: options.subtitleStreamId,
                subtitleStreamKey: typeof options.subtitleStreamKey === 'string' ? redactSensitiveTokens(options.subtitleStreamKey) : null,
                codec: options.codec ?? null,
                language: options.language ?? null,
                urlSource,
                authMode,
                url: redactedUrl,
                trackSrcQueryAuthExample: redactedTrackSrcQueryAuth,
                originHost: baseUrl.host,
                originIsPlexDirect: baseUrl.hostname.endsWith('.plex.direct'),
                responseType,
                redirected,
                finalUrl,
                ok: response.ok,
                status: response.status,
                contentType,
                contentLength,
                contentDisposition,
                accessControlAllowOrigin,
                accessControlExposeHeaders,
                acceptRanges,
                contentRange,
                detected,
                sampleLength,
                sampleCapped,
                looksLikeHtml,
            });
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            this._logSubtitleDebug('subtitle_stream_probe_error', {
                itemKey: options.itemKey,
                subtitleStreamId: options.subtitleStreamId,
                subtitleStreamKey: typeof options.subtitleStreamKey === 'string' ? redactSensitiveTokens(options.subtitleStreamKey) : null,
                codec: options.codec ?? null,
                language: options.language ?? null,
                urlSource,
                authMode,
                url: redactedUrl,
                error: message,
            });
        }
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
                PlexStreamErrorCode.ITEM_NOT_FOUND,
                `Item not found: ${request.itemKey}`,
                false
            );
        }

        const sessionId = generateUUID();
        const allowDirectPlayAudioFallback = this._audioSettingsStore.readDirectPlayAudioFallbackEnabled();
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
                const c = (s.codec ?? '').toLowerCase();
                return c === 'srt' || c === 'vtt' || c === 'webvtt';
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
                    void this._probeSubtitleStreamDelivery({
                        itemKey: request.itemKey,
                        subtitleStreamId: s.id,
                        ...(typeof s.key === 'string' ? { subtitleStreamKey: s.key } : {}),
                        codec: s.codec,
                        ...(typeof s.language === 'string' ? { language: s.language } : {}),
                    });
                }
            }
        }

        if (debugEnabled) {
            if (pipeline.hdrFallbackReason) {
                console.warn('[PlexStreamResolver] HDR10 fallback applied:', {
                    itemKey: request.itemKey,
                    reason: pipeline.hdrFallbackReason,
                    container: media.container,
                    isDolbyVision: videoStream?.doviPresent === true,
                });
            }
            if (pipeline.forceHlsForDvNoHdr10BaseLayer) {
                console.warn('[PlexStreamResolver] HDR10 base-layer fallback forced:', {
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
            console.warn('[PlexStreamResolver] Stream decision:', {
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
                console.warn('[PlexStreamResolver] PMS universal decision fetch failed:', {
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
            const response = await fetchWithTimeout(
                stopUrl.toString(),
                { method: 'DELETE', headers: this._config.getAuthHeaders() },
                5000
            );
            this._throwIfAuthFailure(response);
        } catch (error) {
            console.warn('[PlexStreamResolver] stopTranscodeSession failed:', {
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
                PlexStreamErrorCode.SERVER_UNREACHABLE,
                'No server connection available',
                true
            );
        }

        const baseUri = this._selectBaseUriForMixedContent(serverUri);

        const sessionId = options.sessionId ?? generateUUID();
        const maxBitrate = typeof options.maxBitrate === 'number'
            ? options.maxBitrate
            : DEFAULT_HLS_OPTIONS.maxBitrate;
        const subtitleSize = typeof options.subtitleSize === 'number'
            ? options.subtitleSize
            : DEFAULT_HLS_OPTIONS.subtitleSize;
        const audioBoost = typeof options.audioBoost === 'number'
            ? options.audioBoost
            : DEFAULT_HLS_OPTIONS.audioBoost;
        const mediaIndex = typeof options.mediaIndex === 'number' ? options.mediaIndex : 0;
        const partIndex = typeof options.partIndex === 'number' ? options.partIndex : 0;
        const burnInEnabled =
            options.subtitleMode === 'burn' &&
            typeof options.subtitleStreamId === 'string' &&
            options.subtitleStreamId.length > 0;

        const metadataPath = itemKey.startsWith('/library/metadata/')
            ? itemKey
            : `/library/metadata/${itemKey}`;

        const compatMode = this._playbackSettingsStore.readTranscodeCompatEnabled(false);
        const quality = this._playbackSettingsStore.readTranscodeQualityOption();
        const shouldApplyQualityOverride = Boolean(quality && quality.storageValue.length > 0);
        const qualityMaxBitrate = shouldApplyQualityOverride ? quality?.maxVideoBitrateKbps : undefined;
        const effectiveMaxBitrate = typeof qualityMaxBitrate === 'number'
            ? Math.min(maxBitrate, Math.max(1, Math.floor(qualityMaxBitrate)))
            : maxBitrate;

        const relayOrigin = ((): string | null => {
            try {
                const relay = this._config.getRelayConnection()?.uri ?? null;
                if (!relay) return null;
                return new URL(relay).origin;
            } catch {
                return null;
            }
        })();
        const baseOrigin = ((): string | null => {
            try {
                return new URL(baseUri).origin;
            } catch {
                return null;
            }
        })();
        const location = ((): 'lan' | 'wan' | null => {
            const selectedConn = this._config.getSelectedConnection?.() ?? null;
            if (selectedConn) {
                if (selectedConn.relay) return 'wan';
                return selectedConn.local ? 'lan' : 'wan';
            }
            // Fallback: only classify as WAN if we are clearly using a relay origin.
            if (relayOrigin && baseOrigin && relayOrigin === baseOrigin) {
                return 'wan';
            }
            // Unknown: avoid misclassifying WAN as LAN.
            return null;
        })();

        const params = new URLSearchParams();
        params.set('path', metadataPath);
        params.set('mediaIndex', String(mediaIndex));
        params.set('partIndex', String(partIndex));
        params.set('protocol', 'hls');
        params.set('offset', '0');
        // Bind the transcoder session key to our app sessionId so we can terminate it later
        params.set('session', sessionId);
        params.set('X-Plex-Session-Identifier', sessionId);
        if (typeof options.audioStreamId === 'string' && options.audioStreamId.length > 0) {
            params.set('audioStreamID', options.audioStreamId);
        }

        if (!compatMode) {
            // Default: richer set aligned with Plex examples
            params.set('fastSeek', '1');
            params.set('directPlay', '0');
            // Allow Plex to Direct Stream (copy video, transcode audio if needed) instead of forcing full transcode.
            params.set('directStream', '1');
            params.set('directStreamAudio', '1');
            params.set('subtitleSize', String(subtitleSize));
            params.set('audioBoost', String(audioBoost));
            params.set('maxVideoBitrate', String(effectiveMaxBitrate));
            if (shouldApplyQualityOverride && quality?.videoResolution) {
                // Match the shape used by official clients: quality + resolution + bitrate.
                params.set('videoQuality', '100');
                params.set('videoResolution', quality.videoResolution);
            }
            if (location) {
                params.set('location', location);
            }
            params.set('addDebugOverlay', '0');
            params.set('autoAdjustQuality', '0');
            params.set('mediaBufferSize', '102400');
            if (burnInEnabled) {
                params.set('subtitles', 'burn');
                params.set('subtitleStreamID', options.subtitleStreamId as string);
            } else {
                // Lineup does not yet provide subtitle track selection. Avoid forcing burn-in, which can trigger video transcode.
                params.set('subtitles', 'none');
                // Redundant belt-and-suspenders for servers that ignore `subtitles=none`.
                params.set('subtitleStreamID', '0');
                params.set('subtitleFormat', 'none');
            }
            params.set('Accept-Language', 'en');
        } else {
            // Compat: minimal, conservative set for older/stricter servers
            params.set('directPlay', '0');
            params.set('directStream', '1');
            params.set('maxVideoBitrate', String(effectiveMaxBitrate));
            if (shouldApplyQualityOverride && quality?.videoResolution) {
                params.set('videoQuality', '100');
                params.set('videoResolution', quality.videoResolution);
            }
            if (location) {
                params.set('location', location);
            }
            if (burnInEnabled) {
                params.set('subtitles', 'burn');
                params.set('subtitleStreamID', options.subtitleStreamId as string);
            } else {
                params.set('subtitles', 'none');
                params.set('subtitleStreamID', '0');
                params.set('subtitleFormat', 'none');
            }
        }

        // Explicitly declare capabilities to improve Direct Stream decisions (audio-only transcode, no video transcode).
        // Keep this conservative and adaptive to avoid requesting streams the device can't decode.
        params.set(
            'X-Plex-Client-Capabilities',
            this._buildClientCapabilities({
                hideDolbyVision: options.hideDolbyVision === true,
            })
        );

        // Add client params (video element requests cannot include headers, so use query params)
        applyXPlexQueryParamsFromHeaders(params, this._config.getAuthHeaders());

        // Optional: Force the server to use a specific built-in profile name/version (advanced).
        const forcedProfileName = this._config.debugOverridesStore.readTranscodeProfileName();
        if (forcedProfileName) {
            params.set('X-Plex-Client-Profile-Name', forcedProfileName);
        } else {
            // Default to 'HTML TV App' for better Direct Play support on webOS
            // 'Generic' forces transcoding for almost everything.
            params.set('X-Plex-Client-Profile-Name', 'HTML TV App');
        }

        // Ensure minimum required ID params are present even if getAuthHeaders is mocked/minimal
        this._applyDefaultIdentityParams(params);

        const url = new URL('/video/:/transcode/universal/start.m3u8', baseUri);
        url.search = params.toString();
        try {
            const shouldLogTranscodeDebug = this._isDebugLoggingEnabled();
            if (!shouldLogTranscodeDebug) {
                return url.toString();
            }

            const debugUrl = new URL(url.toString());
            if (debugUrl.searchParams.has('X-Plex-Token')) {
                applyXPlexTokenQueryParam(debugUrl.searchParams, 'REDACTED');
            }
            console.warn(
                `[PlexStreamResolver] Transcode URL (compat=${compatMode ? '1' : '0'}):`,
                debugUrl.toString()
            );
        } catch {
            // Ignore debug logging failures
        }
        return url.toString();
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

        const response = await fetchWithTimeout(
            decisionUrl,
            { method: 'GET', headers: this._config.getAuthHeaders() },
            4000
        );
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
                PlexStreamErrorCode.SERVER_UNREACHABLE,
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
        const h264Level = is4K ? '51' : '42'; // Level 5.1 (4K) vs 4.2 (1080p)

        const videoEl = typeof document !== 'undefined' ? document.createElement('video') : null;
        const canPlay = (mime: string): boolean => {
            try {
                return !!videoEl && videoEl.canPlayType(mime) !== '';
            } catch {
                return false;
            }
        };

        const chromeMajor = this._getChromeMajor();
        const isWebOs = this._isWebOs();

        // HEVC detection (common for 4K libraries).
        //
        // Important: many HDR10 and DV base-layer sources are HEVC Main 10 (10-bit).
        // If we only advertise HEVC Main, PMS may assume "can't decode" and choose an
        // SDR H.264 transcode as the safest target.
        const supportsHevcMain =
            canPlay('video/mp4; codecs="hvc1.1.6.L93.B0"') ||
            canPlay('video/mp4; codecs="hev1.1.6.L93.B0"') ||
            // Fallback: webOS 23+ (Chromium 94+) should support HEVC decode, even if canPlayType lies.
            (isWebOs && chromeMajor !== null && chromeMajor >= 94);

        // HEVC Main 10 (10-bit). Common sample codec strings include 2.x profiles.
        const supportsHevcMain10 =
            canPlay('video/mp4; codecs="hvc1.2.4.L93.B0"') ||
            canPlay('video/mp4; codecs="hev1.2.4.L93.B0"') ||
            canPlay('video/mp4; codecs="hvc1.2.4.L150.B0"') ||
            canPlay('video/mp4; codecs="hev1.2.4.L150.B0"') ||
            // Same conservative webOS fallback as HEVC Main.
            (isWebOs && chromeMajor !== null && chromeMajor >= 94);

        const supportsHevc = supportsHevcMain || supportsHevcMain10;

        // Dolby Vision support in browser stacks is inconsistent; do not guess based on platform.
        // Only advertise DV when canPlayType explicitly reports it.
        const supportsDolbyVision =
            canPlay('video/mp4; codecs="dvh1.05.06"') ||
            canPlay('video/mp4; codecs="dvh1.08.06"');

        const supportsVp9 =
            canPlay('video/webm; codecs="vp9"') ||
            canPlay('video/mp4; codecs="vp09.00.10.08"');

        const supportsAv1 =
            canPlay('video/mp4; codecs="av01.0.05M.08"') ||
            canPlay('video/webm; codecs="av01.0.05M.08"');

        const videoDecoders: string[] = [`h264{profile:high&level:${h264Level}}`];
        if (supportsHevc) {
            // Plex commonly uses HEVC "level" style values like 120 (1080p) / 150 (4K).
            const hevcLevel = is4K ? '150' : '120';
            // Prefer Main10 when available; keep Main as a fallback.
            if (supportsHevcMain10) {
                videoDecoders.push(`hevc{profile:main10&level:${hevcLevel}}`);
            }
            videoDecoders.push(`hevc{profile:main&level:${hevcLevel}}`);
            if (supportsDolbyVision && options?.hideDolbyVision !== true) {
                videoDecoders.push('hevc{profile:dvhe.05}');
                videoDecoders.push('hevc{profile:dvhe.08}');
            }
        }
        if (supportsVp9) {
            videoDecoders.push('vp9');
        }
        if (supportsAv1) {
            videoDecoders.push('av1');
        }

        const audioDecoders: string[] = [
            'mp3',
            'aac{bitrate:800000}',
            'ac3{bitrate:800000}',
            'eac3{bitrate:800000}',
        ];

        // If user explicitly enabled DTS passthrough and we're on a modern webOS stack,
        // advertise DTS-HD MA as well (Plex often labels it as `dca-ma`).
        if (this._isDtsPassthroughEnabled()) {
            audioDecoders.push('dts{bitrate:1536000}');
            audioDecoders.push('dca{bitrate:1536000}');
            audioDecoders.push('dca-ma{bitrate:1536000}');
        }

        return `protocols=http-live-streaming,http-mp4-streaming,http-streaming-video;videoDecoders=${videoDecoders.join(',')};audioDecoders=${audioDecoders.join(',')}`;
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
                    console.warn('Using Plex relay due to mixed content restrictions');
                    return url.origin;
                }
            } catch {
                // Ignore invalid relay URIs and continue.
            }
        }

        throw this._createError(
            PlexStreamErrorCode.MIXED_CONTENT_BLOCKED,
            'Cannot access HTTP server from HTTPS app - no fallback available',
            false
        );
    }

    private _throwIfAuthFailure(response: Response): void {
        if (response.status === 401) {
            throw this._createError(
                PlexStreamErrorCode.AUTH_EXPIRED,
                'Authentication expired',
                false
            );
        }
        if (response.status === 403) {
            throw this._createError(
                PlexStreamErrorCode.AUTH_INVALID,
                'Authentication invalid',
                false
            );
        }
    }

    // ========================================
    // Private: Media Selection
    // ========================================

    private _getHdr10FallbackMode(): 'off' | 'smart' | 'force' {
        return this._playbackSettingsStore.readHdr10FallbackMode();
    }

    private _isDebugLoggingEnabled(): boolean {
        return this._developerSettingsStore.readDebugLoggingEnabled(false);
    }

    // ========================================
    // Private: Error Handling
    // ========================================

    /**
     * Create a StreamResolverError.
     */
    private _createError(
        code: PlexStreamErrorCode,
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
