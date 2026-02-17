import { AppOrchestrator } from '../../Orchestrator';
import type { IAppLifecycle } from '../../modules/lifecycle';
import type { INavigationManager } from '../../modules/navigation';
import type { IVideoPlayer } from '../../modules/player';
import type { IPlexLibrary } from '../../modules/plex/library';
import type { IPlexStreamResolver } from '../../modules/plex/stream';
import type { IChannelScheduler } from '../../modules/scheduler/scheduler';
import { createDeferred, flushPromises } from '../helpers';

describe('AppOrchestrator event wiring', () => {
    it('returns cleanups that unsubscribe all wired handlers', () => {
        let pauseCallback: (() => void | Promise<void>) | null = null;
        let resumeCallback: (() => void | Promise<void>) | null = null;
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

        const navigationCleanup = jest.fn();
        const epgCleanup = jest.fn();

        const orchestrator = new AppOrchestrator() as unknown as {
            _scheduler: IChannelScheduler | null;
            _videoPlayer: IVideoPlayer | null;
            _plexLibrary: IPlexLibrary | null;
            _plexStreamResolver: IPlexStreamResolver | null;
            _navigation: INavigationManager | null;
            _lifecycle: IAppLifecycle | null;
            _navigationCoordinator: { wireNavigationEvents: () => Array<() => void> } | null;
            _epgCoordinator: { wireEpgEvents: () => Array<() => void> } | null;
            _eventsWired: boolean;
            _eventUnsubscribers: Array<() => void>;
            _setupEventWiring: () => void;

            _handleProgramStartTracked: jest.Mock;
            _handleScheduleDayRollover: jest.Mock;
            _handlePlayerEnded: jest.Mock;
            _handlePlayerTrackChange: jest.Mock;
            _handlePlaybackError: jest.Mock;
            _handlePlayerStateChange: jest.Mock;
            _handlePlayerTimeUpdate: jest.Mock;
            _handlePlayerBufferUpdate: jest.Mock;
            _handlePlexLibraryAuthExpired: jest.Mock;
            _handlePlexStreamError: jest.Mock;
            _handleScreenChange: jest.Mock;
            _handleLifecyclePause: jest.Mock;
            _handleLifecycleResume: jest.Mock;
        };

        orchestrator._scheduler = scheduler;
        orchestrator._videoPlayer = videoPlayer;
        orchestrator._plexLibrary = plexLibrary;
        orchestrator._plexStreamResolver = plexStreamResolver;
        orchestrator._navigation = navigation;
        orchestrator._lifecycle = lifecycle;
        orchestrator._navigationCoordinator = { wireNavigationEvents: (): Array<() => void> => [navigationCleanup] };
        orchestrator._epgCoordinator = { wireEpgEvents: (): Array<() => void> => [epgCleanup] };

        orchestrator._handleProgramStartTracked = jest.fn(async () => undefined);
        orchestrator._handleScheduleDayRollover = jest.fn(async () => undefined);
        orchestrator._handlePlayerEnded = jest.fn();
        orchestrator._handlePlayerTrackChange = jest.fn();
        orchestrator._handlePlaybackError = jest.fn();
        orchestrator._handlePlayerStateChange = jest.fn();
        orchestrator._handlePlayerTimeUpdate = jest.fn();
        orchestrator._handlePlayerBufferUpdate = jest.fn();
        orchestrator._handlePlexLibraryAuthExpired = jest.fn();
        orchestrator._handlePlexStreamError = jest.fn();
        orchestrator._handleScreenChange = jest.fn();
        orchestrator._handleLifecyclePause = jest.fn(async () => undefined);
        orchestrator._handleLifecycleResume = jest.fn(async () => undefined);

        orchestrator._eventsWired = false;
        orchestrator._eventUnsubscribers = [];
        orchestrator._setupEventWiring();

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

        for (const cleanup of orchestrator._eventUnsubscribers) {
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

        const lifecycle = {
            onPause: jest.fn((cb: () => void | Promise<void>) => {
                pauseCallback = cb;
                return { dispose: (): void => undefined };
            }),
            onResume: jest.fn((cb: () => void | Promise<void>) => {
                resumeCallback = cb;
                return { dispose: (): void => undefined };
            }),
        } as unknown as IAppLifecycle;

        const orchestrator = new AppOrchestrator() as unknown as {
            _lifecycle: IAppLifecycle | null;
            _eventsWired: boolean;
            _eventUnsubscribers: Array<() => void>;
            _setupEventWiring: () => void;
            _handleLifecyclePause: jest.Mock;
            _handleLifecycleResume: jest.Mock;
        };

        orchestrator._lifecycle = lifecycle;
        orchestrator._handleLifecyclePause = jest.fn(() => pauseDeferred.promise);
        orchestrator._handleLifecycleResume = jest.fn(() => resumeDeferred.promise);
        orchestrator._eventsWired = false;
        orchestrator._eventUnsubscribers = [];

        orchestrator._setupEventWiring();

        expect(typeof pauseCallback).toBe('function');
        expect(typeof resumeCallback).toBe('function');
        if (pauseCallback === null) {
            throw new Error('Expected pause callback to be registered');
        }
        if (resumeCallback === null) {
            throw new Error('Expected resume callback to be registered');
        }

        const pausePromise = Promise.resolve((pauseCallback as () => void | Promise<void>)());
        let pauseSettled = false;
        void pausePromise.then(() => {
            pauseSettled = true;
        });
        await flushPromises(1);
        expect(pauseSettled).toBe(false);

        pauseDeferred.resolve(undefined);
        await pausePromise;
        expect(pauseSettled).toBe(true);

        const resumePromise = Promise.resolve((resumeCallback as () => void | Promise<void>)());
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
});
