/**
 * @fileoverview Subtitle track manager for Video Player.
 * Handles creation and management of text tracks.
 * @module modules/player/SubtitleManager
 * @version 1.0.0
 */

import type { SubtitleFallbackResult, SubtitleTrack } from './types';
import { BURN_IN_SUBTITLE_FORMATS } from '../../shared/subtitle-formats';
import { redactSensitiveTokens } from '../../utils/redact';
import type { PlatformSubtitleService } from '../../platform';
import { webosPlatformServices } from '../../platform';
import {
    applyXPlexTokenQueryParam,
    buildPlexUrlFromKey,
    tryBuildPlexServerUrlFromKey,
} from '../plex/shared/plexUrl';
import { fetchSubtitleFallbackVtt } from './subtitleFallbackPipeline';
import { SubtitleDebugLogger } from '../debug/SubtitleDebugLogger';

interface SubtitleTrackContext {
    serverUri: string | null;
    resolvedBaseUrl?: string;
    authHeaders: Record<string, string>;
    itemKey?: string;
    mediaIndex?: number;
    partIndex?: number;
    partKey?: string;
    sessionId?: string;
    burnedInSubtitleTrackId?: string | null;
    onUnavailable?: () => void;
    onDeactivate?: (args: { trackId: string; reason: string }) => boolean;
    onDeactivateRecovery?: (args: {
        trackId: string;
        reason: string;
    }) => Promise<'handled' | 'failed'>;
}

type SubtitleFallbackBlobResult =
    | { kind: 'success'; blobUrl: string }
    | Exclude<SubtitleFallbackResult, { kind: 'success' }>;

function assertNeverSubtitleFallbackFailure(result: never): never {
    throw new Error(`Unhandled subtitle fallback failure kind: ${String(result)}`);
}

/**
 * Manages subtitle tracks for the video player.
 * Creates and controls HTMLTrackElement instances.
 */
export class SubtitleManager {
    private readonly _subtitleDebugLogger = new SubtitleDebugLogger({
        scope: 'SubtitleManager',
    });
    /** Reference to the video element */
    private _videoElement: HTMLVideoElement | null = null;

    /** Currently loaded subtitle tracks */
    private _tracks: SubtitleTrack[] = [];

    /** Map of track IDs to track elements */
    private _trackElements: Map<string, HTMLTrackElement> = new Map();

    /** Currently active track ID */
    private _activeTrackId: string | null = null;

    /** Subtitle fetch context (server + auth headers) */
    private _subtitleContext: SubtitleTrackContext | null = null;

    /** Load token for guarding async work */
    private _loadToken = 0;

    /** Track timers by ID */
    private _trackTimers: Map<string, number[]> = new Map();

    /** Track IDs with fallback in progress */
    private _fallbackInProgress: Set<string> = new Set();

    /** Track IDs that are ready */
    private _readyTracks: Set<string> = new Set();

    /** Blob URLs created for fallback tracks */
    private _blobUrls: Map<string, string> = new Map();

    /** Abort controllers for subtitle fetches */
    private _fallbackControllers: Map<string, AbortController> = new Map();
    private readonly _subtitleService: PlatformSubtitleService;

    constructor(subtitleService?: PlatformSubtitleService) {
        this._subtitleService = subtitleService ?? webosPlatformServices.subtitle;
    }

    private _logSubtitleDebug(event: string, contextFactory: () => Record<string, unknown>): void {
        this._subtitleDebugLogger.log(event, contextFactory);
    }

    private _snapshotNativeTextTracks(): Array<Record<string, unknown>> {
        if (!this._videoElement) return [];
        const list = this._videoElement.textTracks;
        const result: Array<Record<string, unknown>> = [];
        for (let i = 0; i < list.length; i++) {
            const t = list[i];
            if (!t) continue;
            result.push({
                id: t.id,
                kind: t.kind,
                label: t.label,
                language: t.language,
                mode: t.mode,
                cuesLength: t.cues?.length ?? null,
                activeCuesLength: t.activeCues?.length ?? null,
            });
        }
        return result;
    }

