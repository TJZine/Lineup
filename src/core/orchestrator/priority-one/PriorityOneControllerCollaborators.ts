import type {
    IVideoPlayer,
    PlaybackError,
    PreparedPlaybackStream,
} from '../../../modules/player';
import {
    buildScheduledProgramIdentity,
    buildScheduledProgramIdentityFromState,
    scheduledProgramIdentitiesMatch,
    type ScheduledProgram,
    type ScheduledProgramIdentity,
} from '../../../modules/scheduler/scheduler';
import {
    OrchestratorEventBinder,
    type OrchestratorEventBinderDeps,
} from '../events/OrchestratorEventBinder';
import {
    OverlayRuntimePolicyController,
    type OverlayRuntimePolicyControllerDeps,
} from '../controllers/OverlayRuntimePolicyController';
import {
    ProfileSwitchCleanupController,
} from '../controllers/ProfileSwitchCleanupController';
import {
    PlaybackRuntimeController,
    type PlaybackRuntimeControllerDeps,
} from './PlaybackRuntimeController';
import { PlaybackStartController, type PlaybackStartControllerDeps } from './PlaybackStartController';
import type { PriorityOneAssemblyInput } from './PriorityOneAssemblyInput';

function getCurrentChannelSnapshot(
    surfaces: PriorityOneAssemblyInput['surfaces']
): { number: number; name: string } | null {
    const channel = surfaces.channelManager?.getCurrentChannel() ?? null;
    return channel
        ? { number: channel.number, name: channel.name }
        : null;
}

function markProgramStarting(
    scheduler: PriorityOneAssemblyInput['modules']['scheduler'],
    playbackState: PriorityOneAssemblyInput['playback']['playbackState'],
    program: ScheduledProgram
): {
    programAtStart: ScheduledProgram;
    programIdentityAtStart: ScheduledProgramIdentity | null;
    shouldResetAutoShowInfoBannerOnAbort: boolean;
} {
    playbackState.setCurrentProgramForPlayback(program);
    const schedulerState = scheduler.getState();
    const shouldResetAutoShowInfoBannerOnAbort =
        playbackState.getPendingNowPlayingChannelId() !== null;

    if (shouldResetAutoShowInfoBannerOnAbort) {
        playbackState.setShouldAutoShowInfoBannerOnNextPlay(true);
        playbackState.setPendingNowPlayingChannelId(null);
    }

    return {
        programAtStart: program,
        programIdentityAtStart: schedulerState.isActive
            ? buildScheduledProgramIdentity(schedulerState.channelId, program)
            : null,
        shouldResetAutoShowInfoBannerOnAbort,
    };
}

function isPlaybackStartProgramStillCurrent(
    scheduler: PriorityOneAssemblyInput['modules']['scheduler'],
    playbackState: PriorityOneAssemblyInput['playback']['playbackState'],
    programAtStart: ScheduledProgram,
    programIdentityAtStart: ScheduledProgramIdentity | null
): boolean {
    const schedulerState = scheduler.getState();
    if (schedulerState.isActive) {
        if (programIdentityAtStart) {
            return scheduledProgramIdentitiesMatch(
                buildScheduledProgramIdentityFromState(schedulerState),
                programIdentityAtStart
            );
        }

        return schedulerState.currentProgram === programAtStart;
    }

    return playbackState.getCurrentProgramForPlayback() === programAtStart;
}

