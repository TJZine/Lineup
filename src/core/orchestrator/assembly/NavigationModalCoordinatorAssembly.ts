import { CHANNEL_INPUT_CONFIG, type INavigationManager } from '../../../modules/navigation';
import {
    NavigationCoordinator,
    type NavigationCoordinatorHandlers,
} from '../../../modules/navigation/coordinator/NavigationCoordinator';
import { createNavigationCoordinatorRuntimeServices } from '../../../modules/navigation/coordinator/NavigationCoordinatorRuntimeServices';
import type {
    NavigationChannelSwitchOutcome,
    NavigationChannelSwitchingPort,
    NavigationMiniGuideIntent,
    NavigationMiniGuidePort,
    NavigationModalsPort,
    NavigationNowPlayingInfoPort,
    NavigationPlayerOsdIntent,
    NavigationPlaybackOptionsSectionId,
    NavigationPlaybackPort,
} from '../../../modules/navigation/contracts/NavigationFeaturePorts';
import { NavigationChannelNumberHandler } from '../../../modules/navigation/handlers/NavigationChannelNumberHandler';
import { NavigationKeyModeRouter } from '../../../modules/navigation/handlers/NavigationKeyModeRouter';
import { NavigationModalEffectsHandler } from '../../../modules/navigation/handlers/NavigationModalEffectsHandler';
import { NavigationRepeatHandler } from '../../../modules/navigation/handlers/NavigationRepeatHandler';
import {
    NavigationScreenEffectsHandler,
    type NavigationUiGuardsPort,
} from '../../../modules/navigation/handlers/NavigationScreenEffectsHandler';
import type { ChannelConfig, IChannelManager, ResolvedChannelContent } from '../../../modules/scheduler/channel-manager';
import type { IChannelScheduler, ScheduleConfig } from '../../../modules/scheduler/scheduler';
import {
    ExitConfirmCoordinator,
    EXIT_CONFIRM_FOCUSABLE_IDS,
    EXIT_CONFIRM_MODAL_ID,
    type ExitConfirmModal,
} from '../../../modules/ui/exit-confirm';
import type { IMiniGuideOverlay } from '../../../modules/ui/mini-guide';
import { MiniGuideCoordinator } from '../../../modules/ui/mini-guide';
import { NOW_PLAYING_INFO_MODAL_ID, type NowPlayingInfoCoordinator } from '../../../modules/ui/now-playing-info';
import { PLAYBACK_OPTIONS_MODAL_ID, type PlaybackOptionsCoordinator } from '../../../modules/ui/playback-options';
import type { ChannelSetupCoordinator } from '../../channel-setup/ChannelSetupCoordinator';
import type { EPGCoordinator } from '../../../modules/ui/epg/coordinator/EPGCoordinator';
import type { PlayerOsdCoordinator } from '../../../modules/ui/player-osd';
import type { ChannelTransitionCoordinator } from '../../../modules/ui/channel-transition';
import { secondsToMilliseconds } from '../../../config/timing';
import type { ToastInput } from '../../../shared/toast';
import type {
    OrchestratorCoordinatorAssemblyInput,
    OrchestratorExitConfirmCoordinatorBuilderInput,
    OrchestratorMiniGuideCoordinatorBuilderInput,
    OrchestratorNavigationCoordinatorBuilderInput,
} from './OrchestratorCoordinatorContracts';

const DEFAULT_SEEK_INCREMENT_SECONDS = 10;

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

function notifyNavigationToast(
    input: Pick<OrchestratorCoordinatorAssemblyInput, 'nowPlaying'>,
    toast: ToastInput
): void {
    const handler = input.nowPlaying.handler();
    if (!handler) {
        return;
    }
    handler(toast);
}

