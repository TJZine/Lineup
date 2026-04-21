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
                return true;
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

        try {
            const abortIfProgramChanged = (
                teardownDescriptor: StreamDescriptor | null
            ): RecoveryAttemptResult<TSuccess, 'program_changed'> | null => {
                if (this.deps.getCurrentProgramForPlayback() === context.program) {
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

            await config.beforeResolve?.(context);
            const beforeResolveAbort = abortIfProgramChanged(null);
            if (beforeResolveAbort) {
                return beforeResolveAbort;
            }

            const decision = await context.resolver.resolveStream(config.buildRequest(context));
            const resolveAbort = abortIfProgramChanged(null);
            if (resolveAbort) {
                return resolveAbort;
            }

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
            await context.player.loadStream(descriptor);
            const loadAbort = abortIfProgramChanged(descriptor);
            if (loadAbort) {
                return loadAbort;
            }

            await config.afterLoad?.(descriptor, descriptorContext);
            const afterLoadAbort = abortIfProgramChanged(descriptor);
            if (afterLoadAbort) {
                return afterLoadAbort;
            }

            if (config.shouldResumeAfterReload) {
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
                    ...(config.failureData?.(context) ?? config.startData?.(context) ?? {}),
                },
                error
            );
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
