import type { AppError } from '../../../modules/lifecycle';
import type { IVideoPlayer, StreamDescriptor } from '../../../modules/player';
import { PlaybackRecoveryManager } from '../../../modules/player/PlaybackRecoveryManager';
import type { IPlexAuth } from '../../../modules/plex/auth';
import type { IPlexServerDiscovery } from '../../../modules/plex/discovery';
import type { IPlexStreamResolver, StreamDecision } from '../../../modules/plex/stream';
import type { ChannelConfig, IChannelManager, ResolvedChannelContent } from '../../../modules/scheduler/channel-manager';
import type { IChannelScheduler, ScheduledProgram, ScheduleConfig } from '../../../modules/scheduler/scheduler';
import type { IChannelTransitionOverlay } from '../../../modules/ui/channel-transition';
import { ChannelTransitionCoordinator } from '../../../modules/ui/channel-transition';
import { PLAYBACK_OPTIONS_MODAL_ID, PlaybackOptionsCoordinator, type IPlaybackOptionsModal, type PlaybackOptionsSectionId } from '../../../modules/ui/playback-options';
import type { IPlayerOsdOverlay } from '../../../modules/ui/player-osd';
import { PlayerOsdCoordinator } from '../../../modules/ui/player-osd';
import type { ToastInput } from '../../../shared/toast';
import { ChannelTuningCoordinator } from '../../channel-tuning';
import type {
    OrchestratorChannelTransitionCoordinatorBuilderInput,
    OrchestratorChannelTuningBuilderInput,
    OrchestratorCoordinatorAssemblyInput,
    OrchestratorPlaybackOptionsCoordinatorBuilderInput,
    OrchestratorPlaybackRecoveryBuilderInput,
    OrchestratorPlayerOsdCoordinatorBuilderInput,
} from './OrchestratorCoordinatorContracts';

function notifyPlaybackRecoverySubtitleUnavailable(input: OrchestratorPlaybackRecoveryBuilderInput): void {
    input.nowPlaying.handler()?.({ message: 'Subtitles unavailable for this item', type: 'warning' });
}

function notifyPlaybackToast(
    input: Pick<OrchestratorCoordinatorAssemblyInput, 'nowPlaying'>,
    toast: ToastInput
): void {
    const handler = input.nowPlaying.handler();
    if (!handler) {
        return;
    }
    handler(toast);
}

function handleCoordinatorGlobalError(
    input: Pick<OrchestratorCoordinatorAssemblyInput, 'errors'>,
    error: AppError,
    context: string
): void {
    input.errors.handleGlobalError(error, context);
}

function resetChannelTuningPlaybackGuards(playbackRecovery: PlaybackRecoveryManager): void {
    playbackRecovery.resetPlaybackFailureGuard();
    playbackRecovery.resetDirectFallbackAndBurnInAttempts();
}

function armChannelTransitionForSwitch(
    channelTransitionCoordinator: ChannelTransitionCoordinator,
    prefix: string
): void {
    channelTransitionCoordinator.armForChannelSwitch(prefix);
}

export function buildPlaybackRecoveryInput(
    input: OrchestratorCoordinatorAssemblyInput
): OrchestratorPlaybackRecoveryBuilderInput {
    return {
        modules: {
            videoPlayer: input.modules.videoPlayer,
            plexStreamResolver: input.modules.plexStreamResolver,
            scheduler: input.modules.scheduler,
            plexAuth: input.modules.plexAuth,
            plexDiscovery: input.modules.plexDiscovery,
        },
        stores: {
            subtitlePreferencesStore: input.stores.subtitlePreferencesStore,
        },
        diagnostics: {
            appendIssueDiagnostic: input.diagnostics.appendIssueDiagnostic,
        },
        playback: {
            state: input.playback.state,
            buildPlexResourceUrl: input.playback.buildPlexResourceUrl,
            getMimeType: input.playback.getMimeType,
        },
        errors: input.errors,
        nowPlaying: input.nowPlaying,
    };
}

export function buildChannelTuningInput(
    input: OrchestratorCoordinatorAssemblyInput
): OrchestratorChannelTuningBuilderInput {
    return {
        modules: {
            channelManager: input.modules.channelManager,
            scheduler: input.modules.scheduler,
            videoPlayer: input.modules.videoPlayer,
            lifecycle: input.modules.lifecycle,
        },
        diagnostics: {
            appendIssueDiagnostic: input.diagnostics.appendIssueDiagnostic,
        },
        playback: {
            state: input.playback.state,
            stopActiveTranscodeSession: input.playback.stopActiveTranscodeSession,
        },
        schedule: {
            buildDailyScheduleConfig: input.schedule.buildDailyScheduleConfig,
            getLocalDayKey: input.schedule.getLocalDayKey,
            setActiveScheduleDayKey: input.schedule.setActiveScheduleDayKey,
        },
        errors: input.errors,
    };
}

