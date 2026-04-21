import {
    PlaybackReloadController,
    type RecoveryReloadContext,
} from '../PlaybackReloadController';
import type { IPlexStreamResolver, StreamDecision } from '../../plex/stream';
import type { ScheduledProgram } from '../../scheduler/scheduler';
import type { IVideoPlayer } from '../interfaces';
import type { StreamDescriptor } from '../types';

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
        ...overrides,
    } as ScheduledProgram);

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
        program: makeProgram(),
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
        ...overrides,
    };
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
        const context = makeContext({ program: originalProgram });
        const resolver = {
            resolveStream: jest.fn().mockImplementation(async () => {
                currentProgram = changedProgram;
                return makeDecision();
            }),
        } as unknown as IPlexStreamResolver;
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const controller = new PlaybackReloadController({
            getVideoPlayer: (): IVideoPlayer => context.player,
            getStreamResolver: (): IPlexStreamResolver => resolver,
            getCurrentProgramForPlayback: (): ScheduledProgram | null => currentProgram,
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
        expect(warnSpy).toHaveBeenCalledWith(
            'playback_recovery',
            expect.objectContaining({
                event: 'disableBurnIn.aborted',
                reason: 'test_reason',
                outcome: 'program_changed',
            })
        );
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
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const controller = new PlaybackReloadController({
            getVideoPlayer: (): IVideoPlayer => context.player,
            getStreamResolver: (): IPlexStreamResolver => resolver,
            getCurrentProgramForPlayback: (): ScheduledProgram | null => currentProgram,
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
        expect(warnSpy).toHaveBeenCalledWith(
            'playback_recovery',
            expect.objectContaining({
                event: 'disableBurnIn.aborted',
                reason: 'test_reason',
                outcome: 'program_changed',
            })
        );
    });

    it('keeps the previously active stream state when playback fails after load', async () => {
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
        let currentDecision = previousDecision;
        const previousDescriptor = { url: 'http://test/previous-video.m3u8' } as StreamDescriptor;
        let currentDescriptor = previousDescriptor;
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
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const controller = new PlaybackReloadController({
            getVideoPlayer: (): IVideoPlayer => player,
            getStreamResolver: (): IPlexStreamResolver => resolver,
            getCurrentProgramForPlayback: (): ScheduledProgram => context.program,
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
        expect(errorSpy).toHaveBeenCalledWith(
            'playback_recovery',
            expect.objectContaining({
                event: 'audioReload.failed',
                reason: 'test_reason',
                safeError: expect.any(Object),
            })
        );
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
        let currentDecision = previousDecision;
        const previousDescriptor = { url: 'http://test/previous-video.m3u8' } as StreamDescriptor;
        let currentDescriptor = previousDescriptor;
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
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const controller = new PlaybackReloadController({
            getVideoPlayer: (): IVideoPlayer => player,
            getStreamResolver: (): IPlexStreamResolver => resolver,
            getCurrentProgramForPlayback: (): ScheduledProgram | null => currentProgram,
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
        expect(player.unloadStream).toHaveBeenCalledTimes(1);
        expect(activeMediaUrl).toBeNull();
        expect(currentDecision).toBe(previousDecision);
        expect(currentDescriptor).toBe(previousDescriptor);
        expect(warnSpy).toHaveBeenCalledWith(
            'playback_recovery',
            expect.objectContaining({
                event: 'audioReload.aborted',
                reason: 'test_reason',
                outcome: 'program_changed',
            })
        );
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
        let currentDecision = previousDecision;
        const previousDescriptor = { url: 'http://test/previous-video.m3u8' } as StreamDescriptor;
        let currentDescriptor = previousDescriptor;
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
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const controller = new PlaybackReloadController({
            getVideoPlayer: (): IVideoPlayer => player,
            getStreamResolver: (): IPlexStreamResolver => resolver,
            getCurrentProgramForPlayback: (): ScheduledProgram | null => currentProgram,
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
        expect(player.unloadStream).toHaveBeenCalledTimes(1);
        expect(activeMediaUrl).toBeNull();
        expect(playbackStarted).toBe(false);
        expect(currentDecision).toBe(previousDecision);
        expect(currentDescriptor).toBe(previousDescriptor);
        expect(warnSpy).toHaveBeenCalledWith(
            'playback_recovery',
            expect.objectContaining({
                event: 'audioReload.aborted',
                reason: 'test_reason',
                outcome: 'program_changed',
            })
        );
    });

    it('logs failures and returns failed when resolution throws', async () => {
        const context = makeContext({
            resolver: {
                resolveStream: jest.fn().mockRejectedValue(new Error('reload failed')),
            } as unknown as IPlexStreamResolver,
        });
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const controller = new PlaybackReloadController({
            getVideoPlayer: (): IVideoPlayer => context.player,
            getStreamResolver: (): IPlexStreamResolver => context.resolver,
            getCurrentProgramForPlayback: (): ScheduledProgram => context.program,
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
        expect(errorSpy).toHaveBeenCalledWith(
            'playback_recovery',
            expect.objectContaining({
                event: 'transcodeFallback.failed',
                reason: 'test_reason',
                safeError: expect.any(Object),
            })
        );
    });
});
