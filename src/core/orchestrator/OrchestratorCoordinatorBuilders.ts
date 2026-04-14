import {
    CHANNEL_INPUT_CONFIG,
    type INavigationManager,
} from '../../modules/navigation';
import {
    NavigationCoordinator,
    type NavigationCoordinatorDeps,
} from '../../modules/navigation/NavigationCoordinator';
import type { PlaybackOptionsSectionId } from '../../modules/ui/playback-options/types';
import type { ChannelSwitchOutcome } from '../../types/channelSwitch';
import type { AppError } from '../../modules/lifecycle';
import type { IPlexLibrary } from '../../modules/plex/library';
import type {
    IPlexStreamResolver,
    StreamDecision,
} from '../../modules/plex/stream';
import type {
    IChannelManager,
    ChannelConfig,
    ResolvedChannelContent,
} from '../../modules/scheduler/channel-manager';
import type {
    IChannelScheduler,
    ScheduledProgram,
    ScheduleConfig,
} from '../../modules/scheduler/scheduler';
import type {
    IVideoPlayer,
    StreamDescriptor,
} from '../../modules/player';
import { PlaybackRecoveryManager } from '../../modules/player/PlaybackRecoveryManager';
import {
    EPGCoordinator,
    IEPGComponent,
    EPGConfig,
    EPGUiStatus,
    withEpgVisibleRangeChangeBinding,
} from '../../modules/ui/epg';
import {
    NowPlayingInfoCoordinator,
    getNowPlayingInfoAutoHideMs,
    NOW_PLAYING_INFO_MODAL_ID,
    type INowPlayingInfoOverlay,
    type NowPlayingInfoConfig,
} from '../../modules/ui/now-playing-info';
import type { PlaybackInfoSnapshotLike } from '../../utils/playbackSummary';
import type {
    IPlayerOsdOverlay,
} from '../../modules/ui/player-osd';
import { PlayerOsdCoordinator } from '../../modules/ui/player-osd';
import type {
    IMiniGuideOverlay,
} from '../../modules/ui/mini-guide';
import { MiniGuideCoordinator } from '../../modules/ui/mini-guide';
import type {
    IChannelTransitionOverlay,
} from '../../modules/ui/channel-transition';
import { ChannelTransitionCoordinator } from '../../modules/ui/channel-transition';
import {
    PLAYBACK_OPTIONS_MODAL_ID,
    type IPlaybackOptionsModal,
} from '../../modules/ui/playback-options';
import { PlaybackOptionsCoordinator } from '../../modules/ui/playback-options/PlaybackOptionsCoordinator';
import {
    ExitConfirmCoordinator,
    ExitConfirmModal,
    EXIT_CONFIRM_FOCUSABLE_IDS,
    EXIT_CONFIRM_MODAL_ID,
} from '../../modules/ui/exit-confirm';
import {
    ChannelSetupBuildCommitter,
    ChannelSetupBuildScratchStore,
    ChannelSetupBuildExecutor,
    ChannelSetupCompletionTracker,
    ChannelSetupCoordinator,
    ChannelSetupPlanningService,
    ChannelSetupRecordStore,
    ChannelSetupWorkflow,
} from '../channel-setup';
import { ChannelTuningCoordinator } from '../channel-tuning';
import type { GuideSelectionSnapshot } from '../channel-tuning';
import type { OrchestratorCoordinatorBuilderInput } from './OrchestratorCoordinatorContracts';
import { NowPlayingDebugManager } from '../../modules/debug/NowPlayingDebugManager';
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from '../../utils/storage';

