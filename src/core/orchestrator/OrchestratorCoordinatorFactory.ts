import {
    CHANNEL_INPUT_CONFIG,
    type INavigationManager,
} from '../../modules/navigation';
import { NavigationCoordinator } from '../../modules/navigation/NavigationCoordinator';
import type { PlaybackOptionsSectionId } from '../../modules/ui/playback-options/types';
import type { ChannelSwitchOutcome } from '../../types/channelSwitch';
import type {
    AppError,
    IAppLifecycle,
} from '../../modules/lifecycle';
import type { IPlexAuth } from '../../modules/plex/auth';
import type { IPlexServerDiscovery } from '../../modules/plex/discovery';
import type {
    IPlexLibrary,
} from '../../modules/plex/library';
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
    type EpgUiStatus,
} from '../../modules/ui/epg/EPGCoordinator';
import { readEpgStorageSnapshotForScheduleRange } from '../../modules/ui/epg/EPGCoordinatorPolicies';
import type {
    IEPGComponent,
    EPGConfig,
} from '../../modules/ui/epg';
import {
    NOW_PLAYING_INFO_MODAL_ID,
    type INowPlayingInfoOverlay,
    type NowPlayingInfoConfig,
} from '../../modules/ui/now-playing-info';
import {
    NowPlayingInfoCoordinator,
    getNowPlayingInfoAutoHideMs,
} from '../../modules/ui/now-playing-info/NowPlayingInfoCoordinator';
import type { PlaybackInfoSnapshotLike } from '../../utils/playbackSummary';
import type {
    IPlayerOsdOverlay,
} from '../../modules/ui/player-osd';
import { PlayerOsdCoordinator } from '../../modules/ui/player-osd/PlayerOsdCoordinator';
import type {
    IChannelNumberOverlay,
} from '../../modules/ui/channel-number-overlay';
import type {
    IChannelBadgeOverlay,
} from '../../modules/ui/channel-badge';
import type {
    IMiniGuideOverlay,
} from '../../modules/ui/mini-guide';
import { MiniGuideCoordinator } from '../../modules/ui/mini-guide/MiniGuideCoordinator';
import type {
    IChannelTransitionOverlay,
} from '../../modules/ui/channel-transition';
import { ChannelTransitionCoordinator } from '../../modules/ui/channel-transition/ChannelTransitionCoordinator';
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
import { SleepTimerManager } from '../../modules/ui/sleep-timer';
import { ChannelSetupCoordinator } from '../channel-setup';
import { ChannelTuningCoordinator } from '../channel-tuning';
import type { GuideSelectionSnapshot } from '../channel-tuning';
import type { IInitializationCoordinator } from '../InitializationCoordinator';
import type { ModuleStatus, OrchestratorConfig } from './OrchestratorTypes';
import { DebugOverridesStore } from '../../modules/debug/DebugOverridesStore';
import { NowPlayingDebugManager } from '../../modules/debug/NowPlayingDebugManager';
import { EpgPreferencesStore } from '../../modules/settings/EpgPreferencesStore';
import { NowPlayingDisplayStore } from '../../modules/settings/NowPlayingDisplayStore';
import { ProfileSessionStore } from '../../modules/settings/ProfileSessionStore';
import { SubtitlePreferencesStore } from '../../modules/settings/SubtitlePreferencesStore';
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from '../../utils/storage';
import { summarizeErrorForLog } from '../../utils/errors';
import type { ToastInput } from '../../modules/ui/toast/types';
import type { OrchestratorPlaybackStateAccessors } from './OrchestratorPlaybackStateAccessors';

export interface OrchestratorCoordinatorFactoryDeps {
    config: OrchestratorConfig | null;
    moduleStatus: Map<string, ModuleStatus>;

    getInitCoordinator: () => IInitializationCoordinator | null;

