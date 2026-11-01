/** @jest-environment jsdom */
import { PlaybackStartController, type PlaybackStartControllerDeps } from '../priority-one/PlaybackStartController';
import { SupportReportPreferencesStore } from '../../../modules/settings/SupportReportPreferencesStore';
import { SupportReportStore } from '../../../modules/support/SupportReportStore';
import type { ScheduledProgram } from '../../../modules/scheduler/scheduler';
import { makePreparedPlaybackStream } from '../../../__tests__/fixtures/preparedPlaybackStream';

const makePrepared = (): ReturnType<typeof makePreparedPlaybackStream> =>
    makePreparedPlaybackStream('http://test/stream.mp4');

const makeProgram = (ratingKey = 'item-1'): ScheduledProgram => ({
    item: {
        ratingKey,
        title: 'Test Item',
        durationMs: 60_000,
        type: 'movie',
    } as ScheduledProgram['item'],
    elapsedMs: 5000,
    scheduledStartTime: 0,
    scheduledEndTime: 60_000,
    remainingMs: 55_000,
    scheduleIndex: 0,
} as ScheduledProgram);

const makeDeps = (
    overrides: Partial<PlaybackStartControllerDeps> = {}
): PlaybackStartControllerDeps => {
    const deps: PlaybackStartControllerDeps = {
        getVideoPlayer: () => ({
            loadStream: jest.fn().mockResolvedValue(undefined),
            play: jest.fn().mockResolvedValue(undefined),
            getCurrentDescriptor: jest.fn().mockReturnValue(null),
            stop: jest.fn(),
        }),
        captureAdmission: jest.fn().mockReturnValue(1),
        isAdmissionCurrent: jest.fn().mockReturnValue(true),
        resolveStreamForProgram: jest.fn().mockResolvedValue(makePrepared()),
        discardPreparedStream: jest.fn().mockResolvedValue(undefined),
        resetPlaybackFailureGuard: jest.fn(),
        tryHandleStreamResolverAuthError: jest.fn().mockReturnValue(false),
        tryHandleStreamResolverPermissionError: jest.fn().mockReturnValue(false),
        attemptTranscodeFallbackForCurrentProgram: jest.fn().mockResolvedValue(false),
        handlePlaybackFailure: jest.fn(),
        logPlaybackStartFailure: jest.fn(),
        markProgramStarting: (program) => ({
            programAtStart: program,
            programIdentityAtStart: null,
        }),
        isProgramStillCurrent: jest.fn().mockReturnValue(true),
        handleProgramStartUiSideEffects: jest.fn(),
        commitPreparedStream: jest.fn(),
        handleStreamResolved: jest.fn(),
        reportRecoverableActivationFailure: jest.fn(),
        ...overrides,
    };
    return deps;
};

