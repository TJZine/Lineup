import type {
    PriorityOneEventRuntimePort,
    PriorityOneOptionalRuntimeSurfaces,
    PriorityOnePlaybackRuntimePort,
    PriorityOnePlayerEventPort,
    PriorityOneRequiredRuntimeModules,
    PriorityOneSchedulerRuntimePort,
    PriorityOneUiRuntimePort,
} from '../runtime/OrchestratorRuntimeSeams';

export interface PriorityOneAssemblyInput {
    modules: PriorityOneRequiredRuntimeModules;
    surfaces: PriorityOneOptionalRuntimeSurfaces;
    playback: PriorityOnePlaybackRuntimePort;
    schedulerRuntime: PriorityOneSchedulerRuntimePort;
    playerEvents: PriorityOnePlayerEventPort;
    uiRuntime: PriorityOneUiRuntimePort;
    events: PriorityOneEventRuntimePort;
    nowPlayingModalId: string;
}
