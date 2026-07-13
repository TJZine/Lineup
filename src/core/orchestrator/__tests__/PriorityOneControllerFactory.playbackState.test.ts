import type { PreparedPlaybackStream } from '../../../modules/player';
import { makePreparedPlaybackStream } from '../../../__tests__/fixtures/preparedPlaybackStream';
import type {
    ScheduledProgram,
    SchedulerState,
} from '../../../modules/scheduler/scheduler';
import {
    createPriorityOneControllersAndBinder,
    type PriorityOneAssemblyInput,
} from '../priority-one/PriorityOneControllerFactory';
import type { OrchestratorPlaybackStateAccessors } from '../runtime/OrchestratorPlaybackStateAccessors';

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

const makePrepared = (): PreparedPlaybackStream =>
    makePreparedPlaybackStream('https://example.invalid/stream.m3u8');

const makeSchedulerState = (
    currentProgram: ScheduledProgram | null,
    overrides: Partial<SchedulerState> = {}
): SchedulerState =>
    ({
        channelId: 'channel-1',
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

const makeDeps = (
    playbackState: jest.Mocked<OrchestratorPlaybackStateAccessors>
): PriorityOneAssemblyInput => ({
    modules: {
        scheduler: {
            getState: jest.fn().mockReturnValue(makeSchedulerState(null)),
        } as unknown as PriorityOneAssemblyInput['modules']['scheduler'],
        videoPlayer: {
            loadStream: jest.fn().mockResolvedValue(undefined),
            play: jest.fn().mockResolvedValue(undefined),
        } as unknown as PriorityOneAssemblyInput['modules']['videoPlayer'],
        lifecycle: {
            saveState: jest.fn().mockResolvedValue(undefined),
        } as unknown as PriorityOneAssemblyInput['modules']['lifecycle'],
    },
    surfaces: {
        channelBadgeOverlay: null,
        playerOsd: null,
        nowPlayingInfo: null,
        epg: null,
        channelTransitionActivity: null,
        channelManager: null,
        navigation: null,
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

});
