import type { NowPlayingInfoCoordinator } from '../../modules/ui/now-playing-info';
import type { PlaybackOptionsCoordinator } from '../../modules/ui/playback-options/PlaybackOptionsCoordinator';
import type {
    OrchestratorCoordinatorFactoryDeps,
    OrchestratorCoordinators,
    OrchestratorNavigationCoordinatorBuilderInput,
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

function buildNavigationCoordinatorInput(
    input: OrchestratorCoordinatorFactoryDeps
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
    input: OrchestratorCoordinatorFactoryDeps
): OrchestratorCoordinators {
    const epgCoordinator = buildEpgCoordinator(input);
    bindEpgVisibleRangeChange(input, epgCoordinator);

    const channelSetupOwners = buildChannelSetupOwners(input, epgCoordinator);

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
    const playbackRecovery = buildPlaybackRecovery(input);
    playbackOptionsCoordinator = buildPlaybackOptionsCoordinator(input, playbackRecovery);
    const exitConfirmCoordinator = buildExitConfirmCoordinator(input);
    const channelTuning = buildChannelTuningCoordinator(
        input,
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
        channelSetupWorkflow: channelSetupOwners.workflow,
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