export function buildPlayerOsdCoordinatorInput(
    input: OrchestratorCoordinatorAssemblyInput
): OrchestratorPlayerOsdCoordinatorBuilderInput {
    return {
        config: input.config,
        modules: {
            navigation: input.modules.navigation,
            scheduler: input.modules.scheduler,
            channelManager: input.modules.channelManager,
            videoPlayer: input.modules.videoPlayer,
        },
        overlays: {
            playerOsd: input.overlays.playerOsd,
            sleepTimer: input.overlays.sleepTimer,
        },
        stores: {
            nowPlayingDisplayStore: input.stores.nowPlayingDisplayStore,
        },
        playback: {
            state: input.playback.state,
            buildPlexResourceUrl: input.playback.buildPlexResourceUrl,
        },
        actions: {
            onOverlayVisibilityChange: input.actions.onOverlayVisibilityChange,
        },
    };
}

export function buildChannelTransitionCoordinatorInput(
    input: OrchestratorCoordinatorAssemblyInput
): OrchestratorChannelTransitionCoordinatorBuilderInput {
    return {
        modules: {
            navigation: input.modules.navigation,
            videoPlayer: input.modules.videoPlayer,
        },
        overlays: {
            channelTransitionOverlay: input.overlays.channelTransitionOverlay,
        },
        actions: {
            onChannelTransitionActivityChange: input.actions.onChannelTransitionActivityChange,
        },
    };
}

export function buildPlaybackOptionsCoordinatorInput(
    input: OrchestratorCoordinatorAssemblyInput
): OrchestratorPlaybackOptionsCoordinatorBuilderInput {
    return {
        modules: {
            navigation: input.modules.navigation,
            videoPlayer: input.modules.videoPlayer,
            scheduler: input.modules.scheduler,
        },
        overlays: {
            playbackOptionsModal: input.overlays.playbackOptionsModal,
        },
        stores: {
            subtitlePreferencesStore: input.stores.subtitlePreferencesStore,
        },
        playback: {
            state: input.playback.state,
        },
        nowPlaying: input.nowPlaying,
    };
}

export function buildPlayerOsdCoordinator(
    input: OrchestratorPlayerOsdCoordinatorBuilderInput,
    preparePlaybackOptionsModal: (
        preferredSection?: PlaybackOptionsSectionId
    ) => { focusableIds: string[]; preferredFocusId: string | null }
): PlayerOsdCoordinator {
    return new PlayerOsdCoordinator({
        getOverlay: (): IPlayerOsdOverlay | null => input.overlays.playerOsd,
        getCurrentProgram: (): ScheduledProgram | null =>
            input.modules.scheduler.getCurrentProgram() ?? input.playback.state.getCurrentProgramForPlayback(),
        getNextProgram: (): ScheduledProgram | null => input.modules.scheduler.getNextProgram() ?? null,
        getCurrentChannel: (): ChannelConfig | null =>
            input.modules.channelManager.getCurrentChannel() ?? null,
        getVideoPlayer: (): IVideoPlayer | null => input.modules.videoPlayer,
        getAutoHideMs: (): number =>
            input.config?.playerConfig?.hideControlsAfterMs ?? 3000,
        getNavigation: (): import('../../../modules/navigation').INavigationManager | null => input.modules.navigation,
        buildPlexResourceUrl: (pathOrUrl: string): string | null =>
            input.playback.buildPlexResourceUrl(pathOrUrl),
        cycleSleepTimerPreset: (): number => input.overlays.sleepTimer.cyclePreset(),
        getSleepTimerRemainingMs: (): number => input.overlays.sleepTimer.getRemainingMs(),
        nowPlayingDisplayStore: input.stores.nowPlayingDisplayStore,
        playbackOptionsModalId: PLAYBACK_OPTIONS_MODAL_ID,
        preparePlaybackOptionsModal,
        onVisibilityChange: (visible: boolean): void => {
            input.actions.onOverlayVisibilityChange(visible);
        },
    });
}

export function buildChannelTransitionCoordinator(
    input: OrchestratorChannelTransitionCoordinatorBuilderInput
): ChannelTransitionCoordinator {
    return new ChannelTransitionCoordinator({
        getOverlay: (): IChannelTransitionOverlay | null => input.overlays.channelTransitionOverlay,
        getNavigation: (): import('../../../modules/navigation').INavigationManager | null => input.modules.navigation,
        getVideoPlayer: (): IVideoPlayer | null => input.modules.videoPlayer,
        onActivityChange: (active: boolean): void => {
            input.actions.onChannelTransitionActivityChange(active);
        },
    });
}

