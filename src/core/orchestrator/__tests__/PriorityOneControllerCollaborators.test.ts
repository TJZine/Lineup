import type { PreparedPlaybackStream } from '../../../modules/player';
import { makePreparedPlaybackStream } from '../../../__tests__/fixtures/preparedPlaybackStream';
import type {
    ScheduledProgram,
    SchedulerState,
} from '../../../modules/scheduler/scheduler';
import {
    createEventBinder,
    createOverlayRuntimePolicyController,
    createPlaybackRuntimeController,
    createPlaybackStartController,
    createProfileSwitchCleanupController,
} from '../priority-one/PriorityOneControllerCollaborators';
import type { PriorityOneAssemblyInput } from '../priority-one/PriorityOneAssemblyInput';
import type { OrchestratorPlaybackStateAccessors } from '../runtime/OrchestratorPlaybackStateAccessors';
import { createTestEventSurface } from './eventSurfaceTestUtils';

const makeProgram = (overrides: Partial<ScheduledProgram> = {}): ScheduledProgram =>
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
        ...overrides,
    } as unknown as ScheduledProgram);

const makePrepared = (id = 'stream-1'): PreparedPlaybackStream =>
    makePreparedPlaybackStream(`https://example.invalid/${id}.m3u8`);

const makeSchedulerState = (
    currentProgram: ScheduledProgram | null,
    overrides: Partial<SchedulerState> = {}
): SchedulerState =>
    ({
        channelId: 'channel-7',
        isActive: false,
        currentProgram,
        nextProgram: null,
        schedulePosition: {
            loopNumber: currentProgram?.loopNumber ?? 0,
            itemIndex: currentProgram?.scheduleIndex ?? 0,
            offsetMs: currentProgram?.elapsedMs ?? 0,
        },
        lastSyncTime: 0,
        ...overrides,
    } as SchedulerState);

const makeInput = (
    playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors>
): PriorityOneAssemblyInput => {
    const videoPlayer = {
        loadStream: jest.fn().mockResolvedValue(undefined),
        play: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        off: jest.fn(),
    };
    const scheduler = createTestEventSurface();
    const schedulerState = makeSchedulerState(null);
    const playerEmitter = createTestEventSurface();
    const navigation = {
        getCurrentScreen: jest.fn().mockReturnValue('player'),
        isModalOpen: jest.fn().mockReturnValue(false),
        openModal: jest.fn(),
        closeModal: jest.fn(),
        on: playerEmitter.on,
        off: playerEmitter.off,
    };

    return {
        modules: {
            scheduler: {
                getState: jest.fn().mockImplementation(() => schedulerState),
                on: scheduler.on,
                off: scheduler.off,
            } as unknown as PriorityOneAssemblyInput['modules']['scheduler'],
            videoPlayer: videoPlayer as unknown as PriorityOneAssemblyInput['modules']['videoPlayer'],
            lifecycle: {
                saveState: jest.fn().mockResolvedValue(undefined),
                onPause: jest.fn(),
                onResume: jest.fn(),
            } as unknown as PriorityOneAssemblyInput['modules']['lifecycle'],
        },
        surfaces: {
            channelBadgeOverlay: {
                show: jest.fn(),
                hide: jest.fn(),
            },
            playerOsd: {
                isVisible: jest.fn().mockReturnValue(true),
            },
            nowPlayingInfo: {
                isVisible: jest.fn().mockReturnValue(false),
            },
            epg: {
                isVisible: jest.fn().mockReturnValue(false),
            },
            channelTransitionActivity: {
                isActive: jest.fn().mockReturnValue(false),
            },
            channelManager: {
                getCurrentChannel: jest.fn().mockReturnValue({ number: 7, name: 'Movies' }),
                on: jest.fn(),
                off: jest.fn(),
            } as unknown as PriorityOneAssemblyInput['surfaces']['channelManager'],
            navigation: navigation as unknown as PriorityOneAssemblyInput['surfaces']['navigation'],
            plexLibrary: null,
            plexStreamResolver: null,
        },
        playback: {
            playbackState,
            playbackRecovery: {
                resolveStreamForProgram: jest.fn().mockResolvedValue(makePrepared()),
                discardPreparedStream: jest.fn().mockResolvedValue(undefined),
                resetPlaybackFailureGuard: jest.fn(),
                tryHandleStreamResolverAuthError: jest.fn().mockReturnValue(false),
                tryHandleStreamResolverPermissionError: jest.fn().mockReturnValue(false),
                attemptTranscodeFallbackForCurrentProgram: jest.fn().mockResolvedValue(false),
                handlePlaybackFailure: jest.fn(),
                isStreamRecoveryInProgress: jest.fn().mockReturnValue(false),
            },
            stopPlayback: jest.fn(),
            unloadCurrentChannel: jest.fn(),
            stopTranscodeSessionById: jest.fn(),
            skipToNextProgram: jest.fn(),
            pausePlayer: jest.fn(),
            playPlayer: jest.fn().mockResolvedValue(undefined),
        },
        schedulerRuntime: {
            cancelPendingDayRollover: jest.fn(),
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
            onProgramStartUiSideEffects: jest.fn(),
            onStreamResolved: jest.fn(),
            onPlaybackStartFailure: jest.fn(),
        },
        events: {
            wireNavigationCoordinatorEvents: jest.fn().mockReturnValue([]),
            wireEpgCoordinatorEvents: jest.fn().mockReturnValue([]),
            handleScheduleDayRollover: jest.fn().mockResolvedValue(undefined),
            handlePlayerTrackChange: jest.fn(),
            handlePlexLibraryAuthorizationFailure: jest.fn(),
            handlePlexStreamError: jest.fn(),
            handleScreenChange: jest.fn(),
            reportPersistenceWarning: jest.fn(),
            cleanupReporter: jest.fn(),
            reportRecoverableAsyncFailure: jest.fn(),
        },
        nowPlayingModalId: 'now-playing-modal',
    };
};