export function buildEpgCoordinator(input: OrchestratorCoordinatorBuilderInput): EPGCoordinator {
    return new EPGCoordinator({
        getEpg: (): IEPGComponent | null => input.modules.epg,
        getChannelManager: (): IChannelManager | null => input.modules.channelManager,
        getScheduler: (): IChannelScheduler | null => input.modules.scheduler,
        getEpgUiStatus: (): EPGUiStatus => input.moduleStatus.get('epg-ui')?.status,
        ensureEpgInitialized: (): Promise<void> => input.init.ensureEpgInitialized(),
        getEpgConfig: (): EPGConfig | null => input.config?.epgConfig ?? null,
        getLocalMidnightMs: (t: number): number => input.schedule.getLocalMidnightMs(t),
        debugRuntime: input.epgDebugRuntime,
        buildDailyScheduleConfig: (
            channel: ChannelConfig,
            items: ResolvedChannelContent['items'],
            referenceTimeMs: number
        ): ScheduleConfig => input.schedule.buildDailyScheduleConfig(channel, items, referenceTimeMs),
        getPreserveFocusOnOpen: (): boolean => input.schedule.lastChannelChangeSource() === 'guide',
        setLastChannelChangeSourceToGuide: (): void => {
            input.schedule.setLastChannelChangeSource('guide');
        },
        switchToChannel: (
            channelId: string,
            options?: { guideSelectionSnapshot?: GuideSelectionSnapshot }
        ): Promise<void> => input.actions.switchToChannel(channelId, options),
        onVisibilityChange: (visible: boolean): void => {
            input.actions.onOverlayVisibilityChange(visible);
        },
        reportEpgInitWarning: (_error: unknown): void => {
            input.nowPlaying.handler()?.({
                message: 'Guide unavailable right now. Try again.',
                type: 'warning',
            });
        },
        epgPreferencesStore: input.stores.epgPreferencesStore,
        appendIssueDiagnostic: input.diagnostics.appendIssueDiagnostic,
    });
}

export function bindEpgVisibleRangeChange(
    input: OrchestratorCoordinatorBuilderInput,
    epgCoordinator: EPGCoordinator
): void {
    if (!input.config?.epgConfig) {
        return;
    }
    input.config.epgConfig =
        withEpgVisibleRangeChangeBinding(
            input.config.epgConfig,
            (range) => epgCoordinator.handleVisibleRangeChange(range)
        ) ?? input.config.epgConfig;
}

export interface ChannelSetupOwners {
    coordinator: ChannelSetupCoordinator;
    workflow: ChannelSetupWorkflow;
}

export function buildChannelSetupOwners(
    input: OrchestratorCoordinatorBuilderInput,
    epgCoordinator: EPGCoordinator
): ChannelSetupOwners {
    const recordStore = new ChannelSetupRecordStore({
        storageGet: (key: string): string | null => safeLocalStorageGet(key),
        storageSet: (key: string, value: string): void => {
            safeLocalStorageSet(key, value);
        },
        storageRemove: (key: string): void => {
            safeLocalStorageRemove(key);
        },
    });
    const buildScratchStore = new ChannelSetupBuildScratchStore({
        storageRemove: (key: string): void => {
            safeLocalStorageRemove(key);
        },
    });
    const planningService = new ChannelSetupPlanningService({
        plexLibrary: input.modules.plexLibrary,
        channelManager: input.modules.channelManager,
    });
    const buildCommitter = new ChannelSetupBuildCommitter({
        plexLibrary: input.modules.plexLibrary,
        channelManager: input.modules.channelManager,
        scratchStore: buildScratchStore,
        ensureEpgInitialized: (): Promise<void> => input.init.ensureEpgInitialized(),
        clearSelectedChannelScheduleSnapshot: (): void => epgCoordinator.clearSelectedChannelScheduleSnapshot(),
        primeEpgChannels: (): void => epgCoordinator.primeEpgChannels(),
        refreshEpgSchedules: (options?: { reason?: string; debounceMs?: number }): Promise<void> =>
            epgCoordinator.refreshEpgSchedules(options),
    });
    const buildExecutor = new ChannelSetupBuildExecutor({
        channelManager: input.modules.channelManager,
        planningService,
        buildCommitter,
    });
    const coordinator = new ChannelSetupCoordinator({
        recordStore,
        scratchStore: buildScratchStore,
        navigation: input.modules.navigation,
        getSelectedServerId: (): string | null => input.schedule.getSelectedServerId(),
        getExistingChannelCount: (): number => input.modules.channelManager.getAllChannels().length,
    });
    const completionTracker = new ChannelSetupCompletionTracker({
        recordStore,
        clearRerunRequest: (): void => coordinator.clearRerunRequest(),
    });
    const workflow = new ChannelSetupWorkflow({
        planningService,
        buildExecutor,
        recordStore,
        completionTracker,
        getSelectedServerId: (): string | null => input.schedule.getSelectedServerId(),
        getExistingChannelCount: (): number => input.modules.channelManager.getAllChannels().length,
    });

    return {
        coordinator,
        workflow,
    };
}

