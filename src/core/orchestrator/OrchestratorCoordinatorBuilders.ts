import {
    CHANNEL_INPUT_CONFIG,
    type INavigationManager,
} from '../../modules/navigation';
import {
    NavigationCoordinator,
    type NavigationCoordinatorDeps,
} from '../../modules/navigation/NavigationCoordinator';
import type { PlaybackOptionsSectionId } from '../../modules/ui/playback-options';
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
import { secondsToMilliseconds } from '../../config/timing';
import type {
    OrchestratorChannelSetupBuilderInput,
    OrchestratorChannelTuningBuilderInput,
    OrchestratorCoordinatorAssemblyInput,
    OrchestratorEpgCoordinatorBuilderInput,
    OrchestratorNavigationCoordinatorBuilderInput,
    OrchestratorPlaybackRecoveryBuilderInput,
} from './OrchestratorCoordinatorContracts';
import { NowPlayingDebugManager } from '../../modules/debug/NowPlayingDebugManager';
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from '../../utils/storage';

const DEFAULT_SEEK_INCREMENT_SECONDS = 10;

type DailyScheduleConfigInput = {
    schedule: Pick<OrchestratorCoordinatorAssemblyInput['schedule'], 'buildDailyScheduleConfig'>;
};

function getCoordinatorEpg(input: OrchestratorEpgCoordinatorBuilderInput): IEPGComponent | null {
    return input.modules.epg;
}

function getCoordinatorChannelManager(input: OrchestratorEpgCoordinatorBuilderInput): IChannelManager | null {
    return input.modules.channelManager;
}

function getCoordinatorScheduler(
    input: OrchestratorEpgCoordinatorBuilderInput | OrchestratorPlaybackRecoveryBuilderInput
): IChannelScheduler | null {
    return input.modules.scheduler;
}

function getCoordinatorEpgUiStatus(input: OrchestratorEpgCoordinatorBuilderInput): EPGUiStatus {
    return input.moduleStatus.get('epg-ui')?.status;
}

function ensureCoordinatorEpgInitialized(input: Pick<OrchestratorCoordinatorAssemblyInput, 'init'>): Promise<void> {
    return input.init.ensureEpgInitialized();
}

function getCoordinatorEpgConfig(input: OrchestratorEpgCoordinatorBuilderInput): EPGConfig | null {
    return input.config?.epgConfig ?? null;
}

function getCoordinatorLocalMidnightMs(input: OrchestratorEpgCoordinatorBuilderInput, timeMs: number): number {
    return input.schedule.getLocalMidnightMs(timeMs);
}

function buildCoordinatorDailyScheduleConfig(
    input: DailyScheduleConfigInput,
    channel: ChannelConfig,
    items: ResolvedChannelContent['items'],
    referenceTimeMs: number
): ScheduleConfig {
    return input.schedule.buildDailyScheduleConfig(channel, items, referenceTimeMs);
}

function getCoordinatorPreserveFocusOnOpen(input: OrchestratorEpgCoordinatorBuilderInput): boolean {
    return input.schedule.lastChannelChangeSource() === 'guide';
}

function setCoordinatorLastChannelChangeSourceToGuide(input: OrchestratorEpgCoordinatorBuilderInput): void {
    input.schedule.setLastChannelChangeSource('guide');
}

function switchCoordinatorToChannel(
    input: OrchestratorEpgCoordinatorBuilderInput,
    channelId: string,
    options?: { guideSelectionSnapshot?: GuideSelectionSnapshot }
): Promise<void> {
    return input.actions.switchToChannel(channelId, options);
}

function onCoordinatorVisibilityChange(
    input: OrchestratorEpgCoordinatorBuilderInput,
    visible: boolean
): void {
    input.actions.onOverlayVisibilityChange(visible);
}

function reportCoordinatorEpgInitWarning(input: OrchestratorEpgCoordinatorBuilderInput): void {
    input.nowPlaying.handler()?.({
        message: 'Guide unavailable right now. Try again.',
        type: 'warning',
    });
}

function handleVisibleRangeChange(epgCoordinator: EPGCoordinator, range: EpgVisibleRange): void {
    epgCoordinator.handleVisibleRangeChange(range);
}

function getSelectedServerId(input: OrchestratorChannelSetupBuilderInput): string | null {
    return input.schedule.getSelectedServerId();
}

function getExistingChannelCount(input: OrchestratorChannelSetupBuilderInput): number {
    return input.modules.channelManager.getAllChannels().length;
}

function clearSelectedChannelScheduleSnapshot(epgCoordinator: EPGCoordinator): void {
    epgCoordinator.clearSelectedChannelScheduleSnapshot();
}

