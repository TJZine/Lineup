import { resolveStreamPipeline } from '../pipeline/resolveStreamPipeline';
import type { StreamResolverError } from '../contracts/interfaces';
import { createMockMediaItem } from './testUtils';
import { AppErrorCode } from '../../../../types/app-errors';
import {
    createPlaybackCapabilityProfile,
    type DolbyVisionDecoderProfile,
    type PlaybackCapabilityProfile,
} from '../capabilities/PlaybackCapabilityProfile';

describe('resolveStreamPipeline', () => {
    const createCapabilityProfile = (options: {
        dtsPassthroughEnabled?: boolean;
        declaredDolbyVisionProfiles?: readonly DolbyVisionDecoderProfile[];
    } = {}): PlaybackCapabilityProfile => {
        const input = {
            is4K: true,
            canPlayMimeType: (): boolean => false,
            chromeMajor: 108,
            isWebOs: true,
            dtsPassthroughEnabled: options.dtsPassthroughEnabled ?? false,
            userAgent: 'Mozilla/5.0 (Web0S) AppleWebKit/537.36 Chrome/108.0.0.0 Safari/537.36',
        };

        return createPlaybackCapabilityProfile(options.declaredDolbyVisionProfiles
            ? { ...input, declaredDolbyVisionProfiles: options.declaredDolbyVisionProfiles }
            : input);
    };

    const createError = (
        code: StreamResolverError['code'],
        message: string,
        recoverable: boolean,
        retryAfterMs?: number,
        stage?: StreamResolverError['stage']
    ): StreamResolverError => ({
        code,
        message,
        recoverable,
        ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
        ...(stage !== undefined ? { stage } : {}),
    });

    afterEach(() => {
        jest.dontMock('../policy/mediaSelectionPolicy');
        jest.resetModules();
    });

    it('preserves available audio and subtitle streams for direct play decisions', () => {
        const item = createMockMediaItem(
            {},
            {
                extraStreams: [
                    {
                        id: 'audio-2',
                        streamType: 2,
                        codec: 'aac',
                        language: 'Spanish',
                        languageCode: 'es',
                        channels: 2,
                    },
                    {
                        id: 'sub-1',
                        streamType: 3,
                        codec: 'srt',
                        format: 'srt',
                        language: 'English',
                        languageCode: 'en',
                    },
                ],
            }
        );

        const result = resolveStreamPipeline({
            item,
            request: { itemKey: '12345', subtitleStreamId: 'sub-1' },
            sessionId: 'session-1',
            allowDirectPlayAudioFallback: true,
            capabilityProfile: createCapabilityProfile(),
            hdr10FallbackMode: 'off',
            createError,
            buildDirectPlayUrl: (partKey) => `http://example.com${partKey}`,
            getTranscodeUrl: () => {
                throw new Error('transcode path should not be used');
            },
        });

        expect(result.decision.isDirectPlay).toBe(true);
        expect(result.decision.availableAudioStreams?.map((stream) => stream.id)).toEqual(['audio-1', 'audio-2']);
        expect(result.decision.availableSubtitleStreams?.map((stream) => stream.id)).toEqual(['sub-1']);
        expect(result.decision.selectedSubtitleStream?.id).toBe('sub-1');
    });

    it('keeps the burn-in transcode request for explicit subtitle burn mode', () => {
        const item = createMockMediaItem(
            {
                container: 'avi',
                videoCodec: 'mpeg4',
                audioCodec: 'mp2',
            },
            {
                extraStreams: [
                    {
                        id: 'sub-1',
                        streamType: 3,
                        codec: 'srt',
                        format: 'srt',
                        language: 'English',
                        languageCode: 'en',
                    },
                ],
            }
        );

        const result = resolveStreamPipeline({
            item,
            request: { itemKey: '12345', subtitleStreamId: 'sub-1', subtitleMode: 'burn' },
            sessionId: 'session-1',
            allowDirectPlayAudioFallback: true,
            capabilityProfile: createCapabilityProfile(),
            hdr10FallbackMode: 'off',
            createError,
            buildDirectPlayUrl: () => 'http://example.com/direct',
            getTranscodeUrl: () => 'http://example.com/transcode',
        });

        expect(result.decision.isTranscoding).toBe(true);
        expect(result.decision.subtitleDelivery).toBe('burn');
        expect(result.decision.transcodeRequest).toMatchObject({
            sessionId: 'session-1',
            subtitleStreamId: 'sub-1',
            subtitleMode: 'burn',
        });
        expect(result.decision.subtitleBurnIn).toMatchObject({
            requested: true,
            reason: 'requested',
            subtitleStreamId: 'sub-1',
            subtitleMode: 'burn',
        });
    });

    it('uses direct-play capability hiding for smart HDR10 fallback without requesting HLS', () => {
        const item = createMockMediaItem({ container: 'mkv', videoCodec: 'hevc', aspectRatio: 2.39 });
        const video = item.media[0]!.parts[0]!.streams.find((stream) => stream.streamType === 1)!;
        video.displayTitle = 'Dolby Vision';
        video.doviPresent = true;
        video.doviProfile = '8.1';
        const buildDirectPlayUrl = jest.fn(
            (_partKey: string, _sessionId: string, _audioStreamId?: string, hideDolbyVision?: boolean) =>
                `http://example.com/direct?hideDolbyVision=${hideDolbyVision === true ? '1' : '0'}`
        );

        const result = resolveStreamPipeline({
            item,
            request: { itemKey: '12345' },
            sessionId: 'session-1',
            allowDirectPlayAudioFallback: true,
            capabilityProfile: createCapabilityProfile(),
            hdr10FallbackMode: 'smart',
            createError,
            buildDirectPlayUrl,
            getTranscodeUrl: () => {
                throw new Error('transcode path should not be used');
            },
        });

        expect(result.decision.isDirectPlay).toBe(true);
        expect(result.decision.transcodeRequest).toBeUndefined();
        expect(result.decision.directPlay?.reasons).toEqual([]);
        expect(result.decision.hdr10Fallback).toMatchObject({
            mode: 'smart',
            applied: true,
            reason: 'smart',
            hideDolbyVision: true,
            forcedHls: false,
        });
        expect(buildDirectPlayUrl).toHaveBeenCalledWith(
            item.media[0]!.parts[0]!.key,
            'session-1',
            undefined,
            true
        );
    });

    it('blocks Profile 5 Dolby Vision direct play without explicit matching DV support', () => {
        const item = createMockMediaItem({ container: 'mkv', videoCodec: 'hevc', aspectRatio: 1.78 });
        const video = item.media[0]!.parts[0]!.streams.find((stream) => stream.streamType === 1)!;
        video.displayTitle = 'Dolby Vision';
        video.doviPresent = true;
        video.doviProfile = '5';

        const result = resolveStreamPipeline({
            item,
            request: { itemKey: '12345' },
            sessionId: 'session-1',
            allowDirectPlayAudioFallback: true,
            capabilityProfile: createCapabilityProfile(),
            hdr10FallbackMode: 'force',
            createError,
            buildDirectPlayUrl: () => {
                throw new Error('direct play path should not be used');
            },
            getTranscodeUrl: () => 'http://example.com/transcode',
        });

        expect(result.decision.isTranscoding).toBe(true);
        expect(result.decision.directPlay?.reasons).toContain('unknown_dolby_vision_support:dvhe.05');
        expect(result.decision.hdr10Fallback).toMatchObject({
            mode: 'force',
            applied: false,
            reason: 'none',
            hideDolbyVision: false,
            forcedHls: false,
        });
    });

    it('keeps Profile 5 Dolby Vision direct-playable when explicit DV support exists', () => {
        const item = createMockMediaItem({ container: 'mkv', videoCodec: 'hevc', aspectRatio: 1.78 });
        const video = item.media[0]!.parts[0]!.streams.find((stream) => stream.streamType === 1)!;
        video.displayTitle = 'Dolby Vision';
        video.doviPresent = true;
        video.doviProfile = '5';

        const result = resolveStreamPipeline({
            item,
            request: { itemKey: '12345' },
            sessionId: 'session-1',
            allowDirectPlayAudioFallback: true,
            capabilityProfile: createCapabilityProfile({
                declaredDolbyVisionProfiles: ['dvhe.05'],
            }),
            hdr10FallbackMode: 'force',
            createError,
            buildDirectPlayUrl: () => 'http://example.com/direct',
            getTranscodeUrl: () => {
                throw new Error('transcode path should not be used');
            },
        });

        expect(result.decision.isDirectPlay).toBe(true);
        expect(result.decision.isTranscoding).toBe(false);
        expect(result.decision.directPlay?.reasons).toEqual([]);
        expect(result.decision.hdr10Fallback).toMatchObject({
            mode: 'force',
            applied: false,
            reason: 'none',
            hideDolbyVision: false,
            forcedHls: false,
        });
    });

    it('forces HLS for force HDR10 fallback only when the DV source has an HDR10 base layer', () => {
        const item = createMockMediaItem({ container: 'mkv', videoCodec: 'hevc', aspectRatio: 1.78 });
        const video = item.media[0]!.parts[0]!.streams.find((stream) => stream.streamType === 1)!;
        video.displayTitle = 'Dolby Vision';
        video.doviPresent = true;
        video.doviProfile = '8.1';

        const result = resolveStreamPipeline({
            item,
            request: { itemKey: '12345' },
            sessionId: 'session-1',
            allowDirectPlayAudioFallback: true,
            capabilityProfile: createCapabilityProfile(),
            hdr10FallbackMode: 'force',
            createError,
            buildDirectPlayUrl: () => {
                throw new Error('direct play path should not be used');
            },
            getTranscodeUrl: () => 'http://example.com/transcode',
        });

        expect(result.decision.isTranscoding).toBe(true);
        expect(result.decision.directPlay?.reasons).toContain('hdr10_fallback_force');
        expect(result.decision.transcodeRequest?.hideDolbyVision).toBe(true);
        expect(result.decision.hdr10Fallback).toMatchObject({
            mode: 'force',
            applied: true,
            reason: 'force',
            hideDolbyVision: true,
            forcedHls: true,
        });
    });

    it('throws the precise subtitle-stream error when explicit selection is missing', () => {
        const item = createMockMediaItem();

        try {
            resolveStreamPipeline({
                item,
                request: { itemKey: '12345', subtitleStreamId: 'missing-subtitle' },
                sessionId: 'session-1',
                allowDirectPlayAudioFallback: true,
                capabilityProfile: createCapabilityProfile(),
                hdr10FallbackMode: 'off',
                createError,
                buildDirectPlayUrl: () => 'http://example.com/direct',
                getTranscodeUrl: () => 'http://example.com/transcode',
            });
            throw new Error('Expected resolveStreamPipeline to throw');
        } catch (error) {
            expect(error).toMatchObject({
                code: 'SUBTITLE_STREAM_NOT_FOUND',
                stage: 'media_selection',
            });
        }
    });

    it('rejects burn mode without subtitleStreamId before media selection', () => {
        const item = createMockMediaItem();

        try {
            resolveStreamPipeline({
                item,
                request: { itemKey: '12345', subtitleMode: 'burn' },
                sessionId: 'session-1',
                allowDirectPlayAudioFallback: true,
                capabilityProfile: createCapabilityProfile(),
                hdr10FallbackMode: 'off',
                createError,
                buildDirectPlayUrl: () => 'http://example.com/direct',
                getTranscodeUrl: () => 'http://example.com/transcode',
            });
            throw new Error('Expected resolveStreamPipeline to throw');
        } catch (error) {
            expect(error).toMatchObject({
                code: 'SUBTITLE_STREAM_NOT_FOUND',
                stage: 'media_selection',
            });
        }
    });

    it('throws burn_in_selected_part when the selected media part drops the burn-in subtitle stream', () => {
        jest.isolateModules(() => {
            const selectedSubtitle = {
                id: 'sub-1',
                streamType: 3,
                codec: 'pgs',
                format: 'pgs',
                language: 'English',
                languageCode: 'en',
            } as const;
            const item = createMockMediaItem(
                {
                    container: 'mkv',
                    videoCodec: 'hevc',
                    audioCodec: 'aac',
                },
                {
                    extraStreams: [selectedSubtitle],
                }
            );
            const selectedPart = item.media[0]!.parts[0]!;
            selectedPart.streams = selectedPart.streams.filter((stream) => stream.id !== 'sub-1');

            jest.doMock('../policy/mediaSelectionPolicy', () => {
                const actual =
                    jest.requireActual('../policy/mediaSelectionPolicy') as typeof import('../policy/mediaSelectionPolicy');
                return {
                    ...actual,
                    selectBestMediaWithSubtitleStream: jest.fn(() => ({
                        media: item.media[0]!,
                        mediaIndex: 0,
                        partIndex: 0,
                    })),
                };
            });

            const { resolveStreamPipeline } =
                require('../pipeline/resolveStreamPipeline') as typeof import('../pipeline/resolveStreamPipeline');

            try {
                resolveStreamPipeline({
                    item,
                    request: {
                        itemKey: '12345',
                        subtitleStreamId: 'sub-1',
                        subtitleMode: 'burn',
                    },
                    sessionId: 'session-1',
                    allowDirectPlayAudioFallback: true,
                    capabilityProfile: createCapabilityProfile(),
                    hdr10FallbackMode: 'off',
                    createError,
                    buildDirectPlayUrl: () => 'http://example.com/direct',
                    getTranscodeUrl: () => 'http://example.com/transcode',
                });
                throw new Error('Expected resolveStreamPipeline to throw');
            } catch (error) {
                expect(error).toMatchObject({
                    code: 'SUBTITLE_STREAM_NOT_FOUND',
                    stage: 'burn_in_selected_part',
                });
            }
        });
    });

    it('uses the resolved default transcode bitrate in the final decision', () => {
        const item = createMockMediaItem({
            container: 'avi',
            videoCodec: 'mpeg4',
            audioCodec: 'mp2',
        });

        const result = resolveStreamPipeline({
            item,
            request: { itemKey: '12345' },
            sessionId: 'session-1',
            allowDirectPlayAudioFallback: true,
            capabilityProfile: createCapabilityProfile(),
            hdr10FallbackMode: 'off',
            createError,
            buildDirectPlayUrl: () => 'http://example.com/direct',
            getTranscodeUrl: () => 'http://example.com/transcode',
        });

        expect(result.decision.isTranscoding).toBe(true);
        expect(result.decision.bitrate).toBe(20000);
        expect(result.decision.transcodeRequest).toMatchObject({
            maxBitrate: 20000,
        });
    });

    it('propagates synchronous StreamResolverError transcode URL failures unchanged', () => {
        const item = createMockMediaItem({
            container: 'avi',
            videoCodec: 'mpeg4',
            audioCodec: 'mp2',
        });
        const expectedError = createError(
            AppErrorCode.SERVER_UNREACHABLE,
            'No server connection available',
            true
        );

        try {
            resolveStreamPipeline({
                item,
                request: { itemKey: '12345' },
                sessionId: 'session-1',
                allowDirectPlayAudioFallback: true,
                capabilityProfile: createCapabilityProfile(),
                hdr10FallbackMode: 'off',
                createError,
                buildDirectPlayUrl: () => 'http://example.com/direct',
                getTranscodeUrl: () => {
                    throw expectedError;
                },
            });
            throw new Error('Expected resolveStreamPipeline to throw');
        } catch (error) {
            expect(error).toBe(expectedError);
        }
    });

    it('honors explicit audioStreamId for direct-play compatibility and url generation', () => {
        const item = createMockMediaItem(
            { audioCodec: 'dts' },
            {
                extraStreams: [
                    {
                        id: 'audio-2',
                        streamType: 2,
                        codec: 'aac',
                        language: 'Spanish',
                        languageCode: 'es',
                        channels: 2,
                    },
                ],
            }
        );

        const buildDirectPlayUrl = jest.fn(
            (_partKey: string, _sessionId: string, directPlayAudioStreamId?: string) =>
                `http://example.com/direct?audioStreamID=${directPlayAudioStreamId ?? 'none'}`
        );

        const result = resolveStreamPipeline({
            item,
            request: { itemKey: '12345', audioStreamId: 'audio-2' },
            sessionId: 'session-1',
            allowDirectPlayAudioFallback: true,
            capabilityProfile: createCapabilityProfile(),
            hdr10FallbackMode: 'off',
            createError,
            buildDirectPlayUrl,
            getTranscodeUrl: () => {
                throw new Error('transcode path should not be used');
            },
        });

        expect(result.decision.isDirectPlay).toBe(true);
        expect(result.decision.audioCodec).toBe('aac');
        expect(buildDirectPlayUrl).toHaveBeenCalledWith(
            item.media[0]!.parts[0]!.key,
            'session-1',
            'audio-2',
            false
        );
        expect(result.decision.playbackUrl).toContain('audioStreamID=audio-2');
    });

    it('trims and lowercases the delivered audio codec in direct-play decisions', () => {
        const item = createMockMediaItem(
            { audioCodec: 'truehd' },
            {
                extraStreams: [
                    {
                        id: 'audio-2',
                        streamType: 2,
                        codec: ' AAC ',
                        language: 'Spanish',
                        languageCode: 'es',
                        channels: 2,
                    },
                ],
            }
        );

        const result = resolveStreamPipeline({
            item,
            request: { itemKey: '12345', audioStreamId: 'audio-2' },
            sessionId: 'session-1',
            allowDirectPlayAudioFallback: true,
            capabilityProfile: createCapabilityProfile(),
            hdr10FallbackMode: 'off',
            createError,
            buildDirectPlayUrl: () => 'http://example.com/direct',
            getTranscodeUrl: () => {
                throw new Error('transcode path should not be used');
            },
        });

        expect(result.decision.isDirectPlay).toBe(true);
        expect(result.decision.audioCodec).toBe('aac');
    });
});