    /**
     * Initialize the subtitle manager with a video element.
     * @param videoElement - The video element to manage subtitles for
     */
    public initialize(videoElement: HTMLVideoElement): void {
        this._videoElement = videoElement;
    }

    /**
     * Load subtitle tracks for the current media.
     * Creates track elements for text-based formats.
     * @param tracks - Array of subtitle tracks to load
     * @returns Array of track IDs that require burn-in
     */
    public loadTracks(tracks: SubtitleTrack[], context?: SubtitleTrackContext): string[] {
        if (!this._videoElement) {
            return [];
        }

        // Clear any existing tracks
        this.unloadTracks();

        this._subtitleContext = context ?? null;
        this._tracks = tracks;
        this._loadToken += 1;
        const loadToken = this._loadToken;
        const burnInRequired: string[] = [];

        this._logSubtitleDebug('subtitle_tracks_discovered', () => {
            const codecCounts = tracks.reduce<Record<string, number>>((acc, track) => {
                const codec = (track.codec || track.format || 'unknown').toLowerCase();
                acc[codec] = (acc[codec] ?? 0) + 1;
                return acc;
            }, {});
            const withKeyCount = tracks.filter((t) => t.fetchableViaKey).length;
            return {
                count: tracks.length,
                codecs: codecCounts,
                withKeyCount,
                withoutKeyCount: Math.max(0, tracks.length - withKeyCount),
            };
        });

        for (const track of tracks) {
            if (this._requiresBurnIn(track.format)) {
                burnInRequired.push(track.id);
                continue;
            }

            // Create track element for text-based subtitles (key-based or ID-based fetch)
            if (track.isTextCandidate && (track.fetchableViaKey || track.id)) {
                const codec = (track.codec || track.format || '').toLowerCase();
                // HTMLTrackElement expects WebVTT. Avoid attaching non-VTT sources (e.g. SRT),
                // and rely on the fetch+convert fallback when the user selects the track.
                if (codec !== 'vtt' && codec !== 'webvtt') {
                    this._logSubtitleDebug('subtitle_track_deferred', () => ({
                        id: track.id,
                        codec: codec || null,
                        reason: 'non_vtt_requires_conversion',
                    }));
                    continue;
                }
                const directUrl = this._buildDirectTrackUrl(track);
                if (!directUrl) {
                    this._logSubtitleDebug('subtitle_track_error', () => ({
                        id: track.id,
                        error: 'missing_context',
                        path: 'direct',
                    }));
                    continue;
                }

                const baselineTextTracks = this._videoElement.textTracks.length;
                const trackElement = this._createTrackElement(track, directUrl);
                this._videoElement.appendChild(trackElement);
                this._trackElements.set(track.id, trackElement);

                this._logSubtitleDebug('subtitle_track_attach', () => ({
                    id: track.id,
                    path: track.key ? 'direct' : 'id-fallback',
                    src: redactSensitiveTokens(trackElement.src),
                }));

                this._watchTrackReadiness(track, trackElement, 'direct', loadToken, baselineTextTracks);
            }
        }

        return burnInRequired;
    }

    /**
     * Unload all subtitle tracks.
     */
    public unloadTracks(): void {
        this._loadToken += 1;
        this._clearPendingTrackState();
        // Remove track elements from DOM
        for (const element of this._trackElements.values()) {
            element.remove();
        }
        this._trackElements.clear();

        this._tracks = [];
        this._activeTrackId = null;
        this._subtitleContext = null;
    }

