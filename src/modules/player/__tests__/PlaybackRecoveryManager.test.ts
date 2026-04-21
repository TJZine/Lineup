import { PlaybackRecoveryManager, type PlaybackRecoveryDeps } from '../PlaybackRecoveryManager';
import { AppErrorCode } from '../../lifecycle';
import type { IVideoPlayer, StreamDescriptor } from '../index';
import type { IPlexStreamResolver, StreamDecision } from '../../plex/stream';
import type { PlexStream } from '../../plex/shared/types';
import type { IChannelScheduler, ScheduledProgram } from '../../scheduler/scheduler';
import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';

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
        getState: jest.fn().mockReturnValue({ channelId: 'ch1' }),
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

    it('skips on failures until tripped, then pauses and surfaces error', () => {
        const { manager, scheduler, deps } = setup();
        const handleGlobalError = deps.handleGlobalError as jest.Mock;
        const appendIssueDiagnostic = deps.appendIssueDiagnostic as jest.Mock;

        manager.handlePlaybackFailure('context', new Error('boom'));
        manager.handlePlaybackFailure('context', new Error('boom'));

        expect(scheduler.skipToNext).toHaveBeenCalledTimes(2);
        expect(scheduler.pauseSyncTimer).not.toHaveBeenCalled();
        expect(appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'playbackRecovery.skipToNext',
            expect.objectContaining({
                context: 'context',
                failureCount: 1,
            })
        );
        expect(appendIssueDiagnostic).toHaveBeenCalledWith(
            'QA-003b',
            'playbackRecovery.skipToNext',
            expect.objectContaining({
                context: 'context',
                failureCount: 2,
            })
        );

        manager.handlePlaybackFailure('context', new Error('boom'));

        expect(scheduler.pauseSyncTimer).toHaveBeenCalled();
        expect(handleGlobalError).toHaveBeenCalledWith(
            expect.objectContaining({
                code: AppErrorCode.PLAYBACK_FAILED,
                message: 'Playback failed repeatedly',
                recoverable: true,
                context: expect.objectContaining({
                    source: 'context',
                    failureCount: 3,
                    safeError: expect.any(Object),
                    itemKey: 'item-1',
                    channelId: 'ch1',
                }),
            }),
            'playback'
        );
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
        const { manager, resolver, deps } = setup({
            getCurrentProgramForPlayback: () => makeProgram({ elapsedMs: 999999 }),
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
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const { manager, resolver } = setup();
        (resolver.resolveStream as jest.Mock).mockRejectedValueOnce(new Error('audio reload failed'));

        const result = await manager.attemptAudioTrackReloadForCurrentProgram('audio-alt', 'audio_track_change');

        expect(result).toEqual({ outcome: 'failed' });
        expect(warnSpy).toHaveBeenCalledWith(
            'playback_recovery',
            expect.objectContaining({
                event: 'audioReload.start',
                reason: 'audio_track_change',
                trackId: 'audio-alt',
                itemKey: 'item-1',
                preserveDirectPlayPreference: true,
            })
        );
        expect(errorSpy).toHaveBeenCalledWith(
            'playback_recovery',
            expect.objectContaining({
                event: 'audioReload.failed',
                reason: 'audio_track_change',
                trackId: 'audio-alt',
                itemKey: 'item-1',
                safeError: expect.any(Object),
            })
        );
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
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const { manager, resolver } = setup();
        (resolver.resolveStream as jest.Mock).mockRejectedValueOnce(new Error('resolver boom'));

        const ok = await manager.attemptTranscodeFallbackForCurrentProgram('subtitle_decode_failed');

        expect(ok).toBe(false);
        expect(warnSpy).toHaveBeenCalledWith(
            'playback_recovery',
            expect.objectContaining({
                event: 'transcodeFallback.start',
                reason: 'subtitle_decode_failed',
                itemKey: 'item-1',
            })
        );
        expect(errorSpy).toHaveBeenCalledWith(
            'playback_recovery',
            expect.objectContaining({
                event: 'transcodeFallback.failed',
                reason: 'subtitle_decode_failed',
                itemKey: 'item-1',
                safeError: expect.any(Object),
            })
        );
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
        await new Promise((resolve) => setTimeout(resolve, 0));

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
        expect(notifyToast).toHaveBeenCalledWith(
            'Subtitles failed to load. Trying burn-in…',
            'info'
        );
    });

    it('skips burn-in reload when already in burn-in HLS for track', async () => {
        const { manager, resolver } = setup({
            getCurrentStreamDescriptor: () => ({ protocol: 'hls' } as StreamDescriptor),
            getCurrentStreamDecision: () => ({
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

    it('logs burn-in start and failure telemetry', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const { manager, resolver } = setup();
        (resolver.resolveStream as jest.Mock).mockRejectedValueOnce(new Error('burn-in failed'));

        const result = await manager.attemptBurnInSubtitleForCurrentProgram('sub-keyless', 'subtitle_extract_failed:test');

        expect(result).toEqual({ outcome: 'failed' });
        expect(warnSpy).toHaveBeenCalledWith(
            'playback_recovery',
            expect.objectContaining({
                event: 'burnInReload.start',
                trackId: 'sub-keyless',
                reason: 'subtitle_extract_failed:test',
                itemKey: 'item-1',
            })
        );
        expect(errorSpy).toHaveBeenCalledWith(
            'playback_recovery',
            expect.objectContaining({
                event: 'burnInReload.failed',
                trackId: 'sub-keyless',
                reason: 'subtitle_extract_failed:test',
                itemKey: 'item-1',
                safeError: expect.any(Object),
            })
        );
    });

    it('falls back to the program elapsed offset when the live position is not finite', async () => {
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

    it('waits for the transcode stop request before resolving the disable-burn-in reload', async () => {
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

        const pending = manager.attemptDisableBurnInSubtitlesForCurrentProgram('test');
        await Promise.resolve();

        expect(resolver.stopTranscodeSession).toHaveBeenCalledWith('sess-burn');
        expect(resolver.resolveStream).not.toHaveBeenCalled();

        releaseStop();
        await pending;

        expect(resolver.resolveStream).toHaveBeenCalledTimes(1);
    });

    it('continues disable-burn-in recovery when stopping the prior transcode session fails', async () => {
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
        expect(resolver.resolveStream).toHaveBeenCalledTimes(1);
    });

    it('suppresses repeated automatic burn-in recovery attempts after the first failure', async () => {
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

    it('allows explicit user retries after a failed burn-in attempt', async () => {
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

        expect(notifyToast).toHaveBeenCalledWith('Subtitles failed to load. Trying burn-in…', 'info');
        expect(recoveryResult).toBe('failed');
        expect(notifySubtitleUnavailable).not.toHaveBeenCalled();
    });

    it('returns failed when automatic subtitle deactivation recovery is ignored after a prior attempt', async () => {
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

        expect(notifyToast).not.toHaveBeenCalledWith(
            'Subtitles failed to load. Trying burn-in…',
            'info'
        );
        expect(notifySubtitleUnavailable).not.toHaveBeenCalled();
    });

    it('reloads direct play when disabling burn-in subtitles', async () => {
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
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
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
            getCurrentStreamDecision: () => burnInDecision,
        });
        (resolver.resolveStream as jest.Mock).mockImplementationOnce(async () => {
            currentProgram = makeProgram({ item: { ...currentProgram.item, ratingKey: 'item-2' } as never });
            return directDecision;
        });

        const result = await manager.attemptDisableBurnInSubtitlesForCurrentProgram('subtitle_decode_stable');

        expect(result).toEqual({ outcome: 'ignored', reason: 'program_changed' });
        expect(warnSpy).toHaveBeenCalledWith(
            'playback_recovery',
            expect.objectContaining({
                event: 'disableBurnIn.start',
                reason: 'subtitle_decode_stable',
                itemKey: 'item-1',
            })
        );
        expect(warnSpy).toHaveBeenCalledWith(
            'playback_recovery',
            expect.objectContaining({
                event: 'disableBurnIn.aborted',
                reason: 'subtitle_decode_stable',
                itemKey: 'item-1',
                outcome: 'program_changed',
            })
        );
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
