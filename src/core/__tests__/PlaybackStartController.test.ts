import type { StreamDescriptor, IVideoPlayer } from '../../modules/player';
import type { ScheduledProgram } from '../../modules/scheduler/scheduler';
import {
    PlaybackStartController,
    type PlaybackStartControllerDeps,
} from '../PlaybackStartController';

const makeProgram = (overrides: Partial<ScheduledProgram> = {}): ScheduledProgram =>
    ({
        item: {
            ratingKey: 'item-1',
            title: 'Test Item',
            durationMs: 60_000,
            type: 'movie',
        } as ScheduledProgram['item'],
        elapsedMs: 0,
        scheduledStartTime: 0,
        scheduledEndTime: 60_000,
        remainingMs: 60_000,
        scheduleIndex: 0,
        loopNumber: 0,
        streamDescriptor: null,
        isCurrent: false,
        ...overrides,
    } as ScheduledProgram);

type TestVideoPlayer = Pick<IVideoPlayer, 'loadStream' | 'play'>;

const makeSetup = (
    overrides: Partial<PlaybackStartControllerDeps> = {}
): {
    controller: PlaybackStartController;
    deps: PlaybackStartControllerDeps;
    videoPlayer: TestVideoPlayer;
} => {
    const videoPlayer: TestVideoPlayer = {
        loadStream: jest.fn().mockResolvedValue(undefined),
        play: jest.fn().mockResolvedValue(undefined),
    };

    const deps: PlaybackStartControllerDeps = {
        getVideoPlayer: () => videoPlayer,
        resolveStreamForProgram: jest.fn().mockResolvedValue(
            { url: 'https://example.invalid/stream.m3u8' } as unknown as StreamDescriptor
        ),
        resetPlaybackFailureGuard: jest.fn(),
        tryHandleStreamResolverAuthError: jest.fn().mockReturnValue(false),
        tryHandleStreamResolverPermissionError: jest.fn().mockReturnValue(false),
        handlePlaybackFailure: jest.fn(),
        logPlaybackStartFailure: jest.fn(),
        markProgramStarting: jest.fn((program: ScheduledProgram) => ({
            programAtStart: program,
            shouldResetAutoShowInfoBannerOnAbort: false,
        })),
        isProgramStillCurrent: jest.fn().mockReturnValue(true),
        handleProgramStartUiSideEffects: jest.fn(),
        handleStreamResolved: jest.fn(),
        clearAutoShowInfoBannerAfterAbortedStart: jest.fn(),
        ...overrides,
    };

    return {
        controller: new PlaybackStartController(deps),
        deps,
        videoPlayer,
    };
};

describe('PlaybackStartController', () => {
    it('loads and plays the resolved stream for the requested program', async () => {
        const program = makeProgram();
        const { controller, deps, videoPlayer } = makeSetup();

        await controller.handleProgramStart(program);

        expect(deps.markProgramStarting).toHaveBeenCalledWith(program);
        expect(deps.handleProgramStartUiSideEffects).toHaveBeenCalledWith(program);
        expect(deps.handleStreamResolved).toHaveBeenCalledWith(
            expect.objectContaining({ url: 'https://example.invalid/stream.m3u8' })
        );
        expect(videoPlayer.loadStream).toHaveBeenCalledWith(
            expect.objectContaining({ url: 'https://example.invalid/stream.m3u8' })
        );
        expect(videoPlayer.play).toHaveBeenCalledTimes(1);
        expect(deps.resetPlaybackFailureGuard).toHaveBeenCalledTimes(1);
    });

    it('suppresses a stale in-flight start when a newer program arrives', async () => {
        const programA = makeProgram();
        const programB = makeProgram({
            scheduleIndex: 1,
            scheduledStartTime: 60_000,
            scheduledEndTime: 120_000,
        });
        let notifyFirstLoadStarted: () => void = () => undefined;
        const firstLoadStarted = new Promise<void>((resolve) => {
            notifyFirstLoadStarted = resolve;
        });
        let resolveFirstLoad: () => void = () => undefined;
        const firstLoad = new Promise<void>((resolve) => {
            resolveFirstLoad = resolve;
        });
        const videoPlayer: TestVideoPlayer = {
            loadStream: jest.fn()
                .mockImplementationOnce(async () => {
                    notifyFirstLoadStarted();
                    await firstLoad;
                })
                .mockResolvedValueOnce(undefined),
            play: jest.fn().mockResolvedValue(undefined),
        };
        const { controller } = makeSetup({
            getVideoPlayer: () => videoPlayer,
            resolveStreamForProgram: jest.fn()
                .mockResolvedValueOnce({ url: 'https://example.invalid/a.m3u8' } as unknown as StreamDescriptor)
                .mockResolvedValueOnce({ url: 'https://example.invalid/b.m3u8' } as unknown as StreamDescriptor),
        });

        const firstPromise = controller.handleProgramStart(programA);
        await firstLoadStarted;
        await controller.handleProgramStart(programB);
        resolveFirstLoad();
        await firstPromise;

        expect(videoPlayer.play).toHaveBeenCalledTimes(1);
    });

    it('clears the pending auto-show flag when an aborted start was carrying it', async () => {
        const program = makeProgram();
        const { controller, deps, videoPlayer } = makeSetup({
            resolveStreamForProgram: jest.fn().mockResolvedValue(null),
            markProgramStarting: jest.fn((currentProgram: ScheduledProgram) => ({
                programAtStart: currentProgram,
                shouldResetAutoShowInfoBannerOnAbort: true,
            })),
        });

        await controller.handleProgramStart(program);

        expect(deps.clearAutoShowInfoBannerAfterAbortedStart).toHaveBeenCalledTimes(1);
        expect(videoPlayer.play).not.toHaveBeenCalled();
        expect(deps.handlePlaybackFailure).not.toHaveBeenCalled();
    });

    it('tracks the last in-flight promise when using handleProgramStartTracked', async () => {
        const program = makeProgram();
        const { controller } = makeSetup();

        const promise = controller.handleProgramStartTracked(program);

        expect(controller.getLastProgramStartPromise()).toBe(promise);

        await promise;
    });
});
