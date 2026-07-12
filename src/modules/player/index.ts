export { VideoPlayer } from './core/VideoPlayer';
export { mapMediaErrorCodeToPlaybackError } from './core/ErrorHandler';
export { SubtitleManager } from './subtitles/SubtitleManager';
export { PlaybackRecoveryManager } from './recovery/PlaybackRecoveryManager';
export { normalizeSeekIncrementSeconds } from './tracks/SeekIncrementPolicy';
export { formatAudioLabel } from './tracks/formatAudioLabel';

export type { IVideoPlayer } from './core/interfaces';
export type {
    PlaybackRecoveryDeps,
    BurnInSubtitleRecoveryResult,
    AudioTrackReloadResult,
    DisableBurnInSubtitlesResult,
} from './recovery/PlaybackRecoveryManager';
export type { PreparedPlaybackStream } from './recovery/PreparedPlaybackStream';

export type {
    VideoPlayerConfig,
    StreamDescriptor,
    MediaMetadata,
    SubtitleTrack,
    AudioTrack,
    PlaybackState,
    PlayerStatus,
    PlaybackError,
    TimeRange,
    PlayerEventMap,
} from './core/types';
