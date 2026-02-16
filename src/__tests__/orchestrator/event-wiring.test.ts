import { OrchestratorEventWiringCoordinator } from '../../core/orchestrator/OrchestratorEventWiringCoordinator';
import type { IAppLifecycle } from '../../modules/lifecycle';
import type { INavigationManager } from '../../modules/navigation';
import type { IVideoPlayer } from '../../modules/player';
import type { IPlexLibrary } from '../../modules/plex/library';
import type { IPlexStreamResolver } from '../../modules/plex/stream';
import type { IChannelScheduler } from '../../modules/scheduler/scheduler';

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

describe('OrchestratorEventWiringCoordinator', () => {
    it('returns cleanups that unsubscribe all wired handlers', () => {
        let pauseCallback: (() => void | Promise<void>) | null = null;
        let resumeCallback: (() => void | Promise<void>) | null = null;
        const pauseDispose = jest.fn();
        const resumeDispose = jest.fn();

        const programStartHandlerRef: { current: ((p: unknown) => void) | null } = { current: null };
        const scheduleSyncHandlerRef: { current: (() => void) | null } = { current: null };

        const scheduler = {
            on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
                if (event === 'programStart') {
                    programStartHandlerRef.current = handler as (p: unknown) => void;
                }
                if (event === 'scheduleSync') {
                    scheduleSyncHandlerRef.current = handler as () => void;
                }
            }),
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

        const navigationCleanup = jest.fn();
        const epgCleanup = jest.fn();

        const coordinator = new OrchestratorEventWiringCoordinator({
            getScheduler: (): IChannelScheduler | null => scheduler,
            getVideoPlayer: (): IVideoPlayer | null => videoPlayer,
            getPlexLibrary: (): IPlexLibrary | null => plexLibrary,
            getPlexStreamResolver: (): IPlexStreamResolver | null => plexStreamResolver,
            getNavigation: (): INavigationManager | null => navigation,
            getLifecycle: (): IAppLifecycle | null => lifecycle,
            wireNavigationEvents: (): Array<() => void> => [navigationCleanup],
            wireEpgEvents: (): Array<() => void> => [epgCleanup],
            onProgramStart: jest.fn(async () => undefined),
            onScheduleSync: jest.fn(async () => undefined),
            onPlayerEnded: jest.fn(),
            onPlayerTrackChange: jest.fn(),
            onPlaybackError: jest.fn(),
            onPlayerStateChange: jest.fn(),
            onPlayerTimeUpdate: jest.fn(),
            onPlayerBufferUpdate: jest.fn(),
            onPlexLibraryAuthExpired: jest.fn(),
            onPlexStreamError: jest.fn(),
            onScreenChange: jest.fn(),
            onPause: jest.fn(async () => undefined),
            onResume: jest.fn(async () => undefined),
        });

        const cleanups = coordinator.setupCoreEvents();

        expect(scheduler.on).toHaveBeenCalledWith('programStart', expect.any(Function));
        expect(scheduler.on).toHaveBeenCalledWith('scheduleSync', expect.any(Function));
        expect(videoPlayer.on).toHaveBeenCalledWith('ended', expect.any(Function));
        expect(videoPlayer.on).toHaveBeenCalledWith('trackChange', expect.any(Function));
        expect(videoPlayer.on).toHaveBeenCalledWith('error', expect.any(Function));
        expect(videoPlayer.on).toHaveBeenCalledWith('stateChange', expect.any(Function));
        expect(videoPlayer.on).toHaveBeenCalledWith('timeUpdate', expect.any(Function));
        expect(videoPlayer.on).toHaveBeenCalledWith('bufferUpdate', expect.any(Function));
        expect(navigation.on).toHaveBeenCalledWith('screenChange', expect.any(Function));
        expect(plexLibrary.on).toHaveBeenCalledWith('authExpired', expect.any(Function));
        expect(plexStreamResolver.on).toHaveBeenCalledWith('error', expect.any(Function));
        expect(lifecycle.onPause).toHaveBeenCalledTimes(1);
        expect(lifecycle.onResume).toHaveBeenCalledTimes(1);
        expect(typeof pauseCallback).toBe('function');
        expect(typeof resumeCallback).toBe('function');
        expect(typeof programStartHandlerRef.current).toBe('function');
        expect(typeof scheduleSyncHandlerRef.current).toBe('function');

        for (const cleanup of cleanups) {
            cleanup();
        }

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
        expect(pauseDispose).toHaveBeenCalledTimes(1);
        expect(resumeDispose).toHaveBeenCalledTimes(1);
    });

    it('wires pause/resume callbacks that stay pending until async work finishes', async () => {
        const pauseDeferred = createDeferred<void>();
        const resumeDeferred = createDeferred<void>();

        let pauseCallback: (() => void | Promise<void>) | null = null;
        let resumeCallback: (() => void | Promise<void>) | null = null;

        const coordinator = new OrchestratorEventWiringCoordinator({
            getScheduler: (): IChannelScheduler | null => null,
            getVideoPlayer: (): IVideoPlayer | null => null,
            getPlexLibrary: (): IPlexLibrary | null => null,
            getPlexStreamResolver: (): IPlexStreamResolver | null => null,
            getNavigation: (): INavigationManager | null => null,
            getLifecycle: (): IAppLifecycle | null => ({
                onPause: (cb: () => void | Promise<void>) => {
                    pauseCallback = cb;
                    return { dispose: (): void => undefined };
                },
                onResume: (cb: () => void | Promise<void>) => {
                    resumeCallback = cb;
                    return { dispose: (): void => undefined };
                },
            } as unknown as IAppLifecycle),
            wireNavigationEvents: (): Array<() => void> => [],
            wireEpgEvents: (): Array<() => void> => [],
            onProgramStart: jest.fn(async () => undefined),
            onScheduleSync: jest.fn(async () => undefined),
            onPlayerEnded: jest.fn(),
            onPlayerTrackChange: jest.fn(),
            onPlaybackError: jest.fn(),
            onPlayerStateChange: jest.fn(),
            onPlayerTimeUpdate: jest.fn(),
            onPlayerBufferUpdate: jest.fn(),
            onPlexLibraryAuthExpired: jest.fn(),
            onPlexStreamError: jest.fn(),
            onScreenChange: jest.fn(),
            onPause: jest.fn(() => pauseDeferred.promise),
            onResume: jest.fn(() => resumeDeferred.promise),
        });

        coordinator.setupCoreEvents();

        expect(typeof pauseCallback).toBe('function');
        expect(typeof resumeCallback).toBe('function');

        const pauseResult = (pauseCallback as unknown as () => Promise<void>)();
        expect(pauseResult).toBeDefined();
        expect(typeof (pauseResult as Promise<void>).then).toBe('function');

        let pauseSettled = false;
        void (pauseResult as Promise<void>).then(() => {
            pauseSettled = true;
        });
        await Promise.resolve();
        expect(pauseSettled).toBe(false);

        pauseDeferred.resolve(undefined);
        await pauseResult;
        expect(pauseSettled).toBe(true);

        const resumeResult = (resumeCallback as unknown as () => Promise<void>)();
        expect(resumeResult).toBeDefined();
        expect(typeof (resumeResult as Promise<void>).then).toBe('function');

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
