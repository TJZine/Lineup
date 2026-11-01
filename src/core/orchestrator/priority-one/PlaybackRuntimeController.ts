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
import {
    scheduledProgramIdentitiesMatch,
    type ScheduledProgramIdentity,
} from '../../../modules/scheduler/scheduler';
import type { ActiveMediaIdentity } from '../../channel-authoring-runtime/ChannelAuthoringRuntimeContracts';

type PlayerTimeUpdatePayload = {
    currentTimeMs: number;
    durationMs: number;
};

type PlayerBufferUpdatePayload = {
    percent: number;
    bufferedRanges: TimeRange[];
};

let nextNativeSessionId = 0;

export interface PlaybackRuntimeControllerDeps {
    playback: PriorityOnePlaybackRuntimePort;
    schedulerRuntime: PriorityOneSchedulerRuntimePort;
    playerEvents: PriorityOnePlayerEventPort;
    uiRuntime: Pick<
        PriorityOneUiRuntimePort,
        'handleGlobalError'
    >;
    saveLifecycleState(): Promise<void>;
    reconcileSleepExpiration(): boolean;
    stopPlayback(): void;
    hasSelectedChannel(): boolean;
    getScheduledChannelId(): string | null;
    getScheduledProgramIdentity(): ScheduledProgramIdentity | null;
    getCommittedDescriptor(): object | null;
    getPlayerStatus(): PlaybackState['status'];
    getCurrentDescriptor(): object | null;
    getDirectoryScopeKey(): string;
    unloadCurrentChannel(): void;
    cancelChannelReplacement(): void;
    hasPendingChannelReplacement(): boolean;
    requestCurrentProgramStart(): Promise<PlaybackStartOutcome> | null;
    reportRecoverableAsyncFailure: RecoverableAsyncFailureReporter;
}

export type PlaybackIntent = 'playing' | 'paused' | 'stopped';
export type PlaybackHoldOwner = 'route' | 'lifecycle';
export interface PlaybackHold {
    readonly owner: PlaybackHoldOwner;
    readonly token: symbol;
}

export interface OverlayReadinessSnapshot {
    pendingReason: 'none' | 'program-start';
    pendingSinceMs: number | null;
    lastReadyAtMs: number | null;
}

export class PlaybackRuntimeController {
    private _intent: PlaybackIntent = 'stopped';
    private _admissionGeneration = 0;
    private readonly _holds = new Map<PlaybackHoldOwner, PlaybackHold>();
    private _resumeGeneration = 0;
    private _pendingTuneChannelId: string | null = null;
    private _scopeActive = true;
    private _scopeGeneration = 0;
    private _acceptedSession: {
        identity: ScheduledProgramIdentity;
        descriptor: object;
    } | null = null;
    private _physicalSession: { identity: ActiveMediaIdentity; programIdentity: ScheduledProgramIdentity;
        descriptor: object; tuneGeneration: number; ended: boolean } | null = null;
    private _tuneGeneration = 0;
    private _lastProgramStartPromise: Promise<PlaybackStartOutcome> | null = null;
    private _observedProgramStart: {
        identity: ScheduledProgramIdentity;
        scopeGeneration: number;
        attachedPromise: Promise<PlaybackStartOutcome> | null;
        resolve: (outcome: PlaybackStartOutcome) => void;
        signal: AbortSignal;
        onAbort: () => void;
    } | null = null;
    private _overlayReadiness: OverlayReadinessSnapshot = {
        pendingReason: 'none',
        pendingSinceMs: null,
        lastReadyAtMs: null,
    };

    constructor(private readonly _deps: PlaybackRuntimeControllerDeps) {}

    public getIntent(): PlaybackIntent { return this._intent; }

    public canActivateRetainedSession(): boolean {
        this._deps.reconcileSleepExpiration();
        return this._intent !== 'stopped'
            && this._holds.size === 0
            && this._pendingTuneChannelId === null
            && this._lastProgramStartPromise === null
            && this._hasRetainedCurrentSession();
    }

    public acceptCommittedSession(descriptor: object): void {
        const identity = this._deps.getScheduledProgramIdentity();
        if (identity && this._deps.hasSelectedChannel()
            && this._deps.getCommittedDescriptor() === descriptor) {
            this._acceptedSession = { identity, descriptor };
            this._physicalSession = {
                identity: {
                    sessionId: String(++nextNativeSessionId),
                    scopeKey: this._deps.getDirectoryScopeKey(),
                    channelId: identity.channelId,
                },
                descriptor,
                programIdentity: identity,
                tuneGeneration: this._tuneGeneration,
                ended: false,
            };
        }
    }

