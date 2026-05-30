import type { StreamDescriptor, IVideoPlayer } from '../../../modules/player';
import type {
    ScheduledProgram,
    ScheduledProgramIdentity,
} from '../../../modules/scheduler/scheduler';

export interface PlaybackStartControllerDeps {
    getVideoPlayer: () => Pick<IVideoPlayer, 'loadStream' | 'play'> | null;
    resolveStreamForProgram: (program: ScheduledProgram) => Promise<StreamDescriptor | null | undefined>;
    resetPlaybackFailureGuard: () => void;
    tryHandleStreamResolverAuthError: (error: unknown) => boolean;
    tryHandleStreamResolverPermissionError: (error: unknown) => boolean;
    attemptTranscodeFallbackForCurrentProgram: (reason: string) => Promise<boolean>;
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
    handleStreamResolved: (stream: StreamDescriptor) => void;
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

        try {
            this._deps.handleProgramStartUiSideEffects(programAtStart);
            const stream = await this._deps.resolveStreamForProgram(programAtStart);

            if (
                isStale() ||
                !this._deps.isProgramStillCurrent(programAtStart, programIdentityAtStart) ||
                !stream
            ) {
                abort();
                return;
            }

            this._deps.handleStreamResolved(stream);
            await videoPlayer.loadStream(stream);

            if (
                isStale() ||
                !this._deps.isProgramStillCurrent(programAtStart, programIdentityAtStart)
            ) {
                abort();
                return;
            }

            await videoPlayer.play();
            this._deps.resetPlaybackFailureGuard();
        } catch (error) {
            if (
                isStale() ||
                !this._deps.isProgramStillCurrent(programAtStart, programIdentityAtStart)
            ) {
                abort();
                return;
            }

            if (this._deps.tryHandleStreamResolverAuthError(error)) {
                abort();
                return;
            }

            if (this._deps.tryHandleStreamResolverPermissionError(error)) {
                abort();
                return;
            }

            this._deps.logPlaybackStartFailure(error);
            let fallbackApplied = false;
            try {
                fallbackApplied = await this._deps.attemptTranscodeFallbackForCurrentProgram('programStart');
            } catch {
                this._deps.handlePlaybackFailure('programStart', error);
                abort();
                return;
            }

            if (
                isStale() ||
                !this._deps.isProgramStillCurrent(programAtStart, programIdentityAtStart)
            ) {
                abort();
                return;
            }

            if (fallbackApplied) {
                abort();
                return;
            }
            this._deps.handlePlaybackFailure('programStart', error);
            abort();
        }
    }
}
