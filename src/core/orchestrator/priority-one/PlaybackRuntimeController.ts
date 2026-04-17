import type { AppError } from '../../../modules/lifecycle';
import {
    mapPlayerErrorCodeToAppErrorCode,
    type PlaybackError,
    type PlaybackState,
    type TimeRange,
} from '../../../modules/player';

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
    pausePlayer(): void;
    playPlayer(): Promise<void>;
    pauseSchedulerSync(): void;
    resumeSchedulerSync(): void;
    syncSchedulerToCurrentTime(): void;
    saveLifecycleState(): Promise<void>;
    handleGlobalError(error: AppError, context: string): void;
    handlePlaybackFailure(context: string, error: unknown): void;
    onPlayerStateChange(state: PlaybackState): void;
    shouldAutoShowInfoBannerOnNextPlay(): boolean;
    clearAutoShowInfoBannerOnNextPlay(): void;
    showInfoBanner(): void;
    onPlayerTimeUpdate(payload: PlayerTimeUpdatePayload): void;
    onPlayerBufferUpdate(payload: PlayerBufferUpdatePayload): void;
}

export interface OverlayReadinessSnapshot {
    pendingReason: 'none' | 'program-start';
    pendingSinceMs: number | null;
    lastReadyAtMs: number | null;
}

export class PlaybackRuntimeController {
    private _lastProgramStartPromise: Promise<void> | null = null;
    private _overlayReadiness: OverlayReadinessSnapshot = {
        pendingReason: 'none',
        pendingSinceMs: null,
        lastReadyAtMs: null,
    };

    constructor(private readonly _deps: PlaybackRuntimeControllerDeps) {}

    public trackProgramStart(promise: Promise<void>): Promise<void> {
        this._lastProgramStartPromise = promise;
        this._overlayReadiness.pendingReason = 'program-start';
        this._overlayReadiness.pendingSinceMs = Date.now();

        void promise
            .catch(() => {
                if (this._lastProgramStartPromise !== promise) {
                    return;
                }
                this._overlayReadiness.pendingReason = 'none';
                this._overlayReadiness.pendingSinceMs = null;
            })
            .finally(() => {
                if (this._lastProgramStartPromise === promise) {
                    this._lastProgramStartPromise = null;
                }
            });

        return promise;
    }

    public isOverlayReopenSafe(): boolean {
        return this._overlayReadiness.pendingReason === 'none';
    }

    public getOverlayReadinessSnapshot(): OverlayReadinessSnapshot {
        return {
            ...this._overlayReadiness,
        };
    }

    public async handleLifecyclePause(): Promise<void> {
        this._deps.pausePlayer();
        this._deps.pauseSchedulerSync();
        await this._deps.saveLifecycleState();
    }

    public async handleLifecycleResume(): Promise<void> {
        const lastProgramStartBefore = this._lastProgramStartPromise;

        this._deps.resumeSchedulerSync();
        this._deps.syncSchedulerToCurrentTime();

        const lastProgramStartAfter = this._lastProgramStartPromise;

        if (
            lastProgramStartAfter &&
            lastProgramStartAfter !== lastProgramStartBefore
        ) {
            await lastProgramStartAfter;
            return;
        }

        await this._deps.playPlayer();
    }

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

        if (state.status === 'playing' && this._overlayReadiness.pendingReason !== 'none') {
            this._overlayReadiness.pendingReason = 'none';
            this._overlayReadiness.pendingSinceMs = null;
            this._overlayReadiness.lastReadyAtMs = Date.now();
        }

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
