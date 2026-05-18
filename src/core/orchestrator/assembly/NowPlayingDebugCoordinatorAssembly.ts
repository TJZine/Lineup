import type { INavigationManager } from '../../../modules/navigation';
import type { IPlexLibrary } from '../../../modules/plex/library';
import type { IPlexStreamResolver, StreamDecision } from '../../../modules/plex/stream';
import type { IChannelScheduler, ScheduledProgram } from '../../../modules/scheduler/scheduler';
import {
    NOW_PLAYING_INFO_MODAL_ID,
    NowPlayingInfoCoordinator,
    getNowPlayingInfoAutoHideMs,
    type INowPlayingInfoOverlay,
    type NowPlayingInfoConfig,
} from '../../../modules/ui/now-playing-info';
import { NowPlayingDebugManager, type NowPlayingDebugOverlayPort } from '../../../modules/debug/NowPlayingDebugManager';
import type { PlaybackInfoSnapshotLike } from '../../../utils/playbackSummary';
import type {
    OrchestratorCoordinatorAssemblyInput,
    OrchestratorNowPlayingDebugManagerBuilderInput,
    OrchestratorNowPlayingInfoCoordinatorBuilderInput,
} from './OrchestratorCoordinatorContracts';

export function buildNowPlayingDebugManagerInput(
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

export function buildNowPlayingInfoCoordinatorInput(
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

export function buildNowPlayingDebugManager(
    input: OrchestratorNowPlayingDebugManagerBuilderInput,
    requestNowPlayingOverlayRefresh: () => void
): NowPlayingDebugManager {
    return new NowPlayingDebugManager({
        nowPlayingModalId: NOW_PLAYING_INFO_MODAL_ID,
        getNavigation: (): INavigationManager | null => input.modules.navigation,
        getStreamResolver: (): IPlexStreamResolver | null => input.modules.plexStreamResolver,
        getNowPlayingInfo: (): NowPlayingDebugOverlayPort | null => {
            const overlay = input.overlays.nowPlayingInfo;
            if (!overlay) {
                return null;
            }
            return {
                isVisible: (): boolean => overlay.isVisible(),
            };
        },
        getCurrentProgram: (): ScheduledProgram | null =>
            input.modules.scheduler.getCurrentProgram() ?? input.playback.state.getCurrentProgramForPlayback(),
        getCurrentStreamDecision: (): StreamDecision | null => input.playback.state.getCurrentStreamDecision(),
        debugOverridesStore: input.stores.debugOverridesStore,
        requestNowPlayingOverlayRefresh,
    });
}

export function buildNowPlayingInfoCoordinator(
    input: OrchestratorNowPlayingInfoCoordinatorBuilderInput,
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