    navigation: INavigationManager;
    plexAuth: IPlexAuth;
    plexDiscovery: IPlexServerDiscovery;
    plexLibrary: IPlexLibrary;
    plexStreamResolver: IPlexStreamResolver;
    channelManager: IChannelManager;
    scheduler: IChannelScheduler;
    videoPlayer: IVideoPlayer;
    lifecycle: IAppLifecycle;
    epg: IEPGComponent;
    nowPlayingInfo: INowPlayingInfoOverlay;
    playerOsd: IPlayerOsdOverlay;
    channelNumberOverlay: IChannelNumberOverlay;
    channelBadgeOverlay: IChannelBadgeOverlay;
    miniGuide: IMiniGuideOverlay;
    channelTransitionOverlay: IChannelTransitionOverlay;
    playbackOptionsModal: IPlaybackOptionsModal;
    exitConfirmModal: ExitConfirmModal;
    sleepTimer: SleepTimerManager;

    debugOverridesStore: DebugOverridesStore;
    subtitlePreferencesStore: SubtitlePreferencesStore;
    epgPreferencesStore: EpgPreferencesStore;
    nowPlayingDisplayStore: NowPlayingDisplayStore;
    profileSessionStore: ProfileSessionStore;

    playbackState: OrchestratorPlaybackStateAccessors;
    lastChannelChangeSource: () => 'remote' | 'number' | 'guide' | null;
    setLastChannelChangeSource: (source: 'remote' | 'number' | 'guide' | null) => void;
    setActiveScheduleDayKey: (dayKey: number) => void;

    getSelectedServerId: () => string | null;
    getLocalMidnightMs: (timeMs: number) => number;
    getLocalDayKey: (timeMs: number) => number;
    buildDailyScheduleConfig: (
        channel: ChannelConfig,
        items: ResolvedChannelContent['items'],
        referenceTimeMs: number
    ) => ScheduleConfig;
    buildPlexResourceUrl: (pathOrUrl: string) => string | null;
    getMimeType: (decision: StreamDecision) => string;
    getPlaybackInfoSnapshot: () => PlaybackInfoSnapshotLike | null;
    refreshPlaybackInfoSnapshot: () => Promise<PlaybackInfoSnapshotLike>;

    switchToChannel: (
        channelId: string,
        options?: { guideSelectionSnapshot?: GuideSelectionSnapshot }
    ) => Promise<void>;
    stopPlayback: () => void;
    stopActiveTranscodeSession: () => void;
    switchToNextChannel: () => void;
    switchToPreviousChannel: () => void;
    switchToChannelByNumberWithOutcome: (n: number) => Promise<ChannelSwitchOutcome>;
    toggleEPG: () => void;
    handleGlobalError: (error: AppError, context: string) => void;
    onOverlayVisibilityChange: (visible: boolean) => void;
    toggleNowPlayingInfoOverlay: () => void;

    nowPlayingHandler: () => ((toast: ToastInput) => void) | null;
}

export interface OrchestratorCoordinators {
    epgCoordinator: EPGCoordinator;
    channelSetup: ChannelSetupCoordinator;
    nowPlayingDebugManager: NowPlayingDebugManager;
    nowPlayingInfoCoordinator: NowPlayingInfoCoordinator;
    playerOsdCoordinator: PlayerOsdCoordinator;
    miniGuideCoordinator: MiniGuideCoordinator;
    channelTransitionCoordinator: ChannelTransitionCoordinator;
    playbackOptionsCoordinator: PlaybackOptionsCoordinator;
    exitConfirmCoordinator: ExitConfirmCoordinator;
    playbackRecovery: PlaybackRecoveryManager;
    channelTuning: ChannelTuningCoordinator;
    navigationCoordinator: NavigationCoordinator;
}

