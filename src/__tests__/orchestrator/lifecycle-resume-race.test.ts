import { AppOrchestrator } from '../../Orchestrator';
import type { StreamDescriptor } from '../../modules/player';
import type { ScheduledProgram } from '../../modules/scheduler/scheduler';

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

describe('AppOrchestrator lifecycle resume', () => {
    it('does not call videoPlayer.play() on resume when sync triggers programStart handling', async () => {
        const orchestrator = new AppOrchestrator();

        const program = {
            scheduleIndex: 0,
            loopNumber: 0,
            scheduledStartTime: 0,
            scheduledEndTime: 1,
            elapsedMs: 0,
            remainingMs: 1,
            item: { durationMs: 1 },
        } as unknown as ScheduledProgram;

        const stream = { url: 'https://example.invalid/stream.m3u8' } as unknown as StreamDescriptor;

        let programStartHandler: ((p: ScheduledProgram) => void) | null = null;
        const scheduler = {
            on: jest.fn((event: string, handler: (payload: unknown) => void) => {
                if (event === 'programStart') {
                    programStartHandler = handler as unknown as (p: ScheduledProgram) => void;
                }
            }),
            off: jest.fn(),
            resumeSyncTimer: jest.fn(),
            syncToCurrentTime: jest.fn(() => {
                programStartHandler?.(program);
            }),
        };

        const loadDeferred = createDeferred<void>();
        const videoPlayer = {
            on: jest.fn(),
            off: jest.fn(),
            loadStream: jest.fn(() => loadDeferred.promise),
            play: jest.fn().mockResolvedValue(undefined),
        };

        let resumeCallback: (() => void | Promise<void>) | null = null;
        const lifecycle = {
            onPause: jest.fn(() => ({ dispose: (): void => undefined })),
            onResume: jest.fn((callback: () => void | Promise<void>) => {
                resumeCallback = callback;
                return { dispose: (): void => undefined };
            }),
        };

        const playbackRecovery = {
            resolveStreamForProgram: jest.fn().mockResolvedValue(stream),
            resetPlaybackFailureGuard: jest.fn(),
            tryHandleStreamResolverAuthError: jest.fn().mockReturnValue(false),
            handlePlaybackFailure: jest.fn(),
        };

        const internals = orchestrator as unknown as {
            _scheduler: unknown;
            _videoPlayer: unknown;
            _lifecycle: unknown;
            _playbackRecovery: unknown;
            _setupEventWiring: () => void;
        };
        internals._scheduler = scheduler;
        internals._videoPlayer = videoPlayer;
        internals._lifecycle = lifecycle;
        internals._playbackRecovery = playbackRecovery;
        internals._setupEventWiring();

        expect(typeof resumeCallback).toBe('function');
        if (!resumeCallback) {
            throw new Error('Expected lifecycle onResume callback to be registered');
        }
        const resumePromise = (resumeCallback as unknown as () => Promise<void>)();

        // With the fix, resume waits for the in-flight programStart handling and does not issue a separate play().
        expect(videoPlayer.play).toHaveBeenCalledTimes(0);

        loadDeferred.resolve(undefined);
        await resumePromise;

        expect(videoPlayer.play).toHaveBeenCalledTimes(1);
    });

    it('suppresses stale programStart play() when a newer programStart arrives during loadStream', async () => {
        const orchestrator = new AppOrchestrator();

        const programA = {
            scheduleIndex: 0,
            loopNumber: 0,
            scheduledStartTime: 0,
            scheduledEndTime: 1,
            elapsedMs: 0,
            remainingMs: 1,
            item: { durationMs: 1 },
        } as unknown as ScheduledProgram;

        const programB = {
            scheduleIndex: 1,
            loopNumber: 0,
            scheduledStartTime: 1,
            scheduledEndTime: 2,
            elapsedMs: 0,
            remainingMs: 1,
            item: { durationMs: 1 },
        } as unknown as ScheduledProgram;

        const streamA = { url: 'https://example.invalid/stream-a.m3u8' } as unknown as StreamDescriptor;
        const streamB = { url: 'https://example.invalid/stream-b.m3u8' } as unknown as StreamDescriptor;

        let programStartHandler: ((p: ScheduledProgram) => void) | null = null;
        const scheduler = {
            on: jest.fn((event: string, handler: (payload: unknown) => void) => {
                if (event === 'programStart') {
                    programStartHandler = handler as unknown as (p: ScheduledProgram) => void;
                }
            }),
            off: jest.fn(),
        };

        const loadA = createDeferred<void>();
        const videoPlayer = {
            on: jest.fn(),
            off: jest.fn(),
            loadStream: jest.fn()
                .mockImplementationOnce(() => loadA.promise)
                .mockResolvedValueOnce(undefined),
            play: jest.fn().mockResolvedValue(undefined),
        };

        const lifecycle = {
            onPause: jest.fn(() => ({ dispose: (): void => undefined })),
            onResume: jest.fn(() => ({ dispose: (): void => undefined })),
        };

        const playbackRecovery = {
            resolveStreamForProgram: jest.fn()
                .mockResolvedValueOnce(streamA)
                .mockResolvedValueOnce(streamB),
            resetPlaybackFailureGuard: jest.fn(),
            tryHandleStreamResolverAuthError: jest.fn().mockReturnValue(false),
            handlePlaybackFailure: jest.fn(),
        };

        const internals = orchestrator as unknown as {
            _scheduler: unknown;
            _videoPlayer: unknown;
            _lifecycle: unknown;
            _playbackRecovery: unknown;
            _setupEventWiring: () => void;
        };
        internals._scheduler = scheduler;
        internals._videoPlayer = videoPlayer;
        internals._lifecycle = lifecycle;
        internals._playbackRecovery = playbackRecovery;
        internals._setupEventWiring();

        expect(programStartHandler).toBeTruthy();
        if (!programStartHandler) {
            throw new Error('Expected scheduler programStart handler to be registered');
        }

        // First program starts, but loadStream is still in-flight.
        (programStartHandler as unknown as (p: ScheduledProgram) => void)(programA);
        await Promise.resolve();
        expect(videoPlayer.loadStream).toHaveBeenCalledTimes(1);
        expect(videoPlayer.play).toHaveBeenCalledTimes(0);

        // Second program starts before the first finishes loading.
        (programStartHandler as unknown as (p: ScheduledProgram) => void)(programB);
        await Promise.resolve();
        expect(videoPlayer.loadStream).toHaveBeenCalledTimes(2);

        // Allow program B to complete its load+play first.
        await Promise.resolve();
        expect(videoPlayer.play).toHaveBeenCalledTimes(1);

        // Now resolve the first load; stale handler must not play.
        loadA.resolve(undefined);
        await Promise.resolve();

        expect(videoPlayer.play).toHaveBeenCalledTimes(1);
    });
});