function primeEpgChannels(epgCoordinator: EPGCoordinator): void {
    epgCoordinator.primeEpgChannels();
}

function refreshEpgSchedules(
    epgCoordinator: EPGCoordinator,
    options?: { reason?: string; debounceMs?: number }
): Promise<void> {
    return epgCoordinator.refreshEpgSchedules(options);
}

function getPlaybackRecoveryVideoPlayer(input: OrchestratorPlaybackRecoveryBuilderInput): IVideoPlayer | null {
    return input.modules.videoPlayer;
}

function getPlaybackRecoveryStreamResolver(input: OrchestratorPlaybackRecoveryBuilderInput): IPlexStreamResolver | null {
    return input.modules.plexStreamResolver;
}

function getPlaybackRecoveryCurrentProgram(input: OrchestratorPlaybackRecoveryBuilderInput): ScheduledProgram | null {
    return input.playback.state.getCurrentProgramForPlayback();
}

function getPlaybackRecoveryCurrentStreamDescriptor(
    input: OrchestratorPlaybackRecoveryBuilderInput
): StreamDescriptor | null {
    return input.playback.state.getCurrentStreamDescriptor();
}

function getPlaybackRecoveryCurrentStreamDecision(input: OrchestratorPlaybackRecoveryBuilderInput): StreamDecision | null {
    return input.playback.state.getCurrentStreamDecision();
}

function setPlaybackRecoveryCurrentStreamDecision(
    input: OrchestratorPlaybackRecoveryBuilderInput,
    decision: StreamDecision | null
): void {
    input.playback.state.setCurrentStreamDecision(decision);
}

function setPlaybackRecoveryCurrentStreamDescriptor(
    input: OrchestratorPlaybackRecoveryBuilderInput,
    descriptor: StreamDescriptor | null
): void {
    input.playback.state.setCurrentStreamDescriptor(descriptor);
}

function buildPlaybackRecoveryPlexResourceUrl(
    input: OrchestratorPlaybackRecoveryBuilderInput,
    pathOrUrl: string
): string | null {
    return input.playback.buildPlexResourceUrl(pathOrUrl);
}

function getPlaybackRecoveryMimeType(
    input: OrchestratorPlaybackRecoveryBuilderInput,
    decision: StreamDecision
): string {
    return input.playback.getMimeType(decision);
}

function getPlaybackRecoveryAuthHeaders(input: OrchestratorPlaybackRecoveryBuilderInput): Record<string, string> {
    return input.modules.plexAuth.getAuthHeaders();
}

function getPlaybackRecoveryServerUri(input: OrchestratorPlaybackRecoveryBuilderInput): string | null {
    return input.modules.plexDiscovery.getServerUri() ?? null;
}

function getPlaybackRecoveryPreferredSubtitleLanguage(
    input: OrchestratorPlaybackRecoveryBuilderInput
): string | null {
    return input.stores.subtitlePreferencesStore.readSubtitleLanguageAndClean();
}

