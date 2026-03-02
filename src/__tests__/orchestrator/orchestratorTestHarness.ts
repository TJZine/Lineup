import { AppOrchestrator } from '../../Orchestrator';
import type { OrchestratorEventBinder } from '../../core';
import type { IAppLifecycle } from '../../modules/lifecycle';
import type { IVideoPlayer } from '../../modules/player';
import type { PlaybackRecoveryManager } from '../../modules/player/PlaybackRecoveryManager';
import type { IChannelScheduler } from '../../modules/scheduler/scheduler';

type OrchestratorTestInternals = {
    _scheduler: IChannelScheduler | null;
    _videoPlayer: IVideoPlayer | null;
    _lifecycle: IAppLifecycle | null;
    _playbackRecovery: PlaybackRecoveryManager | null;
    _ensureEventBinder: () => OrchestratorEventBinder;
};

type TestScheduler = Pick<IChannelScheduler, 'resumeSyncTimer' | 'syncToCurrentTime'> & {
    on: (event: 'programStart' | 'programEnd' | 'scheduleSync', handler: unknown) => void;
    off: (event: 'programStart' | 'programEnd' | 'scheduleSync', handler: unknown) => void;
};

type TestVideoPlayer = Pick<IVideoPlayer, 'loadStream' | 'play'> & {
    on: (event: string, handler: unknown) => void;
    off: (event: string, handler: unknown) => void;
};

type TestPlaybackRecovery = Pick<
    PlaybackRecoveryManager,
    'resolveStreamForProgram' | 'resetPlaybackFailureGuard' | 'tryHandleStreamResolverAuthError' | 'handlePlaybackFailure'
>;

export const createWiredTestOrchestrator = (overrides: {
    scheduler: TestScheduler;
    videoPlayer: TestVideoPlayer;
    lifecycle: Pick<IAppLifecycle, 'onPause' | 'onResume'>;
    playbackRecovery: TestPlaybackRecovery;
}): AppOrchestrator => {
    const orchestrator = new AppOrchestrator();

    // NOTE: This harness intentionally couples to AppOrchestrator private internals.
    // It relies on constructor defaults for fields that _ensureEventBinder() reads:
    // - `_eventBinder` starts as null and is created lazily
    // - `_navigationCoordinator` / `_epgCoordinator` may remain null here
    // - the supplied scheduler, player, lifecycle, and playbackRecovery are enough
    // If AppOrchestrator changes those invariants, update this helper accordingly.
    const internals = orchestrator as unknown as OrchestratorTestInternals;
    internals._scheduler = overrides.scheduler as unknown as IChannelScheduler;
    internals._videoPlayer = overrides.videoPlayer as unknown as IVideoPlayer;
    internals._lifecycle = overrides.lifecycle as unknown as IAppLifecycle;
    internals._playbackRecovery = overrides.playbackRecovery as unknown as PlaybackRecoveryManager;
    internals._ensureEventBinder().bind();
    return orchestrator;
};
