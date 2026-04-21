import type {
    VideoPlayerConfig,
    StreamDescriptor,
    PlaybackState,
    SubtitleTrack,
    AudioTrack,
    PlayerEventMap,
} from './types';

export interface IVideoPlayer {
    initialize(config: VideoPlayerConfig): Promise<void>;
    destroy(): void;
    loadStream(descriptor: StreamDescriptor): Promise<void>;
    unloadStream(): void;
    play(): Promise<void>;
    pause(): void;
    stop(): void;
    seekTo(positionMs: number): Promise<void>;
    seekRelative(deltaMs: number): Promise<void>;
    setVolume(level: number): void;
    getVolume(): number;
    mute(): void;
    unmute(): void;
    toggleMute(): void;
    setSubtitleTrack(trackId: string | null): Promise<void>;

    /**
     * Set the active audio track.
     * @param trackId - Audio track ID to activate
     * @throws {PlaybackError}
     * Rejects with TRACK_NOT_FOUND when the player is not initialized or the track ID is unknown.
     * Rejects with CODEC_UNSUPPORTED, TRACK_SWITCH_TIMEOUT, or TRACK_SWITCH_FAILED when native
     * switching cannot complete.
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
    ): void;
    off<K extends keyof PlayerEventMap>(
        event: K,
        handler: (payload: PlayerEventMap[K]) => void
    ): void;
    requestMediaSession(): void;
    releaseMediaSession(): void;
}
