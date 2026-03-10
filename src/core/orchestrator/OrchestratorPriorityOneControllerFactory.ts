import type { AppError, IAppLifecycle } from '../../modules/lifecycle';
import type { Screen, INavigationManager } from '../../modules/navigation';
import type {
    IVideoPlayer,
    PlaybackError,
    PlaybackState,
    TimeRange,
    StreamDescriptor,
} from '../../modules/player';
import type { IPlexLibrary } from '../../modules/plex/library';
import type {
    IPlexStreamResolver,
    StreamDecision,
    StreamResolverError,
} from '../../modules/plex/stream';
import type { IChannelManager } from '../../modules/scheduler/channel-manager';
import type {
    IChannelScheduler,
    ScheduledProgram,
} from '../../modules/scheduler/scheduler';
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

export interface OrchestratorPriorityOneControllerFactoryDeps {
    scheduler: IChannelScheduler;
    videoPlayer: IVideoPlayer;
    lifecycle: IAppLifecycle;
    playbackRecovery: {
        resolveStreamForProgram?: (program: ScheduledProgram) => Promise<StreamDescriptor | null | undefined>;
        resetPlaybackFailureGuard?: () => void;
        tryHandleStreamResolverAuthError?: (error: unknown) => boolean;
        tryHandleStreamResolverPermissionError?: (error: unknown) => boolean;
        handlePlaybackFailure?: (context: string, error: unknown) => void;
        isStreamRecoveryInProgress: () => boolean;
    };

    channelBadgeOverlay: { show: (input: { channelNumber: number; channelName: string }) => void; hide: () => void } | null;
    playerOsd: { isVisible: () => boolean } | null;
    nowPlayingInfo: { isVisible: () => boolean } | null;
    channelManager: IChannelManager | null;
    navigation: INavigationManager | null;

    currentProgramForPlayback: () => ScheduledProgram | null;
    setCurrentProgramForPlayback: (program: ScheduledProgram | null) => void;
    pendingNowPlayingChannelId: () => string | null;
    setPendingNowPlayingChannelId: (channelId: string | null) => void;
    shouldAutoShowInfoBannerOnNextPlay: () => boolean;
    setShouldAutoShowInfoBannerOnNextPlay: (value: boolean) => void;
    currentStreamDescriptor: () => StreamDescriptor | null;
    setCurrentStreamDescriptor: (stream: StreamDescriptor | null) => void;
    currentStreamDecision: () => StreamDecision | null;
    setCurrentStreamDecision: (decision: StreamDecision | null) => void;
    pendingDayRolloverTimer: () => ReturnType<typeof setTimeout> | null;
    setPendingDayRolloverTimer: (timer: ReturnType<typeof setTimeout> | null) => void;
    setPendingDayRolloverDayKey: (dayKey: number | null) => void;

    stopPlayback: () => void;
    unloadCurrentChannel: () => void;
    stopTranscodeSessionById: (sessionId: string) => void;
    skipToNextProgram: () => void;
    pausePlayer: () => void;
    playPlayer: () => Promise<void>;
    pauseSchedulerSync: () => void;
    resumeSchedulerSync: () => void;
    syncSchedulerToCurrentTime: () => void;
    handleGlobalError: (error: AppError, context: string) => void;
    onPlayerStateChange: (state: PlaybackState) => void;
    showInfoBanner: () => void;
    onPlayerTimeUpdate: (payload: { currentTimeMs: number; durationMs: number }) => void;
    onPlayerBufferUpdate: (payload: { percent: number; bufferedRanges: TimeRange[] }) => void;

    onProgramStartUiSideEffects: (program: ScheduledProgram) => void;
    onStreamResolved: (stream: StreamDescriptor) => void;
    onPlaybackStartFailure: (error: unknown) => void;

