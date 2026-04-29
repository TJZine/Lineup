import type {
    PriorityOneOptionalRuntimeSurfaces,
    PriorityOnePlaybackRecoveryPort,
    RecoverableAsyncFailureReporter,
} from '../OrchestratorRuntimeSeams';
import type { AppError, IAppLifecycle } from '../../../modules/lifecycle';
import type { INavigationManager, Screen } from '../../../modules/navigation';
import type { IVideoPlayer, PlaybackState, StreamDescriptor, TimeRange } from '../../../modules/player';
import type { IPlexLibrary } from '../../../modules/plex/library';
import type { IPlexStreamResolver, StreamResolverError } from '../../../modules/plex/stream';
import type { ChannelManagerEventMap, IChannelManager } from '../../../modules/scheduler/channel-manager';
import type { IChannelScheduler, ScheduledProgram } from '../../../modules/scheduler/scheduler';
import type { OrchestratorEventCleanupReporter } from '../OrchestratorEventCleanupReporter';
import type { OrchestratorPlaybackStateAccessors } from '../OrchestratorPlaybackStateAccessors';
import type { PriorityOneAssemblyInput } from './PriorityOneAssemblyInput';
import {
    createPriorityOneControllersAndBinder,
    type PriorityOneControllersAndBinder,
} from './PriorityOneControllerFactory';

export type { PriorityOneControllersAndBinder } from './PriorityOneControllerFactory';

export interface PriorityOneAssemblyBuilderInput {
    scheduler: IChannelScheduler;
    videoPlayer: IVideoPlayer;
    lifecycle: IAppLifecycle;
    channelBadgeOverlay: PriorityOneOptionalRuntimeSurfaces['channelBadgeOverlay'];
    playerOsd: PriorityOneOptionalRuntimeSurfaces['playerOsd'];
    nowPlayingInfo: PriorityOneOptionalRuntimeSurfaces['nowPlayingInfo'];
    epg: PriorityOneOptionalRuntimeSurfaces['epg'];
    isChannelTransitionActive: () => boolean;
    channelManager: IChannelManager | null;
    navigation: INavigationManager | null;
    plexLibrary: IPlexLibrary | null;
    plexStreamResolver: IPlexStreamResolver | null;
    playbackState: OrchestratorPlaybackStateAccessors;
    playbackRecovery: PriorityOnePlaybackRecoveryPort;
    stopPlayback: () => void;
    unloadCurrentChannel: () => void;
    stopTranscodeSessionById: (sessionId: string) => void;
    skipToNextProgram: () => void;
    pausePlayer: () => void;
    playPlayer: () => Promise<void>;
    cancelPendingDayRollover: () => void;
    pauseSchedulerSync: () => void;
    resumeSchedulerSync: () => void;
    syncSchedulerToCurrentTime: () => void;
    onPlayerStateChange: (state: PlaybackState) => void;
    onPlayerTimeUpdate: (payload: { currentTimeMs: number; durationMs: number }) => void;
    onPlayerBufferUpdate: (payload: { percent: number; bufferedRanges: TimeRange[] }) => void;
    handleGlobalError: (error: AppError, context: string) => void;
    showInfoBanner: () => void;
    onProgramStartUiSideEffects: (program: ScheduledProgram) => void;
    onStreamResolved: (stream: StreamDescriptor) => void;
    onPlaybackStartFailure: (error: unknown) => void;
    wireNavigationCoordinatorEvents: () => Array<() => void>;
    wireEpgCoordinatorEvents: () => Array<() => void>;
    handleScheduleDayRollover: () => Promise<void>;
    handlePlayerTrackChange: (event: { type: 'audio' | 'subtitle'; trackId: string | null }) => void;
    handlePlexLibraryAuthExpired: () => void;
    handlePlexStreamError: (error: StreamResolverError) => void;
    handleScreenChange: (payload: { from: Screen; to: Screen }) => void;
    reportPersistenceWarning: (warning: ChannelManagerEventMap['persistenceWarning']) => void;
    cleanupReporter: OrchestratorEventCleanupReporter;
    reportRecoverableAsyncFailure: RecoverableAsyncFailureReporter;
    nowPlayingModalId: string;
}

export function createPriorityOneAssembly(
    input: PriorityOneAssemblyBuilderInput
): PriorityOneAssemblyInput {
    return {
        modules: {
            scheduler: input.scheduler,
            videoPlayer: input.videoPlayer,
            lifecycle: input.lifecycle,
        },
        surfaces: {
            channelBadgeOverlay: input.channelBadgeOverlay,
            playerOsd: input.playerOsd,
            nowPlayingInfo: input.nowPlayingInfo,
            epg: input.epg,
            channelTransitionActivity: {
                isActive: input.isChannelTransitionActive,
            },
            channelManager: input.channelManager,
            navigation: input.navigation,
            plexLibrary: input.plexLibrary,
            plexStreamResolver: input.plexStreamResolver,
        },
        playback: {
            playbackState: input.playbackState,
            playbackRecovery: input.playbackRecovery,
            stopPlayback: input.stopPlayback,
            unloadCurrentChannel: input.unloadCurrentChannel,
            stopTranscodeSessionById: input.stopTranscodeSessionById,
            skipToNextProgram: input.skipToNextProgram,
            pausePlayer: input.pausePlayer,
            playPlayer: input.playPlayer,
        },
        schedulerRuntime: {
            cancelPendingDayRollover: input.cancelPendingDayRollover,
            pauseSchedulerSync: input.pauseSchedulerSync,
            resumeSchedulerSync: input.resumeSchedulerSync,
            syncSchedulerToCurrentTime: input.syncSchedulerToCurrentTime,
        },
        playerEvents: {
            onPlayerStateChange: input.onPlayerStateChange,
            onPlayerTimeUpdate: input.onPlayerTimeUpdate,
            onPlayerBufferUpdate: input.onPlayerBufferUpdate,
        },
        uiRuntime: {
            handleGlobalError: input.handleGlobalError,
            showInfoBanner: input.showInfoBanner,
            onProgramStartUiSideEffects: input.onProgramStartUiSideEffects,
            onStreamResolved: input.onStreamResolved,
            onPlaybackStartFailure: input.onPlaybackStartFailure,
        },
        events: {
            wireNavigationCoordinatorEvents: input.wireNavigationCoordinatorEvents,
            wireEpgCoordinatorEvents: input.wireEpgCoordinatorEvents,
            handleScheduleDayRollover: input.handleScheduleDayRollover,
            handlePlayerTrackChange: input.handlePlayerTrackChange,
            handlePlexLibraryAuthExpired: input.handlePlexLibraryAuthExpired,
            handlePlexStreamError: input.handlePlexStreamError,
            handleScreenChange: input.handleScreenChange,
            reportPersistenceWarning: input.reportPersistenceWarning,
            cleanupReporter: input.cleanupReporter,
            reportRecoverableAsyncFailure: input.reportRecoverableAsyncFailure,
        },
        nowPlayingModalId: input.nowPlayingModalId,
    };
}

export function createPriorityOneRuntimeAssembly(
    input: PriorityOneAssemblyBuilderInput
): PriorityOneControllersAndBinder {
    return createPriorityOneControllersAndBinder(
        createPriorityOneAssembly(input)
    );
}
