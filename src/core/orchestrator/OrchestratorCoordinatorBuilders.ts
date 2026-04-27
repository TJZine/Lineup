import {
    CHANNEL_INPUT_CONFIG,
    type INavigationManager,
} from '../../modules/navigation';
import {
    NavigationCoordinator,
} from '../../modules/navigation/NavigationCoordinator';
import type {
    NavigationChannelSwitchOutcome,
    NavigationCoordinatorDeps,
    NavigationPlaybackOptionsSectionId,
} from '../../modules/navigation/NavigationCoordinatorDeps';
import type { PlaybackOptionsSectionId } from '../../modules/ui/playback-options';
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
import type { EpgVisibleRange } from '../../modules/ui/epg/types';
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
    PlaybackOptionsCoordinator,
    type IPlaybackOptionsModal,
} from '../../modules/ui/playback-options';
import type { ToastInput } from '../../modules/ui/toast/types';
import {
    ExitConfirmCoordinator,
    ExitConfirmModal,
    EXIT_CONFIRM_FOCUSABLE_IDS,
    EXIT_CONFIRM_MODAL_ID,
} from '../../modules/ui/exit-confirm';
import { ChannelSetupBuildCommitter } from '../channel-setup/build/ChannelSetupBuildCommitter';
import { ChannelSetupBuildScratchStore } from '../channel-setup/build/ChannelSetupBuildScratchStore';
import { ChannelSetupBuildExecutor } from '../channel-setup/build/ChannelSetupBuildExecutor';
import { ChannelSetupCompletionTracker } from '../channel-setup/persistence/ChannelSetupCompletionTracker';
import { ChannelSetupCoordinator } from '../channel-setup/ChannelSetupCoordinator';
import { ChannelSetupPlanningService } from '../channel-setup/planning/ChannelSetupPlanningService';
import { ChannelSetupRecordStore } from '../channel-setup/persistence/ChannelSetupRecordStore';
import type { ChannelSetupWorkflowPortOwners } from '../channel-setup/workflow/createChannelSetupWorkflowPort';
import { ChannelTuningCoordinator } from '../channel-tuning';
import type { GuideSelectionSnapshot } from '../channel-tuning';
import { secondsToMilliseconds } from '../../config/timing';
import type {
    OrchestratorChannelSetupBuilderInput,
    OrchestratorChannelTransitionCoordinatorBuilderInput,
    OrchestratorChannelTuningBuilderInput,
    OrchestratorCoordinatorAssemblyInput,
    OrchestratorEpgCoordinatorBuilderInput,
    OrchestratorExitConfirmCoordinatorBuilderInput,
    OrchestratorMiniGuideCoordinatorBuilderInput,
    OrchestratorNavigationCoordinatorBuilderInput,
    OrchestratorNowPlayingDebugManagerBuilderInput,
    OrchestratorNowPlayingInfoCoordinatorBuilderInput,
    OrchestratorPlaybackOptionsCoordinatorBuilderInput,
    OrchestratorPlaybackRecoveryBuilderInput,
    OrchestratorPlayerOsdCoordinatorBuilderInput,
} from './OrchestratorCoordinatorContracts';
import { NowPlayingDebugManager } from '../../modules/debug/NowPlayingDebugManager';
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from '../../utils/storage';

const DEFAULT_SEEK_INCREMENT_SECONDS = 10;

function reportCoordinatorEpgInitWarning(input: OrchestratorEpgCoordinatorBuilderInput): void {
    input.nowPlaying.handler()?.({
        message: 'Guide unavailable right now. Try again.',
        type: 'warning',
    });
}

function handleVisibleRangeChange(epgCoordinator: EPGCoordinator, range: EpgVisibleRange): void {
    epgCoordinator.handleVisibleRangeChange(range);
}

function notifyPlaybackRecoverySubtitleUnavailable(input: OrchestratorPlaybackRecoveryBuilderInput): void {
    input.nowPlaying.handler()?.({ message: 'Subtitles unavailable for this item', type: 'warning' });
}

