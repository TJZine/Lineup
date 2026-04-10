import type {
    PlaybackError,
    StreamDescriptor,
} from '../../modules/player';
import type { ScheduledProgram } from '../../modules/scheduler/scheduler';
import {
    OrchestratorEventBinder,
    type OrchestratorEventBinderDeps,
} from './OrchestratorEventBinder';
import {
    OverlayRuntimePolicyController,
} from './OverlayRuntimePolicyController';
import { ProfileSwitchCleanupController } from './ProfileSwitchCleanupController';
import { PlaybackStartController } from '../PlaybackStartController';
import { PlaybackRuntimeController } from '../PlaybackRuntimeController';
import type {
    PriorityOneEventRuntimePort,
    PriorityOneOptionalRuntimeSurfaces,
    PriorityOnePlaybackRuntimePort,
    PriorityOnePlayerEventPort,
    PriorityOneRequiredRuntimeModules,
    PriorityOneSchedulerRuntimePort,
    PriorityOneUiRuntimePort,
} from './OrchestratorRuntimeSeams';

export interface OrchestratorPriorityOneControllerFactoryDeps {
    modules: PriorityOneRequiredRuntimeModules;
    surfaces: PriorityOneOptionalRuntimeSurfaces;
    playback: PriorityOnePlaybackRuntimePort;
    schedulerRuntime: PriorityOneSchedulerRuntimePort;
    playerEvents: PriorityOnePlayerEventPort;
    uiRuntime: PriorityOneUiRuntimePort;
    events: PriorityOneEventRuntimePort;
    nowPlayingModalId: string;
}

export interface PriorityOneControllersAndBinder {
    overlayRuntimePolicyController: OverlayRuntimePolicyController;
    playbackStartController: PlaybackStartController;
    playbackRuntimeController: PlaybackRuntimeController;
    profileSwitchCleanupController: ProfileSwitchCleanupController;
    eventBinder: OrchestratorEventBinder;
}