    plexLibrary: IPlexLibrary | null;
    plexStreamResolver: IPlexStreamResolver | null;
    wireNavigationCoordinatorEvents: () => Array<() => void>;
    wireEpgCoordinatorEvents: () => Array<() => void>;
    handleScheduleDayRollover: () => Promise<void>;
    handlePlayerTrackChange: (event: { type: 'audio' | 'subtitle'; trackId: string | null }) => void;
    handlePlexLibraryAuthExpired: () => void;
    handlePlexStreamError: (error: StreamResolverError) => void;
    handleScreenChange: (payload: { from: Screen; to: Screen }) => void;
    reportPersistenceWarning: (message: string) => void;

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
    const overlayRuntimePolicyController = new OverlayRuntimePolicyController({
        hasChannelBadgeOverlay: (): boolean => deps.channelBadgeOverlay !== null,
        getPlayerOsdVisible: (): boolean => deps.playerOsd?.isVisible() ?? false,
        getNowPlayingInfoVisible: (): boolean => deps.nowPlayingInfo?.isVisible() ?? false,
        getCurrentChannel: (): { number: number; name: string } | null => {
            const channel = deps.channelManager?.getCurrentChannel() ?? null;
            return channel
                ? {
                    number: channel.number,
                    name: channel.name,
                }
                : null;
        },
        showChannelBadge: (input): void => {
            deps.channelBadgeOverlay?.show(input);
        },
        hideChannelBadge: (): void => {
            deps.channelBadgeOverlay?.hide();
        },
        hasNavigation: (): boolean => deps.navigation !== null,
        hasNowPlayingInfoOverlay: (): boolean => deps.nowPlayingInfo !== null,
        getCurrentScreen: (): string | null => deps.navigation?.getCurrentScreen() ?? null,
        hasCurrentProgramForPlayback: (): boolean => deps.currentProgramForPlayback() !== null,
        isModalOpen: (modalId?: string): boolean => deps.navigation?.isModalOpen(modalId) ?? false,
        openModal: (modalId: string): void => {
            deps.navigation?.openModal(modalId);
        },
        closeModal: (modalId: string): void => {
            deps.navigation?.closeModal(modalId);
        },
        nowPlayingModalId: deps.nowPlayingModalId,
    });

    const playbackStartController = new PlaybackStartController({
        getVideoPlayer: (): IVideoPlayer | null => deps.videoPlayer,
        resolveStreamForProgram: (program): Promise<StreamDescriptor | null> =>
            deps.playbackRecovery.resolveStreamForProgram?.(program).then((stream) => stream ?? null) ?? Promise.resolve(null),
        resetPlaybackFailureGuard: (): void => {
            deps.playbackRecovery.resetPlaybackFailureGuard?.();
        },
        tryHandleStreamResolverAuthError: (error): boolean =>
            deps.playbackRecovery.tryHandleStreamResolverAuthError?.(error) ?? false,
        tryHandleStreamResolverPermissionError: (error): boolean =>
            deps.playbackRecovery.tryHandleStreamResolverPermissionError?.(error) ?? false,
        handlePlaybackFailure: (context, error): void => {
            deps.playbackRecovery.handlePlaybackFailure?.(context, error);
        },
        logPlaybackStartFailure: (error): void => {
            deps.onPlaybackStartFailure(error);
        },
        markProgramStarting: (program): {
            programAtStart: ScheduledProgram;
            shouldResetAutoShowInfoBannerOnAbort: boolean;
        } => {
            deps.setCurrentProgramForPlayback(program);
            const shouldResetAutoShowInfoBannerOnAbort =
                deps.pendingNowPlayingChannelId() !== null;

            if (shouldResetAutoShowInfoBannerOnAbort) {
                deps.setShouldAutoShowInfoBannerOnNextPlay(true);
                deps.setPendingNowPlayingChannelId(null);
            }

            return {
                programAtStart: program,
                shouldResetAutoShowInfoBannerOnAbort,
            };
        },
        isProgramStillCurrent: (program): boolean =>
            deps.currentProgramForPlayback() === program,
        handleProgramStartUiSideEffects: (program): void => {
            deps.onProgramStartUiSideEffects(program);
        },
        handleStreamResolved: (stream): void => {
            deps.setCurrentStreamDescriptor(stream);
            deps.onStreamResolved(stream);
        },
        clearAutoShowInfoBannerAfterAbortedStart: (): void => {
            deps.setShouldAutoShowInfoBannerOnNextPlay(false);
        },
    });

