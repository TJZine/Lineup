import type { StreamDescriptor } from '../../../modules/player';
import type { ScheduledProgram } from '../../../modules/scheduler/scheduler';
import {
    createEventBinder,
    createOverlayRuntimePolicyController,
    createPlaybackRuntimeController,
    createPlaybackStartController,
    createProfileSwitchCleanupController,
} from '../priority-one/PriorityOneControllerCollaborators';
import type { PriorityOneAssemblyInput } from '../priority-one/PriorityOneAssemblyInput';
import type { OrchestratorPlaybackStateAccessors } from '../OrchestratorPlaybackStateAccessors';
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
        streamDescriptor: null,
        isCurrent: true,
    } as unknown as ScheduledProgram);

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
                resolveStreamForProgram: jest.fn().mockResolvedValue({
                    id: 'stream-1',
                } as unknown as StreamDescriptor),
                resetPlaybackFailureGuard: jest.fn(),
                tryHandleStreamResolverAuthError: jest.fn().mockReturnValue(false),
                tryHandleStreamResolverPermissionError: jest.fn().mockReturnValue(false),
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
            handlePlexLibraryAuthExpired: jest.fn(),
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
        expect(playbackState.setCurrentStreamDescriptor).toHaveBeenCalled();
        expect(input.uiRuntime.onProgramStartUiSideEffects).toHaveBeenCalledWith(program);
        expect(input.playerEvents.onPlayerStateChange).toHaveBeenCalled();
        expect(input.uiRuntime.showInfoBanner).toHaveBeenCalled();
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
