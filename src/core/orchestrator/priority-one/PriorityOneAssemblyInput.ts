import type { AppError, IAppLifecycle } from '../../../modules/lifecycle';
import type { PlaybackState, StreamDescriptor, IVideoPlayer } from '../../../modules/player';
import type { IChannelScheduler, ScheduledProgram } from '../../../modules/scheduler/scheduler';
import type {
    PriorityOneEventRuntimePort,
    PriorityOneOptionalRuntimeSurfaces,
    PriorityOnePlaybackRuntimePort,
    PriorityOnePlayerEventPort,
    PriorityOneRequiredRuntimeModules,
    PriorityOneSchedulerRuntimePort,
    PriorityOneUiRuntimePort,
} from '../OrchestratorRuntimeSeams';
import type { OrchestratorEventCleanupFailure } from '../OrchestratorEventCleanupReporter';
import type { OrchestratorPlaybackStateAccessors } from '../OrchestratorPlaybackStateAccessors';
import type { PlaybackRecoveryManager } from '../../../modules/player/PlaybackRecoveryManager';

export interface PriorityOneAssemblyInput {
    modules: PriorityOneRequiredRuntimeModules;
    surfaces: PriorityOneOptionalRuntimeSurfaces;
    playback: PriorityOnePlaybackRuntimePort;
    schedulerRuntime: PriorityOneSchedulerRuntimePort;
    playerEvents: PriorityOnePlayerEventPort;
    uiRuntime: PriorityOneUiRuntimePort;
    events: PriorityOneEventRuntimePort;
    nowPlayingModalId: string;
}

type PlayerBufferUpdatePayload = Parameters<PriorityOnePlayerEventPort['onPlayerBufferUpdate']>[0];
type ScreenChangePayload = Parameters<PriorityOneEventRuntimePort['handleScreenChange']>[0];
type PersistenceWarningPayload = Parameters<PriorityOneEventRuntimePort['reportPersistenceWarning']>[0];
type TrackChangePayload = Parameters<PriorityOneEventRuntimePort['handlePlayerTrackChange']>[0];
type PlexStreamErrorPayload = Parameters<PriorityOneEventRuntimePort['handlePlexStreamError']>[0];

export interface PriorityOneAssemblySource {
    scheduler: IChannelScheduler;
    videoPlayer: IVideoPlayer;
    lifecycle: IAppLifecycle;
    playbackState: OrchestratorPlaybackStateAccessors;
    playbackRecovery: PlaybackRecoveryManager;
    surfaces: PriorityOneOptionalRuntimeSurfaces;
    stopPlayback(): void;
    unloadCurrentChannel(): void;
    stopTranscodeSessionById(sessionId: string): void;
    skipToNextProgram(): void;
    pausePlayer(): void;
    playPlayer(): Promise<void>;
    cancelPendingDayRollover(): void;
    pauseSchedulerSync(): void;
    resumeSchedulerSync(): void;
    syncSchedulerToCurrentTime(): void;
    onPlayerStateChange(state: PlaybackState): void;
    onPlayerTimeUpdate(payload: Parameters<PriorityOnePlayerEventPort['onPlayerTimeUpdate']>[0]): void;
    onPlayerBufferUpdate(payload: PlayerBufferUpdatePayload): void;
    handleGlobalError(error: AppError, context: string): void;
    showInfoBanner(): void;
    onProgramStartUiSideEffects(program: ScheduledProgram): void;
    onStreamResolved(stream: StreamDescriptor): void;
    onPlaybackStartFailure(error: unknown): void;
    wireNavigationCoordinatorEvents(): Array<() => void>;
    wireEpgCoordinatorEvents(): Array<() => void>;
    handleScheduleDayRollover(): Promise<void>;
    handlePlayerTrackChange(event: TrackChangePayload): void;
    handlePlexLibraryAuthExpired(): void;
    handlePlexStreamError(error: PlexStreamErrorPayload): void;
    handleScreenChange(payload: ScreenChangePayload): void;
    reportPersistenceWarning(warning: PersistenceWarningPayload): void;
    cleanupReporter(failures: OrchestratorEventCleanupFailure[]): void;
    reportRecoverableAsyncFailure(event: string, message: string, error: unknown): void;
    nowPlayingModalId: string;
}

export function createPriorityOneAssemblyInput(
    source: PriorityOneAssemblySource
): PriorityOneAssemblyInput {
    return {
        modules: {
            scheduler: source.scheduler,
            videoPlayer: source.videoPlayer,
            lifecycle: source.lifecycle,
        },
        surfaces: source.surfaces,
        playback: {
            playbackState: source.playbackState,
            playbackRecovery: source.playbackRecovery,
            stopPlayback: source.stopPlayback,
            unloadCurrentChannel: source.unloadCurrentChannel,
            stopTranscodeSessionById: source.stopTranscodeSessionById,
            skipToNextProgram: source.skipToNextProgram,
            pausePlayer: source.pausePlayer,
            playPlayer: source.playPlayer,
        },
        schedulerRuntime: {
            cancelPendingDayRollover: source.cancelPendingDayRollover,
            pauseSchedulerSync: source.pauseSchedulerSync,
            resumeSchedulerSync: source.resumeSchedulerSync,
            syncSchedulerToCurrentTime: source.syncSchedulerToCurrentTime,
        },
        playerEvents: {
            onPlayerStateChange: source.onPlayerStateChange,
            onPlayerTimeUpdate: source.onPlayerTimeUpdate,
            onPlayerBufferUpdate: source.onPlayerBufferUpdate,
        },
        uiRuntime: {
            handleGlobalError: source.handleGlobalError,
            showInfoBanner: source.showInfoBanner,
            onProgramStartUiSideEffects: source.onProgramStartUiSideEffects,
            onStreamResolved: source.onStreamResolved,
            onPlaybackStartFailure: source.onPlaybackStartFailure,
        },
        events: {
            wireNavigationCoordinatorEvents: source.wireNavigationCoordinatorEvents,
            wireEpgCoordinatorEvents: source.wireEpgCoordinatorEvents,
            handleScheduleDayRollover: source.handleScheduleDayRollover,
            handlePlayerTrackChange: source.handlePlayerTrackChange,
            handlePlexLibraryAuthExpired: source.handlePlexLibraryAuthExpired,
            handlePlexStreamError: source.handlePlexStreamError,
            handleScreenChange: source.handleScreenChange,
            reportPersistenceWarning: source.reportPersistenceWarning,
            cleanupReporter: source.cleanupReporter,
            reportRecoverableAsyncFailure: source.reportRecoverableAsyncFailure,
        },
        nowPlayingModalId: source.nowPlayingModalId,
    };
}
