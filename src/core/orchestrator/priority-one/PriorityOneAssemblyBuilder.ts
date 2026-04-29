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
import type { OrchestratorPlaybackStateAccessors } from '../OrchestratorPlaybackStateAccessors';
import { NOW_PLAYING_INFO_MODAL_ID } from '../../../modules/ui/now-playing-info';
import type { PriorityOneAssemblyInput } from './PriorityOneAssemblyInput';
import {
    createPriorityOneControllersAndBinder,
    type PriorityOneControllersAndBinder,
} from './PriorityOneControllerFactory';

export type { PriorityOneControllersAndBinder } from './PriorityOneControllerFactory';

type PriorityOneWarningReporter = (
    event: string,
    message: string,
    data?: Record<string, unknown>
) => void;

type PriorityOneErrorReporter = (
    event: string,
    message: string,
    error: unknown,
    data?: Record<string, unknown>
) => void;

export interface PriorityOneRuntimeAssemblyInput {
    requiredModules: {
        scheduler: IChannelScheduler;
        videoPlayer: IVideoPlayer;
        lifecycle: IAppLifecycle;
    };
    runtimeSurfaces: {
        channelBadgeOverlay: PriorityOneOptionalRuntimeSurfaces['channelBadgeOverlay'];
        playerOsd: PriorityOneOptionalRuntimeSurfaces['playerOsd'];
        nowPlayingInfo: PriorityOneOptionalRuntimeSurfaces['nowPlayingInfo'];
        epg: PriorityOneOptionalRuntimeSurfaces['epg'];
        channelManager: IChannelManager | null;
        navigation: INavigationManager | null;
        plexLibrary: IPlexLibrary | null;
        plexStreamResolver: IPlexStreamResolver | null;
    };
    playback: {
        playbackState: OrchestratorPlaybackStateAccessors;
        playbackRecovery: PriorityOnePlaybackRecoveryPort;
    };
    runtimeControllers: {
        channelTransition: {
            isActive: () => boolean;
            onPlayerStateChange: (state: PlaybackState) => void;
            onScreenChange: (screen: Screen) => void;
        } | null;
        playerOsd: {
            onPlayerStateChange: (state: PlaybackState) => void;
            onTimeUpdate: (payload: { currentTimeMs: number; durationMs: number }) => void;
            onBufferUpdate: (payload: { percent: number; bufferedRanges: TimeRange[] }) => void;
            showInfoBanner: () => void;
        } | null;
        nowPlayingInfo: {
            onProgramStart: (program: ScheduledProgram) => void;
        } | null;
        epg: {
            refreshEpgScheduleForLiveChannel: () => void;
            wireEpgEvents: () => Array<() => void>;
        } | null;
        navigation: {
            wireNavigationEvents: () => Array<() => void>;
        } | null;
        playbackOptions: {
            refreshIfOpen: () => void;
        } | null;
        scheduleDayRollover: {
            cancelPendingDayRollover: () => void;
            handleScheduleDayRollover: () => Promise<void>;
        } | null;
        subtitleTrackRecovery: {
            handleTrackChange: (event: { type: 'audio' | 'subtitle'; trackId: string | null }) => void;
        } | null;
        nowPlayingDebug: {
            maybeAutoShowNowPlayingStreamDebugHud: () => void;
            maybeFetchNowPlayingStreamDecisionForDebugHud: () => Promise<unknown>;
        } | null;
    };
    orchestratorCallbacks: {
        stopPlayback: () => void;
        handleGlobalError: (error: AppError, context: string) => void;
        handlePlexLibraryAuthExpired: () => void;
        handlePlexStreamError: (error: StreamResolverError) => void;
        showPersistenceWarning: (message: string) => void;
        reportRecoverableRuntimeIssue: PriorityOneWarningReporter;
        reportRecoverableRuntimeError: PriorityOneErrorReporter;
    };
}

interface PriorityOneAssemblyBuilderInput {
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
    cleanupReporter: (failures: Parameters<PriorityOneAssemblyInput['events']['cleanupReporter']>[0]) => void;
    reportRecoverableAsyncFailure: RecoverableAsyncFailureReporter;
    nowPlayingModalId: string;
}