export function buildNavigationCoordinatorInput(
    input: OrchestratorCoordinatorAssemblyInput
): OrchestratorNavigationCoordinatorBuilderInput {
    return {
        config: input.config,
        modules: {
            navigation: input.modules.navigation,
            epg: input.modules.epg,
            plexAuth: input.modules.plexAuth,
            videoPlayer: input.modules.videoPlayer,
        },
        overlays: {
            playerOsd: input.overlays.playerOsd,
            miniGuide: input.overlays.miniGuide,
            nowPlayingInfo: input.overlays.nowPlayingInfo,
            channelNumberOverlay: input.overlays.channelNumberOverlay,
        },
        stores: {
            developerSettingsStore: input.stores.developerSettingsStore,
            profileSessionStore: input.stores.profileSessionStore,
        },
        diagnostics: {
            reportRecoverableAsyncFailure: input.diagnostics.reportRecoverableAsyncFailure,
            appendIssueDiagnostic: input.diagnostics.appendIssueDiagnostic,
        },
        playback: {
            stopPlayback: input.playback.stopPlayback,
        },
        schedule: {
            setLastChannelChangeSource: input.schedule.setLastChannelChangeSource,
        },
        actions: {
            switchToNextChannel: input.actions.switchToNextChannel,
            switchToPreviousChannel: input.actions.switchToPreviousChannel,
            switchToChannelByNumberWithOutcome: input.actions.switchToChannelByNumberWithOutcome,
            toggleEPG: input.actions.toggleEPG,
            toggleNowPlayingInfoOverlay: input.actions.toggleNowPlayingInfoOverlay,
        },
        nowPlaying: input.nowPlaying,
    };
}

export function buildMiniGuideCoordinatorInput(
    input: OrchestratorCoordinatorAssemblyInput
): OrchestratorMiniGuideCoordinatorBuilderInput {
    return {
        config: input.config,
        modules: {
            channelManager: input.modules.channelManager,
            scheduler: input.modules.scheduler,
        },
        overlays: {
            miniGuide: input.overlays.miniGuide,
        },
        schedule: {
            buildDailyScheduleConfig: input.schedule.buildDailyScheduleConfig,
        },
        actions: {
            switchToChannel: input.actions.switchToChannel,
        },
        nowPlaying: input.nowPlaying,
    };
}

