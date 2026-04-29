import type { AppError } from '../../../modules/lifecycle';
import type { PlaybackState, StreamDescriptor, TimeRange } from '../../../modules/player';
import type { StreamResolverError } from '../../../modules/plex/stream';
import type { ChannelManagerEventMap } from '../../../modules/scheduler/channel-manager';
import type { ScheduledProgram } from '../../../modules/scheduler/scheduler';
import type { OrchestratorPlaybackStateAccessors } from '../OrchestratorPlaybackStateAccessors';
import {
    createPriorityOneRuntimeAssembly,
    type PriorityOneAssemblyBuilderInput,
} from '../priority-one/PriorityOneAssemblyBuilder';

type EventHandler = (...args: readonly unknown[]) => void;

function createEventSurface(): {
    on: jest.Mock;
    off: jest.Mock;
    emit: (event: string, ...args: readonly unknown[]) => void;
} {
    const handlers = new Map<string, EventHandler>();

    return {
        on: jest.fn((event: string, handler: EventHandler) => {
            handlers.set(event, handler);
        }),
        off: jest.fn((event: string) => {
            handlers.delete(event);
        }),
        emit: (event: string, ...args: readonly unknown[]): void => {
            handlers.get(event)?.(...args);
        },
    };
}

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

const flushPromises = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};

describe('createPriorityOneRuntimeAssembly', () => {
    it('owns priority-one input shaping and controller/binder creation from runtime refs', async () => {
        const program = makeProgram();
        const scheduler = createEventSurface();
        const videoPlayer = createEventSurface();
        const navigation = createEventSurface();
        const cleanupError = new Error('cleanup failed');
        const navigationCleanup = jest.fn(() => {
            throw cleanupError;
        });
        const cleanupReporter = jest.fn();
        const handlePlayerTrackChange = jest.fn();
        const onProgramStartUiSideEffects = jest.fn();
        const stopTranscodeSessionById = jest.fn();
        const openModal = jest.fn();
        const closeModal = jest.fn();
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
        const input: PriorityOneAssemblyBuilderInput = {
            scheduler: {
                on: scheduler.on,
                off: scheduler.off,
                skipToNext: jest.fn(),
                pauseSyncTimer: jest.fn(),
                resumeSyncTimer: jest.fn(),
                syncToCurrentTime: jest.fn(),
                unloadChannel: jest.fn(),
            } as unknown as PriorityOneAssemblyBuilderInput['scheduler'],
            videoPlayer: {
                on: videoPlayer.on,
                off: videoPlayer.off,
                loadStream: jest.fn().mockResolvedValue(undefined),
                play: jest.fn().mockResolvedValue(undefined),
                pause: jest.fn(),
            } as unknown as PriorityOneAssemblyBuilderInput['videoPlayer'],
            lifecycle: {
                saveState: jest.fn().mockResolvedValue(undefined),
                onPause: jest.fn().mockReturnValue({ dispose: jest.fn() }),
                onResume: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            } as unknown as PriorityOneAssemblyBuilderInput['lifecycle'],
            channelBadgeOverlay: null,
            playerOsd: null,
            nowPlayingInfo: { isVisible: jest.fn().mockReturnValue(false) },
            epg: null,
            isChannelTransitionActive: jest.fn().mockReturnValue(false),
            channelManager: null,
            navigation: {
                on: navigation.on,
                off: navigation.off,
                getCurrentScreen: jest.fn().mockReturnValue('player'),
                isModalOpen: jest.fn().mockReturnValue(false),
                openModal,
                closeModal,
            } as unknown as PriorityOneAssemblyBuilderInput['navigation'],
            plexLibrary: null,
            plexStreamResolver: null,
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
            stopTranscodeSessionById,
            skipToNextProgram: jest.fn(),
            pausePlayer: jest.fn(),
            playPlayer: jest.fn().mockResolvedValue(undefined),
            cancelPendingDayRollover: jest.fn(),
            pauseSchedulerSync: jest.fn(),
            resumeSchedulerSync: jest.fn(),
            syncSchedulerToCurrentTime: jest.fn(),
            onPlayerStateChange: jest.fn((_state: PlaybackState) => undefined),
            onPlayerTimeUpdate: jest.fn((_payload: { currentTimeMs: number; durationMs: number }) => undefined),
            onPlayerBufferUpdate: jest.fn((_payload: { percent: number; bufferedRanges: TimeRange[] }) => undefined),
            handleGlobalError: jest.fn((_error: AppError, _context: string) => undefined),
            showInfoBanner: jest.fn(),
            onProgramStartUiSideEffects,
            onStreamResolved: jest.fn((_stream: StreamDescriptor) => undefined),
            onPlaybackStartFailure: jest.fn(),
            wireNavigationCoordinatorEvents: jest.fn().mockReturnValue([navigationCleanup]),
            wireEpgCoordinatorEvents: jest.fn().mockReturnValue([]),
            handleScheduleDayRollover: jest.fn().mockResolvedValue(undefined),
            handlePlayerTrackChange,
            handlePlexLibraryAuthExpired: jest.fn(),
            handlePlexStreamError: jest.fn((_error: StreamResolverError) => undefined),
            handleScreenChange: jest.fn(),
            reportPersistenceWarning: jest.fn((_warning: ChannelManagerEventMap['persistenceWarning']) => undefined),
            cleanupReporter,
            reportRecoverableAsyncFailure: jest.fn(),
            nowPlayingModalId: 'runtime-now-playing-modal',
        };

        const priorityOne = createPriorityOneRuntimeAssembly(input);

        priorityOne.eventBinder.bind();
        videoPlayer.emit('trackChange', { type: 'subtitle', trackId: 'subtitle-1' });
        scheduler.emit('programStart', program);
        await flushPromises();
        priorityOne.playbackRuntimeController.stopActiveTranscodeSession();
        priorityOne.overlayRuntimePolicyController.toggleNowPlayingInfoOverlay();
        priorityOne.eventBinder.dispose();

        expect(handlePlayerTrackChange).toHaveBeenCalledWith({
            type: 'subtitle',
            trackId: 'subtitle-1',
        });
        expect(onProgramStartUiSideEffects).toHaveBeenCalledWith(program);
        expect(stopTranscodeSessionById).toHaveBeenCalledWith('transcode-session-1');
        expect(openModal).toHaveBeenCalledWith('runtime-now-playing-modal');
        expect(closeModal).not.toHaveBeenCalled();
        expect(cleanupReporter).toHaveBeenCalledWith([
            expect.objectContaining({
                step: 'event-wiring.cleanup',
                error: expect.objectContaining({
                    message: cleanupError.message,
                }),
            }),
        ]);
    });
});