function buildPriorityOneAssemblyInput(
    input: PriorityOneRuntimeAssemblyInput,
    runtime: { syncChannelBadgeOverlay: () => void }
): PriorityOneAssemblyBuilderInput {
    const {
        requiredModules,
        runtimeSurfaces,
        playback,
        runtimeControllers,
        orchestratorCallbacks,
    } = input;

    return {
        scheduler: requiredModules.scheduler,
        videoPlayer: requiredModules.videoPlayer,
        lifecycle: requiredModules.lifecycle,
        channelBadgeOverlay: runtimeSurfaces.channelBadgeOverlay,
        playerOsd: runtimeSurfaces.playerOsd,
        nowPlayingInfo: runtimeSurfaces.nowPlayingInfo,
        epg: runtimeSurfaces.epg,
        isChannelTransitionActive: (): boolean =>
            runtimeControllers.channelTransition?.isActive() ?? false,
        channelManager: runtimeSurfaces.channelManager,
        navigation: runtimeSurfaces.navigation,
        plexLibrary: runtimeSurfaces.plexLibrary,
        plexStreamResolver: runtimeSurfaces.plexStreamResolver,
        playbackState: playback.playbackState,
        playbackRecovery: playback.playbackRecovery,
        stopPlayback: orchestratorCallbacks.stopPlayback,
        unloadCurrentChannel: (): void => {
            requiredModules.scheduler.unloadChannel();
        },
        stopTranscodeSessionById: (sessionId: string): void => {
            const stopPromise = runtimeSurfaces.plexStreamResolver?.stopTranscodeSession(sessionId);
            stopPromise?.catch((error) => {
                orchestratorCallbacks.reportRecoverableRuntimeError(
                    'orchestrator.stopTranscodeSession',
                    'Failed to stop Plex transcode session',
                    error,
                    { sessionId }
                );
            });
        },
        skipToNextProgram: (): void => {
            requiredModules.scheduler.skipToNext();
        },
        pausePlayer: (): void => {
            requiredModules.videoPlayer.pause();
        },
        playPlayer: (): Promise<void> => requiredModules.videoPlayer.play(),
        cancelPendingDayRollover: (): void => {
            runtimeControllers.scheduleDayRollover?.cancelPendingDayRollover();
        },
        pauseSchedulerSync: (): void => {
            requiredModules.scheduler.pauseSyncTimer();
        },
        resumeSchedulerSync: (): void => {
            requiredModules.scheduler.resumeSyncTimer();
        },
        syncSchedulerToCurrentTime: (): void => {
            requiredModules.scheduler.syncToCurrentTime();
        },
        onPlayerStateChange: (state): void => {
            runtimeControllers.playerOsd?.onPlayerStateChange(state);
            runtimeControllers.channelTransition?.onPlayerStateChange(state);
        },
        onPlayerTimeUpdate: (payload): void => {
            runtimeControllers.playerOsd?.onTimeUpdate(payload);
        },
        onPlayerBufferUpdate: (payload): void => {
            runtimeControllers.playerOsd?.onBufferUpdate(payload);
        },
        handleGlobalError: orchestratorCallbacks.handleGlobalError,
        showInfoBanner: (): void => {
            runtimeControllers.playerOsd?.showInfoBanner();
        },
        onProgramStartUiSideEffects: (program): void => {
            runtimeControllers.nowPlayingInfo?.onProgramStart(program);
            runtime.syncChannelBadgeOverlay();
            runtimeControllers.epg?.refreshEpgScheduleForLiveChannel();
        },
        onStreamResolved: (): void => {
            runtimeControllers.nowPlayingDebug?.maybeAutoShowNowPlayingStreamDebugHud();
            void runtimeControllers.nowPlayingDebug?.maybeFetchNowPlayingStreamDecisionForDebugHud();
        },
        onPlaybackStartFailure: (error: unknown): void => {
            orchestratorCallbacks.reportRecoverableRuntimeError(
                'orchestrator.playback.loadStream',
                'Failed to load stream',
                error
            );
        },
        wireNavigationCoordinatorEvents: (): Array<() => void> =>
            runtimeControllers.navigation?.wireNavigationEvents() ?? [],
        wireEpgCoordinatorEvents: (): Array<() => void> =>
            runtimeControllers.epg?.wireEpgEvents() ?? [],
        handleScheduleDayRollover: (): Promise<void> =>
            runtimeControllers.scheduleDayRollover?.handleScheduleDayRollover() ??
            Promise.resolve(),
        handlePlayerTrackChange: (event): void => {
            runtimeControllers.playbackOptions?.refreshIfOpen();
            runtimeControllers.subtitleTrackRecovery?.handleTrackChange(event);
        },
        handlePlexLibraryAuthExpired: orchestratorCallbacks.handlePlexLibraryAuthExpired,
        handlePlexStreamError: orchestratorCallbacks.handlePlexStreamError,
        handleScreenChange: (payload): void => {
            runtimeControllers.channelTransition?.onScreenChange(payload.to);
        },
        reportPersistenceWarning: (warning): void => {
            orchestratorCallbacks.showPersistenceWarning(warning.message);
        },
        cleanupReporter: (failures): void => {
            orchestratorCallbacks.reportRecoverableRuntimeIssue(
                'orchestrator.eventWiring.rollback',
                'Event wiring rollback failures',
                { failures }
            );
        },
        reportRecoverableAsyncFailure: (event, message, error): void => {
            orchestratorCallbacks.reportRecoverableRuntimeError(event, message, error);
        },
        nowPlayingModalId: NOW_PLAYING_INFO_MODAL_ID,
    };
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
    input: PriorityOneRuntimeAssemblyInput
): PriorityOneControllersAndBinder {
    let syncChannelBadgeOverlay = (): void => undefined;
    const assemblyInput = buildPriorityOneAssemblyInput(input, {
        syncChannelBadgeOverlay: (): void => {
            syncChannelBadgeOverlay();
        },
    });
    const priorityOne = createPriorityOneControllersAndBinder(
        createPriorityOneAssembly(assemblyInput)
    );
    syncChannelBadgeOverlay = (): void => {
        priorityOne.overlayRuntimePolicyController.syncChannelBadgeOverlay();
    };
    return priorityOne;
}