function notifyPlaybackRecoveryToast(
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

function getNavigationSeekIncrementMs(input: OrchestratorNavigationCoordinatorBuilderInput): number {
    const seekIncrementSeconds = input.config?.playerConfig?.seekIncrementSec;
    const normalizedSeekIncrementSeconds =
        typeof seekIncrementSeconds === 'number' && Number.isFinite(seekIncrementSeconds)
            ? seekIncrementSeconds
            : DEFAULT_SEEK_INCREMENT_SECONDS;
    return secondsToMilliseconds(normalizedSeekIncrementSeconds);
}

function getNavigationChannelOverlayHideDelay(input: OrchestratorNavigationCoordinatorBuilderInput): number {
    const configuredDelay = input.config?.channelNumberOverlayConfig?.completeHideDelayMs;
    return typeof configuredDelay === 'number' && Number.isFinite(configuredDelay) && configuredDelay >= 0
        ? Math.floor(configuredDelay)
        : 650;
}

function handleNavigationChannelInputUpdate(
    input: OrchestratorNavigationCoordinatorBuilderInput,
    payload: { digits: string; isComplete: boolean }
): void {
    if (payload.digits) {
        input.overlays.channelNumberOverlay.showDigits(payload.digits, CHANNEL_INPUT_CONFIG.MAX_DIGITS);
    }
    if (payload.isComplete) {
        input.overlays.channelNumberOverlay.scheduleHide(getNavigationChannelOverlayHideDelay(input));
    }
}

function resetChannelTuningPlaybackGuards(playbackRecovery: PlaybackRecoveryManager): void {
    playbackRecovery.resetPlaybackFailureGuard();
    playbackRecovery.resetDirectFallbackAttempts();
}

function armChannelTransitionForSwitch(
    channelTransitionCoordinator: ChannelTransitionCoordinator,
    prefix: string
): void {
    channelTransitionCoordinator.armForChannelSwitch(prefix);
}

export function buildEpgCoordinator(input: OrchestratorEpgCoordinatorBuilderInput): EPGCoordinator {
    return new EPGCoordinator({
        getEpg: (): IEPGComponent | null => input.modules.epg,
        getChannelManager: (): IChannelManager | null => input.modules.channelManager,
        getScheduler: (): IChannelScheduler | null => input.modules.scheduler,
        getEpgUiStatus: (): EPGUiStatus => input.moduleStatus.get('epg-ui')?.status,
        ensureEpgInitialized: (): Promise<void> => input.init.ensureEpgInitialized(),
        getEpgConfig: (): EPGConfig | null => input.config?.epgConfig ?? null,
        getLocalMidnightMs: (timeMs: number): number => input.schedule.getLocalMidnightMs(timeMs),
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
        reportEpgInitWarning: (): void => reportCoordinatorEpgInitWarning(input),
        epgPreferencesStore: input.stores.epgPreferencesStore,
        appendIssueDiagnostic: input.diagnostics.appendIssueDiagnostic,
    });
}

export function bindEpgVisibleRangeChange(
    input: OrchestratorEpgCoordinatorBuilderInput,
    epgCoordinator: EPGCoordinator
): void {
    if (!input.config?.epgConfig) {
        return;
    }
    input.config.epgConfig =
        withEpgVisibleRangeChangeBinding(
            input.config.epgConfig,
            (range: EpgVisibleRange): void => {
                handleVisibleRangeChange(epgCoordinator, range);
            }
        ) ?? input.config.epgConfig;
}

export interface ChannelSetupOwners {
    coordinator: ChannelSetupCoordinator;
    portOwners: ChannelSetupWorkflowPortOwners;
}

export function buildChannelSetupOwners(
    input: OrchestratorChannelSetupBuilderInput,
    epgCoordinator: EPGCoordinator
): ChannelSetupOwners {
    const recordStore = new ChannelSetupRecordStore({
        storageGet: safeLocalStorageGet,
        storageSet: safeLocalStorageSet,
        storageRemove: safeLocalStorageRemove,
    });
    const buildScratchStore = new ChannelSetupBuildScratchStore({
        storageRemove: safeLocalStorageRemove,
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
        clearSelectedChannelScheduleSnapshot: (): void => {
            epgCoordinator.clearSelectedChannelScheduleSnapshot();
        },
        primeEpgChannels: (): void => {
            epgCoordinator.primeEpgChannels();
        },
        refreshEpgSchedules: (options?: { reason?: string; debounceMs?: number }): Promise<void> =>
            epgCoordinator.refreshEpgSchedules(options),
    });
    const buildExecutor = new ChannelSetupBuildExecutor({
        channelManager: input.modules.channelManager,
        planningService,
        buildCommitter,
    });
    const getSelectedServerId = (): string | null => input.schedule.getSelectedServerId();
    const getExistingChannelCount = (): number => input.modules.channelManager.getAllChannels().length;
    const coordinator = new ChannelSetupCoordinator({
        recordStore,
        scratchStore: buildScratchStore,
        navigation: input.modules.navigation,
        getSelectedServerId,
        getExistingChannelCount,
    });
    const completionTracker = new ChannelSetupCompletionTracker({
        recordStore,
        clearRerunRequest: (): void => {
            coordinator.clearRerunRequest();
        },
    });
    return {
        coordinator,
        portOwners: {
            planningService,
            buildExecutor,
            recordStore,
            completionTracker,
            getSelectedServerId,
            getExistingChannelCount,
        },
    };
}

export function buildNowPlayingDebugManager(
    input: OrchestratorNowPlayingDebugManagerBuilderInput,
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
    input: OrchestratorNowPlayingInfoCoordinatorBuilderInput,
    nowPlayingDebugManager: NowPlayingDebugManager
): NowPlayingInfoCoordinator {
    return new NowPlayingInfoCoordinator({
        nowPlayingModalId: NOW_PLAYING_INFO_MODAL_ID,
        getNavigation: (): INavigationManager | null => input.modules.navigation,
        getScheduler: (): IChannelScheduler | null => input.modules.scheduler,
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

export function buildMiniGuideCoordinator(
    input: OrchestratorMiniGuideCoordinatorBuilderInput
): MiniGuideCoordinator {
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
        notifyToast: (toast: ToastInput): void => notifyPlaybackRecoveryToast(input, toast),
    });
}

export function buildChannelTransitionCoordinator(
    input: OrchestratorChannelTransitionCoordinatorBuilderInput
): ChannelTransitionCoordinator {
    return new ChannelTransitionCoordinator({
        getOverlay: (): IChannelTransitionOverlay | null => input.overlays.channelTransitionOverlay,
        getNavigation: (): INavigationManager | null => input.modules.navigation,
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
        getAuthHeaders: (): Record<string, string> => input.modules.plexAuth.getAuthHeaders(),
        getServerUri: (): string | null => input.modules.plexDiscovery.getServerUri() ?? null,
        getPreferredSubtitleLanguage: (): string | null =>
            input.stores.subtitlePreferencesStore.readSubtitleLanguageAndClean(),
        getPlexPreferredSubtitleLanguage: (): string | null =>
            input.modules.plexAuth.getCurrentUser()?.preferredSubtitleLanguage ?? null,
        notifySubtitleUnavailable: (): void => notifyPlaybackRecoverySubtitleUnavailable(input),
        notifyToast: (toast: ToastInput): void => notifyPlaybackRecoveryToast(input, toast),
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
        getNavigation: (): INavigationManager | null => input.modules.navigation,
        getPlaybackOptionsModal: (): IPlaybackOptionsModal | null => input.overlays.playbackOptionsModal,
        getVideoPlayer: (): IVideoPlayer | null => input.modules.videoPlayer,
        getCurrentStreamDescriptor: (): StreamDescriptor | null =>
            input.playback.state.getCurrentStreamDescriptor(),
        getCurrentProgram: (): ScheduledProgram | null =>
            input.modules.scheduler.getCurrentProgram() ?? input.playback.state.getCurrentProgramForPlayback(),
        requestBurnInSubtitle: (trackId: string, reason: string) =>
            playbackRecovery.attemptBurnInSubtitleForCurrentProgram(trackId, reason),
        notifyToast: (toast: ToastInput): void => notifyPlaybackRecoveryToast(input, toast),
        subtitlePreferencesStore: input.stores.subtitlePreferencesStore,
    });
}

export function buildExitConfirmCoordinator(
    input: OrchestratorExitConfirmCoordinatorBuilderInput
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
    input: OrchestratorNavigationCoordinatorBuilderInput,
    deps: NavigationCoordinatorBuilderDeps
): NavigationCoordinatorDeps['playback'] {
    return {
        videoPlayer: input.modules.videoPlayer,
        plexAuth: input.modules.plexAuth,
        stopPlayback: (): void => {
            input.playback.stopPlayback();
        },
        getSeekIncrementMs: (): number => getNavigationSeekIncrementMs(input),
        playerOsd: {
            overlay: input.overlays.playerOsd,
            coordinator: deps.playerOsdCoordinator,
        },
    };
}

function buildNavigationMiniGuideConfig(
    input: OrchestratorNavigationCoordinatorBuilderInput,
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
    input: OrchestratorNavigationCoordinatorBuilderInput,
    deps: NavigationCoordinatorBuilderDeps
): NavigationCoordinatorDeps['nowPlayingInfo'] {
    return {
        modalId: NOW_PLAYING_INFO_MODAL_ID,
        isModalOpen: (): boolean => input.modules.navigation.isModalOpen(NOW_PLAYING_INFO_MODAL_ID),
        resetAutoHideTimer: (): void => {
            input.overlays.nowPlayingInfo.resetAutoHideTimer();
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
                preferredSection?: NavigationPlaybackOptionsSectionId
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
    input: OrchestratorNavigationCoordinatorBuilderInput,
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
        switchToChannelByNumber: (n: number): Promise<NavigationChannelSwitchOutcome> =>
            input.actions.switchToChannelByNumberWithOutcome(n),
        focusEpgOnCurrentChannel: (): void => {
            deps.epgCoordinator.focusEpgOnCurrentChannel();
        },
        toggleEpg: (): void => input.actions.toggleEPG(),
        onChannelInputUpdate: (payload: { digits: string; isComplete: boolean }): void => {
            handleNavigationChannelInputUpdate(input, payload);
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

export function buildNavigationCoordinator(
    input: OrchestratorNavigationCoordinatorBuilderInput,
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
        reportRecoverableAsyncFailure: input.diagnostics.reportRecoverableAsyncFailure,
        reportToast: (toast: ToastInput): void => {
            input.nowPlaying.handler()?.(toast);
        },
        readKeepPlayingInSettings: (): boolean =>
            input.stores.profileSessionStore.readKeepPlayingInSettingsAndClean(false),
        readDebugLoggingEnabled: (): boolean =>
            input.stores.developerSettingsStore.readDebugLoggingEnabledAndClean(false),
    });
}