export function buildNowPlayingDebugManager(
    input: OrchestratorCoordinatorBuilderInput,
    requestNowPlayingOverlayRefresh: () => void
): NowPlayingDebugManager {
    return new NowPlayingDebugManager({
        nowPlayingModalId: NOW_PLAYING_INFO_MODAL_ID,
        getNavigation: (): INavigationManager | null => input.modules.navigation,
        getStreamResolver: (): IPlexStreamResolver | null => input.modules.plexStreamResolver,
        getNowPlayingInfo: (): INowPlayingInfoOverlay | null => input.overlays.nowPlayingInfo,
        getCurrentProgram: (): ScheduledProgram | null =>
            input.modules.scheduler.getCurrentProgram() ?? input.playback.state.getCurrentProgramForPlayback(),
        getCurrentStreamDecision: (): StreamDecision | null => input.playback.state.getCurrentStreamDecision(),
        debugOverridesStore: input.stores.debugOverridesStore,
        requestNowPlayingOverlayRefresh,
    });
}

export function buildNowPlayingInfoCoordinator(
    input: OrchestratorCoordinatorBuilderInput,
    nowPlayingDebugManager: NowPlayingDebugManager
): NowPlayingInfoCoordinator {
    return new NowPlayingInfoCoordinator({
        nowPlayingModalId: NOW_PLAYING_INFO_MODAL_ID,
        getNavigation: (): INavigationManager | null => input.modules.navigation,
        getScheduler: (): IChannelScheduler | null => input.modules.scheduler,
        getChannelManager: (): IChannelManager | null => input.modules.channelManager,
        getPlexLibrary: (): IPlexLibrary | null => input.modules.plexLibrary,
        getNowPlayingInfo: (): INowPlayingInfoOverlay | null => input.overlays.nowPlayingInfo,
        getNowPlayingInfoConfig: (): NowPlayingInfoConfig | null =>
            input.config?.nowPlayingInfoConfig ?? null,
        buildPlexResourceUrl: (pathOrUrl: string): string | null =>
            input.playback.buildPlexResourceUrl(pathOrUrl),
        buildDebugText: (): string | null =>
            nowPlayingDebugManager.buildNowPlayingStreamDebugText() ?? null,
        maybeFetchStreamDecisionForDebugHud: (): Promise<void> =>
            nowPlayingDebugManager.maybeFetchNowPlayingStreamDecisionForDebugHud() ??
            Promise.resolve(),
        getAutoHideMs: (): number =>
            getNowPlayingInfoAutoHideMs(input.config?.nowPlayingInfoConfig, input.stores.nowPlayingDisplayStore),
        getCurrentProgramForPlayback: (): ScheduledProgram | null =>
            input.playback.state.getCurrentProgramForPlayback(),
        getPlaybackInfoSnapshot: (): PlaybackInfoSnapshotLike | null => input.playback.getPlaybackInfoSnapshot(),
        refreshPlaybackInfoSnapshot: (): Promise<PlaybackInfoSnapshotLike> =>
            input.playback.refreshPlaybackInfoSnapshot(),
        onVisibilityChange: (visible: boolean): void => {
            input.actions.onOverlayVisibilityChange(visible);
        },
        nowPlayingDisplayStore: input.stores.nowPlayingDisplayStore,
    });
}

export function buildPlayerOsdCoordinator(
    input: OrchestratorCoordinatorBuilderInput,
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
            input.config?.playerConfig.hideControlsAfterMs ?? 3000,
        getNavigation: (): INavigationManager | null => input.modules.navigation,
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

export function buildMiniGuideCoordinator(input: OrchestratorCoordinatorBuilderInput): MiniGuideCoordinator {
    return new MiniGuideCoordinator({
        getOverlay: (): IMiniGuideOverlay | null => input.overlays.miniGuide,
        getChannelManager: (): IChannelManager | null => input.modules.channelManager,
        getScheduler: (): IChannelScheduler | null => input.modules.scheduler,
        buildDailyScheduleConfig: (
            channel: ChannelConfig,
            items: ResolvedChannelContent['items'],
            referenceTimeMs: number
        ): ScheduleConfig => input.schedule.buildDailyScheduleConfig(channel, items, referenceTimeMs),
        switchToChannel: (channelId: string): Promise<void> => input.actions.switchToChannel(channelId),
        getAutoHideMs: (): number => {
            const configured = input.config?.miniGuideConfig?.autoHideMs;
            if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) {
                return Math.max(1000, Math.floor(configured));
            }
            return 8_000;
        },
    });
}

