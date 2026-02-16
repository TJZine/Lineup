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

type NavigationLike = {
    on: jest.Mock;
    off: jest.Mock;
    destroy: jest.Mock;
};

type PlexLibraryLike = {
    on: jest.Mock;
    off: jest.Mock;
};

type PlexStreamResolverLike = {
    on: jest.Mock;
    off: jest.Mock;
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
    _navigation: NavigationLike | null;
    _plexLibrary: PlexLibraryLike | null;
    _plexStreamResolver: PlexStreamResolverLike | null;
    _navigationCoordinator: { wireNavigationEvents: () => Array<() => void> } | null;
    _epgCoordinator: { wireEpgEvents: () => Array<() => void> } | null;
    _initCoordinator: InitCoordinatorLike | null;
    _setupEventWiring: () => void;
};

type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
};

const createDeferred = <T>(): Deferred<T> => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const createHarness = (): {
    orchestrator: AppOrchestrator;
    scheduler: SchedulerLike;
    videoPlayer: VideoPlayerLike;
    lifecycle: LifecycleLike;
    navigation: NavigationLike;
    plexLibrary: PlexLibraryLike;
    plexStreamResolver: PlexStreamResolverLike;
    navigationCleanup: jest.Mock;
    epgCleanup: jest.Mock;
    getPauseCallback: () => (() => void | Promise<void>) | null;
    getResumeCallback: () => (() => void | Promise<void>) | null;
} => {
    const orchestrator = new AppOrchestrator();
    const internals = orchestrator as unknown as OrchestratorInternals;
    let pauseCallback: (() => void | Promise<void>) | null = null;
    let resumeCallback: (() => void | Promise<void>) | null = null;
    const navigationCleanup = jest.fn();
    const epgCleanup = jest.fn();

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
        onPause: jest.fn((callback: () => void | Promise<void>) => {
            pauseCallback = callback;
        }),
        onResume: jest.fn((callback: () => void | Promise<void>) => {
            resumeCallback = callback;
        }),
        saveState: jest.fn().mockResolvedValue(undefined),
    };

    const navigation: NavigationLike = {
        on: jest.fn(),
        off: jest.fn(),
        destroy: jest.fn(),
    };

    const plexLibrary: PlexLibraryLike = {
        on: jest.fn(),
        off: jest.fn(),
    };

    const plexStreamResolver: PlexStreamResolverLike = {
        on: jest.fn(),
        off: jest.fn(),
    };

    internals._scheduler = scheduler;
    internals._videoPlayer = videoPlayer;
    internals._lifecycle = lifecycle;
    internals._navigation = navigation;
    internals._plexLibrary = plexLibrary;
    internals._plexStreamResolver = plexStreamResolver;
    internals._navigationCoordinator = {
        wireNavigationEvents: (): Array<() => void> => [navigationCleanup],
    };
    internals._epgCoordinator = {
        wireEpgEvents: (): Array<() => void> => [epgCleanup],
    };
    internals._initCoordinator = {
        runStartup: jest.fn(async () => {
            internals._setupEventWiring();
        }),
        clearAuthResume: jest.fn(),
        clearServerResume: jest.fn(),
        clearProfileResume: jest.fn(),
    };

    return {
        orchestrator,
        scheduler,
        videoPlayer,
        lifecycle,
        navigation,
        plexLibrary,
        plexStreamResolver,
        navigationCleanup,
        epgCleanup,
        getPauseCallback: () => pauseCallback,
        getResumeCallback: () => resumeCallback,
    };
};

