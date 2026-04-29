import { EventEmitter } from '../../utils/EventEmitter';
import { SubtitleManager } from './SubtitleManager';
import { AudioTrackManager } from './AudioTrackManager';
import { VideoPlayerEvents } from './VideoPlayerEvents';
import { RetryManager } from './RetryManager';
import { KeepAliveManager } from './KeepAliveManager';
import type { IVideoPlayer } from './interfaces';
import type { IDisposable } from '../../utils/interfaces';
import type {
    VideoPlayerConfig,
    StreamDescriptor,
    PlaybackState,
    SubtitleTrack,
    AudioTrack,
    PlayerEventMap,
    PlayerStatus,
    VideoPlayerInternalState,
    PlaybackError,
} from './types';
import { AppErrorCode } from '../../types/app-errors';
import {
    VIDEO_ELEMENT_ID,
    VIDEO_ELEMENT_STYLES,
    DEFAULT_CONFIG,
} from './constants';
import { AudioSettingsStore } from '../settings/AudioSettingsStore';
import { redactSensitiveTokens } from '../../utils/redact';
import {
    logVideoPlayerMediaSessionActionFailure,
    logVideoPlayerPlayFailure,
} from '../debug/PlayerConsoleLogger';
import type { PlatformPlaybackService, PlatformSubtitleService } from '../../platform';
import { createWebOsPlatformServices } from '../../platform';
import { SubtitleDebugLogger } from '../debug/SubtitleDebugLogger';

type MediaSessionPlaybackStateLike = 'none' | 'paused' | 'playing';

type MediaSessionActionLike =
    | 'play'
    | 'pause'
    | 'stop'
    | 'seekto'
    | 'seekbackward'
    | 'seekforward';

type MediaSessionActionHandlerLike = (details: unknown) => void;

interface MediaSessionLike {
    metadata: unknown;
    playbackState: MediaSessionPlaybackStateLike;
    setActionHandler(action: MediaSessionActionLike, handler: MediaSessionActionHandlerLike | null): void;
    setPositionState?: (state: { duration: number; position: number; playbackRate: number }) => void;
}

const MEDIA_SESSION_ACTIONS: MediaSessionActionLike[] = [
    'play',
    'pause',
    'stop',
    'seekto',
    'seekbackward',
    'seekforward',
];

type SubtitleDeactivation = {
    trackId: string;
    reason: string;
};

export class VideoPlayer implements IVideoPlayer {
    private readonly _subtitleDebugLogger = new SubtitleDebugLogger({
        scope: 'VideoPlayer',
    });
    private _loadGeneration = 0;
    private _emitter: EventEmitter<PlayerEventMap> = new EventEmitter();
    private _videoElement: HTMLVideoElement | null = null;
    private _subtitleManager: SubtitleManager;
    private readonly _audioSettingsStore = new AudioSettingsStore();
    private _audioTrackManager: AudioTrackManager = new AudioTrackManager({
        audioSettingsStore: this._audioSettingsStore,
    });
    private _eventManager: VideoPlayerEvents = new VideoPlayerEvents();
    private _retryManager: RetryManager = new RetryManager();
    private _keepAliveManager: KeepAliveManager = new KeepAliveManager();
    private readonly _playbackService: PlatformPlaybackService;
    private _config: VideoPlayerConfig | null = null;
    private _mediaSessionEnabled: boolean = false;
    private _mediaSessionStateChangeHandler: ((state: PlaybackState) => void) | null = null;
    private _mediaSessionFailureTimestamps: Map<string, number> = new Map();
    private _state: VideoPlayerInternalState = this._createInitialState();

    constructor(services?: {
        playbackService?: PlatformPlaybackService;
        subtitleService?: PlatformSubtitleService;
    }) {
        this._playbackService = services?.playbackService ?? createWebOsPlatformServices().playback;
        this._subtitleManager = new SubtitleManager(services?.subtitleService);
    }

    private _logSubtitleDebug(event: string, contextFactory: () => Record<string, unknown>): void {
        this._subtitleDebugLogger.log(event, contextFactory);
    }

    private _subtitleSelectionInProgress: boolean = false;
    private _subtitleSelectionRequestedId: string | null = null;
    private _subtitleSelectionDeferredDeactivation: SubtitleDeactivation | null = null;

