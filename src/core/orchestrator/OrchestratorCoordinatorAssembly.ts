import type { NowPlayingInfoCoordinator } from '../../modules/ui/now-playing-info/NowPlayingInfoCoordinator';
import type { PlaybackOptionsCoordinator } from '../../modules/ui/playback-options/PlaybackOptionsCoordinator';
import type {
    OrchestratorCoordinatorFactoryDeps,
    OrchestratorCoordinators,
} from './OrchestratorCoordinatorContracts';
import {
    buildChannelSetupCoordinator,
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

export function createOrchestratorCoordinators(
    input: OrchestratorCoordinatorFactoryDeps
): OrchestratorCoordinators {
    const epgCoordinator = buildEpgCoordinator(input);
    bindEpgVisibleRangeChange(input, epgCoordinator);

    const channelSetup = buildChannelSetupCoordinator(input, epgCoordinator);

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
    const navigationCoordinator = buildNavigationCoordinator(input, {
        epgCoordinator,
        channelSetup,
        nowPlayingInfoCoordinator,
        playerOsdCoordinator,
        miniGuideCoordinator,
        channelTransitionCoordinator,
        playbackOptionsCoordinator,
        exitConfirmCoordinator,
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
