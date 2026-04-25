import type { NowPlayingInfoCoordinator } from '../../modules/ui/now-playing-info';
import type { PlaybackOptionsCoordinator } from '../../modules/ui/playback-options';
import type {
    OrchestratorChannelSetupBuilderInput,
    OrchestratorChannelTuningBuilderInput,
    OrchestratorCoordinatorAssemblyInput,
    OrchestratorCoordinators,
    OrchestratorEpgCoordinatorBuilderInput,
    OrchestratorNavigationCoordinatorBuilderInput,
    OrchestratorPlaybackRecoveryBuilderInput,
} from './OrchestratorCoordinatorContracts';
import {
    buildChannelSetupOwners,
    buildChannelTransitionCoordinator,
    buildChannelTuningCoordinator,
    buildEpgCoordinator,
    bindEpgVisibleRangeChange,
    buildExitConfirmCoordinator,
    buildMiniGuideCoordinator,
    buildNavigationCoordinator,
    buildNowPlayingDebugManager,
    buildNowPlayingInfoCoordinator,
    buildPlaybackOptionsCoordinator,
    buildPlaybackRecovery,
    buildPlayerOsdCoordinator,
} from './OrchestratorCoordinatorBuilders';

export type {
    OrchestratorCoordinatorAssemblyInput,
    OrchestratorCoordinators,
} from './OrchestratorCoordinatorContracts';

function buildEpgCoordinatorInput(
    input: OrchestratorCoordinatorAssemblyInput
): OrchestratorEpgCoordinatorBuilderInput {
    return {
        epgDebugRuntime: input.epgDebugRuntime,
        config: input.config,
        moduleStatus: input.moduleStatus,
        init: input.init,
        modules: {
            epg: input.modules.epg,
            channelManager: input.modules.channelManager,
            scheduler: input.modules.scheduler,
        },
        stores: {
            epgPreferencesStore: input.stores.epgPreferencesStore,
        },
        diagnostics: {
            appendIssueDiagnostic: input.diagnostics.appendIssueDiagnostic,
        },
        schedule: {
            lastChannelChangeSource: input.schedule.lastChannelChangeSource,
            setLastChannelChangeSource: input.schedule.setLastChannelChangeSource,
            getLocalMidnightMs: input.schedule.getLocalMidnightMs,
            buildDailyScheduleConfig: input.schedule.buildDailyScheduleConfig,
        },
        actions: {
            switchToChannel: input.actions.switchToChannel,
            onOverlayVisibilityChange: input.actions.onOverlayVisibilityChange,
        },
        nowPlaying: input.nowPlaying,
    };
}

function buildChannelSetupInput(
    input: OrchestratorCoordinatorAssemblyInput
): OrchestratorChannelSetupBuilderInput {
    return {
        init: input.init,
        modules: {
            navigation: input.modules.navigation,
            plexLibrary: input.modules.plexLibrary,
            channelManager: input.modules.channelManager,
        },
        schedule: {
            getSelectedServerId: input.schedule.getSelectedServerId,
        },
    };
}

function buildPlaybackRecoveryInput(
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

function buildChannelTuningInput(
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

function buildNavigationCoordinatorInput(
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

export function createOrchestratorCoordinators(
    input: OrchestratorCoordinatorAssemblyInput
): OrchestratorCoordinators {
    const epgInput = buildEpgCoordinatorInput(input);
    const epgCoordinator = buildEpgCoordinator(epgInput);
    bindEpgVisibleRangeChange(epgInput, epgCoordinator);

    const channelSetupOwners = buildChannelSetupOwners(buildChannelSetupInput(input), epgCoordinator);

    let nowPlayingInfoCoordinator: NowPlayingInfoCoordinator | null = null;
    const nowPlayingDebugManager = buildNowPlayingDebugManager(
        input,
        (): void => nowPlayingInfoCoordinator?.refreshIfOpen()
    );

    nowPlayingInfoCoordinator = buildNowPlayingInfoCoordinator(input, nowPlayingDebugManager);

    let playbackOptionsCoordinator: PlaybackOptionsCoordinator | null = null;
    const playerOsdCoordinator = buildPlayerOsdCoordinator(
        input,
        (preferredSection) =>
            playbackOptionsCoordinator?.prepareModal(preferredSection) ??
            { focusableIds: [], preferredFocusId: null }
    );

    const miniGuideCoordinator = buildMiniGuideCoordinator(input);
    const channelTransitionCoordinator = buildChannelTransitionCoordinator(input);
    const playbackRecovery = buildPlaybackRecovery(buildPlaybackRecoveryInput(input));
    playbackOptionsCoordinator = buildPlaybackOptionsCoordinator(input, playbackRecovery);
    const exitConfirmCoordinator = buildExitConfirmCoordinator(input);
    const channelTuning = buildChannelTuningCoordinator(
        buildChannelTuningInput(input),
        playbackRecovery,
        channelTransitionCoordinator
    );
    const navigationCoordinator = buildNavigationCoordinator(buildNavigationCoordinatorInput(input), {
        epgCoordinator,
        channelSetup: channelSetupOwners.coordinator,
        nowPlayingInfoCoordinator,
        playerOsdCoordinator,
        miniGuideCoordinator,
        channelTransitionCoordinator,
        playbackOptionsCoordinator,
        exitConfirmCoordinator,
    });

    return {
        epgCoordinator,
        channelSetup: channelSetupOwners.coordinator,
        channelSetupPortOwners: channelSetupOwners.portOwners,
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