    const playbackRuntimeController = new PlaybackRuntimeController({
        isStreamRecoveryInProgress: (): boolean =>
            deps.playbackRecovery.isStreamRecoveryInProgress(),
        getActiveTranscodeSessionId: (): string | null => {
            const decision = deps.currentStreamDecision();
            if (!decision || !decision.isTranscoding || !decision.sessionId) {
                return null;
            }
            return decision.sessionId;
        },
        stopTranscodeSession: (sessionId): void => {
            deps.stopTranscodeSessionById(sessionId);
        },
        skipToNextProgram: (): void => {
            deps.skipToNextProgram();
        },
        pausePlayer: (): void => {
            deps.pausePlayer();
        },
        playPlayer: (): Promise<void> => deps.playPlayer(),
        pauseSchedulerSync: (): void => {
            deps.pauseSchedulerSync();
        },
        resumeSchedulerSync: (): void => {
            deps.resumeSchedulerSync();
        },
        syncSchedulerToCurrentTime: (): void => {
            deps.syncSchedulerToCurrentTime();
        },
        saveLifecycleState: (): Promise<void> => deps.lifecycle.saveState(),
        handleGlobalError: (error, context): void => {
            deps.handleGlobalError(error, context);
        },
        handlePlaybackFailure: (context, error): void => {
            deps.playbackRecovery.handlePlaybackFailure?.(context, error);
        },
        onPlayerStateChange: (state): void => {
            deps.onPlayerStateChange(state);
        },
        shouldAutoShowInfoBannerOnNextPlay: (): boolean =>
            deps.shouldAutoShowInfoBannerOnNextPlay(),
        clearAutoShowInfoBannerOnNextPlay: (): void => {
            deps.setShouldAutoShowInfoBannerOnNextPlay(false);
        },
        showInfoBanner: (): void => {
            deps.showInfoBanner();
        },
        onPlayerTimeUpdate: (payload): void => {
            deps.onPlayerTimeUpdate(payload);
        },
        onPlayerBufferUpdate: (payload): void => {
            deps.onPlayerBufferUpdate(payload);
        },
    });

    const profileSwitchCleanupController = new ProfileSwitchCleanupController({
        getPendingDayRolloverTimer: (): ReturnType<typeof setTimeout> | null =>
            deps.pendingDayRolloverTimer(),
        clearPendingDayRolloverTimer: (timer): void => {
            globalThis.clearTimeout(timer);
        },
        setPendingDayRolloverTimer: (timer): void => {
            deps.setPendingDayRolloverTimer(timer);
        },
        setPendingDayRolloverDayKey: (dayKey): void => {
            deps.setPendingDayRolloverDayKey(dayKey);
        },
        stopPlayback: (): void => {
            deps.stopPlayback();
        },
        unloadCurrentChannel: (): void => {
            deps.unloadCurrentChannel();
        },
        setPendingNowPlayingChannelId: (channelId): void => {
            deps.setPendingNowPlayingChannelId(channelId);
        },
        setShouldAutoShowInfoBannerOnNextPlay: (value): void => {
            deps.setShouldAutoShowInfoBannerOnNextPlay(value);
        },
        setCurrentProgramForPlayback: (program): void => {
            deps.setCurrentProgramForPlayback(program);
        },
        setCurrentStreamDescriptor: (stream): void => {
            deps.setCurrentStreamDescriptor(stream);
        },
        setCurrentStreamDecision: (decision): void => {
            deps.setCurrentStreamDecision(decision);
        },
    });

    const binderDeps: OrchestratorEventBinderDeps = {
        getScheduler: (): IChannelScheduler | null => deps.scheduler,
        getVideoPlayer: (): IVideoPlayer | null => deps.videoPlayer,
        getPlexLibrary: (): IPlexLibrary | null => deps.plexLibrary,
        getPlexStreamResolver: (): IPlexStreamResolver | null => deps.plexStreamResolver,
        getNavigation: (): INavigationManager | null => deps.navigation,
        getLifecycle: (): IAppLifecycle | null => deps.lifecycle,
        getChannelManager: (): IChannelManager | null => deps.channelManager,
        wireNavigationCoordinatorEvents: (): Array<() => void> => deps.wireNavigationCoordinatorEvents(),
        wireEpgCoordinatorEvents: (): Array<() => void> => deps.wireEpgCoordinatorEvents(),
        handleProgramStartTracked: (program): Promise<void> => {
            const promise = playbackStartController.handleProgramStart(program);
            return playbackRuntimeController.trackProgramStart(promise);
        },
        handleScheduleDayRollover: (): Promise<void> => deps.handleScheduleDayRollover(),
        handlePlayerEnded: (): void => {
            playbackRuntimeController.handlePlayerEnded();
        },
        handlePlayerTrackChange: (event): void => deps.handlePlayerTrackChange(event),
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
        handlePlexLibraryAuthExpired: (): void => deps.handlePlexLibraryAuthExpired(),
        handlePlexStreamError: (error): void => deps.handlePlexStreamError(error),
        handleScreenChange: (payload): void => deps.handleScreenChange(payload),
        handleLifecyclePause: (): Promise<void> => playbackRuntimeController.handleLifecyclePause(),
        handleLifecycleResume: (): Promise<void> => playbackRuntimeController.handleLifecycleResume(),
        reportPersistenceWarning: (message): void => {
            deps.reportPersistenceWarning(message);
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
