import type { StreamDescriptor } from '../../../modules/player';
import type { ScheduledProgram } from '../../../modules/scheduler/scheduler';
import {
    createPriorityOneControllersAndBinder,
    type OrchestratorPriorityOneControllerFactoryDeps,
} from '../OrchestratorPriorityOneControllerFactory';
import type { OrchestratorPlaybackStateAccessors } from '../OrchestratorPlaybackStateAccessors';

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

const makeDeps = (
    playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors>
): OrchestratorPriorityOneControllerFactoryDeps => ({
    scheduler: {} as OrchestratorPriorityOneControllerFactoryDeps['scheduler'],
    videoPlayer: {
        loadStream: jest.fn().mockResolvedValue(undefined),
        play: jest.fn().mockResolvedValue(undefined),
    } as unknown as OrchestratorPriorityOneControllerFactoryDeps['videoPlayer'],
    lifecycle: {
        saveState: jest.fn().mockResolvedValue(undefined),
    } as unknown as OrchestratorPriorityOneControllerFactoryDeps['lifecycle'],
    playbackRecovery: {
        resolveStreamForProgram: jest.fn().mockResolvedValue(null as StreamDescriptor | null),
        resetPlaybackFailureGuard: jest.fn(),
        tryHandleStreamResolverAuthError: jest.fn().mockReturnValue(false),
        tryHandleStreamResolverPermissionError: jest.fn().mockReturnValue(false),
        handlePlaybackFailure: jest.fn(),
        isStreamRecoveryInProgress: jest.fn().mockReturnValue(false),
    },
    channelBadgeOverlay: null,
    playerOsd: null,
    nowPlayingInfo: null,
    epg: null,
    channelManager: null,
    navigation: null,
    playbackState,
    pendingDayRolloverTimer: jest.fn().mockReturnValue(null),
    setPendingDayRolloverTimer: jest.fn(),
    setPendingDayRolloverDayKey: jest.fn(),
    stopPlayback: jest.fn(),
    unloadCurrentChannel: jest.fn(),
    stopTranscodeSessionById: jest.fn(),
    skipToNextProgram: jest.fn(),
    pausePlayer: jest.fn(),
    playPlayer: jest.fn().mockResolvedValue(undefined),
    pauseSchedulerSync: jest.fn(),
    resumeSchedulerSync: jest.fn(),
    syncSchedulerToCurrentTime: jest.fn(),
    handleGlobalError: jest.fn(),
    onPlayerStateChange: jest.fn(),
    showInfoBanner: jest.fn(),
    onPlayerTimeUpdate: jest.fn(),
    onPlayerBufferUpdate: jest.fn(),
    onProgramStartUiSideEffects: jest.fn(),
    onStreamResolved: jest.fn(),
    onPlaybackStartFailure: jest.fn(),
    plexLibrary: null,
    plexStreamResolver: null,
    wireNavigationCoordinatorEvents: jest.fn().mockReturnValue([]),
    wireEpgCoordinatorEvents: jest.fn().mockReturnValue([]),
    handleScheduleDayRollover: jest.fn().mockResolvedValue(undefined),
    handlePlayerTrackChange: jest.fn(),
    handlePlexLibraryAuthExpired: jest.fn(),
    handlePlexStreamError: jest.fn(),
    handleScreenChange: jest.fn(),
    reportPersistenceWarning: jest.fn(),
    nowPlayingModalId: 'now-playing-modal',
});

describe('createPriorityOneControllersAndBinder playbackState wiring', () => {
    it('routes program-start state updates through playbackState accessors', async () => {
        const program = makeProgram();
        const playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors> = {
            getCurrentProgramForPlayback: jest.fn().mockReturnValue(null),
            setCurrentProgramForPlayback: jest.fn(),
            getCurrentStreamDescriptor: jest.fn().mockReturnValue(null),
            setCurrentStreamDescriptor: jest.fn(),
            getCurrentStreamDecision: jest.fn().mockReturnValue(null),
            setCurrentStreamDecision: jest.fn(),
            getPendingNowPlayingChannelId: jest.fn().mockReturnValue('channel-42'),
            setPendingNowPlayingChannelId: jest.fn(),
            getShouldAutoShowInfoBannerOnNextPlay: jest.fn().mockReturnValue(false),
            setShouldAutoShowInfoBannerOnNextPlay: jest.fn(),
        };

        const priorityOne = createPriorityOneControllersAndBinder(makeDeps(playbackState));

        await priorityOne.playbackStartController.handleProgramStart(program);

        expect(playbackState.setCurrentProgramForPlayback).toHaveBeenCalledWith(program);
        expect(playbackState.setShouldAutoShowInfoBannerOnNextPlay).toHaveBeenCalledWith(true);
        expect(playbackState.setPendingNowPlayingChannelId).toHaveBeenCalledWith(null);
    });

    it('treats missing playbackRecovery.resolveStreamForProgram as no stream without reporting failure', async () => {
        const program = makeProgram();
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

        const deps = makeDeps(playbackState);
        (deps.playbackRecovery as unknown as { resolveStreamForProgram?: unknown }).resolveStreamForProgram = undefined;

        const priorityOne = createPriorityOneControllersAndBinder(deps);

        await priorityOne.playbackStartController.handleProgramStart(program);

        expect((deps.videoPlayer as unknown as { loadStream: jest.Mock }).loadStream).not.toHaveBeenCalled();
        expect(deps.playbackRecovery.handlePlaybackFailure).not.toHaveBeenCalled();
        expect(deps.onPlaybackStartFailure).not.toHaveBeenCalled();
    });
});
