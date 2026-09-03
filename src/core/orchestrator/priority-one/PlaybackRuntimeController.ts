import {
    type PlaybackError,
    type PlaybackState,
    type TimeRange,
} from '../../../modules/player';
import { emitBestEffortWarning, summarizeErrorForLog } from '../../../utils/errors';
import type {
    PriorityOnePlaybackRuntimePort,
    PriorityOnePlayerEventPort,
    PriorityOneSchedulerRuntimePort,
    PriorityOneUiRuntimePort,
    RecoverableAsyncFailureReporter,
} from '../runtime/OrchestratorRuntimeSeams';
import type { PlaybackStartOutcome } from '../../../types/playbackStart';

type PlayerTimeUpdatePayload = {
    currentTimeMs: number;
    durationMs: number;
};

type PlayerBufferUpdatePayload = {
    percent: number;
    bufferedRanges: TimeRange[];
};

export interface PlaybackRuntimeControllerDeps {
    playback: PriorityOnePlaybackRuntimePort;
    schedulerRuntime: PriorityOneSchedulerRuntimePort;
    playerEvents: PriorityOnePlayerEventPort;
    uiRuntime: Pick<
        PriorityOneUiRuntimePort,
        'handleGlobalError' | 'showInfoBanner'
    >;
    saveLifecycleState(): Promise<void>;
    reportRecoverableAsyncFailure: RecoverableAsyncFailureReporter;
}

export interface OverlayReadinessSnapshot {
    pendingReason: 'none' | 'program-start';
    pendingSinceMs: number | null;
    lastReadyAtMs: number | null;
}

export class PlaybackRuntimeController {
    private _lastProgramStartPromise: Promise<PlaybackStartOutcome> | null = null;
    private _nextProgramStartWaiter: {
        resolve: (outcome: PlaybackStartOutcome) => void;
        signal: AbortSignal | undefined;
        onAbort: () => void;
    } | null = null;
    private _overlayReadiness: OverlayReadinessSnapshot = {
        pendingReason: 'none',
        pendingSinceMs: null,
        lastReadyAtMs: null,
    };

    constructor(private readonly _deps: PlaybackRuntimeControllerDeps) {}

    private _getActiveTranscodeSessionId(): string | null {
        const decision = this._deps.playback.playbackState.getCurrentStreamDecision();
        if (!decision || !decision.isTranscoding || !decision.sessionId) {
            return null;
        }

        return decision.sessionId;
    }

