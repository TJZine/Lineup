import type {
    PriorityOneEventRuntimePort,
    PriorityOneOptionalRuntimeSurfaces,
    PriorityOnePlaybackRuntimePort,
    PriorityOnePlayerEventPort,
    PriorityOneRequiredRuntimeModules,
    PriorityOneSchedulerRuntimePort,
    PriorityOneUiRuntimePort,
} from '../OrchestratorRuntimeSeams';
import type { PriorityOneAssemblyInput } from './PriorityOneAssemblyInput';

export interface PriorityOneAssemblyBuilderInput {
    modules: PriorityOneRequiredRuntimeModules;
    surfaces: PriorityOneOptionalRuntimeSurfaces;
    playback: PriorityOnePlaybackRuntimePort;
    schedulerRuntime: PriorityOneSchedulerRuntimePort;
    playerEvents: PriorityOnePlayerEventPort;
    uiRuntime: PriorityOneUiRuntimePort;
    events: PriorityOneEventRuntimePort;
    nowPlayingModalId: string;
}

export function createPriorityOneAssembly(
    input: PriorityOneAssemblyBuilderInput
): PriorityOneAssemblyInput {
    return {
        modules: input.modules,
        surfaces: input.surfaces,
        playback: input.playback,
        schedulerRuntime: input.schedulerRuntime,
        playerEvents: input.playerEvents,
        uiRuntime: input.uiRuntime,
        events: input.events,
        nowPlayingModalId: input.nowPlayingModalId,
    };
}