describe('AppOrchestrator event wiring characterization', () => {
    it('wires subscriptions once even if startup wiring is invoked multiple times', async () => {
        const { orchestrator, scheduler, videoPlayer, navigation, plexLibrary, plexStreamResolver, lifecycle } = createHarness();

        await orchestrator.start();
        const schedulerOnCallsAfterFirstStart = scheduler.on.mock.calls.length;
        const playerOnCallsAfterFirstStart = videoPlayer.on.mock.calls.length;
        const navigationOnCallsAfterFirstStart = navigation.on.mock.calls.length;
        const plexLibraryOnCallsAfterFirstStart = plexLibrary.on.mock.calls.length;
        const plexStreamOnCallsAfterFirstStart = plexStreamResolver.on.mock.calls.length;
        const lifecyclePauseCallsAfterFirstStart = lifecycle.onPause.mock.calls.length;
        const lifecycleResumeCallsAfterFirstStart = lifecycle.onResume.mock.calls.length;

        await orchestrator.start();

        expect(scheduler.on.mock.calls.length).toBe(schedulerOnCallsAfterFirstStart);
        expect(videoPlayer.on.mock.calls.length).toBe(playerOnCallsAfterFirstStart);
        expect(navigation.on.mock.calls.length).toBe(navigationOnCallsAfterFirstStart);
        expect(plexLibrary.on.mock.calls.length).toBe(plexLibraryOnCallsAfterFirstStart);
        expect(plexStreamResolver.on.mock.calls.length).toBe(plexStreamOnCallsAfterFirstStart);
        expect(lifecycle.onPause.mock.calls.length).toBe(lifecyclePauseCallsAfterFirstStart);
        expect(lifecycle.onResume.mock.calls.length).toBe(lifecycleResumeCallsAfterFirstStart);
    });

    it('unsubscribes all wired handlers during shutdown', async () => {
        const {
            orchestrator,
            scheduler,
            videoPlayer,
            navigation,
            plexLibrary,
            plexStreamResolver,
            navigationCleanup,
            epgCleanup,
        } = createHarness();

        await orchestrator.start();
        await orchestrator.shutdown();

        expect(scheduler.off).toHaveBeenCalledWith('programStart', expect.any(Function));
        expect(scheduler.off).toHaveBeenCalledWith('scheduleSync', expect.any(Function));
        expect(videoPlayer.off).toHaveBeenCalledWith('ended', expect.any(Function));
        expect(videoPlayer.off).toHaveBeenCalledWith('trackChange', expect.any(Function));
        expect(videoPlayer.off).toHaveBeenCalledWith('error', expect.any(Function));
        expect(videoPlayer.off).toHaveBeenCalledWith('stateChange', expect.any(Function));
        expect(videoPlayer.off).toHaveBeenCalledWith('timeUpdate', expect.any(Function));
        expect(videoPlayer.off).toHaveBeenCalledWith('bufferUpdate', expect.any(Function));
        expect(navigation.off).toHaveBeenCalledWith('screenChange', expect.any(Function));
        expect(plexLibrary.off).toHaveBeenCalledWith('authExpired', expect.any(Function));
        expect(plexStreamResolver.off).toHaveBeenCalledWith('error', expect.any(Function));
        expect(navigationCleanup).toHaveBeenCalledTimes(1);
        expect(epgCleanup).toHaveBeenCalledTimes(1);
    });

    it('registers lifecycle callbacks that stay pending until async pause/resume work finishes', async () => {
        const {
            orchestrator,
            scheduler,
            videoPlayer,
            lifecycle,
            getPauseCallback,
            getResumeCallback,
        } = createHarness();

        await orchestrator.start();

        const pauseCallback = getPauseCallback();
        const resumeCallback = getResumeCallback();
        expect(pauseCallback).toBeDefined();
        expect(resumeCallback).toBeDefined();

        const pauseDeferred = createDeferred<void>();
        lifecycle.saveState.mockReturnValueOnce(pauseDeferred.promise);

        const pauseResult = pauseCallback?.();
        expect(pauseResult).toBeDefined();
        expect(typeof (pauseResult as Promise<void>).then).toBe('function');
        expect(videoPlayer.pause).toHaveBeenCalledTimes(1);
        expect(scheduler.pauseSyncTimer).toHaveBeenCalledTimes(1);

        let pauseSettled = false;
        void (pauseResult as Promise<void>).then(() => {
            pauseSettled = true;
        });
        await Promise.resolve();
        expect(pauseSettled).toBe(false);

        pauseDeferred.resolve(undefined);
        await pauseResult;
        expect(pauseSettled).toBe(true);

        const resumeDeferred = createDeferred<void>();
        videoPlayer.play.mockReturnValueOnce(resumeDeferred.promise);

        const resumeResult = resumeCallback?.();
        expect(resumeResult).toBeDefined();
        expect(typeof (resumeResult as Promise<void>).then).toBe('function');
        expect(scheduler.resumeSyncTimer).toHaveBeenCalledTimes(1);
        expect(scheduler.syncToCurrentTime).toHaveBeenCalledTimes(1);

        let resumeSettled = false;
        void (resumeResult as Promise<void>).then(() => {
            resumeSettled = true;
        });
        await Promise.resolve();
        expect(resumeSettled).toBe(false);

        resumeDeferred.resolve(undefined);
        await resumeResult;
        expect(resumeSettled).toBe(true);
    });
});