    public trackProgramStart(promise: Promise<PlaybackStartOutcome>): Promise<PlaybackStartOutcome> {
        this._lastProgramStartPromise = promise;
        this._overlayReadiness.pendingReason = 'program-start';
        this._overlayReadiness.pendingSinceMs = Date.now();

        const waiter = this._takeNextProgramStartWaiter();
        if (waiter) {
            void promise.then(waiter.resolve, () => waiter.resolve({ kind: 'failed' }));
        }

        void promise
            .then((outcome) => {
                if (
                    outcome.kind !== 'started'
                    && this._lastProgramStartPromise === promise
                ) {
                    this._overlayReadiness.pendingReason = 'none';
                    this._overlayReadiness.pendingSinceMs = null;
                }
            })
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

    public waitForNextProgramStart(signal?: AbortSignal): Promise<PlaybackStartOutcome> {
        this._settleNextProgramStartWaiter({ kind: 'superseded' });
        if (signal?.aborted) return Promise.resolve({ kind: 'superseded' });

        return new Promise((resolve) => {
            const onAbort = (): void => {
                if (this._nextProgramStartWaiter?.resolve !== resolve) return;
                this._settleNextProgramStartWaiter({ kind: 'superseded' });
            };
            this._nextProgramStartWaiter = { resolve, signal, onAbort };
            signal?.addEventListener('abort', onAbort, { once: true });
        });
    }

    private _takeNextProgramStartWaiter(): typeof this._nextProgramStartWaiter {
        const waiter = this._nextProgramStartWaiter;
        this._nextProgramStartWaiter = null;
        waiter?.signal?.removeEventListener('abort', waiter.onAbort);
        return waiter;
    }

    private _settleNextProgramStartWaiter(outcome: PlaybackStartOutcome): void {
        this._takeNextProgramStartWaiter()?.resolve(outcome);
    }

    public dispose(): void {
        this._settleNextProgramStartWaiter({ kind: 'superseded' });
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
        this._deps.playback.pausePlayer();
        this._deps.schedulerRuntime.pauseSchedulerSync();
        await this._deps.saveLifecycleState();
    }

    public async handleLifecycleResume(): Promise<void> {
        const lastProgramStartBefore = this._lastProgramStartPromise;

        this._deps.schedulerRuntime.resumeSchedulerSync();
        this._deps.schedulerRuntime.syncSchedulerToCurrentTime();

        const lastProgramStartAfter = this._lastProgramStartPromise;

        if (
            lastProgramStartAfter &&
            lastProgramStartAfter !== lastProgramStartBefore
        ) {
            await lastProgramStartAfter;
            return;
        }

        await this._deps.playback.playPlayer();
    }

    public handlePlayerEnded(): void {
        if (this._deps.playback.playbackRecovery.isStreamRecoveryInProgress()) {
            return;
        }

        this.stopActiveTranscodeSession();
        this._deps.playback.skipToNextProgram();
    }

    public handlePlaybackError(error: PlaybackError): void {
        const playbackRecovery = this._deps.playback.playbackRecovery;
        if (playbackRecovery.isStreamRecoveryInProgress()) {
            return;
        }

        if (error.recoverable) {
            this._deps.uiRuntime.handleGlobalError(
                {
                    code: error.code,
                    message: error.message,
                    recoverable: true,
                },
                'video-player'
            );
            return;
        }

        this._handleNonRecoverablePlaybackError(error).catch((handlerError: unknown) => {
            this._reportRecoverableAsyncFailureSafely(
                'orchestrator.playbackRuntime.handleNonRecoverablePlaybackError',
                'Non-recoverable playback error handler rejected',
                handlerError,
                {
                    context: 'video-player',
                    playbackError: summarizeErrorForLog(error),
                }
            );
        });
    }

    private async _handleNonRecoverablePlaybackError(error: PlaybackError): Promise<void> {
        const playbackRecovery = this._deps.playback.playbackRecovery;
        try {
            const fallbackApplied = await playbackRecovery.attemptTranscodeFallbackForCurrentProgram?.('video-player');
            if (fallbackApplied) {
                return;
            }
        } catch (fallbackError: unknown) {
            this._reportRecoverableAsyncFailureSafely(
                'orchestrator.playbackRecovery.attemptTranscodeFallbackForCurrentProgram',
                'Playback transcode fallback handler threw',
                fallbackError,
                {
                    context: 'video-player',
                    playbackError: summarizeErrorForLog(error),
                }
            );
        }

        if (playbackRecovery.handlePlaybackFailure) {
            try {
                playbackRecovery.handlePlaybackFailure('video-player', error);
                return;
            } catch (handlerError: unknown) {
                this._reportRecoverableAsyncFailureSafely(
                    'orchestrator.playbackRecovery.handlePlaybackFailure',
                    'Playback recovery failure handler threw',
                    handlerError,
                    {
                        context: 'video-player',
                        playbackError: summarizeErrorForLog(error),
                    }
                );
                // Fall through so fatal playback errors still reach the UI error surface.
            }
        }

        this._deps.uiRuntime.handleGlobalError(
            {
                code: error.code,
                message: error.message,
                recoverable: false,
            },
            'video-player'
        );
    }

    private _reportRecoverableAsyncFailureSafely(
        event: string,
        message: string,
        error: unknown,
        data?: Record<string, unknown>
    ): void {
        try {
            this._deps.reportRecoverableAsyncFailure(event, message, error, data);
        } catch (reporterError: unknown) {
            emitBestEffortWarning('Recoverable failure reporter threw', {
                subsystem: 'playback-runtime',
                event,
                reporterError: summarizeErrorForLog(reporterError),
                originalError: summarizeErrorForLog(error),
            });
        }
    }

    public handlePlayerStateChange(state: PlaybackState): void {
        this._deps.playerEvents.onPlayerStateChange(state);

        if (state.status === 'playing' && this._overlayReadiness.pendingReason !== 'none') {
            this._overlayReadiness.pendingReason = 'none';
            this._overlayReadiness.pendingSinceMs = null;
            this._overlayReadiness.lastReadyAtMs = Date.now();
        }

        if (
            state.status === 'playing' &&
            this._deps.playback.playbackState.getShouldAutoShowInfoBannerOnNextPlay()
        ) {
            this._deps.playback.playbackState.setShouldAutoShowInfoBannerOnNextPlay(false);
            this._deps.uiRuntime.showInfoBanner();
        }
    }

    public handlePlayerTimeUpdate(payload: PlayerTimeUpdatePayload): void {
        this._deps.playerEvents.onPlayerTimeUpdate(payload);
    }

    public handlePlayerBufferUpdate(payload: PlayerBufferUpdatePayload): void {
        this._deps.playerEvents.onPlayerBufferUpdate(payload);
    }

    public stopActiveTranscodeSession(): void {
        const sessionId = this._getActiveTranscodeSessionId();
        if (!sessionId) {
            return;
        }

        this._deps.playback.stopTranscodeSessionById(sessionId);
    }
}