export function createOrchestratorCoordinators(
    deps: OrchestratorCoordinatorFactoryDeps
): OrchestratorCoordinators {
    const epgCoordinator = new EPGCoordinator({
        getEpg: (): IEPGComponent | null => deps.epg,
        getChannelManager: (): IChannelManager | null => deps.channelManager,
        getScheduler: (): IChannelScheduler | null => deps.scheduler,
        getEpgUiStatus: (): EpgUiStatus => deps.moduleStatus.get('epg-ui')?.status,
        ensureEpgInitialized: (): Promise<void> =>
            deps.getInitCoordinator()?.ensureEPGInitialized() ?? Promise.resolve(),
        getEpgConfig: (): EPGConfig | null => deps.config?.epgConfig ?? null,
        getLocalMidnightMs: (t: number): number => deps.getLocalMidnightMs(t),
        getEpgScheduleRangeSnapshot: (): ReturnType<typeof readEpgStorageSnapshotForScheduleRange> =>
            readEpgStorageSnapshotForScheduleRange(),
        buildDailyScheduleConfig: (
            channel: ChannelConfig,
            items: ResolvedChannelContent['items'],
            referenceTimeMs: number
        ): ScheduleConfig => deps.buildDailyScheduleConfig(channel, items, referenceTimeMs),
        getPreserveFocusOnOpen: (): boolean => deps.lastChannelChangeSource() === 'guide',
        setLastChannelChangeSourceToGuide: (): void => {
            deps.setLastChannelChangeSource('guide');
        },
        switchToChannel: (
            channelId: string,
            options?: { guideSelectionSnapshot?: GuideSelectionSnapshot }
        ): Promise<void> => deps.switchToChannel(channelId, options),
        onVisibilityChange: (visible: boolean): void => {
            deps.onOverlayVisibilityChange(visible);
        },
        reportEpgInitWarning: (error: unknown): void => {
            console.warn('[EPG_INIT] Deferred guide initialization failed:', summarizeErrorForLog(error));
            deps.nowPlayingHandler()?.({
                message: 'Guide unavailable right now. Try again.',
                type: 'warning',
            });
        },
        epgPreferencesStore: deps.epgPreferencesStore,
    });
    if (deps.config?.epgConfig) {
        deps.config.epgConfig =
            epgCoordinator.withVisibleRangeRefreshPolicy(deps.config.epgConfig) ?? deps.config.epgConfig;
    }

    const channelSetup = new ChannelSetupCoordinator({
        plexLibrary: deps.plexLibrary,
        channelManager: deps.channelManager,
        navigation: deps.navigation,
        getSelectedServerId: (): string | null => deps.getSelectedServerId(),
        storageGet: (key: string): string | null => safeLocalStorageGet(key),
        storageSet: (key: string, value: string): void => {
            safeLocalStorageSet(key, value);
        },
        storageRemove: (key: string): void => {
            safeLocalStorageRemove(key);
        },
        handleGlobalError: (error: AppError, context: string): void => deps.handleGlobalError(error, context),
        ensureEpgInitialized: (): Promise<void> =>
            deps.getInitCoordinator()?.ensureEPGInitialized() ?? Promise.resolve(),
        clearSelectedChannelScheduleSnapshot: (): void => epgCoordinator.clearSelectedChannelScheduleSnapshot(),
        primeEpgChannels: (): void => epgCoordinator.primeEpgChannels(),
        refreshEpgSchedules: (options?: { reason?: string; debounceMs?: number }): Promise<void> =>
            epgCoordinator.refreshEpgSchedules(options),
    });

    const nowPlayingDebugManager = new NowPlayingDebugManager({
        nowPlayingModalId: NOW_PLAYING_INFO_MODAL_ID,
        getNavigation: (): INavigationManager | null => deps.navigation,
        getStreamResolver: (): IPlexStreamResolver | null => deps.plexStreamResolver,
        getNowPlayingInfo: (): INowPlayingInfoOverlay | null => deps.nowPlayingInfo,
        getCurrentProgram: (): ScheduledProgram | null =>
            deps.scheduler.getCurrentProgram() ?? deps.playbackState.getCurrentProgramForPlayback(),
        getCurrentStreamDecision: (): StreamDecision | null => deps.playbackState.getCurrentStreamDecision(),
        debugOverridesStore: deps.debugOverridesStore,
        requestNowPlayingOverlayRefresh: (): void =>
            nowPlayingInfoCoordinator?.refreshIfOpen(),
    });

    const nowPlayingInfoCoordinator = new NowPlayingInfoCoordinator({
        nowPlayingModalId: NOW_PLAYING_INFO_MODAL_ID,
        getNavigation: (): INavigationManager | null => deps.navigation,
        getScheduler: (): IChannelScheduler | null => deps.scheduler,
        getChannelManager: (): IChannelManager | null => deps.channelManager,
        getPlexLibrary: (): IPlexLibrary | null => deps.plexLibrary,
        getNowPlayingInfo: (): INowPlayingInfoOverlay | null => deps.nowPlayingInfo,
        getNowPlayingInfoConfig: (): NowPlayingInfoConfig | null =>
            deps.config?.nowPlayingInfoConfig ?? null,
        buildPlexResourceUrl: (pathOrUrl: string): string | null =>
            deps.buildPlexResourceUrl(pathOrUrl),
        buildDebugText: (): string | null =>
            nowPlayingDebugManager.buildNowPlayingStreamDebugText() ?? null,
        maybeFetchStreamDecisionForDebugHud: (): Promise<void> =>
            nowPlayingDebugManager.maybeFetchNowPlayingStreamDecisionForDebugHud() ??
            Promise.resolve(),
        getAutoHideMs: (): number =>
            getNowPlayingInfoAutoHideMs(deps.config?.nowPlayingInfoConfig, deps.nowPlayingDisplayStore),
        getCurrentProgramForPlayback: (): ScheduledProgram | null =>
            deps.playbackState.getCurrentProgramForPlayback(),
        getPlaybackInfoSnapshot: (): PlaybackInfoSnapshotLike | null => deps.getPlaybackInfoSnapshot(),
        refreshPlaybackInfoSnapshot: (): Promise<PlaybackInfoSnapshotLike> =>
            deps.refreshPlaybackInfoSnapshot(),
        onVisibilityChange: (visible: boolean): void => {
            deps.onOverlayVisibilityChange(visible);
        },
        nowPlayingDisplayStore: deps.nowPlayingDisplayStore,
    });

    const playerOsdCoordinator = new PlayerOsdCoordinator({
        getOverlay: (): IPlayerOsdOverlay | null => deps.playerOsd,
        getCurrentProgram: (): ScheduledProgram | null =>
            deps.scheduler.getCurrentProgram() ?? deps.playbackState.getCurrentProgramForPlayback(),
        getNextProgram: (): ScheduledProgram | null => deps.scheduler.getNextProgram() ?? null,
        getCurrentChannel: (): ChannelConfig | null =>
            deps.channelManager.getCurrentChannel() ?? null,
        getVideoPlayer: (): IVideoPlayer | null => deps.videoPlayer,
        getAutoHideMs: (): number =>
            deps.config?.playerConfig.hideControlsAfterMs ?? 3000,
        getNavigation: (): INavigationManager | null => deps.navigation,
        buildPlexResourceUrl: (pathOrUrl: string): string | null =>
            deps.buildPlexResourceUrl(pathOrUrl),
        cycleSleepTimerPreset: (): number => deps.sleepTimer.cyclePreset(),
        getSleepTimerRemainingMs: (): number => deps.sleepTimer.getRemainingMs(),
        nowPlayingDisplayStore: deps.nowPlayingDisplayStore,
        playbackOptionsModalId: PLAYBACK_OPTIONS_MODAL_ID,
        preparePlaybackOptionsModal: (
            preferredSection
        ): { focusableIds: string[]; preferredFocusId: string | null } =>
            playbackOptionsCoordinator?.prepareModal(preferredSection) ??
            { focusableIds: [], preferredFocusId: null },
        onVisibilityChange: (visible: boolean): void => {
            deps.onOverlayVisibilityChange(visible);
        },
    });

    const miniGuideCoordinator = new MiniGuideCoordinator({
        getOverlay: (): IMiniGuideOverlay | null => deps.miniGuide,
        getChannelManager: (): IChannelManager | null => deps.channelManager,
        getScheduler: (): IChannelScheduler | null => deps.scheduler,
        buildDailyScheduleConfig: (
            channel: ChannelConfig,
            items: ResolvedChannelContent['items'],
            referenceTimeMs: number
        ): ScheduleConfig => deps.buildDailyScheduleConfig(channel, items, referenceTimeMs),
        switchToChannel: (channelId: string): Promise<void> => deps.switchToChannel(channelId),
        getAutoHideMs: (): number => {
            const configured = deps.config?.miniGuideConfig?.autoHideMs;
            if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) {
                return Math.max(1000, Math.floor(configured));
            }
            return 8_000;
        },
    });

    const channelTransitionCoordinator = new ChannelTransitionCoordinator({
        getOverlay: (): IChannelTransitionOverlay | null => deps.channelTransitionOverlay,
        getNavigation: (): INavigationManager | null => deps.navigation,
        getVideoPlayer: (): IVideoPlayer | null => deps.videoPlayer,
    });

    const playbackOptionsCoordinator = new PlaybackOptionsCoordinator({
        playbackOptionsModalId: PLAYBACK_OPTIONS_MODAL_ID,
        getNavigation: (): INavigationManager | null => deps.navigation,
        getPlaybackOptionsModal: (): IPlaybackOptionsModal | null => deps.playbackOptionsModal,
        getVideoPlayer: (): IVideoPlayer | null => deps.videoPlayer,
        getCurrentStreamDescriptor: (): StreamDescriptor | null =>
            deps.playbackState.getCurrentStreamDescriptor(),
        getCurrentProgram: (): ScheduledProgram | null =>
            deps.scheduler.getCurrentProgram() ?? deps.playbackState.getCurrentProgramForPlayback(),
        requestBurnInSubtitle: (trackId: string, reason: string): Promise<boolean> =>
            playbackRecovery.attemptBurnInSubtitleForCurrentProgram(trackId, reason),
        notifyToast: (message, type): void => {
            const handler = deps.nowPlayingHandler();
            if (!handler) return;
            handler(type ? { message, type } : message);
        },
        subtitlePreferencesStore: deps.subtitlePreferencesStore,
    });

    const exitConfirmCoordinator = new ExitConfirmCoordinator({
        getNavigation: (): INavigationManager | null => deps.navigation,
        getModal: (): ExitConfirmModal | null => deps.exitConfirmModal,
    });

    const playbackRecovery = new PlaybackRecoveryManager({
        getVideoPlayer: (): IVideoPlayer | null => deps.videoPlayer,
        getStreamResolver: (): IPlexStreamResolver | null => deps.plexStreamResolver,
        getScheduler: (): IChannelScheduler | null => deps.scheduler,
        getCurrentProgramForPlayback: (): ScheduledProgram | null =>
            deps.playbackState.getCurrentProgramForPlayback(),
        getCurrentStreamDescriptor: (): StreamDescriptor | null =>
            deps.playbackState.getCurrentStreamDescriptor(),
        getCurrentStreamDecision: (): StreamDecision | null =>
            deps.playbackState.getCurrentStreamDecision(),
        setCurrentStreamDecision: (decision: StreamDecision): void => {
            deps.playbackState.setCurrentStreamDecision(decision);
        },
        setCurrentStreamDescriptor: (descriptor: StreamDescriptor): void => {
            deps.playbackState.setCurrentStreamDescriptor(descriptor);
        },
        buildPlexResourceUrl: (pathOrUrl: string): string | null =>
            deps.buildPlexResourceUrl(pathOrUrl),
        getMimeType: (decision: StreamDecision): string => deps.getMimeType(decision),
        getAuthHeaders: (): Record<string, string> =>
            deps.plexAuth.getAuthHeaders(),
        getServerUri: (): string | null =>
            deps.plexDiscovery.getServerUri() ?? null,
        getPreferredSubtitleLanguage: (): string | null =>
            deps.subtitlePreferencesStore.readSubtitleLanguage(),
        getPlexPreferredSubtitleLanguage: (): string | null =>
            deps.plexAuth.getCurrentUser()?.preferredSubtitleLanguage ?? null,
        notifySubtitleUnavailable: (): void => {
            deps.nowPlayingHandler()?.({ message: 'Subtitles unavailable for this item', type: 'warning' });
        },
        notifyToast: (message, type): void => {
            const handler = deps.nowPlayingHandler();
            if (!handler) return;
            handler(type ? { message, type } : message);
        },
        subtitlePreferencesStore: deps.subtitlePreferencesStore,
        handleGlobalError: (error: AppError, context: string): void =>
            deps.handleGlobalError(error, context),
    });

    const channelTuning = new ChannelTuningCoordinator({
        getChannelManager: (): IChannelManager | null => deps.channelManager,
        getScheduler: (): IChannelScheduler | null => deps.scheduler,
        getVideoPlayer: (): IVideoPlayer | null => deps.videoPlayer,
        buildDailyScheduleConfig: (
            channel: ChannelConfig,
            items: ResolvedChannelContent['items'],
            referenceTimeMs: number
        ): ScheduleConfig => deps.buildDailyScheduleConfig(channel, items, referenceTimeMs),
        getLocalDayKey: (timeMs: number): number => deps.getLocalDayKey(timeMs),
        setActiveScheduleDayKey: (dayKey: number): void => {
            deps.setActiveScheduleDayKey(dayKey);
        },
        setPendingNowPlayingChannelId: (channelId: string | null): void => {
            deps.playbackState.setPendingNowPlayingChannelId(channelId);
        },
        getPendingNowPlayingChannelId: (): string | null =>
            deps.playbackState.getPendingNowPlayingChannelId(),
        resetPlaybackGuardsForNewChannel: (): void => {
            playbackRecovery.resetPlaybackFailureGuard();
            playbackRecovery.resetDirectFallbackAttempts();
        },
        stopActiveTranscodeSession: (): void => {
            deps.stopActiveTranscodeSession();
        },
        armChannelTransitionForSwitch: (prefix: string): void => {
            channelTransitionCoordinator.armForChannelSwitch(prefix);
        },
        handleGlobalError: (error: AppError, context: string): void =>
            deps.handleGlobalError(error, context),
        saveLifecycleState: (): Promise<void> => deps.lifecycle.saveState(),
    });

    const navigationCoordinator = new NavigationCoordinator({
        navigation: deps.navigation,
        epg: deps.epg,
        videoPlayer: deps.videoPlayer,
        plexAuth: deps.plexAuth,
        stopPlayback: (): void => deps.stopPlayback(),
        pokePlayerOsd: (reason: 'play' | 'pause' | 'seek'): void => {
            playerOsdCoordinator.poke(reason);
        },
        togglePlayerOsd: (): void => {
            playerOsdCoordinator.toggle();
        },
        isPlayerOsdVisible: (): boolean => deps.playerOsd.isVisible(),
        showMiniGuide: (): void => {
            miniGuideCoordinator.show();
        },
        hideMiniGuide: (): void => {
            miniGuideCoordinator.hide();
        },
        isMiniGuideVisible: (): boolean => deps.miniGuide.isVisible(),
        handleMiniGuideNavigation: (direction: 'up' | 'down'): boolean =>
            miniGuideCoordinator.handleNavigation(direction),
        handleMiniGuidePage: (direction: 'up' | 'down'): boolean =>
            miniGuideCoordinator.handlePage(direction),
        handleMiniGuideSelect: (): void => {
            deps.setLastChannelChangeSource('remote');
            miniGuideCoordinator.handleSelect();
        },
        onChannelInputUpdate: (payload: { digits: string; isComplete: boolean }): void => {
            if (payload.digits) {
                deps.channelNumberOverlay.showDigits(payload.digits, CHANNEL_INPUT_CONFIG.MAX_DIGITS);
            }
            if (payload.isComplete) {
                const configuredDelay = deps.config?.channelNumberOverlayConfig?.completeHideDelayMs;
                const delayMs =
                    typeof configuredDelay === 'number' &&
                        Number.isFinite(configuredDelay) &&
                        configuredDelay >= 0
                        ? Math.floor(configuredDelay)
                        : 650;
                deps.channelNumberOverlay.scheduleHide(delayMs);
            }
        },
        getSeekIncrementMs: (): number =>
            (deps.config?.playerConfig.seekIncrementSec ?? 10) * 1000,
        isNowPlayingModalOpen: (): boolean => {
            const isOpen = deps.navigation.isModalOpen(NOW_PLAYING_INFO_MODAL_ID);
            if (isOpen) {
                deps.nowPlayingInfo.resetAutoHideTimer();
            }
            return isOpen;
        },
        toggleNowPlayingInfoOverlay: (): void => deps.toggleNowPlayingInfoOverlay(),
        showNowPlayingInfoOverlay: (): void =>
            nowPlayingInfoCoordinator.handleModalOpen(NOW_PLAYING_INFO_MODAL_ID),
        hideNowPlayingInfoOverlay: (): void =>
            nowPlayingInfoCoordinator.handleModalClose(NOW_PLAYING_INFO_MODAL_ID),
        playbackOptionsModalId: PLAYBACK_OPTIONS_MODAL_ID,
        preparePlaybackOptionsModal: (
            preferredSection?: PlaybackOptionsSectionId
        ): { focusableIds: string[]; preferredFocusId: string | null } =>
            playbackOptionsCoordinator.prepareModal(preferredSection) ??
            { focusableIds: [], preferredFocusId: null },
        showPlaybackOptionsModal: (): void =>
            playbackOptionsCoordinator.handleModalOpen(PLAYBACK_OPTIONS_MODAL_ID),
        hidePlaybackOptionsModal: (): void =>
            playbackOptionsCoordinator.handleModalClose(PLAYBACK_OPTIONS_MODAL_ID),
        exitConfirmModalId: EXIT_CONFIRM_MODAL_ID,
        prepareExitConfirmModal: (): { focusableIds: string[] } => ({
            focusableIds: [...EXIT_CONFIRM_FOCUSABLE_IDS],
        }),
        showExitConfirmModal: (): void =>
            exitConfirmCoordinator.handleModalOpen(EXIT_CONFIRM_MODAL_ID),
        hideExitConfirmModal: (): void =>
            exitConfirmCoordinator.handleModalClose(EXIT_CONFIRM_MODAL_ID),
        setLastChannelChangeSourceRemote: (): void => {
            deps.setLastChannelChangeSource('remote');
        },
        setLastChannelChangeSourceNumber: (): void => {
            deps.setLastChannelChangeSource('number');
        },
        switchToNextChannel: (): void => deps.switchToNextChannel(),
        switchToPreviousChannel: (): void => deps.switchToPreviousChannel(),
        switchToChannelByNumber: (n: number): Promise<ChannelSwitchOutcome> =>
            deps.switchToChannelByNumberWithOutcome(n),
        focusEpgOnCurrentChannel: (): void => {
            epgCoordinator.focusEpgOnCurrentChannel();
        },
        toggleEpg: (): void => deps.toggleEPG(),
        shouldRunChannelSetup: (): boolean => channelSetup.shouldRunChannelSetup(),
        hidePlayerOsd: (): void => {
            playerOsdCoordinator.hide();
        },
        hideChannelTransition: (): void => {
            channelTransitionCoordinator.hide();
        },
        reportToast: (toast: { message: string; type: 'warning' | 'error' | 'info' | 'success' }): void => {
            deps.nowPlayingHandler()?.(toast);
        },
        readKeepPlayingInSettings: (): boolean =>
            deps.profileSessionStore.readKeepPlayingInSettings(false),
    });

    return {
        epgCoordinator,
        channelSetup,
        nowPlayingDebugManager,
        nowPlayingInfoCoordinator,
        playerOsdCoordinator,
        miniGuideCoordinator,
        channelTransitionCoordinator,
        playbackOptionsCoordinator,
        exitConfirmCoordinator,
        playbackRecovery,
        channelTuning,
        navigationCoordinator,
    };
}