function createOverlayRuntimePolicyDeps(
    input: PriorityOneAssemblyInput
): OverlayRuntimePolicyControllerDeps {
    return {
        nowPlayingModalId: input.nowPlayingModalId,
        hasChannelBadgeOverlay: (): boolean => input.surfaces.channelBadgeOverlay !== null,
        getPlayerOsdVisible: (): boolean => input.surfaces.playerOsd?.isVisible() ?? false,
        getNowPlayingInfoVisible: (): boolean => input.surfaces.nowPlayingInfo?.isVisible() ?? false,
        getEpgVisible: (): boolean => input.surfaces.epg?.isVisible() ?? false,
        isChannelTransitionActive: (): boolean =>
            input.surfaces.channelTransitionActivity?.isActive() ?? false,
        getCurrentChannel: (): { number: number; name: string } | null =>
            getCurrentChannelSnapshot(input.surfaces),
        showChannelBadge: (badge): void => {
            input.surfaces.channelBadgeOverlay?.show(badge);
        },
        hideChannelBadge: (): void => {
            input.surfaces.channelBadgeOverlay?.hide();
        },
        hasNavigation: (): boolean => input.surfaces.navigation !== null,
        hasNowPlayingInfoOverlay: (): boolean => input.surfaces.nowPlayingInfo !== null,
        getCurrentScreen: (): string | null => input.surfaces.navigation?.getCurrentScreen() ?? null,
        hasCurrentProgramForPlayback: (): boolean =>
            input.playback.playbackState.getCurrentProgramForPlayback() !== null,
        isModalOpen: (modalId?: string): boolean =>
            input.surfaces.navigation?.isModalOpen(modalId) ?? false,
        openModal: (modalId: string): void => {
            input.surfaces.navigation?.openModal(modalId);
        },
        closeModal: (modalId: string): void => {
            input.surfaces.navigation?.closeModal(modalId);
        },
    };
}

function createPlaybackStartDeps(input: PriorityOneAssemblyInput): PlaybackStartControllerDeps {
    return {
        getVideoPlayer: (): IVideoPlayer | null => input.modules.videoPlayer,
        resolveStreamForProgram: (program): Promise<PreparedPlaybackStream> =>
            input.playback.playbackRecovery.resolveStreamForProgram(program),
        discardPreparedStream: (prepared): Promise<void> =>
            input.playback.playbackRecovery.discardPreparedStream(prepared),
        resetPlaybackFailureGuard: (): void => {
            input.playback.playbackRecovery.resetPlaybackFailureGuard?.();
        },
        tryHandleStreamResolverAuthError: (error): boolean =>
            input.playback.playbackRecovery.tryHandleStreamResolverAuthError?.(error) ?? false,
        tryHandleStreamResolverPermissionError: (error): boolean =>
            input.playback.playbackRecovery.tryHandleStreamResolverPermissionError?.(error) ?? false,
        attemptTranscodeFallbackForCurrentProgram: (reason, attemptedStream): Promise<boolean> =>
            input.playback.playbackRecovery.attemptTranscodeFallbackForCurrentProgram?.(
                reason,
                attemptedStream
            ) ?? Promise.resolve(false),
        handlePlaybackFailure: (context, error): void => {
            input.playback.playbackRecovery.handlePlaybackFailure?.(context, error);
        },
        logPlaybackStartFailure: (error): void => {
            input.uiRuntime.onPlaybackStartFailure(error);
        },
        markProgramStarting: (program): ReturnType<PlaybackStartControllerDeps['markProgramStarting']> =>
            markProgramStarting(input.modules.scheduler, input.playback.playbackState, program),
        isProgramStillCurrent: (program, programIdentityAtStart): boolean =>
            isPlaybackStartProgramStillCurrent(
                input.modules.scheduler,
                input.playback.playbackState,
                program,
                programIdentityAtStart
            ),
        handleProgramStartUiSideEffects: (program): void => {
            input.uiRuntime.onProgramStartUiSideEffects(program);
        },
        commitPreparedStream: (prepared): void => {
            input.playback.playbackState.setCurrentStreamDecision(prepared.decision);
            input.playback.playbackState.setCurrentStreamDescriptor(prepared.descriptor);
        },
        handleStreamResolved: (prepared): void => {
            input.uiRuntime.onStreamResolved(prepared.descriptor);
        },
        reportRecoverableActivationFailure: (error): void => {
            input.events.reportRecoverableAsyncFailure(
                'orchestrator.playbackStart.onStreamResolved',
                'Playback stream-resolved callback failed after activation',
                error
            );
        },
        clearAutoShowInfoBannerAfterAbortedStart: (): void => {
            input.playback.playbackState.setShouldAutoShowInfoBannerOnNextPlay(false);
        },
    };
}

function createPlaybackRuntimeDeps(input: PriorityOneAssemblyInput): PlaybackRuntimeControllerDeps {
    return {
        playback: input.playback,
        schedulerRuntime: input.schedulerRuntime,
        playerEvents: input.playerEvents,
        uiRuntime: input.uiRuntime,
        saveLifecycleState: (): Promise<void> => input.modules.lifecycle.saveState(),
        reportRecoverableAsyncFailure: input.events.reportRecoverableAsyncFailure,
    };
}

