import type { AppError, IAppLifecycle } from '../../modules/lifecycle';
import type { INavigationManager, Screen } from '../../modules/navigation';
import type {
    IVideoPlayer,
    PlaybackState,
    StreamDescriptor,
    TimeRange,
} from '../../modules/player';
import type { IPlexLibrary } from '../../modules/plex/library';
import type {
    IPlexStreamResolver,
    StreamResolverError,
} from '../../modules/plex/stream';
import type { ChannelManagerEventMap, IChannelManager } from '../../modules/scheduler/channel-manager';
import type {
    IChannelScheduler,
    ScheduledProgram,
} from '../../modules/scheduler/scheduler';
import type { OrchestratorEventCleanupReporter } from './OrchestratorEventCleanupReporter';
import type { OrchestratorPlaybackStateAccessors } from './OrchestratorPlaybackStateAccessors';

export interface PriorityOnePlaybackRecoveryPort {
    resolveStreamForProgram?: (program: ScheduledProgram) => Promise<StreamDescriptor | null | undefined>;
    resetPlaybackFailureGuard?: () => void;
    tryHandleStreamResolverAuthError?: (error: unknown) => boolean;
    tryHandleStreamResolverPermissionError?: (error: unknown) => boolean;
    handlePlaybackFailure?: (context: string, error: unknown) => void;
    isStreamRecoveryInProgress: () => boolean;
}

export interface PriorityOneRequiredRuntimeModules {
    scheduler: IChannelScheduler;
    videoPlayer: IVideoPlayer;
    lifecycle: IAppLifecycle;
}

export interface PriorityOneOptionalRuntimeSurfaces {
    channelBadgeOverlay: { show: (input: { channelNumber: number; channelName: string }) => void; hide: () => void } | null;
    playerOsd: { isVisible: () => boolean } | null;
    nowPlayingInfo: { isVisible: () => boolean } | null;
    epg: { isVisible: () => boolean } | null;
    channelManager: IChannelManager | null;
    navigation: INavigationManager | null;
    plexLibrary: IPlexLibrary | null;
    plexStreamResolver: IPlexStreamResolver | null;
}

export interface PriorityOnePlaybackRuntimePort {
    playbackState: OrchestratorPlaybackStateAccessors;
    playbackRecovery: PriorityOnePlaybackRecoveryPort;
    stopPlayback: () => void;
    unloadCurrentChannel: () => void;
    stopTranscodeSessionById: (sessionId: string) => void;
    skipToNextProgram: () => void;
    pausePlayer: () => void;
    playPlayer: () => Promise<void>;
}

export interface PriorityOneSchedulerRuntimePort {
    cancelPendingDayRollover: () => void;
    pauseSchedulerSync: () => void;
    resumeSchedulerSync: () => void;
    syncSchedulerToCurrentTime: () => void;
}

export interface PriorityOnePlayerEventPort {
    onPlayerStateChange: (state: PlaybackState) => void;
    onPlayerTimeUpdate: (payload: { currentTimeMs: number; durationMs: number }) => void;
    onPlayerBufferUpdate: (payload: { percent: number; bufferedRanges: TimeRange[] }) => void;
}

export interface PriorityOneUiRuntimePort {
    handleGlobalError: (error: AppError, context: string) => void;
    showInfoBanner: () => void;
    onProgramStartUiSideEffects: (program: ScheduledProgram) => void;
    onStreamResolved: (stream: StreamDescriptor) => void;
    onPlaybackStartFailure: (error: unknown) => void;
}

export interface PriorityOneEventRuntimePort {
    wireNavigationCoordinatorEvents: () => Array<() => void>;
    wireEpgCoordinatorEvents: () => Array<() => void>;
    handleScheduleDayRollover: () => Promise<void>;
    handlePlayerTrackChange: (event: { type: 'audio' | 'subtitle'; trackId: string | null }) => void;
    handlePlexLibraryAuthExpired: () => void;
    handlePlexStreamError: (error: StreamResolverError) => void;
    handleScreenChange: (payload: { from: Screen; to: Screen }) => void;
    reportPersistenceWarning: (warning: ChannelManagerEventMap['persistenceWarning']) => void;
    cleanupReporter: OrchestratorEventCleanupReporter;
}