    public getDirectoryScopeKey(): string { return this._deps.getDirectoryScopeKey(); }

    public getActiveMediaIdentity(): ActiveMediaIdentity | null {
        const session = this._physicalSession;
        if (!session || this._deps.getCurrentDescriptor() !== session.descriptor) return null;
        return { ...session.identity };
    }

    public isCurrentMediaIdentity(identity: ActiveMediaIdentity): boolean {
        const current = this.getActiveMediaIdentity();
        return this._scopeActive && this._pendingTuneChannelId === null && current !== null
            && this._physicalSession?.tuneGeneration === this._tuneGeneration
            && current.sessionId === identity.sessionId
            && current.scopeKey === identity.scopeKey
            && current.channelId === identity.channelId
            && current.scopeKey === this._deps.getDirectoryScopeKey();
    }

    public stopDeletedMediaIfCurrent(identity: ActiveMediaIdentity): 'stopped' | 'superseded' {
        const session = this._physicalSession;
        if (!session || this._pendingTuneChannelId !== null || !this._scopeActive
            || session.tuneGeneration !== this._tuneGeneration
            || session.identity.sessionId !== identity.sessionId
            || session.identity.scopeKey !== identity.scopeKey
            || session.identity.channelId !== identity.channelId
            || identity.scopeKey !== this._deps.getDirectoryScopeKey()
            || this._deps.getCurrentDescriptor() !== session.descriptor
            || this._deps.getCommittedDescriptor() !== session.descriptor) return 'superseded';
        this._deps.stopPlayback();
        this._deps.unloadCurrentChannel();
        this._physicalSession = null;
        return 'stopped';
    }

    private _hasRetainedCurrentSession(): boolean {
        const accepted = this._acceptedSession;
        const status = this._deps.getPlayerStatus();
        return accepted !== null
            && this._scopeActive
            && this._deps.hasSelectedChannel()
            && scheduledProgramIdentitiesMatch(this._deps.getScheduledProgramIdentity(), accepted.identity)
            && this._deps.getCommittedDescriptor() === accepted.descriptor
            && this._deps.getCurrentDescriptor() === accepted.descriptor
            && (status === 'playing' || status === 'paused' || status === 'buffering' || status === 'seeking');
    }

    public acquireHold(owner: PlaybackHoldOwner): PlaybackHold {
        const hold = { owner, token: Symbol(owner) };
        this._holds.set(owner, hold);
        ++this._admissionGeneration;
        this._deps.playback.pausePlayer();
        return hold;
    }

    public releaseHold(hold: PlaybackHold): void {
        if (this._holds.get(hold.owner) !== hold) return;
        this._holds.delete(hold.owner);
        ++this._admissionGeneration;
        this._resumeCurrentSchedule();
    }

    public setRouteBlocking(blocked: boolean): void {
        const current = this._holds.get('route');
        if (blocked && !current) this.acquireHold('route');
        if (!blocked && current) this.releaseHold(current);
    }

    public setIntent(intent: PlaybackIntent): boolean {
        const expired = this._deps.reconcileSleepExpiration();
        if (expired && intent === 'paused') return false;
        if (intent === 'playing' && (!this._scopeActive || !this._deps.hasSelectedChannel())) return false;
        this._intent = intent;
        this._pendingTuneChannelId = null;
        ++this._admissionGeneration;
        if (intent === 'stopped') {
            this._deps.stopPlayback();
        } else if (intent === 'paused') {
            this._deps.playback.pausePlayer();
        } else {
            this._resumeCurrentSchedule();
        }
        return true;
    }

    public beginIntentionalTune(channelId?: string): number {
        this._deps.reconcileSleepExpiration();
        this._scopeActive = true;
        this._intent = 'playing';
        this._acceptedSession = null;
        ++this._tuneGeneration;
        this._pendingTuneChannelId = channelId ?? null;
        return ++this._admissionGeneration;
    }

    public captureTuneAdmission(): number | null {
        this._deps.reconcileSleepExpiration();
        return this._scopeActive && this._intent === 'playing' && this._holds.size === 0
            ? this._admissionGeneration : null;
    }

    public captureRecoveryAdmission(): number | null {
        this._deps.reconcileSleepExpiration();
        return this._scopeActive && this._intent !== 'stopped' && this._holds.size === 0
            ? this._admissionGeneration : null;
    }

    public isRecoveryAdmissionCurrent(generation: number): boolean {
        this._deps.reconcileSleepExpiration();
        return this._scopeActive && this._intent !== 'stopped'
            && this._holds.size === 0
            && generation === this._admissionGeneration;
    }

