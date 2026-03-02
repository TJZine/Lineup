import type { AppError } from '../modules/lifecycle';
import {
    mapPlayerErrorCodeToAppErrorCode,
    type PlaybackError,
    type PlaybackState,
    type TimeRange,
} from '../modules/player';

type PlayerTimeUpdatePayload = {
    currentTimeMs: number;
    durationMs: number;
};

type PlayerBufferUpdatePayload = {
    percent: number;
    bufferedRanges: TimeRange[];
};

export interface PlaybackRuntimeControllerDeps {
    isStreamRecoveryInProgress(): boolean;
    getActiveTranscodeSessionId(): string | null;
    stopTranscodeSession(sessionId: string): void;
    skipToNextProgram(): void;
    handleGlobalError(error: AppError, context: string): void;
    handlePlaybackFailure(context: string, error: unknown): void;
    onPlayerStateChange(state: PlaybackState): void;
    shouldAutoShowInfoBannerOnNextPlay(): boolean;
    clearAutoShowInfoBannerOnNextPlay(): void;
    showInfoBanner(): void;
    onPlayerTimeUpdate(payload: PlayerTimeUpdatePayload): void;
    onPlayerBufferUpdate(payload: PlayerBufferUpdatePayload): void;
}

export class PlaybackRuntimeController {
    constructor(private readonly _deps: PlaybackRuntimeControllerDeps) {}

    public handlePlayerEnded(): void {
        if (this._deps.isStreamRecoveryInProgress()) {
            return;
        }

        this.stopActiveTranscodeSession();
        this._deps.skipToNextProgram();
    }

    public handlePlaybackError(error: PlaybackError): void {
        if (error.recoverable) {
            this._deps.handleGlobalError(
                {
                    code: mapPlayerErrorCodeToAppErrorCode(error.code),
                    message: error.message,
                    recoverable: true,
                },
                'video-player'
            );
            return;
        }

        this._deps.handlePlaybackFailure('video-player', error);
    }

    public handlePlayerStateChange(state: PlaybackState): void {
        this._deps.onPlayerStateChange(state);

        if (
            state.status === 'playing' &&
            this._deps.shouldAutoShowInfoBannerOnNextPlay()
        ) {
            this._deps.clearAutoShowInfoBannerOnNextPlay();
            this._deps.showInfoBanner();
        }
    }

    public handlePlayerTimeUpdate(payload: PlayerTimeUpdatePayload): void {
        this._deps.onPlayerTimeUpdate(payload);
    }

    public handlePlayerBufferUpdate(payload: PlayerBufferUpdatePayload): void {
        this._deps.onPlayerBufferUpdate(payload);
    }

    public stopActiveTranscodeSession(): void {
        const sessionId = this._deps.getActiveTranscodeSessionId();
        if (!sessionId) {
            return;
        }

        this._deps.stopTranscodeSession(sessionId);
    }
}
