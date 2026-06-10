import { PlaybackRecoveryManager, type PlaybackRecoveryDeps } from '../../recovery/PlaybackRecoveryManager';
import { AppErrorCode } from '../../../../types/app-errors';
import type { IVideoPlayer, StreamDescriptor } from '../../index';
import type { IPlexStreamResolver, StreamDecision } from '../../../plex/stream';
import type { PlexStream } from '../../../plex/shared/types';
import {
    buildScheduledProgramIdentity,
    type IChannelScheduler,
    type ScheduledProgram,
    type ScheduledProgramIdentity,
} from '../../../scheduler/scheduler';
import { LINEUP_STORAGE_KEYS } from '../../../../config/storageKeys';
import { expectConsoleError, expectConsoleWarn } from '../../../../__tests__/helpers';

const makeProgram = (overrides: Partial<ScheduledProgram> = {}): ScheduledProgram =>
    ({
        item: {
            ratingKey: 'item-1',
            title: 'Test Item',
            durationMs: 60000,
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
    channelId: string = 'ch1'
): ScheduledProgramIdentity =>
    buildScheduledProgramIdentity(channelId, program) as ScheduledProgramIdentity;

const makeLaterOccurrence = (program: ScheduledProgram): ScheduledProgram =>
    makeProgram({
        item: program.item,
        scheduledStartTime: program.scheduledStartTime + 60_000,
        scheduledEndTime: program.scheduledEndTime + 60_000,
        scheduleIndex: program.scheduleIndex + 1,
        loopNumber: program.loopNumber,
    });

type StreamDecisionFixture = Partial<Omit<StreamDecision, 'transcodeRequest'>> & {
    transcodeRequest?: Partial<NonNullable<StreamDecision['transcodeRequest']>>;
};

const makeTranscodeRequest = (
    overrides: Partial<NonNullable<StreamDecision['transcodeRequest']>> = {}
): NonNullable<StreamDecision['transcodeRequest']> => {
    return {
        sessionId: 'sess-1',
        startOffsetMs: 0,
        startOffsetSeconds: 0,
        maxBitrateReason: 'none',
        transcodeCompatMode: false,
        transcodeQuality: null,
        ...overrides,
    } as NonNullable<StreamDecision['transcodeRequest']>;
};

const makeDecision = (overrides: StreamDecisionFixture = {}): StreamDecision => {
    const { transcodeRequest, ...decisionOverrides } = overrides;
    return ({
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
        ...(transcodeRequest ? { transcodeRequest: makeTranscodeRequest(transcodeRequest) } : {}),
        ...decisionOverrides,
    } as StreamDecision);
};

const makeSubtitleStreams = (): PlexStream[] => [
    {
        id: 'sub-full',
        streamType: 3,
        language: 'English',
        languageCode: 'en',
        codec: 'srt',
        format: 'srt',
        key: '/library/streams/1',
        forced: false,
        default: false,
        title: 'Full',
    },
    {
        id: 'sub-forced',
        streamType: 3,
        language: 'English',
        languageCode: 'en',
        codec: 'srt',
        format: 'srt',
        key: '/library/streams/2',
        forced: true,
        default: false,
        title: 'Forced',
    },
];

const makePlayerState = (overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
    status: 'playing',
    currentTimeMs: 0,
    durationMs: 60_000,
    bufferPercent: 100,
    volume: 1,
    isMuted: false,
    playbackRate: 1,
    activeSubtitleId: null,
    activeAudioId: null,
    errorInfo: null,
    ...overrides,
});

const createLocalStorageMock = (): Storage => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string): string | null => (
            Object.prototype.hasOwnProperty.call(store, key) ? (store[key] ?? null) : null
        ),
        setItem: (key: string, value: string): void => {
            store[key] = String(value);
        },
        removeItem: (key: string): void => {
            delete store[key];
        },
        clear: (): void => {
            store = {};
        },
        key: (index: number): string | null => Object.keys(store)[index] ?? null,
        get length(): number {
            return Object.keys(store).length;
        },
    } as Storage;
};

const setup = (overrides: Partial<PlaybackRecoveryDeps> = {}): {
    manager: PlaybackRecoveryManager;
    deps: PlaybackRecoveryDeps;
    scheduler: IChannelScheduler;
    resolver: IPlexStreamResolver;
    player: IVideoPlayer;
} => {
    const program = makeProgram();
    const scheduler: IChannelScheduler = {
        pauseSyncTimer: jest.fn(),
        resumeSyncTimer: jest.fn(),
        skipToNext: jest.fn(),
        getState: jest.fn().mockReturnValue({
            channelId: 'ch1',
            currentProgram: program,
        }),
    } as unknown as IChannelScheduler;
    const resolver: IPlexStreamResolver = {
        resolveStream: jest.fn().mockResolvedValue(makeDecision()),
        stopTranscodeSession: jest.fn().mockResolvedValue(undefined),
    } as unknown as IPlexStreamResolver;
    const player: IVideoPlayer = {
        loadStream: jest.fn().mockResolvedValue(undefined),
        play: jest.fn().mockResolvedValue(undefined),
        getState: jest.fn().mockReturnValue(makePlayerState()),
        getCurrentTimeMs: jest.fn().mockReturnValue(5000),
    } as unknown as IVideoPlayer;
    const deps: PlaybackRecoveryDeps = {
        getVideoPlayer: () => player,
        getStreamResolver: () => resolver,
        getScheduler: () => scheduler,
        getCurrentProgramForPlayback: () => program,
        getCurrentProgramIdentityForPlayback: () => makeProgramIdentity(program),
        getCurrentStreamDescriptor: () => ({ protocol: 'direct' } as StreamDescriptor),
        setCurrentStreamDecision: jest.fn(),
        setCurrentStreamDescriptor: jest.fn(),
        buildPlexResourceUrl: (pathOrUrl: string) => pathOrUrl,
        getMimeType: () => 'video/mp4',
        getAuthHeaders: () => ({ 'X-Plex-Token': 'token' }),
        getServerUri: () => 'http://example.com',
        getPreferredSubtitleLanguage: () => null,
        getPlexPreferredSubtitleLanguage: () => null,
        notifySubtitleUnavailable: jest.fn(),
        appendIssueDiagnostic: jest.fn(),
        handleGlobalError: jest.fn(),
        ...overrides,
    };

    const manager = new PlaybackRecoveryManager(deps);
    return { manager, deps, scheduler, resolver, player };
};

const expectPlaybackRecoveryWarn = (
    payload: Record<string, unknown>,
    options?: { times?: number }
): void => {
    expectConsoleWarn([
        'playback_recovery',
        expect.objectContaining(payload),
    ], options);
};

const expectPlaybackRecoveryError = (
    payload: Record<string, unknown>,
    options?: { times?: number }
): void => {
    expectConsoleError([
        'playback_recovery',
        expect.objectContaining(payload),
    ], options);
};