    /**
     * Set the active subtitle track.
     * @param trackId - Track ID to activate, null to disable all
     */
    public setActiveTrack(trackId: string | null): void {
        if (!this._videoElement) {
            return;
        }

        const burnedInActive =
            typeof trackId === 'string' &&
            trackId.length > 0 &&
            this._subtitleContext?.burnedInSubtitleTrackId === trackId;

        const textTracks = this._videoElement.textTracks;

        for (let i = 0; i < textTracks.length; i++) {
            const track = textTracks[i];
            if (track) {
                track.mode = 'hidden';
            }
        }

        this._activeTrackId = trackId;

        if (trackId && this._readyTracks.has(trackId)) {
            this._applyTrackModeShowing(trackId);
        } else if (trackId) {
            // When the current stream has subtitles burned into the video, avoid slow extract attempts.
            // Track selection is still reflected in state/OSD, but rendering is handled by the video stream.
            if (burnedInActive) {
                this._logSubtitleDebug('subtitle_track_burned_in_active', () => ({
                    id: trackId,
                }));
                return;
            }
            // Avoid prefetching/transforming every subtitle track on load.
            // Only attempt the expensive fetch+convert fallback for the user-selected track.
            const selected = this._tracks.find((t) => t.id === trackId) ?? null;
            if (selected && selected.isTextCandidate) {
                const codec = (selected.codec || selected.format || '').toLowerCase();
                // Native track rendering expects WebVTT; SRT/other text formats require conversion.
                if (codec !== 'vtt' && codec !== 'webvtt') {
                    void this._triggerFallback(selected, 'selected', this._loadToken);
                }
            }
        }

        this._logSubtitleDebug('setActiveTrack', () => ({
            activeTrackId: trackId,
            nativeTextTracks: this._snapshotNativeTextTracks(),
        }));
    }

    /**
     * Get the currently active track ID.
     * @returns Active track ID or null
     */
    public getActiveTrackId(): string | null {
        return this._activeTrackId;
    }

    /**
     * Get all loaded subtitle tracks.
     * @returns Array of subtitle tracks
     */
    public getTracks(): SubtitleTrack[] {
        return [...this._tracks];
    }

    /**
     * Check if a format requires burn-in.
     * @param format - Subtitle format
     * @returns true if format requires burn-in
     */
    public requiresBurnIn(format: string): boolean {
        return this._requiresBurnIn(format);
    }

    /**
     * Destroy the subtitle manager.
     */
    public destroy(): void {
        this.unloadTracks();
        this._videoElement = null;
    }

    // ========================================
    // Private Methods
    // ========================================

    private _clearPendingTrackState(): void {
        for (const timers of this._trackTimers.values()) {
            for (const timerId of timers) {
                window.clearTimeout(timerId);
            }
        }
        this._trackTimers.clear();

        for (const controller of this._fallbackControllers.values()) {
            controller.abort();
        }
        this._fallbackControllers.clear();

        for (const blobUrl of this._blobUrls.values()) {
            try {
                URL.revokeObjectURL(blobUrl);
            } catch {
                // ignore
            }
        }
        this._blobUrls.clear();
        this._fallbackInProgress.clear();
        this._readyTracks.clear();
    }

    private _storeTrackTimer(trackId: string, timerId: number): void {
        const existing = this._trackTimers.get(trackId) ?? [];
        existing.push(timerId);
        this._trackTimers.set(trackId, existing);
    }

    private _clearTrackTimers(trackId: string): void {
        const timers = this._trackTimers.get(trackId);
        if (!timers) return;
        for (const timerId of timers) {
            window.clearTimeout(timerId);
        }
        this._trackTimers.delete(trackId);
    }

    private _getAuthTokenFromHeaders(headers: Record<string, string>): string | null {
        const token = headers['X-Plex-Token'];
        return typeof token === 'string' && token.length > 0 ? token : null;
    }

    private _buildDirectTrackUrl(track: SubtitleTrack): string | null {
        try {
            const baseUri = this._subtitleContext?.resolvedBaseUrl
                ?? this._subtitleContext?.serverUri
                ?? null;
            let url: URL;
            if (track.key) {
                if (!baseUri) return null;
                const isAbsoluteHttpUrl = /^https?:\/\//i.test(track.key);
                if (isAbsoluteHttpUrl) {
                    const normalized = tryBuildPlexServerUrlFromKey(baseUri, track.key);
                    if (!normalized) {
                        const path = `/library/streams/${encodeURIComponent(track.id)}`;
                        url = new URL(path, baseUri);
                    } else {
                        url = normalized;
                    }
                } else {
                    url = buildPlexUrlFromKey(baseUri, track.key);
                }
            } else {
                if (!baseUri) return null;
                const path = `/library/streams/${encodeURIComponent(track.id)}`;
                url = new URL(path, baseUri);
            }
            const authHeaders = this._subtitleContext?.authHeaders;
            if (authHeaders) {
                const token = this._getAuthTokenFromHeaders(authHeaders);
                applyXPlexTokenQueryParam(url.searchParams, token);
            }
            return url.toString();
        } catch {
            return null;
        }
    }