export function buildPlaybackRecovery(
    input: OrchestratorPlaybackRecoveryBuilderInput
): PlaybackRecoveryManager {
    return new PlaybackRecoveryManager({
        getVideoPlayer: (): IVideoPlayer | null => input.modules.videoPlayer,
        getStreamResolver: (): IPlexStreamResolver | null => input.modules.plexStreamResolver,
        getScheduler: (): IChannelScheduler | null => input.modules.scheduler,
        getCurrentProgramForPlayback: (): ScheduledProgram | null =>
            input.playback.state.getCurrentProgramForPlayback(),
        getCurrentStreamDescriptor: (): StreamDescriptor | null =>
            input.playback.state.getCurrentStreamDescriptor(),
        getCurrentStreamDecision: (): StreamDecision | null =>
            input.playback.state.getCurrentStreamDecision(),
        setCurrentStreamDecision: (decision: StreamDecision | null): void => {
            input.playback.state.setCurrentStreamDecision(decision);
        },
        setCurrentStreamDescriptor: (descriptor: StreamDescriptor | null): void => {
            input.playback.state.setCurrentStreamDescriptor(descriptor);
        },
        buildPlexResourceUrl: (pathOrUrl: string): string | null =>
            input.playback.buildPlexResourceUrl(pathOrUrl),
        getMimeType: (decision: StreamDecision): string => input.playback.getMimeType(decision),
        getAuthHeaders: (): Record<string, string> => (input.modules.plexAuth as IPlexAuth).getAuthHeaders(),
        getServerUri: (): string | null => (input.modules.plexDiscovery as IPlexServerDiscovery).getServerUri() ?? null,
        getPreferredSubtitleLanguage: (): string | null =>
            input.stores.subtitlePreferencesStore.readSubtitleLanguageAndClean(),
        getPlexPreferredSubtitleLanguage: (): string | null =>
            input.modules.plexAuth.getCurrentUser()?.preferredSubtitleLanguage ?? null,
        notifySubtitleUnavailable: (): void => notifyPlaybackRecoverySubtitleUnavailable(input),
        notifyToast: (toast: ToastInput): void => notifyPlaybackToast(input, toast),
        subtitlePreferencesStore: input.stores.subtitlePreferencesStore,
        appendIssueDiagnostic: input.diagnostics.appendIssueDiagnostic,
        handleGlobalError: (error: AppError, context: string): void =>
            handleCoordinatorGlobalError(input, error, context),
    });
}

export function buildPlaybackOptionsCoordinator(
    input: OrchestratorPlaybackOptionsCoordinatorBuilderInput,
    playbackRecovery: PlaybackRecoveryManager
): PlaybackOptionsCoordinator {
    return new PlaybackOptionsCoordinator({
        playbackOptionsModalId: PLAYBACK_OPTIONS_MODAL_ID,
        getNavigation: (): import('../../../modules/navigation').INavigationManager | null => input.modules.navigation,
        getPlaybackOptionsModal: (): IPlaybackOptionsModal | null => input.overlays.playbackOptionsModal,
        getVideoPlayer: (): IVideoPlayer | null => input.modules.videoPlayer,
        getCurrentStreamDescriptor: (): StreamDescriptor | null =>
            input.playback.state.getCurrentStreamDescriptor(),
        getCurrentProgram: (): ScheduledProgram | null =>
            input.modules.scheduler.getCurrentProgram() ?? input.playback.state.getCurrentProgramForPlayback(),
        requestBurnInSubtitle: (trackId: string, reason: string) =>
            playbackRecovery.attemptBurnInSubtitleForCurrentProgram(trackId, reason),
        notifyToast: (toast: ToastInput): void => notifyPlaybackToast(input, toast),
        subtitlePreferencesStore: input.stores.subtitlePreferencesStore,
    });
}

export function buildChannelTuningCoordinator(
    input: OrchestratorChannelTuningBuilderInput,
    playbackRecovery: PlaybackRecoveryManager,
    channelTransitionCoordinator: ChannelTransitionCoordinator
): ChannelTuningCoordinator {
    return new ChannelTuningCoordinator({
        getChannelManager: (): IChannelManager | null => input.modules.channelManager,
        getScheduler: (): IChannelScheduler | null => input.modules.scheduler,
        getVideoPlayer: (): IVideoPlayer | null => input.modules.videoPlayer,
        buildDailyScheduleConfig: (
            channel: ChannelConfig,
            items: ResolvedChannelContent['items'],
            referenceTimeMs: number
        ): ScheduleConfig => input.schedule.buildDailyScheduleConfig(channel, items, referenceTimeMs),
        getLocalDayKey: (timeMs: number): number => input.schedule.getLocalDayKey(timeMs),
        setActiveScheduleDayKey: (dayKey: number): void => {
            input.schedule.setActiveScheduleDayKey(dayKey);
        },
        setPendingNowPlayingChannelId: (channelId: string | null): void => {
            input.playback.state.setPendingNowPlayingChannelId(channelId);
        },
        getPendingNowPlayingChannelId: (): string | null =>
            input.playback.state.getPendingNowPlayingChannelId(),
        resetPlaybackGuardsForNewChannel: (): void => {
            resetChannelTuningPlaybackGuards(playbackRecovery);
        },
        stopActiveTranscodeSession: (): void => {
            input.playback.stopActiveTranscodeSession();
        },
        armChannelTransitionForSwitch: (prefix: string): void => {
            armChannelTransitionForSwitch(channelTransitionCoordinator, prefix);
        },
        appendIssueDiagnostic: input.diagnostics.appendIssueDiagnostic,
        handleGlobalError: (error: AppError, context: string): void =>
            handleCoordinatorGlobalError(input, error, context),
        saveLifecycleState: (): Promise<void> => input.modules.lifecycle.saveState(),
    });
}
