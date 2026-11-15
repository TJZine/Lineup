import { redactSensitiveTokens } from '../../../utils/redact';
import type { IPlexStreamResolver, StreamDecision, StreamRequest } from '../../plex/stream';
import {
    scheduledProgramIdentitiesMatch,
    type ScheduledProgram,
    type ScheduledProgramIdentity,
} from '../../scheduler/scheduler';
import { logPlaybackRecoveryError, logPlaybackRecoveryWarning } from '../../debug/PlayerConsoleLogger';
import type { IVideoPlayer } from '../core/interfaces';
import type { StreamDescriptor } from '../core/types';
import { clampPlaybackOffsetMs } from './playbackRecoveryTiming';

export type RecoveryReloadIgnoredReason =
    | 'recovery_in_progress'
    | 'missing_deps'
    | 'no_program'
    | 'program_changed'
    | 'admission_changed';

export type RecoveryAttemptResult<Success extends string, IgnoredReason extends string> =
    | { outcome: Success }
    | { outcome: 'ignored'; reason: IgnoredReason }
    | { outcome: 'failed' };

export type RecoveryReloadContext = {
    admissionGeneration: number;
    program: ScheduledProgram;
    programIdentity: ScheduledProgramIdentity;
    player: IVideoPlayer;
    resolver: IPlexStreamResolver;
    itemKey: string;
    safeReason: string;
    clampedOffset: number;
    currentDecision: StreamDecision | null;
    currentDescriptor: StreamDescriptor | null;
};

export type RecoveryDescriptorContext = RecoveryReloadContext & {
    decision: StreamDecision;
};

export type RecoveryReloadFailureStage =
    | 'before_resolve'
    | 'resolve'
    | 'build_descriptor'
    | 'load'
    | 'after_load'
    | 'play'
    | 'unknown';

export type RecoveryReloadFailureContext = RecoveryReloadContext & {
    error: unknown;
    failureStage: RecoveryReloadFailureStage;
    priorStreamLikelyUnloaded: boolean;
    attemptedRequest: StreamRequest | null;
    attemptedDecision: StreamDecision | null;
    attemptedDescriptor: StreamDescriptor | null;
};

interface PlaybackReloadControllerDeps {
    captureRecoveryAdmission: () => number | null;
    isRecoveryAdmissionCurrent: (generation: number) => boolean;
    canPlayForRecovery: (generation: number) => boolean;
    acceptCommittedSession: (descriptor: StreamDescriptor) => void;
    getVideoPlayer: () => IVideoPlayer | null;
    getStreamResolver: () => IPlexStreamResolver | null;
    getCurrentProgramForPlayback: () => ScheduledProgram | null;
    getCurrentProgramIdentityForPlayback: () => ScheduledProgramIdentity | null;
    getCurrentStreamDecision?: () => StreamDecision | null;
    getCurrentStreamDescriptor?: () => StreamDescriptor | null;
    setCurrentStreamDecision: (decision: StreamDecision | null) => void;
    setCurrentStreamDescriptor: (descriptor: StreamDescriptor | null) => void;
    buildStreamDescriptor: (
        program: ScheduledProgram,
        decision: StreamDecision,
        startOffsetMs: number
    ) => StreamDescriptor;
    resetPlaybackFailureGuard: () => void;
}

export class PlaybackReloadController {
    private _streamRecoveryInProgress = false;

    constructor(private readonly deps: PlaybackReloadControllerDeps) {}

    isStreamRecoveryInProgress(): boolean {
        return this._streamRecoveryInProgress;
    }

    prepareReload(
        reason: string
    ): RecoveryReloadContext | { outcome: 'ignored'; reason: RecoveryReloadIgnoredReason } {
        if (this._streamRecoveryInProgress) {
            return { outcome: 'ignored', reason: 'recovery_in_progress' };
        }

        const admissionGeneration = this.deps.captureRecoveryAdmission();
        if (admissionGeneration === null) {
            return { outcome: 'ignored', reason: 'admission_changed' };
        }

        const program = this.deps.getCurrentProgramForPlayback();
        const programIdentity = this.deps.getCurrentProgramIdentityForPlayback();
        if (!program || !programIdentity) {
            return { outcome: 'ignored', reason: 'no_program' };
        }

        const player = this.deps.getVideoPlayer();
        const resolver = this.deps.getStreamResolver();
        if (!player || !resolver) {
            return { outcome: 'ignored', reason: 'missing_deps' };
        }

        return {
            admissionGeneration,
            program,
            programIdentity,
            player,
            resolver,
            itemKey: program.item.ratingKey,
            safeReason: redactSensitiveTokens(reason),
            clampedOffset: this._getRecoveryReloadOffset(program, player),
            currentDecision: this.deps.getCurrentStreamDecision?.() ?? null,
            currentDescriptor: this.deps.getCurrentStreamDescriptor?.() ?? null,
        };
    }

