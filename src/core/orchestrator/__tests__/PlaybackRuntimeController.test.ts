import { PlaybackRuntimeController, type PlaybackRuntimeControllerDeps } from '../priority-one/PlaybackRuntimeController';
import type { PlaybackError } from '../../../modules/player';
import { AppErrorCode } from '../../../types/app-errors';

const flushPromises = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const makePlaybackError = (): PlaybackError => ({
    code: AppErrorCode.PLAYBACK_DECODE_ERROR,
    message: 'decode failed',
    recoverable: false,
    retryCount: 0,
});

const makeDeps = (
    overrides: Partial<PlaybackRuntimeControllerDeps> = {}
): PlaybackRuntimeControllerDeps => ({
    playback: {
        pausePlayer: jest.fn(),
        playPlayer: jest.fn().mockResolvedValue(undefined),
        skipToNextProgram: jest.fn(),
        stopTranscodeSessionById: jest.fn(),
        playbackState: {
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            getShouldAutoShowInfoBannerOnNextPlay: jest.fn().mockReturnValue(false),
            setShouldAutoShowInfoBannerOnNextPlay: jest.fn(),
        },
        playbackRecovery: {
            isStreamRecoveryInProgress: jest.fn().mockReturnValue(false),
            attemptTranscodeFallbackForCurrentProgram: jest.fn().mockResolvedValue(false),
            handlePlaybackFailure: jest.fn(),
        },
    },
    schedulerRuntime: {
        pauseSchedulerSync: jest.fn(),
        resumeSchedulerSync: jest.fn(),
        syncSchedulerToCurrentTime: jest.fn(),
    },
    playerEvents: {
        onPlayerStateChange: jest.fn(),
        onPlayerTimeUpdate: jest.fn(),
        onPlayerBufferUpdate: jest.fn(),
    },
    uiRuntime: {
        handleGlobalError: jest.fn(),
        showInfoBanner: jest.fn(),
    },
    saveLifecycleState: jest.fn().mockResolvedValue(undefined),
    reportRecoverableAsyncFailure: jest.fn(),
    ...overrides,
} as unknown as PlaybackRuntimeControllerDeps);

describe('PlaybackRuntimeController', () => {
    it('reports async failures when non-recoverable playback error surfacing rejects', async () => {
        const globalErrorFailure = new Error('global error failed');
        const deps = makeDeps({
            playback: {
                ...makeDeps().playback,
                playbackRecovery: {
                    isStreamRecoveryInProgress: jest.fn().mockReturnValue(false),
                    attemptTranscodeFallbackForCurrentProgram: jest.fn().mockResolvedValue(false),
                },
            },
            uiRuntime: {
                handleGlobalError: jest.fn(() => {
                    throw globalErrorFailure;
                }),
                showInfoBanner: jest.fn(),
            },
        });

        new PlaybackRuntimeController(deps).handlePlaybackError(makePlaybackError());
        await flushPromises();

        expect(deps.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'orchestrator.playbackRuntime.handleNonRecoverablePlaybackError',
            'Non-recoverable playback error handler rejected',
            globalErrorFailure,
            expect.objectContaining({
                context: 'video-player',
                playbackError: expect.objectContaining({
                    message: 'decode failed',
                }),
            })
        );
    });

    it('keeps fatal playback surfacing alive when the recoverable failure reporter throws', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const reporterFailure = new Error('reporter failed');
        const deps = makeDeps({
            playback: {
                ...makeDeps().playback,
                playbackRecovery: {
                    isStreamRecoveryInProgress: jest.fn().mockReturnValue(false),
                    attemptTranscodeFallbackForCurrentProgram: jest.fn().mockRejectedValue(new Error('fallback failed')),
                    handlePlaybackFailure: jest.fn(() => {
                        throw new Error('handler failed');
                    }),
                },
            },
            reportRecoverableAsyncFailure: jest.fn(() => {
                throw reporterFailure;
            }),
        });

        new PlaybackRuntimeController(deps).handlePlaybackError(makePlaybackError());
        await flushPromises();

        expect(deps.uiRuntime.handleGlobalError).toHaveBeenCalledWith(
            expect.objectContaining({
                code: AppErrorCode.PLAYBACK_DECODE_ERROR,
                recoverable: false,
            }),
            'video-player'
        );
        expect(warn).toHaveBeenCalledWith(
            'Recoverable failure reporter threw',
            expect.objectContaining({
                subsystem: 'playback-runtime',
                event: 'orchestrator.playbackRecovery.attemptTranscodeFallbackForCurrentProgram',
            })
        );
        warn.mockRestore();
    });
});