function createEventBinderDeps(
    input: PriorityOneAssemblyInput,
    playbackStartController: PlaybackStartController,
    playbackRuntimeController: PlaybackRuntimeController
): OrchestratorEventBinderDeps {
    return {
        cleanupReporter: input.events.cleanupReporter,
        reportRecoverableAsyncFailure: input.events.reportRecoverableAsyncFailure,
        getScheduler: (): ReturnType<OrchestratorEventBinderDeps['getScheduler']> =>
            input.modules.scheduler,
        getVideoPlayer: (): ReturnType<OrchestratorEventBinderDeps['getVideoPlayer']> =>
            input.modules.videoPlayer,
        getPlexLibrary: (): ReturnType<OrchestratorEventBinderDeps['getPlexLibrary']> =>
            input.surfaces.plexLibrary,
        getPlexStreamResolver: (): ReturnType<OrchestratorEventBinderDeps['getPlexStreamResolver']> =>
            input.surfaces.plexStreamResolver,
        getNavigation: (): ReturnType<OrchestratorEventBinderDeps['getNavigation']> =>
            input.surfaces.navigation,
        getLifecycle: (): ReturnType<OrchestratorEventBinderDeps['getLifecycle']> =>
            input.modules.lifecycle,
        getChannelManager: (): ReturnType<OrchestratorEventBinderDeps['getChannelManager']> =>
            input.surfaces.channelManager,
        wireNavigationCoordinatorEvents: (): Array<() => void> =>
            input.events.wireNavigationCoordinatorEvents(),
        wireEpgCoordinatorEvents: (): Array<() => void> =>
            input.events.wireEpgCoordinatorEvents(),
        handleProgramStartTracked: (program): Promise<void> => {
            const promise = playbackStartController.handleProgramStart(program);
            return playbackRuntimeController.trackProgramStart(promise);
        },
        handleScheduleDayRollover: (): Promise<void> =>
            input.events.handleScheduleDayRollover(),
        handlePlayerEnded: (): void => {
            playbackRuntimeController.handlePlayerEnded();
        },
        handlePlayerTrackChange: (event): void => {
            input.events.handlePlayerTrackChange(event);
        },
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
        handlePlexLibraryAuthorizationFailure: (failure): void => {
            input.events.handlePlexLibraryAuthorizationFailure(failure);
        },
        handlePlexStreamError: (error): void => {
            input.events.handlePlexStreamError(error);
        },
        handleScreenChange: (payload): void => {
            input.events.handleScreenChange(payload);
        },
        handleLifecyclePause: (): Promise<void> =>
            playbackRuntimeController.handleLifecyclePause(),
        handleLifecycleResume: (): Promise<void> =>
            playbackRuntimeController.handleLifecycleResume(),
        reportPersistenceWarning: (warning): void => {
            input.events.reportPersistenceWarning(warning);
        },
    };
}

export function createOverlayRuntimePolicyController(
    input: PriorityOneAssemblyInput
): OverlayRuntimePolicyController {
    return new OverlayRuntimePolicyController(createOverlayRuntimePolicyDeps(input));
}

export function createPlaybackStartController(
    input: PriorityOneAssemblyInput
): PlaybackStartController {
    return new PlaybackStartController(createPlaybackStartDeps(input));
}

export function createPlaybackRuntimeController(
    input: PriorityOneAssemblyInput
): PlaybackRuntimeController {
    return new PlaybackRuntimeController(createPlaybackRuntimeDeps(input));
}

export function createProfileSwitchCleanupController(
    input: PriorityOneAssemblyInput
): ProfileSwitchCleanupController {
    return new ProfileSwitchCleanupController({
        schedulerRuntime: input.schedulerRuntime,
        playback: input.playback,
    });
}

export function createEventBinder(
    input: PriorityOneAssemblyInput,
    playbackStartController: PlaybackStartController,
    playbackRuntimeController: PlaybackRuntimeController
): OrchestratorEventBinder {
    return new OrchestratorEventBinder(
        createEventBinderDeps(
            input,
            playbackStartController,
            playbackRuntimeController
        )
    );
}