export function buildChannelTransitionCoordinator(
    input: OrchestratorCoordinatorBuilderInput
): ChannelTransitionCoordinator {
    return new ChannelTransitionCoordinator({
        getOverlay: (): IChannelTransitionOverlay | null => input.overlays.channelTransitionOverlay,
        getNavigation: (): INavigationManager | null => input.modules.navigation,
        getVideoPlayer: (): IVideoPlayer | null => input.modules.videoPlayer,
    });
}

export function buildPlaybackRecovery(
    input: OrchestratorCoordinatorBuilderInput
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
        setCurrentStreamDecision: (decision: StreamDecision): void => {
            input.playback.state.setCurrentStreamDecision(decision);
        },
        setCurrentStreamDescriptor: (descriptor: StreamDescriptor): void => {
            input.playback.state.setCurrentStreamDescriptor(descriptor);
        },
        buildPlexResourceUrl: (pathOrUrl: string): string | null =>
            input.playback.buildPlexResourceUrl(pathOrUrl),
        getMimeType: (decision: StreamDecision): string => input.playback.getMimeType(decision),
        getAuthHeaders: (): Record<string, string> =>
            input.modules.plexAuth.getAuthHeaders(),
        getServerUri: (): string | null =>
            input.modules.plexDiscovery.getServerUri() ?? null,
        getPreferredSubtitleLanguage: (): string | null =>
            input.stores.subtitlePreferencesStore.readSubtitleLanguage(),
        getPlexPreferredSubtitleLanguage: (): string | null =>
            input.modules.plexAuth.getCurrentUser()?.preferredSubtitleLanguage ?? null,
        notifySubtitleUnavailable: (): void => {
            input.nowPlaying.handler()?.({ message: 'Subtitles unavailable for this item', type: 'warning' });
        },
        notifyToast: (message, type): void => {
            const handler = input.nowPlaying.handler();
            if (!handler) return;
            handler(type ? { message, type } : message);
        },
        subtitlePreferencesStore: input.stores.subtitlePreferencesStore,
        appendIssueDiagnostic: input.diagnostics.appendIssueDiagnostic,
        handleGlobalError: (error: AppError, context: string): void =>
            input.errors.handleGlobalError(error, context),
    });
}

export function buildPlaybackOptionsCoordinator(
    input: OrchestratorCoordinatorBuilderInput,
    playbackRecovery: PlaybackRecoveryManager
): PlaybackOptionsCoordinator {
    return new PlaybackOptionsCoordinator({
        playbackOptionsModalId: PLAYBACK_OPTIONS_MODAL_ID,
        getNavigation: (): INavigationManager | null => input.modules.navigation,
        getPlaybackOptionsModal: (): IPlaybackOptionsModal | null => input.overlays.playbackOptionsModal,
        getVideoPlayer: (): IVideoPlayer | null => input.modules.videoPlayer,
        getCurrentStreamDescriptor: (): StreamDescriptor | null =>
            input.playback.state.getCurrentStreamDescriptor(),
        getCurrentProgram: (): ScheduledProgram | null =>
            input.modules.scheduler.getCurrentProgram() ?? input.playback.state.getCurrentProgramForPlayback(),
        requestBurnInSubtitle: (trackId: string, reason: string): Promise<boolean> =>
            playbackRecovery.attemptBurnInSubtitleForCurrentProgram(trackId, reason),
        notifyToast: (message, type): void => {
            const handler = input.nowPlaying.handler();
            if (!handler) return;
            handler(type ? { message, type } : message);
        },
        subtitlePreferencesStore: input.stores.subtitlePreferencesStore,
    });
}

