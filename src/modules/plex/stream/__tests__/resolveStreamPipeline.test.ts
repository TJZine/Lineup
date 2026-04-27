import { resolveStreamPipeline } from '../resolveStreamPipeline';
import type { StreamResolverError } from '../interfaces';
import { createMockMediaItem } from './testUtils';
import { AppErrorCode } from '../../../../types/app-errors';

describe('resolveStreamPipeline', () => {
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
            dtsPassthroughEnabled: false,
            userAgent: null,
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
            dtsPassthroughEnabled: false,
            userAgent: null,
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
    });

    it('throws the precise subtitle-stream error when explicit selection is missing', () => {
        const item = createMockMediaItem();

        try {
            resolveStreamPipeline({
                item,
                request: { itemKey: '12345', subtitleStreamId: 'missing-subtitle' },
                sessionId: 'session-1',
                allowDirectPlayAudioFallback: true,
                dtsPassthroughEnabled: false,
                userAgent: null,
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
                dtsPassthroughEnabled: false,
                userAgent: null,
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
            dtsPassthroughEnabled: false,
            userAgent: null,
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
                dtsPassthroughEnabled: false,
                userAgent: null,
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
            dtsPassthroughEnabled: false,
            userAgent: null,
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
            dtsPassthroughEnabled: false,
            userAgent: null,
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
