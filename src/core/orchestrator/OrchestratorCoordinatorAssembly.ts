import type { NowPlayingInfoCoordinator } from '../../modules/ui/now-playing-info';
import type { PlaybackOptionsCoordinator } from '../../modules/ui/playback-options';
import type {
    OrchestratorChannelSetupBuilderInput,
    OrchestratorChannelTuningBuilderInput,
    OrchestratorCoordinatorAssemblyInput,
    OrchestratorCoordinatorAssemblyInputDraft,
    OrchestratorCoordinators,
    OrchestratorEpgCoordinatorBuilderInput,
    OrchestratorChannelTransitionCoordinatorBuilderInput,
    OrchestratorExitConfirmCoordinatorBuilderInput,
    OrchestratorMiniGuideCoordinatorBuilderInput,
    OrchestratorNavigationCoordinatorBuilderInput,
    OrchestratorNowPlayingDebugManagerBuilderInput,
    OrchestratorNowPlayingInfoCoordinatorBuilderInput,
    OrchestratorPlaybackOptionsCoordinatorBuilderInput,
    OrchestratorPlaybackRecoveryBuilderInput,
    OrchestratorPlayerOsdCoordinatorBuilderInput,
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
    OrchestratorCoordinatorAssemblyInputDraft,
    OrchestratorCoordinators,
} from './OrchestratorCoordinatorContracts';

const COORDINATOR_PRECONDITION_ERROR = 'Orchestrator coordinator initialization requires module instances';

function requireCoordinatorDependency<T>(dependency: T | null): T {
    if (!dependency) {
        throw new Error(COORDINATOR_PRECONDITION_ERROR);
    }

    return dependency;
}

export function createOrchestratorCoordinatorAssemblyInput(
    draft: OrchestratorCoordinatorAssemblyInputDraft
): OrchestratorCoordinatorAssemblyInput {
    const { requiredSurfaces, ...assemblyDraft } = draft;
    requireCoordinatorDependency(requiredSurfaces.channelBadgeOverlay);

    return {
        ...assemblyDraft,
        modules: {
            navigation: requireCoordinatorDependency(draft.modules.navigation),
            plexAuth: requireCoordinatorDependency(draft.modules.plexAuth),
            plexDiscovery: requireCoordinatorDependency(draft.modules.plexDiscovery),
            plexLibrary: requireCoordinatorDependency(draft.modules.plexLibrary),
            plexStreamResolver: requireCoordinatorDependency(draft.modules.plexStreamResolver),
            channelManager: requireCoordinatorDependency(draft.modules.channelManager),
            scheduler: requireCoordinatorDependency(draft.modules.scheduler),
            videoPlayer: requireCoordinatorDependency(draft.modules.videoPlayer),
            lifecycle: requireCoordinatorDependency(draft.modules.lifecycle),
            epg: requireCoordinatorDependency(draft.modules.epg),
        },
        overlays: {
            nowPlayingInfo: requireCoordinatorDependency(draft.overlays.nowPlayingInfo),
            playerOsd: requireCoordinatorDependency(draft.overlays.playerOsd),
            channelNumberOverlay: requireCoordinatorDependency(draft.overlays.channelNumberOverlay),
            miniGuide: requireCoordinatorDependency(draft.overlays.miniGuide),
            channelTransitionOverlay: requireCoordinatorDependency(draft.overlays.channelTransitionOverlay),
            playbackOptionsModal: requireCoordinatorDependency(draft.overlays.playbackOptionsModal),
            exitConfirmModal: requireCoordinatorDependency(draft.overlays.exitConfirmModal),
            sleepTimer: requireCoordinatorDependency(draft.overlays.sleepTimer),
        },
    };
}

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

function buildNowPlayingDebugManagerInput(
    input: OrchestratorCoordinatorAssemblyInput
): OrchestratorNowPlayingDebugManagerBuilderInput {
    return {
        modules: {
            navigation: input.modules.navigation,
            plexStreamResolver: input.modules.plexStreamResolver,
            scheduler: input.modules.scheduler,
        },
        overlays: {
            nowPlayingInfo: input.overlays.nowPlayingInfo,
        },
        stores: {
            debugOverridesStore: input.stores.debugOverridesStore,
        },
        playback: {
            state: input.playback.state,
        },
    };
}

function buildNowPlayingInfoCoordinatorInput(
    input: OrchestratorCoordinatorAssemblyInput
): OrchestratorNowPlayingInfoCoordinatorBuilderInput {
    return {
        config: input.config,
        modules: {
            navigation: input.modules.navigation,
            scheduler: input.modules.scheduler,
            plexLibrary: input.modules.plexLibrary,
        },
        overlays: {
            nowPlayingInfo: input.overlays.nowPlayingInfo,
        },
        stores: {
            nowPlayingDisplayStore: input.stores.nowPlayingDisplayStore,
        },
        playback: {
            state: input.playback.state,
            buildPlexResourceUrl: input.playback.buildPlexResourceUrl,
            getPlaybackInfoSnapshot: input.playback.getPlaybackInfoSnapshot,
            refreshPlaybackInfoSnapshot: input.playback.refreshPlaybackInfoSnapshot,
        },
        actions: {
            onOverlayVisibilityChange: input.actions.onOverlayVisibilityChange,
        },
    };
}

function buildPlayerOsdCoordinatorInput(
    input: OrchestratorCoordinatorAssemblyInput
): OrchestratorPlayerOsdCoordinatorBuilderInput {
    return {
        config: input.config,
        modules: {
            navigation: input.modules.navigation,
            scheduler: input.modules.scheduler,
            channelManager: input.modules.channelManager,
            videoPlayer: input.modules.videoPlayer,
        },
        overlays: {
            playerOsd: input.overlays.playerOsd,
            sleepTimer: input.overlays.sleepTimer,
        },
        stores: {
            nowPlayingDisplayStore: input.stores.nowPlayingDisplayStore,
        },
        playback: {
            state: input.playback.state,
            buildPlexResourceUrl: input.playback.buildPlexResourceUrl,
        },
        actions: {
            onOverlayVisibilityChange: input.actions.onOverlayVisibilityChange,
        },
    };
}

function buildMiniGuideCoordinatorInput(
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

function buildChannelTransitionCoordinatorInput(
    input: OrchestratorCoordinatorAssemblyInput
): OrchestratorChannelTransitionCoordinatorBuilderInput {
    return {
        modules: {
            navigation: input.modules.navigation,
            videoPlayer: input.modules.videoPlayer,
        },
        overlays: {
            channelTransitionOverlay: input.overlays.channelTransitionOverlay,
        },
        actions: {
            onChannelTransitionActivityChange: input.actions.onChannelTransitionActivityChange,
        },
    };
}

function buildPlaybackOptionsCoordinatorInput(
    input: OrchestratorCoordinatorAssemblyInput
): OrchestratorPlaybackOptionsCoordinatorBuilderInput {
    return {
        modules: {
            navigation: input.modules.navigation,
            videoPlayer: input.modules.videoPlayer,
            scheduler: input.modules.scheduler,
        },
        overlays: {
            playbackOptionsModal: input.overlays.playbackOptionsModal,
        },
        stores: {
            subtitlePreferencesStore: input.stores.subtitlePreferencesStore,
        },
        playback: {
            state: input.playback.state,
        },
        nowPlaying: input.nowPlaying,
    };
}

function buildExitConfirmCoordinatorInput(
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