describe('PriorityOneControllerCollaborators', () => {
    it('creates an overlay runtime controller that delegates badge policy through the assembly input', () => {
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(makeProgram()),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
            setPendingNowPlayingChannelId: jest.fn(),
            getShouldAutoShowInfoBannerOnNextPlay: jest.fn().mockReturnValue(false),
            setShouldAutoShowInfoBannerOnNextPlay: jest.fn(),
        };
        const input = makeInput(playbackState);

        createOverlayRuntimePolicyController(input).syncChannelBadgeOverlay();

        expect(input.surfaces.channelBadgeOverlay?.show).toHaveBeenCalledWith({
            channelNumber: 7,
            channelName: 'Movies',
        });
    });

    it('creates an overlay runtime controller that suppresses the badge while transition activity is active', () => {
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(makeProgram()),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
            setPendingNowPlayingChannelId: jest.fn(),
            getShouldAutoShowInfoBannerOnNextPlay: jest.fn().mockReturnValue(false),
            setShouldAutoShowInfoBannerOnNextPlay: jest.fn(),
        };
        const input = makeInput(playbackState);
        (
            input.surfaces as PriorityOneAssemblyInput['surfaces'] & {
                channelTransitionActivity: { isActive: jest.Mock<boolean, []> };
            }
        ).channelTransitionActivity = {
            isActive: jest.fn().mockReturnValue(true),
        };

        createOverlayRuntimePolicyController(input).syncChannelBadgeOverlay();

        expect(input.surfaces.channelBadgeOverlay?.hide).toHaveBeenCalledTimes(1);
        expect(input.surfaces.channelBadgeOverlay?.show).not.toHaveBeenCalled();
    });

    it('creates playback collaborators that drive program-start and runtime state through the assembly input', async () => {
        const program = makeProgram();
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(program),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue('channel-42'),
            setPendingNowPlayingChannelId: jest.fn(),
            getShouldAutoShowInfoBannerOnNextPlay: jest.fn().mockReturnValue(true),
            setShouldAutoShowInfoBannerOnNextPlay: jest.fn(),
        };
        const input = makeInput(playbackState);

        await createPlaybackStartController(input).handleProgramStart(program);
        createPlaybackRuntimeController(input).handlePlayerStateChange({
            status: 'playing',
        } as never);

        expect(playbackState.setCurrentProgramForPlayback).toHaveBeenCalledWith(program);
        expect(playbackState.setCurrentStreamDecision).toHaveBeenCalledWith(
            expect.objectContaining({ sessionId: 'test-session' })
        );
        expect(playbackState.setCurrentStreamDescriptor).toHaveBeenCalled();
        expect(input.uiRuntime.onProgramStartUiSideEffects).toHaveBeenCalledWith(program);
        expect(input.playerEvents.onPlayerStateChange).toHaveBeenCalled();
        expect(input.uiRuntime.showInfoBanner).toHaveBeenCalled();
        expect(
            playbackState.setCurrentStreamDecision.mock.invocationCallOrder[0]
        ).toBeLessThan(playbackState.setCurrentStreamDescriptor.mock.invocationCallOrder[0] ?? 0);
        expect(
            playbackState.setCurrentStreamDescriptor.mock.invocationCallOrder[0]
        ).toBeLessThan(
            (input.uiRuntime.onStreamResolved as jest.Mock).mock.invocationCallOrder[0] ?? 0
        );
        expect(
            (input.uiRuntime.onStreamResolved as jest.Mock).mock.invocationCallOrder[0]
        ).toBeLessThan(
            (input.playback.playbackRecovery.resetPlaybackFailureGuard as jest.Mock)
                .mock.invocationCallOrder[0] ?? 0
        );
    });

    it('keeps the committed pair and reports a post-activation debug callback failure', async () => {
        const program = makeProgram();
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(program),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
            setPendingNowPlayingChannelId: jest.fn(),
            getShouldAutoShowInfoBannerOnNextPlay: jest.fn().mockReturnValue(false),
            setShouldAutoShowInfoBannerOnNextPlay: jest.fn(),
        };
        const input = makeInput(playbackState);
        const debugError = new Error('debug callback failed');
        (input.uiRuntime.onStreamResolved as jest.Mock).mockImplementationOnce(() => {
            throw debugError;
        });

        await createPlaybackStartController(input).handleProgramStart(program);

        expect(playbackState.setCurrentStreamDecision).toHaveBeenCalledTimes(1);
        expect(playbackState.setCurrentStreamDescriptor).toHaveBeenCalledTimes(1);
        expect(input.events.reportRecoverableAsyncFailure).toHaveBeenCalledWith(
            'orchestrator.playbackStart.onStreamResolved',
            'Playback stream-resolved callback failed after activation',
            debugError
        );
        expect(input.playback.playbackRecovery.resetPlaybackFailureGuard).toHaveBeenCalledTimes(1);
        expect(
            (input.events.reportRecoverableAsyncFailure as jest.Mock).mock.invocationCallOrder[0]
        ).toBeLessThan(
            (input.playback.playbackRecovery.resetPlaybackFailureGuard as jest.Mock)
                .mock.invocationCallOrder[0] ?? 0
        );
        expect(input.playback.playbackRecovery.attemptTranscodeFallbackForCurrentProgram).not.toHaveBeenCalled();
        expect(input.playback.playbackRecovery.discardPreparedStream).not.toHaveBeenCalled();
        expect(input.playback.playbackRecovery.handlePlaybackFailure).not.toHaveBeenCalled();
    });

    it('keeps playback start current across same-occurrence scheduler rematerialization', async () => {
        const program = makeProgram({
            scheduledStartTime: 1_000,
            scheduledEndTime: 61_000,
        });
        const rematerializedProgram = makeProgram({
            scheduledStartTime: program.scheduledStartTime,
            scheduledEndTime: program.scheduledEndTime,
            scheduleIndex: program.scheduleIndex,
            loopNumber: program.loopNumber,
            elapsedMs: 5_000,
            remainingMs: 55_000,
            isCurrent: true,
        });
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(program),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
            setPendingNowPlayingChannelId: jest.fn(),
            getShouldAutoShowInfoBannerOnNextPlay: jest.fn().mockReturnValue(false),
            setShouldAutoShowInfoBannerOnNextPlay: jest.fn(),
        };
        const input = makeInput(playbackState);
        let schedulerState = makeSchedulerState(program, {
            isActive: true,
        });
        (
            input.modules.scheduler as PriorityOneAssemblyInput['modules']['scheduler'] & {
                getState: jest.Mock<ReturnType<PriorityOneAssemblyInput['modules']['scheduler']['getState']>, []>;
            }
        ).getState.mockImplementation(() => schedulerState);
        (
            input.playback.playbackRecovery.resolveStreamForProgram as jest.Mock
        ).mockImplementation(async () => {
            schedulerState = makeSchedulerState(rematerializedProgram, {
                isActive: true,
            });
            return makePrepared();
        });

        await createPlaybackStartController(input).handleProgramStart(program);

        expect(input.uiRuntime.onStreamResolved).toHaveBeenCalled();
        expect(input.modules.videoPlayer.loadStream).toHaveBeenCalled();
        expect(input.modules.videoPlayer.play).toHaveBeenCalled();
    });

    it('aborts playback start when the scheduler advances to a different occurrence', async () => {
        const program = makeProgram({
            scheduledStartTime: 1_000,
            scheduledEndTime: 61_000,
        });
        const nextOccurrence = makeProgram({
            scheduledStartTime: 61_000,
            scheduledEndTime: 121_000,
            scheduleIndex: 1,
            loopNumber: 0,
        });
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(program),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
            setPendingNowPlayingChannelId: jest.fn(),
            getShouldAutoShowInfoBannerOnNextPlay: jest.fn().mockReturnValue(false),
            setShouldAutoShowInfoBannerOnNextPlay: jest.fn(),
        };
        const input = makeInput(playbackState);
        let schedulerState = makeSchedulerState(program, {
            isActive: true,
        });
        (
            input.modules.scheduler as PriorityOneAssemblyInput['modules']['scheduler'] & {
                getState: jest.Mock<ReturnType<PriorityOneAssemblyInput['modules']['scheduler']['getState']>, []>;
            }
        ).getState.mockImplementation(() => schedulerState);
        (
            input.playback.playbackRecovery.resolveStreamForProgram as jest.Mock
        ).mockImplementation(async () => {
            schedulerState = makeSchedulerState(nextOccurrence, {
                isActive: true,
            });
            return makePrepared();
        });

        await createPlaybackStartController(input).handleProgramStart(program);

        expect(input.uiRuntime.onStreamResolved).not.toHaveBeenCalled();
        expect(input.modules.videoPlayer.loadStream).not.toHaveBeenCalled();
        expect(input.modules.videoPlayer.play).not.toHaveBeenCalled();
    });

    it('creates a profile-switch cleanup controller that clears playback state through the assembly input', () => {
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(null),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
            setPendingNowPlayingChannelId: jest.fn(),
            getShouldAutoShowInfoBannerOnNextPlay: jest.fn().mockReturnValue(false),
            setShouldAutoShowInfoBannerOnNextPlay: jest.fn(),
        };
        const input = makeInput(playbackState);

        createProfileSwitchCleanupController(input).prepareForProfileSwitch();

        expect(input.schedulerRuntime.cancelPendingDayRollover).toHaveBeenCalled();
        expect(input.playback.stopPlayback).toHaveBeenCalled();
        expect(input.playback.unloadCurrentChannel).toHaveBeenCalled();
        expect(playbackState.setCurrentProgramForPlayback).toHaveBeenCalledWith(null);
        expect(playbackState.setCurrentStreamDescriptor).toHaveBeenCalledWith(null);
        expect(playbackState.setCurrentStreamDecision).toHaveBeenCalledWith(null);
    });

    it('creates an event binder that routes scheduler and player events through the extracted collaborators', async () => {
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(makeProgram()),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue(null),
            setPendingNowPlayingChannelId: jest.fn(),
            getShouldAutoShowInfoBannerOnNextPlay: jest.fn().mockReturnValue(false),
            setShouldAutoShowInfoBannerOnNextPlay: jest.fn(),
        };
        const input = makeInput(playbackState);
        const playbackStartController = createPlaybackStartController(input);
        const playbackRuntimeController = createPlaybackRuntimeController(input);
        const binder = createEventBinder(
            input,
            playbackStartController,
            playbackRuntimeController
        );

        binder.bind();
        (input.modules.scheduler as unknown as { on: jest.Mock }).on.mock.calls[0]?.[1](makeProgram());
        await Promise.resolve();

        expect(input.events.handleScheduleDayRollover).not.toHaveBeenCalled();
        expect(input.uiRuntime.onProgramStartUiSideEffects).toHaveBeenCalled();
        binder.dispose();
    });
});