    public canPlayForRecovery(generation: number): boolean {
        return this.isRecoveryAdmissionCurrent(generation)
            && this._intent === 'playing'
            && (this._pendingTuneChannelId === null
                || this._deps.getScheduledChannelId() === this._pendingTuneChannelId);
    }

    public isTuneAdmissionCurrent(generation: number): boolean {
        this._deps.reconcileSleepExpiration();
        return this._scopeActive && this._intent === 'playing'
            && this._holds.size === 0
            && generation === this._admissionGeneration;
    }

    public finishIntentionalTune(channelId: string): void {
        if (this._pendingTuneChannelId === channelId) this._pendingTuneChannelId = null;
    }

    public expireSleep(): void {
        this._intent = 'stopped';
        this._acceptedSession = null;
        this._pendingTuneChannelId = null;
        ++this._admissionGeneration;
        this._deps.stopPlayback();
    }

    /** Ordinary native stop retires media admission without retiring the identity scope. */
    public noteNativeStop(): void {
        this._intent = 'stopped';
        this._acceptedSession = null;
        this._physicalSession = null;
        this._pendingTuneChannelId = null;
        ++this._admissionGeneration;
        this._deps.cancelChannelReplacement();
        this._settleObservedProgramStart({ kind: 'superseded' });
    }

    public invalidateScope(): void {
        this._scopeActive = false;
        this._deps.cancelChannelReplacement();
        ++this._scopeGeneration;
        this._intent = 'stopped';
        this._acceptedSession = null;
        this._physicalSession = null;
        this._pendingTuneChannelId = null;
        ++this._admissionGeneration;
        this._settleObservedProgramStart({ kind: 'superseded' });
    }

    public captureAdmission(): number | null {
        const admission = this.captureTuneAdmission();
        return admission !== null && (
            this._pendingTuneChannelId === null
            || this._deps.getScheduledChannelId() === this._pendingTuneChannelId
        ) ? admission : null;
    }

    public isAdmissionCurrent(generation: number): boolean {
        return this.isTuneAdmissionCurrent(generation) && (
            this._pendingTuneChannelId === null
            || this._deps.getScheduledChannelId() === this._pendingTuneChannelId
        );
    }

    public async retryCurrentProgram(): Promise<PlaybackStartOutcome> {
        this._deps.reconcileSleepExpiration();
        if (!this._scopeActive || this._holds.size > 0 || !this._deps.hasSelectedChannel()) {
            throw new Error('Playback retry is unavailable in the current scope');
        }
        this._intent = 'playing';
        this._pendingTuneChannelId = null;
        this._acceptedSession = null;
        const admission = ++this._admissionGeneration;
        const start = this._resumeCurrentSchedule(true);
        if (!start) throw new Error('Playback retry has no current program');
        const outcome = await start;
        if (outcome.kind !== 'started' || !this.isAdmissionCurrent(admission)) {
            throw new Error(`Playback retry ${outcome.kind}`);
        }
        return outcome;
    }

    private _resumeCurrentSchedule(forceProgramStart = false): Promise<PlaybackStartOutcome> | null {
        const admission = this.captureAdmission();
        if (admission === null) return null;
        const priorStart = this._lastProgramStartPromise;
        this._deps.schedulerRuntime.syncSchedulerToCurrentTime();
        if (this._lastProgramStartPromise !== priorStart) return this._lastProgramStartPromise;
        if (!this.isAdmissionCurrent(admission)) return null;
        if (forceProgramStart || priorStart !== null || !this._hasRetainedCurrentSession()) {
            const start = this._deps.requestCurrentProgramStart();
            void start?.catch((error: unknown) => {
                this._reportRecoverableAsyncFailureSafely(
                    'orchestrator.playbackRuntime.currentProgramStart',
                    'Current program failed to start', error
                );
            });
            return start;
        }
        if (this.isAdmissionCurrent(admission)) {
            const descriptor = this._deps.getCurrentDescriptor();
            void this._deps.playback.playPlayer().then(() => {
                if (!this.isAdmissionCurrent(admission) && this._deps.getCurrentDescriptor() === descriptor) {
                    this._deps.playback.pausePlayer();
                }
            }, (error: unknown) => {
                this._reportRecoverableAsyncFailureSafely(
                    'orchestrator.playbackRuntime.resume', 'Playback failed to resume', error
                );
            });
        }
        return null;
    }

    private _getActiveTranscodeSessionId(): string | null {
        const decision = this._deps.playback.playbackState.getCurrentStreamDecision();
        if (!decision || !decision.isTranscoding || !decision.sessionId) {
            return null;
        }

        return decision.sessionId;
    }

