import type {
    IVideoPlayer,
    PlaybackError,
    StreamDescriptor,
} from '../../../modules/player';
import type { ScheduledProgram } from '../../../modules/scheduler/scheduler';
import {
    OrchestratorEventBinder,
    type OrchestratorEventBinderDeps,
} from '../OrchestratorEventBinder';
import {
    OverlayRuntimePolicyController,
    type OverlayRuntimePolicyControllerDeps,
} from '../OverlayRuntimePolicyController';
import { ProfileSwitchCleanupController } from '../ProfileSwitchCleanupController';
import { PlaybackStartController } from './PlaybackStartController';
import { PlaybackRuntimeController } from './PlaybackRuntimeController';
import type { PriorityOneAssemblyInput } from './PriorityOneAssemblyInput';

export interface PriorityOneControllersAndBinder {
    overlayRuntimePolicyController: OverlayRuntimePolicyController;
    playbackStartController: PlaybackStartController;
    playbackRuntimeController: PlaybackRuntimeController;
    profileSwitchCleanupController: ProfileSwitchCleanupController;
    eventBinder: OrchestratorEventBinder;
}

function getCurrentChannelSnapshot(
    surfaces: PriorityOneAssemblyInput['surfaces']
): { number: number; name: string } | null {
    const channel = surfaces.channelManager?.getCurrentChannel() ?? null;
    return channel
        ? { number: channel.number, name: channel.name }
        : null;
}

function resolvePlaybackStartStream(
    playback: PriorityOneAssemblyInput['playback'],
    program: ScheduledProgram
): Promise<StreamDescriptor | null> {
    return playback.playbackRecovery.resolveStreamForProgram?.(program).then((stream) => stream ?? null)
        ?? Promise.resolve(null);
}

function markProgramStarting(
    playbackState: PriorityOneAssemblyInput['playback']['playbackState'],
    program: ScheduledProgram
): {
    programAtStart: ScheduledProgram;
    shouldResetAutoShowInfoBannerOnAbort: boolean;
} {
    playbackState.setCurrentProgramForPlayback(program);
    const shouldResetAutoShowInfoBannerOnAbort =
        playbackState.getPendingNowPlayingChannelId() !== null;

    if (shouldResetAutoShowInfoBannerOnAbort) {
        playbackState.setShouldAutoShowInfoBannerOnNextPlay(true);
        playbackState.setPendingNowPlayingChannelId(null);
    }

    return {
        programAtStart: program,
        shouldResetAutoShowInfoBannerOnAbort,
    };
}

function getActiveTranscodeSessionId(
    playbackState: PriorityOneAssemblyInput['playback']['playbackState']
): string | null {
    const decision = playbackState.getCurrentStreamDecision();
    if (!decision || !decision.isTranscoding || !decision.sessionId) {
        return null;
    }

    return decision.sessionId;
}

function createOverlayRuntimePolicyControllerDeps(
    input: PriorityOneAssemblyInput
): OverlayRuntimePolicyControllerDeps {
    const { surfaces, playback, nowPlayingModalId } = input;
    return {
        hasChannelBadgeOverlay: (): boolean => surfaces.channelBadgeOverlay !== null,
        getPlayerOsdVisible: (): boolean => surfaces.playerOsd?.isVisible() ?? false,
        getNowPlayingInfoVisible: (): boolean => surfaces.nowPlayingInfo?.isVisible() ?? false,
        getEpgVisible: (): boolean => surfaces.epg?.isVisible() ?? false,
        getCurrentChannel: (): { number: number; name: string } | null =>
            getCurrentChannelSnapshot(surfaces),
        showChannelBadge: (badge): void => {
            surfaces.channelBadgeOverlay?.show(badge);
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
        nowPlayingModalId,
    };
}

function createPlaybackStartController(
    input: PriorityOneAssemblyInput
): PlaybackStartController {
    const { modules, playback, uiRuntime } = input;
    return new PlaybackStartController({
        getVideoPlayer: (): IVideoPlayer | null => modules.videoPlayer,
        resolveStreamForProgram: (program): Promise<StreamDescriptor | null> =>
            resolvePlaybackStartStream(playback, program),
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
        markProgramStarting: (program) => markProgramStarting(playback.playbackState, program),
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
}

function createPlaybackRuntimeController(
    input: PriorityOneAssemblyInput
): PlaybackRuntimeController {
    const { modules, playback, schedulerRuntime, playerEvents, uiRuntime } = input;
    return new PlaybackRuntimeController({
        isStreamRecoveryInProgress: (): boolean =>
            playback.playbackRecovery.isStreamRecoveryInProgress(),
        getActiveTranscodeSessionId: (): string | null =>
            getActiveTranscodeSessionId(playback.playbackState),
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
}

function createProfileSwitchCleanupController(
    input: PriorityOneAssemblyInput
): ProfileSwitchCleanupController {
    const { playback, schedulerRuntime } = input;
    return new ProfileSwitchCleanupController({
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
}

function createOrchestratorEventBinderDeps(
    input: PriorityOneAssemblyInput,
    playbackStartController: PlaybackStartController,
    playbackRuntimeController: PlaybackRuntimeController
): OrchestratorEventBinderDeps {
    const { modules, surfaces, events } = input;
    return {
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
        reportPersistenceWarning: (warning): void => {
            events.reportPersistenceWarning(warning);
        },
        reportRecoverableAsyncFailure: (event, message, error): void => {
            events.reportRecoverableAsyncFailure(event, message, error);
        },
    };
}

export function createPriorityOneControllersAndBinder(
    input: PriorityOneAssemblyInput
): PriorityOneControllersAndBinder {
    const overlayRuntimePolicyController = new OverlayRuntimePolicyController(
        createOverlayRuntimePolicyControllerDeps(input)
    );
    const playbackStartController = createPlaybackStartController(input);
    const playbackRuntimeController = createPlaybackRuntimeController(input);
    const profileSwitchCleanupController = createProfileSwitchCleanupController(input);
    const eventBinder = new OrchestratorEventBinder(
        createOrchestratorEventBinderDeps(
            input,
            playbackStartController,
            playbackRuntimeController
        )
    );

    return {
        overlayRuntimePolicyController,
        playbackStartController,
        playbackRuntimeController,
        profileSwitchCleanupController,
        eventBinder,
    };
}