    private _watchTrackReadiness(
        track: SubtitleTrack,
        trackElement: HTMLTrackElement,
        path: 'direct' | 'blob',
        loadToken: number,
        baselineTextTracks: number
    ): void {
        const onLoad = (): void => {
            if (loadToken !== this._loadToken) return;
            this._checkTrackReady(track, trackElement, path, baselineTextTracks);
        };
        const onError = (): void => {
            if (loadToken !== this._loadToken) return;
            this._logSubtitleDebug('subtitle_track_error', () => ({
                id: track.id,
                path,
                error: 'track_error',
                nativeTextTracks: this._snapshotNativeTextTracks(),
            }));
            void this._triggerFallback(track, 'track_error', loadToken);
        };

        trackElement.addEventListener('load', onLoad);
        trackElement.addEventListener('error', onError);

        const loadTimeoutId = window.setTimeout(() => {
            if (loadToken !== this._loadToken) return;
            if (this._readyTracks.has(track.id)) return;
            const textTracksLength = this._videoElement?.textTracks.length ?? 0;
            const reason = textTracksLength <= baselineTextTracks
                ? 'texttracks_unchanged'
                : 'load_timeout';
            void this._triggerFallback(track, reason, loadToken);
        }, 2000);
        this._storeTrackTimer(track.id, loadTimeoutId);

        const cueTimeoutId = window.setTimeout(() => {
            if (loadToken !== this._loadToken) return;
            if (this._readyTracks.has(track.id)) return;
            const cuesLength = trackElement.track?.cues?.length ?? 0;
            if (cuesLength === 0) {
                void this._triggerFallback(track, 'no_cues', loadToken);
                return;
            }
            const textTracksLength = this._videoElement?.textTracks.length ?? 0;
            this._markTrackReady(track, path, textTracksLength, cuesLength);
        }, 3000);
        this._storeTrackTimer(track.id, cueTimeoutId);
    }

    private _checkTrackReady(
        track: SubtitleTrack,
        trackElement: HTMLTrackElement,
        path: 'direct' | 'blob',
        baselineTextTracks: number
    ): void {
        const textTracksLength = this._videoElement?.textTracks.length ?? 0;
        const cuesLength = trackElement.track?.cues?.length ?? 0;
        if (textTracksLength > baselineTextTracks && cuesLength > 0) {
            this._markTrackReady(track, path, textTracksLength, cuesLength);
        }
    }

    private _markTrackReady(
        track: SubtitleTrack,
        path: 'direct' | 'blob',
        textTracksLength: number,
        cuesLength: number
    ): void {
        if (this._readyTracks.has(track.id)) return;
        this._readyTracks.add(track.id);
        this._clearTrackTimers(track.id);
        this._logSubtitleDebug('subtitle_track_ready', () => ({
            id: track.id,
            path,
            textTracksLength,
            cuesLength,
            nativeTextTracks: this._snapshotNativeTextTracks(),
        }));
        if (this._activeTrackId === track.id) {
            this._applyTrackModeShowing(track.id);
        }
    }

    private async _triggerFallback(
        track: SubtitleTrack,
        reason: string,
        loadToken: number
    ): Promise<void> {
        // Only fetch/convert subtitles for the currently selected track.
        // Otherwise, loadTracks() would eagerly fetch+convert every available language track.
        if (this._activeTrackId !== track.id) return;
        if (this._fallbackInProgress.has(track.id)) return;
        if (this._readyTracks.has(track.id)) return;
        if (loadToken !== this._loadToken) return;
        this._fallbackInProgress.add(track.id);
        // Prevent stale timers from triggering duplicate fallback attempts.
        this._clearTrackTimers(track.id);
        this._logSubtitleDebug('subtitle_fallback_used', () => ({
            id: track.id,
            reason,
        }));

        const blobUrl = await this._fetchFallbackBlobUrl(track, loadToken);
        if (loadToken !== this._loadToken) {
            this._fallbackInProgress.delete(track.id);
            return;
        }
        if (blobUrl.kind === 'stale') {
            this._fallbackInProgress.delete(track.id);
            return;
        }
        if (blobUrl.kind !== 'success') {
            this._fallbackInProgress.delete(track.id);
            this._handleFallbackFailure(track, blobUrl);
            return;
        }

        this._replaceTrackElement(track, blobUrl.blobUrl, loadToken);
        this._fallbackInProgress.delete(track.id);
    }

