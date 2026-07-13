import type { IPlexStreamResolver, StreamDecision } from '../../plex/stream';
import { logPlaybackRecoveryError } from '../../debug/PlayerConsoleLogger';
import type { StreamDescriptor } from '../core/types';
import type { ScheduledProgram } from '../../scheduler/scheduler';
import { clampPlaybackOffsetMs } from './playbackRecoveryTiming';

export interface PreparedPlaybackStream {
    readonly decision: StreamDecision;
    readonly descriptor: StreamDescriptor;
}

interface PreparedPlaybackStreamOwnerDeps {
    getStreamResolver: () => IPlexStreamResolver | null;
    getCurrentStreamDecision: () => StreamDecision | null;
    buildDescriptor: (
        program: ScheduledProgram,
        decision: StreamDecision,
        startOffsetMs: number
    ) => StreamDescriptor;
}

export class PreparedPlaybackStreamOwner {
    constructor(private readonly deps: PreparedPlaybackStreamOwnerDeps) {}

    async prepare(program: ScheduledProgram): Promise<PreparedPlaybackStream> {
        const resolver = this.deps.getStreamResolver();
        if (!resolver) {
            throw new Error('Stream resolver not initialized');
        }
        const clampedOffset = clampPlaybackOffsetMs(program.elapsedMs, program.item.durationMs);
        const decision = await resolver.resolveStream({
            itemKey: program.item.ratingKey,
            startOffsetMs: clampedOffset,
            directPlay: true,
        });
        try {
            return {
                decision,
                descriptor: this.deps.buildDescriptor(program, decision, clampedOffset),
            };
        } catch (error: unknown) {
            await this.discardDecision(decision);
            throw error;
        }
    }

    async discard(prepared: PreparedPlaybackStream): Promise<void> {
        await this.discardDecision(prepared.decision);
    }

    private async discardDecision(decision: StreamDecision): Promise<void> {
        const sessionId = decision.sessionId ?? decision.transcodeRequest?.sessionId ?? null;
        if (!decision.isTranscoding || !sessionId) {
            return;
        }
        const activeDecision = this.deps.getCurrentStreamDecision();
        const activeSessionId = activeDecision?.sessionId
            ?? activeDecision?.transcodeRequest?.sessionId
            ?? null;
        if (activeSessionId === sessionId) {
            return;
        }
        try {
            await this.deps.getStreamResolver()?.stopTranscodeSession(sessionId);
        } catch (error: unknown) {
            logPlaybackRecoveryError(
                'playbackRecovery.unacceptedSessionCleanupFailed',
                { sessionId },
                error
            );
        }
    }
}