export function buildExitConfirmCoordinatorInput(
    input: OrchestratorCoordinatorAssemblyInput
): OrchestratorExitConfirmCoordinatorBuilderInput {
    return {
        modules: {
            navigation: input.modules.navigation,
        },
        overlays: {
            exitConfirmModal: input.overlays.exitConfirmModal,
        },
    };
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
        notifyToast: (toast: ToastInput): void => notifyNavigationToast(input, toast),
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

function buildNavigationPlaybackConfig(
    input: OrchestratorNavigationCoordinatorBuilderInput,
    deps: NavigationCoordinatorBuilderDeps
): NavigationPlaybackPort {
    return {
        videoPlayer: input.modules.videoPlayer,
        plexAuth: input.modules.plexAuth,
        stopPlayback: (): void => {
            input.playback.stopPlayback();
        },
        getSeekIncrementMs: (): number => getNavigationSeekIncrementMs(input),
        isPlayerOsdVisible: (): boolean => input.overlays.playerOsd?.isVisible() ?? false,
        requestPlayerOsdIntent: (intent: NavigationPlayerOsdIntent): void => {
            if (intent.type === 'poke') {
                deps.playerOsdCoordinator.poke(intent.reason);
                return;
            }
            if (intent.type === 'toggle') {
                deps.playerOsdCoordinator.toggle();
                return;
            }
            deps.playerOsdCoordinator.hide();
        },
    };
}

function buildNavigationMiniGuideConfig(
    input: OrchestratorNavigationCoordinatorBuilderInput,
    deps: NavigationCoordinatorBuilderDeps
): NavigationMiniGuidePort {
    return {
        isVisible: (): boolean => input.overlays.miniGuide?.isVisible() ?? false,
        requestMiniGuideIntent: (intent: NavigationMiniGuideIntent): boolean => {
            if (intent.type === 'show') {
                deps.miniGuideCoordinator.show();
                return true;
            }
            if (intent.type === 'hide') {
                deps.miniGuideCoordinator.hide();
                return true;
            }
            if (intent.type === 'navigate') {
                return deps.miniGuideCoordinator.handleNavigation(intent.direction);
            }
            if (intent.type === 'page') {
                return deps.miniGuideCoordinator.handlePage(intent.direction);
            }
            if (intent.type === 'select') {
                input.schedule.setLastChannelChangeSource('remote');
                deps.miniGuideCoordinator.handleSelect();
                return true;
            }
            return false;
        },
    };
}

function buildNavigationNowPlayingInfoConfig(
    input: OrchestratorNavigationCoordinatorBuilderInput,
    deps: NavigationCoordinatorBuilderDeps
): NavigationNowPlayingInfoPort {
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
): NavigationModalsPort {
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
): NavigationChannelSwitchingPort {
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
): NavigationUiGuardsPort {
    return {
        shouldRunChannelSetup: (): boolean => deps.channelSetup.shouldRunChannelSetup(),
        hideChannelTransition: (): void => {
            deps.channelTransitionCoordinator.hide();
        },
    };
}

export function buildNavigationCoordinator(
    input: OrchestratorNavigationCoordinatorBuilderInput,
    deps: NavigationCoordinatorBuilderDeps
): NavigationCoordinator {
    const playback = buildNavigationPlaybackConfig(input, deps);
    const miniGuide = buildNavigationMiniGuideConfig(input, deps);
    const nowPlayingInfo = buildNavigationNowPlayingInfoConfig(input, deps);
    const modals = buildNavigationModalsConfig(deps);
    const channelSwitching = buildNavigationChannelSwitchingConfig(input, deps);
    const uiGuards = buildNavigationUiGuardsConfig(deps);
    const events = {
        navigation: input.modules.navigation,
        miniGuide,
        channelSwitching,
        reportRecoverableAsyncFailure: input.diagnostics.reportRecoverableAsyncFailure,
        reportToast: (toast: ToastInput): void => {
            notifyNavigationToast(input, toast);
        },
        readDebugLoggingEnabled: (): boolean =>
            input.stores.developerSettingsStore.readDebugLoggingEnabledAndClean(false),
        logDebug: (event: string, payload: Record<string, unknown>): void => {
            input.diagnostics.appendIssueDiagnostic('navigation', event, payload);
        },
    };
    const runtime = createNavigationCoordinatorRuntimeServices(events);
    const repeats = new NavigationRepeatHandler({
        navigation: input.modules.navigation,
        epg: input.modules.epg,
        miniGuide,
    });
    const handlers: NavigationCoordinatorHandlers = {
        repeats,
        keyModeRouter: new NavigationKeyModeRouter(
            {
                navigation: input.modules.navigation,
                epg: input.modules.epg,
                playback,
                miniGuide,
                nowPlayingInfo,
                modals,
                channelSwitching,
            },
            repeats,
            runtime.fireAndReport,
            runtime.observeNonBlockingPromise,
            runtime.logInputNotHandled
        ),
        screenEffects: new NavigationScreenEffectsHandler(
            {
                navigation: input.modules.navigation,
                epg: input.modules.epg,
                playback,
                miniGuide,
                nowPlayingInfo,
                channelSwitching,
                uiGuards,
                readKeepPlayingInSettings: (): boolean =>
                    input.stores.profileSessionStore.readKeepPlayingInSettingsAndClean(false),
            },
            repeats,
            runtime.fireAndReport
        ),
        modalEffects: new NavigationModalEffectsHandler(
            {
                miniGuide,
                nowPlayingInfo,
                modals,
            },
            repeats
        ),
        channelNumber: new NavigationChannelNumberHandler({
            epg: input.modules.epg,
            channelSwitching,
        }),
    };

    return new NavigationCoordinator({
        events,
        handlers,
        guideMiniGuide: {
            hideForGuideToggle: (): void => {
                deps.miniGuideCoordinator.hide();
            },
        },
        runtime,
    });
}
