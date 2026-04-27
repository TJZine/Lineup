import { AppErrorCode } from '../../types/app-errors';
import type { AudioTrack, PlaybackError } from './types';
import { AUDIO_TRACK_SWITCH_TIMEOUT_MS } from './constants';
import { SUPPORTED_AUDIO_CODECS } from '../plex/stream/constants';
import type { AudioSettingsStore } from '../settings/AudioSettingsStore';

/**
 * Interface for audio track in HTMLVideoElement.
 * Not all browsers support this - used for HLS audio track switching.
 */
interface WebOSAudioTrack {
    id: string;
    enabled: boolean;
    kind: string;
    label: string;
    language: string;
}

/**
 * Interface for audio track list in HTMLVideoElement.
 */
interface WebOSAudioTrackList {
    length: number;
    [index: number]: WebOSAudioTrack | undefined;
}

/**
 * Extended HTMLVideoElement interface for webOS.
 */
interface HTMLVideoElementWithAudioTracks extends HTMLVideoElement {
    audioTracks?: WebOSAudioTrackList;
}

/** Maximum retry attempts for audio track switch */
const AUDIO_TRACK_MAX_RETRIES = 1;

/** Polling interval for track switch verification */
const TRACK_SWITCH_POLL_INTERVAL_MS = 100;

/**
 * Manages audio track switching with retry logic.
 */
export type AudioTrackManagerDeps = {
    audioSettingsStore: Pick<AudioSettingsStore, 'readDtsPassthroughEnabledAndClean'>;
};

export class AudioTrackManager {
    /** Reference to the video element */
    private _videoElement: HTMLVideoElement | null = null;

    /** Available audio tracks */
    private _tracks: AudioTrack[] = [];

    /** Currently active track ID */
    private _activeTrackId: string | null = null;

    private readonly _audioSettingsStore: Pick<AudioSettingsStore, 'readDtsPassthroughEnabledAndClean'>;

    constructor(deps: AudioTrackManagerDeps) {
        this._audioSettingsStore = deps.audioSettingsStore;
    }

    public initialize(videoElement: HTMLVideoElement): void {
        this._videoElement = videoElement;
    }

    public setTracks(tracks: AudioTrack[]): void {
        this._tracks = tracks;
        // Set first track as active if none set
        if (!this._activeTrackId && tracks.length > 0) {
            const defaultTrack = tracks.find((t) => t.default) || tracks[0];
            if (defaultTrack) {
                this._activeTrackId = defaultTrack.id;
            }
        }
    }

    public getTracks(): AudioTrack[] {
        return [...this._tracks];
    }

    public getActiveTrackId(): string | null {
        return this._activeTrackId;
    }

    /**
     * Switch to a different audio track with retry-on-failure.
     * @param trackId - Target track ID
     * @throws PlaybackError if switch fails (TRACK_NOT_FOUND, CODEC_UNSUPPORTED, TRACK_SWITCH_TIMEOUT, TRACK_SWITCH_FAILED)
     */
    public async switchTrack(trackId: string): Promise<void> {
        if (!this._videoElement) {
            throw this._createError(AppErrorCode.INITIALIZATION_FAILED, 'Video element not initialized');
        }

        const targetTrack = this._tracks.find((t) => t.id === trackId);
        if (!targetTrack) {
            throw this._createError(AppErrorCode.TRACK_NOT_FOUND, `Audio track ${trackId} not found`);
        }

        const videoWithTracks = this._videoElement as HTMLVideoElementWithAudioTracks;
        const audioTracks = videoWithTracks.audioTracks;

        if (!audioTracks || audioTracks.length === 0) {
            // No native audio tracks - just update state
            this._activeTrackId = trackId;
            return;
        }

        // Check codec support before attempting native track switching.
        if (targetTrack.codec && !this._isCodecSupported(targetTrack.codec)) {
            throw this._createError(
                AppErrorCode.CODEC_UNSUPPORTED,
                `Audio codec '${targetTrack.codec}' is not supported`
            );
        }

        const previousTrackId = this._activeTrackId;
        let lastError: PlaybackError | null = null;
        let isTimeoutError = false;
        let restoreFailure: string | null = null;

        // Try with retry
        for (let attempt = 0; attempt <= AUDIO_TRACK_MAX_RETRIES; attempt++) {
            try {
                await this._switchWithTimeout(audioTracks, targetTrack);
                this._activeTrackId = trackId;
                return;
            } catch (error) {
                lastError = error as PlaybackError;

                // Don't retry timeout errors - preserve the timeout error
                if ((error as PlaybackError).code === AppErrorCode.TRACK_SWITCH_TIMEOUT) {
                    isTimeoutError = true;
                    break;
                }

                // Log retry
            }
        }

        // Failed after retries - try to restore previous track
        if (previousTrackId && previousTrackId !== trackId) {
            try {
                this._restoreTrack(audioTracks, previousTrackId);
            } catch (restoreError) {
                restoreFailure = this._getErrorMessage(restoreError);
            }
        }

        // If it was a timeout error, throw TRACK_SWITCH_TIMEOUT (not TRACK_SWITCH_FAILED)
        if (isTimeoutError && lastError) {
            throw this._withRestoreFailure(lastError, restoreFailure);
        }

        // Throw TRACK_SWITCH_FAILED after retry for non-timeout errors
        throw this._createError(
            AppErrorCode.TRACK_SWITCH_FAILED,
            `Failed to switch to audio track ${trackId} after retry`,
            lastError,
            restoreFailure
        );
    }