function getPlaybackRecoveryPlexPreferredSubtitleLanguage(
    input: OrchestratorPlaybackRecoveryBuilderInput
): string | null {
    return input.modules.plexAuth.getCurrentUser()?.preferredSubtitleLanguage ?? null;
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

function setNavigationLastChannelChangeSource(
    input: OrchestratorNavigationCoordinatorBuilderInput,
    source: 'remote' | 'number'
): void {
    input.schedule.setLastChannelChangeSource(source);
}

function stopNavigationPlayback(input: OrchestratorNavigationCoordinatorBuilderInput): void {
    input.playback.stopPlayback();
}

function getNavigationSeekIncrementMs(input: OrchestratorNavigationCoordinatorBuilderInput): number {
    const seekIncrementSeconds = input.config?.playerConfig?.seekIncrementSec;
    const normalizedSeekIncrementSeconds =
        typeof seekIncrementSeconds === 'number' && Number.isFinite(seekIncrementSeconds)
            ? seekIncrementSeconds
            : DEFAULT_SEEK_INCREMENT_SECONDS;
    return secondsToMilliseconds(normalizedSeekIncrementSeconds);
}

function focusNavigationEpgOnCurrentChannel(deps: NavigationCoordinatorBuilderDeps): void {
    deps.epgCoordinator.focusEpgOnCurrentChannel();
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

function getChannelTuningLocalDayKey(input: OrchestratorChannelTuningBuilderInput, timeMs: number): number {
    return input.schedule.getLocalDayKey(timeMs);
}

function setChannelTuningActiveScheduleDayKey(
    input: OrchestratorChannelTuningBuilderInput,
    dayKey: number
): void {
    input.schedule.setActiveScheduleDayKey(dayKey);
}

function setChannelTuningPendingNowPlayingChannelId(
    input: OrchestratorChannelTuningBuilderInput,
    channelId: string | null
): void {
    input.playback.state.setPendingNowPlayingChannelId(channelId);
}

function getChannelTuningPendingNowPlayingChannelId(input: OrchestratorChannelTuningBuilderInput): string | null {
    return input.playback.state.getPendingNowPlayingChannelId();
}

function resetChannelTuningPlaybackGuards(playbackRecovery: PlaybackRecoveryManager): void {
    playbackRecovery.resetPlaybackFailureGuard();
    playbackRecovery.resetDirectFallbackAttempts();
}

function stopChannelTuningActiveTranscodeSession(input: OrchestratorChannelTuningBuilderInput): void {
    input.playback.stopActiveTranscodeSession();
}

function armChannelTransitionForSwitch(
    channelTransitionCoordinator: ChannelTransitionCoordinator,
    prefix: string
): void {
    channelTransitionCoordinator.armForChannelSwitch(prefix);
}

function saveChannelTuningLifecycleState(input: OrchestratorChannelTuningBuilderInput): Promise<void> {
    return input.modules.lifecycle.saveState();
}

export function buildEpgCoordinator(input: OrchestratorEpgCoordinatorBuilderInput): EPGCoordinator {
    return new EPGCoordinator({
        getEpg: getCoordinatorEpg.bind(null, input),
        getChannelManager: getCoordinatorChannelManager.bind(null, input),
        getScheduler: getCoordinatorScheduler.bind(null, input),
        getEpgUiStatus: getCoordinatorEpgUiStatus.bind(null, input),
        ensureEpgInitialized: ensureCoordinatorEpgInitialized.bind(null, input),
        getEpgConfig: getCoordinatorEpgConfig.bind(null, input),
        getLocalMidnightMs: getCoordinatorLocalMidnightMs.bind(null, input),
        debugRuntime: input.epgDebugRuntime,
        buildDailyScheduleConfig: buildCoordinatorDailyScheduleConfig.bind(null, input),
        getPreserveFocusOnOpen: getCoordinatorPreserveFocusOnOpen.bind(null, input),
        setLastChannelChangeSourceToGuide: setCoordinatorLastChannelChangeSourceToGuide.bind(null, input),
        switchToChannel: switchCoordinatorToChannel.bind(null, input),
        onVisibilityChange: onCoordinatorVisibilityChange.bind(null, input),
        reportEpgInitWarning: reportCoordinatorEpgInitWarning.bind(null, input),
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
            handleVisibleRangeChange.bind(null, epgCoordinator)
        ) ?? input.config.epgConfig;
}

export interface ChannelSetupOwners {
    coordinator: ChannelSetupCoordinator;
    workflow: ChannelSetupWorkflow;
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
        ensureEpgInitialized: ensureCoordinatorEpgInitialized.bind(null, input),
        clearSelectedChannelScheduleSnapshot: clearSelectedChannelScheduleSnapshot.bind(null, epgCoordinator),
        primeEpgChannels: primeEpgChannels.bind(null, epgCoordinator),
        refreshEpgSchedules: refreshEpgSchedules.bind(null, epgCoordinator),
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
        getSelectedServerId: getSelectedServerId.bind(null, input),
        getExistingChannelCount: getExistingChannelCount.bind(null, input),
    });
    const completionTracker = new ChannelSetupCompletionTracker({
        recordStore,
        clearRerunRequest: coordinator.clearRerunRequest.bind(coordinator),
    });
    const workflow = new ChannelSetupWorkflow({
        planningService,
        buildExecutor,
        recordStore,
        completionTracker,
        getSelectedServerId: getSelectedServerId.bind(null, input),
        getExistingChannelCount: getExistingChannelCount.bind(null, input),
    });

    return {
        coordinator,
        workflow,
    };
}

export function buildNowPlayingDebugManager(
    input: OrchestratorCoordinatorAssemblyInput,
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
    input: OrchestratorCoordinatorAssemblyInput,
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
    input: OrchestratorCoordinatorAssemblyInput,
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

export function buildMiniGuideCoordinator(input: OrchestratorCoordinatorAssemblyInput): MiniGuideCoordinator {
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
        notifyToast: notifyPlaybackRecoveryToast.bind(null, input),
    });
}

