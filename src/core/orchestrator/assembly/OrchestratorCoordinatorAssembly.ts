import type { PlayerOsdCoordinator } from '../../../modules/ui/player-osd';
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
    buildMiniGuideCoordinator,
    buildMiniGuideCoordinatorInput,
    buildNavigationCoordinator,
    buildNavigationCoordinatorInput,
} from './NavigationModalCoordinatorAssembly';
import {
    buildNowPlayingDebugManager,
    buildNowPlayingDebugManagerInput,
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

    let playerOsdCoordinator: PlayerOsdCoordinator | null = null;
    const nowPlayingDebugManager = buildNowPlayingDebugManager(
        buildNowPlayingDebugManagerInput(input),
        () => playerOsdCoordinator
    );

    let playbackOptionsCoordinator: PlaybackOptionsCoordinator | null = null;
    playerOsdCoordinator = buildPlayerOsdCoordinator(
        buildPlayerOsdCoordinatorInput(input),
        (section) => {
            if (!playbackOptionsCoordinator) {
                throw new Error('Playback options policy is not initialized');
            }
            return playbackOptionsCoordinator.getViewModel()[section];
        },
        () => nowPlayingDebugManager.buildNowPlayingStreamDebugText()
    );

    const miniGuideCoordinator = buildMiniGuideCoordinator(buildMiniGuideCoordinatorInput(input));
    const channelTransitionCoordinator = buildChannelTransitionCoordinator(
        buildChannelTransitionCoordinatorInput(input)
    );
    const playbackRecovery = buildPlaybackRecovery(buildPlaybackRecoveryInput(input));
    playbackOptionsCoordinator = buildPlaybackOptionsCoordinator(
        buildPlaybackOptionsCoordinatorInput(input),
        playbackRecovery,
        () => playerOsdCoordinator.refreshIfVisible()
    );
    const channelTuning = buildChannelTuningCoordinator(
        buildChannelTuningInput(input),
        playbackRecovery,
        channelTransitionCoordinator
    );
    const navigationCoordinator = buildNavigationCoordinator(buildNavigationCoordinatorInput(input), {
        epgCoordinator,
        channelSetup: channelSetupOwners.coordinator,
        playerOsdCoordinator,
        miniGuideCoordinator,
        channelTransitionCoordinator,
    });

    return {
        epgCoordinator,
        channelSetup: channelSetupOwners.coordinator,
        channelSetupPortOwners: channelSetupOwners.portOwners,
        nowPlayingDebugManager,
        playerOsdCoordinator,
        miniGuideCoordinator,
        channelTransitionCoordinator,
        playbackOptionsCoordinator,
        playbackRecovery,
        channelTuning,
        navigationCoordinator,
    };
}