    private async _fetchFallbackBlobUrl(
        track: SubtitleTrack,
        loadToken: number
    ): Promise<SubtitleFallbackBlobResult> {
        const urlString = this._buildDirectTrackUrl(track);
        if (!urlString) {
            this._logSubtitleDebug('subtitle_fetch_error', () => ({
                id: track.id,
                error: 'missing_context',
            }));
            return { kind: 'unsupported', reason: 'missing_context' };
        }
        let url: URL;
        try {
            url = new URL(urlString);
        } catch {
            this._logSubtitleDebug('subtitle_fetch_error', () => ({
                id: track.id,
                error: 'invalid_url',
            }));
            return { kind: 'unsupported', reason: 'invalid_url' };
        }

        const controller = new AbortController();
        this._fallbackControllers.set(track.id, controller);

        try {
            const fallbackResult = await fetchSubtitleFallbackVtt({
                track,
                initialUrl: url,
                context: {
                    serverUri: this._subtitleContext?.serverUri ?? null,
                    resolvedBaseUrl: this._subtitleContext?.resolvedBaseUrl,
                    authHeaders: this._subtitleContext?.authHeaders ?? {},
                    itemKey: this._subtitleContext?.itemKey,
                    mediaIndex: this._subtitleContext?.mediaIndex,
                    partIndex: this._subtitleContext?.partIndex,
                    sessionId: this._subtitleContext?.sessionId,
                },
                signal: controller.signal,
                isCurrentLoad: () => loadToken === this._loadToken,
                deriveLanHttpUrl: (original) => this._deriveLanHttpUrl(original),
                logDebug: (event, contextFactory) => this._logSubtitleDebug(event, contextFactory),
            });
            if (loadToken !== this._loadToken) return { kind: 'stale' };
            if (fallbackResult.kind !== 'success') return fallbackResult;

            const existing = this._blobUrls.get(track.id);
            if (existing) {
                try {
                    URL.revokeObjectURL(existing);
                } catch {
                    // ignore
                }
                this._blobUrls.delete(track.id);
            }

            const blob = new Blob([fallbackResult.vtt], { type: 'text/vtt' });
            const blobUrl = URL.createObjectURL(blob);
            this._blobUrls.set(track.id, blobUrl);
            return {
                kind: 'success',
                blobUrl,
            };
        } catch (error) {
            if (loadToken !== this._loadToken || controller.signal.aborted) return { kind: 'stale' };
            const message = error instanceof Error ? error.message : String(error);
            this._logSubtitleDebug('subtitle_fetch_error', () => ({
                id: track.id,
                error: message,
                url: redactSensitiveTokens(url.toString()),
            }));
            return { kind: 'transient', reason: 'unknown_error' };
        } finally {
            this._fallbackControllers.delete(track.id);
        }
    }

    private _deriveLanHttpUrl(original: URL): URL | null {
        return this._subtitleService.deriveLanHttpSubtitleUrl(original);
    }

    private _replaceTrackElement(track: SubtitleTrack, src: string, loadToken: number): void {
        if (!this._videoElement || loadToken !== this._loadToken) return;
        const existing = this._trackElements.get(track.id);
        if (existing) {
            existing.remove();
        }
        const baselineTextTracks = this._videoElement.textTracks.length;
        const trackElement = this._createTrackElement(track, src);
        this._videoElement.appendChild(trackElement);
        this._trackElements.set(track.id, trackElement);
        this._logSubtitleDebug('subtitle_track_attach', () => ({
            id: track.id,
            path: 'blob',
            src: redactSensitiveTokens(trackElement.src),
        }));
        this._watchTrackReadiness(track, trackElement, 'blob', loadToken, baselineTextTracks);
    }