    private _handleSubtitleDeactivated(trackId: string, reason: string): void {
        if (this._state.activeSubtitleId === null) {
            return;
        }
        if (this._state.activeSubtitleId !== trackId) {
            this._logSubtitleDebug('subtitle_track_deactivated_ignored', () => ({
                reason,
                trackId,
                activeSubtitleId: this._state.activeSubtitleId,
            }));
            return;
        }
        this._state.activeSubtitleId = null;
        this._logSubtitleDebug('subtitle_track_deactivated', () => ({
            trackId,
            reason,
        }));
        this._emitter.emit('trackChange', { type: 'subtitle', trackId: null });
        this._emitStateChange();
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

    private _handleSubtitleDeactivateRequest(
        args: SubtitleDeactivation,
        onDeactivate?: NonNullable<StreamDescriptor['subtitleContext']>['onDeactivate']
    ): boolean {
        let handled = false;
        try {
            handled = onDeactivate?.(args) === true;
        } catch (error) {
            this._logSubtitleDebug('subtitle_onDeactivate_error', () => ({
                trackId: args.trackId,
                reason: args.reason,
                error: String(error),
            }));
        }

        const deferDeactivation =
            this._subtitleSelectionInProgress &&
            this._subtitleSelectionRequestedId === args.trackId;
        if (deferDeactivation) {
            this._subtitleSelectionDeferredDeactivation = { ...args };
            return handled;
        }

        this._handleSubtitleDeactivated(args.trackId, args.reason);
        return handled;
    }

    private _createSubtitleContext(
        descriptor: StreamDescriptor
    ): StreamDescriptor['subtitleContext'] | undefined {
        if (!descriptor.subtitleContext) {
            return undefined;
        }

        return {
            ...descriptor.subtitleContext,
            onDeactivate: (args: SubtitleDeactivation): boolean =>
                this._handleSubtitleDeactivateRequest(args, descriptor.subtitleContext?.onDeactivate),
        };
    }

    public async initialize(config: VideoPlayerConfig): Promise<void> {
        if (this._videoElement) {
            return;
        }

        this._config = {
            ...DEFAULT_CONFIG,
            ...config,
        };

        this._videoElement = document.createElement('video');
        this._videoElement.id = VIDEO_ELEMENT_ID;
        this._videoElement.style.cssText = VIDEO_ELEMENT_STYLES;
        this._videoElement.playsInline = true;
        // webOS simulator quirk: some builds composite the video plane above HTML overlays.
        // Hide the video element until a stream is actually loaded so the UI can render.
        this._videoElement.style.display = 'none';

        const container = document.getElementById(config.containerId);
        if (!container) {
            throw new Error(`Video container not found: ${config.containerId}`);
        }
        container.appendChild(this._videoElement);

        this._state = this._createInitialState();
        this._videoElement.volume = Math.max(0, Math.min(1, this._config.defaultVolume));
        this._state.volume = this._videoElement.volume;

        this._subtitleManager.initialize(this._videoElement);
        this._audioTrackManager.initialize(this._videoElement);
        this._retryManager.initialize(
            this._videoElement,
            this._config.retryAttempts,
            this._config.retryDelayMs
        );

        this._eventManager.attach(
            this._videoElement,
            this._emitter,
            {
                updateStatus: this._updateStatus.bind(this),
                getState: (): VideoPlayerInternalState => this._state,
                setState: (update: Partial<VideoPlayerInternalState>): void => {
                    Object.assign(this._state, update);
                },
            },
            this._retryManager
        );

        this._keepAliveManager.setIsPlayingCheck((): boolean => this.isPlaying());
        this._keepAliveManager.start();
    }

    public destroy(): void {
        this.releaseMediaSession();

        this._keepAliveManager.stop();
        this._retryManager.destroy();
        this._eventManager.detach();
        this._subtitleManager.destroy();
        this._audioTrackManager.destroy();

        if (this._videoElement) {
            this._videoElement.pause();
            this._videoElement.src = '';
            this._videoElement.remove();
            this._videoElement = null;
        }

        this._emitter.removeAllListeners();

        this._state = this._createInitialState();
        this._config = null;
    }

    public async loadStream(descriptor: StreamDescriptor): Promise<void> {
        if (!this._videoElement) {
            throw new Error('VideoPlayer not initialized');
        }

        this.unloadStream();
        const loadGeneration = ++this._loadGeneration;

        // Ensure video element is visible once we start loading media.
        this._videoElement.style.display = 'block';

        this._state.currentDescriptor = descriptor;

        this._updateStatus('loading');

        this._retryManager.reset();
        this._retryManager.setDescriptor(descriptor);

        // Platform seam: keep native source assignment behavior identical.
        this._playbackService.applyStreamSource(this._videoElement, {
            protocol: descriptor.protocol,
            url: descriptor.url,
        });

        this._logSubtitleDebug('loadStream_src_set', () => ({
            protocol: descriptor.protocol,
            url: redactSensitiveTokens(descriptor.url),
            descriptorSubtitleTracks: descriptor.subtitleTracks.map((t) => ({
                id: t.id,
                format: t.format,
                codec: t.codec,
                languageCode: t.languageCode,
                language: t.language,
                label: t.label,
                forced: t.forced,
                default: t.default,
                fetchableViaKey: t.fetchableViaKey,
                key: t.key ? redactSensitiveTokens(t.key) : null,
            })),
        }));

        const subtitleContext = this._createSubtitleContext(descriptor);
        const burnInTracks = this._subtitleManager.loadTracks(
            descriptor.subtitleTracks,
            subtitleContext
        );
        this._logSubtitleDebug('loadStream_subtitles_loaded', () => ({
            burnInTracks,
            nativeTextTracks: this._snapshotNativeTextTracks(),
        }));

        if (descriptor.preferredSubtitleTrackId !== undefined) {
            await this.setSubtitleTrack(descriptor.preferredSubtitleTrackId ?? null);
            if (!this._isActiveLoad(loadGeneration, descriptor)) {
                return;
            }
        }

        this._audioTrackManager.setTracks(descriptor.audioTracks);

        this._state.durationMs = descriptor.durationMs;
        this._state.activeAudioId = this._audioTrackManager.getActiveTrackId();

        this._syncMediaSessionMetadata();

        this._videoElement.load();

        await this._eventManager.waitForCanPlay();
        if (!this._isActiveLoad(loadGeneration, descriptor)) {
            return;
        }

        this._logSubtitleDebug('canplay', () => ({
            nativeTextTracks: this._snapshotNativeTextTracks(),
        }));

        // Set start position AFTER metadata is loaded
        // CRITICAL: load() resets currentTime to 0, so we must set it after canplay
        if (descriptor.startPositionMs > 0) {
            this._videoElement.currentTime = descriptor.startPositionMs / 1000;
        }
    }

    public unloadStream(): void {
        if (!this._videoElement) {
            return;
        }
        this._loadGeneration++;

        // Mark stream as unloaded early so any teardown-related events (e.g. spurious 'ended' on webOS)
        // don't propagate as "real" playback completion.
        this._state.currentDescriptor = null;

        this._retryManager.clear();
        this._retryManager.setDescriptor(null);

        this._videoElement.pause();

        while (this._videoElement.firstChild) {
            this._videoElement.removeChild(this._videoElement.firstChild);
        }

        this._videoElement.removeAttribute('src');
        this._videoElement.load();
        // Hide when idle to avoid covering UI with a black video plane.
        this._videoElement.style.display = 'none';

        this._subtitleManager.unloadTracks();

        this._audioTrackManager.unload();

        this._state.currentTimeMs = 0;
        this._state.durationMs = 0;
        this._state.bufferPercent = 0;
        this._state.activeSubtitleId = null;
        this._state.activeAudioId = null;
        this._state.errorInfo = null;

        this._syncMediaSessionMetadata();

        this._updateStatus('idle');
    }

    public async play(): Promise<void> {
        if (!this._videoElement) {
            throw new Error('VideoPlayer not initialized');
        }

        try {
            // If the caller tries to play after a stream is loaded, ensure visibility.
            if (this._state.currentDescriptor) {
                this._videoElement.style.display = 'block';
            }
            await this._videoElement.play();
        } catch (error) {
            logVideoPlayerPlayFailure(error);
            throw error;
        }
    }

    public pause(): void {
        if (this._videoElement) {
            this._videoElement.pause();
        }
    }

    public stop(): void {
        this.unloadStream();
    }

    public async seekTo(positionMs: number): Promise<void> {
        if (!this._videoElement) {
            throw new Error('VideoPlayer not initialized');
        }

        // Capture reference to prevent issues if destroy() is called mid-seek
        const video = this._videoElement;
        const positionSec = Math.max(0, positionMs / 1000);
        const durationSec = video.duration || Infinity;

        video.currentTime = Math.min(positionSec, durationSec);

        return new Promise((resolve, reject) => {
            const SEEK_TIMEOUT_MS = 5000;
            let timeoutId: ReturnType<typeof setTimeout> | null = null;

            const cleanup = (): void => {
                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                video.removeEventListener('seeked', handler);
            };

            const handler = (): void => {
                cleanup();
                resolve();
            };

            video.addEventListener('seeked', handler);

            timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error('Seek operation timed out'));
            }, SEEK_TIMEOUT_MS);
        });
    }

    public async seekRelative(deltaMs: number): Promise<void> {
        const currentMs = this.getCurrentTimeMs();
        const targetMs = currentMs + deltaMs;
        return this.seekTo(targetMs);
    }

    public setVolume(level: number): void {
        if (!this._videoElement) {
            return;
        }

        // Clamp to [0, 1] - MUST NOT allow > 1.0
        const clampedLevel = Math.max(0, Math.min(1, level));
        this._videoElement.volume = clampedLevel;
        this._state.volume = clampedLevel;

        if (this._state.isMuted && clampedLevel > 0) {
            this._state.isMuted = false;
            this._videoElement.muted = false;
        }

        this._emitStateChange();
    }

    public getVolume(): number {
        return this._state.volume;
    }

    public mute(): void {
        if (!this._videoElement) {
            return;
        }

        this._videoElement.muted = true;
        this._state.isMuted = true;
        this._emitStateChange();
    }

    public unmute(): void {
        if (!this._videoElement) {
            return;
        }

        this._videoElement.muted = false;
        this._state.isMuted = false;
        this._emitStateChange();
    }

    public toggleMute(): void {
        if (this._state.isMuted) {
            this.unmute();
        } else {
            this.mute();
        }
    }

    public async setSubtitleTrack(trackId: string | null): Promise<void> {
        this._subtitleSelectionInProgress = true;
        this._subtitleSelectionRequestedId = trackId;
        try {
            // Set state first so any synchronous deactivation callbacks can reliably clear it.
            this._state.activeSubtitleId = trackId;

            this._subtitleManager.setActiveTrack(trackId);
            let finalActiveTrackId = this._subtitleManager.getActiveTrackId();
            this._state.activeSubtitleId = finalActiveTrackId;

            const deferredDeactivation = this._subtitleSelectionDeferredDeactivation;
            this._subtitleSelectionDeferredDeactivation = null;
            if (deferredDeactivation && this._state.activeSubtitleId === deferredDeactivation.trackId) {
                finalActiveTrackId = null;
                this._state.activeSubtitleId = null;
                this._logSubtitleDebug('subtitle_track_deactivated_deferred_applied', () => ({
                    trackId: deferredDeactivation.trackId,
                    reason: deferredDeactivation.reason,
                }));
            }

            const selected = trackId
                ? this._subtitleManager.getTracks().find((t) => t.id === trackId) ?? null
                : null;
            this._logSubtitleDebug('subtitle_track_selected', () => ({
                requestedId: trackId,
                finalId: finalActiveTrackId,
                codec: selected?.codec ?? null,
                language: selected?.language ?? null,
                fetchableViaKey: selected?.fetchableViaKey ?? null,
                ...(deferredDeactivation
                    ? { deferredDeactivation }
                    : {}),
            }));

            this._logSubtitleDebug('setSubtitleTrack', () => ({
                requestedId: trackId,
                finalId: finalActiveTrackId,
                nativeTextTracks: this._snapshotNativeTextTracks(),
            }));

            this._emitter.emit('trackChange', { type: 'subtitle', trackId: finalActiveTrackId });
            this._emitStateChange();
        } finally {
            this._subtitleSelectionInProgress = false;
            this._subtitleSelectionRequestedId = null;
            const deferredDeactivation = this._subtitleSelectionDeferredDeactivation;
            this._subtitleSelectionDeferredDeactivation = null;
            if (deferredDeactivation) {
                this._handleSubtitleDeactivated(deferredDeactivation.trackId, deferredDeactivation.reason);
            }
        }
    }

    /**
     * @throws PlaybackError when the player is not initialized, the track is unknown,
     * or native switching fails
     */
    public async setAudioTrack(trackId: string): Promise<void> {
        if (!this._videoElement) {
            const error: PlaybackError = {
                code: AppErrorCode.INITIALIZATION_FAILED,
                message: 'Video player not initialized',
                recoverable: false,
                retryCount: 0,
            };
            throw error;
        }

        await this._audioTrackManager.switchTrack(trackId);

        this._state.activeAudioId = this._audioTrackManager.getActiveTrackId();
        this._emitter.emit('trackChange', { type: 'audio', trackId });
        this._emitStateChange();
    }

    public getAvailableSubtitles(): SubtitleTrack[] {
        return this._subtitleManager.getTracks();
    }

    public getAvailableAudio(): AudioTrack[] {
        return this._audioTrackManager.getTracks();
    }

    public getCurrentDescriptor(): StreamDescriptor | null {
        return this._state.currentDescriptor;
    }

    private _isActiveLoad(loadGeneration: number, descriptor: StreamDescriptor): boolean {
        return this._loadGeneration === loadGeneration && this._state.currentDescriptor === descriptor;
    }

    public getState(): PlaybackState {
        return {
            status: this._state.status,
            currentTimeMs: this._state.currentTimeMs,
            durationMs: this._state.durationMs,
            bufferPercent: this._state.bufferPercent,
            volume: this._state.volume,
            isMuted: this._state.isMuted,
            playbackRate: this._state.playbackRate,
            activeSubtitleId: this._state.activeSubtitleId,
            activeAudioId: this._state.activeAudioId,
            errorInfo: this._state.errorInfo,
        };
    }

    public getCurrentTimeMs(): number {
        if (!this._videoElement) {
            return 0;
        }
        return Math.round(this._videoElement.currentTime * 1000);
    }

    public getDurationMs(): number {
        if (!this._videoElement || !isFinite(this._videoElement.duration)) {
            return this._state.durationMs;
        }
        return Math.round(this._videoElement.duration * 1000);
    }

    public isPlaying(): boolean {
        return this._state.status === 'playing';
    }

    public on<K extends keyof PlayerEventMap>(
        event: K,
        handler: (payload: PlayerEventMap[K]) => void
    ): IDisposable {
        return this._emitter.on(event, handler);
    }

    public off<K extends keyof PlayerEventMap>(
        event: K,
        handler: (payload: PlayerEventMap[K]) => void
    ): void {
        this._emitter.off(event, handler);
    }

    // Idempotent: multiple calls are safe. Never throws.
    public requestMediaSession(): void {
        if (this._mediaSessionEnabled) {
            return;
        }

        const mediaSession = this._getMediaSession();
        if (!mediaSession) {
            // Media Session not supported; do not mark as enabled
            // so future calls can retry if API becomes available
            return;
        }

        this._mediaSessionEnabled = true;

        // Install action handlers (each wrapped in try/catch for quirky implementations)
        for (let i = 0; i < MEDIA_SESSION_ACTIONS.length; i++) {
            const action = MEDIA_SESSION_ACTIONS[i];
            if (action) {
                try {
                    mediaSession.setActionHandler(action, this._createActionHandler(action));
                } catch {
                    // Some browsers throw for unsupported actions; skip and continue
                }
            }
        }

        this._syncMediaSessionMetadata();

        this._syncMediaSessionPlaybackState(this.getState());

        // Subscribe to stateChange events for ongoing updates.
        // Note: Position state (setPositionState) is best-effort and only updates on
        // status changes (play/pause), not continuously during playback. This is acceptable
        // as webOS does not surface a system-level scrubber for Media Session.
        this._mediaSessionStateChangeHandler = (state: PlaybackState): void => {
            this._syncMediaSessionPlaybackState(state);
        };
        this.on('stateChange', this._mediaSessionStateChangeHandler);
    }

    // Idempotent: multiple calls are safe. Never throws.
    public releaseMediaSession(): void {
        if (!this._mediaSessionEnabled) {
            return;
        }
        this._mediaSessionEnabled = false;

        if (this._mediaSessionStateChangeHandler) {
            this.off('stateChange', this._mediaSessionStateChangeHandler);
            this._mediaSessionStateChangeHandler = null;
        }

        const mediaSession = this._getMediaSession();
        if (!mediaSession) {
            return;
        }

        for (let i = 0; i < MEDIA_SESSION_ACTIONS.length; i++) {
            const action = MEDIA_SESSION_ACTIONS[i];
            if (action) {
                try {
                    mediaSession.setActionHandler(action, null);
                } catch {
                    // Some browsers may throw for unsupported actions; ignore
                }
            }
        }

        try {
            mediaSession.metadata = null;
        } catch {
            // Ignore
        }
        try {
            mediaSession.playbackState = 'none';
        } catch {
            // Ignore
        }
    }

    private _createInitialState(): VideoPlayerInternalState {
        return {
            status: 'idle',
            currentTimeMs: 0,
            durationMs: 0,
            bufferPercent: 0,
            volume: 1.0,
            isMuted: false,
            playbackRate: 1.0,
            activeSubtitleId: null,
            activeAudioId: null,
            errorInfo: null,
            currentDescriptor: null,
        };
    }

    private _updateStatus(status: PlayerStatus): void {
        if (this._state.status !== status) {
            this._state.status = status;
            this._emitStateChange();
        }
    }

    private _emitStateChange(): void {
        this._emitter.emit('stateChange', this.getState());
    }

    private _getMediaSession(): MediaSessionLike | null {
        if (typeof navigator === 'undefined') {
            return null;
        }

        if (!('mediaSession' in navigator)) {
            return null;
        }

        const candidate = (navigator as { mediaSession?: unknown }).mediaSession;

        if (
            typeof candidate !== 'object' ||
            candidate === null ||
            typeof (candidate as { setActionHandler?: unknown }).setActionHandler !== 'function'
        ) {
            return null;
        }

        return candidate as MediaSessionLike;
    }

    private _createActionHandler(action: MediaSessionActionLike): MediaSessionActionHandlerLike {
        return (details: unknown): void => {
            if (!this._videoElement) {
                return;
            }

            switch (action) {
                case 'play':
                    void this.play().catch((error: unknown) => {
                        this._warnMediaSessionActionFailure('play', error);
                    });
                    break;

                case 'pause':
                    this.pause();
                    break;

                case 'stop':
                    this.stop();
                    break;

                case 'seekto': {
                    const seekTimeSec = this._extractSeekTime(details);
                    if (seekTimeSec !== null) {
                        void this.seekTo(seekTimeSec * 1000).catch((error: unknown) => {
                            this._warnMediaSessionActionFailure('seekto', error);
                        });
                    }
                    break;
                }

                case 'seekbackward': {
                    const offsetSec = this._extractSeekOffset(details);
                    void this.seekRelative(-offsetSec * 1000).catch((error: unknown) => {
                        this._warnMediaSessionActionFailure('seekbackward', error);
                    });
                    break;
                }

                case 'seekforward': {
                    const offsetSec = this._extractSeekOffset(details);
                    void this.seekRelative(offsetSec * 1000).catch((error: unknown) => {
                        this._warnMediaSessionActionFailure('seekforward', error);
                    });
                    break;
                }

                default:
                    return;
            }
        };
    }

    private _warnMediaSessionActionFailure(action: MediaSessionActionLike, error: unknown): void {
        const now = Date.now();
        const key = `mediaSession:${action}`;
        const last = this._mediaSessionFailureTimestamps.get(key) ?? 0;
        if (now - last < 5000) {
            return;
        }
        if (this._mediaSessionFailureTimestamps.size > 20) {
            this._mediaSessionFailureTimestamps.clear();
        }
        this._mediaSessionFailureTimestamps.set(key, now);
        logVideoPlayerMediaSessionActionFailure(action, error);
    }

    private _extractSeekTime(details: unknown): number | null {
        if (
            typeof details === 'object' &&
            details !== null &&
            'seekTime' in details
        ) {
            const seekTime = (details as { seekTime: unknown }).seekTime;
            if (typeof seekTime === 'number' && isFinite(seekTime)) {
                return seekTime;
            }
        }
        return null;
    }

    private _extractSeekOffset(details: unknown): number {
        if (
            typeof details === 'object' &&
            details !== null &&
            'seekOffset' in details
        ) {
            const seekOffset = (details as { seekOffset: unknown }).seekOffset;
            if (typeof seekOffset === 'number' && isFinite(seekOffset)) {
                return seekOffset;
            }
        }
        // Use config if available and finite, else default 10 seconds
        if (
            this._config &&
            typeof this._config.seekIncrementSec === 'number' &&
            isFinite(this._config.seekIncrementSec)
        ) {
            return this._config.seekIncrementSec;
        }
        return 10;
    }

    private _syncMediaSessionMetadata(): void {
        if (!this._mediaSessionEnabled) {
            return;
        }

        const mediaSession = this._getMediaSession();
        if (!mediaSession) {
            return;
        }

        const descriptor = this._state.currentDescriptor;
        if (!descriptor) {
            try {
                mediaSession.metadata = null;
            } catch {
                // Ignore
            }
            return;
        }

        const MediaMetadataConstructor = this._getMediaMetadataConstructor();
        if (!MediaMetadataConstructor) {
            try {
                mediaSession.metadata = null;
            } catch {
                // Ignore
            }
            return;
        }

        const metadata = descriptor.mediaMetadata;
        const init: {
            title: string;
            artist?: string;
            album?: string;
            artwork?: Array<{ src: string; sizes: string; type: string }>;
        } = {
            title: metadata.title,
        };

        if (metadata.subtitle) {
            init.artist = metadata.subtitle;
        }

        if (metadata.year !== undefined) {
            init.album = String(metadata.year);
        }

        if (metadata.thumb) {
            init.artwork = [
                { src: metadata.thumb, sizes: '512x512', type: 'image/jpeg' },
            ];
        }

        try {
            mediaSession.metadata = new MediaMetadataConstructor(init);
        } catch {
            // MediaMetadata constructor can throw for invalid inputs; fall back to null
            mediaSession.metadata = null;
        }
    }

    private _getMediaMetadataConstructor(): (new (init: unknown) => unknown) | null {
        const candidate = (globalThis as { MediaMetadata?: unknown }).MediaMetadata;
        if (typeof candidate === 'function') {
            return candidate as new (init: unknown) => unknown;
        }
        return null;
    }

    private _syncMediaSessionPlaybackState(state: PlaybackState): void {
        if (!this._mediaSessionEnabled) {
            return;
        }

        const mediaSession = this._getMediaSession();
        if (!mediaSession) {
            return;
        }

        // Map player status to media session playback state (wrapped for quirky implementations)
        try {
            if (state.status === 'playing') {
                mediaSession.playbackState = 'playing';
            } else if (state.status === 'paused') {
                mediaSession.playbackState = 'paused';
            } else {
                mediaSession.playbackState = 'none';
            }
        } catch {
            // Ignore
        }

        this._syncMediaSessionPositionState(state);
    }

    private _syncMediaSessionPositionState(state: PlaybackState): void {
        const mediaSession = this._getMediaSession();
        if (
            !mediaSession ||
            typeof mediaSession.setPositionState !== 'function'
        ) {
            return;
        }

        // Only set position for non-live content with valid duration
        const descriptor = this._state.currentDescriptor;
        if (!descriptor || descriptor.isLive) {
            return;
        }

        if (state.durationMs <= 0 || !isFinite(state.durationMs)) {
            return;
        }

        const duration = state.durationMs / 1000;
        let position = state.currentTimeMs / 1000;
        const playbackRate = state.playbackRate;

        if (!isFinite(duration) || !isFinite(position) || !isFinite(playbackRate)) {
            return;
        }

        position = Math.max(0, Math.min(position, duration));

        try {
            mediaSession.setPositionState({
                duration,
                position,
                playbackRate,
            });
        } catch {
            // Some browsers may throw for invalid values; ignore
        }
    }

}
