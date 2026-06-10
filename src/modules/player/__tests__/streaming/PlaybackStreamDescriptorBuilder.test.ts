import { PlaybackStreamDescriptorBuilder } from '../../streaming/PlaybackStreamDescriptorBuilder';
import type { PlexStream, StreamDecision } from '../../../plex/stream';
import type { ScheduledProgram } from '../../../scheduler/scheduler';

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
        playbackUrl: 'https://relay.plex.tv/video/:/transcode/universal/start.m3u8?session=sess-1',
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

const makeBuilder = (
    overrides: Partial<ConstructorParameters<typeof PlaybackStreamDescriptorBuilder>[0]> = {}
): PlaybackStreamDescriptorBuilder => new PlaybackStreamDescriptorBuilder({
    buildPlexResourceUrl: (pathOrUrl): string => pathOrUrl,
    getMimeType: (): string => 'video/mp4',
    getAuthHeaders: (): Record<string, string> => ({ 'X-Plex-Token': 'token' }),
    getServerUri: (): string => 'http://example.com',
    getPreferredSubtitleLanguage: (): null => null,
    getPlexPreferredSubtitleLanguage: (): null => null,
    notifySubtitleUnavailable: jest.fn(),
    readSubtitleMode: (): 'full' => 'full',
    preferForcedSubtitles: (): boolean => false,
    shouldHandleSubtitleDeactivation: (): boolean => true,
    recoverSubtitleDeactivation: jest.fn().mockResolvedValue('handled'),
    ...overrides,
});

