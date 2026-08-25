import { makePreparedPlaybackStream } from '../../../__tests__/fixtures/preparedPlaybackStream';
import { NOW_PLAYING_INFO_MODAL_ID } from '../../../modules/ui/now-playing-info';
import type { ScheduledProgram, SchedulerState } from '../../../modules/scheduler/scheduler';
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

describe('createPriorityOneRuntimeAssembly', () => {
    it('composes runtime-owner callbacks through the controllers and event binder', async () => {
        const program = makeProgram();
        let currentProgram: ScheduledProgram | null = null;
        let currentDescriptor: ReturnType<typeof makePreparedPlaybackStream>['descriptor'] | null = null;
        let currentDecision: ReturnType<typeof makePreparedPlaybackStream>['decision'] | null = {
            ...makePreparedPlaybackStream().decision,
            isTranscoding: true,
            sessionId: 'transcode-session-1',
        };
        let pendingChannelId: string | null = 'channel-1';
        let shouldAutoShowInfo = false;
        const playbackState = {
            getCurrentProgramForPlayback: jest.fn(() => currentProgram),
            setCurrentProgramForPlayback: jest.fn((value: ScheduledProgram | null): void => {
                currentProgram = value;
            }),
            getCurrentStreamDescriptor: jest.fn(() => currentDescriptor),
            setCurrentStreamDescriptor: jest.fn((value): void => {
                currentDescriptor = value;
            }),
            getCurrentStreamDecision: jest.fn(() => currentDecision),
            setCurrentStreamDecision: jest.fn((value): void => {
                currentDecision = value;
            }),
            getPendingNowPlayingChannelId: jest.fn(() => pendingChannelId),
            setPendingNowPlayingChannelId: jest.fn((value: string | null): void => {
                pendingChannelId = value;
            }),
            getShouldAutoShowInfoBannerOnNextPlay: jest.fn(() => shouldAutoShowInfo),
            setShouldAutoShowInfoBannerOnNextPlay: jest.fn((value: boolean): void => {
                shouldAutoShowInfo = value;
            }),
        } satisfies jest.Mocked<OrchestratorPlaybackStateAccessors>;
        const scheduler = createTestEventSurface();
        const player = createTestEventSurface();
        const navigation = createTestEventSurface();
        const resolver = createTestEventSurface();
        const refreshPlaybackOptions = jest.fn();
        const recoverSubtitleTrack = jest.fn();
        const onProgramStart = jest.fn();
        const refreshLiveEpg = jest.fn();
        const autoShowDebug = jest.fn();
        let resolveActivation!: () => void;
        const activationComplete = new Promise<void>((resolve) => {
            resolveActivation = resolve;
        });
        const fetchDebug = jest.fn((): Promise<void> => {
            resolveActivation();
            return Promise.resolve();
        });
        const stopTranscodeSession = jest.fn().mockResolvedValue(undefined);
        const lifecyclePauseCleanup = jest.fn();
        const lifecycleResumeCleanup = jest.fn();
        const navigationCleanupError = new Error('navigation cleanup failed');
        const reportRecoverableRuntimeIssue = jest.fn();
        let resolvePlaybackErrorReport!: () => void;
        const playbackErrorReported = new Promise<void>((resolve) => {
            resolvePlaybackErrorReport = resolve;
        });
        const reportRecoverableRuntimeError = jest.fn((): void => {
            resolvePlaybackErrorReport();
        });
        const openModal = jest.fn();
        const playbackRecoveryError = new Error('playback recovery failed');
        const schedulerState: SchedulerState = {
            channelId: 'channel-1',
            isActive: true,
            currentProgram: program,
            nextProgram: null,
            schedulePosition: { loopNumber: 0, itemIndex: 0, offsetMs: 0 },
            lastSyncTime: 0,
        };
        const input = {
            requiredModules: {
                scheduler: {
                    ...scheduler,
                    getState: jest.fn().mockReturnValue(schedulerState),
                    skipToNext: jest.fn(),
                    pauseSyncTimer: jest.fn(),
                    resumeSyncTimer: jest.fn(),
                    syncToCurrentTime: jest.fn(),
                    unloadChannel: jest.fn(),
                },
                videoPlayer: {
                    ...player,
                    loadStream: jest.fn().mockResolvedValue(undefined),
                    play: jest.fn().mockResolvedValue(undefined),
                    pause: jest.fn(),
                },
                lifecycle: {
                    saveState: jest.fn().mockResolvedValue(undefined),
                    onPause: jest.fn().mockReturnValue({ dispose: lifecyclePauseCleanup }),
                    onResume: jest.fn().mockReturnValue({ dispose: lifecycleResumeCleanup }),
                },
            },
            runtimeSurfaces: {
                channelBadgeOverlay: null,
                playerOsd: null,
                nowPlayingInfo: { isVisible: jest.fn().mockReturnValue(false) },
                epg: null,
                channelManager: null,
                navigation: {
                    ...navigation,
                    getCurrentScreen: jest.fn().mockReturnValue('player'),
                    isModalOpen: jest.fn().mockReturnValue(false),
                    openModal,
                    closeModal: jest.fn(),
                },
                plexLibrary: null,
                plexStreamResolver: {
                    ...resolver,
                    stopTranscodeSession,
                },
            },
            playback: {
                playbackState,
                playbackRecovery: {
                    resolveStreamForProgram: jest.fn().mockResolvedValue(
                        makePreparedPlaybackStream('https://example.invalid/stream.m3u8')
                    ),
                    discardPreparedStream: jest.fn(),
                    resetPlaybackFailureGuard: jest.fn(),
                    tryHandleStreamResolverAuthError: jest.fn().mockReturnValue(false),
                    tryHandleStreamResolverPermissionError: jest.fn().mockReturnValue(false),
                    handlePlaybackFailure: jest.fn(() => {
                        throw playbackRecoveryError;
                    }),
                    isStreamRecoveryInProgress: jest.fn().mockReturnValue(false),
                },
            },
            runtimeControllers: {
                channelTransition: null,
                playerOsd: null,
                nowPlayingInfo: { onProgramStart },
                epg: {
                    refreshEpgScheduleForLiveChannel: refreshLiveEpg,
                    wireEpgEvents: jest.fn().mockReturnValue([]),
                },
                navigation: {
                    wireNavigationEvents: jest.fn().mockReturnValue([
                        (): void => {
                            throw navigationCleanupError;
                        },
                    ]),
                },
                playbackOptions: { refreshIfOpen: refreshPlaybackOptions },
                scheduleDayRollover: null,
                subtitleTrackRecovery: { handleTrackChange: recoverSubtitleTrack },
                nowPlayingDebug: {
                    maybeAutoShowNowPlayingStreamDebugHud: autoShowDebug,
                    maybeFetchNowPlayingStreamDecisionForDebugHud: fetchDebug,
                },
            },
            orchestratorCallbacks: {
                stopPlayback: jest.fn(),
                handleGlobalError: jest.fn(),
                handlePlexLibraryAuthorizationFailure: jest.fn(),
                handlePlexStreamError: jest.fn(),
                showPersistenceWarning: jest.fn(),
                reportRecoverableRuntimeIssue,
                reportRecoverableRuntimeError,
            },
        } as unknown as PriorityOneRuntimeAssemblyInput;

        const assembly = createPriorityOneRuntimeAssembly(input);
        expect(assembly.eventBinder.bind()).toBe(true);

        assembly.playbackRuntimeController.stopActiveTranscodeSession();
        expect(stopTranscodeSession).toHaveBeenCalledWith('transcode-session-1');

        const event = { type: 'subtitle' as const, trackId: 'subtitle-1' };
        player.emit('trackChange', event);

        expect(refreshPlaybackOptions).toHaveBeenCalledTimes(1);
        expect(recoverSubtitleTrack).toHaveBeenCalledWith(event);

        player.emit('error', {
            code: AppErrorCode.PLAYBACK_DECODE_ERROR,
            message: 'decode failed',
            recoverable: false,
            retryCount: 0,
        });
        await playbackErrorReported;
        expect(reportRecoverableRuntimeError).toHaveBeenCalledWith(
            'orchestrator.playbackRecovery.handlePlaybackFailure',
            'Playback recovery failure handler threw',
            playbackRecoveryError,
            expect.any(Object)
        );

        scheduler.emit('programStart', program);
        await activationComplete;

        expect(playbackState.setCurrentProgramForPlayback).toHaveBeenCalledWith(program);
        expect(playbackState.setShouldAutoShowInfoBannerOnNextPlay).toHaveBeenCalledWith(true);
        expect(playbackState.setPendingNowPlayingChannelId).toHaveBeenCalledWith(null);
        expect(onProgramStart).toHaveBeenCalledWith(program);
        expect(refreshLiveEpg).toHaveBeenCalledTimes(1);
        expect(autoShowDebug).toHaveBeenCalledTimes(1);
        expect(fetchDebug).toHaveBeenCalledTimes(1);

        assembly.overlayRuntimePolicyController.toggleNowPlayingInfoOverlay();
        expect(openModal).toHaveBeenCalledWith(NOW_PLAYING_INFO_MODAL_ID);

        const staleProgram = {
            ...makeProgram(),
            scheduledStartTime: 60_000,
            scheduledEndTime: 120_000,
            scheduleIndex: 1,
        };
        playbackState.setPendingNowPlayingChannelId('channel-2');
        playbackState.setShouldAutoShowInfoBannerOnNextPlay.mockClear();
        await assembly.playbackStartController.handleProgramStart(staleProgram);
        expect(playbackState.setShouldAutoShowInfoBannerOnNextPlay).toHaveBeenLastCalledWith(false);

        assembly.eventBinder.dispose();
        expect(player.off).toHaveBeenCalledWith('trackChange', expect.any(Function));
        expect(lifecyclePauseCleanup).toHaveBeenCalledTimes(1);
        expect(lifecycleResumeCleanup).toHaveBeenCalledTimes(1);
        expect(reportRecoverableRuntimeIssue).toHaveBeenCalledWith(
            'orchestrator.eventWiring.rollback',
            'Event wiring rollback failures',
            expect.objectContaining({
                failures: [expect.objectContaining({ step: 'event-wiring.cleanup' })],
            })
        );
    });
});
