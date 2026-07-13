import type { PreparedPlaybackStream, IVideoPlayer } from '../../modules/player';
import type { ScheduledProgram } from '../../modules/scheduler/scheduler';
import { makePreparedPlaybackStream } from '../../__tests__/fixtures/preparedPlaybackStream';
import {
    PlaybackStartController,
    type PlaybackStartControllerDeps,
} from '../orchestrator/priority-one/PlaybackStartController';

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
        isCurrent: false,
        ...overrides,
    } as ScheduledProgram);

type TestVideoPlayer = Pick<IVideoPlayer, 'loadStream' | 'play'>;

const makePrepared = makePreparedPlaybackStream;

const makeSetup = (
    overrides: Partial<jest.Mocked<PlaybackStartControllerDeps>> = {}
): {
    controller: PlaybackStartController;
    deps: jest.Mocked<PlaybackStartControllerDeps>;
    videoPlayer: TestVideoPlayer;
} => {
    const videoPlayer: TestVideoPlayer = {
        loadStream: jest.fn().mockResolvedValue(undefined),
        play: jest.fn().mockResolvedValue(undefined),
    };

    const deps = {
        getVideoPlayer: jest.fn(() => videoPlayer),
        resolveStreamForProgram: jest.fn().mockResolvedValue(
            makePrepared('https://example.invalid/stream.m3u8')
        ),
        discardPreparedStream: jest.fn().mockResolvedValue(undefined),
        resetPlaybackFailureGuard: jest.fn(),
        tryHandleStreamResolverAuthError: jest.fn().mockReturnValue(false),
        tryHandleStreamResolverPermissionError: jest.fn().mockReturnValue(false),
        attemptTranscodeFallbackForCurrentProgram: jest.fn().mockResolvedValue(false),
        handlePlaybackFailure: jest.fn(),
        logPlaybackStartFailure: jest.fn(),
        markProgramStarting: jest.fn((program: ScheduledProgram) => ({
            programAtStart: program,
            programIdentityAtStart: null,
            shouldResetAutoShowInfoBannerOnAbort: false,
        })),
        isProgramStillCurrent: jest.fn().mockReturnValue(true),
        handleProgramStartUiSideEffects: jest.fn(),
        commitPreparedStream: jest.fn(),
        handleStreamResolved: jest.fn(),
        reportRecoverableActivationFailure: jest.fn(),
        clearAutoShowInfoBannerAfterAbortedStart: jest.fn(),
        ...overrides,
    } as unknown as jest.Mocked<PlaybackStartControllerDeps>;

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
        expect(deps.commitPreparedStream).toHaveBeenCalledWith(
            expect.objectContaining({
                descriptor: expect.objectContaining({ url: 'https://example.invalid/stream.m3u8' }),
            })
        );
        expect(videoPlayer.loadStream).toHaveBeenCalledWith(
            expect.objectContaining({ url: 'https://example.invalid/stream.m3u8' })
        );
        expect(videoPlayer.play).toHaveBeenCalledTimes(1);
        expect(deps.resetPlaybackFailureGuard).toHaveBeenCalledTimes(1);
        expect(deps.discardPreparedStream).not.toHaveBeenCalled();
    });

    it('activates only after play resolves and the final start remains current', async () => {
        let resolvePlay: () => void = () => undefined;
        const playResult = new Promise<void>((resolve) => {
            resolvePlay = resolve;
        });
        const { controller, deps, videoPlayer } = makeSetup();
        (videoPlayer.play as jest.Mock).mockReturnValueOnce(playResult);

        const start = controller.handleProgramStart(makeProgram());
        await Promise.resolve();
        await Promise.resolve();

        expect(deps.commitPreparedStream).not.toHaveBeenCalled();
        expect(deps.resetPlaybackFailureGuard).not.toHaveBeenCalled();

        resolvePlay();
        await start;

        expect(deps.commitPreparedStream).toHaveBeenCalledTimes(1);
        expect(deps.resetPlaybackFailureGuard).toHaveBeenCalledTimes(1);
    });

    it('does not route permission-denied stream errors into playback-failure guard', async () => {
        const permissionError = { code: 'ACCESS_DENIED', message: 'no access' };
        const { controller, deps, videoPlayer } = makeSetup({
            getVideoPlayer: jest.fn(() => videoPlayer),
            resolveStreamForProgram: jest.fn().mockRejectedValue(permissionError),
            tryHandleStreamResolverPermissionError: jest.fn().mockReturnValue(true),
        });

        await controller.handleProgramStart(makeProgram());

        expect(deps.tryHandleStreamResolverAuthError).toHaveBeenCalledWith(permissionError);
        expect(deps.tryHandleStreamResolverPermissionError).toHaveBeenCalledWith(permissionError);
        expect(deps.handlePlaybackFailure).not.toHaveBeenCalled();
        expect(videoPlayer.loadStream).not.toHaveBeenCalled();
        expect(videoPlayer.play).not.toHaveBeenCalled();
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
        const { controller, deps } = makeSetup({
            getVideoPlayer: jest.fn(() => videoPlayer),
            resolveStreamForProgram: jest.fn()
                .mockResolvedValueOnce(makePrepared('https://example.invalid/a.m3u8'))
                .mockResolvedValueOnce(makePrepared('https://example.invalid/b.m3u8')),
        });

        const firstPromise = controller.handleProgramStart(programA);
        await firstLoadStarted;
        await controller.handleProgramStart(programB);
        resolveFirstLoad();
        await firstPromise;

        expect(videoPlayer.play).toHaveBeenCalledTimes(1);
        expect(deps.commitPreparedStream).toHaveBeenCalledTimes(1);
        expect(deps.discardPreparedStream).toHaveBeenCalledWith(
            expect.objectContaining({
                descriptor: expect.objectContaining({ url: 'https://example.invalid/a.m3u8' }),
            })
        );
    });

    it('discards a start superseded while stream preparation is pending', async () => {
        const programA = makeProgram();
        const programB = makeProgram({ scheduleIndex: 1 });
        let resolveFirstPreparation: (prepared: PreparedPlaybackStream) => void = () => undefined;
        const firstPreparation = new Promise<PreparedPlaybackStream>((resolve) => {
            resolveFirstPreparation = resolve;
        });
        const { controller, deps, videoPlayer } = makeSetup({
            resolveStreamForProgram: jest.fn()
                .mockReturnValueOnce(firstPreparation)
                .mockResolvedValueOnce(makePrepared('https://example.invalid/b.m3u8')),
            markProgramStarting: jest.fn((program: ScheduledProgram) => ({
                programAtStart: program,
                programIdentityAtStart: null,
                shouldResetAutoShowInfoBannerOnAbort: true,
            })),
        });

        const firstStart = controller.handleProgramStart(programA);
        await controller.handleProgramStart(programB);
        resolveFirstPreparation(makePrepared('https://example.invalid/a.m3u8'));
        await firstStart;

        expect(videoPlayer.loadStream).toHaveBeenCalledTimes(1);
        expect(deps.commitPreparedStream).toHaveBeenCalledTimes(1);
        expect(deps.discardPreparedStream).toHaveBeenCalledTimes(1);
        expect(deps.discardPreparedStream).toHaveBeenCalledWith(
            expect.objectContaining({
                descriptor: expect.objectContaining({ url: 'https://example.invalid/a.m3u8' }),
            })
        );
        expect(deps.clearAutoShowInfoBannerAfterAbortedStart).toHaveBeenCalledTimes(1);
    });

    it('discards a start superseded while play is pending', async () => {
        const programA = makeProgram();
        const programB = makeProgram({ scheduleIndex: 1 });
        let resolveFirstPlay: () => void = () => undefined;
        const firstPlay = new Promise<void>((resolve) => {
            resolveFirstPlay = resolve;
        });
        const videoPlayer: TestVideoPlayer = {
            loadStream: jest.fn().mockResolvedValue(undefined),
            play: jest.fn()
                .mockReturnValueOnce(firstPlay)
                .mockResolvedValueOnce(undefined),
        };
        const { controller, deps } = makeSetup({
            getVideoPlayer: jest.fn(() => videoPlayer),
            resolveStreamForProgram: jest.fn()
                .mockResolvedValueOnce(makePrepared('https://example.invalid/a.m3u8'))
                .mockResolvedValueOnce(makePrepared('https://example.invalid/b.m3u8')),
        });

        const firstStart = controller.handleProgramStart(programA);
        await Promise.resolve();
        await Promise.resolve();
        await controller.handleProgramStart(programB);
        resolveFirstPlay();
        await firstStart;

        expect(deps.commitPreparedStream).toHaveBeenCalledTimes(1);
        expect(deps.commitPreparedStream).toHaveBeenCalledWith(
            expect.objectContaining({
                descriptor: expect.objectContaining({ url: 'https://example.invalid/b.m3u8' }),
            })
        );
        expect(deps.discardPreparedStream).toHaveBeenCalledWith(
            expect.objectContaining({
                descriptor: expect.objectContaining({ url: 'https://example.invalid/a.m3u8' }),
            })
        );
    });

    it('suppresses stale in-flight start rejection after a newer program arrives', async () => {
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
        let rejectFirstLoad: (error: Error) => void = () => undefined;
        const firstLoad = new Promise<void>((_resolve, reject) => {
            rejectFirstLoad = reject;
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
        const { controller, deps } = makeSetup({
            getVideoPlayer: jest.fn(() => videoPlayer),
            resolveStreamForProgram: jest.fn()
                .mockResolvedValueOnce(makePrepared('https://example.invalid/a.m3u8'))
                .mockResolvedValueOnce(makePrepared('https://example.invalid/b.m3u8')),
        });

        const firstPromise = controller.handleProgramStart(programA);
        await firstLoadStarted;
        await controller.handleProgramStart(programB);
        const staleError = new Error('stale direct load failed');
        rejectFirstLoad(staleError);
        await firstPromise;

        expect(videoPlayer.play).toHaveBeenCalledTimes(1);
        expect(deps.logPlaybackStartFailure).not.toHaveBeenCalledWith(staleError);
        expect(deps.attemptTranscodeFallbackForCurrentProgram).not.toHaveBeenCalledWith('programStart');
        expect(deps.handlePlaybackFailure).not.toHaveBeenCalledWith('programStart', staleError);
    });

    it('attempts transcode fallback before surfacing a playback start failure', async () => {
        const loadError = new Error('direct load failed');
        const { controller, deps, videoPlayer } = makeSetup();
        (videoPlayer.loadStream as jest.Mock).mockRejectedValueOnce(loadError);
        deps.attemptTranscodeFallbackForCurrentProgram.mockResolvedValueOnce(true);

        await controller.handleProgramStart(makeProgram());

        expect(deps.logPlaybackStartFailure).toHaveBeenCalledWith(loadError);
        expect(deps.attemptTranscodeFallbackForCurrentProgram).toHaveBeenCalledWith(
            'programStart',
            expect.objectContaining({ descriptor: expect.any(Object) })
        );
        expect(deps.handlePlaybackFailure).not.toHaveBeenCalled();
    });

    it('surfaces playback start failure when guarded transcode fallback does not apply', async () => {
        const loadError = new Error('direct load failed');
        const { controller, deps, videoPlayer } = makeSetup();
        (videoPlayer.loadStream as jest.Mock).mockRejectedValueOnce(loadError);

        await controller.handleProgramStart(makeProgram());

        expect(deps.attemptTranscodeFallbackForCurrentProgram).toHaveBeenCalledWith(
            'programStart',
            expect.objectContaining({ descriptor: expect.any(Object) })
        );
        expect(deps.handlePlaybackFailure).toHaveBeenCalledWith('programStart', loadError);
    });

});
