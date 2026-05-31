import {
    PlaybackReloadController,
    type RecoveryReloadContext,
} from '../../recovery/PlaybackReloadController';
import type { IPlexStreamResolver, StreamDecision } from '../../../plex/stream';
import {
    buildScheduledProgramIdentity,
    type ScheduledProgram,
    type ScheduledProgramIdentity,
} from '../../../scheduler/scheduler';
import type { IVideoPlayer } from '../../core/interfaces';
import type { StreamDescriptor } from '../../core/types';
import { expectConsoleError, expectConsoleWarn } from '../../../../__tests__/helpers';

const makeProgram = (overrides: Partial<ScheduledProgram> = {}): ScheduledProgram =>
    ({
        item: {
            ratingKey: 'item-1',
            title: 'Test Item',
            durationMs: 60_000,
            type: 'movie',
        } as unknown as ScheduledProgram['item'],
        elapsedMs: 5000,
        scheduledStartTime: 0,
        scheduledEndTime: 0,
        remainingMs: 0,
        scheduleIndex: 0,
        loopNumber: 0,
        isCurrent: true,
        ...overrides,
    } as ScheduledProgram);

const makeProgramIdentity = (
    program: ScheduledProgram,
    channelId: string = 'channel-1'
): ScheduledProgramIdentity =>
    buildScheduledProgramIdentity(channelId, program) as ScheduledProgramIdentity;

const makeDecision = (overrides: Partial<StreamDecision> = {}): StreamDecision =>
    ({
        playbackUrl: 'http://test/stream.m3u8',
        protocol: 'hls',
        isDirectPlay: false,
        isTranscoding: true,
        container: 'mpegts',
        videoCodec: 'h264',
        audioCodec: 'aac',
        subtitleDelivery: 'none',
        sessionId: 'sess-1',
        mediaIndex: 0,
        partIndex: 0,
        partKey: '/library/parts/1/1/file.mkv',
        selectedAudioStream: null,
        selectedSubtitleStream: null,
        width: 1920,
        height: 1080,
        bitrate: 8000,
        availableSubtitleStreams: [],
        availableAudioStreams: [],
        ...overrides,
    } as StreamDecision);

const makeContext = (
    overrides: Partial<RecoveryReloadContext> = {}
): RecoveryReloadContext => {
    const program = overrides.program ?? makeProgram();
    const programIdentity = overrides.programIdentity ?? makeProgramIdentity(program);
    const player: IVideoPlayer = {
        loadStream: jest.fn().mockResolvedValue(undefined),
        unloadStream: jest.fn(),
        play: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn(),
        getCurrentTimeMs: jest.fn().mockReturnValue(5000),
    } as unknown as IVideoPlayer;
    const resolver: IPlexStreamResolver = {
        resolveStream: jest.fn().mockResolvedValue(makeDecision()),
    } as unknown as IPlexStreamResolver;

    return {
        program,
        programIdentity,
        player,
        resolver,
        itemKey: 'item-1',
        safeReason: 'test_reason',
        clampedOffset: 5000,
        currentDecision: makeDecision({
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
        }),
        currentDescriptor: { url: 'http://test/current.m3u8' } as StreamDescriptor,
        ...overrides,
    };
};

const expectPlaybackRecoveryStart = (event: string): void => {
    expectConsoleWarn([
        'playback_recovery',
        expect.objectContaining({
            event,
            reason: 'test_reason',
        }),
    ]);
};

const expectPlaybackRecoveryAborted = (event: string): void => {
    expectConsoleWarn([
        'playback_recovery',
        expect.objectContaining({
            event,
            reason: 'test_reason',
            outcome: 'program_changed',
        }),
    ]);
};

const expectPlaybackRecoveryFailed = (event: string): void => {
    expectConsoleError([
        'playback_recovery',
        expect.objectContaining({
            event,
            reason: 'test_reason',
            outcome: 'failed',
            safeError: expect.any(Object),
        }),
    ]);
};

