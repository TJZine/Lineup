import { PlaybackStreamDescriptorBuilder } from '../PlaybackStreamDescriptorBuilder';
import type { PlexStream, StreamDecision } from '../../plex/stream';
import type { ScheduledProgram } from '../../scheduler/scheduler';

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
