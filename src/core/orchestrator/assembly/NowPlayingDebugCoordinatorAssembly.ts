import type { INavigationManager } from '../../../modules/navigation';
import type { IPlexStreamResolver, StreamDecision } from '../../../modules/plex/stream';
import type { ScheduledProgram } from '../../../modules/scheduler/scheduler';
import { NowPlayingDebugManager, type PlayerOsdDebugPort } from '../../../modules/debug/NowPlayingDebugManager';
import type {
    OrchestratorCoordinatorAssemblyInput,
    OrchestratorNowPlayingDebugManagerBuilderInput,
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
        stores: {
            debugOverridesStore: input.stores.debugOverridesStore,
        },
        playback: {
            state: input.playback.state,
        },
    };
}

export function buildNowPlayingDebugManager(
    input: OrchestratorNowPlayingDebugManagerBuilderInput,
    getPlayerOsd: () => PlayerOsdDebugPort | null
): NowPlayingDebugManager {
    return new NowPlayingDebugManager({
        getNavigation: (): INavigationManager | null => input.modules.navigation,
        getStreamResolver: (): IPlexStreamResolver | null => input.modules.plexStreamResolver,
        getPlayerOsd,
        getCurrentProgram: (): ScheduledProgram | null =>
            input.modules.scheduler.getCurrentProgram() ?? input.playback.state.getCurrentProgramForPlayback(),
        getCurrentStreamDecision: (): StreamDecision | null => input.playback.state.getCurrentStreamDecision(),
        debugOverridesStore: input.stores.debugOverridesStore,
    });
}