describe('PlaybackStartController', () => {
    it('records accepted playback start outcome without program identity in the Support report', async () => {
        localStorage.clear();
        new SupportReportPreferencesStore().writeCollectionEnabled(true);
        const outcome = await new PlaybackStartController(makeDeps()).handleProgramStart(makeProgram('private-title'));
        expect(outcome.kind).toBe('started');
        const report = new SupportReportStore().read();
        expect(report.ok).toBe(true);
        if (!report.ok) throw new Error('Support report unavailable');
        const parsed = JSON.parse(report.report) as { events: Array<{ code: string; outcome: string }> };
        expect(parsed.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'playback-start', outcome: 'started' }),
            expect.objectContaining({ code: 'playback-start', outcome: 'succeeded' }),
        ]));
        expect(report.report).not.toContain('private-title');
        localStorage.clear();
    });
    it('blocks a scheduler boundary without playing intent', async () => {
        const deps = makeDeps({ captureAdmission: jest.fn().mockReturnValue(null) });
        expect(await new PlaybackStartController(deps).handleProgramStart(makeProgram())).toEqual({ kind: 'superseded' });
        expect(deps.resolveStreamForProgram).not.toHaveBeenCalled();
        expect(deps.handleProgramStartUiSideEffects).not.toHaveBeenCalled();
    });

    it('discards a resolution superseded by Pause before native load', async () => {
        let resolve!: (prepared: ReturnType<typeof makePrepared>) => void;
        let admitted = true;
        const deps = makeDeps({
            resolveStreamForProgram: jest.fn(() => new Promise((done) => { resolve = done; })),
            isAdmissionCurrent: jest.fn(() => admitted),
        });
        const start = new PlaybackStartController(deps).handleProgramStart(makeProgram());
        admitted = false;
        resolve(makePrepared());
        expect(await start).toEqual({ kind: 'superseded' });
        expect(deps.getVideoPlayer()?.loadStream).not.toHaveBeenCalled();
        expect(deps.discardPreparedStream).toHaveBeenCalledTimes(1);
        expect(deps.commitPreparedStream).not.toHaveBeenCalled();
    });

    it('stops only its descriptor after a stale native load completes', async () => {
        let finishLoad!: () => void;
        let admitted = true;
        const prepared = makePrepared();
        const player = {
            loadStream: jest.fn(() => new Promise<void>((resolve) => { finishLoad = resolve; })),
            play: jest.fn().mockResolvedValue(undefined),
            getCurrentDescriptor: jest.fn(() => prepared.descriptor),
            stop: jest.fn(),
        };
        const deps = makeDeps({
            getVideoPlayer: () => player,
            resolveStreamForProgram: jest.fn().mockResolvedValue(prepared),
            isAdmissionCurrent: jest.fn(() => admitted),
        });
        const start = new PlaybackStartController(deps).handleProgramStart(makeProgram());
        await Promise.resolve();
        admitted = false;
        finishLoad();
        expect(await start).toEqual({ kind: 'superseded' });
        expect(player.stop).toHaveBeenCalledTimes(1);
        expect(player.play).not.toHaveBeenCalled();
    });

    it('does not stop a newer descriptor when old native Play completes late', async () => {
        let finishPlay!: () => void;
        let admitted = true;
        const prepared = makePrepared();
        const newer = makePrepared();
        const player = {
            loadStream: jest.fn().mockResolvedValue(undefined),
            play: jest.fn(() => new Promise<void>((resolve) => { finishPlay = resolve; })),
            getCurrentDescriptor: jest.fn(() => newer.descriptor),
            stop: jest.fn(),
        };
        const deps = makeDeps({
            getVideoPlayer: () => player,
            resolveStreamForProgram: jest.fn().mockResolvedValue(prepared),
            isAdmissionCurrent: jest.fn(() => admitted),
        });
        const start = new PlaybackStartController(deps).handleProgramStart(makeProgram());
        await Promise.resolve();
        await Promise.resolve();
        admitted = false;
        finishPlay();
        expect(await start).toEqual({ kind: 'superseded' });
        expect(player.stop).not.toHaveBeenCalled();
        expect(deps.commitPreparedStream).not.toHaveBeenCalled();
    });
    it('surfaces the original program-start error when transcode fallback throws', async () => {
        const originalError = new Error('load failed');
        const fallbackError = new Error('fallback failed');
        const deps = makeDeps({
            resolveStreamForProgram: jest.fn().mockRejectedValue(originalError),
            attemptTranscodeFallbackForCurrentProgram: jest.fn().mockRejectedValue(fallbackError),
        });

        await new PlaybackStartController(deps).handleProgramStart(makeProgram());

        expect(deps.attemptTranscodeFallbackForCurrentProgram).toHaveBeenCalledWith(
            'programStart',
            undefined
        );
        expect(deps.handlePlaybackFailure).toHaveBeenCalledWith('programStart', originalError);
    });

    it('does not surface stale program-start failures after fallback resolves', async () => {
        const originalError = new Error('load failed');
        const program = makeProgram();
        const deps = makeDeps({
            resolveStreamForProgram: jest.fn().mockRejectedValue(originalError),
            attemptTranscodeFallbackForCurrentProgram: jest.fn().mockImplementation(async () => false),
            isProgramStillCurrent: jest.fn()
                .mockReturnValueOnce(true)
                .mockReturnValueOnce(false),
        });

        await new PlaybackStartController(deps).handleProgramStart(program);

        expect(deps.handlePlaybackFailure).not.toHaveBeenCalled();
    });
});
