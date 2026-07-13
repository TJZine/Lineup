import { PlaybackStartController, type PlaybackStartControllerDeps } from '../priority-one/PlaybackStartController';
import type { ScheduledProgram } from '../../../modules/scheduler/scheduler';
import { makePreparedPlaybackStream } from '../../../__tests__/fixtures/preparedPlaybackStream';

const makePrepared = (): ReturnType<typeof makePreparedPlaybackStream> =>
    makePreparedPlaybackStream('http://test/stream.mp4');

const makeProgram = (ratingKey = 'item-1'): ScheduledProgram => ({
    item: {
        ratingKey,
        title: 'Test Item',
        durationMs: 60_000,
        type: 'movie',
    } as ScheduledProgram['item'],
    elapsedMs: 5000,
    scheduledStartTime: 0,
    scheduledEndTime: 60_000,
    remainingMs: 55_000,
    scheduleIndex: 0,
} as ScheduledProgram);

const makeDeps = (
    overrides: Partial<PlaybackStartControllerDeps> = {}
): PlaybackStartControllerDeps => {
    const deps: PlaybackStartControllerDeps = {
        getVideoPlayer: () => ({
            loadStream: jest.fn().mockResolvedValue(undefined),
            play: jest.fn().mockResolvedValue(undefined),
        }),
        resolveStreamForProgram: jest.fn().mockResolvedValue(makePrepared()),
        discardPreparedStream: jest.fn().mockResolvedValue(undefined),
        resetPlaybackFailureGuard: jest.fn(),
        tryHandleStreamResolverAuthError: jest.fn().mockReturnValue(false),
        tryHandleStreamResolverPermissionError: jest.fn().mockReturnValue(false),
        attemptTranscodeFallbackForCurrentProgram: jest.fn().mockResolvedValue(false),
        handlePlaybackFailure: jest.fn(),
        logPlaybackStartFailure: jest.fn(),
        markProgramStarting: (program) => ({
            programAtStart: program,
            programIdentityAtStart: null,
            shouldResetAutoShowInfoBannerOnAbort: true,
        }),
        isProgramStillCurrent: jest.fn().mockReturnValue(true),
        handleProgramStartUiSideEffects: jest.fn(),
        commitPreparedStream: jest.fn(),
        handleStreamResolved: jest.fn(),
        reportRecoverableActivationFailure: jest.fn(),
        clearAutoShowInfoBannerAfterAbortedStart: jest.fn(),
        ...overrides,
    };
    return deps;
};

describe('PlaybackStartController', () => {
    it('surfaces the original program-start error when transcode fallback throws', async () => {
        const originalError = new Error('load failed');
        const fallbackError = new Error('fallback failed');
        const deps = makeDeps({
            resolveStreamForProgram: jest.fn().mockRejectedValue(originalError),
            attemptTranscodeFallbackForCurrentProgram: jest.fn().mockRejectedValue(fallbackError),
        });

        await new PlaybackStartController(deps).handleProgramStart(makeProgram());

        expect(deps.attemptTranscodeFallbackForCurrentProgram).toHaveBeenCalledWith(
            'programStart',
            undefined
        );
        expect(deps.handlePlaybackFailure).toHaveBeenCalledWith('programStart', originalError);
        expect(deps.clearAutoShowInfoBannerAfterAbortedStart).toHaveBeenCalledTimes(1);
    });

    it('does not surface stale program-start failures after fallback resolves', async () => {
        const originalError = new Error('load failed');
        const program = makeProgram();
        const deps = makeDeps({
            resolveStreamForProgram: jest.fn().mockRejectedValue(originalError),
            attemptTranscodeFallbackForCurrentProgram: jest.fn().mockImplementation(async () => false),
            isProgramStillCurrent: jest.fn()
                .mockReturnValueOnce(true)
                .mockReturnValueOnce(false),
        });

        await new PlaybackStartController(deps).handleProgramStart(program);

        expect(deps.handlePlaybackFailure).not.toHaveBeenCalled();
        expect(deps.clearAutoShowInfoBannerAfterAbortedStart).toHaveBeenCalledTimes(1);
    });
});