describe('PlaybackRecoveryManager', () => {
    beforeEach(() => {
        if (!globalThis.localStorage) {
            (globalThis as { localStorage?: Storage }).localStorage = createLocalStorageMock();
        } else {
            globalThis.localStorage.clear();
        }
    });

    afterEach(() => {
        localStorage.removeItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE);
        localStorage.removeItem(LINEUP_STORAGE_KEYS.SUBTITLE_PREFER_FORCED);
        jest.restoreAllMocks();
    });
    it('resets playback failure guard and resumes scheduler', () => {
        const { manager, scheduler } = setup();

        manager.resetPlaybackFailureGuard();

        expect(scheduler.resumeSyncTimer).toHaveBeenCalled();
    });

    it('pauses scheduler sync and surfaces playback errors without auto-skipping', () => {
        const { manager, scheduler, deps } = setup();
        const handleGlobalError = deps.handleGlobalError as jest.Mock;
        const appendIssueDiagnostic = deps.appendIssueDiagnostic as jest.Mock;

        manager.handlePlaybackFailure('context', new Error('boom'));

        expect(scheduler.skipToNext).not.toHaveBeenCalled();
        expect(scheduler.pauseSyncTimer).toHaveBeenCalledTimes(1);
        expect(appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'playbackRecovery.failureGuardTripped',
            expect.objectContaining({
                source: 'context',
                failureCount: 1,
            })
        );
        expect(handleGlobalError).toHaveBeenCalledWith(
            expect.objectContaining({
                code: AppErrorCode.PLAYBACK_FAILED,
                message: 'Playback failed',
                recoverable: true,
                context: expect.objectContaining({
                    source: 'context',
                    failureCount: 1,
                    safeError: expect.any(Object),
                    itemKey: 'item-1',
                    channelId: 'ch1',
                    streamDescriptor: expect.objectContaining({
                        protocol: 'direct',
                    }),
                }),
            }),
            'playback'
        );

        manager.handlePlaybackFailure('context', new Error('boom again'));

        expect(scheduler.skipToNext).not.toHaveBeenCalled();
        expect(scheduler.pauseSyncTimer).toHaveBeenCalledTimes(1);
        expect(handleGlobalError).toHaveBeenCalledTimes(1);
    });

    it('surfaces playback errors even when diagnostics append fails', () => {
        expectPlaybackRecoveryError({
            event: 'playbackRecovery.failureGuardDiagnosticFailed',
            source: 'context',
        });
        const diagnosticError = new Error('diagnostics unavailable');
        const { manager, scheduler, deps } = setup({
            appendIssueDiagnostic: jest.fn(() => {
                throw diagnosticError;
            }),
        });
        const handleGlobalError = deps.handleGlobalError as jest.Mock;

        manager.handlePlaybackFailure('context', new Error('boom'));

        expect(scheduler.pauseSyncTimer).toHaveBeenCalledTimes(1);
        expect(handleGlobalError).toHaveBeenCalledWith(
            expect.objectContaining({
                code: AppErrorCode.PLAYBACK_FAILED,
                context: expect.objectContaining({
                    source: 'context',
                    failureCount: 1,
                }),
            }),
            'playback'
        );
    });

    it('surfaces playback errors once per scheduled occurrence while still avoiding automatic skip', () => {
        let currentProgram = makeProgram();
        const { manager, scheduler, deps } = setup({
            getCurrentProgramForPlayback: () => currentProgram,
            getCurrentProgramIdentityForPlayback: () => makeProgramIdentity(currentProgram),
        });
        const handleGlobalError = deps.handleGlobalError as jest.Mock;
        const appendIssueDiagnostic = deps.appendIssueDiagnostic as jest.Mock;

        manager.handlePlaybackFailure('context', new Error('boom'));
        manager.handlePlaybackFailure('context', new Error('boom again'));

        currentProgram = makeProgram({
            item: {
                ...currentProgram.item,
                ratingKey: 'item-2',
            } as ScheduledProgram['item'],
        });
        manager.handlePlaybackFailure('context', new Error('boom on item 2'));

        expect(scheduler.skipToNext).not.toHaveBeenCalled();
        expect(scheduler.pauseSyncTimer).toHaveBeenCalledTimes(2);
        expect(handleGlobalError).toHaveBeenCalledTimes(2);
        expect(appendIssueDiagnostic).toHaveBeenCalledTimes(2);
        expect(handleGlobalError).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                context: expect.objectContaining({
                    itemKey: 'item-1',
                    failureCount: 1,
                }),
            }),
            'playback'
        );
        expect(handleGlobalError).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                context: expect.objectContaining({
                    itemKey: 'item-2',
                    failureCount: 2,
                }),
            }),
            'playback'
        );
    });

    it('does not suppress a later scheduled occurrence with the same item key', () => {
        let currentProgram = makeProgram();
        const { manager, scheduler, deps } = setup({
            getCurrentProgramForPlayback: () => currentProgram,
            getCurrentProgramIdentityForPlayback: () => makeProgramIdentity(currentProgram),
        });
        const handleGlobalError = deps.handleGlobalError as jest.Mock;

        manager.handlePlaybackFailure('context', new Error('first occurrence failed'));
        manager.handlePlaybackFailure('context', new Error('duplicate event'));

        currentProgram = makeProgram({
            item: currentProgram.item,
            scheduledStartTime: 60_000,
            scheduledEndTime: 120_000,
            scheduleIndex: 1,
            loopNumber: 0,
        });
        manager.handlePlaybackFailure('context', new Error('second occurrence failed'));

        expect(scheduler.skipToNext).not.toHaveBeenCalled();
        expect(scheduler.pauseSyncTimer).toHaveBeenCalledTimes(2);
        expect(handleGlobalError).toHaveBeenCalledTimes(2);
        expect(handleGlobalError).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                context: expect.objectContaining({
                    itemKey: 'item-1',
                    failureCount: 2,
                }),
            }),
            'playback'
        );
    });

    it('records sanitized stream classification context when the playback failure guard trips', () => {
        const decision = makeDecision({
            playbackUrl: 'http://plex.example/video.mkv?X-Plex-Token=secret-token',
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
            container: 'mkv',
            videoCodec: 'hevc',
            audioCodec: 'opus',
            subtitleDelivery: 'none',
            width: 1920,
            height: 1080,
            bitrate: 17112,
            directPlay: {
                allowed: true,
                reasons: [],
            },
            source: {
                container: 'mkv',
                videoCodec: 'hevc',
                audioCodec: 'opus',
                width: 1920,
                height: 1080,
                bitrate: 17112,
            },
            selectedAudioStream: {
                id: 'audio-1',
                streamType: 2,
                codec: 'opus',
                channels: 2,
                language: 'Japanese',
                default: true,
            } as PlexStream,
        });
        const descriptor = {
            protocol: 'direct',
            mimeType: 'video/x-matroska',
            isLive: false,
            durationMs: 1_416_000,
            audioTracks: [
                {
                    id: 'audio-1',
                    codec: 'opus',
                },
            ],
            subtitleTracks: [],
        } as unknown as StreamDescriptor;
        const { manager, deps } = setup({
            getCurrentStreamDecision: () => decision,
            getCurrentStreamDescriptor: () => descriptor,
        });
        const handleGlobalError = deps.handleGlobalError as jest.Mock;

        manager.handlePlaybackFailure('video-player?X-Plex-Token=secret-token', {
            code: AppErrorCode.PLAYBACK_FORMAT_UNSUPPORTED,
            message: 'Media format not supported: http://plex.example/video.mkv?X-Plex-Token=secret-token',
        });

        const context = handleGlobalError.mock.calls[0]?.[0]?.context;
        expect(context).toMatchObject({
            source: 'video-player?X-Plex-Token=REDACTED',
            safeError: {
                code: AppErrorCode.PLAYBACK_FORMAT_UNSUPPORTED,
                message: 'Media format not supported: http://plex.example/video.mkv?X-Plex-Token=REDACTED',
            },
            streamDescriptor: {
                protocol: 'direct',
                mimeType: 'video/x-matroska',
                isLive: false,
                durationMs: 1_416_000,
                audioCodecs: ['opus'],
                subtitleFormats: [],
            },
            streamDecision: {
                protocol: 'http',
                isDirectPlay: true,
                isTranscoding: false,
                container: 'mkv',
                videoCodec: 'hevc',
                audioCodec: 'opus',
                subtitleDelivery: 'none',
                width: 1920,
                height: 1080,
                bitrate: 17112,
                directPlay: {
                    allowed: true,
                    reasons: [],
                },
                source: {
                    container: 'mkv',
                    videoCodec: 'hevc',
                    audioCodec: 'opus',
                    width: 1920,
                    height: 1080,
                    bitrate: 17112,
                },
                selectedAudio: {
                    codec: 'opus',
                    channels: 2,
                    language: 'Japanese',
                    default: true,
                },
                selectedSubtitle: null,
            },
        });
        expect(JSON.stringify(context)).not.toContain('secret-token');
        expect(JSON.stringify(context)).not.toContain('playbackUrl');
    });

    it('handles stream resolver auth errors', () => {
        const { manager, deps } = setup();
        const handleGlobalError = deps.handleGlobalError as jest.Mock;

        const handled = manager.tryHandleStreamResolverAuthError({
            code: 'AUTH_REQUIRED',
            message: 'Auth required',
            recoverable: true,
        });

        expect(handled).toBe(true);
        expect(handleGlobalError).toHaveBeenCalledWith(
            {
                code: AppErrorCode.AUTH_REQUIRED,
                message: 'Auth required',
                recoverable: true,
            },
            'plex-stream'
        );
    });

    it('sanitizes stream resolver auth error messages before surfacing them', () => {
        const { manager, deps } = setup();
        const handleGlobalError = deps.handleGlobalError as jest.Mock;

        manager.tryHandleStreamResolverAuthError({
            code: 'AUTH_REQUIRED',
            message: 'Auth required for token secret-token',
            recoverable: true,
        });

        expect(handleGlobalError).toHaveBeenCalledWith(
            {
                code: AppErrorCode.AUTH_REQUIRED,
                message: expect.not.stringContaining('secret-token'),
                recoverable: true,
            },
            'plex-stream'
        );
    });

    it('resolves stream for program and records decision', async () => {
        const currentProgram = makeProgram({ elapsedMs: 999999 });
        const { manager, resolver, deps } = setup({
            getCurrentProgramForPlayback: () => currentProgram,
            getCurrentProgramIdentityForPlayback: () => makeProgramIdentity(currentProgram),
        });
        const setDecision = deps.setCurrentStreamDecision as jest.Mock;

        const stream = await manager.resolveStreamForProgram(makeProgram({ elapsedMs: 999999 }));

        expect(resolver.resolveStream).toHaveBeenCalledWith(
            expect.objectContaining({
                itemKey: 'item-1',
                startOffsetMs: 60000,
                directPlay: true,
            })
        );
        expect(setDecision).toHaveBeenCalled();
        expect(stream.protocol).toBe('hls');
    });

    it('reloads current program with requested audio track id', async () => {
        expectPlaybackRecoveryWarn({
            event: 'audioReload.start',
            reason: 'audio_track_change',
            trackId: 'audio-truehd',
            itemKey: 'item-1',
            preserveDirectPlayPreference: true,
        });
        const currentDecision = makeDecision({
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
        });
        const nextDecision = makeDecision({
            protocol: 'hls',
            isDirectPlay: false,
            isTranscoding: true,
            transcodeRequest: {
                sessionId: 'sess-2',
                maxBitrate: 8000,
                audioStreamId: 'audio-truehd',
                mediaIndex: 0,
                partIndex: 0,
            },
        });
        const { manager, resolver, player, deps } = setup({
            getCurrentStreamDecision: () => currentDecision,
        });
        const setDecision = deps.setCurrentStreamDecision as jest.Mock;
        (resolver.resolveStream as jest.Mock).mockResolvedValueOnce(nextDecision);

        const result = await manager.attemptAudioTrackReloadForCurrentProgram('audio-truehd', 'audio_track_change');

        expect(result).toEqual({ outcome: 'reloaded' });
        expect(resolver.resolveStream).toHaveBeenCalledWith(
            expect.objectContaining({
                itemKey: 'item-1',
                startOffsetMs: 5000,
                directPlay: true,
                audioStreamId: 'audio-truehd',
            })
        );
        expect(setDecision).toHaveBeenCalledTimes(1);
        expect(setDecision).toHaveBeenCalledWith(nextDecision);
        expect(deps.setCurrentStreamDescriptor).toHaveBeenCalled();
        expect(player.loadStream).toHaveBeenCalled();
        expect(player.play).toHaveBeenCalled();
    });

    it('preserves active subtitle id when reloading for audio track change', async () => {
        expectPlaybackRecoveryWarn({
            event: 'audioReload.start',
            reason: 'audio_track_change',
            trackId: 'audio-alt',
            itemKey: 'item-1',
            preserveDirectPlayPreference: true,
        });
        const currentDecision = makeDecision({
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
        });
        const nextDecision = makeDecision({
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
            availableSubtitleStreams: makeSubtitleStreams(),
        });
        const { manager, resolver, player } = setup({
            getCurrentStreamDecision: () => currentDecision,
        });
        (player.getState as jest.Mock).mockReturnValue(makePlayerState({ activeSubtitleId: 'sub-full' }));
        (resolver.resolveStream as jest.Mock).mockResolvedValueOnce(nextDecision);

        const result = await manager.attemptAudioTrackReloadForCurrentProgram('audio-alt', 'audio_track_change');

        expect(result).toEqual({ outcome: 'reloaded' });
        expect(resolver.resolveStream).toHaveBeenCalledWith(
            expect.objectContaining({
                audioStreamId: 'audio-alt',
                subtitleStreamId: 'sub-full',
            })
        );
        expect(player.loadStream).toHaveBeenCalledWith(
            expect.objectContaining({ preferredSubtitleTrackId: 'sub-full' })
        );
        expect(player.play).toHaveBeenCalled();
    });

    it('preserves subtitles-off selection when reloading for audio track change', async () => {
        expectPlaybackRecoveryWarn({
            event: 'audioReload.start',
            reason: 'audio_track_change',
            trackId: 'audio-alt',
            itemKey: 'item-1',
            preserveDirectPlayPreference: true,
        });
        const currentDecision = makeDecision({
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
        });
        const nextDecision = makeDecision({
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
            availableSubtitleStreams: makeSubtitleStreams(),
        });
        const { manager, resolver, player } = setup({
            getCurrentStreamDecision: () => currentDecision,
            getPreferredSubtitleLanguage: () => 'en',
        });
        (player.getState as jest.Mock).mockReturnValue(makePlayerState({ activeSubtitleId: null }));
        (resolver.resolveStream as jest.Mock).mockResolvedValueOnce(nextDecision);

        const result = await manager.attemptAudioTrackReloadForCurrentProgram('audio-alt', 'audio_track_change');

        expect(result).toEqual({ outcome: 'reloaded' });
        expect(resolver.resolveStream).toHaveBeenCalledWith(
            expect.not.objectContaining({ subtitleStreamId: expect.any(String) })
        );
        expect(player.loadStream).toHaveBeenCalledWith(
            expect.objectContaining({ preferredSubtitleTrackId: null })
        );
    });

    it('does not resume playback after audio reload when previously paused', async () => {
        expectPlaybackRecoveryWarn({
            event: 'audioReload.start',
            reason: 'audio_track_change',
            trackId: 'audio-alt',
            itemKey: 'item-1',
            preserveDirectPlayPreference: true,
        });
        const currentDecision = makeDecision({
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
        });
        const nextDecision = makeDecision({
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
        });
        const { manager, resolver, player } = setup({
            getCurrentStreamDecision: () => currentDecision,
        });
        (player.getState as jest.Mock).mockReturnValue(makePlayerState({ status: 'paused' }));
        (resolver.resolveStream as jest.Mock).mockResolvedValueOnce(nextDecision);

        const result = await manager.attemptAudioTrackReloadForCurrentProgram('audio-alt', 'audio_track_change');

        expect(result).toEqual({ outcome: 'reloaded' });
        expect(player.loadStream).toHaveBeenCalled();
        expect(player.play).not.toHaveBeenCalled();
    });

    it('preserves burn-in subtitle request when reloading for audio track change', async () => {
        expectPlaybackRecoveryWarn({
            event: 'audioReload.start',
            reason: 'audio_track_change',
            trackId: 'audio-alt',
            itemKey: 'item-1',
            preserveDirectPlayPreference: false,
        });
        const currentDecision = makeDecision({
            protocol: 'hls',
            isDirectPlay: false,
            isTranscoding: true,
            transcodeRequest: {
                sessionId: 'sess-burn',
                maxBitrate: 4000,
                subtitleStreamId: 'sub-burn',
                subtitleMode: 'burn',
                mediaIndex: 0,
                partIndex: 0,
            },
        });
        const { manager, resolver } = setup({
            getCurrentStreamDecision: () => currentDecision,
        });
        (resolver.resolveStream as jest.Mock).mockResolvedValueOnce(makeDecision());

        await manager.attemptAudioTrackReloadForCurrentProgram('audio-alt', 'audio_track_change');

        expect(resolver.resolveStream).toHaveBeenCalledWith(
            expect.objectContaining({
                audioStreamId: 'audio-alt',
                subtitleStreamId: 'sub-burn',
                subtitleMode: 'burn',
            })
        );
    });

    it('logs audio reload events with structured payloads', async () => {
        expectPlaybackRecoveryWarn({
            event: 'audioReload.start',
            reason: 'audio_track_change',
            trackId: 'audio-alt',
            itemKey: 'item-1',
            preserveDirectPlayPreference: true,
        });
        expectPlaybackRecoveryError({
            event: 'audioReload.failed',
            reason: 'audio_track_change',
            trackId: 'audio-alt',
            itemKey: 'item-1',
            safeError: expect.any(Object),
        });
        const { manager, resolver } = setup();
        (resolver.resolveStream as jest.Mock).mockRejectedValueOnce(new Error('audio reload failed'));

        const result = await manager.attemptAudioTrackReloadForCurrentProgram('audio-alt', 'audio_track_change');

        expect(result).toEqual({ outcome: 'failed' });
    });

    it('maps ACCESS_DENIED resolver errors to lifecycle access denied', () => {
        const { manager, deps } = setup();
        const handleGlobalError = deps.handleGlobalError as jest.Mock;

        const handled = manager.tryHandleStreamResolverPermissionError({
            code: 'ACCESS_DENIED',
            message: 'profile lacks access',
        });

        expect(handled).toBe(true);
        expect(handleGlobalError).toHaveBeenCalledWith(
            {
                code: AppErrorCode.ACCESS_DENIED,
                message: 'profile lacks access',
                recoverable: false,
            },
            'plex-stream'
        );
    });

    it('sanitizes ACCESS_DENIED resolver messages before surfacing them', () => {
        const { manager, deps } = setup();
        const handleGlobalError = deps.handleGlobalError as jest.Mock;

        manager.tryHandleStreamResolverPermissionError({
            code: 'ACCESS_DENIED',
            message: 'profile lacks access for X-Plex-Token=secret-token',
        });

        expect(handleGlobalError).toHaveBeenCalledWith(
            {
                code: AppErrorCode.ACCESS_DENIED,
                message: expect.not.stringContaining('secret-token'),
                recoverable: false,
            },
            'plex-stream'
        );
    });

    it('does not handle non-ACCESS_DENIED resolver errors', () => {
        const { manager, deps } = setup();
        const handleGlobalError = deps.handleGlobalError as jest.Mock;

        const handled = manager.tryHandleStreamResolverPermissionError({
            code: 'SOME_OTHER_CODE',
            message: 'nope',
        });

        expect(handled).toBe(false);
        expect(handleGlobalError).not.toHaveBeenCalled();
    });

    it('overrides Plex default flags so selectedAudioStream is the only default track', async () => {
        const { manager, resolver } = setup();

        const truehd: PlexStream = {
            id: 'audio-truehd',
            streamType: 2,
            language: 'English',
            languageCode: 'en',
            codec: 'truehd',
            channels: 8,
            default: true,
            title: 'English TrueHD',
        };
        const aac: PlexStream = {
            id: 'audio-aac',
            streamType: 2,
            language: 'English',
            languageCode: 'en',
            codec: 'aac',
            channels: 2,
            default: false,
            title: 'English AAC',
        };

        (resolver.resolveStream as jest.Mock).mockResolvedValue(
            makeDecision({
                selectedAudioStream: aac,
                availableAudioStreams: [truehd, aac],
            })
        );

        const descriptor = await manager.resolveStreamForProgram(makeProgram());

        const defaults = descriptor.audioTracks.filter((t) => t.default).map((t) => t.id);
        expect(defaults).toEqual(['audio-aac']);
    });

    it('preserves Plex default flags when selectedAudioStream id is not present in available streams', async () => {
        const { manager, resolver } = setup();

        const plexDefault: PlexStream = {
            id: 'audio-default',
            streamType: 2,
            language: 'English',
            languageCode: 'en',
            codec: 'aac',
            channels: 2,
            default: true,
            title: 'English AAC',
        };
        const secondary: PlexStream = {
            id: 'audio-secondary',
            streamType: 2,
            language: 'Spanish',
            languageCode: 'es',
            codec: 'aac',
            channels: 2,
            default: false,
            title: 'Spanish AAC',
        };
        const selectedMissing: PlexStream = {
            id: 'audio-missing',
            streamType: 2,
            language: 'English',
            languageCode: 'en',
            codec: 'aac',
            channels: 2,
            default: false,
            title: 'English AAC (selected but missing)',
        };

        (resolver.resolveStream as jest.Mock).mockResolvedValue(
            makeDecision({
                selectedAudioStream: selectedMissing,
                availableAudioStreams: [plexDefault, secondary],
            })
        );

        const descriptor = await manager.resolveStreamForProgram(makeProgram());
        const defaults = descriptor.audioTracks.filter((t) => t.default).map((t) => t.id);
        expect(defaults).toEqual(['audio-default']);
    });

    it('attempts transcode fallback only for direct protocol', async () => {
        const { manager, resolver, player } = setup({
            getCurrentStreamDescriptor: () => ({ protocol: 'hls' } as StreamDescriptor),
        });

        const ok = await manager.attemptTranscodeFallbackForCurrentProgram('reason');

        expect(ok).toBe(false);
        expect(resolver.resolveStream).not.toHaveBeenCalled();
        expect(player.loadStream).not.toHaveBeenCalled();
    });

    it('attempts transcode fallback when direct protocol and plays', async () => {
        expectPlaybackRecoveryWarn({
            event: 'transcodeFallback.start',
            reason: 'reason',
            itemKey: 'item-1',
        });
        const { manager, resolver, player, deps } = setup();
        const setDescriptor = deps.setCurrentStreamDescriptor as jest.Mock;

        const ok = await manager.attemptTranscodeFallbackForCurrentProgram('reason');

        expect(ok).toBe(true);
        expect(resolver.resolveStream).toHaveBeenCalledWith(
            expect.objectContaining({
                itemKey: 'item-1',
                startOffsetMs: 5000,
                directPlay: false,
            })
        );
        expect(setDescriptor).toHaveBeenCalled();
        expect(player.loadStream).toHaveBeenCalled();
        expect(player.play).toHaveBeenCalled();
    });

    it('logs transcode fallback start and failure telemetry', async () => {
        expectPlaybackRecoveryWarn({
            event: 'transcodeFallback.start',
            reason: 'subtitle_decode_failed',
            itemKey: 'item-1',
        });
        expectPlaybackRecoveryError({
            event: 'transcodeFallback.failed',
            reason: 'subtitle_decode_failed',
            itemKey: 'item-1',
            safeError: expect.any(Object),
        });
        const { manager, resolver } = setup();
        (resolver.resolveStream as jest.Mock).mockRejectedValueOnce(new Error('resolver boom'));

        const ok = await manager.attemptTranscodeFallbackForCurrentProgram('subtitle_decode_failed');

        expect(ok).toBe(false);
    });

    it('resets direct fallback and automatic burn-in attempt guards', async () => {
        expectPlaybackRecoveryWarn({
            event: 'transcodeFallback.start',
            reason: 'reason',
            itemKey: 'item-1',
        }, { times: 2 });
        expectPlaybackRecoveryWarn({
            event: 'burnInReload.start',
            reason: 'subtitle_extract_failed:test',
            trackId: 'sub-keyless',
            itemKey: 'item-1',
        }, { times: 2 });
        expectPlaybackRecoveryError({
            event: 'burnInReload.failed',
            reason: 'subtitle_extract_failed:test',
            trackId: 'sub-keyless',
            itemKey: 'item-1',
            safeError: expect.any(Object),
        }, { times: 2 });
        const { manager, resolver } = setup();

        const firstDirectFallback = await manager.attemptTranscodeFallbackForCurrentProgram('reason');
        const blockedDirectFallback = await manager.attemptTranscodeFallbackForCurrentProgram('reason');
        expect(firstDirectFallback).toBe(true);
        expect(blockedDirectFallback).toBe(false);

        (resolver.resolveStream as jest.Mock).mockRejectedValue(new Error('burn-in failed'));
        const firstBurnIn = await manager.attemptBurnInSubtitleForCurrentProgram(
            'sub-keyless',
            'subtitle_extract_failed:test'
        );
        const blockedBurnIn = await manager.attemptBurnInSubtitleForCurrentProgram(
            'sub-keyless',
            'subtitle_extract_failed:test'
        );
        expect(firstBurnIn).toEqual({ outcome: 'failed' });
        expect(blockedBurnIn).toEqual({ outcome: 'ignored', reason: 'already_attempted' });

        manager.resetDirectFallbackAndBurnInAttempts();

        (resolver.resolveStream as jest.Mock).mockResolvedValueOnce(makeDecision());
        const resetDirectFallback = await manager.attemptTranscodeFallbackForCurrentProgram('reason');
        (resolver.resolveStream as jest.Mock).mockRejectedValue(new Error('burn-in failed'));
        const resetBurnIn = await manager.attemptBurnInSubtitleForCurrentProgram(
            'sub-keyless',
            'subtitle_extract_failed:test'
        );

        expect(resetDirectFallback).toBe(true);
        expect(resetBurnIn).toEqual({ outcome: 'failed' });
        expect(resolver.resolveStream).toHaveBeenCalledTimes(4);
    });

    it('does not let a program_changed transcode fallback abort poison the next occurrence of the same item', async () => {
        expectPlaybackRecoveryWarn({
            event: 'transcodeFallback.start',
            reason: 'reason',
            itemKey: 'item-1',
        }, { times: 2 });
        expectPlaybackRecoveryWarn({
            event: 'transcodeFallback.aborted',
            reason: 'reason',
            itemKey: 'item-1',
            outcome: 'program_changed',
        });
        const originalProgram = makeProgram();
        let currentProgram = originalProgram;
        const nextProgram = makeLaterOccurrence(originalProgram);
        const { manager, resolver } = setup({
            getCurrentProgramForPlayback: () => currentProgram,
            getCurrentProgramIdentityForPlayback: () => makeProgramIdentity(currentProgram),
        });
        (resolver.resolveStream as jest.Mock)
            .mockImplementationOnce(async () => {
                currentProgram = nextProgram;
                return makeDecision();
            })
            .mockResolvedValueOnce(makeDecision());

        const aborted = await manager.attemptTranscodeFallbackForCurrentProgram('reason');
        const retried = await manager.attemptTranscodeFallbackForCurrentProgram('reason');

        expect(aborted).toBe(false);
        expect(retried).toBe(true);
        expect(resolver.resolveStream).toHaveBeenCalledTimes(2);
    });

    it('ignores stored subtitle track selections (no per-item or global persistence)', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'standard');
        localStorage.setItem(
            'lineup_subtitle_pref_item:item-1',
            JSON.stringify({ trackId: 'sub-es', language: 'es', codec: 'srt', lastUpdated: Date.now() })
        );
        localStorage.setItem(
            'lineup_subtitle_pref_global',
            JSON.stringify({ trackId: 'sub-es', language: 'es', codec: 'srt', lastUpdated: Date.now() })
        );

        const spanishStream: PlexStream = {
            id: 'sub-es',
            streamType: 3,
            language: 'Spanish',
            languageCode: 'es',
            codec: 'srt',
            format: 'srt',
            key: '/library/streams/3',
            forced: false,
            default: false,
            title: 'Spanish',
        };

        const decision = makeDecision({ availableSubtitleStreams: [spanishStream, ...makeSubtitleStreams()] });
        const { manager, resolver } = setup({ getPreferredSubtitleLanguage: () => 'en' });
        (resolver.resolveStream as jest.Mock).mockResolvedValue(decision);

        const stream = await manager.resolveStreamForProgram(makeProgram());

        expect(stream.preferredSubtitleTrackId).toBe('sub-full');
    });

    it('filters out keyless subtitles when external-only is enabled', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'direct');

        const keylessStream: PlexStream = {
            id: 'sub-keyless',
            streamType: 3,
            language: 'English',
            languageCode: 'en',
            codec: 'srt',
            format: 'srt',
            forced: false,
            default: true,
            title: 'Keyless',
        };
        const decision = makeDecision({ availableSubtitleStreams: [keylessStream] });
        const { manager, resolver } = setup();
        (resolver.resolveStream as jest.Mock).mockResolvedValue(decision);

        const stream = await manager.resolveStreamForProgram(makeProgram());

        expect(stream.preferredSubtitleTrackId).toBeNull();
    });

    it('does not escalate subtitle deactivation to burn-in in standard mode', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'standard');

        const keylessEmbedded: PlexStream = {
            id: 'sub-keyless',
            streamType: 3,
            language: 'English',
            languageCode: 'en',
            codec: 'srt',
            format: 'srt',
            forced: false,
            default: true,
            title: 'Embedded',
        };
        const directDecision = makeDecision({
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
            availableSubtitleStreams: [keylessEmbedded],
        });

        const notifyToast = jest.fn();
        const notifySubtitleUnavailable = jest.fn();
        const { manager, resolver } = setup({ notifyToast, notifySubtitleUnavailable });
        (resolver.resolveStream as jest.Mock).mockResolvedValueOnce(directDecision);

        const stream = await manager.resolveStreamForProgram(makeProgram());
        const handled = stream.subtitleContext?.onDeactivate?.({
            trackId: 'sub-keyless',
            reason: 'subtitle_text_fetch_failed',
        });

        expect(handled).toBe(false);
        expect(resolver.resolveStream).toHaveBeenCalledTimes(1);
        expect(notifyToast).not.toHaveBeenCalled();
    });

    it('propagates the resolved playback base url into subtitle context', async () => {
        const decision = makeDecision({
            playbackUrl: 'https://relay.plex.tv/video/:/transcode/universal/start.m3u8?session=sess-1',
            protocol: 'hls',
            isDirectPlay: false,
            isTranscoding: true,
            availableSubtitleStreams: makeSubtitleStreams(),
        });
        const { manager, resolver } = setup();
        (resolver.resolveStream as jest.Mock).mockResolvedValueOnce(decision);

        const stream = await manager.resolveStreamForProgram(makeProgram());

        expect(stream.subtitleContext?.resolvedBaseUrl).toBe('https://relay.plex.tv');
    });

    it('escalates subtitle deactivation to burn-in in Full mode', async () => {
        expectPlaybackRecoveryWarn({
            event: 'burnInReload.start',
            reason: 'subtitle_extract_failed:subtitle_text_fetch_failed',
            trackId: 'sub-keyless',
            itemKey: 'item-1',
        });
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const keylessText: PlexStream = {
            id: 'sub-keyless',
            streamType: 3,
            language: 'English',
            languageCode: 'en',
            codec: 'srt',
            format: 'srt',
            forced: false,
            default: true,
            title: 'Keyless',
        };
        const directDecision = makeDecision({
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
            availableSubtitleStreams: [keylessText],
        });
        const burnInDecision = makeDecision({
            protocol: 'hls',
            isDirectPlay: false,
            isTranscoding: true,
            selectedSubtitleStream: keylessText,
            availableSubtitleStreams: [keylessText],
            transcodeRequest: {
                sessionId: 'sess-2',
                maxBitrate: 20000,
                subtitleStreamId: 'sub-keyless',
                subtitleMode: 'burn',
                mediaIndex: 0,
                partIndex: 0,
            },
        });

        const notifyToast = jest.fn();
        const notifySubtitleUnavailable = jest.fn();
        const { manager, resolver } = setup({ notifyToast, notifySubtitleUnavailable });
        (resolver.resolveStream as jest.Mock)
            .mockResolvedValueOnce(directDecision)
            .mockResolvedValueOnce(burnInDecision);

        const stream = await manager.resolveStreamForProgram(makeProgram());
        const handled = stream.subtitleContext?.onDeactivate?.({
            trackId: 'sub-keyless',
            reason: 'subtitle_text_fetch_failed',
        });

        expect(handled).toBe(true);
        await stream.subtitleContext?.onDeactivateRecovery?.({
            trackId: 'sub-keyless',
            reason: 'subtitle_text_fetch_failed',
        });

        expect(resolver.resolveStream).toHaveBeenCalledWith(
            expect.objectContaining({
                itemKey: 'item-1',
                directPlay: false,
                subtitleStreamId: 'sub-keyless',
                subtitleMode: 'burn',
            })
        );
        expect(notifyToast).toHaveBeenCalledWith({
            message: 'Subtitles failed to load. Trying burn-in…',
            type: 'info',
        });
    });

    it('skips burn-in reload when already in burn-in HLS for track', async () => {
        const { manager, resolver } = setup({
            getCurrentStreamDescriptor: () => ({ protocol: 'hls' } as StreamDescriptor),
            getCurrentStreamDecision: () => ({
                subtitleBurnIn: {
                    requested: true,
                    confirmed: true,
                    reason: 'requested',
                    subtitleStreamId: 'burn-1',
                    subtitleMode: 'burn',
                },
                transcodeRequest: {
                    sessionId: 'sess-1',
                    maxBitrate: 2000,
                    subtitleStreamId: 'burn-1',
                    subtitleMode: 'burn',
                },
            } as StreamDecision),
        });

        const result = await manager.attemptBurnInSubtitleForCurrentProgram('burn-1', 'test');

        expect(result).toEqual({ outcome: 'ignored', reason: 'already_burned_in' });
        expect(resolver.resolveStream).not.toHaveBeenCalled();
    });

    it('does not treat burn-in HLS as already burned in until PMS confirms the selected subtitle stream', async () => {
        expectPlaybackRecoveryWarn({
            event: 'burnInReload.start',
            trackId: 'burn-1',
            reason: 'test',
            itemKey: 'item-1',
        });
        const { manager, resolver } = setup({
            getCurrentStreamDescriptor: () => ({ protocol: 'hls' } as StreamDescriptor),
            getCurrentStreamDecision: () => ({
                subtitleBurnIn: {
                    requested: true,
                    confirmed: false,
                    reason: 'requested',
                    subtitleStreamId: 'burn-1',
                    subtitleMode: 'burn',
                },
                transcodeRequest: {
                    sessionId: 'sess-1',
                    maxBitrate: 2000,
                    subtitleStreamId: 'burn-1',
                    subtitleMode: 'burn',
                },
            } as StreamDecision),
        });

        const result = await manager.attemptBurnInSubtitleForCurrentProgram('burn-1', 'test');

        expect(result).toEqual({ outcome: 'burned_in' });
        expect(resolver.resolveStream).toHaveBeenCalledWith(
            expect.objectContaining({
                directPlay: false,
                subtitleStreamId: 'burn-1',
                subtitleMode: 'burn',
            })
        );
    });

    it('logs burn-in start and failure telemetry', async () => {
        expectPlaybackRecoveryWarn({
            event: 'burnInReload.start',
            trackId: 'sub-keyless',
            reason: 'subtitle_extract_failed:test',
            itemKey: 'item-1',
        });
        expectPlaybackRecoveryError({
            event: 'burnInReload.failed',
            trackId: 'sub-keyless',
            reason: 'subtitle_extract_failed:test',
            itemKey: 'item-1',
            safeError: expect.any(Object),
        });
        const { manager, resolver } = setup();
        (resolver.resolveStream as jest.Mock).mockRejectedValueOnce(new Error('burn-in failed'));

        const result = await manager.attemptBurnInSubtitleForCurrentProgram('sub-keyless', 'subtitle_extract_failed:test');

        expect(result).toEqual({ outcome: 'failed' });
    });

    it('surfaces PLAYBACK_FAILED when burn-in reload load failure likely unloaded prior playback', async () => {
        expectPlaybackRecoveryWarn({
            event: 'burnInReload.start',
            trackId: 'sub-keyless',
            reason: 'subtitle_extract_failed:test',
            itemKey: 'item-1',
        });
        expectPlaybackRecoveryError({
            event: 'burnInReload.failed',
            trackId: 'sub-keyless',
            reason: 'subtitle_extract_failed:test',
            itemKey: 'item-1',
            safeError: expect.any(Object),
        });
        const loadError = new Error('burn-in load failed');
        const player = {
            loadStream: jest.fn().mockRejectedValue(loadError),
            play: jest.fn().mockResolvedValue(undefined),
            getState: jest.fn().mockReturnValue(makePlayerState()),
            getCurrentTimeMs: jest.fn().mockReturnValue(5000),
        } as unknown as IVideoPlayer;
        const { manager, deps } = setup({
            getVideoPlayer: () => player,
        });

        const result = await manager.attemptBurnInSubtitleForCurrentProgram('sub-keyless', 'subtitle_extract_failed:test');

        expect(result).toEqual({ outcome: 'failed' });
        expect(deps.handleGlobalError).toHaveBeenCalledWith(
            expect.objectContaining({
                code: AppErrorCode.PLAYBACK_FAILED,
                recoverable: true,
            }),
            'playback'
        );
    });

    it('restores prior no-subtitle playback when burn-in reload fails after load replaces the stream', async () => {
        expectPlaybackRecoveryWarn({
            event: 'burnInReload.start',
            trackId: 'sub-keyless',
            reason: 'user_selected_text_burn_in',
            itemKey: 'item-1',
        });
        expectPlaybackRecoveryError({
            event: 'burnInReload.failed',
            trackId: 'sub-keyless',
            reason: 'user_selected_text_burn_in',
            itemKey: 'item-1',
            safeError: expect.any(Object),
        });
        const priorDecision = makeDecision({
            playbackUrl: 'http://test/prior.m3u8',
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
        });
        const priorDescriptor = {
            url: 'http://test/prior.m3u8',
            protocol: 'direct',
            preferredSubtitleTrackId: 'sub-old',
            startPositionMs: 0,
        } as StreamDescriptor;
        const burnInDecision = makeDecision({
            transcodeRequest: {
                sessionId: 'sess-burn',
                maxBitrate: 8000,
                subtitleStreamId: 'sub-keyless',
                subtitleMode: 'burn',
            },
            subtitleBurnIn: {
                requested: true,
                confirmed: false,
                reason: 'requested',
                subtitleStreamId: 'sub-keyless',
                subtitleMode: 'burn',
            },
        });
        const loadError = new Error('burn-in load failed');
        const player = {
            loadStream: jest.fn()
                .mockRejectedValueOnce(loadError)
                .mockResolvedValueOnce(undefined),
            play: jest.fn().mockResolvedValue(undefined),
            getState: jest.fn().mockReturnValue(makePlayerState({ status: 'playing' })),
            getCurrentTimeMs: jest.fn().mockReturnValue(12_345),
        } as unknown as IVideoPlayer;
        const { manager, resolver, deps } = setup({
            getVideoPlayer: () => player,
            getCurrentStreamDecision: () => priorDecision,
            getCurrentStreamDescriptor: () => priorDescriptor,
        });
        (resolver.resolveStream as jest.Mock).mockResolvedValueOnce(burnInDecision);

        const result = await manager.attemptBurnInSubtitleForCurrentProgram(
            'sub-keyless',
            'user_selected_text_burn_in'
        );

        expect(result).toEqual({ outcome: 'failed' });
        expect(resolver.resolveStream).toHaveBeenCalledTimes(1);
        expect(player.loadStream).toHaveBeenNthCalledWith(2, expect.objectContaining({
            url: 'http://test/prior.m3u8',
            preferredSubtitleTrackId: null,
            startPositionMs: 12_345,
        }));
        expect(player.play).toHaveBeenCalledTimes(1);
        expect(deps.setCurrentStreamDecision).toHaveBeenLastCalledWith(priorDecision);
        expect(deps.setCurrentStreamDescriptor).toHaveBeenLastCalledWith(expect.objectContaining({
            preferredSubtitleTrackId: null,
            startPositionMs: 12_345,
        }));
        expect(deps.handleGlobalError).not.toHaveBeenCalled();
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'playbackRecovery.burnInReloadFailed',
            expect.objectContaining({
                restoreOutcome: { outcome: 'restored' },
                attemptedBurnIn: expect.objectContaining({
                    failureStage: 'load',
                    manifestProbe: { runtime: 'not_run' },
                }),
            })
        );
    });

    it('does not restore a prior stream after burn-in failure when the scheduled program changed', async () => {
        expectPlaybackRecoveryWarn({
            event: 'burnInReload.start',
            trackId: 'sub-keyless',
            reason: 'user_selected_text_burn_in',
            itemKey: 'item-1',
        });
        expectPlaybackRecoveryError({
            event: 'burnInReload.failed',
            trackId: 'sub-keyless',
            reason: 'user_selected_text_burn_in',
            itemKey: 'item-1',
            safeError: expect.any(Object),
        });
        const priorDecision = makeDecision({
            playbackUrl: 'http://test/prior.m3u8',
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
        });
        const priorDescriptor = {
            url: 'http://test/prior.m3u8',
            protocol: 'direct',
            preferredSubtitleTrackId: 'sub-old',
            startPositionMs: 0,
        } as StreamDescriptor;
        const burnInDecision = makeDecision({
            transcodeRequest: {
                sessionId: 'sess-burn',
                maxBitrate: 8000,
                subtitleStreamId: 'sub-keyless',
                subtitleMode: 'burn',
            },
            subtitleBurnIn: {
                requested: true,
                confirmed: false,
                reason: 'requested',
                subtitleStreamId: 'sub-keyless',
                subtitleMode: 'burn',
            },
        });
        let currentProgram = makeProgram();
        const player = {
            loadStream: jest.fn().mockImplementationOnce(async () => {
                currentProgram = makeProgram({
                    item: { ...currentProgram.item, ratingKey: 'item-2' } as ScheduledProgram['item'],
                    scheduledStartTime: 60_000,
                    scheduledEndTime: 120_000,
                    scheduleIndex: 1,
                });
                throw new Error('burn-in load failed');
            }),
            play: jest.fn().mockResolvedValue(undefined),
            getState: jest.fn().mockReturnValue(makePlayerState({ status: 'playing' })),
            getCurrentTimeMs: jest.fn().mockReturnValue(12_345),
        } as unknown as IVideoPlayer;
        const { manager, resolver, deps, scheduler } = setup({
            getVideoPlayer: () => player,
            getCurrentProgramForPlayback: () => currentProgram,
            getCurrentProgramIdentityForPlayback: () => makeProgramIdentity(currentProgram),
            getCurrentStreamDecision: () => priorDecision,
            getCurrentStreamDescriptor: () => priorDescriptor,
        });
        (resolver.resolveStream as jest.Mock).mockResolvedValueOnce(burnInDecision);

        const result = await manager.attemptBurnInSubtitleForCurrentProgram(
            'sub-keyless',
            'user_selected_text_burn_in'
        );

        expect(result).toEqual({ outcome: 'failed' });
        expect(player.loadStream).toHaveBeenCalledTimes(1);
        expect(player.play).not.toHaveBeenCalled();
        expect(scheduler.pauseSyncTimer).not.toHaveBeenCalled();
        expect(deps.handleGlobalError).not.toHaveBeenCalled();
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'playbackRecovery.burnInReloadFailed',
            expect.objectContaining({
                restoreOutcome: { outcome: 'unavailable', reason: 'program_changed' },
            })
        );
    });

    it('does not restore a prior stream when scheduler ownership changes but the item key and start time stay the same', async () => {
        expectPlaybackRecoveryWarn({
            event: 'burnInReload.start',
            trackId: 'sub-keyless',
            reason: 'user_selected_text_burn_in',
            itemKey: 'item-1',
        });
        expectPlaybackRecoveryError({
            event: 'burnInReload.failed',
            trackId: 'sub-keyless',
            reason: 'user_selected_text_burn_in',
            itemKey: 'item-1',
            safeError: expect.any(Object),
        });
        const priorDecision = makeDecision({
            playbackUrl: 'http://test/prior.m3u8',
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
        });
        const priorDescriptor = {
            url: 'http://test/prior.m3u8',
            protocol: 'direct',
            preferredSubtitleTrackId: 'sub-old',
            startPositionMs: 0,
        } as StreamDescriptor;
        const burnInDecision = makeDecision({
            transcodeRequest: {
                sessionId: 'sess-burn',
                maxBitrate: 8000,
                subtitleStreamId: 'sub-keyless',
                subtitleMode: 'burn',
            },
            subtitleBurnIn: {
                requested: true,
                confirmed: false,
                reason: 'requested',
                subtitleStreamId: 'sub-keyless',
                subtitleMode: 'burn',
            },
        });
        const currentProgram = makeProgram();
        let currentProgramIdentity = makeProgramIdentity(currentProgram, 'ch1');
        const player = {
            loadStream: jest.fn().mockImplementationOnce(async () => {
                currentProgramIdentity = makeProgramIdentity(currentProgram, 'ch2');
                throw new Error('burn-in load failed');
            }),
            play: jest.fn().mockResolvedValue(undefined),
            getState: jest.fn().mockReturnValue(makePlayerState({ status: 'playing' })),
            getCurrentTimeMs: jest.fn().mockReturnValue(12_345),
        } as unknown as IVideoPlayer;
        const { manager, resolver, deps, scheduler } = setup({
            getVideoPlayer: () => player,
            getCurrentProgramForPlayback: () => currentProgram,
            getCurrentProgramIdentityForPlayback: () => currentProgramIdentity,
            getCurrentStreamDecision: () => priorDecision,
            getCurrentStreamDescriptor: () => priorDescriptor,
        });
        (resolver.resolveStream as jest.Mock).mockResolvedValueOnce(burnInDecision);

        const result = await manager.attemptBurnInSubtitleForCurrentProgram(
            'sub-keyless',
            'user_selected_text_burn_in'
        );

        expect(result).toEqual({ outcome: 'failed' });
        expect(player.loadStream).toHaveBeenCalledTimes(1);
        expect(player.play).not.toHaveBeenCalled();
        expect(scheduler.pauseSyncTimer).not.toHaveBeenCalled();
        expect(deps.handleGlobalError).not.toHaveBeenCalled();
        expect(deps.appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'playbackRecovery.burnInReloadFailed',
            expect.objectContaining({
                restoreOutcome: { outcome: 'unavailable', reason: 'program_changed' },
            })
        );
    });

    it('falls back to the program elapsed offset when the live position is not finite', async () => {
        expectPlaybackRecoveryWarn({
            event: 'audioReload.start',
            reason: 'audio_track_change',
            trackId: 'audio-alt',
            itemKey: 'item-1',
            preserveDirectPlayPreference: true,
        });
        const { manager, resolver, player } = setup({
            getCurrentStreamDecision: () => makeDecision({ isDirectPlay: true, isTranscoding: false }),
        });
        (player.getCurrentTimeMs as jest.Mock).mockReturnValue(NaN);

        await manager.attemptAudioTrackReloadForCurrentProgram('audio-alt', 'audio_track_change');

        expect(resolver.resolveStream).toHaveBeenCalledWith(
            expect.objectContaining({
                startOffsetMs: 5000,
            })
        );
    });

    it('stops the prior transcode session after resolving the disable-burn-in reload', async () => {
        expectPlaybackRecoveryWarn({
            event: 'disableBurnIn.start',
            reason: 'test',
            itemKey: 'item-1',
            burnedInTrackId: 'burn-1',
        });
        let releaseStop!: () => void;
        const stopPromise = new Promise<void>((resolve) => {
            releaseStop = resolve;
        });
        const { manager, resolver } = setup({
            getCurrentStreamDecision: () =>
                makeDecision({
                    protocol: 'hls',
                    isDirectPlay: false,
                    isTranscoding: true,
                    sessionId: 'sess-burn',
                    transcodeRequest: {
                        sessionId: 'sess-burn',
                        maxBitrate: 2000,
                        subtitleStreamId: 'burn-1',
                        subtitleMode: 'burn',
                    },
                } as Partial<StreamDecision>),
        });
        (resolver.stopTranscodeSession as jest.Mock).mockReturnValue(stopPromise);
        (resolver.resolveStream as jest.Mock).mockResolvedValue(
            makeDecision({
                protocol: 'http',
                isDirectPlay: true,
                isTranscoding: false,
            })
        );

        const result = await manager.attemptDisableBurnInSubtitlesForCurrentProgram('test');

        expect(result).toEqual({ outcome: 'disabled' });
        expect(resolver.resolveStream).toHaveBeenCalledWith(expect.objectContaining({
            subtitleMode: 'none',
        }));
        expect(resolver.stopTranscodeSession).toHaveBeenCalledWith('sess-burn');
        releaseStop();
    });

    it('continues disable-burn-in recovery when stopping the prior transcode session fails', async () => {
        expectPlaybackRecoveryWarn({
            event: 'disableBurnIn.start',
            reason: 'test',
            itemKey: 'item-1',
            burnedInTrackId: 'burn-1',
        });
        expectPlaybackRecoveryError({
            event: 'reloadPriorTranscodeStop.failed',
            sessionId: 'sess-burn',
            nextSessionId: 'sess-1',
            safeError: expect.any(Object),
        });
        const { manager, resolver } = setup({
            getCurrentStreamDecision: () =>
                makeDecision({
                    protocol: 'hls',
                    isDirectPlay: false,
                    isTranscoding: true,
                    sessionId: 'sess-burn',
                    transcodeRequest: {
                        sessionId: 'sess-burn',
                        maxBitrate: 2000,
                        subtitleStreamId: 'burn-1',
                        subtitleMode: 'burn',
                    },
                } as Partial<StreamDecision>),
        });
        (resolver.stopTranscodeSession as jest.Mock).mockRejectedValue(new Error('stop failed'));
        (resolver.resolveStream as jest.Mock).mockResolvedValue(
            makeDecision({
                protocol: 'http',
                isDirectPlay: true,
                isTranscoding: false,
            })
        );

        const result = await manager.attemptDisableBurnInSubtitlesForCurrentProgram('test');

        expect(result).toEqual({ outcome: 'disabled' });
        expect(resolver.stopTranscodeSession).toHaveBeenCalledWith('sess-burn');
        expect(resolver.resolveStream).toHaveBeenCalledWith(expect.objectContaining({
            subtitleMode: 'none',
        }));
    });

    it('suppresses repeated automatic burn-in recovery attempts after the first failure', async () => {
        expectPlaybackRecoveryWarn({
            event: 'burnInReload.start',
            reason: 'subtitle_extract_failed:test',
            trackId: 'sub-keyless',
            itemKey: 'item-1',
        });
        expectPlaybackRecoveryError({
            event: 'burnInReload.failed',
            reason: 'subtitle_extract_failed:test',
            trackId: 'sub-keyless',
            itemKey: 'item-1',
            safeError: expect.any(Object),
        });
        const { manager, resolver } = setup();
        (resolver.resolveStream as jest.Mock).mockRejectedValue(new Error('burn-in failed'));

        const first = await manager.attemptBurnInSubtitleForCurrentProgram(
            'sub-keyless',
            'subtitle_extract_failed:test'
        );
        const second = await manager.attemptBurnInSubtitleForCurrentProgram(
            'sub-keyless',
            'subtitle_extract_failed:test'
        );

        expect(first).toEqual({ outcome: 'failed' });
        expect(second).toEqual({ outcome: 'ignored', reason: 'already_attempted' });
        expect(resolver.resolveStream).toHaveBeenCalledTimes(1);
    });

    it('does not suppress automatic burn-in retries for a later occurrence of the same item', async () => {
        expectPlaybackRecoveryWarn({
            event: 'burnInReload.start',
            reason: 'subtitle_extract_failed:test',
            trackId: 'sub-keyless',
            itemKey: 'item-1',
        }, { times: 2 });
        expectPlaybackRecoveryError({
            event: 'burnInReload.failed',
            reason: 'subtitle_extract_failed:test',
            trackId: 'sub-keyless',
            itemKey: 'item-1',
            safeError: expect.any(Object),
        }, { times: 2 });
        const originalProgram = makeProgram();
        let currentProgram = originalProgram;
        const { manager, resolver } = setup({
            getCurrentProgramForPlayback: () => currentProgram,
            getCurrentProgramIdentityForPlayback: () => makeProgramIdentity(currentProgram),
        });
        (resolver.resolveStream as jest.Mock).mockRejectedValue(new Error('burn-in failed'));

        const first = await manager.attemptBurnInSubtitleForCurrentProgram(
            'sub-keyless',
            'subtitle_extract_failed:test'
        );
        currentProgram = makeLaterOccurrence(originalProgram);
        const second = await manager.attemptBurnInSubtitleForCurrentProgram(
            'sub-keyless',
            'subtitle_extract_failed:test'
        );

        expect(first).toEqual({ outcome: 'failed' });
        expect(second).toEqual({ outcome: 'failed' });
        expect(resolver.resolveStream).toHaveBeenCalledTimes(2);
    });

    it('allows explicit user retries after a failed burn-in attempt', async () => {
        expectPlaybackRecoveryWarn({
            event: 'burnInReload.start',
            reason: 'user_selected_burn_in_format',
            trackId: 'sub-keyless',
            itemKey: 'item-1',
        }, { times: 2 });
        expectPlaybackRecoveryError({
            event: 'burnInReload.failed',
            reason: 'user_selected_burn_in_format',
            trackId: 'sub-keyless',
            itemKey: 'item-1',
            safeError: expect.any(Object),
        }, { times: 2 });
        const { manager, resolver } = setup();
        (resolver.resolveStream as jest.Mock).mockRejectedValue(new Error('burn-in failed'));

        const first = await manager.attemptBurnInSubtitleForCurrentProgram(
            'sub-keyless',
            'user_selected_burn_in_format'
        );
        const second = await manager.attemptBurnInSubtitleForCurrentProgram(
            'sub-keyless',
            'user_selected_burn_in_format'
        );

        expect(first).toEqual({ outcome: 'failed' });
        expect(second).toEqual({ outcome: 'failed' });
        expect(resolver.resolveStream).toHaveBeenCalledTimes(2);
    });

    it('allows an explicit user retry after an automatic burn-in recovery failure', async () => {
        expectPlaybackRecoveryWarn({
            event: 'burnInReload.start',
            reason: 'subtitle_extract_failed:test',
            trackId: 'sub-keyless',
            itemKey: 'item-1',
        });
        expectPlaybackRecoveryError({
            event: 'burnInReload.failed',
            reason: 'subtitle_extract_failed:test',
            trackId: 'sub-keyless',
            itemKey: 'item-1',
            safeError: expect.any(Object),
        });
        expectPlaybackRecoveryWarn({
            event: 'burnInReload.start',
            reason: 'user_selected_burn_in_format',
            trackId: 'sub-keyless',
            itemKey: 'item-1',
        });
        expectPlaybackRecoveryError({
            event: 'burnInReload.failed',
            reason: 'user_selected_burn_in_format',
            trackId: 'sub-keyless',
            itemKey: 'item-1',
            safeError: expect.any(Object),
        });
        const { manager, resolver } = setup();
        (resolver.resolveStream as jest.Mock).mockRejectedValue(new Error('burn-in failed'));

        const automaticFailure = await manager.attemptBurnInSubtitleForCurrentProgram(
            'sub-keyless',
            'subtitle_extract_failed:test'
        );
        const manualRetry = await manager.attemptBurnInSubtitleForCurrentProgram(
            'sub-keyless',
            'user_selected_burn_in_format'
        );

        expect(automaticFailure).toEqual({ outcome: 'failed' });
        expect(manualRetry).toEqual({ outcome: 'failed' });
        expect(resolver.resolveStream).toHaveBeenCalledTimes(2);
    });

    it('does not notify subtitle unavailable when subtitle deactivation burn-in recovery fails', async () => {
        expectPlaybackRecoveryWarn({
            event: 'burnInReload.start',
            reason: 'subtitle_extract_failed:subtitle_text_fetch_failed',
            trackId: 'sub-keyless',
            itemKey: 'item-1',
        });
        expectPlaybackRecoveryError({
            event: 'burnInReload.failed',
            reason: 'subtitle_extract_failed:subtitle_text_fetch_failed',
            trackId: 'sub-keyless',
            itemKey: 'item-1',
            safeError: expect.any(Object),
        });
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const keylessText: PlexStream = {
            id: 'sub-keyless',
            streamType: 3,
            language: 'English',
            languageCode: 'en',
            codec: 'srt',
            format: 'srt',
            forced: false,
            default: true,
            title: 'Keyless',
        };
        const directDecision = makeDecision({
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
            availableSubtitleStreams: [keylessText],
        });

        const notifyToast = jest.fn();
        const notifySubtitleUnavailable = jest.fn();
        const { manager, resolver } = setup({ notifyToast, notifySubtitleUnavailable });
        (resolver.resolveStream as jest.Mock)
            .mockResolvedValueOnce(directDecision)
            .mockRejectedValueOnce(new Error('burn-in failed'));

        const stream = await manager.resolveStreamForProgram(makeProgram());
        const handled = stream.subtitleContext?.onDeactivate?.({
            trackId: 'sub-keyless',
            reason: 'subtitle_text_fetch_failed',
        });

        expect(handled).toBe(true);
        const recoveryResult = await stream.subtitleContext?.onDeactivateRecovery?.({
            trackId: 'sub-keyless',
            reason: 'subtitle_text_fetch_failed',
        });

        expect(notifyToast).toHaveBeenCalledWith({
            message: 'Subtitles failed to load. Trying burn-in…',
            type: 'info',
        });
        expect(recoveryResult).toBe('failed');
        expect(notifySubtitleUnavailable).not.toHaveBeenCalled();
    });

    it('returns failed when automatic subtitle deactivation recovery is ignored after a prior attempt', async () => {
        expectPlaybackRecoveryWarn({
            event: 'burnInReload.start',
            reason: 'subtitle_extract_failed:subtitle_text_fetch_failed',
            trackId: 'sub-keyless',
            itemKey: 'item-1',
        });
        expectPlaybackRecoveryError({
            event: 'burnInReload.failed',
            reason: 'subtitle_extract_failed:subtitle_text_fetch_failed',
            trackId: 'sub-keyless',
            itemKey: 'item-1',
            safeError: expect.any(Object),
        });
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const keylessText: PlexStream = {
            id: 'sub-keyless',
            streamType: 3,
            language: 'English',
            languageCode: 'en',
            codec: 'srt',
            format: 'srt',
            forced: false,
            default: true,
            title: 'Keyless',
        };
        const directDecision = makeDecision({
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
            availableSubtitleStreams: [keylessText],
        });

        const notifyToast = jest.fn();
        const notifySubtitleUnavailable = jest.fn();
        const { manager, resolver } = setup({ notifyToast, notifySubtitleUnavailable });
        (resolver.resolveStream as jest.Mock)
            .mockResolvedValueOnce(directDecision)
            .mockRejectedValueOnce(new Error('burn-in failed'));

        const stream = await manager.resolveStreamForProgram(makeProgram());

        const firstRecoveryResult = await stream.subtitleContext?.onDeactivateRecovery?.({
            trackId: 'sub-keyless',
            reason: 'subtitle_text_fetch_failed',
        });
        const secondRecoveryResult = await stream.subtitleContext?.onDeactivateRecovery?.({
            trackId: 'sub-keyless',
            reason: 'subtitle_text_fetch_failed',
        });

        expect(firstRecoveryResult).toBe('failed');
        expect(secondRecoveryResult).toBe('failed');
        expect(notifyToast).toHaveBeenCalledTimes(1);
        expect(resolver.resolveStream).toHaveBeenCalledTimes(2);
        expect(notifySubtitleUnavailable).not.toHaveBeenCalled();
    });

    it('does not show the burn-in retry toast when subtitle deactivation recovery is ignored', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'full');

        const keylessText: PlexStream = {
            id: 'sub-keyless',
            streamType: 3,
            language: 'English',
            languageCode: 'en',
            codec: 'srt',
            format: 'srt',
            forced: false,
            default: true,
            title: 'Keyless',
        };
        const directDecision = makeDecision({
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
            availableSubtitleStreams: [keylessText],
        });

        const notifyToast = jest.fn();
        const notifySubtitleUnavailable = jest.fn();
        const { manager, resolver } = setup({
            notifyToast,
            notifySubtitleUnavailable,
            getCurrentStreamDescriptor: () => ({ protocol: 'hls' } as StreamDescriptor),
            getCurrentStreamDecision: () =>
                ({
                    subtitleBurnIn: {
                        requested: true,
                        confirmed: true,
                        reason: 'requested',
                        subtitleStreamId: 'sub-keyless',
                        subtitleMode: 'burn',
                    },
                    transcodeRequest: {
                        sessionId: 'sess-burn',
                        maxBitrate: 2000,
                        subtitleStreamId: 'sub-keyless',
                        subtitleMode: 'burn',
                    },
                } as StreamDecision),
        });
        (resolver.resolveStream as jest.Mock).mockResolvedValueOnce(directDecision);

        const stream = await manager.resolveStreamForProgram(makeProgram());
        const handled = stream.subtitleContext?.onDeactivate?.({
            trackId: 'sub-keyless',
            reason: 'subtitle_text_fetch_failed',
        });

        expect(handled).toBe(true);
        await stream.subtitleContext?.onDeactivateRecovery?.({
            trackId: 'sub-keyless',
            reason: 'subtitle_text_fetch_failed',
        });

        expect(notifyToast).not.toHaveBeenCalledWith({
            message: 'Subtitles failed to load. Trying burn-in…',
            type: 'info',
        });
        expect(notifySubtitleUnavailable).not.toHaveBeenCalled();
    });

    it('reloads direct play when disabling burn-in subtitles', async () => {
        expectPlaybackRecoveryWarn({
            event: 'disableBurnIn.start',
            reason: 'test',
            itemKey: 'item-1',
            burnedInTrackId: 'sub-keyless',
        });
        const burnInDecision = makeDecision({
            protocol: 'hls',
            isDirectPlay: false,
            isTranscoding: true,
            sessionId: 'sess-burn',
            transcodeRequest: {
                sessionId: 'sess-burn',
                maxBitrate: 20000,
                subtitleStreamId: 'sub-keyless',
                subtitleMode: 'burn',
                mediaIndex: 0,
                partIndex: 0,
            },
        });
        const directDecision = makeDecision({
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
        });

        const { manager, resolver, player, deps } = setup({
            getCurrentStreamDecision: () => burnInDecision,
        });
        (resolver.resolveStream as jest.Mock).mockResolvedValueOnce(directDecision);

        const result = await manager.attemptDisableBurnInSubtitlesForCurrentProgram('test');

        expect(result).toEqual({ outcome: 'disabled' });
        expect((resolver.stopTranscodeSession as jest.Mock)).toHaveBeenCalledWith('sess-burn');
        expect(resolver.resolveStream).toHaveBeenCalledWith(
            expect.objectContaining({
                itemKey: 'item-1',
                directPlay: true,
            })
        );
        expect(deps.setCurrentStreamDescriptor).toHaveBeenCalledWith(
            expect.objectContaining({ preferredSubtitleTrackId: null })
        );
        expect(player.loadStream).toHaveBeenCalled();
        expect(player.play).toHaveBeenCalled();
    });

    it('logs disable burn-in start and abort telemetry when program changes', async () => {
        expectPlaybackRecoveryWarn({
            event: 'disableBurnIn.start',
            reason: 'subtitle_decode_stable',
            itemKey: 'item-1',
        });
        expectPlaybackRecoveryWarn({
            event: 'disableBurnIn.aborted',
            reason: 'subtitle_decode_stable',
            itemKey: 'item-1',
            outcome: 'program_changed',
        });
        const burnInDecision = makeDecision({
            protocol: 'hls',
            isDirectPlay: false,
            isTranscoding: true,
            sessionId: 'sess-burn',
            transcodeRequest: {
                sessionId: 'sess-burn',
                maxBitrate: 20000,
                subtitleStreamId: 'sub-keyless',
                subtitleMode: 'burn',
                mediaIndex: 0,
                partIndex: 0,
            },
        });
        const directDecision = makeDecision({
            protocol: 'http',
            isDirectPlay: true,
            isTranscoding: false,
        });

        let currentProgram = makeProgram();
        const { manager, resolver } = setup({
            getCurrentProgramForPlayback: () => currentProgram,
            getCurrentProgramIdentityForPlayback: () => makeProgramIdentity(currentProgram),
            getCurrentStreamDecision: () => burnInDecision,
        });
        (resolver.resolveStream as jest.Mock).mockImplementationOnce(async () => {
            currentProgram = makeProgram({ item: { ...currentProgram.item, ratingKey: 'item-2' } as never });
            return directDecision;
        });

        const result = await manager.attemptDisableBurnInSubtitlesForCurrentProgram('subtitle_decode_stable');

        expect(result).toEqual({ outcome: 'ignored', reason: 'program_changed' });
    });

    it('prefers forced subtitles when preference is enabled', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'standard');
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_PREFER_FORCED, '1');

        const resolver: IPlexStreamResolver = {
            resolveStream: jest.fn().mockResolvedValue(
                makeDecision({ availableSubtitleStreams: makeSubtitleStreams() })
            ),
        } as unknown as IPlexStreamResolver;

        const { manager } = setup({
            getStreamResolver: () => resolver,
            getPreferredSubtitleLanguage: () => 'en',
        });
        const stream = await manager.resolveStreamForProgram(makeProgram());

        expect(stream.preferredSubtitleTrackId).toBe('sub-forced');
    });

    it('prefers full subtitles when preference is disabled', async () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_MODE, 'standard');
        localStorage.setItem(LINEUP_STORAGE_KEYS.SUBTITLE_PREFER_FORCED, '0');

        const resolver: IPlexStreamResolver = {
            resolveStream: jest.fn().mockResolvedValue(
                makeDecision({ availableSubtitleStreams: makeSubtitleStreams() })
            ),
        } as unknown as IPlexStreamResolver;

        const { manager } = setup({
            getStreamResolver: () => resolver,
            getPreferredSubtitleLanguage: () => 'en',
        });
        const stream = await manager.resolveStreamForProgram(makeProgram());

        expect(stream.preferredSubtitleTrackId).toBe('sub-full');
    });
});
