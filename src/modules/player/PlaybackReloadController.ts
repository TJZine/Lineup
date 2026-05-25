import { redactSensitiveTokens } from '../../utils/redact';
import type { IPlexStreamResolver, StreamDecision, StreamRequest } from '../plex/stream';
import type { ScheduledProgram } from '../scheduler/scheduler';
import { logPlaybackRecoveryError, logPlaybackRecoveryWarning } from '../debug/PlayerConsoleLogger';
import type { IVideoPlayer } from './interfaces';
import type { StreamDescriptor } from './types';

export type RecoveryReloadIgnoredReason =
    | 'recovery_in_progress'
    | 'missing_deps'
    | 'no_program'
    | 'program_changed';

export type RecoveryAttemptResult<Success extends string, IgnoredReason extends string> =
    | { outcome: Success }
    | { outcome: 'ignored'; reason: IgnoredReason }
    | { outcome: 'failed' };

export type RecoveryReloadContext = {
    program: ScheduledProgram;
    player: IVideoPlayer;
    resolver: IPlexStreamResolver;
    itemKey: string;
    safeReason: string;
    clampedOffset: number;
    currentDecision: StreamDecision | null;
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
};

interface PlaybackReloadControllerDeps {
    getVideoPlayer: () => IVideoPlayer | null;
    getStreamResolver: () => IPlexStreamResolver | null;
    getCurrentProgramForPlayback: () => ScheduledProgram | null;
    getCurrentStreamDecision?: () => StreamDecision | null;
    setCurrentStreamDecision: (decision: StreamDecision | null) => void;
    setCurrentStreamDescriptor: (descriptor: StreamDescriptor | null) => void;
    buildStreamDescriptor: (
        program: ScheduledProgram,
        decision: StreamDecision,
        startOffsetMs: number
    ) => StreamDescriptor;
    resetPlaybackFailureGuard: () => void;
}

function programsMatchIdentity(
    current: ScheduledProgram | null,
    expected: ScheduledProgram
): boolean {
    if (!current) {
        return false;
    }

    return current.item.ratingKey === expected.item.ratingKey
        && current.scheduledStartTime === expected.scheduledStartTime;
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

        const program = this.deps.getCurrentProgramForPlayback();
        if (!program) {
            return { outcome: 'ignored', reason: 'no_program' };
        }

        const player = this.deps.getVideoPlayer();
        const resolver = this.deps.getStreamResolver();
        if (!player || !resolver) {
            return { outcome: 'ignored', reason: 'missing_deps' };
        }

        return {
            program,
            player,
            resolver,
            itemKey: program.item.ratingKey,
            safeReason: redactSensitiveTokens(reason),
            clampedOffset: this._getRecoveryReloadOffset(program, player),
            currentDecision: this.deps.getCurrentStreamDecision?.() ?? null,
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
        onFailure?: (context: RecoveryReloadFailureContext) => void;
    }): Promise<RecoveryAttemptResult<TSuccess, 'program_changed'>> {
        const { context } = config;
        logPlaybackRecoveryWarning(config.startEvent, {
            reason: context.safeReason,
            ...(config.startData?.(context) ?? {}),
        });
        this._streamRecoveryInProgress = true;
        let teardownDescriptor: StreamDescriptor | null = null;
        const clearCommittedState = (): void => {
            this.deps.setCurrentStreamDecision(null);
            this.deps.setCurrentStreamDescriptor(null);
        };
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
            clearCommittedState();
        };

        let failureStage: RecoveryReloadFailureStage = 'unknown';
        try {
            const abortIfProgramChanged = (
                teardownDescriptor: StreamDescriptor | null
            ): RecoveryAttemptResult<TSuccess, 'program_changed'> | null => {
                if (programsMatchIdentity(this.deps.getCurrentProgramForPlayback(), context.program)) {
                    return null;
                }

                teardownLoadedStreamIfStillActive(teardownDescriptor);

                logPlaybackRecoveryWarning(config.abortedEvent, {
                    reason: context.safeReason,
                    outcome: 'program_changed',
                    ...(config.startData?.(context) ?? {}),
                });
                return { outcome: 'ignored', reason: 'program_changed' };
            };

            failureStage = 'before_resolve';
            await config.beforeResolve?.(context);
            const beforeResolveAbort = abortIfProgramChanged(null);
            if (beforeResolveAbort) {
                return beforeResolveAbort;
            }

            failureStage = 'resolve';
            const decision = await context.resolver.resolveStream(config.buildRequest(context));
            const resolveAbort = abortIfProgramChanged(null);
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

            teardownDescriptor = descriptor;
            failureStage = 'load';
            await context.player.loadStream(descriptor);
            const loadAbort = abortIfProgramChanged(descriptor);
            if (loadAbort) {
                return loadAbort;
            }

            failureStage = 'after_load';
            await config.afterLoad?.(descriptor, descriptorContext);
            const afterLoadAbort = abortIfProgramChanged(descriptor);
            if (afterLoadAbort) {
                return afterLoadAbort;
            }

            if (config.shouldResumeAfterReload) {
                failureStage = 'play';
                await context.player.play();
                const playAbort = abortIfProgramChanged(descriptor);
                if (playAbort) {
                    return playAbort;
                }
            }
            this.deps.setCurrentStreamDecision(decision);
            this.deps.setCurrentStreamDescriptor(descriptor);
            this.deps.resetPlaybackFailureGuard();
            config.onSuccess?.(descriptorContext);
            return { outcome: config.successOutcome };
        } catch (error) {
            teardownLoadedStreamIfStillActive(teardownDescriptor);
            logPlaybackRecoveryError(
                config.failedEvent,
                {
                    reason: context.safeReason,
                    outcome: 'failed',
                    ...(config.failureData?.(context) ?? config.startData?.(context) ?? {}),
                },
                error
            );
            config.onFailure?.({
                ...context,
                error,
                failureStage,
                priorStreamLikelyUnloaded: teardownDescriptor !== null,
            });
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
        return Math.max(0, Math.min(baseOffset, program.item.durationMs));
    }
}
