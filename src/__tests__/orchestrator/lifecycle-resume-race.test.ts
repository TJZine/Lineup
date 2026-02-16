import type { StreamDescriptor } from '../../modules/player';
import type { ScheduledProgram } from '../../modules/scheduler/scheduler';
import { createDeferred, flushPromises } from '../helpers';
import { createWiredTestOrchestrator } from './orchestratorTestHarness';

describe('AppOrchestrator lifecycle resume', () => {
    it('does not call videoPlayer.play() on resume when sync triggers programStart handling', async () => {
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

        type SchedulerLike = {
            on: jest.Mock<void, [event: 'programStart' | 'scheduleSync', handler: unknown]>;
            off: jest.Mock;
            resumeSyncTimer: jest.Mock;
            syncToCurrentTime: jest.Mock;
        };

        let registeredProgramStart = false;
        let programStartHandler: (p: ScheduledProgram) => void = () => {
            throw new Error('Expected scheduler programStart handler to be registered');
        };
        const scheduler: SchedulerLike = {
            on: jest.fn((event: 'programStart' | 'scheduleSync', handler: unknown) => {
                if (event !== 'programStart') return;
                registeredProgramStart = true;
                programStartHandler = handler as (program: ScheduledProgram) => void;
            }),
            off: jest.fn(),
            resumeSyncTimer: jest.fn(),
            syncToCurrentTime: jest.fn(() => {
                programStartHandler(program);
            }),
        };

        const loadDeferred = createDeferred<void>();
        const videoPlayer = {
            on: jest.fn(),
            off: jest.fn(),
            loadStream: jest.fn(() => loadDeferred.promise),
            play: jest.fn().mockResolvedValue(undefined),
        };

        let registeredResume = false;
        let resumeCallback: () => Promise<void> = () => {
            throw new Error('Expected lifecycle onResume callback to be registered');
        };
        const lifecycle = {
            onPause: jest.fn(() => ({ dispose: (): void => undefined })),
            onResume: jest.fn((callback: () => Promise<void>) => {
                registeredResume = true;
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

        createWiredTestOrchestrator({ scheduler, videoPlayer, lifecycle, playbackRecovery });

        expect(registeredProgramStart).toBe(true);
        expect(registeredResume).toBe(true);
        const resumePromise = resumeCallback();

        // With the fix, resume waits for the in-flight programStart handling and does not issue a separate play().
        expect(videoPlayer.play).toHaveBeenCalledTimes(0);

        loadDeferred.resolve(undefined);
        await resumePromise;

        expect(videoPlayer.play).toHaveBeenCalledTimes(1);
    });

    it('suppresses stale programStart play() when a newer programStart arrives during loadStream', async () => {
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

        type SchedulerLike = {
            on: jest.Mock<void, [event: 'programStart' | 'scheduleSync', handler: unknown]>;
            off: jest.Mock;
        };

        let registeredProgramStart = false;
        let programStartHandler: (p: ScheduledProgram) => void = () => {
            throw new Error('Expected scheduler programStart handler to be registered');
        };
        const scheduler: SchedulerLike = {
            on: jest.fn((event: 'programStart' | 'scheduleSync', handler: unknown) => {
                if (event !== 'programStart') return;
                registeredProgramStart = true;
                programStartHandler = handler as (program: ScheduledProgram) => void;
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

        createWiredTestOrchestrator({ scheduler, videoPlayer, lifecycle, playbackRecovery });

        expect(registeredProgramStart).toBe(true);

        // First program starts, but loadStream is still in-flight.
        programStartHandler(programA);
        await flushPromises(6);
        expect(videoPlayer.loadStream).toHaveBeenCalledTimes(1);
        expect(videoPlayer.play).toHaveBeenCalledTimes(0);

        // Second program starts before the first finishes loading.
        programStartHandler(programB);
        await flushPromises(6);
        expect(videoPlayer.loadStream).toHaveBeenCalledTimes(2);

        // Allow program B to complete its load+play first.
        await flushPromises(6);
        expect(videoPlayer.play).toHaveBeenCalledTimes(1);

        // Now resolve the first load; stale handler must not play.
        loadA.resolve(undefined);
        await flushPromises(6);

        expect(videoPlayer.play).toHaveBeenCalledTimes(1);
    });
});