export function createPriorityOneControllersAndBinder(
    deps: OrchestratorPriorityOneControllerFactoryDeps
): PriorityOneControllersAndBinder {
    const { modules, surfaces, playback, schedulerRuntime, playerEvents, uiRuntime, events } = deps;

    const overlayRuntimePolicyController = new OverlayRuntimePolicyController({
        hasChannelBadgeOverlay: (): boolean => surfaces.channelBadgeOverlay !== null,
        getPlayerOsdVisible: (): boolean => surfaces.playerOsd?.isVisible() ?? false,
        getNowPlayingInfoVisible: (): boolean => surfaces.nowPlayingInfo?.isVisible() ?? false,
        getEpgVisible: (): boolean => surfaces.epg?.isVisible() ?? false,
        getCurrentChannel: (): { number: number; name: string } | null => {
            const channel = surfaces.channelManager?.getCurrentChannel() ?? null;
            return channel
                ? {
                    number: channel.number,
                    name: channel.name,
                }
                : null;
        },
        showChannelBadge: (input): void => {
            surfaces.channelBadgeOverlay?.show(input);
        },
        hideChannelBadge: (): void => {
            surfaces.channelBadgeOverlay?.hide();
        },
        hasNavigation: (): boolean => surfaces.navigation !== null,
        hasNowPlayingInfoOverlay: (): boolean => surfaces.nowPlayingInfo !== null,
        getCurrentScreen: (): string | null => surfaces.navigation?.getCurrentScreen() ?? null,
        hasCurrentProgramForPlayback: (): boolean =>
            playback.playbackState.getCurrentProgramForPlayback() !== null,
        isModalOpen: (modalId?: string): boolean => surfaces.navigation?.isModalOpen(modalId) ?? false,
        openModal: (modalId: string): void => {
            surfaces.navigation?.openModal(modalId);
        },
        closeModal: (modalId: string): void => {
            surfaces.navigation?.closeModal(modalId);
        },
        nowPlayingModalId: deps.nowPlayingModalId,
    });

    const playbackStartController = new PlaybackStartController({
        getVideoPlayer: () => modules.videoPlayer,
        resolveStreamForProgram: (program): Promise<StreamDescriptor | null> =>
            playback.playbackRecovery.resolveStreamForProgram?.(program).then((stream) => stream ?? null) ?? Promise.resolve(null),
        resetPlaybackFailureGuard: (): void => {
            playback.playbackRecovery.resetPlaybackFailureGuard?.();
        },
        tryHandleStreamResolverAuthError: (error): boolean =>
            playback.playbackRecovery.tryHandleStreamResolverAuthError?.(error) ?? false,
        tryHandleStreamResolverPermissionError: (error): boolean =>
            playback.playbackRecovery.tryHandleStreamResolverPermissionError?.(error) ?? false,
        handlePlaybackFailure: (context, error): void => {
            playback.playbackRecovery.handlePlaybackFailure?.(context, error);
        },
        logPlaybackStartFailure: (error): void => {
            uiRuntime.onPlaybackStartFailure(error);
        },
        markProgramStarting: (program): {
            programAtStart: ScheduledProgram;
            shouldResetAutoShowInfoBannerOnAbort: boolean;
        } => {
            playback.playbackState.setCurrentProgramForPlayback(program);
            const shouldResetAutoShowInfoBannerOnAbort =
                playback.playbackState.getPendingNowPlayingChannelId() !== null;

            if (shouldResetAutoShowInfoBannerOnAbort) {
                playback.playbackState.setShouldAutoShowInfoBannerOnNextPlay(true);
                playback.playbackState.setPendingNowPlayingChannelId(null);
            }

            return {
                programAtStart: program,
                shouldResetAutoShowInfoBannerOnAbort,
            };
        },
        isProgramStillCurrent: (program): boolean =>
            playback.playbackState.getCurrentProgramForPlayback() === program,
        handleProgramStartUiSideEffects: (program): void => {
            uiRuntime.onProgramStartUiSideEffects(program);
        },
        handleStreamResolved: (stream): void => {
            playback.playbackState.setCurrentStreamDescriptor(stream);
            uiRuntime.onStreamResolved(stream);
        },
        clearAutoShowInfoBannerAfterAbortedStart: (): void => {
            playback.playbackState.setShouldAutoShowInfoBannerOnNextPlay(false);
        },
    });

    const playbackRuntimeController = new PlaybackRuntimeController({
        isStreamRecoveryInProgress: (): boolean =>
            playback.playbackRecovery.isStreamRecoveryInProgress(),
        getActiveTranscodeSessionId: (): string | null => {
            const decision = playback.playbackState.getCurrentStreamDecision();
            if (!decision || !decision.isTranscoding || !decision.sessionId) {
                return null;
            }
            return decision.sessionId;
        },
        stopTranscodeSession: (sessionId): void => {
            playback.stopTranscodeSessionById(sessionId);
        },
        skipToNextProgram: (): void => {
            playback.skipToNextProgram();
        },
        pausePlayer: (): void => {
            playback.pausePlayer();
        },
        playPlayer: (): Promise<void> => playback.playPlayer(),
        pauseSchedulerSync: (): void => {
            schedulerRuntime.pauseSchedulerSync();
        },
        resumeSchedulerSync: (): void => {
            schedulerRuntime.resumeSchedulerSync();
        },
        syncSchedulerToCurrentTime: (): void => {
            schedulerRuntime.syncSchedulerToCurrentTime();
        },
        saveLifecycleState: (): Promise<void> => modules.lifecycle.saveState(),
        handleGlobalError: (error, context): void => {
            uiRuntime.handleGlobalError(error, context);
        },
        handlePlaybackFailure: (context, error): void => {
            playback.playbackRecovery.handlePlaybackFailure?.(context, error);
        },
        onPlayerStateChange: (state): void => {
            playerEvents.onPlayerStateChange(state);
        },
        shouldAutoShowInfoBannerOnNextPlay: (): boolean =>
            playback.playbackState.getShouldAutoShowInfoBannerOnNextPlay(),
        clearAutoShowInfoBannerOnNextPlay: (): void => {
            playback.playbackState.setShouldAutoShowInfoBannerOnNextPlay(false);
        },
        showInfoBanner: (): void => {
            uiRuntime.showInfoBanner();
        },
        onPlayerTimeUpdate: (payload): void => {
            playerEvents.onPlayerTimeUpdate(payload);
        },
        onPlayerBufferUpdate: (payload): void => {
            playerEvents.onPlayerBufferUpdate(payload);
        },
    });

    const profileSwitchCleanupController = new ProfileSwitchCleanupController({
        cancelPendingDayRollover: (): void => {
            schedulerRuntime.cancelPendingDayRollover();
        },
        stopPlayback: (): void => {
            playback.stopPlayback();
        },
        unloadCurrentChannel: (): void => {
            playback.unloadCurrentChannel();
        },
        setPendingNowPlayingChannelId: (channelId): void => {
            playback.playbackState.setPendingNowPlayingChannelId(channelId);
        },
        setShouldAutoShowInfoBannerOnNextPlay: (value): void => {
            playback.playbackState.setShouldAutoShowInfoBannerOnNextPlay(value);
        },
        setCurrentProgramForPlayback: (program): void => {
            playback.playbackState.setCurrentProgramForPlayback(program);
        },
        setCurrentStreamDescriptor: (stream): void => {
            playback.playbackState.setCurrentStreamDescriptor(stream);
        },
        setCurrentStreamDecision: (decision): void => {
            playback.playbackState.setCurrentStreamDecision(decision);
        },
    });

    const binderDeps: OrchestratorEventBinderDeps = {
        cleanupReporter: events.cleanupReporter,
        getScheduler: () => modules.scheduler,
        getVideoPlayer: () => modules.videoPlayer,
        getPlexLibrary: () => surfaces.plexLibrary,
        getPlexStreamResolver: () => surfaces.plexStreamResolver,
        getNavigation: () => surfaces.navigation,
        getLifecycle: () => modules.lifecycle,
        getChannelManager: () => surfaces.channelManager,
        wireNavigationCoordinatorEvents: (): Array<() => void> => events.wireNavigationCoordinatorEvents(),
        wireEpgCoordinatorEvents: (): Array<() => void> => events.wireEpgCoordinatorEvents(),
        handleProgramStartTracked: (program): Promise<void> => {
            const promise = playbackStartController.handleProgramStart(program);
            return playbackRuntimeController.trackProgramStart(promise);
        },
        handleScheduleDayRollover: (): Promise<void> => events.handleScheduleDayRollover(),
        handlePlayerEnded: (): void => {
            playbackRuntimeController.handlePlayerEnded();
        },
        handlePlayerTrackChange: (event): void => events.handlePlayerTrackChange(event),
        handlePlaybackError: (error: PlaybackError): void => {
            playbackRuntimeController.handlePlaybackError(error);
        },
        handlePlayerStateChange: (state): void => {
            playbackRuntimeController.handlePlayerStateChange(state);
        },
        handlePlayerTimeUpdate: (payload): void => {
            playbackRuntimeController.handlePlayerTimeUpdate(payload);
        },
        handlePlayerBufferUpdate: (payload): void => {
            playbackRuntimeController.handlePlayerBufferUpdate(payload);
        },
        handlePlexLibraryAuthExpired: (): void => events.handlePlexLibraryAuthExpired(),
        handlePlexStreamError: (error): void => events.handlePlexStreamError(error),
        handleScreenChange: (payload): void => events.handleScreenChange(payload),
        handleLifecyclePause: (): Promise<void> => playbackRuntimeController.handleLifecyclePause(),
        handleLifecycleResume: (): Promise<void> => playbackRuntimeController.handleLifecycleResume(),
        reportPersistenceWarning: (message): void => {
            events.reportPersistenceWarning(message);
        },
    };
    const eventBinder = new OrchestratorEventBinder(binderDeps);

    return {
        overlayRuntimePolicyController,
        playbackStartController,
        playbackRuntimeController,
        profileSwitchCleanupController,
        eventBinder,
    };
}