    private _notifySubtitleUnavailable(): void {
        this._notifySubtitleUnavailableForContext(this._subtitleContext);
    }

    private _notifySubtitleUnavailableForContext(context: SubtitleTrackContext | null): void {
        const handler = context?.onUnavailable;
        if (handler) {
            handler();
        }
    }

    private _handleFallbackFailure(
        track: SubtitleTrack,
        result: Exclude<SubtitleFallbackBlobResult, { kind: 'success' | 'stale' }>
    ): void {
        const isSelected = this._activeTrackId === track.id;
        if (!isSelected) {
            return;
        }
        const reason = this._getFallbackFailureReason(result);
        this._logSubtitleDebug('subtitle_fallback_failed', () => ({
            id: track.id,
            category: result.kind,
            reason: result.reason,
            ...(typeof result.status === 'number' ? { status: result.status } : {}),
        }));
        this.setActiveTrack(null);
        const handled = this._notifySubtitleDeactivated(track.id, reason);
        if (!handled) {
            this._notifySubtitleUnavailable();
            return;
        }
        this._recoverHandledSubtitleDeactivation(track.id, reason);
    }

    private _getFallbackFailureReason(
        result: Exclude<SubtitleFallbackBlobResult, { kind: 'success' | 'stale' }>
    ): string {
        switch (result.kind) {
            case 'auth':
                return 'subtitle_text_auth_failed';
            case 'transient':
                return 'subtitle_text_transient_failure';
            case 'unsupported':
                return 'subtitle_text_unsupported';
            default:
                return assertNeverSubtitleFallbackFailure(result);
        }
    }

    private _notifySubtitleDeactivated(trackId: string, reason: string): boolean {
        const handler = this._subtitleContext?.onDeactivate;
        if (!handler) return false;
        try {
            return handler({ trackId, reason }) === true;
        } catch {
            return false;
        }
    }

    private _recoverHandledSubtitleDeactivation(trackId: string, reason: string): void {
        const capturedContext = this._subtitleContext;
        const handler = capturedContext?.onDeactivateRecovery;
        if (!handler) {
            return;
        }
        void Promise.resolve()
            .then(() => handler({ trackId, reason }))
            .then((result) => {
                if (result === 'failed') {
                    this._notifySubtitleUnavailableForContext(capturedContext);
                }
            })
            .catch(() => {
                this._notifySubtitleUnavailableForContext(capturedContext);
            });
    }

    private _applyTrackModeShowing(trackId: string): void {
        if (!this._videoElement) return;
        const textTracks = this._videoElement.textTracks;
        for (let i = 0; i < textTracks.length; i++) {
            const track = textTracks[i];
            if (!track) continue;
            track.mode = track.id === trackId ? 'showing' : 'hidden';
        }
    }

    /**
     * Create a track element for a subtitle track.
     * @param track - Subtitle track info
     * @returns HTMLTrackElement
     */
    private _createTrackElement(track: SubtitleTrack, src: string): HTMLTrackElement {
        const trackElement = document.createElement('track');
        trackElement.id = track.id;
        // 'forced' is not a valid HTMLTrackElement.kind value - use 'subtitles'
        // Valid values: subtitles, captions, descriptions, chapters, metadata
        trackElement.kind = 'subtitles';
        trackElement.src = src;
        trackElement.srclang = track.languageCode;
        trackElement.label = track.label || track.language;
        if (track.default) {
            trackElement.default = true;
        }
        // Store forced flag in dataset for internal tracking
        if (track.forced) {
            trackElement.dataset.forced = 'true';
        }

        // Start hidden (with null check for jsdom compatibility)
        if (trackElement.track) {
            trackElement.track.mode = 'hidden';
        }

        return trackElement;
    }

    /**
     * Check if a format requires burn-in (cannot be rendered natively).
     * @param format - Subtitle format
     * @returns true if format requires burn-in
     */
    private _requiresBurnIn(format: string): boolean {
        const normalizedFormat = format.toLowerCase();
        return BURN_IN_SUBTITLE_FORMATS.includes(normalizedFormat);
    }

}