    public trackProgramStart(
        promise: Promise<PlaybackStartOutcome>,
        identity: ScheduledProgramIdentity | null = null
    ): Promise<PlaybackStartOutcome> {
        this._lastProgramStartPromise = promise;
        this._overlayReadiness.pendingReason = 'program-start';
        this._overlayReadiness.pendingSinceMs = Date.now();

        const observed = this._observedProgramStart;
        if (observed && identity && scheduledProgramIdentitiesMatch(identity, observed.identity)) {
            if (observed.attachedPromise !== null) {
                this._settleObservedProgramStart({ kind: 'superseded' });
            } else {
                observed.attachedPromise = promise;
            }
        }

        void promise.then(
            (outcome) => this._completeTrackedProgramStart(promise, outcome),
            () => this._completeTrackedProgramStart(promise, { kind: 'failed' })
        );

        return promise;
    }

    private _completeTrackedProgramStart(
        promise: Promise<PlaybackStartOutcome>,
        outcome: PlaybackStartOutcome
    ): void {
        if (this._lastProgramStartPromise === promise) {
            if (outcome.kind !== 'started') {
                this._overlayReadiness.pendingReason = 'none';
                this._overlayReadiness.pendingSinceMs = null;
            }
            this._lastProgramStartPromise = null;
        }

        const observed = this._observedProgramStart;
        if (!observed || observed.attachedPromise !== promise) return;
        const current = this._scopeActive
            && observed.scopeGeneration === this._scopeGeneration
            && scheduledProgramIdentitiesMatch(
                this._deps.getScheduledProgramIdentity(), observed.identity
            );
        this._settleObservedProgramStart(current ? outcome : { kind: 'superseded' });
    }

    /** Register before tuning; only the matching real program-start outcome completes it. */
    public observeProgramStart(
        identity: ScheduledProgramIdentity,
        signal: AbortSignal
    ): Promise<PlaybackStartOutcome> {
        this._settleObservedProgramStart({ kind: 'superseded' });
        if (signal.aborted) {
            return Promise.resolve({ kind: 'superseded' });
        }

        return new Promise((resolve) => {
            const onAbort = (): void => {
                if (this._observedProgramStart?.resolve === resolve) {
                    this._settleObservedProgramStart({ kind: 'superseded' });
                }
            };
            this._observedProgramStart = {
                identity,
                scopeGeneration: this._scopeGeneration,
                attachedPromise: null,
                resolve,
                signal,
                onAbort,
            };
            signal.addEventListener('abort', onAbort, { once: true });
        });
    }

    private _settleObservedProgramStart(outcome: PlaybackStartOutcome): void {
        const observed = this._observedProgramStart;
        this._observedProgramStart = null;
        observed?.signal.removeEventListener('abort', observed.onAbort);
        observed?.resolve(outcome);
    }

    public dispose(): void {
        this.invalidateScope();
        this._physicalSession = null;
        this._holds.clear();
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
        this.acquireHold('lifecycle');
        ++this._resumeGeneration;
        this._deps.schedulerRuntime.pauseSchedulerSync();
        await this._deps.saveLifecycleState();
    }

    public async handleLifecycleResume(): Promise<void> {
        const generation = ++this._resumeGeneration;
        const hold = this._holds.get('lifecycle');
        this._deps.reconcileSleepExpiration();
        this._deps.schedulerRuntime.resumeSchedulerSync();
        if (generation === this._resumeGeneration && hold) this.releaseHold(hold);
    }

    public handlePlayerEnded(): void {
        const physical = this._physicalSession;
        if (physical && (physical.ended || !scheduledProgramIdentitiesMatch(
            this._deps.getScheduledProgramIdentity(), physical.programIdentity
        ) || this._deps.getCurrentDescriptor() !== physical.descriptor)) return;
        if (this.captureAdmission() === null) return;
        if (this._deps.playback.playbackRecovery.isStreamRecoveryInProgress()) {
            return;
        }

        if (physical) physical.ended = true;
        this._acceptedSession = null;
        this.stopActiveTranscodeSession();
        if (this._deps.hasPendingChannelReplacement()) {
            this._deps.schedulerRuntime.syncSchedulerToCurrentTime();
        } else {
            this._deps.playback.skipToNextProgram();
        }
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
        const admission = this.captureAdmission();
        if (admission === null) return;
        try {
            const fallbackApplied = await playbackRecovery.attemptTranscodeFallbackForCurrentProgram?.('video-player');
            if (!this.isAdmissionCurrent(admission)) return;
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
