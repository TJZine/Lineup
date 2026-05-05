import {
    OrchestratorEventBinder,
    type OrchestratorEventBinderDeps,
} from '../../core/orchestrator/events/OrchestratorEventBinder';
import { AppErrorCode } from '../../types/app-errors';
import type { IAppLifecycle } from '../../modules/lifecycle';
import type { INavigationManager } from '../../modules/navigation';
import type { IVideoPlayer } from '../../modules/player';
import type { IPlexLibrary } from '../../modules/plex/library';
import type { IPlexStreamResolver } from '../../modules/plex/stream';
import type { IChannelManager } from '../../modules/scheduler/channel-manager';
import type { IChannelScheduler, ScheduledProgram } from '../../modules/scheduler/scheduler';
import { createDeferred, flushPromises } from '../helpers';

type BinderHarness = {
    binder: OrchestratorEventBinder;
    deps: OrchestratorEventBinderDeps;
    scheduler: IChannelScheduler;
    videoPlayer: IVideoPlayer;
    plexLibrary: IPlexLibrary;
    plexStreamResolver: IPlexStreamResolver;
    navigation: INavigationManager;
    lifecycle: IAppLifecycle;
    channelManager: IChannelManager;
    navigationCleanup: jest.Mock;
    epgCleanup: jest.Mock;
    persistenceDispose: jest.Mock;
    pauseDispose: jest.Mock;
    resumeDispose: jest.Mock;
    getPauseCallback: () => (() => void | Promise<void>) | null;
    getResumeCallback: () => (() => void | Promise<void>) | null;
    getPersistenceWarningCallback: () => ((payload: {
        message: string;
        code: AppErrorCode;
        isQuotaError: boolean;
        timestamp: number;
    }) => void) | null;
};

const makeBinder = (overrides: Partial<OrchestratorEventBinderDeps> = {}): BinderHarness => {
    let pauseCallback: (() => void | Promise<void>) | null = null;
    let resumeCallback: (() => void | Promise<void>) | null = null;
    let persistenceWarningCallback: ((payload: {
        message: string;
        code: AppErrorCode;
        isQuotaError: boolean;
        timestamp: number;
    }) => void) | null = null;

    const navigationCleanup = jest.fn();
    const epgCleanup = jest.fn();
    const persistenceDispose = jest.fn();
    const pauseDispose = jest.fn();
    const resumeDispose = jest.fn();

    const scheduler = {
        on: jest.fn(),
        off: jest.fn(),
    } as unknown as IChannelScheduler;
    const videoPlayer = {
        on: jest.fn(),
        off: jest.fn(),
    } as unknown as IVideoPlayer;
    const plexLibrary = {
        on: jest.fn(),
        off: jest.fn(),
    } as unknown as IPlexLibrary;
    const plexStreamResolver = {
        on: jest.fn(),
        off: jest.fn(),
    } as unknown as IPlexStreamResolver;
    const navigation = {
        on: jest.fn(),
        off: jest.fn(),
    } as unknown as INavigationManager;
    const lifecycle = {
        onPause: jest.fn((callback: () => void | Promise<void>) => {
            pauseCallback = callback;
            return { dispose: pauseDispose };
        }),
        onResume: jest.fn((callback: () => void | Promise<void>) => {
            resumeCallback = callback;
            return { dispose: resumeDispose };
        }),
    } as unknown as IAppLifecycle;
    const channelManager = {
        on: jest.fn((event: string, callback: unknown) => {
            if (event === 'persistenceWarning') {
                persistenceWarningCallback = callback as (payload: {
                    message: string;
                    code: AppErrorCode;
                    isQuotaError: boolean;
                    timestamp: number;
                }) => void;
            }
            return { dispose: persistenceDispose };
        }),
    } as unknown as IChannelManager;

    const deps: OrchestratorEventBinderDeps = {
        cleanupReporter: jest.fn(),
        getScheduler: () => scheduler,
        getVideoPlayer: () => videoPlayer,
        getPlexLibrary: () => plexLibrary,
        getPlexStreamResolver: () => plexStreamResolver,
        getNavigation: () => navigation,
        getLifecycle: () => lifecycle,
        getChannelManager: () => channelManager,
        wireNavigationCoordinatorEvents: () => [navigationCleanup],
        wireEpgCoordinatorEvents: () => [epgCleanup],
        handleProgramStartTracked: jest.fn(async () => undefined),
        handleScheduleDayRollover: jest.fn(async () => undefined),
        handlePlayerEnded: jest.fn(),
        handlePlayerTrackChange: jest.fn(),
        handlePlaybackError: jest.fn(),
        handlePlayerStateChange: jest.fn(),
        handlePlayerTimeUpdate: jest.fn(),
        handlePlayerBufferUpdate: jest.fn(),
        handlePlexLibraryAuthExpired: jest.fn(),
        handlePlexStreamError: jest.fn(),
        handleScreenChange: jest.fn(),
        handleLifecyclePause: jest.fn(async () => undefined),
        handleLifecycleResume: jest.fn(async () => undefined),
        reportPersistenceWarning: jest.fn(),
        reportRecoverableAsyncFailure: jest.fn(),
        ...overrides,
    };

    return {
        binder: new OrchestratorEventBinder(deps),
        deps,
        scheduler,
        videoPlayer,
        plexLibrary,
        plexStreamResolver,
        navigation,
        lifecycle,
        channelManager,
        navigationCleanup,
        epgCleanup,
        persistenceDispose,
        pauseDispose,
        resumeDispose,
        getPauseCallback: () => pauseCallback,
        getResumeCallback: () => resumeCallback,
        getPersistenceWarningCallback: () => persistenceWarningCallback,
    };
};