export function buildExitConfirmCoordinator(
    input: OrchestratorCoordinatorBuilderInput
): ExitConfirmCoordinator {
    return new ExitConfirmCoordinator({
        getNavigation: (): INavigationManager | null => input.modules.navigation,
        getModal: (): ExitConfirmModal | null => input.overlays.exitConfirmModal,
    });
}

type NavigationCoordinatorBuilderDeps = {
    epgCoordinator: EPGCoordinator;
    channelSetup: ChannelSetupCoordinator;
    nowPlayingInfoCoordinator: NowPlayingInfoCoordinator;
    playerOsdCoordinator: PlayerOsdCoordinator;
    miniGuideCoordinator: MiniGuideCoordinator;
    channelTransitionCoordinator: ChannelTransitionCoordinator;
    playbackOptionsCoordinator: PlaybackOptionsCoordinator;
    exitConfirmCoordinator: ExitConfirmCoordinator;
};

function buildNavigationPlaybackConfig(
    input: OrchestratorCoordinatorBuilderInput,
    deps: NavigationCoordinatorBuilderDeps
): NavigationCoordinatorDeps['playback'] {
    return {
        videoPlayer: input.modules.videoPlayer,
        plexAuth: input.modules.plexAuth,
        stopPlayback: (): void => input.playback.stopPlayback(),
        getSeekIncrementMs: (): number => (input.config?.playerConfig.seekIncrementSec ?? 10) * 1000,
        playerOsd: {
            overlay: input.overlays.playerOsd,
            coordinator: deps.playerOsdCoordinator,
        },
    };
}

function buildNavigationMiniGuideConfig(
    input: OrchestratorCoordinatorBuilderInput,
    deps: NavigationCoordinatorBuilderDeps
): NavigationCoordinatorDeps['miniGuide'] {
    return {
        overlay: input.overlays.miniGuide,
        coordinator: {
            show: (): void => deps.miniGuideCoordinator.show(),
            hide: (): void => deps.miniGuideCoordinator.hide(),
            handleNavigation: (direction: 'up' | 'down'): boolean =>
                deps.miniGuideCoordinator.handleNavigation(direction),
            handlePage: (direction: 'up' | 'down'): boolean =>
                deps.miniGuideCoordinator.handlePage(direction),
            handleSelect: (): void => {
                input.schedule.setLastChannelChangeSource('remote');
                deps.miniGuideCoordinator.handleSelect();
            },
        },
    };
}

function buildNavigationNowPlayingInfoConfig(
    input: OrchestratorCoordinatorBuilderInput,
    deps: NavigationCoordinatorBuilderDeps
): NavigationCoordinatorDeps['nowPlayingInfo'] {
    return {
        isModalOpen: (): boolean => {
            const isOpen = input.modules.navigation.isModalOpen(NOW_PLAYING_INFO_MODAL_ID);
            if (isOpen) {
                input.overlays.nowPlayingInfo.resetAutoHideTimer();
            }
            return isOpen;
        },
        toggleOverlay: (): void => input.actions.toggleNowPlayingInfoOverlay(),
        showOverlay: (): void => deps.nowPlayingInfoCoordinator.handleModalOpen(NOW_PLAYING_INFO_MODAL_ID),
        hideOverlay: (): void => deps.nowPlayingInfoCoordinator.handleModalClose(NOW_PLAYING_INFO_MODAL_ID),
    };
}

function buildNavigationModalsConfig(
    deps: NavigationCoordinatorBuilderDeps
): NavigationCoordinatorDeps['modals'] {
    return {
        playbackOptions: {
            modalId: PLAYBACK_OPTIONS_MODAL_ID,
            prepare: (
                preferredSection?: PlaybackOptionsSectionId
            ): { focusableIds: string[]; preferredFocusId: string | null } =>
                deps.playbackOptionsCoordinator.prepareModal(preferredSection) ??
                { focusableIds: [], preferredFocusId: null },
            show: (): void => deps.playbackOptionsCoordinator.handleModalOpen(PLAYBACK_OPTIONS_MODAL_ID),
            hide: (): void => deps.playbackOptionsCoordinator.handleModalClose(PLAYBACK_OPTIONS_MODAL_ID),
        },
        exitConfirm: {
            modalId: EXIT_CONFIRM_MODAL_ID,
            prepare: (): { focusableIds: string[] } => ({
                focusableIds: [...EXIT_CONFIRM_FOCUSABLE_IDS],
            }),
            show: (): void => deps.exitConfirmCoordinator.handleModalOpen(EXIT_CONFIRM_MODAL_ID),
            hide: (): void => deps.exitConfirmCoordinator.handleModalClose(EXIT_CONFIRM_MODAL_ID),
        },
    };
}