    public unload(): void {
        this._tracks = [];
        this._activeTrackId = null;
    }

    public destroy(): void {
        this._videoElement = null;
        this._tracks = [];
        this._activeTrackId = null;
    }

    private _isCodecSupported(codec: string): boolean {
        const normalizedCodec = codec.toLowerCase().trim();
        if (normalizedCodec === 'dts' || normalizedCodec === 'dca' || normalizedCodec.startsWith('dts')) {
            return this._audioSettingsStore.readDtsPassthroughEnabledAndClean(false);
        }
        return SUPPORTED_AUDIO_CODECS.some(
            (supported) => normalizedCodec === supported || normalizedCodec.startsWith(supported)
        );
    }

    private async _switchWithTimeout(
        audioTracks: WebOSAudioTrackList,
        targetTrack: AudioTrack
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                clearInterval(checkInterval);
                reject(
                    this._createError(AppErrorCode.TRACK_SWITCH_TIMEOUT, 'Audio switch timed out')
                );
            }, AUDIO_TRACK_SWITCH_TIMEOUT_MS);

            // Find and enable the target track
            for (let i = 0; i < audioTracks.length; i++) {
                const track = audioTracks[i];
                if (track) {
                    track.enabled = track.id === targetTrack.id;
                }
            }

            // Immediate check before polling - track switch may be instantaneous
            for (let i = 0; i < audioTracks.length; i++) {
                if (audioTracks[i]?.id === targetTrack.id && audioTracks[i]?.enabled) {
                    clearTimeout(timeout);
                    resolve();
                    return;
                }
            }

            // Verify switch with polling - find by ID, not index
            // AudioTrack.index is media-relative, not array-relative
            const checkInterval = setInterval(() => {
                let matchedTrack: WebOSAudioTrack | undefined;
                for (let i = 0; i < audioTracks.length; i++) {
                    if (audioTracks[i]?.id === targetTrack.id) {
                        matchedTrack = audioTracks[i];
                        break;
                    }
                }
                if (matchedTrack?.enabled) {
                    clearTimeout(timeout);
                    clearInterval(checkInterval);
                    resolve();
                }
            }, TRACK_SWITCH_POLL_INTERVAL_MS);
        });
    }

    private _restoreTrack(
        audioTracks: WebOSAudioTrackList,
        trackId: string
    ): void {
        for (let i = 0; i < audioTracks.length; i++) {
            const track = audioTracks[i];
            if (track) {
                track.enabled = track.id === trackId;
            }
        }
    }

    private _getErrorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }

    private _withRestoreFailure(
        error: PlaybackError,
        restoreFailure: string | null
    ): PlaybackError {
        if (!restoreFailure) {
            return error;
        }
        return {
            ...error,
            context: {
                ...(error.context ?? {}),
                restoreFailure,
            },
        };
    }

    private _createError(
        code: AppErrorCode,
        message: string,
        cause?: PlaybackError | null,
        restoreFailure?: string | null
    ): PlaybackError {
        const error: PlaybackError = {
            code,
            message,
            recoverable: false,
            retryCount: 0,
        };
        if (cause || restoreFailure) {
            error.context = {};
            if (cause) {
                error.context.cause = cause.message;
            }
            if (restoreFailure) {
                error.context.restoreFailure = restoreFailure;
            }
        }
        return error;
    }
}
