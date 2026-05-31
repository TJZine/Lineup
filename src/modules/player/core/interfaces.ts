import type {
    VideoPlayerConfig,
    StreamDescriptor,
    PlaybackState,
    SubtitleTrack,
    AudioTrack,
    PlayerEventMap,
} from './types';
import type { IDisposable } from '../../../utils/interfaces';

export interface IVideoPlayer {
    /**
     * Create and attach the underlying video element.
     * Rejects with PlaybackError when the configured container cannot be found.
     */
    initialize(config: VideoPlayerConfig): Promise<void>;
    destroy(): void;

    /**
     * Replace the current stream and wait until media can play.
     * Rejects with PlaybackError when the player is not initialized, preferred
     * subtitle activation rejects, media readiness fails, or media readiness
     * times out. Media errors after a successful load are reported through the
     * `error` event only when retry policy determines they are unrecoverable.
     */
    loadStream(descriptor: StreamDescriptor): Promise<void>;
    unloadStream(): void;

    /**
     * Request native playback.
     * Rejects with PlaybackError when the player is not initialized. Native
     * `video.play()` rejections are returned to the caller unchanged and are not
     * converted into player `error` events.
     */
    play(): Promise<void>;
    pause(): void;
    stop(): void;

    /**
     * Seek to an absolute position in milliseconds.
     * Rejects with PlaybackError when the player is not initialized or the
     * native `seeked` event is not observed before the seek timeout.
     */
    seekTo(positionMs: number): Promise<void>;

    /**
     * Seek relative to the current position in milliseconds.
     * Delegates to `seekTo()` and preserves its rejection behavior.
     */
    seekRelative(deltaMs: number): Promise<void>;
    setVolume(level: number): void;
    getVolume(): number;
    mute(): void;
    unmute(): void;
    toggleMute(): void;

    /**
     * Set the active subtitle track, or disable subtitles with `null`.
     * Rejects with PlaybackError when the subtitle manager cannot activate the
     * requested track. Successful and deferred deactivation paths report track
     * changes through state updates and `trackChange` events.
     */
    setSubtitleTrack(trackId: string | null): Promise<void>;

    /**
     * Set the active audio track.
     * @param trackId - Audio track ID to activate
     * @throws {PlaybackError}
     * Rejects with INITIALIZATION_FAILED when the player is not initialized.
     * Rejects with TRACK_NOT_FOUND when the track ID is unknown.
     * Rejects with CODEC_UNSUPPORTED, TRACK_SWITCH_TIMEOUT, or TRACK_SWITCH_FAILED when native
     * switching cannot complete; delegated AudioTrackManager errors are preserved.
     */
    setAudioTrack(trackId: string): Promise<void>;

    getAvailableSubtitles(): SubtitleTrack[];
    getAvailableAudio(): AudioTrack[];
    getCurrentDescriptor?(): StreamDescriptor | null;
    getState(): PlaybackState;
    getCurrentTimeMs(): number;
    getDurationMs(): number;
    isPlaying(): boolean;
    on<K extends keyof PlayerEventMap>(
        event: K,
        handler: (payload: PlayerEventMap[K]) => void
    ): IDisposable;
    off<K extends keyof PlayerEventMap>(
        event: K,
        handler: (payload: PlayerEventMap[K]) => void
    ): void;
    requestMediaSession(): void;
    releaseMediaSession(): void;
}