function buildNavigationChannelSwitchingConfig(
    input: OrchestratorCoordinatorBuilderInput,
    deps: NavigationCoordinatorBuilderDeps
): NavigationCoordinatorDeps['channelSwitching'] {
    return {
        setLastChannelChangeSourceRemote: (): void => {
            input.schedule.setLastChannelChangeSource('remote');
        },
        setLastChannelChangeSourceNumber: (): void => {
            input.schedule.setLastChannelChangeSource('number');
        },
        switchToNextChannel: (): void => input.actions.switchToNextChannel(),
        switchToPreviousChannel: (): void => input.actions.switchToPreviousChannel(),
        switchToChannelByNumber: (n: number): Promise<ChannelSwitchOutcome> =>
            input.actions.switchToChannelByNumberWithOutcome(n),
        focusEpgOnCurrentChannel: (): void => {
            deps.epgCoordinator.focusEpgOnCurrentChannel();
        },
        toggleEpg: (): void => input.actions.toggleEPG(),
        onChannelInputUpdate: (payload: { digits: string; isComplete: boolean }): void => {
            if (payload.digits) {
                input.overlays.channelNumberOverlay.showDigits(payload.digits, CHANNEL_INPUT_CONFIG.MAX_DIGITS);
            }
            if (payload.isComplete) {
                const configuredDelay = input.config?.channelNumberOverlayConfig?.completeHideDelayMs;
                const delayMs =
                    typeof configuredDelay === 'number' &&
                        Number.isFinite(configuredDelay) &&
                        configuredDelay >= 0
                        ? Math.floor(configuredDelay)
                        : 650;
                input.overlays.channelNumberOverlay.scheduleHide(delayMs);
            }
        },
    };
}

function buildNavigationUiGuardsConfig(
    deps: NavigationCoordinatorBuilderDeps
): NavigationCoordinatorDeps['uiGuards'] {
    return {
        shouldRunChannelSetup: (): boolean => deps.channelSetup.shouldRunChannelSetup(),
        hideChannelTransition: (): void => {
            deps.channelTransitionCoordinator.hide();
        },
    };
}

export function buildChannelTuningCoordinator(
    input: OrchestratorCoordinatorBuilderInput,
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
            playbackRecovery.resetPlaybackFailureGuard();
            playbackRecovery.resetDirectFallbackAttempts();
        },
        stopActiveTranscodeSession: (): void => {
            input.playback.stopActiveTranscodeSession();
        },
        armChannelTransitionForSwitch: (prefix: string): void => {
            channelTransitionCoordinator.armForChannelSwitch(prefix);
        },
        appendIssueDiagnostic: input.diagnostics.appendIssueDiagnostic,
        handleGlobalError: (error: AppError, context: string): void =>
            input.errors.handleGlobalError(error, context),
        saveLifecycleState: (): Promise<void> => input.modules.lifecycle.saveState(),
    });
}

export function buildNavigationCoordinator(
    input: OrchestratorCoordinatorBuilderInput,
    deps: NavigationCoordinatorBuilderDeps
): NavigationCoordinator {
    return new NavigationCoordinator({
        navigation: input.modules.navigation,
        epg: input.modules.epg,
        playback: buildNavigationPlaybackConfig(input, deps),
        miniGuide: buildNavigationMiniGuideConfig(input, deps),
        nowPlayingInfo: buildNavigationNowPlayingInfoConfig(input, deps),
        modals: buildNavigationModalsConfig(deps),
        channelSwitching: buildNavigationChannelSwitchingConfig(input, deps),
        uiGuards: buildNavigationUiGuardsConfig(deps),
        reportToast: (toast: { message: string; type: 'warning' | 'error' | 'info' | 'success' }): void => {
            input.nowPlaying.handler()?.(toast);
        },
        readKeepPlayingInSettings: (): boolean =>
            input.stores.profileSessionStore.readKeepPlayingInSettings(false),
    });
}
