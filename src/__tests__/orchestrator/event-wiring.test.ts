import { AppOrchestrator } from '../../Orchestrator';

type SchedulerLike = {
    on: jest.Mock;
    off: jest.Mock;
    skipToNext: jest.Mock;
    pauseSyncTimer: jest.Mock;
    resumeSyncTimer: jest.Mock;
    syncToCurrentTime: jest.Mock;
    unloadChannel: jest.Mock;
};

type VideoPlayerLike = {
    on: jest.Mock;
    off: jest.Mock;
    play: jest.Mock;
    pause: jest.Mock;
    stop: jest.Mock;
    destroy: jest.Mock;
};

type LifecycleLike = {
    onPause: jest.Mock;
    onResume: jest.Mock;
    saveState: jest.Mock;
};

type InitCoordinatorLike = {
    runStartup: jest.Mock;
    clearAuthResume: jest.Mock;
    clearServerResume: jest.Mock;
    clearProfileResume: jest.Mock;
};

type OrchestratorInternals = {
    _scheduler: SchedulerLike | null;
    _videoPlayer: VideoPlayerLike | null;
    _lifecycle: LifecycleLike | null;
    _navigationCoordinator: { wireNavigationEvents: () => Array<() => void> } | null;
    _epgCoordinator: { wireEpgEvents: () => Array<() => void> } | null;
    _initCoordinator: InitCoordinatorLike | null;
    _setupEventWiring: () => void;
};

const createHarness = (): {
    orchestrator: AppOrchestrator;
    scheduler: SchedulerLike;
    videoPlayer: VideoPlayerLike;
} => {
    const orchestrator = new AppOrchestrator();
    const internals = orchestrator as unknown as OrchestratorInternals;

    const scheduler: SchedulerLike = {
        on: jest.fn(),
        off: jest.fn(),
        skipToNext: jest.fn(),
        pauseSyncTimer: jest.fn(),
        resumeSyncTimer: jest.fn(),
        syncToCurrentTime: jest.fn(),
        unloadChannel: jest.fn(),
    };

    const videoPlayer: VideoPlayerLike = {
        on: jest.fn(),
        off: jest.fn(),
        play: jest.fn().mockResolvedValue(undefined),
        pause: jest.fn(),
        stop: jest.fn(),
        destroy: jest.fn(),
    };

    const lifecycle: LifecycleLike = {
        onPause: jest.fn(),
        onResume: jest.fn(),
        saveState: jest.fn().mockResolvedValue(undefined),
    };

    internals._scheduler = scheduler;
    internals._videoPlayer = videoPlayer;
    internals._lifecycle = lifecycle;
    internals._navigationCoordinator = {
        wireNavigationEvents: (): Array<() => void> => [],
    };
    internals._epgCoordinator = {
        wireEpgEvents: (): Array<() => void> => [],
    };
    internals._initCoordinator = {
        runStartup: jest.fn(async () => {
            internals._setupEventWiring();
        }),
        clearAuthResume: jest.fn(),
        clearServerResume: jest.fn(),
        clearProfileResume: jest.fn(),
    };

    return { orchestrator, scheduler, videoPlayer };
};

describe('AppOrchestrator event wiring characterization', () => {
    it('wires subscriptions once even if startup wiring is invoked multiple times', async () => {
        const { orchestrator, scheduler, videoPlayer } = createHarness();

        await orchestrator.start();
        const schedulerOnCallsAfterFirstStart = scheduler.on.mock.calls.length;
        const playerOnCallsAfterFirstStart = videoPlayer.on.mock.calls.length;

        await orchestrator.start();

        expect(scheduler.on.mock.calls.length).toBe(schedulerOnCallsAfterFirstStart);
        expect(videoPlayer.on.mock.calls.length).toBe(playerOnCallsAfterFirstStart);
    });

    it('unsubscribes all wired handlers during shutdown', async () => {
        const { orchestrator, scheduler, videoPlayer } = createHarness();

        await orchestrator.start();
        await orchestrator.shutdown();

        expect(scheduler.off).toHaveBeenCalledWith('programStart', expect.any(Function));
        expect(scheduler.off).toHaveBeenCalledWith('scheduleSync', expect.any(Function));
        expect(videoPlayer.off).toHaveBeenCalledWith('ended', expect.any(Function));
        expect(videoPlayer.off).toHaveBeenCalledWith('error', expect.any(Function));
    });
});