    async executeReload<TSuccess extends string>(config: {
        context: RecoveryReloadContext;
        successOutcome: TSuccess;
        startEvent: string;
        abortedEvent: string;
        failedEvent: string;
        startData?: (context: RecoveryReloadContext) => Record<string, unknown>;
        failureData?: (context: RecoveryReloadContext) => Record<string, unknown>;
        beforeResolve?: (context: RecoveryReloadContext) => void | Promise<void>;
        buildRequest: (context: RecoveryReloadContext) => StreamRequest;
        customizeDescriptor?: (
            descriptor: StreamDescriptor,
            context: RecoveryDescriptorContext
        ) => StreamDescriptor;
        afterLoad?: (
            descriptor: StreamDescriptor,
            context: RecoveryDescriptorContext
        ) => void | Promise<void>;
        shouldResumeAfterReload?: boolean;
        onSuccess?: (context: RecoveryDescriptorContext) => void;
        onFailure?: (context: RecoveryReloadFailureContext) => void | Promise<void>;
    }): Promise<RecoveryAttemptResult<TSuccess, 'program_changed' | 'admission_changed'>> {
        const { context } = config;
        if (!this.deps.isRecoveryAdmissionCurrent(context.admissionGeneration)) {
            return { outcome: 'ignored', reason: 'admission_changed' };
        }
        logPlaybackRecoveryWarning(config.startEvent, {
            reason: context.safeReason,
            ...(config.startData?.(context) ?? {}),
        });
        this._streamRecoveryInProgress = true;
        let teardownDescriptor: StreamDescriptor | null = null;
        const playerCurrentDescriptorMatches = (descriptor: StreamDescriptor): boolean => {
            if (typeof context.player.getCurrentDescriptor !== 'function') {
                return false;
            }

            return context.player.getCurrentDescriptor() === descriptor;
        };
        const teardownLoadedStreamIfStillActive = (descriptor: StreamDescriptor | null): void => {
            if (!descriptor || !playerCurrentDescriptorMatches(descriptor)) {
                return;
            }

            try {
                context.player.unloadStream();
            } catch {
                // Preserve the original reload failure/abort path.
            }
            const committedDescriptor = this.deps.getCurrentStreamDescriptor?.() ?? null;
            if (committedDescriptor === descriptor || committedDescriptor === context.currentDescriptor) {
                this.deps.setCurrentStreamDecision(null);
                this.deps.setCurrentStreamDescriptor(null);
            }
        };

        let failureStage: RecoveryReloadFailureStage = 'unknown';
        let attemptedRequest: StreamRequest | null = null;
        let attemptedDecision: StreamDecision | null = null;
        let attemptedDescriptor: StreamDescriptor | null = null;
        let attemptedSessionDiscarded = false;
        const discardAttemptedSession = (): void => {
            const sessionId = attemptedDecision?.isTranscoding ? attemptedDecision.sessionId : null;
            if (!sessionId || attemptedSessionDiscarded
                || sessionId === context.currentDecision?.sessionId
                || sessionId === this.deps.getCurrentStreamDecision?.()?.sessionId
                || typeof context.resolver.stopTranscodeSession !== 'function') return;
            attemptedSessionDiscarded = true;
            try {
                void context.resolver.stopTranscodeSession(sessionId).catch((error: unknown) => {
                    logPlaybackRecoveryError('reloadAttemptedTranscodeStop.failed', { sessionId }, error);
                });
            } catch (error: unknown) {
                logPlaybackRecoveryError('reloadAttemptedTranscodeStop.failed', { sessionId }, error);
            }
        };
        try {
            const abortIfStale = (
                teardownDescriptor: StreamDescriptor | null
            ): RecoveryAttemptResult<TSuccess, 'program_changed' | 'admission_changed'> | null => {
                const programCurrent = scheduledProgramIdentitiesMatch(
                        this.deps.getCurrentProgramIdentityForPlayback(),
                        context.programIdentity
                    );
                const admissionCurrent = this.deps.isRecoveryAdmissionCurrent(context.admissionGeneration);
                if (programCurrent && admissionCurrent) {
                    return null;
                }

                teardownLoadedStreamIfStillActive(teardownDescriptor);
                discardAttemptedSession();

                const reason = programCurrent ? 'admission_changed' : 'program_changed';

                logPlaybackRecoveryWarning(config.abortedEvent, {
                    reason: context.safeReason,
                    outcome: reason,
                    ...(config.startData?.(context) ?? {}),
                });
                return { outcome: 'ignored', reason };
            };

            failureStage = 'before_resolve';
            await config.beforeResolve?.(context);
            const beforeResolveAbort = abortIfStale(null);
            if (beforeResolveAbort) {
                return beforeResolveAbort;
            }

            failureStage = 'resolve';
            attemptedRequest = config.buildRequest(context);
            const decision = await context.resolver.resolveStream(attemptedRequest);
            attemptedDecision = decision;
            const resolveAbort = abortIfStale(null);
            if (resolveAbort) {
                return resolveAbort;
            }

            failureStage = 'build_descriptor';
            let descriptor = this.deps.buildStreamDescriptor(
                context.program,
                decision,
                context.clampedOffset
            );
            const descriptorContext: RecoveryDescriptorContext = {
                ...context,
                decision,
            };
            if (config.customizeDescriptor) {
                descriptor = config.customizeDescriptor(descriptor, descriptorContext);
            }
            attemptedDescriptor = descriptor;

            const beforeLoadAbort = abortIfStale(null);
            if (beforeLoadAbort) return beforeLoadAbort;

            teardownDescriptor = descriptor;
            failureStage = 'load';
            await context.player.loadStream(descriptor);
            const loadAbort = abortIfStale(descriptor);
            if (loadAbort) {
                return loadAbort;
            }

            failureStage = 'after_load';
            await config.afterLoad?.(descriptor, descriptorContext);
            const afterLoadAbort = abortIfStale(descriptor);
            if (afterLoadAbort) {
                return afterLoadAbort;
            }

            if (config.shouldResumeAfterReload && this.deps.canPlayForRecovery(context.admissionGeneration)) {
                failureStage = 'play';
                await context.player.play();
                const playAbort = abortIfStale(descriptor);
                if (playAbort) {
                    return playAbort;
                }
            }
            const beforeCommitAbort = abortIfStale(descriptor);
            if (beforeCommitAbort) return beforeCommitAbort;
            this.deps.setCurrentStreamDecision(decision);
            this.deps.setCurrentStreamDescriptor(descriptor);
            const publicationAbort = abortIfStale(descriptor);
            if (publicationAbort) return publicationAbort;
            this.deps.acceptCommittedSession(descriptor);
            this.deps.resetPlaybackFailureGuard();
            const afterResetAbort = abortIfStale(descriptor);
            if (afterResetAbort) return afterResetAbort;
            config.onSuccess?.(descriptorContext);
            const afterSuccessAbort = abortIfStale(descriptor);
            if (afterSuccessAbort) return afterSuccessAbort;
            this._stopPriorTranscodeSessionAfterCommit(context.currentDecision, decision, context.resolver);
            return { outcome: config.successOutcome };
        } catch (error) {
            teardownLoadedStreamIfStillActive(teardownDescriptor);
            discardAttemptedSession();
            const programCurrent = scheduledProgramIdentitiesMatch(
                this.deps.getCurrentProgramIdentityForPlayback(), context.programIdentity
            );
            const admissionCurrent = this.deps.isRecoveryAdmissionCurrent(context.admissionGeneration);
            if (!programCurrent || !admissionCurrent) {
                const reason = programCurrent ? 'admission_changed' : 'program_changed';
                logPlaybackRecoveryWarning(config.abortedEvent, {
                    reason: context.safeReason,
                    outcome: reason,
                    ...(config.startData?.(context) ?? {}),
                });
                return { outcome: 'ignored', reason };
            }
            logPlaybackRecoveryError(
                config.failedEvent,
                {
                    reason: context.safeReason,
                    outcome: 'failed',
                    ...(config.failureData?.(context) ?? config.startData?.(context) ?? {}),
                },
                error
            );
            try {
                await config.onFailure?.({
                    ...context,
                    error,
                    failureStage,
                    priorStreamLikelyUnloaded: failureStage === 'load'
                        || failureStage === 'after_load'
                        || failureStage === 'play',
                    attemptedRequest,
                    attemptedDecision,
                    attemptedDescriptor,
                });
            } catch (hookError: unknown) {
                logPlaybackRecoveryError(
                    `${config.failedEvent}.onFailureFailed`,
                    {
                        reason: context.safeReason,
                        outcome: 'failed',
                        failureStage,
                    },
                    hookError
                );
            }
            return { outcome: 'failed' };
        } finally {
            this._streamRecoveryInProgress = false;
        }
    }

    private _getRecoveryReloadOffset(program: ScheduledProgram, player: IVideoPlayer): number {
        const livePosition = player.getCurrentTimeMs();
        const baseOffset = Number.isFinite(livePosition)
            ? livePosition
            : Number.isFinite(program.elapsedMs)
                ? program.elapsedMs
                : 0;
        return clampPlaybackOffsetMs(baseOffset, program.item.durationMs);
    }

    private _stopPriorTranscodeSessionAfterCommit(
        priorDecision: StreamDecision | null,
        nextDecision: StreamDecision,
        resolver: IPlexStreamResolver
    ): void {
        if (
            !priorDecision?.isTranscoding ||
            !priorDecision.sessionId ||
            priorDecision.sessionId === nextDecision.sessionId
        ) {
            return;
        }

        const logStopError = (error: unknown): void => {
            logPlaybackRecoveryError(
                'reloadPriorTranscodeStop.failed',
                {
                    sessionId: priorDecision.sessionId,
                    nextSessionId: nextDecision.sessionId,
                },
                error
            );
        };

        try {
            void Promise.resolve(resolver.stopTranscodeSession(priorDecision.sessionId)).catch(logStopError);
        } catch (error: unknown) {
            logStopError(error);
        }
    }
}