describe('PlaybackReloadController', () => {
    it('prepares reload context from the current program and player time', () => {
        const program = makeProgram({ elapsedMs: 10_000 });
        const player: IVideoPlayer = {
            getCurrentTimeMs: jest.fn().mockReturnValue(Number.NaN),
        } as unknown as IVideoPlayer;
        const resolver: IPlexStreamResolver = {} as IPlexStreamResolver;
        const controller = new PlaybackReloadController({
            getVideoPlayer: (): IVideoPlayer => player,
            getStreamResolver: (): IPlexStreamResolver => resolver,
            getCurrentProgramForPlayback: (): ScheduledProgram => program,
            getCurrentProgramIdentityForPlayback: (): ScheduledProgramIdentity =>
                makeProgramIdentity(program),
            getCurrentStreamDecision: (): null => null,
            setCurrentStreamDecision: jest.fn(),
            setCurrentStreamDescriptor: jest.fn(),
            buildStreamDescriptor: jest.fn(),
            resetPlaybackFailureGuard: jest.fn(),
        });

        const result = controller.prepareReload('reload_reason');

        expect(result).toEqual(
            expect.objectContaining({
                itemKey: 'item-1',
                safeReason: 'reload_reason',
                clampedOffset: 10_000,
                currentDecision: null,
            })
        );
    });

    it('executes reload, updates decision and descriptor, and resumes playback when requested', async () => {
        expectPlaybackRecoveryStart('audioReload.start');
        const context = makeContext();
        const descriptor = { url: 'http://test/video.m3u8' } as StreamDescriptor;
        const setCurrentStreamDecision = jest.fn();
        const setCurrentStreamDescriptor = jest.fn();
        const buildStreamDescriptor = jest.fn().mockReturnValue(descriptor);
        const resetPlaybackFailureGuard = jest.fn();
        const controller = new PlaybackReloadController({
            getVideoPlayer: (): IVideoPlayer => context.player,
            getStreamResolver: (): IPlexStreamResolver => context.resolver,
            getCurrentProgramForPlayback: (): ScheduledProgram => context.program,
            getCurrentProgramIdentityForPlayback: (): ScheduledProgramIdentity =>
                context.programIdentity,
            getCurrentStreamDecision: (): StreamDecision | null => context.currentDecision,
            setCurrentStreamDecision,
            setCurrentStreamDescriptor,
            buildStreamDescriptor,
            resetPlaybackFailureGuard,
        });

        const result = await controller.executeReload({
            context,
            successOutcome: 'reloaded',
            startEvent: 'audioReload.start',
            abortedEvent: 'audioReload.aborted',
            failedEvent: 'audioReload.failed',
            buildRequest: ({ itemKey, clampedOffset }) => ({
                itemKey,
                startOffsetMs: clampedOffset,
                directPlay: false,
            }),
            shouldResumeAfterReload: true,
        });

        expect(result).toEqual({ outcome: 'reloaded' });
        expect(setCurrentStreamDecision).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'sess-1' }));
        expect(buildStreamDescriptor).toHaveBeenCalledWith(context.program, expect.any(Object), 5000);
        expect(setCurrentStreamDescriptor).toHaveBeenCalledWith(descriptor);
        expect(context.player.loadStream).toHaveBeenCalledWith(descriptor);
        expect(context.player.play).toHaveBeenCalled();
        expect(resetPlaybackFailureGuard).toHaveBeenCalled();
    });

    it('returns ignored when the active program changes before the resolved stream is applied', async () => {
        const originalProgram = makeProgram();
        const changedProgram = makeProgram({
            item: { ...originalProgram.item, ratingKey: 'item-2' } as ScheduledProgram['item'],
        });
        let currentProgram: ScheduledProgram | null = originalProgram;
        let currentProgramIdentity: ScheduledProgramIdentity | null = makeProgramIdentity(originalProgram);
        const context = makeContext({ program: originalProgram });
        const resolver = {
            resolveStream: jest.fn().mockImplementation(async () => {
                currentProgram = changedProgram;
                currentProgramIdentity = makeProgramIdentity(changedProgram);
                return makeDecision();
            }),
        } as unknown as IPlexStreamResolver;
        expectPlaybackRecoveryStart('disableBurnIn.start');
        expectPlaybackRecoveryAborted('disableBurnIn.aborted');
        const controller = new PlaybackReloadController({
            getVideoPlayer: (): IVideoPlayer => context.player,
            getStreamResolver: (): IPlexStreamResolver => resolver,
            getCurrentProgramForPlayback: (): ScheduledProgram | null => currentProgram,
            getCurrentProgramIdentityForPlayback: (): ScheduledProgramIdentity | null =>
                currentProgramIdentity,
            getCurrentStreamDecision: (): StreamDecision | null => context.currentDecision,
            setCurrentStreamDecision: jest.fn(),
            setCurrentStreamDescriptor: jest.fn(),
            buildStreamDescriptor: jest.fn(),
            resetPlaybackFailureGuard: jest.fn(),
        });

        const result = await controller.executeReload({
            context: { ...context, resolver },
            successOutcome: 'reloaded',
            startEvent: 'disableBurnIn.start',
            abortedEvent: 'disableBurnIn.aborted',
            failedEvent: 'disableBurnIn.failed',
            buildRequest: ({ itemKey, clampedOffset }) => ({
                itemKey,
                startOffsetMs: clampedOffset,
                directPlay: true,
            }),
        });

        expect(result).toEqual({ outcome: 'ignored', reason: 'program_changed' });
    });

    it('returns ignored when scheduler identity changes without changing the current item key', async () => {
        const program = makeProgram();
        let currentProgram: ScheduledProgram | null = program;
        let currentProgramIdentity: ScheduledProgramIdentity | null = makeProgramIdentity(program, 'channel-1');
        const context = makeContext({
            program,
            programIdentity: makeProgramIdentity(program, 'channel-1'),
        });
        const resolver = {
            resolveStream: jest.fn().mockImplementation(async () => {
                currentProgramIdentity = makeProgramIdentity(program, 'channel-2');
                return makeDecision();
            }),
        } as unknown as IPlexStreamResolver;
        expectPlaybackRecoveryStart('disableBurnIn.start');
        expectPlaybackRecoveryAborted('disableBurnIn.aborted');
        const controller = new PlaybackReloadController({
            getVideoPlayer: (): IVideoPlayer => context.player,
            getStreamResolver: (): IPlexStreamResolver => resolver,
            getCurrentProgramForPlayback: (): ScheduledProgram | null => currentProgram,
            getCurrentProgramIdentityForPlayback: (): ScheduledProgramIdentity | null =>
                currentProgramIdentity,
            getCurrentStreamDecision: (): StreamDecision | null => context.currentDecision,
            setCurrentStreamDecision: jest.fn(),
            setCurrentStreamDescriptor: jest.fn(),
            buildStreamDescriptor: jest.fn(),
            resetPlaybackFailureGuard: jest.fn(),
        });

        const result = await controller.executeReload({
            context: { ...context, resolver },
            successOutcome: 'reloaded',
            startEvent: 'disableBurnIn.start',
            abortedEvent: 'disableBurnIn.aborted',
            failedEvent: 'disableBurnIn.failed',
            buildRequest: ({ itemKey, clampedOffset }) => ({
                itemKey,
                startOffsetMs: clampedOffset,
                directPlay: true,
            }),
        });

        expect(result).toEqual({ outcome: 'ignored', reason: 'program_changed' });
    });

    it('does not treat a refreshed equivalent program instance as changed', async () => {
        const originalProgram = makeProgram({ scheduledStartTime: 30_000 });
        const refreshedProgram = makeProgram({
            item: { ...originalProgram.item } as ScheduledProgram['item'],
            scheduledStartTime: 30_000,
        });
        let currentProgram: ScheduledProgram | null = originalProgram;
        const context = makeContext({ program: originalProgram });
        const descriptor = { url: 'http://test/video.m3u8' } as StreamDescriptor;
        const resolver = {
            resolveStream: jest.fn().mockImplementation(async () => {
                currentProgram = refreshedProgram;
                return makeDecision();
            }),
        } as unknown as IPlexStreamResolver;
        expectPlaybackRecoveryStart('disableBurnIn.start');
        const controller = new PlaybackReloadController({
            getVideoPlayer: (): IVideoPlayer => context.player,
            getStreamResolver: (): IPlexStreamResolver => resolver,
            getCurrentProgramForPlayback: (): ScheduledProgram | null => currentProgram,
            getCurrentProgramIdentityForPlayback: (): ScheduledProgramIdentity | null =>
                currentProgram ? makeProgramIdentity(currentProgram) : null,
            getCurrentStreamDecision: (): StreamDecision | null => context.currentDecision,
            setCurrentStreamDecision: jest.fn(),
            setCurrentStreamDescriptor: jest.fn(),
            buildStreamDescriptor: jest.fn().mockReturnValue(descriptor),
            resetPlaybackFailureGuard: jest.fn(),
        });

        const result = await controller.executeReload({
            context: { ...context, resolver },
            successOutcome: 'reloaded',
            startEvent: 'disableBurnIn.start',
            abortedEvent: 'disableBurnIn.aborted',
            failedEvent: 'disableBurnIn.failed',
            buildRequest: ({ itemKey, clampedOffset }) => ({
                itemKey,
                startOffsetMs: clampedOffset,
                directPlay: true,
            }),
        });

        expect(result).toEqual({ outcome: 'reloaded' });
    });

    it('does not resolve a stream when the active program changes during beforeResolve', async () => {
        const originalProgram = makeProgram();
        const changedProgram = makeProgram({
            item: { ...originalProgram.item, ratingKey: 'item-2' } as ScheduledProgram['item'],
        });
        let currentProgram: ScheduledProgram | null = originalProgram;
        const resolver = {
            resolveStream: jest.fn().mockResolvedValue(makeDecision()),
        } as unknown as IPlexStreamResolver;
        const context = makeContext({
            program: originalProgram,
            resolver,
        });
        expectPlaybackRecoveryStart('disableBurnIn.start');
        expectPlaybackRecoveryAborted('disableBurnIn.aborted');
        const controller = new PlaybackReloadController({
            getVideoPlayer: (): IVideoPlayer => context.player,
            getStreamResolver: (): IPlexStreamResolver => resolver,
            getCurrentProgramForPlayback: (): ScheduledProgram | null => currentProgram,
            getCurrentProgramIdentityForPlayback: (): ScheduledProgramIdentity | null =>
                currentProgram ? makeProgramIdentity(currentProgram) : null,
            getCurrentStreamDecision: (): StreamDecision | null => context.currentDecision,
            setCurrentStreamDecision: jest.fn(),
            setCurrentStreamDescriptor: jest.fn(),
            buildStreamDescriptor: jest.fn(),
            resetPlaybackFailureGuard: jest.fn(),
        });

        const result = await controller.executeReload({
            context,
            successOutcome: 'disabled',
            startEvent: 'disableBurnIn.start',
            abortedEvent: 'disableBurnIn.aborted',
            failedEvent: 'disableBurnIn.failed',
            beforeResolve: async () => {
                currentProgram = changedProgram;
            },
            buildRequest: ({ itemKey, clampedOffset }) => ({
                itemKey,
                startOffsetMs: clampedOffset,
                directPlay: true,
            }),
        });

        expect(result).toEqual({ outcome: 'ignored', reason: 'program_changed' });
        expect(resolver.resolveStream).not.toHaveBeenCalled();
    });

    it('tears down the new stream and clears committed state when playback fails after load', async () => {
        const previousDecision = makeDecision({
            playbackUrl: 'http://test/previous.m3u8',
            sessionId: 'sess-prev',
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
        });
        const nextDecision = makeDecision({
            playbackUrl: 'http://test/next.m3u8',
            sessionId: 'sess-next',
        });
        let currentDecision: StreamDecision | null = previousDecision;
        const previousDescriptor = { url: 'http://test/previous-video.m3u8' } as StreamDescriptor;
        let currentDescriptor: StreamDescriptor | null = previousDescriptor;
        const nextDescriptor = { url: 'http://test/next-video.m3u8' } as StreamDescriptor;
        let activeMediaUrl: string | null = previousDescriptor.url;
        const player: IVideoPlayer = {
            loadStream: jest.fn().mockImplementation(async (descriptor: StreamDescriptor) => {
                activeMediaUrl = descriptor.url;
            }),
            unloadStream: jest.fn().mockImplementation(() => {
                activeMediaUrl = null;
            }),
            play: jest.fn().mockRejectedValue(new Error('play failed')),
            stop: jest.fn(),
            getCurrentTimeMs: jest.fn().mockReturnValue(5000),
        } as unknown as IVideoPlayer;
        const resolver: IPlexStreamResolver = {
            resolveStream: jest.fn().mockResolvedValue(nextDecision),
        } as unknown as IPlexStreamResolver;
        const context = makeContext({
            player,
            resolver,
            currentDecision: previousDecision,
        });
        expectPlaybackRecoveryStart('audioReload.start');
        expectPlaybackRecoveryFailed('audioReload.failed');
        const controller = new PlaybackReloadController({
            getVideoPlayer: (): IVideoPlayer => player,
            getStreamResolver: (): IPlexStreamResolver => resolver,
            getCurrentProgramForPlayback: (): ScheduledProgram => context.program,
            getCurrentProgramIdentityForPlayback: (): ScheduledProgramIdentity =>
                context.programIdentity,
            getCurrentStreamDecision: (): StreamDecision | null => currentDecision,
            setCurrentStreamDecision: (decision): void => {
                currentDecision = decision;
            },
            setCurrentStreamDescriptor: (descriptor): void => {
                currentDescriptor = descriptor;
            },
            buildStreamDescriptor: jest.fn().mockReturnValue(nextDescriptor),
            resetPlaybackFailureGuard: jest.fn(),
        });

        const result = await controller.executeReload({
            context,
            successOutcome: 'reloaded',
            startEvent: 'audioReload.start',
            abortedEvent: 'audioReload.aborted',
            failedEvent: 'audioReload.failed',
            buildRequest: ({ itemKey, clampedOffset }) => ({
                itemKey,
                startOffsetMs: clampedOffset,
                directPlay: false,
            }),
            shouldResumeAfterReload: true,
        });

        expect(result).toEqual({ outcome: 'failed' });
        expect(player.loadStream).toHaveBeenCalledWith(nextDescriptor);
        expect(player.play).toHaveBeenCalled();
        expect(player.unloadStream).not.toHaveBeenCalled();
        expect(activeMediaUrl).toBe(nextDescriptor.url);
        expect(currentDecision).toBe(previousDecision);
        expect(currentDescriptor).toBe(previousDescriptor);
    });

    it('tears down the new stream and clears committed state when afterLoad fails', async () => {
        const previousDecision = makeDecision({
            playbackUrl: 'http://test/previous.m3u8',
            sessionId: 'sess-prev',
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
        });
        let currentDecision: StreamDecision | null = previousDecision;
        const previousDescriptor = { url: 'http://test/previous-video.m3u8' } as StreamDescriptor;
        let currentDescriptor: StreamDescriptor | null = previousDescriptor;
        const nextDescriptor = { url: 'http://test/next-video.m3u8' } as StreamDescriptor;
        let activeDescriptor: StreamDescriptor | null = previousDescriptor;
        const player: IVideoPlayer = {
            loadStream: jest.fn().mockImplementation(async (descriptor: StreamDescriptor) => {
                activeDescriptor = descriptor;
            }),
            unloadStream: jest.fn().mockImplementation(() => {
                activeDescriptor = null;
            }),
            play: jest.fn().mockResolvedValue(undefined),
            stop: jest.fn(),
            getCurrentDescriptor: jest.fn().mockImplementation(() => activeDescriptor),
            getCurrentTimeMs: jest.fn().mockReturnValue(5000),
        } as unknown as IVideoPlayer;
        const resolver: IPlexStreamResolver = {
            resolveStream: jest.fn().mockResolvedValue(makeDecision()),
        } as unknown as IPlexStreamResolver;
        const context = makeContext({
            player,
            resolver,
            currentDecision: previousDecision,
        });
        expectPlaybackRecoveryStart('audioReload.start');
        expectPlaybackRecoveryFailed('audioReload.failed');
        const controller = new PlaybackReloadController({
            getVideoPlayer: (): IVideoPlayer => player,
            getStreamResolver: (): IPlexStreamResolver => resolver,
            getCurrentProgramForPlayback: (): ScheduledProgram => context.program,
            getCurrentProgramIdentityForPlayback: (): ScheduledProgramIdentity =>
                context.programIdentity,
            getCurrentStreamDecision: (): StreamDecision | null => currentDecision,
            setCurrentStreamDecision: (decision): void => {
                currentDecision = decision;
            },
            setCurrentStreamDescriptor: (descriptor): void => {
                currentDescriptor = descriptor;
            },
            buildStreamDescriptor: jest.fn().mockReturnValue(nextDescriptor),
            resetPlaybackFailureGuard: jest.fn(),
        });

        const result = await controller.executeReload({
            context,
            successOutcome: 'reloaded',
            startEvent: 'audioReload.start',
            abortedEvent: 'audioReload.aborted',
            failedEvent: 'audioReload.failed',
            buildRequest: ({ itemKey, clampedOffset }) => ({
                itemKey,
                startOffsetMs: clampedOffset,
                directPlay: false,
            }),
            afterLoad: async () => {
                throw new Error('subtitle attach failed');
            },
            shouldResumeAfterReload: true,
        });

        expect(result).toEqual({ outcome: 'failed' });
        expect(player.loadStream).toHaveBeenCalledWith(nextDescriptor);
        expect(player.unloadStream).toHaveBeenCalledTimes(1);
        expect(player.play).not.toHaveBeenCalled();
        expect(activeDescriptor).toBeNull();
        expect(currentDecision).toBeNull();
        expect(currentDescriptor).toBeNull();
    });

    it('ignores reload when the active program changes during load before state commit', async () => {
        const originalProgram = makeProgram();
        const changedProgram = makeProgram({
            item: { ...originalProgram.item, ratingKey: 'item-2' } as ScheduledProgram['item'],
        });
        let currentProgram: ScheduledProgram | null = originalProgram;
        const previousDecision = makeDecision({
            playbackUrl: 'http://test/previous.m3u8',
            sessionId: 'sess-prev',
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
        });
        const nextDecision = makeDecision({
            playbackUrl: 'http://test/next.m3u8',
            sessionId: 'sess-next',
        });
        let currentDecision: StreamDecision | null = previousDecision;
        const previousDescriptor = { url: 'http://test/previous-video.m3u8' } as StreamDescriptor;
        let currentDescriptor: StreamDescriptor | null = previousDescriptor;
        const nextDescriptor = { url: 'http://test/next-video.m3u8' } as StreamDescriptor;
        let activeMediaUrl: string | null = previousDescriptor.url;
        const player: IVideoPlayer = {
            loadStream: jest.fn().mockImplementation(async () => {
                activeMediaUrl = nextDescriptor.url;
                currentProgram = changedProgram;
            }),
            unloadStream: jest.fn().mockImplementation(() => {
                activeMediaUrl = null;
            }),
            play: jest.fn().mockResolvedValue(undefined),
            stop: jest.fn(),
            getCurrentTimeMs: jest.fn().mockReturnValue(5000),
        } as unknown as IVideoPlayer;
        const resolver: IPlexStreamResolver = {
            resolveStream: jest.fn().mockResolvedValue(nextDecision),
        } as unknown as IPlexStreamResolver;
        const context = makeContext({
            program: originalProgram,
            player,
            resolver,
            currentDecision: previousDecision,
        });
        expectPlaybackRecoveryStart('audioReload.start');
        expectPlaybackRecoveryAborted('audioReload.aborted');
        const controller = new PlaybackReloadController({
            getVideoPlayer: (): IVideoPlayer => player,
            getStreamResolver: (): IPlexStreamResolver => resolver,
            getCurrentProgramForPlayback: (): ScheduledProgram | null => currentProgram,
            getCurrentProgramIdentityForPlayback: (): ScheduledProgramIdentity | null =>
                currentProgram ? makeProgramIdentity(currentProgram) : null,
            getCurrentStreamDecision: (): StreamDecision | null => currentDecision,
            setCurrentStreamDecision: (decision): void => {
                currentDecision = decision;
            },
            setCurrentStreamDescriptor: (descriptor): void => {
                currentDescriptor = descriptor;
            },
            buildStreamDescriptor: jest.fn().mockReturnValue(nextDescriptor),
            resetPlaybackFailureGuard: jest.fn(),
        });

        const result = await controller.executeReload({
            context,
            successOutcome: 'reloaded',
            startEvent: 'audioReload.start',
            abortedEvent: 'audioReload.aborted',
            failedEvent: 'audioReload.failed',
            buildRequest: ({ itemKey, clampedOffset }) => ({
                itemKey,
                startOffsetMs: clampedOffset,
                directPlay: false,
            }),
            shouldResumeAfterReload: true,
        });

        expect(result).toEqual({ outcome: 'ignored', reason: 'program_changed' });
        expect(player.loadStream).toHaveBeenCalledWith(nextDescriptor);
        expect(player.play).not.toHaveBeenCalled();
        expect(player.unloadStream).not.toHaveBeenCalled();
        expect(activeMediaUrl).toBe(nextDescriptor.url);
        expect(currentDecision).toBe(previousDecision);
        expect(currentDescriptor).toBe(previousDescriptor);
    });

    it('ignores reload when the active program changes during play before state commit', async () => {
        const originalProgram = makeProgram();
        const changedProgram = makeProgram({
            item: { ...originalProgram.item, ratingKey: 'item-2' } as ScheduledProgram['item'],
        });
        let currentProgram: ScheduledProgram | null = originalProgram;
        const previousDecision = makeDecision({
            playbackUrl: 'http://test/previous.m3u8',
            sessionId: 'sess-prev',
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
        });
        const nextDecision = makeDecision({
            playbackUrl: 'http://test/next.m3u8',
            sessionId: 'sess-next',
        });
        let currentDecision: StreamDecision | null = previousDecision;
        const previousDescriptor = { url: 'http://test/previous-video.m3u8' } as StreamDescriptor;
        let currentDescriptor: StreamDescriptor | null = previousDescriptor;
        const nextDescriptor = { url: 'http://test/next-video.m3u8' } as StreamDescriptor;
        let activeMediaUrl: string | null = previousDescriptor.url;
        let playbackStarted = false;
        const player: IVideoPlayer = {
            loadStream: jest.fn().mockImplementation(async () => {
                activeMediaUrl = nextDescriptor.url;
            }),
            unloadStream: jest.fn().mockImplementation(() => {
                activeMediaUrl = null;
                playbackStarted = false;
            }),
            play: jest.fn().mockImplementation(async () => {
                playbackStarted = true;
                currentProgram = changedProgram;
            }),
            stop: jest.fn(),
            getCurrentTimeMs: jest.fn().mockReturnValue(5000),
        } as unknown as IVideoPlayer;
        const resolver: IPlexStreamResolver = {
            resolveStream: jest.fn().mockResolvedValue(nextDecision),
        } as unknown as IPlexStreamResolver;
        const context = makeContext({
            program: originalProgram,
            player,
            resolver,
            currentDecision: previousDecision,
        });
        expectPlaybackRecoveryStart('audioReload.start');
        expectPlaybackRecoveryAborted('audioReload.aborted');
        const controller = new PlaybackReloadController({
            getVideoPlayer: (): IVideoPlayer => player,
            getStreamResolver: (): IPlexStreamResolver => resolver,
            getCurrentProgramForPlayback: (): ScheduledProgram | null => currentProgram,
            getCurrentProgramIdentityForPlayback: (): ScheduledProgramIdentity | null =>
                currentProgram ? makeProgramIdentity(currentProgram) : null,
            getCurrentStreamDecision: (): StreamDecision | null => currentDecision,
            setCurrentStreamDecision: (decision): void => {
                currentDecision = decision;
            },
            setCurrentStreamDescriptor: (descriptor): void => {
                currentDescriptor = descriptor;
            },
            buildStreamDescriptor: jest.fn().mockReturnValue(nextDescriptor),
            resetPlaybackFailureGuard: jest.fn(),
        });

        const result = await controller.executeReload({
            context,
            successOutcome: 'reloaded',
            startEvent: 'audioReload.start',
            abortedEvent: 'audioReload.aborted',
            failedEvent: 'audioReload.failed',
            buildRequest: ({ itemKey, clampedOffset }) => ({
                itemKey,
                startOffsetMs: clampedOffset,
                directPlay: false,
            }),
            shouldResumeAfterReload: true,
        });

        expect(result).toEqual({ outcome: 'ignored', reason: 'program_changed' });
        expect(player.loadStream).toHaveBeenCalledWith(nextDescriptor);
        expect(player.play).toHaveBeenCalled();
        expect(player.unloadStream).not.toHaveBeenCalled();
        expect(activeMediaUrl).toBe(nextDescriptor.url);
        expect(playbackStarted).toBe(true);
        expect(currentDecision).toBe(previousDecision);
        expect(currentDescriptor).toBe(previousDescriptor);
    });

    it('does not unload a newer stream that took over before a stale late abort', async () => {
        const originalProgram = makeProgram();
        const changedProgram = makeProgram({
            item: { ...originalProgram.item, ratingKey: 'item-2' } as ScheduledProgram['item'],
        });
        let currentProgram: ScheduledProgram | null = originalProgram;
        const previousDecision = makeDecision({
            playbackUrl: 'http://test/previous.m3u8',
            sessionId: 'sess-prev',
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
        });
        let currentDecision: StreamDecision | null = previousDecision;
        const previousDescriptor = { url: 'http://test/previous-video.m3u8' } as StreamDescriptor;
        let currentDescriptor: StreamDescriptor | null = previousDescriptor;
        const staleDescriptor = { url: 'http://test/stale-video.m3u8' } as StreamDescriptor;
        const newerDescriptor = { url: 'http://test/newer-video.m3u8' } as StreamDescriptor;
        let activeDescriptor: StreamDescriptor | null = previousDescriptor;
        const player: IVideoPlayer = {
            loadStream: jest.fn().mockImplementation(async (descriptor: StreamDescriptor) => {
                activeDescriptor = descriptor;
                activeDescriptor = newerDescriptor;
                currentProgram = changedProgram;
            }),
            unloadStream: jest.fn().mockImplementation(() => {
                activeDescriptor = null;
            }),
            play: jest.fn().mockResolvedValue(undefined),
            stop: jest.fn(),
            getCurrentDescriptor: jest.fn().mockImplementation(() => activeDescriptor),
            getCurrentTimeMs: jest.fn().mockReturnValue(5000),
        } as unknown as IVideoPlayer;
        const resolver: IPlexStreamResolver = {
            resolveStream: jest.fn().mockResolvedValue(makeDecision()),
        } as unknown as IPlexStreamResolver;
        const context = makeContext({
            program: originalProgram,
            player,
            resolver,
            currentDecision: previousDecision,
        });
        expectPlaybackRecoveryStart('audioReload.start');
        expectPlaybackRecoveryAborted('audioReload.aborted');
        const controller = new PlaybackReloadController({
            getVideoPlayer: (): IVideoPlayer => player,
            getStreamResolver: (): IPlexStreamResolver => resolver,
            getCurrentProgramForPlayback: (): ScheduledProgram | null => currentProgram,
            getCurrentProgramIdentityForPlayback: (): ScheduledProgramIdentity | null =>
                currentProgram ? makeProgramIdentity(currentProgram) : null,
            getCurrentStreamDecision: (): StreamDecision | null => currentDecision,
            setCurrentStreamDecision: (decision): void => {
                currentDecision = decision;
            },
            setCurrentStreamDescriptor: (descriptor): void => {
                currentDescriptor = descriptor;
            },
            buildStreamDescriptor: jest.fn().mockReturnValue(staleDescriptor),
            resetPlaybackFailureGuard: jest.fn(),
        });

        const result = await controller.executeReload({
            context,
            successOutcome: 'reloaded',
            startEvent: 'audioReload.start',
            abortedEvent: 'audioReload.aborted',
            failedEvent: 'audioReload.failed',
            buildRequest: ({ itemKey, clampedOffset }) => ({
                itemKey,
                startOffsetMs: clampedOffset,
                directPlay: false,
            }),
            shouldResumeAfterReload: true,
        });

        expect(result).toEqual({ outcome: 'ignored', reason: 'program_changed' });
        expect(player.loadStream).toHaveBeenCalledWith(staleDescriptor);
        expect(player.unloadStream).not.toHaveBeenCalled();
        expect(activeDescriptor).toBe(newerDescriptor);
        expect(currentDecision).toBe(previousDecision);
        expect(currentDescriptor).toBe(previousDescriptor);
    });

    it('does not unload when the player cannot confirm descriptor ownership', async () => {
        expectPlaybackRecoveryStart('audioReload.start');
        expectPlaybackRecoveryAborted('audioReload.aborted');
        const originalProgram = makeProgram();
        const changedProgram = makeProgram({
            item: { ...originalProgram.item, ratingKey: 'item-2' } as ScheduledProgram['item'],
        });
        let currentProgram: ScheduledProgram | null = originalProgram;
        const descriptor = { url: 'http://test/stale-video.m3u8' } as StreamDescriptor;
        const player: IVideoPlayer = {
            loadStream: jest.fn().mockImplementation(async () => {
                currentProgram = changedProgram;
            }),
            unloadStream: jest.fn(),
            play: jest.fn().mockResolvedValue(undefined),
            stop: jest.fn(),
            getCurrentTimeMs: jest.fn().mockReturnValue(5000),
        } as unknown as IVideoPlayer;
        const context = makeContext({ program: originalProgram, player });
        const controller = new PlaybackReloadController({
            getVideoPlayer: (): IVideoPlayer => player,
            getStreamResolver: (): IPlexStreamResolver => context.resolver,
            getCurrentProgramForPlayback: (): ScheduledProgram | null => currentProgram,
            getCurrentProgramIdentityForPlayback: (): ScheduledProgramIdentity | null =>
                currentProgram ? makeProgramIdentity(currentProgram) : null,
            getCurrentStreamDecision: (): StreamDecision | null => context.currentDecision,
            setCurrentStreamDecision: jest.fn(),
            setCurrentStreamDescriptor: jest.fn(),
            buildStreamDescriptor: jest.fn().mockReturnValue(descriptor),
            resetPlaybackFailureGuard: jest.fn(),
        });

        const result = await controller.executeReload({
            context,
            successOutcome: 'reloaded',
            startEvent: 'audioReload.start',
            abortedEvent: 'audioReload.aborted',
            failedEvent: 'audioReload.failed',
            buildRequest: ({ itemKey, clampedOffset }) => ({
                itemKey,
                startOffsetMs: clampedOffset,
                directPlay: false,
            }),
            shouldResumeAfterReload: true,
        });

        expect(result).toEqual({ outcome: 'ignored', reason: 'program_changed' });
        expect(player.unloadStream).not.toHaveBeenCalled();
    });

    it('logs failures and returns failed when resolution throws', async () => {
        const context = makeContext({
            resolver: {
                resolveStream: jest.fn().mockRejectedValue(new Error('reload failed')),
            } as unknown as IPlexStreamResolver,
        });
        expectPlaybackRecoveryStart('transcodeFallback.start');
        expectPlaybackRecoveryFailed('transcodeFallback.failed');
        const controller = new PlaybackReloadController({
            getVideoPlayer: (): IVideoPlayer => context.player,
            getStreamResolver: (): IPlexStreamResolver => context.resolver,
            getCurrentProgramForPlayback: (): ScheduledProgram => context.program,
            getCurrentProgramIdentityForPlayback: (): ScheduledProgramIdentity =>
                context.programIdentity,
            getCurrentStreamDecision: (): StreamDecision | null => context.currentDecision,
            setCurrentStreamDecision: jest.fn(),
            setCurrentStreamDescriptor: jest.fn(),
            buildStreamDescriptor: jest.fn(),
            resetPlaybackFailureGuard: jest.fn(),
        });

        const result = await controller.executeReload({
            context,
            successOutcome: 'reloaded',
            startEvent: 'transcodeFallback.start',
            abortedEvent: 'transcodeFallback.aborted',
            failedEvent: 'transcodeFallback.failed',
            buildRequest: ({ itemKey, clampedOffset }) => ({
                itemKey,
                startOffsetMs: clampedOffset,
                directPlay: false,
            }),
        });

        expect(result).toEqual({ outcome: 'failed' });
    });

    it('returns failed when the failure hook throws', async () => {
        const hookError = new Error('failure hook failed');
        const context = makeContext({
            resolver: {
                resolveStream: jest.fn().mockRejectedValue(new Error('reload failed')),
            } as unknown as IPlexStreamResolver,
        });
        expectPlaybackRecoveryStart('transcodeFallback.start');
        expectPlaybackRecoveryFailed('transcodeFallback.failed');
        expectPlaybackRecoveryFailed('transcodeFallback.failed.onFailureFailed');
        const controller = new PlaybackReloadController({
            getVideoPlayer: (): IVideoPlayer => context.player,
            getStreamResolver: (): IPlexStreamResolver => context.resolver,
            getCurrentProgramForPlayback: (): ScheduledProgram => context.program,
            getCurrentProgramIdentityForPlayback: (): ScheduledProgramIdentity =>
                context.programIdentity,
            getCurrentStreamDecision: (): StreamDecision | null => context.currentDecision,
            setCurrentStreamDecision: jest.fn(),
            setCurrentStreamDescriptor: jest.fn(),
            buildStreamDescriptor: jest.fn(),
            resetPlaybackFailureGuard: jest.fn(),
        });

        const result = await controller.executeReload({
            context,
            successOutcome: 'reloaded',
            startEvent: 'transcodeFallback.start',
            abortedEvent: 'transcodeFallback.aborted',
            failedEvent: 'transcodeFallback.failed',
            buildRequest: ({ itemKey, clampedOffset }) => ({
                itemKey,
                startOffsetMs: clampedOffset,
                directPlay: false,
            }),
            onFailure: () => {
                throw hookError;
            },
        });

        expect(result).toEqual({ outcome: 'failed' });
    });
});
