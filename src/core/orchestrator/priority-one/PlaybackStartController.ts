import type { PreparedPlaybackStream, IVideoPlayer } from '../../../modules/player';
import type {
    ScheduledProgram,
    ScheduledProgramIdentity,
} from '../../../modules/scheduler/scheduler';

export interface PlaybackStartControllerDeps {
    getVideoPlayer: () => Pick<IVideoPlayer, 'loadStream' | 'play'> | null;
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
        shouldResetAutoShowInfoBannerOnAbort: boolean;
    };
    isProgramStillCurrent: (
        program: ScheduledProgram,
        programIdentityAtStart: ScheduledProgramIdentity | null
    ) => boolean;
    handleProgramStartUiSideEffects: (program: ScheduledProgram) => void;
    commitPreparedStream: (prepared: PreparedPlaybackStream) => void;
    handleStreamResolved: (prepared: PreparedPlaybackStream) => void;
    reportRecoverableActivationFailure: (error: unknown) => void;
    clearAutoShowInfoBannerAfterAbortedStart: () => void;
}

export class PlaybackStartController {
    private _programStartSequence = 0;

    constructor(private readonly _deps: PlaybackStartControllerDeps) {}

    public async handleProgramStart(program: ScheduledProgram): Promise<void> {
        const sequence = ++this._programStartSequence;
        const isStale = (): boolean => sequence !== this._programStartSequence;
        const videoPlayer = this._deps.getVideoPlayer();

        if (!videoPlayer) {
            return;
        }

        const {
            programAtStart,
            programIdentityAtStart,
            shouldResetAutoShowInfoBannerOnAbort,
        } = this._deps.markProgramStarting(program);
        const abort = (): void => {
            if (shouldResetAutoShowInfoBannerOnAbort) {
                this._deps.clearAutoShowInfoBannerAfterAbortedStart();
            }
        };
        let prepared: PreparedPlaybackStream | null = null;
        let accepted: PreparedPlaybackStream | null = null;
        let discarded = false;
        const discardPrepared = async (): Promise<void> => {
            if (!prepared || discarded) {
                return;
            }
            discarded = true;
            await this._deps.discardPreparedStream(prepared);
        };

        try {
            this._deps.handleProgramStartUiSideEffects(programAtStart);
            prepared = await this._deps.resolveStreamForProgram(programAtStart);

            if (
                isStale() ||
                !this._deps.isProgramStillCurrent(programAtStart, programIdentityAtStart)
            ) {
                await discardPrepared();
                abort();
                return;
            }

            await videoPlayer.loadStream(prepared.descriptor);

            if (
                isStale() ||
                !this._deps.isProgramStillCurrent(programAtStart, programIdentityAtStart)
            ) {
                await discardPrepared();
                abort();
                return;
            }

            await videoPlayer.play();
            if (
                isStale() ||
                !this._deps.isProgramStillCurrent(programAtStart, programIdentityAtStart)
            ) {
                await discardPrepared();
                abort();
                return;
            }

            accepted = prepared;
        } catch (error) {
            if (
                isStale() ||
                !this._deps.isProgramStillCurrent(programAtStart, programIdentityAtStart)
            ) {
                await discardPrepared();
                abort();
                return;
            }

            if (this._deps.tryHandleStreamResolverAuthError(error)) {
                await discardPrepared();
                abort();
                return;
            }

            if (this._deps.tryHandleStreamResolverPermissionError(error)) {
                await discardPrepared();
                abort();
                return;
            }

            this._deps.logPlaybackStartFailure(error);
            let fallbackApplied = false;
            try {
                fallbackApplied = await this._deps.attemptTranscodeFallbackForCurrentProgram(
                    'programStart',
                    prepared ?? undefined
                );
            } catch {
                await discardPrepared();
                this._deps.handlePlaybackFailure('programStart', error);
                abort();
                return;
            }

            if (
                isStale() ||
                !this._deps.isProgramStillCurrent(programAtStart, programIdentityAtStart)
            ) {
                await discardPrepared();
                abort();
                return;
            }

            await discardPrepared();
            if (fallbackApplied) {
                abort();
                return;
            }
            this._deps.handlePlaybackFailure('programStart', error);
            abort();
            return;
        }

        if (!accepted) {
            return;
        }

        this._deps.commitPreparedStream(accepted);
        try {
            this._deps.handleStreamResolved(accepted);
        } catch (error: unknown) {
            this._deps.reportRecoverableActivationFailure(error);
        } finally {
            this._deps.resetPlaybackFailureGuard();
        }
    }
}
