import { AppOrchestrator } from '../../Orchestrator';

export type OrchestratorTestInternals = {
    _scheduler: unknown;
    _videoPlayer: unknown;
    _lifecycle: unknown;
    _playbackRecovery: unknown;
    _setupEventWiring: () => void;
};

export const createWiredTestOrchestrator = (overrides: {
    scheduler: unknown;
    videoPlayer: unknown;
    lifecycle: unknown;
    playbackRecovery: unknown;
}): AppOrchestrator => {
    const orchestrator = new AppOrchestrator();
    const internals = orchestrator as unknown as OrchestratorTestInternals;
    internals._scheduler = overrides.scheduler;
    internals._videoPlayer = overrides.videoPlayer;
    internals._lifecycle = overrides.lifecycle;
    internals._playbackRecovery = overrides.playbackRecovery;
    internals._setupEventWiring();
    return orchestrator;
};

