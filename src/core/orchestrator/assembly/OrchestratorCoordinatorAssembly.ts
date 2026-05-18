import type { NowPlayingInfoCoordinator } from '../../../modules/ui/now-playing-info';
import type { PlaybackOptionsCoordinator } from '../../../modules/ui/playback-options';
import type {
    OrchestratorCoordinatorAssemblyInput,
    OrchestratorCoordinatorAssemblyInputDraft,
    OrchestratorCoordinators,
} from './OrchestratorCoordinatorContracts';
import {
    buildChannelSetupOwners,
    buildChannelSetupInput,
    buildEpgCoordinator,
    buildEpgCoordinatorInput,
    bindEpgVisibleRangeChange,
} from './EpgChannelSetupCoordinatorAssembly';
import {
    buildExitConfirmCoordinator,
    buildExitConfirmCoordinatorInput,
    buildMiniGuideCoordinator,
    buildMiniGuideCoordinatorInput,
    buildNavigationCoordinator,
    buildNavigationCoordinatorInput,
} from './NavigationModalCoordinatorAssembly';
import {
    buildNowPlayingDebugManager,
    buildNowPlayingDebugManagerInput,
    buildNowPlayingInfoCoordinator,
    buildNowPlayingInfoCoordinatorInput,
} from './NowPlayingDebugCoordinatorAssembly';
import {
    buildChannelTransitionCoordinator,
    buildChannelTransitionCoordinatorInput,
    buildChannelTuningCoordinator,
    buildChannelTuningInput,
    buildPlaybackOptionsCoordinator,
    buildPlaybackOptionsCoordinatorInput,
    buildPlaybackRecovery,
    buildPlaybackRecoveryInput,
    buildPlayerOsdCoordinator,
    buildPlayerOsdCoordinatorInput,
} from './PlaybackOsdCoordinatorAssembly';

export type {
    OrchestratorCoordinatorAssemblyInput,
    OrchestratorCoordinatorAssemblyInputDraft,
    OrchestratorCoordinators,
} from './OrchestratorCoordinatorContracts';

const COORDINATOR_PRECONDITION_ERROR = 'Orchestrator coordinator initialization requires module instances';

function requireCoordinatorDependency<T>(dependencyName: string, dependency: T | null): T {
    if (!dependency) {
        throw new Error(`${COORDINATOR_PRECONDITION_ERROR}: ${dependencyName}`);
    }

    return dependency;
}

export function createOrchestratorCoordinatorAssemblyInput(
    draft: OrchestratorCoordinatorAssemblyInputDraft
): OrchestratorCoordinatorAssemblyInput {
    const { requiredSurfaces, ...assemblyDraft } = draft;
    requireCoordinatorDependency('requiredSurfaces.channelBadgeOverlay', requiredSurfaces.channelBadgeOverlay);

    return {
        ...assemblyDraft,
        modules: {
            navigation: requireCoordinatorDependency('modules.navigation', draft.modules.navigation),
            plexAuth: requireCoordinatorDependency('modules.plexAuth', draft.modules.plexAuth),
            plexDiscovery: requireCoordinatorDependency('modules.plexDiscovery', draft.modules.plexDiscovery),
            plexLibrary: requireCoordinatorDependency('modules.plexLibrary', draft.modules.plexLibrary),
            plexStreamResolver: requireCoordinatorDependency('modules.plexStreamResolver', draft.modules.plexStreamResolver),
            channelManager: requireCoordinatorDependency('modules.channelManager', draft.modules.channelManager),
            scheduler: requireCoordinatorDependency('modules.scheduler', draft.modules.scheduler),
            videoPlayer: requireCoordinatorDependency('modules.videoPlayer', draft.modules.videoPlayer),
            lifecycle: requireCoordinatorDependency('modules.lifecycle', draft.modules.lifecycle),
            epg: requireCoordinatorDependency('modules.epg', draft.modules.epg),
        },
        overlays: {
            nowPlayingInfo: requireCoordinatorDependency('overlays.nowPlayingInfo', draft.overlays.nowPlayingInfo),
            playerOsd: requireCoordinatorDependency('overlays.playerOsd', draft.overlays.playerOsd),
            channelNumberOverlay: requireCoordinatorDependency(
                'overlays.channelNumberOverlay',
                draft.overlays.channelNumberOverlay
            ),
            miniGuide: requireCoordinatorDependency('overlays.miniGuide', draft.overlays.miniGuide),
            channelTransitionOverlay: requireCoordinatorDependency(
                'overlays.channelTransitionOverlay',
                draft.overlays.channelTransitionOverlay
            ),
            playbackOptionsModal: requireCoordinatorDependency(
                'overlays.playbackOptionsModal',
                draft.overlays.playbackOptionsModal
            ),
            exitConfirmModal: requireCoordinatorDependency('overlays.exitConfirmModal', draft.overlays.exitConfirmModal),
            sleepTimer: requireCoordinatorDependency('overlays.sleepTimer', draft.overlays.sleepTimer),
        },
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
        buildNowPlayingDebugManagerInput(input),
        (): void => nowPlayingInfoCoordinator?.refreshIfOpen()
    );

    nowPlayingInfoCoordinator = buildNowPlayingInfoCoordinator(
        buildNowPlayingInfoCoordinatorInput(input),
        nowPlayingDebugManager
    );

    let playbackOptionsCoordinator: PlaybackOptionsCoordinator | null = null;
    const playerOsdCoordinator = buildPlayerOsdCoordinator(
        buildPlayerOsdCoordinatorInput(input),
        (preferredSection) =>
            playbackOptionsCoordinator?.prepareModal(preferredSection) ??
            { focusableIds: [], preferredFocusId: null }
    );

    const miniGuideCoordinator = buildMiniGuideCoordinator(buildMiniGuideCoordinatorInput(input));
    const channelTransitionCoordinator = buildChannelTransitionCoordinator(
        buildChannelTransitionCoordinatorInput(input)
    );
    const playbackRecovery = buildPlaybackRecovery(buildPlaybackRecoveryInput(input));
    playbackOptionsCoordinator = buildPlaybackOptionsCoordinator(
        buildPlaybackOptionsCoordinatorInput(input),
        playbackRecovery
    );
    const exitConfirmCoordinator = buildExitConfirmCoordinator(buildExitConfirmCoordinatorInput(input));
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