describe('PlaybackStreamDescriptorBuilder', () => {
    it('aligns audio defaults to the selected stream and derives subtitle context from the resolved playback URL', () => {
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
        const builder = new PlaybackStreamDescriptorBuilder({
            buildPlexResourceUrl: (pathOrUrl): string => pathOrUrl,
            getMimeType: (): string => 'video/mp4',
            getAuthHeaders: (): Record<string, string> => ({ 'X-Plex-Token': 'token' }),
            getServerUri: (): string => 'http://example.com',
            getPreferredSubtitleLanguage: (): null => null,
            getPlexPreferredSubtitleLanguage: (): null => null,
            notifySubtitleUnavailable: jest.fn(),
            readSubtitleMode: (): 'full' => 'full',
            preferForcedSubtitles: (): boolean => false,
            shouldHandleSubtitleDeactivation: (): boolean => true,
            recoverSubtitleDeactivation: jest.fn().mockResolvedValue('handled'),
        });

        const descriptor = builder.build(
            makeProgram(),
            makeDecision({
                selectedAudioStream: aac,
                availableAudioStreams: [truehd, aac],
                availableSubtitleStreams: makeSubtitleStreams(),
            }),
            5000
        );

        expect(descriptor.audioTracks.filter((track) => track.default).map((track) => track.id)).toEqual([
            'audio-aac',
        ]);
        expect(descriptor.subtitleContext?.resolvedBaseUrl).toBe('https://relay.plex.tv');
    });

    it('prefers forced subtitles when forced preference is enabled', () => {
        const builder = new PlaybackStreamDescriptorBuilder({
            buildPlexResourceUrl: (pathOrUrl): string => pathOrUrl,
            getMimeType: (): string => 'video/mp4',
            getAuthHeaders: (): Record<string, string> => ({ 'X-Plex-Token': 'token' }),
            getServerUri: (): string => 'http://example.com',
            getPreferredSubtitleLanguage: (): string => 'en',
            getPlexPreferredSubtitleLanguage: (): null => null,
            notifySubtitleUnavailable: jest.fn(),
            readSubtitleMode: (): 'full' => 'full',
            preferForcedSubtitles: (): boolean => true,
            shouldHandleSubtitleDeactivation: (): boolean => true,
            recoverSubtitleDeactivation: jest.fn().mockResolvedValue('handled'),
        });

        const descriptor = builder.build(
            makeProgram(),
            makeDecision({ availableSubtitleStreams: makeSubtitleStreams() }),
            5000
        );

        expect(descriptor.preferredSubtitleTrackId).toBe('sub-forced');
    });

    it('uses dynamic Plex language only when the app language override is unset', () => {
        const builder = makeBuilder({
            getPreferredSubtitleLanguage: (): string => 'es',
            getPlexPreferredSubtitleLanguage: (): string => 'en',
        });

        const descriptor = builder.build(
            makeProgram(),
            makeDecision({
                availableSubtitleStreams: [
                    ...makeSubtitleStreams(),
                    {
                        id: 'sub-es',
                        streamType: 3,
                        language: 'Spanish',
                        languageCode: 'spa',
                        codec: 'srt',
                        format: 'srt',
                        key: '/library/streams/3',
                        forced: false,
                        default: false,
                        title: 'Spanish',
                    },
                ],
            }),
            5000
        );

        expect(descriptor.preferredSubtitleTrackId).toBe('sub-es');

        const autoBuilder = makeBuilder({
            getPreferredSubtitleLanguage: (): null => null,
            getPlexPreferredSubtitleLanguage: (): string => 'eng',
        });

        const autoDescriptor = autoBuilder.build(
            makeProgram(),
            makeDecision({ availableSubtitleStreams: makeSubtitleStreams() }),
            5000
        );

        expect(autoDescriptor.preferredSubtitleTrackId).toBe('sub-full');
    });

    it('matches preferred subtitle languages across app codes, Plex codes, and display names', () => {
        const descriptor = makeBuilder({
            getPreferredSubtitleLanguage: (): string => 'English',
        }).build(
            makeProgram(),
            makeDecision({
                availableSubtitleStreams: [
                    {
                        id: 'sub-eng',
                        streamType: 3,
                        language: 'Eng',
                        languageCode: 'eng',
                        codec: 'srt',
                        format: 'srt',
                        key: '/library/streams/eng',
                        forced: false,
                        default: false,
                        title: 'English',
                    },
                ],
            }),
            5000
        );

        expect(descriptor.preferredSubtitleTrackId).toBe('sub-eng');
    });

    it('selects a single forced track before default fallback when no language preference matches', () => {
        const descriptor = makeBuilder({
            getPreferredSubtitleLanguage: (): string => 'ja',
            getPlexPreferredSubtitleLanguage: (): null => null,
            preferForcedSubtitles: (): boolean => true,
        }).build(
            makeProgram(),
            makeDecision({
                availableSubtitleStreams: [
                    {
                        id: 'sub-full',
                        streamType: 3,
                        language: 'English',
                        languageCode: 'en',
                        codec: 'srt',
                        format: 'srt',
                        key: '/library/streams/full',
                        forced: false,
                        default: true,
                        title: 'Full',
                    },
                    {
                        id: 'sub-forced-only',
                        streamType: 3,
                        language: 'English',
                        languageCode: 'eng',
                        codec: 'srt',
                        format: 'srt',
                        key: '/library/streams/forced',
                        forced: true,
                        default: false,
                        title: 'Forced',
                    },
                ],
            }),
            5000
        );

        expect(descriptor.preferredSubtitleTrackId).toBe('sub-forced-only');
    });

    it('falls back to the exact default subtitle track when no language or forced preference selects one', () => {
        const descriptor = makeBuilder({
            getPreferredSubtitleLanguage: (): null => null,
            getPlexPreferredSubtitleLanguage: (): null => null,
        }).build(
            makeProgram(),
            makeDecision({
                availableSubtitleStreams: [
                    {
                        id: 'sub-non-default-same-language',
                        streamType: 3,
                        language: 'English',
                        languageCode: 'en',
                        codec: 'srt',
                        format: 'srt',
                        key: '/library/streams/non-default',
                        forced: false,
                        default: false,
                        title: 'Non-default',
                    },
                    {
                        id: 'sub-default',
                        streamType: 3,
                        language: 'English',
                        languageCode: 'eng',
                        codec: 'srt',
                        format: 'srt',
                        key: '/library/streams/default',
                        forced: false,
                        default: true,
                        title: 'Default',
                    },
                ],
            }),
            5000
        );

        expect(descriptor.preferredSubtitleTrackId).toBe('sub-default');
    });

    it('selects no subtitle tracks when subtitles are off', () => {
        const descriptor = makeBuilder({
            readSubtitleMode: (): 'off' => 'off',
            getPreferredSubtitleLanguage: (): string => 'en',
        }).build(
            makeProgram(),
            makeDecision({ availableSubtitleStreams: makeSubtitleStreams() }),
            5000
        );

        expect(descriptor.subtitleTracks).toEqual([]);
        expect(descriptor.preferredSubtitleTrackId).toBeNull();
        expect(descriptor.subtitleContext).toBeUndefined();
    });

    it('marks subtitle context as burned in only when PMS burn is confirmed', () => {
        const builder = new PlaybackStreamDescriptorBuilder({
            buildPlexResourceUrl: (pathOrUrl): string => pathOrUrl,
            getMimeType: (): string => 'video/mp4',
            getAuthHeaders: (): Record<string, string> => ({ 'X-Plex-Token': 'token' }),
            getServerUri: (): string => 'http://example.com',
            getPreferredSubtitleLanguage: (): string => 'en',
            getPlexPreferredSubtitleLanguage: (): null => null,
            notifySubtitleUnavailable: jest.fn(),
            readSubtitleMode: (): 'full' => 'full',
            preferForcedSubtitles: (): boolean => false,
            shouldHandleSubtitleDeactivation: (): boolean => true,
            recoverSubtitleDeactivation: jest.fn().mockResolvedValue('handled'),
        });

        const unconfirmed = builder.build(
            makeProgram(),
            makeDecision({
                availableSubtitleStreams: makeSubtitleStreams(),
                subtitleBurnIn: {
                    requested: true,
                    confirmed: false,
                    reason: 'requested',
                    subtitleStreamId: 'sub-full',
                    subtitleMode: 'burn',
                },
                transcodeRequest: {
                    sessionId: 'sess-1',
                    maxBitrate: 8000,
                    subtitleStreamId: 'sub-full',
                    subtitleMode: 'burn',
                },
            }),
            5000
        );
        const confirmed = builder.build(
            makeProgram(),
            makeDecision({
                availableSubtitleStreams: makeSubtitleStreams(),
                subtitleBurnIn: {
                    requested: true,
                    confirmed: true,
                    reason: 'requested',
                    subtitleStreamId: 'sub-full',
                    subtitleMode: 'burn',
                },
                transcodeRequest: {
                    sessionId: 'sess-1',
                    maxBitrate: 8000,
                    subtitleStreamId: 'sub-full',
                    subtitleMode: 'burn',
                },
            }),
            5000
        );

        expect(unconfirmed.subtitleContext?.confirmedBurnedInSubtitleTrackId).toBeNull();
        expect(unconfirmed.subtitleContext?.localExtractionSuppression).toEqual({
            trackId: 'sub-full',
            reason: 'server_burn_in_requested',
            confirmation: 'unconfirmed',
        });
        expect(confirmed.subtitleContext?.confirmedBurnedInSubtitleTrackId).toBe('sub-full');
        expect(confirmed.subtitleContext?.localExtractionSuppression).toEqual({
            trackId: 'sub-full',
            reason: 'server_burn_in_requested',
            confirmation: 'confirmed',
        });
    });

    it('filters keyless subtitles when direct-only mode is enabled and routes deactivation callbacks through its deps', async () => {
        const shouldHandleSubtitleDeactivation = jest.fn().mockReturnValue(false);
        const recoverSubtitleDeactivation = jest.fn().mockResolvedValue('failed');
        const builder = new PlaybackStreamDescriptorBuilder({
            buildPlexResourceUrl: (pathOrUrl): string => pathOrUrl,
            getMimeType: (): string => 'video/mp4',
            getAuthHeaders: (): Record<string, string> => ({ 'X-Plex-Token': 'token' }),
            getServerUri: (): string => 'http://example.com',
            getPreferredSubtitleLanguage: (): string => 'en',
            getPlexPreferredSubtitleLanguage: (): null => null,
            notifySubtitleUnavailable: jest.fn(),
            readSubtitleMode: (): 'direct' => 'direct',
            preferForcedSubtitles: (): boolean => false,
            shouldHandleSubtitleDeactivation,
            recoverSubtitleDeactivation,
        });

        const descriptor = builder.build(
            makeProgram(),
            makeDecision({
                availableSubtitleStreams: [
                    {
                        id: 'sub-keyless',
                        streamType: 3,
                        language: 'English',
                        languageCode: 'en',
                        codec: 'srt',
                        format: 'srt',
                        forced: false,
                        default: true,
                        title: 'Embedded',
                    },
                ],
            }),
            5000
        );

        expect(descriptor.preferredSubtitleTrackId).toBeNull();
        expect(
            descriptor.subtitleContext?.onDeactivate?.({
                trackId: 'sub-keyless',
                reason: 'subtitle_text_fetch_failed',
            })
        ).toBe(false);
        expect(shouldHandleSubtitleDeactivation).toHaveBeenCalledWith({
            trackId: 'sub-keyless',
            reason: 'subtitle_text_fetch_failed',
        });
        await expect(
            descriptor.subtitleContext?.onDeactivateRecovery?.({
                trackId: 'sub-keyless',
                reason: 'subtitle_text_fetch_failed',
            })
        ).resolves.toBe('failed');
        expect(recoverSubtitleDeactivation).toHaveBeenCalledWith({
            trackId: 'sub-keyless',
            reason: 'subtitle_text_fetch_failed',
        });
    });

    it('treats format-declared text subtitles as text candidates when codec is vendor-specific', () => {
        const builder = new PlaybackStreamDescriptorBuilder({
            buildPlexResourceUrl: (pathOrUrl): string => pathOrUrl,
            getMimeType: (): string => 'video/mp4',
            getAuthHeaders: (): Record<string, string> => ({ 'X-Plex-Token': 'token' }),
            getServerUri: (): string => 'http://example.com',
            getPreferredSubtitleLanguage: (): string => 'en',
            getPlexPreferredSubtitleLanguage: (): null => null,
            notifySubtitleUnavailable: jest.fn(),
            readSubtitleMode: (): 'full' => 'full',
            preferForcedSubtitles: (): boolean => false,
            shouldHandleSubtitleDeactivation: (): boolean => true,
            recoverSubtitleDeactivation: jest.fn().mockResolvedValue('handled'),
        });

        const descriptor = builder.build(
            makeProgram(),
            makeDecision({
                availableSubtitleStreams: [
                    {
                        id: 'subrip-en',
                        streamType: 3,
                        language: 'English',
                        languageCode: 'en',
                        codec: 'eia_608',
                        format: 'subrip',
                        key: '/library/streams/subrip-en',
                        forced: false,
                        default: true,
                        title: 'English SubRip',
                    },
                ],
            }),
            5000
        );

        expect(descriptor.subtitleTracks).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'subrip-en',
                    isTextCandidate: true,
                    format: 'subrip',
                    codec: 'eia_608',
                }),
            ])
        );
        expect(descriptor.preferredSubtitleTrackId).toBe('subrip-en');
    });
});