describe('AppOrchestrator event wiring', () => {
    it('forwards programStart to the playback-start handler', async () => {
        const {
            binder,
            scheduler,
            deps,
        } = makeBinder();

        const program = {
            item: {
                ratingKey: 'item-1',
                title: 'Test Item',
                durationMs: 60_000,
                type: 'movie',
            },
            elapsedMs: 0,
            scheduledStartTime: 0,
            scheduledEndTime: 60_000,
            remainingMs: 60_000,
            scheduleIndex: 0,
            loopNumber: 0,
            streamDescriptor: null,
            isCurrent: true,
        } as unknown as ScheduledProgram;

        binder.bind();
        const programStartCall = (scheduler.on as jest.Mock).mock.calls.find(
            ([event]) => event === 'programStart'
        );
        const programStartHandler =
            programStartCall?.[1] as ((programToStart: ScheduledProgram) => void) | undefined;

        expect(programStartHandler).toBeDefined();
        await programStartHandler?.(program);
        expect(deps.handleProgramStartTracked).toHaveBeenCalledWith(program);
    });

    it('bind registers every handler and dispose unwires every cleanup', () => {
        const {
            binder,
            scheduler,
            videoPlayer,
            plexLibrary,
            plexStreamResolver,
            navigation,
            lifecycle,
            channelManager,
            navigationCleanup,
            epgCleanup,
            persistenceDispose,
            pauseDispose,
            resumeDispose,
            getPauseCallback,
            getResumeCallback,
        } = makeBinder();

        binder.bind();

        expect(scheduler.on).toHaveBeenCalledWith('programStart', expect.any(Function));
        expect(scheduler.on).toHaveBeenCalledWith('scheduleSync', expect.any(Function));
        expect(videoPlayer.on).toHaveBeenCalledWith('ended', expect.any(Function));
        expect(videoPlayer.on).toHaveBeenCalledWith('trackChange', expect.any(Function));
        expect(videoPlayer.on).toHaveBeenCalledWith('error', expect.any(Function));
        expect(videoPlayer.on).toHaveBeenCalledWith('stateChange', expect.any(Function));
        expect(videoPlayer.on).toHaveBeenCalledWith('timeUpdate', expect.any(Function));
        expect(videoPlayer.on).toHaveBeenCalledWith('bufferUpdate', expect.any(Function));
        expect(plexLibrary.on).toHaveBeenCalledWith('authExpired', expect.any(Function));
        expect(plexStreamResolver.on).toHaveBeenCalledWith('error', expect.any(Function));
        expect(navigation.on).toHaveBeenCalledWith('screenChange', expect.any(Function));
        expect(channelManager.on).toHaveBeenCalledWith('persistenceWarning', expect.any(Function));
        expect(lifecycle.onPause).toHaveBeenCalledTimes(1);
        expect(lifecycle.onResume).toHaveBeenCalledTimes(1);
        expect(typeof getPauseCallback()).toBe('function');
        expect(typeof getResumeCallback()).toBe('function');

        binder.dispose();

        expect(scheduler.off).toHaveBeenCalledWith('programStart', expect.any(Function));
        expect(scheduler.off).toHaveBeenCalledWith('scheduleSync', expect.any(Function));
        expect(videoPlayer.off).toHaveBeenCalledWith('ended', expect.any(Function));
        expect(videoPlayer.off).toHaveBeenCalledWith('trackChange', expect.any(Function));
        expect(videoPlayer.off).toHaveBeenCalledWith('error', expect.any(Function));
        expect(videoPlayer.off).toHaveBeenCalledWith('stateChange', expect.any(Function));
        expect(videoPlayer.off).toHaveBeenCalledWith('timeUpdate', expect.any(Function));
        expect(videoPlayer.off).toHaveBeenCalledWith('bufferUpdate', expect.any(Function));
        expect(plexLibrary.off).toHaveBeenCalledWith('authExpired', expect.any(Function));
        expect(plexStreamResolver.off).toHaveBeenCalledWith('error', expect.any(Function));
        expect(navigation.off).toHaveBeenCalledWith('screenChange', expect.any(Function));
        expect(navigationCleanup).toHaveBeenCalledTimes(1);
        expect(epgCleanup).toHaveBeenCalledTimes(1);
        expect(persistenceDispose).toHaveBeenCalledTimes(1);
        expect(pauseDispose).toHaveBeenCalledTimes(1);
        expect(resumeDispose).toHaveBeenCalledTimes(1);
    });

    it('wires pause/resume callbacks that stay pending until async work finishes', async () => {
        const pauseDeferred = createDeferred<void>();
        const resumeDeferred = createDeferred<void>();

        const { binder, getPauseCallback, getResumeCallback } = makeBinder({
            handleLifecyclePause: jest.fn(() => pauseDeferred.promise),
            handleLifecycleResume: jest.fn(() => resumeDeferred.promise),
        });

        binder.bind();

        const pauseCallback = getPauseCallback();
        const resumeCallback = getResumeCallback();

        expect(typeof pauseCallback).toBe('function');
        expect(typeof resumeCallback).toBe('function');
        if (pauseCallback === null) {
            throw new Error('Expected pause callback to be registered');
        }
        if (resumeCallback === null) {
            throw new Error('Expected resume callback to be registered');
        }

        const pausePromise = Promise.resolve(pauseCallback());
        let pauseSettled = false;
        void pausePromise.then(() => {
            pauseSettled = true;
        });
        await flushPromises(1);
        expect(pauseSettled).toBe(false);

        pauseDeferred.resolve(undefined);
        await pausePromise;
        expect(pauseSettled).toBe(true);

        const resumePromise = Promise.resolve(resumeCallback());
        let resumeSettled = false;
        void resumePromise.then(() => {
            resumeSettled = true;
        });
        await flushPromises(1);
        expect(resumeSettled).toBe(false);

        resumeDeferred.resolve(undefined);
        await resumePromise;
        expect(resumeSettled).toBe(true);
    });

    it('forwards the full persistenceWarning payload from channel manager events', () => {
        const { binder, deps, getPersistenceWarningCallback } = makeBinder();

        binder.bind();

        const persistenceWarningCallback = getPersistenceWarningCallback();
        expect(typeof persistenceWarningCallback).toBe('function');
        persistenceWarningCallback?.({
            message: 'Storage full - some settings may not be saved',
            code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
            isQuotaError: true,
            timestamp: 123,
        });

        expect(deps.reportPersistenceWarning).toHaveBeenCalledWith({
            message: 'Storage full - some settings may not be saved',
            code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
            isQuotaError: true,
            timestamp: 123,
        });
    });

    it('bind is idempotent until dispose is called', () => {
        const { binder, scheduler } = makeBinder();

        binder.bind();
        binder.bind();

        expect(scheduler.on).toHaveBeenCalledTimes(2);

        binder.dispose();
        binder.bind();

        expect(scheduler.on).toHaveBeenCalledTimes(4);
    });

    it('bind rolls back partial wiring when a later stage throws and can be retried', () => {
        const scheduler = {
            on: jest.fn(),
            off: jest.fn(),
        } as unknown as IChannelScheduler;
        const videoPlayer = {
            on: jest
                .fn()
                .mockImplementationOnce(() => undefined)
                .mockImplementationOnce(() => undefined)
                .mockImplementationOnce(() => {
                    throw new Error('wire-player-failed');
                })
                .mockImplementation(() => undefined),
            off: jest.fn(),
        } as unknown as IVideoPlayer;

        const { binder } = makeBinder({
            getScheduler: () => scheduler,
            getVideoPlayer: () => videoPlayer,
        });

        expect(() => binder.bind()).toThrow('wire-player-failed');
        expect(scheduler.off).toHaveBeenCalledWith('programStart', expect.any(Function));
        expect(scheduler.off).toHaveBeenCalledWith('scheduleSync', expect.any(Function));
        expect(videoPlayer.off).toHaveBeenCalledWith('ended', expect.any(Function));
        expect(videoPlayer.off).toHaveBeenCalledWith('trackChange', expect.any(Function));

        binder.bind();

        expect(scheduler.on).toHaveBeenCalledTimes(4);
        expect(videoPlayer.on).toHaveBeenCalledWith('bufferUpdate', expect.any(Function));
    });

    it('dispose forwards cleanup failures to the supplied sink and resets wiring state', () => {
        const onCleanupError = jest.fn();
        const throwingCleanup = jest.fn(() => {
            throw new Error('cleanup-failed');
        });

        const { binder, scheduler } = makeBinder({
            wireNavigationCoordinatorEvents: () => [throwingCleanup],
            getNavigation: () => null,
        });

        binder.bind();

        expect(() => binder.dispose(onCleanupError)).not.toThrow();
        expect(onCleanupError).toHaveBeenCalledTimes(1);
        expect(onCleanupError).toHaveBeenCalledWith(expect.any(Error));

        binder.bind();

        expect(scheduler.on).toHaveBeenCalledTimes(4);
    });

    it('dispose reports cleanup failures through the injected cleanup reporter when no sink is supplied', () => {
        const cleanupReporter = jest.fn();
        const throwingCleanup = jest.fn(() => {
            throw new Error('cleanup-failed');
        });

        const { binder } = makeBinder({
            cleanupReporter,
            wireNavigationCoordinatorEvents: () => [throwingCleanup],
            getNavigation: () => null,
        });

        binder.bind();
        binder.dispose();

        expect(cleanupReporter).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    step: 'event-wiring.cleanup',
                }),
            ])
        );
    });

    it('dispose reports cleanup sink failures through the injected cleanup reporter', () => {
        const cleanupReporter = jest.fn();
        const onCleanupError = jest.fn(() => {
            throw new Error('sink-failed');
        });
        const throwingCleanup = jest.fn(() => {
            throw new Error('cleanup-failed');
        });

        const { binder } = makeBinder({
            cleanupReporter,
            wireNavigationCoordinatorEvents: () => [throwingCleanup],
            getNavigation: () => null,
        });

        binder.bind();
        expect(() => binder.dispose(onCleanupError)).not.toThrow();

        expect(onCleanupError).toHaveBeenCalledTimes(1);
        expect(cleanupReporter).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    step: 'event-wiring.cleanup',
                }),
                expect.objectContaining({
                    step: 'event-wiring.onCleanupError',
                }),
            ])
        );
        const reportedFailures = cleanupReporter.mock.calls[0]?.[0] ?? [];
        expect(reportedFailures).toHaveLength(2);
    });
});