export function buildChannelTransitionCoordinator(
    input: OrchestratorCoordinatorAssemblyInput
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
        getVideoPlayer: getPlaybackRecoveryVideoPlayer.bind(null, input),
        getStreamResolver: getPlaybackRecoveryStreamResolver.bind(null, input),
        getScheduler: getCoordinatorScheduler.bind(null, input),
        getCurrentProgramForPlayback: getPlaybackRecoveryCurrentProgram.bind(null, input),
        getCurrentStreamDescriptor: getPlaybackRecoveryCurrentStreamDescriptor.bind(null, input),
        getCurrentStreamDecision: getPlaybackRecoveryCurrentStreamDecision.bind(null, input),
        setCurrentStreamDecision: setPlaybackRecoveryCurrentStreamDecision.bind(null, input),
        setCurrentStreamDescriptor: setPlaybackRecoveryCurrentStreamDescriptor.bind(null, input),
        buildPlexResourceUrl: buildPlaybackRecoveryPlexResourceUrl.bind(null, input),
        getMimeType: getPlaybackRecoveryMimeType.bind(null, input),
        getAuthHeaders: getPlaybackRecoveryAuthHeaders.bind(null, input),
        getServerUri: getPlaybackRecoveryServerUri.bind(null, input),
        getPreferredSubtitleLanguage: getPlaybackRecoveryPreferredSubtitleLanguage.bind(null, input),
        getPlexPreferredSubtitleLanguage: getPlaybackRecoveryPlexPreferredSubtitleLanguage.bind(null, input),
        notifySubtitleUnavailable: notifyPlaybackRecoverySubtitleUnavailable.bind(null, input),
        notifyToast: notifyPlaybackRecoveryToast.bind(null, input),
        subtitlePreferencesStore: input.stores.subtitlePreferencesStore,
        appendIssueDiagnostic: input.diagnostics.appendIssueDiagnostic,
        handleGlobalError: handleCoordinatorGlobalError.bind(null, input),
    });
}

export function buildPlaybackOptionsCoordinator(
    input: OrchestratorCoordinatorAssemblyInput,
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
        notifyToast: notifyPlaybackRecoveryToast.bind(null, input),
        subtitlePreferencesStore: input.stores.subtitlePreferencesStore,
    });
}

export function buildExitConfirmCoordinator(
    input: OrchestratorCoordinatorAssemblyInput
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
        stopPlayback: stopNavigationPlayback.bind(null, input),
        getSeekIncrementMs: getNavigationSeekIncrementMs.bind(null, input),
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
    input: OrchestratorNavigationCoordinatorBuilderInput,
    deps: NavigationCoordinatorBuilderDeps
): NavigationCoordinatorDeps['channelSwitching'] {
    return {
        setLastChannelChangeSourceRemote: setNavigationLastChannelChangeSource.bind(null, input, 'remote'),
        setLastChannelChangeSourceNumber: setNavigationLastChannelChangeSource.bind(null, input, 'number'),
        switchToNextChannel: (): void => input.actions.switchToNextChannel(),
        switchToPreviousChannel: (): void => input.actions.switchToPreviousChannel(),
        switchToChannelByNumber: (n: number): Promise<ChannelSwitchOutcome> =>
            input.actions.switchToChannelByNumberWithOutcome(n),
        focusEpgOnCurrentChannel: focusNavigationEpgOnCurrentChannel.bind(null, deps),
        toggleEpg: (): void => input.actions.toggleEPG(),
        onChannelInputUpdate: handleNavigationChannelInputUpdate.bind(null, input),
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
        buildDailyScheduleConfig: buildCoordinatorDailyScheduleConfig.bind(null, input),
        getLocalDayKey: getChannelTuningLocalDayKey.bind(null, input),
        setActiveScheduleDayKey: setChannelTuningActiveScheduleDayKey.bind(null, input),
        setPendingNowPlayingChannelId: setChannelTuningPendingNowPlayingChannelId.bind(null, input),
        getPendingNowPlayingChannelId: getChannelTuningPendingNowPlayingChannelId.bind(null, input),
        resetPlaybackGuardsForNewChannel: resetChannelTuningPlaybackGuards.bind(null, playbackRecovery),
        stopActiveTranscodeSession: stopChannelTuningActiveTranscodeSession.bind(null, input),
        armChannelTransitionForSwitch: armChannelTransitionForSwitch.bind(null, channelTransitionCoordinator),
        appendIssueDiagnostic: input.diagnostics.appendIssueDiagnostic,
        handleGlobalError: handleCoordinatorGlobalError.bind(null, input),
        saveLifecycleState: saveChannelTuningLifecycleState.bind(null, input),
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
