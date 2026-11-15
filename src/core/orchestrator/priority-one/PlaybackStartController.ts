import type { PreparedPlaybackStream, IVideoPlayer } from '../../../modules/player';
import type {
    ScheduledProgram,
    ScheduledProgramIdentity,
} from '../../../modules/scheduler/scheduler';
import type { PlaybackStartOutcome } from '../../../types/playbackStart';
import { SupportReportStore } from '../../../modules/support/SupportReportStore';

const STARTED: PlaybackStartOutcome = { kind: 'started' };
const FAILED: PlaybackStartOutcome = { kind: 'failed' };
const SUPERSEDED: PlaybackStartOutcome = { kind: 'superseded' };

export interface PlaybackStartControllerDeps {
    getVideoPlayer: () => Pick<IVideoPlayer, 'loadStream' | 'play' | 'getCurrentDescriptor' | 'stop'> | null;
    captureAdmission: () => number | null;
    isAdmissionCurrent: (generation: number) => boolean;
    resolveStreamForProgram: (program: ScheduledProgram) => Promise<PreparedPlaybackStream>;
    discardPreparedStream: (prepared: PreparedPlaybackStream) => Promise<void>;
    resetPlaybackFailureGuard: () => void;
    tryHandleStreamResolverAuthError: (error: unknown) => boolean;
    tryHandleStreamResolverPermissionError: (error: unknown) => boolean;
    attemptTranscodeFallbackForCurrentProgram: (
        reason: string,
        attemptedStream?: PreparedPlaybackStream
    ) => Promise<boolean>;
    handlePlaybackFailure: (context: string, error: unknown) => void;
    logPlaybackStartFailure: (error: unknown) => void;
    markProgramStarting: (
        program: ScheduledProgram
    ) => {
        programAtStart: ScheduledProgram;
        programIdentityAtStart: ScheduledProgramIdentity | null;
    };
    isProgramStillCurrent: (
        program: ScheduledProgram,
        programIdentityAtStart: ScheduledProgramIdentity | null
    ) => boolean;
    handleProgramStartUiSideEffects: (program: ScheduledProgram) => void;
    commitPreparedStream: (prepared: PreparedPlaybackStream) => void;
    handleStreamResolved: (prepared: PreparedPlaybackStream) => void;
    reportRecoverableActivationFailure: (error: unknown) => void;
}

export class PlaybackStartController {
    private _programStartSequence = 0;
    private readonly _supportReport = new SupportReportStore();

    constructor(private readonly _deps: PlaybackStartControllerDeps) {}

    public async handleProgramStart(program: ScheduledProgram): Promise<PlaybackStartOutcome> {
        const sequence = ++this._programStartSequence;
        const admission = this._deps.captureAdmission();
        if (admission === null) return SUPERSEDED;
        this._supportReport.record({ code: 'playback-start', at: Date.now(), outcome: 'started' });
        try {
            const outcome = await this._startAdmittedProgram(program, admission, sequence);
            this._supportReport.record({
                code: 'playback-start', at: Date.now(),
                outcome: outcome.kind === 'started' ? 'succeeded'
                    : outcome.kind === 'superseded' ? 'cancelled' : 'failed',
            });
            return outcome;
        } catch (error) {
            this._supportReport.record({ code: 'playback-start', at: Date.now(), outcome: 'failed' });
            throw error;
        }
    }

    private async _startAdmittedProgram(
        program: ScheduledProgram,
        admission: number,
        sequence: number
    ): Promise<PlaybackStartOutcome> {
        const isStale = (): boolean =>
            sequence !== this._programStartSequence || !this._deps.isAdmissionCurrent(admission);
        const videoPlayer = this._deps.getVideoPlayer();

        if (!videoPlayer) {
            return FAILED;
        }

        const {
            programAtStart,
            programIdentityAtStart,
        } = this._deps.markProgramStarting(program);
        let prepared: PreparedPlaybackStream | null = null;
        let accepted: PreparedPlaybackStream | null = null;
        let discarded = false;
        let loadRequested = false;
        const discardPrepared = async (): Promise<void> => {
            if (!prepared || discarded) {
                return;
            }
            discarded = true;
            await this._deps.discardPreparedStream(prepared);
        };
        const stopStaleOwnedStream = (): void => {
            if (loadRequested && prepared && videoPlayer.getCurrentDescriptor?.() === prepared.descriptor) {
                videoPlayer.stop();
            }
        };

        try {
            if (isStale()) return SUPERSEDED;
            this._deps.handleProgramStartUiSideEffects(programAtStart);
            if (isStale()) {
                return SUPERSEDED;
            }
            prepared = await this._deps.resolveStreamForProgram(programAtStart);

            if (
                isStale() ||
                !this._deps.isProgramStillCurrent(programAtStart, programIdentityAtStart)
            ) {
                stopStaleOwnedStream();
                await discardPrepared();
                return SUPERSEDED;
            }

            loadRequested = true;
            await videoPlayer.loadStream(prepared.descriptor);

            if (
                isStale() ||
                !this._deps.isProgramStillCurrent(programAtStart, programIdentityAtStart)
            ) {
                stopStaleOwnedStream();
                await discardPrepared();
                return SUPERSEDED;
            }

            if (isStale()) {
                stopStaleOwnedStream();
                await discardPrepared();
                return SUPERSEDED;
            }
            await videoPlayer.play();
            if (
                isStale() ||
                !this._deps.isProgramStillCurrent(programAtStart, programIdentityAtStart)
            ) {
                stopStaleOwnedStream();
                await discardPrepared();
                return SUPERSEDED;
            }

            accepted = prepared;
        } catch (error) {
            if (
                isStale() ||
                !this._deps.isProgramStillCurrent(programAtStart, programIdentityAtStart)
            ) {
                stopStaleOwnedStream();
                await discardPrepared();
                return SUPERSEDED;
            }

            if (this._deps.tryHandleStreamResolverAuthError(error)) {
                await discardPrepared();
                return FAILED;
            }

            if (this._deps.tryHandleStreamResolverPermissionError(error)) {
                await discardPrepared();
                return FAILED;
            }

            this._deps.logPlaybackStartFailure(error);
            let fallbackApplied = false;
            try {
                fallbackApplied = await this._deps.attemptTranscodeFallbackForCurrentProgram(
                    'programStart',
                    prepared ?? undefined
                );
            } catch {
                if (isStale()) {
                    stopStaleOwnedStream();
                    await discardPrepared();
                        return SUPERSEDED;
                }
                await discardPrepared();
                this._deps.handlePlaybackFailure('programStart', error);
                return FAILED;
            }

            if (
                isStale() ||
                !this._deps.isProgramStillCurrent(programAtStart, programIdentityAtStart)
            ) {
                stopStaleOwnedStream();
                await discardPrepared();
                return SUPERSEDED;
            }

            await discardPrepared();
            if (fallbackApplied) {
                return STARTED;
            }
            this._deps.handlePlaybackFailure('programStart', error);
            return FAILED;
        }

        if (!accepted) {
            return FAILED;
        }

        if (isStale()) {
            stopStaleOwnedStream();
            await discardPrepared();
            return SUPERSEDED;
        }
        this._deps.commitPreparedStream(accepted);
        try {
            this._deps.handleStreamResolved(accepted);
        } catch (error: unknown) {
            this._deps.reportRecoverableActivationFailure(error);
        } finally {
            this._deps.resetPlaybackFailureGuard();
        }
        return STARTED;
    }
}
