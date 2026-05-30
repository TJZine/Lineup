import { NOW_PLAYING_INFO_MODAL_ID } from '../../../modules/ui/now-playing-info';
import type { StreamDescriptor } from '../../../modules/player';
import type { ScheduledProgram } from '../../../modules/scheduler/scheduler';
import { AppErrorCode } from '../../../types/app-errors';
import type { OrchestratorPlaybackStateAccessors } from '../runtime/OrchestratorPlaybackStateAccessors';
import {
    createPriorityOneRuntimeAssembly,
    type PriorityOneRuntimeAssemblyInput,
} from '../priority-one/PriorityOneAssemblyBuilder';
import { createTestEventSurface } from './eventSurfaceTestUtils';

const makeProgram = (): ScheduledProgram =>
    ({
        item: {
            ratingKey: 'item-1',
            title: 'Program',
            durationMs: 60_000,
            type: 'movie',
        },
        elapsedMs: 0,
        scheduledStartTime: 0,
        scheduledEndTime: 60_000,
        remainingMs: 60_000,
        scheduleIndex: 0,
        loopNumber: 0,
        isCurrent: true,
    } as unknown as ScheduledProgram);

const flushPromises = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};

describe('createPriorityOneRuntimeAssembly', () => {
    it('owns priority-one input shaping and controller/binder creation from runtime refs', async () => {
        const program = makeProgram();
        const scheduler = createTestEventSurface();
        const videoPlayer = createTestEventSurface();
        const navigation = createTestEventSurface();
        const cleanupError = new Error('cleanup failed');
        const navigationCleanup = jest.fn(() => {
            throw cleanupError;
        });
        const cleanupReporter = jest.fn();
        const handlePlayerTrackChange = jest.fn();
        const stopTranscodeSessionById = jest.fn();
        const openModal = jest.fn();
        const closeModal = jest.fn();
        const onProgramStart = jest.fn();
        const refreshEpgScheduleForLiveChannel = jest.fn();
        const refreshPlaybackOptions = jest.fn();
        const maybeAutoShowNowPlayingStreamDebugHud = jest.fn();
        const maybeFetchNowPlayingStreamDecisionForDebugHud = jest.fn().mockResolvedValue(undefined);
        const playbackFailureHandlerError = new Error('recovery handler failed');
        const handlePlaybackFailure = jest.fn(() => {
            throw playbackFailureHandlerError;
        });
        const reportRecoverableRuntimeError = jest.fn();
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(program),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue({
                isTranscoding: true,
                sessionId: 'transcode-session-1',
            }),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
            setPendingNowPlayingChannelId: jest.fn(),
            getShouldAutoShowInfoBannerOnNextPlay: jest.fn().mockReturnValue(false),
            setShouldAutoShowInfoBannerOnNextPlay: jest.fn(),
        };
        const input: PriorityOneRuntimeAssemblyInput = {
            requiredModules: {
                scheduler: {
                    on: scheduler.on,
                    off: scheduler.off,
                    skipToNext: jest.fn(),
                    pauseSyncTimer: jest.fn(),
                    resumeSyncTimer: jest.fn(),
                    syncToCurrentTime: jest.fn(),
                    unloadChannel: jest.fn(),
                } as unknown as PriorityOneRuntimeAssemblyInput['requiredModules']['scheduler'],
                videoPlayer: {
                    on: videoPlayer.on,
                    off: videoPlayer.off,
                    loadStream: jest.fn().mockResolvedValue(undefined),
                    play: jest.fn().mockResolvedValue(undefined),
                    pause: jest.fn(),
                } as unknown as PriorityOneRuntimeAssemblyInput['requiredModules']['videoPlayer'],
                lifecycle: {
                    saveState: jest.fn().mockResolvedValue(undefined),
                    onPause: jest.fn().mockReturnValue({ dispose: jest.fn() }),
                    onResume: jest.fn().mockReturnValue({ dispose: jest.fn() }),
                } as unknown as PriorityOneRuntimeAssemblyInput['requiredModules']['lifecycle'],
            },
            runtimeSurfaces: {
                channelBadgeOverlay: null,
                playerOsd: null,
                nowPlayingInfo: { isVisible: jest.fn().mockReturnValue(false) },
                epg: null,
                channelManager: null,
                navigation: {
                    on: navigation.on,
                    off: navigation.off,
                    getCurrentScreen: jest.fn().mockReturnValue('player'),
                    isModalOpen: jest.fn().mockReturnValue(false),
                    openModal,
                    closeModal,
                } as unknown as PriorityOneRuntimeAssemblyInput['runtimeSurfaces']['navigation'],
                plexLibrary: null,
                plexStreamResolver: {
                    on: jest.fn(),
                    off: jest.fn(),
                    stopTranscodeSession: jest.fn((_sessionId: string) => {
                        stopTranscodeSessionById(_sessionId);
                        return Promise.resolve();
                    }),
                } as unknown as PriorityOneRuntimeAssemblyInput['runtimeSurfaces']['plexStreamResolver'],
            },
            playback: {
                playbackState,
                playbackRecovery: {
                    resolveStreamForProgram: jest.fn().mockResolvedValue({
                        id: 'stream-1',
                    } as unknown as StreamDescriptor),
                    resetPlaybackFailureGuard: jest.fn(),
                    tryHandleStreamResolverAuthError: jest.fn().mockReturnValue(false),
                    tryHandleStreamResolverPermissionError: jest.fn().mockReturnValue(false),
                    attemptTranscodeFallbackForCurrentProgram: jest.fn().mockResolvedValue(false),
                    handlePlaybackFailure,
                    isStreamRecoveryInProgress: jest.fn().mockReturnValue(false),
                },
            },
            runtimeControllers: {
                channelTransition: {
                    isActive: jest.fn().mockReturnValue(false),
                    onPlayerStateChange: jest.fn(),
                    onScreenChange: jest.fn(),
                },
                playerOsd: {
                    onPlayerStateChange: jest.fn(),
                    onTimeUpdate: jest.fn(),
                    onBufferUpdate: jest.fn(),
                    showInfoBanner: jest.fn(),
                },
                nowPlayingInfo: {
                    onProgramStart,
                },
                epg: {
                    refreshEpgScheduleForLiveChannel,
                    wireEpgEvents: jest.fn().mockReturnValue([]),
                },
                navigation: {
                    wireNavigationEvents: jest.fn().mockReturnValue([navigationCleanup]),
                },
                playbackOptions: {
                    refreshIfOpen: refreshPlaybackOptions,
                },
                scheduleDayRollover: {
                    cancelPendingDayRollover: jest.fn(),
                    handleScheduleDayRollover: jest.fn().mockResolvedValue(undefined),
                },
                subtitleTrackRecovery: {
                    handleTrackChange: handlePlayerTrackChange,
                },
                nowPlayingDebug: {
                    maybeAutoShowNowPlayingStreamDebugHud,
                    maybeFetchNowPlayingStreamDecisionForDebugHud,
                },
            },
            orchestratorCallbacks: {
                stopPlayback: jest.fn(),
                handleGlobalError: jest.fn(),
                handlePlexLibraryAuthExpired: jest.fn(),
                handlePlexStreamError: jest.fn(),
                showPersistenceWarning: jest.fn(),
                reportRecoverableRuntimeIssue: cleanupReporter,
                reportRecoverableRuntimeError,
            },
        };

        const priorityOne = createPriorityOneRuntimeAssembly(input);

        priorityOne.eventBinder.bind();
        videoPlayer.emit('trackChange', { type: 'subtitle', trackId: 'subtitle-1' });
        scheduler.emit('programStart', program);
        await flushPromises();
        priorityOne.playbackRuntimeController.stopActiveTranscodeSession();
        priorityOne.playbackRuntimeController.handlePlaybackError({
            code: AppErrorCode.PLAYBACK_DECODE_ERROR,
            message: 'fatal',
            recoverable: false,
            retryCount: 0,
        });
        await flushPromises();
        priorityOne.overlayRuntimePolicyController.toggleNowPlayingInfoOverlay();
        priorityOne.eventBinder.dispose();

        expect(handlePlayerTrackChange).toHaveBeenCalledWith({
            type: 'subtitle',
            trackId: 'subtitle-1',
        });
        expect(onProgramStart).toHaveBeenCalledWith(program);
        expect(refreshEpgScheduleForLiveChannel).toHaveBeenCalledTimes(1);
        expect(maybeAutoShowNowPlayingStreamDebugHud).toHaveBeenCalledTimes(1);
        expect(maybeFetchNowPlayingStreamDecisionForDebugHud).toHaveBeenCalledTimes(1);
        expect(refreshPlaybackOptions).toHaveBeenCalledTimes(1);
        expect(stopTranscodeSessionById).toHaveBeenCalledWith('transcode-session-1');
        expect(reportRecoverableRuntimeError).toHaveBeenCalledWith(
            'orchestrator.playbackRecovery.handlePlaybackFailure',
            'Playback recovery failure handler threw',
            playbackFailureHandlerError,
            {
                context: 'video-player',
                playbackError: {
                    code: AppErrorCode.PLAYBACK_DECODE_ERROR,
                    message: 'fatal',
                },
            }
        );
        expect(openModal).toHaveBeenCalledWith(NOW_PLAYING_INFO_MODAL_ID);
        expect(closeModal).not.toHaveBeenCalled();
        expect(cleanupReporter).toHaveBeenCalledWith(
            'orchestrator.eventWiring.rollback',
            'Event wiring rollback failures',
            {
                failures: [
                    expect.objectContaining({
                        step: 'event-wiring.cleanup',
                        error: expect.objectContaining({
                            message: cleanupError.message,
                        }),
                    }),
                ],
            },
        );
    });
});
