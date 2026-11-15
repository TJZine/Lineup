import { CHANNEL_INPUT_CONFIG } from '../../../modules/navigation';
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
    NavigationPlayerOsdIntent,
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
import type { IMiniGuideOverlay } from '../../../modules/ui/mini-guide';
import { MiniGuideCoordinator } from '../../../modules/ui/mini-guide';
import type { ChannelSetupCoordinator } from '../../channel-setup/ChannelSetupCoordinator';
import type { EPGCoordinator } from '../../../modules/ui/epg/coordinator/EPGCoordinator';
import type { PlayerOsdCoordinator } from '../../../modules/ui/player-osd';
import type { ChannelTransitionCoordinator } from '../../../modules/ui/channel-transition';
import { secondsToMilliseconds } from '../../../config/timing';
import type { ToastInput } from '../../../shared/toast';
import { normalizeSeekIncrementSeconds } from '../../../modules/player';
import type {
    OrchestratorCoordinatorAssemblyInput,
    OrchestratorMiniGuideCoordinatorBuilderInput,
    OrchestratorNavigationCoordinatorBuilderInput,
} from './OrchestratorCoordinatorContracts';

type NavigationCoordinatorBuilderDeps = {
    epgCoordinator: EPGCoordinator;
    channelSetup: ChannelSetupCoordinator;
    playerOsdCoordinator: PlayerOsdCoordinator;
    miniGuideCoordinator: MiniGuideCoordinator;
    channelTransitionCoordinator: ChannelTransitionCoordinator;
};

function getNavigationSeekIncrementMs(input: OrchestratorNavigationCoordinatorBuilderInput): number {
    return secondsToMilliseconds(normalizeSeekIncrementSeconds(input.config?.playerConfig?.seekIncrementSec));
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
            setPlaybackIntent: input.playback.setPlaybackIntent,
            setPlaybackRouteBlocking: input.playback.setPlaybackRouteBlocking,
        },
        schedule: {
            setLastChannelChangeSource: input.schedule.setLastChannelChangeSource,
        },
        actions: {
            switchToNextChannel: input.actions.switchToNextChannel,
            switchToPreviousChannel: input.actions.switchToPreviousChannel,
            switchToChannelByNumberWithOutcome: input.actions.switchToChannelByNumberWithOutcome,
            toggleEPG: input.actions.toggleEPG,
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
        playback: {
            getWatchingChannelId: input.playback.getWatchingChannelId,
        },
        overlays: {
            miniGuide: input.overlays.miniGuide,
        },
        schedule: {
            buildDailyScheduleConfig: input.schedule.buildDailyScheduleConfig,
        },
        actions: {
            switchToChannel: input.actions.switchToChannel,
            toggleEPG: input.actions.toggleEPG,
        },
        nowPlaying: input.nowPlaying,
    };
}

export function buildMiniGuideCoordinator(
    input: OrchestratorMiniGuideCoordinatorBuilderInput
): MiniGuideCoordinator {
    return new MiniGuideCoordinator({
        getOverlay: (): IMiniGuideOverlay | null => input.overlays.miniGuide,
        getChannelManager: (): IChannelManager | null => input.modules.channelManager,
        getScheduler: (): IChannelScheduler | null => input.modules.scheduler,
        getWatchingChannelId: input.playback.getWatchingChannelId,
        buildDailyScheduleConfig: (
            channel: ChannelConfig,
            items: ResolvedChannelContent['items'],
            referenceTimeMs: number
        ): ScheduleConfig => input.schedule.buildDailyScheduleConfig(channel, items, referenceTimeMs),
        switchToChannel: (channelId: string): Promise<void> => input.actions.switchToChannel(channelId),
        openFullGuide: input.actions.toggleEPG,
        notifyToast: (toast: ToastInput): void => notifyNavigationToast(input, toast),
    });
}

function buildNavigationPlaybackConfig(
    input: OrchestratorNavigationCoordinatorBuilderInput,
    deps: NavigationCoordinatorBuilderDeps
): NavigationPlaybackPort {
    const runPlayerCommand = (
        command: (player: NonNullable<typeof input.modules.videoPlayer>) => Promise<void>
    ): Promise<void> | null => {
        const player = input.modules.videoPlayer;
        if (!player) {
            return null;
        }
        try {
            return command(player);
        } catch (error) {
            return Promise.reject(error);
        }
    };

    return {
        isAuthenticatedForServerSelection: (): boolean => input.modules.plexAuth?.isAuthenticated() ?? false,
        playFromRemote: (): Promise<void> | null => {
            if (!input.playback.setPlaybackIntent('playing')) {
                return Promise.reject(new Error('Select a channel in Guide to start playback.'));
            }
            return Promise.resolve();
        },
        pauseFromRemote: (): boolean => {
            input.playback.setPlaybackIntent('paused');
            return true;
        },
        seekFromRemote: (deltaMs: number): Promise<void> | null =>
            runPlayerCommand((player) => player.seekRelative(deltaMs)),
        pauseForScreenChange: (): boolean => {
            input.playback.setPlaybackRouteBlocking(true);
            return true;
        },
        resumeForScreenChange: (): Promise<void> | null => {
            input.playback.setPlaybackRouteBlocking(false);
            return null;
        },
        stopPlayback: (): void => {
            input.playback.setPlaybackIntent('stopped');
        },
        getSeekIncrementMs: (): number => getNavigationSeekIncrementMs(input),
        isPlayerOsdVisible: (): boolean => input.overlays.playerOsd?.isVisible() ?? false,
        isPlayerTransportContext: (): boolean => {
            const presentation = deps.playerOsdCoordinator.getPresentationState();
            return presentation === 'hidden' || presentation === 'compact' || presentation === 'expanded';
        },
        requestPlayerOsdIntent: (intent: NavigationPlayerOsdIntent): boolean => {
            if (intent.type === 'poke') {
                deps.playerOsdCoordinator.poke(intent.reason);
                return true;
            }
            if (intent.type === 'reveal') {
                deps.playerOsdCoordinator.revealCompact();
                return true;
            }
            if (intent.type === 'down') return deps.playerOsdCoordinator.handleDown();
            if (intent.type === 'toggleExpanded') {
                deps.playerOsdCoordinator.toggleExpanded();
                return true;
            }
            if (intent.type === 'back') return deps.playerOsdCoordinator.handleBack();
            deps.playerOsdCoordinator.hide();
            return true;
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
    const channelSwitching = buildNavigationChannelSwitchingConfig(input, deps);
    const uiGuards = buildNavigationUiGuardsConfig(deps);
    const closeEpg = (): void => deps.epgCoordinator.closeEPG();
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
                closeEpg,
                playback,
                miniGuide,
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
                closeEpg,
                playback,
                miniGuide,
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
            isGuideVisible: (): boolean => input.modules.epg.isVisible(),
        },
        runtime,
    });
}
