/**
 * @fileoverview Unit tests for PlexStreamResolver.
 * @module modules/plex/stream/__tests__/PlexStreamResolver.test
 */

import { PlexStreamResolver } from '../resolver/PlexStreamResolver';
import type { PlexMediaFile, PlexStreamMediaItem, PlexMediaPart, PlexStream } from '../contracts/types';
import { AppErrorCode } from '../../../../types/app-errors';
import { LINEUP_STORAGE_KEYS } from '../../../../config/storageKeys';
import type { PlatformIdentityService } from '../../../../platform';
import { expectConsoleWarn } from '../../../../__tests__/helpers';
import { createMockConfig, createMockMediaItem } from './testUtils';
import { PlexDiscoverySelectionSupersededError } from '../../discovery';

// ============================================
// Tests
// ============================================

function requireValue<T>(value: T | null | undefined): NonNullable<T> {
    expect(value).not.toBeNull();
    expect(value).not.toBeUndefined();
    return value as NonNullable<T>;
}

function getPrimaryMedia(item: PlexStreamMediaItem): PlexMediaFile {
    return requireValue(item.media[0]);
}

function getPrimaryPart(item: PlexStreamMediaItem): PlexMediaPart {
    return requireValue(getPrimaryMedia(item).parts[0]);
}

function getPrimaryVideoStream(item: PlexStreamMediaItem): PlexStream {
    return requireValue(getPrimaryPart(item).streams[0]) as PlexStream;
}

function mockCanPlayMimeTypes(supportedMimeTypes: readonly string[]): void {
    const supported = new Set(supportedMimeTypes);
    Object.defineProperty(globalThis, 'document', {
        value: {
            createElement: jest.fn((tagName: string) => {
                if (tagName !== 'video') {
                    return {};
                }

                return {
                    canPlayType: (mime: string): CanPlayTypeResult =>
                        supported.has(mime) ? 'probably' : '',
                };
            }),
        },
        configurable: true,
    });
}

describe('PlexStreamResolver', () => {
    let mockFetch: jest.Mock;
    let originalNavigator: unknown;
    let originalLocalStorage: unknown;
    let originalDocument: unknown;
    let originalWindow: unknown;

    beforeEach(() => {
        mockFetch = jest.fn().mockResolvedValue({ ok: true });
        global.fetch = mockFetch;

        originalNavigator = (globalThis as unknown as { navigator?: unknown }).navigator;
        originalLocalStorage = (globalThis as unknown as { localStorage?: unknown }).localStorage;
        originalDocument = (globalThis as unknown as { document?: unknown }).document;
        originalWindow = (globalThis as unknown as { window?: unknown }).window;
    });

    afterEach(() => {
        if (originalNavigator === undefined) {
            delete (globalThis as unknown as { navigator?: unknown }).navigator;
        } else {
            Object.defineProperty(globalThis, 'navigator', {
                value: originalNavigator,
                configurable: true,
                writable: true,
            });
        }

        if (originalLocalStorage === undefined) {
            delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
        } else {
            Object.defineProperty(globalThis, 'localStorage', {
                value: originalLocalStorage,
                configurable: true,
                writable: true,
            });
        }
        if (originalDocument === undefined) {
            delete (globalThis as unknown as { document?: unknown }).document;
        } else {
            Object.defineProperty(globalThis, 'document', {
                value: originalDocument,
                configurable: true,
                writable: true,
            });
        }
        if (originalWindow === undefined) {
            delete (globalThis as unknown as { window?: unknown }).window;
        } else {
            Object.defineProperty(globalThis, 'window', {
                value: originalWindow,
                configurable: true,
                writable: true,
            });
        }
        jest.restoreAllMocks();
        jest.resetAllMocks();
    });

    // ========================================
    // canDirectPlay
    // ========================================

    describe('canDirectPlay', () => {
        it('should return true for MP4 with H264/AAC', () => {
            const item = createMockMediaItem({
                container: 'mp4',
                videoCodec: 'h264',
                audioCodec: 'aac',
            });
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            expect(resolver.canDirectPlay(item)).toBe(true);
        });

        it('should return true for MKV with HEVC/AAC', () => {
            const item = createMockMediaItem({
                container: 'mkv',
                videoCodec: 'hevc',
                audioCodec: 'aac',
            });
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            expect(resolver.canDirectPlay(item)).toBe(true);
        });

        it('should return true for MKV with H264/AC3', () => {
            const item = createMockMediaItem({
                container: 'mkv',
                videoCodec: 'h264',
                audioCodec: 'ac3',
            });
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            expect(resolver.canDirectPlay(item)).toBe(true);
        });

        it('should return false for unsupported video codec (MPEG2)', () => {
            const item = createMockMediaItem({
                container: 'mp4',
                videoCodec: 'mpeg2',
                audioCodec: 'aac',
            });
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            expect(resolver.canDirectPlay(item)).toBe(false);
        });

        it('should return false for unsupported container (AVI)', () => {
            const item = createMockMediaItem({
                container: 'avi',
                videoCodec: 'h264',
                audioCodec: 'aac',
            });
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            expect(resolver.canDirectPlay(item)).toBe(false);
        });

        it('should return false for unsupported audio codec (TrueHD)', () => {
            // TrueHD cannot passthrough on webOS internal apps (platform limitation)
            // DTS is now supported for passthrough to external receivers
            const item = createMockMediaItem({
                container: 'mkv',
                videoCodec: 'h264',
                audioCodec: 'truehd',
            });
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            expect(resolver.canDirectPlay(item)).toBe(false);
        });

        it('should return false for DTS when passthrough is disabled', () => {
            Object.defineProperty(globalThis, 'localStorage', {
                value: { getItem: jest.fn().mockReturnValue('0') },
                configurable: true,
            });
            Object.defineProperty(globalThis, 'navigator', {
                value: { userAgent: 'Mozilla/5.0 (Web0S) AppleWebKit/537.36 Chrome/108.0.0.0 Safari/537.36' },
                configurable: true,
            });

            const item = createMockMediaItem({
                container: 'mkv',
                videoCodec: 'h264',
                audioCodec: 'dts',
            });
            const resolver = new PlexStreamResolver(createMockConfig());

            expect(resolver.canDirectPlay(item)).toBe(false);
        });

        it('should return true for DTS when passthrough is enabled and Chrome 108 parses', () => {
            Object.defineProperty(globalThis, 'localStorage', {
                value: { getItem: jest.fn().mockReturnValue('1') },
                configurable: true,
            });
            Object.defineProperty(globalThis, 'navigator', {
                value: { userAgent: 'Mozilla/5.0 (Web0S) AppleWebKit/537.36 Chrome/108.0.0.0 Safari/537.36' },
                configurable: true,
            });

            const item = createMockMediaItem({
                container: 'mkv',
                videoCodec: 'h264',
                audioCodec: 'dts',
            });
            const resolver = new PlexStreamResolver(createMockConfig());

            expect(resolver.canDirectPlay(item)).toBe(true);
        });

        it('should return false for DTS when passthrough is enabled but Chrome is below 108', () => {
            Object.defineProperty(globalThis, 'localStorage', {
                value: { getItem: jest.fn().mockReturnValue('1') },
                configurable: true,
            });
            Object.defineProperty(globalThis, 'navigator', {
                value: { userAgent: 'Mozilla/5.0 (Web0S) AppleWebKit/537.36 Chrome/107.0.0.0 Safari/537.36' },
                configurable: true,
            });

            const item = createMockMediaItem({
                container: 'mkv',
                videoCodec: 'h264',
                audioCodec: 'dts',
            });
            const resolver = new PlexStreamResolver(createMockConfig());

            expect(resolver.canDirectPlay(item)).toBe(false);
        });

        it('should return false for DTS when Chrome major cannot be parsed', () => {
            Object.defineProperty(globalThis, 'localStorage', {
                value: { getItem: jest.fn().mockReturnValue('1') },
                configurable: true,
            });
            Object.defineProperty(globalThis, 'navigator', {
                value: { userAgent: 'mystery-device/1.0' },
                configurable: true,
            });

            const item = createMockMediaItem({
                container: 'mkv',
                videoCodec: 'h264',
                audioCodec: 'dts',
            });
            const resolver = new PlexStreamResolver(createMockConfig());

            expect(resolver.canDirectPlay(item)).toBe(false);
        });

        it('should return false for resolution above 4K', () => {
            const item = createMockMediaItem({
                container: 'mp4',
                videoCodec: 'h264',
                audioCodec: 'aac',
                width: 5120,
                height: 2880,
            });
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            expect(resolver.canDirectPlay(item)).toBe(false);
        });

        it('should allow 4K direct play on webOS when the app surface reports 1080p', () => {
            Object.defineProperty(globalThis, 'window', {
                value: { screen: { width: 1920, height: 1080 } },
                configurable: true,
            });

            const item = createMockMediaItem({
                container: 'mp4',
                videoCodec: 'h264',
                audioCodec: 'aac',
                width: 3840,
                height: 2160,
            });
            const resolver = new PlexStreamResolver(createMockConfig());

            expect(resolver.canDirectPlay(item)).toBe(true);
        });

        it('should return false for empty media array', () => {
            const item = createMockMediaItem();
            item.media = [];
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            expect(resolver.canDirectPlay(item)).toBe(false);
        });

        it('should return false for Profile 5 Dolby Vision without explicit DV support', () => {
            const item = createMockMediaItem({
                container: 'mkv',
                videoCodec: 'hevc',
                audioCodec: 'aac',
            });
            const videoStream = getPrimaryVideoStream(item);
            videoStream.displayTitle = 'Dolby Vision';
            videoStream.doviPresent = true;
            videoStream.doviProfile = '5';
            const resolver = new PlexStreamResolver(createMockConfig());

            expect(resolver.canDirectPlay(item)).toBe(false);
        });

        it('should return true for Profile 5 Dolby Vision with explicit matching DV support', () => {
            mockCanPlayMimeTypes(['video/mp4; codecs="dvh1.05.06"']);
            const item = createMockMediaItem({
                container: 'mkv',
                videoCodec: 'hevc',
                audioCodec: 'aac',
            });
            const videoStream = getPrimaryVideoStream(item);
            videoStream.displayTitle = 'Dolby Vision';
            videoStream.doviPresent = true;
            videoStream.doviProfile = '5';
            const resolver = new PlexStreamResolver(createMockConfig());

            expect(resolver.canDirectPlay(item)).toBe(true);
        });

        it('uses the selected media policy for canDirectPlay instead of only the first media entry', () => {
            const first = createMockMediaItem({
                container: 'avi',
                videoCodec: 'mpeg2',
                audioCodec: 'aac',
            });
            const second = createMockMediaItem({
                container: 'mp4',
                videoCodec: 'h264',
                audioCodec: 'aac',
                width: 3840,
                height: 2160,
            });
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            first.media = [getPrimaryMedia(first), getPrimaryMedia(second)];

            expect(resolver.canDirectPlay(first)).toBe(true);
        });
    });

    // ========================================
    // resolveStream
    // ========================================

    describe('resolveStream', () => {
        it('should return direct play URL for compatible content', async () => {
            const mockItem = createMockMediaItem({
                container: 'mp4',
                videoCodec: 'h264',
                audioCodec: 'aac',
            });
            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.isDirectPlay).toBe(true);
            expect(decision.isTranscoding).toBe(false);
            expect(decision.protocol).toBe('http');
            expect(decision.playbackUrl).toContain('/library/parts/');
            expect(decision.playbackUrl).toContain('X-Plex-Token=mock-token');
        });

        it('reads stream policy through injected readers and subtitle debug through the injected port', async () => {
            const mockItem = createMockMediaItem({
                container: 'mp4',
                videoCodec: 'h264',
                audioCodec: 'aac',
            });
            const readDirectPlayAudioFallbackEnabledAndClean = jest.fn(() => false);
            const readDtsPassthroughEnabledAndClean = jest.fn(() => false);
            const readHdr10FallbackModeAndClean = jest.fn(() => 'off' as const);
            const readDebugLoggingEnabledAndClean = jest.fn(() => false);
            const subtitleDebugLogPort = {
                isEnabled: jest.fn(() => false),
                log: jest.fn(),
            };
            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
                audioPolicyReader: {
                    readDirectPlayAudioFallbackEnabledAndClean,
                    readDtsPassthroughEnabledAndClean,
                },
                playbackPolicyReader: {
                    readHdr10FallbackModeAndClean,
                    readTranscodeCompatEnabledAndClean: jest.fn(() => false),
                    readTranscodeQualityOptionAndClean: jest.fn(() => null),
                },
                debugPolicyReader: {
                    readDebugLoggingEnabledAndClean,
                },
                subtitleDebugLogPort,
            });
            const resolver = new PlexStreamResolver(config);

            await resolver.resolveStream({ itemKey: '12345' });

            expect(readDirectPlayAudioFallbackEnabledAndClean).toHaveBeenCalledTimes(1);
            expect(readDtsPassthroughEnabledAndClean).toHaveBeenCalled();
            expect(readHdr10FallbackModeAndClean).toHaveBeenCalledTimes(1);
            expect(readDebugLoggingEnabledAndClean).toHaveBeenCalledWith(false);
            expect(subtitleDebugLogPort.isEnabled).toHaveBeenCalledTimes(1);
            expect(subtitleDebugLogPort.log).not.toHaveBeenCalled();
        });

        it('delegates subtitle debug discovery through the debug probe coordinator', async () => {
            const subtitleDebugLogPort = {
                isEnabled: jest.fn(() => true),
                log: jest.fn(),
            };
            const mockItem = createMockMediaItem(
                {
                    container: 'mp4',
                    videoCodec: 'h264',
                    audioCodec: 'aac',
                },
                {
                    extraStreams: [
                        {
                            id: 'sub-key-nonpreferred',
                            streamType: 3,
                            codec: 'srt',
                            key: '/library/streams/sub-key-nonpreferred',
                            language: 'Spanish',
                            languageCode: 'es',
                        },
                        {
                            id: 'sub-key-english',
                            streamType: 3,
                            codec: 'srt',
                            key: '/library/streams/sub-key-english',
                            language: 'English',
                            languageCode: 'en',
                        },
                        {
                            id: 'sub-keyless-forced',
                            streamType: 3,
                            codec: 'unknown',
                            format: 'vtt',
                            language: 'French',
                            languageCode: 'fr',
                            forced: true,
                        },
                        {
                            id: 'sub-image',
                            streamType: 3,
                            codec: 'pgs',
                            key: '/library/streams/sub-image',
                        },
                    ],
                }
            );
            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
                subtitleDebugLogPort,
            });
            const resolver = new PlexStreamResolver(config);

            await resolver.resolveStream({ itemKey: '12345' });

            expect(subtitleDebugLogPort.log).toHaveBeenCalledWith(
                'subtitle_tracks_discovered',
                expect.objectContaining({
                    count: 4,
                    withKeyCount: 3,
                    withoutKeyCount: 1,
                })
            );
            expect(subtitleDebugLogPort.log).toHaveBeenCalledWith(
                'subtitle_streams_discovered',
                expect.objectContaining({
                    itemKey: '12345',
                    subtitlesCount: 4,
                    subtitleStreams: expect.arrayContaining([
                        expect.objectContaining({
                            id: 'sub-image',
                            isTextCandidate: false,
                            fetchableViaKey: true,
                        }),
                    ]),
                })
            );
        });

        it('keeps explicit audio selection in the direct-play url when the requested track is compatible', async () => {
            const mockItem = createMockMediaItem(
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

            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({
                itemKey: '12345',
                audioStreamId: 'audio-2',
            });

            expect(decision.isDirectPlay).toBe(true);
            expect(decision.audioCodec).toBe('aac');
            expect(decision.playbackUrl).toContain('audioStreamID=audio-2');
        });

        it('keeps direct play for DV MKV (P8.1) when Smart is enabled and content is already direct-playable', async () => {
            Object.defineProperty(globalThis, 'localStorage', {
                value: {
                    getItem: jest.fn((key: string) =>
                        key === LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK ? '1' : null
                    ),
                },
                configurable: true,
            });
            Object.defineProperty(globalThis, 'navigator', {
                value: {
                    userAgent:
                        'Mozilla/5.0 (webOS) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.0.0 Safari/537.36',
                },
                configurable: true,
            });

            const dvItem = createMockMediaItem({ container: 'mkv', aspectRatio: 2.39 });
            const dvStream = getPrimaryVideoStream(dvItem);
            dvStream.displayTitle = 'Dolby Vision';
            dvStream.doviPresent = true;
            dvStream.doviProfile = '8.1';

            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(dvItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.isDirectPlay).toBe(true);
            expect(decision.isTranscoding).toBe(false);
            expect(decision.protocol).toBe('http');
            expect(decision.transcodeRequest).toBeUndefined();
            expect(decision.directPlay?.reasons).toEqual([]);
            expect(decision.playbackUrl).toContain('X-Plex-Client-Capabilities=');
            expect(decision.playbackUrl).not.toContain('dvhe');
        });

        it('still hides Dolby Vision when Smart fallback is enabled and content must transcode for other reasons', async () => {
            Object.defineProperty(globalThis, 'localStorage', {
                value: {
                    getItem: jest.fn((key: string) =>
                        key === LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK ? '1' : null
                    ),
                },
                configurable: true,
            });

            const dvItem = createMockMediaItem({
                container: 'mkv',
                videoCodec: 'h264',
                audioCodec: 'truehd',
                aspectRatio: 2.39,
            });
            const dvStream = getPrimaryVideoStream(dvItem);
            dvStream.displayTitle = 'Dolby Vision';
            dvStream.doviPresent = true;
            dvStream.doviProfile = '8.1';

            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(dvItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.isTranscoding).toBe(true);
            expect(decision.protocol).toBe('hls');
            expect(decision.directPlay?.reasons).toContain('unsupported_audio_codec:truehd');
            expect(decision.transcodeRequest?.hideDolbyVision).toBe(true);
            expect(decision.hdr10Fallback).toMatchObject({
                mode: 'smart',
                applied: true,
                hideDolbyVision: true,
                forcedHls: false,
            });
        });

        it('logs a warning when PMS universal decision fetch fails in debug mode', async () => {
            expectConsoleWarn([
                'Transcode URL (compat=0):',
                expect.stringContaining('X-Plex-Token=REDACTED'),
            ], { times: 2 });
            expectConsoleWarn([
                'Stream decision:',
                expect.objectContaining({ itemKey: '12345', mode: 'transcode' }),
            ]);
            expectConsoleWarn([
                'PMS universal decision fetch failed:',
                expect.objectContaining({ itemKey: '12345' }),
            ]);
            Object.defineProperty(globalThis, 'localStorage', {
                value: {
                    getItem: jest.fn((key: string) =>
                        key === LINEUP_STORAGE_KEYS.DEBUG_LOGGING ? '1' : null
                    ),
                },
                configurable: true,
            });

            const mockItem = createMockMediaItem({
                container: 'mkv',
                videoCodec: 'h264',
                audioCodec: 'truehd',
            });
            const resolver = new PlexStreamResolver(
                createMockConfig({ getItem: jest.fn().mockResolvedValue(mockItem) })
            );
            mockFetch.mockRejectedValueOnce(new Error('decision fetch down'));

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.isTranscoding).toBe(true);
        });

        it('does not emit a stream error when the debug PMS decision fetch is denied', async () => {
            expectConsoleWarn([
                'Transcode URL (compat=0):',
                expect.stringContaining('X-Plex-Token=REDACTED'),
            ], { times: 2 });
            expectConsoleWarn([
                'Stream decision:',
                expect.objectContaining({ itemKey: '12345', mode: 'transcode' }),
            ]);
            expectConsoleWarn([
                'PMS universal decision fetch failed:',
                expect.objectContaining({ itemKey: '12345' }),
            ]);
            Object.defineProperty(globalThis, 'localStorage', {
                value: {
                    getItem: jest.fn((key: string) =>
                        key === LINEUP_STORAGE_KEYS.DEBUG_LOGGING ? '1' : null
                    ),
                },
                configurable: true,
            });

            const mockItem = createMockMediaItem({
                container: 'avi',
                videoCodec: 'mpeg4',
                audioCodec: 'mp2',
            });
            const resolver = new PlexStreamResolver(
                createMockConfig({ getItem: jest.fn().mockResolvedValue(mockItem) })
            );
            const errorHandler = jest.fn();
            const disposable = resolver.on('error', errorHandler);
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 403,
                text: async () => '',
            });

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.isTranscoding).toBe(true);
            expect(decision.serverDecision).toBeUndefined();
            expect(errorHandler).not.toHaveBeenCalled();
            disposable.dispose();
        });

        it('logs debug stream decision summary and HDR10 fallback reason', async () => {
            expectConsoleWarn([
                'Transcode URL (compat=0):',
                expect.stringContaining('X-Plex-Token=REDACTED'),
            ], { times: 2 });
            expectConsoleWarn([
                'HDR10 fallback applied:',
                expect.objectContaining({ itemKey: '12345', reason: expect.any(String) }),
            ]);
            expectConsoleWarn([
                'Stream decision:',
                expect.objectContaining({ itemKey: '12345', mode: 'transcode' }),
            ]);
            expectConsoleWarn([
                'PMS universal decision fetch failed:',
                expect.objectContaining({ itemKey: '12345' }),
            ]);
            Object.defineProperty(globalThis, 'localStorage', {
                value: {
                    getItem: jest.fn((key: string) => {
                        if (key === LINEUP_STORAGE_KEYS.DEBUG_LOGGING) return '1';
                        if (key === LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK) return '1';
                        return null;
                    }),
                },
                configurable: true,
            });
            Object.defineProperty(globalThis, 'navigator', {
                value: {
                    userAgent:
                        'Mozilla/5.0 (webOS) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.0.0 Safari/537.36',
                },
                configurable: true,
            });

            const dvItem = createMockMediaItem({ container: 'mkv' });
            const dvStream = getPrimaryVideoStream(dvItem);
            dvStream.displayTitle = 'Dolby Vision';
            dvStream.doviPresent = true;
            dvStream.doviProfile = '8.1';
            mockFetch.mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
                start(controller): void {
                    controller.error(new Error('decision body unavailable'));
                },
            })));

            const resolver = new PlexStreamResolver(
                createMockConfig({ getItem: jest.fn().mockResolvedValue(dvItem) })
            );

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.isTranscoding).toBe(true);
        });

        it('hides Dolby Vision for non-letterbox DV MKV with HDR10 base layer when Smart is enabled', async () => {
            Object.defineProperty(globalThis, 'localStorage', {
                value: {
                    getItem: jest.fn((key: string) =>
                        key === LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK ? '1' : null
                    ),
                },
                configurable: true,
            });

            const dvItem = createMockMediaItem({ container: 'mkv', aspectRatio: 1.78 });
            const dvStream = getPrimaryVideoStream(dvItem);
            dvStream.displayTitle = 'Dolby Vision';
            dvStream.doviPresent = true;
            dvStream.doviProfile = '7';

            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(dvItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.isDirectPlay).toBe(true);
            expect(decision.isTranscoding).toBe(false);
            expect(decision.hdr10Fallback).toMatchObject({
                mode: 'smart',
                applied: true,
                hideDolbyVision: true,
                forcedHls: false,
            });
            expect(decision.playbackUrl).toContain('X-Plex-Client-Capabilities=');
            expect(decision.playbackUrl).not.toContain('dvhe');
        });

        it('forces HLS with HDR10 fallback for DV MKV when Force is enabled', async () => {
            Object.defineProperty(globalThis, 'localStorage', {
                value: {
                    getItem: jest.fn((key: string) =>
                        key === LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK ? '1' : null
                    ),
                },
                configurable: true,
            });

            const dvItem = createMockMediaItem({ container: 'mkv', aspectRatio: 1.78 });
            const dvStream = getPrimaryVideoStream(dvItem);
            dvStream.displayTitle = 'Dolby Vision';
            dvStream.doviPresent = true;
            dvStream.doviProfile = '8.1';

            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(dvItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.isTranscoding).toBe(true);
            expect(decision.directPlay?.reasons).toContain('hdr10_fallback_force');
        });

        it('forces HDR10 fallback for DV MKV profile 8 with PQ base layer when Force is enabled', async () => {
            Object.defineProperty(globalThis, 'localStorage', {
                value: {
                    getItem: jest.fn((key: string) =>
                        key === LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK ? '1' : null
                    ),
                },
                configurable: true,
            });

            const dvItem = createMockMediaItem({ container: 'mkv', aspectRatio: 1.78 });
            const dvStream = getPrimaryVideoStream(dvItem);
            dvStream.displayTitle = 'Dolby Vision';
            dvStream.doviPresent = true;
            dvStream.doviProfile = '8';
            dvStream.colorTrc = 'smpte2084';

            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(dvItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.isTranscoding).toBe(true);
            expect(decision.directPlay?.reasons).toContain('hdr10_fallback_force');
            expect(decision.transcodeRequest?.hideDolbyVision).toBe(true);
        });

        it('does not force HDR10 fallback for DV MP4 (P8.1) even when Force is enabled', async () => {
            Object.defineProperty(globalThis, 'localStorage', {
                value: {
                    getItem: jest.fn((key: string) =>
                        key === LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK ? '1' : null
                    ),
                },
                configurable: true,
            });

            const dvItem = createMockMediaItem({ container: 'mp4', aspectRatio: 2.39 });
            const dvStream = getPrimaryVideoStream(dvItem);
            dvStream.displayTitle = 'Dolby Vision';
            dvStream.doviPresent = true;
            dvStream.doviProfile = '8.1';

            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(dvItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.isDirectPlay).toBe(true);
            expect(decision.isTranscoding).toBe(false);
        });

        it('does not apply HDR fallback for DV MP4 profile 5 without explicit DV support', async () => {
            const dvItem = createMockMediaItem({ container: 'mp4', aspectRatio: 1.78 });
            const dvStream = getPrimaryVideoStream(dvItem);
            dvStream.displayTitle = 'Dolby Vision';
            dvStream.doviPresent = true;
            dvStream.doviProfile = '5';

            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(dvItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.isTranscoding).toBe(true);
            expect(decision.directPlay?.reasons).toContain('unknown_dolby_vision_support:dvhe.05');
            expect(decision.hdr10Fallback).toMatchObject({
                applied: false,
                hideDolbyVision: false,
                forcedHls: false,
            });
        });

        it('allows direct play for DV MKV profile 5 with explicit DV support even when Force fallback is enabled', async () => {
            mockCanPlayMimeTypes(['video/mp4; codecs="dvh1.05.06"']);
            Object.defineProperty(globalThis, 'localStorage', {
                value: {
                    getItem: jest.fn((key: string) =>
                        key === LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK ? '1' : null
                    ),
                },
                configurable: true,
            });
            const dvItem = createMockMediaItem({ container: 'mkv', aspectRatio: 1.78 });
            const dvStream = getPrimaryVideoStream(dvItem);
            dvStream.displayTitle = 'Dolby Vision';
            dvStream.doviPresent = true;
            dvStream.doviProfile = '5';

            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(dvItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.isDirectPlay).toBe(true);
            expect(decision.isTranscoding).toBe(false);
            expect(decision.protocol).toBe('http');
            expect(decision.directPlay?.reasons).toEqual([]);
            expect(decodeURIComponent(decision.playbackUrl)).toContain('hevc{profile:dvhe.05}');
            expect(decodeURIComponent(decision.playbackUrl)).not.toContain('hevc{profile:main&');
            expect(decision.hdr10Fallback).toMatchObject({
                mode: 'force',
                applied: false,
                hideDolbyVision: false,
                forcedHls: false,
            });
        });

        it('allows direct play for DV MKV profile 8 HLG because it has no HDR10 base layer', async () => {
            mockCanPlayMimeTypes(['video/mp4; codecs="dvh1.08.06"']);
            const dvItem = createMockMediaItem({ container: 'mkv', aspectRatio: 1.78 });
            const dvStream = getPrimaryVideoStream(dvItem);
            dvStream.displayTitle = 'Dolby Vision';
            dvStream.doviPresent = true;
            dvStream.doviProfile = '8';
            dvStream.colorTrc = 'arib-std-b67';

            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(dvItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.isDirectPlay).toBe(true);
            expect(decision.isTranscoding).toBe(false);
            expect(decision.protocol).toBe('http');
            expect(decision.directPlay?.reasons).toEqual([]);
        });

        it('should return transcode URL for incompatible content', async () => {
            const mockItem = createMockMediaItem({
                container: 'avi',
                videoCodec: 'mpeg4',
                audioCodec: 'mp2',
            });
            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.isDirectPlay).toBe(false);
            expect(decision.isTranscoding).toBe(true);
            expect(decision.protocol).toBe('hls');
            expect(decision.playbackUrl).toContain('/transcode/universal/start.m3u8');
        });

        it('should pick an AC3/EAC3 fallback when default is TrueHD', async () => {
            const mockItem = createMockMediaItem(
                {
                    container: 'mkv',
                    videoCodec: 'h264',
                    audioCodec: 'truehd',
                },
                {
                    extraStreams: [
                        {
                            id: 'audio-2',
                            streamType: 2,
                            codec: 'eac3',
                            language: 'English',
                            languageCode: 'en',
                            channels: 6,
                            title: 'English (EAC3)',
                        },
                    ],
                }
            );
            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.isTranscoding).toBe(true);
            expect(decision.selectedAudioStream?.id).toBe('audio-2');
            expect(decision.playbackUrl).toContain('audioStreamID=audio-2');
        });

        it('should optionally try Direct Play when a TrueHD fallback track exists', async () => {
            Object.defineProperty(globalThis, 'localStorage', {
                value: {
                    getItem: jest.fn((k: string) =>
                        k === LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK ? '1' : null
                    ),
                },
                configurable: true,
            });

            const mockItem = createMockMediaItem(
                {
                    container: 'mkv',
                    videoCodec: 'h264',
                    audioCodec: 'truehd',
                },
                {
                    extraStreams: [
                        {
                            id: 'audio-2',
                            streamType: 2,
                            codec: 'eac3',
                            language: 'English',
                            languageCode: 'en',
                            channels: 6,
                            title: 'English (EAC3)',
                        },
                    ],
                }
            );
            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.isDirectPlay).toBe(true);
            expect(decision.isTranscoding).toBe(false);
            expect(decision.selectedAudioStream?.id).toBe('audio-2');
            expect(decision.playbackUrl).toContain('/library/parts/');
            expect(decision.playbackUrl).toContain('audioStreamID=audio-2');
        });

        it('should avoid commentary-only fallbacks for TrueHD and transcode the default track', async () => {
            const mockItem = createMockMediaItem(
                {
                    container: 'mkv',
                    videoCodec: 'h264',
                    audioCodec: 'truehd',
                },
                {
                    extraStreams: [
                        {
                            id: 'audio-2',
                            streamType: 2,
                            codec: 'ac3',
                            language: 'English',
                            languageCode: 'en',
                            channels: 2,
                            title: 'Director Commentary',
                        },
                    ],
                }
            );
            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.isTranscoding).toBe(true);
            expect(decision.selectedAudioStream?.id).toBe('audio-1');
            expect(decision.playbackUrl).toContain('audioStreamID=audio-1');
        });

        it('should start a playback session', async () => {
            const mockItem = createMockMediaItem();
            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.sessionId).toBeTruthy();
            expect(decision.sessionId).toMatch(/^[a-f0-9-]{36}$/);
        });

        it('should throw ITEM_NOT_FOUND for missing item', async () => {
            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(null),
            });
            const resolver = new PlexStreamResolver(config);

            await expect(resolver.resolveStream({ itemKey: '12345' })).rejects.toMatchObject({
                code: 'ITEM_NOT_FOUND',
            });
        });

        it('should select audio/subtitle tracks when specified', async () => {
            const mockItem = createMockMediaItem();
            // Add subtitle stream
            const subtitleStream: PlexStream = {
                id: 'sub-1',
                streamType: 3,
                codec: 'srt',
                language: 'English',
                languageCode: 'en',
                format: 'srt',
                default: true,
            };
            getPrimaryPart(mockItem).streams.push(subtitleStream);

            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({
                itemKey: '12345',
                audioStreamId: 'audio-1',
                subtitleStreamId: 'sub-1',
            });

            expect(requireValue(decision.selectedAudioStream).id).toBe('audio-1');
            expect(requireValue(decision.selectedSubtitleStream).id).toBe('sub-1');
        });

        it('forces burn-in subtitle transcode request params when burn mode is requested', async () => {
            const mockItem = createMockMediaItem({
                container: 'avi',
                videoCodec: 'mpeg4',
                audioCodec: 'mp2',
            });
            const subtitleStream: PlexStream = {
                id: 'sub-1',
                streamType: 3,
                codec: 'srt',
                language: 'English',
                languageCode: 'en',
                format: 'srt',
                default: true,
            };
            getPrimaryPart(mockItem).streams.push(subtitleStream);

            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({
                itemKey: '12345',
                subtitleStreamId: 'sub-1',
                subtitleMode: 'burn',
            });

            expect(decision.isTranscoding).toBe(true);
            expect(decision.subtitleDelivery).toBe('burn');
            expect(decision.transcodeRequest).toMatchObject({
                subtitleStreamId: 'sub-1',
                subtitleMode: 'burn',
            });
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/library/parts/part-1?subtitleStreamID=sub-1'),
                expect.objectContaining({
                    method: 'PUT',
                    headers: expect.objectContaining({
                        'X-Plex-Token': 'mock-token',
                    }),
                })
            );
            const parsed = new URL(decision.playbackUrl);
            expect(parsed.searchParams.get('subtitles')).toBe('burn');
            expect(parsed.searchParams.get('subtitleStreamID')).toBe('sub-1');
            expect(parsed.searchParams.get('advancedSubtitles')).toBeNull();
        });

        it('marks subtitle burn-in as confirmed only from matching PMS stream decision evidence', async () => {
            expectConsoleWarn([
                'Transcode URL (compat=0):',
                expect.stringContaining('X-Plex-Token=REDACTED'),
            ], { times: 2 });
            expectConsoleWarn([
                'Stream decision:',
                expect.objectContaining({ itemKey: '12345', mode: 'transcode' }),
            ]);
            Object.defineProperty(globalThis, 'localStorage', {
                value: {
                    getItem: jest.fn((key: string) =>
                        key === LINEUP_STORAGE_KEYS.DEBUG_LOGGING ? '1' : null
                    ),
                },
                configurable: true,
            });
            const mockItem = createMockMediaItem({
                container: 'avi',
                videoCodec: 'mpeg4',
                audioCodec: 'mp2',
            });
            getPrimaryPart(mockItem).streams.push({
                id: 'sub-1',
                streamType: 3,
                codec: 'srt',
                language: 'English',
                languageCode: 'en',
                format: 'srt',
                default: true,
            });
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    text: async () => '',
                })
                .mockResolvedValueOnce(new Response(
                    '<MediaContainer decisionCode="1000" decisionText="Transcode">' +
                    '<TranscodeSession>' +
                    '<Stream id="sub-1" streamType="3" decision="burn" />' +
                    '</TranscodeSession>' +
                    '</MediaContainer>',
                    { status: 200, headers: { 'content-type': 'text/xml' } }
                ));

            const resolver = new PlexStreamResolver(createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
            }));
            const decision = await resolver.resolveStream({
                itemKey: '12345',
                subtitleStreamId: 'sub-1',
                subtitleMode: 'burn',
            });

            expect(decision.subtitleBurnIn).toMatchObject({
                requested: true,
                confirmed: true,
                subtitleStreamId: 'sub-1',
            });
            expect(decision.serverDecision?.streams).toEqual([
                { id: 'sub-1', streamType: 3, decision: 'burn' },
            ]);
        });

        it('fetches PMS decision evidence for burn-in requests even when debug logging is disabled', async () => {
            const mockItem = createMockMediaItem({
                container: 'avi',
                videoCodec: 'mpeg4',
                audioCodec: 'mp2',
            });
            getPrimaryPart(mockItem).streams.push({
                id: 'sub-1',
                streamType: 3,
                codec: 'srt',
                language: 'English',
                languageCode: 'en',
                format: 'srt',
                default: true,
            });
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    text: async () => '',
                })
                .mockResolvedValueOnce(new Response(
                    '<MediaContainer decisionCode="1000" decisionText="Transcode">' +
                    '<TranscodeSession videoDecision="copy" audioDecision="transcode">' +
                    '<Stream id="sub-1" streamType="3" decision="burn" />' +
                    '</TranscodeSession>' +
                    '</MediaContainer>',
                    { status: 200, headers: { 'content-type': 'text/xml' } }
                ));

            const resolver = new PlexStreamResolver(createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
            }));
            const decision = await resolver.resolveStream({
                itemKey: '12345',
                subtitleStreamId: 'sub-1',
                subtitleMode: 'burn',
            });

            expect(mockFetch).toHaveBeenCalledTimes(2);
            const [selectionUrl, selectionInit] = mockFetch.mock.calls[0]!;
            expect(new URL(String(selectionUrl)).pathname).toBe('/library/parts/part-1');
            expect(new URL(String(selectionUrl)).searchParams.get('subtitleStreamID')).toBe('sub-1');
            expect(selectionInit).toEqual(expect.objectContaining({ method: 'PUT' }));
            const [decisionUrl] = mockFetch.mock.calls[1]!;
            expect(new URL(String(decisionUrl)).pathname).toBe('/video/:/transcode/universal/decision');
            expect(decision.subtitleBurnIn).toMatchObject({
                requested: true,
                confirmed: true,
                subtitleStreamId: 'sub-1',
            });
            expect(decision.serverDecision?.videoDecision).toBe('copy');
        });

        it('fails burn-in resolution when PMS cannot select the subtitle on the part', async () => {
            const mockItem = createMockMediaItem({
                container: 'avi',
                videoCodec: 'mpeg4',
                audioCodec: 'mp2',
            });
            getPrimaryPart(mockItem).streams.push({
                id: 'sub-1',
                streamType: 3,
                codec: 'srt',
                language: 'English',
                languageCode: 'en',
                format: 'srt',
            });
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => 'server error',
            });
            const resolver = new PlexStreamResolver(createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
            }));

            await expect(resolver.resolveStream({
                itemKey: '12345',
                subtitleStreamId: 'sub-1',
                subtitleMode: 'burn',
            })).rejects.toMatchObject({
                code: AppErrorCode.TRANSCODE_FAILED,
                message: 'Failed to update subtitle stream selection: HTTP 500',
                recoverable: true,
            });
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('clears PMS part subtitle selection when subtitle mode is explicitly none', async () => {
            const mockItem = createMockMediaItem();
            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({
                itemKey: '12345',
                subtitleMode: 'none',
            });

            expect(decision.isDirectPlay).toBe(true);
            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [selectionUrl, selectionInit] = mockFetch.mock.calls[0]!;
            const parsed = new URL(String(selectionUrl));
            expect(parsed.pathname).toBe('/library/parts/part-1');
            expect(parsed.searchParams.get('subtitleStreamID')).toBe('0');
            expect(selectionInit).toEqual(expect.objectContaining({
                method: 'PUT',
                headers: expect.objectContaining({
                    'X-Plex-Token': 'mock-token',
                }),
            }));
        });

        it('does not fail playback when clearing PMS part subtitle selection fails', async () => {
            const mockItem = createMockMediaItem();
            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
            });
            expectConsoleWarn([
                'Failed to clear PMS part subtitle selection:',
                expect.objectContaining({
                    itemKey: '12345',
                    partId: 'part-1',
                    error: expect.objectContaining({
                        code: AppErrorCode.TRANSCODE_FAILED,
                    }),
                }),
            ]);
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => 'server error',
            });
            const resolver = new PlexStreamResolver(config);

            await expect(resolver.resolveStream({
                itemKey: '12345',
                subtitleMode: 'none',
            })).resolves.toMatchObject({
                isDirectPlay: true,
                subtitleDelivery: 'none',
            });
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('does not request burn-in when a text subtitle is selected but burn mode is not requested', async () => {
            const mockItem = createMockMediaItem({
                container: 'avi',
                videoCodec: 'mpeg4',
                audioCodec: 'mp2',
            });
            const subtitleStream: PlexStream = {
                id: 'sub-1',
                streamType: 3,
                codec: 'srt',
                language: 'English',
                languageCode: 'en',
                format: 'srt',
                default: true,
            };
            getPrimaryPart(mockItem).streams.push(subtitleStream);

            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({
                itemKey: '12345',
                subtitleStreamId: 'sub-1',
            });

            expect(decision.isTranscoding).toBe(true);
            expect(decision.selectedSubtitleStream?.id).toBe('sub-1');
            expect(decision.subtitleDelivery).toBe('sidecar');
            expect(decision.transcodeRequest?.subtitleStreamId).toBeUndefined();
            expect(mockFetch).not.toHaveBeenCalled();

            const parsed = new URL(decision.playbackUrl);
            expect(parsed.searchParams.get('subtitles')).toBe('none');
            expect(parsed.searchParams.get('subtitleStreamID')).toBe('0');
        });

        it('preserves subtitleDelivery for the selected subtitle path in resolveStream()', async () => {
            const mockItem = createMockMediaItem();
            const subtitleStream: PlexStream = {
                id: 'sub-1',
                streamType: 3,
                codec: 'srt',
                language: 'English',
                languageCode: 'en',
                format: 'srt',
                default: true,
            };
            getPrimaryPart(mockItem).streams.push(subtitleStream);

            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({
                itemKey: '12345',
                subtitleStreamId: 'sub-1',
            });

            expect(decision.isTranscoding).toBe(false);
            expect(decision.subtitleDelivery).toBe('sidecar');
            expect(decision.transcodeRequest).toBeUndefined();
        });

        it('treats codec-only text subtitles as sidecar in resolveStream()', async () => {
            const mockItem = createMockMediaItem();
            const subtitleStream: PlexStream = {
                id: 'sub-1',
                streamType: 3,
                codec: 'srt',
                language: 'English',
                languageCode: 'en',
                default: true,
            };
            getPrimaryPart(mockItem).streams.push(subtitleStream);

            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({
                itemKey: '12345',
                subtitleStreamId: 'sub-1',
            });

            expect(decision.isTranscoding).toBe(false);
            expect(decision.subtitleDelivery).toBe('sidecar');
            expect(decision.transcodeRequest).toBeUndefined();
        });

        it('preserves codec fallback for burn-in propagation in resolveStream() when subtitle format is missing', async () => {
            const mockItem = createMockMediaItem({
                container: 'avi',
                videoCodec: 'mpeg4',
                audioCodec: 'mp2',
            });
            const subtitleStream: PlexStream = {
                id: 'sub-1',
                streamType: 3,
                codec: 'pgs',
                language: 'English',
                languageCode: 'en',
                default: true,
            };
            getPrimaryPart(mockItem).streams.push(subtitleStream);

            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({
                itemKey: '12345',
                subtitleStreamId: 'sub-1',
            });

            expect(decision.isTranscoding).toBe(true);
            expect(decision.subtitleDelivery).toBe('burn');
            expect(decision.transcodeRequest).toMatchObject({
                subtitleStreamId: 'sub-1',
                subtitleMode: 'burn',
            });
        });

    });

    // ========================================
    // getTranscodeUrl
    // ========================================

    describe('getTranscodeUrl', () => {
        it('should include all required parameters', () => {
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            const url = resolver.getTranscodeUrl('12345', {});

            expect(url).toContain('protocol=hls');
            expect(url).toContain('offset=0');
            expect(url).toContain('session=');
            expect(url).toContain('X-Plex-Session-Identifier=');
            expect(url).toContain('X-Plex-Token=mock-token');
            expect(url).toContain('X-Plex-Client-Identifier=test-client-id');
            expect(url).toContain('X-Plex-Platform=webOS');
            expect(url).toContain('start.m3u8');
        });

        it('uses injected debug override profile name when provided', () => {
            const readTranscodeProfileNameAndClean = jest.fn(() => 'Generic');
            const resolver = new PlexStreamResolver(
                createMockConfig({
                    debugOverridesReader: { readTranscodeProfileNameAndClean },
                })
            );

            const parsed = new URL(resolver.getTranscodeUrl('12345', {}));

            expect(readTranscodeProfileNameAndClean).toHaveBeenCalledTimes(1);
            expect(parsed.searchParams.get('X-Plex-Client-Profile-Name')).toBe('Generic');
        });

        it('falls back to HTML TV App when injected profile override is absent', () => {
            const resolver = new PlexStreamResolver(
                createMockConfig({
                    debugOverridesReader: { readTranscodeProfileNameAndClean: () => null },
                })
            );

            const parsed = new URL(resolver.getTranscodeUrl('12345', {}));

            expect(parsed.searchParams.get('X-Plex-Client-Profile-Name')).toBe('HTML TV App');
        });

        it('preserves identity precedence: auth headers > platform defaults', () => {
            const identityService: PlatformIdentityService = {
                isWebOs: jest.fn(() => true),
                detectPlatformVersion: jest.fn(() => '99.1'),
                getDefaultPlexIdentity: jest.fn((clientIdentifier: string) => ({
                    'X-Plex-Client-Identifier': clientIdentifier,
                    'X-Plex-Platform': 'ServicePlatform',
                    'X-Plex-Product': 'ServiceProduct',
                    'X-Plex-Version': '9.9.9',
                    'X-Plex-Device': 'ServiceDevice',
                    'X-Plex-Device-Name': 'Service Device Name',
                    'X-Plex-Platform-Version': '99.1',
                    'X-Plex-Model': 'ServiceModel',
                })),
            };
            const config = createMockConfig({
                getAuthHeaders: () => ({
                    'X-Plex-Token': 'mock-token',
                    'X-Plex-Platform': 'HeaderPlatform',
                    'X-Plex-Model': 'HeaderModel',
                }),
                identityService,
            });
            const resolver = new PlexStreamResolver(config);

            const parsed = new URL(resolver.getTranscodeUrl('12345', {}));

            expect(parsed.searchParams.get('X-Plex-Platform')).toBe('HeaderPlatform');
            expect(parsed.searchParams.get('X-Plex-Model')).toBe('HeaderModel');
            expect(parsed.searchParams.get('X-Plex-Product')).toBe('ServiceProduct');
            expect(parsed.searchParams.get('X-Plex-Platform-Version')).toBe('99.1');
            expect(identityService.getDefaultPlexIdentity).toHaveBeenCalledWith('test-client-id');
        });

        it('preserves computed transcode X-Plex-Client-Capabilities precedence over header value', () => {
            const config = createMockConfig({
                getAuthHeaders: () => ({
                    'X-Plex-Token': 'mock-token',
                    'X-Plex-Client-Capabilities': 'header-capabilities',
                }),
            });
            const resolver = new PlexStreamResolver(config);

            const parsed = new URL(resolver.getTranscodeUrl('12345', {}));

            expect(parsed.searchParams.get('X-Plex-Client-Capabilities')).toBe(
                'protocols=http-live-streaming,http-mp4-streaming,http-streaming-video;videoDecoders=h264{profile:high&level:51};audioDecoders=mp3,aac{bitrate:800000},ac3{bitrate:800000},eac3{bitrate:800000}'
            );
        });

        it('redacts X-Plex-Token in transcode debug logs', () => {
            const transcodeLog = expectConsoleWarn([
                'Transcode URL (compat=0):',
                expect.stringContaining('X-Plex-Token=REDACTED'),
            ]);
            Object.defineProperty(globalThis, 'localStorage', {
                value: {
                    getItem: jest.fn((key: string) =>
                        key === LINEUP_STORAGE_KEYS.DEBUG_LOGGING ? '1' : null
                    ),
                },
                configurable: true,
            });

            const resolver = new PlexStreamResolver(createMockConfig());
            const url = resolver.getTranscodeUrl('12345', {});

            expect(url).toContain('X-Plex-Token=mock-token');
            expect(transcodeLog.getLastCall()?.[1]).toEqual(
                expect.not.stringContaining('X-Plex-Token=mock-token')
            );
        });

        it('should respect bitrate limits', () => {
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            const url = resolver.getTranscodeUrl('12345', { maxBitrate: 4000 });

            expect(url).toContain('maxVideoBitrate=4000');
        });

        it('does not cap video bitrate when no quality policy or request cap is specified', () => {
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            const url = resolver.getTranscodeUrl('12345', {});
            const parsed = new URL(url);

            expect(parsed.searchParams.has('maxVideoBitrate')).toBe(false);
        });

        it('serializes the server-side HLS offset in seconds', () => {
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            const url = resolver.getTranscodeUrl('12345', { startOffsetMs: 183_456 });
            const parsed = new URL(url);

            expect(parsed.searchParams.get('offset')).toBe('183');
        });

        it('propagates resolveStream start offsets into the active HLS request metadata', async () => {
            const mockItem = createMockMediaItem({
                container: 'avi',
                videoCodec: 'mpeg4',
                audioCodec: 'mp2',
            });
            const resolver = new PlexStreamResolver(
                createMockConfig({ getItem: jest.fn().mockResolvedValue(mockItem) })
            );

            const decision = await resolver.resolveStream({
                itemKey: '12345',
                startOffsetMs: 183_456,
                directPlay: false,
            });
            const parsed = new URL(decision.playbackUrl);

            expect(parsed.searchParams.get('offset')).toBe('183');
            expect(decision.transcodeRequest).toMatchObject({
                startOffsetMs: 183_456,
                startOffsetSeconds: 183,
                transcodeCompatMode: false,
                transcodeQuality: { storageValue: '' },
            });
        });

        it('should honor provided sessionId for transcoder binding', () => {
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            const url = resolver.getTranscodeUrl('12345', { sessionId: 'test-session-id' });

            expect(url).toContain('session=test-session-id');
            expect(url).toContain('X-Plex-Session-Identifier=test-session-id');
        });

        it('should include burn-in subtitle params when requested', () => {
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            const url = resolver.getTranscodeUrl('12345', {
                subtitleStreamId: 'sub-1',
                subtitleMode: 'burn',
                mediaIndex: 1,
                partIndex: 2,
            });

            const parsed = new URL(url);
            expect(parsed.searchParams.get('subtitles')).toBe('burn');
            expect(parsed.searchParams.get('subtitleStreamID')).toBe('sub-1');
            expect(parsed.searchParams.get('subtitleFormat')).toBeNull();
            expect(parsed.searchParams.get('mediaIndex')).toBe('1');
            expect(parsed.searchParams.get('partIndex')).toBe('2');
        });

        it('should include explicit subtitle defaults in compat mode when burn-in is off', () => {
            Object.defineProperty(globalThis, 'localStorage', {
                value: {
                    getItem: (key: string) =>
                        key === LINEUP_STORAGE_KEYS.TRANSCODE_COMPAT ? '1' : null,
                },
                configurable: true,
            });

            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            const url = resolver.getTranscodeUrl('12345', {});
            const parsed = new URL(url);

            expect(parsed.searchParams.get('subtitles')).toBe('none');
            expect(parsed.searchParams.get('subtitleStreamID')).toBe('0');
            expect(parsed.searchParams.get('subtitleFormat')).toBe('none');
        });

        it('applies transcode quality cap from storage', () => {
            Object.defineProperty(globalThis, 'localStorage', {
                value: {
                    getItem: (key: string) =>
                        key === LINEUP_STORAGE_KEYS.TRANSCODE_QUALITY ? '4000-720p' : null,
                },
                configurable: true,
            });

            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            const url = resolver.getTranscodeUrl('12345', {});
            const parsed = new URL(url);

            expect(parsed.searchParams.get('maxVideoBitrate')).toBe('4000');
            expect(parsed.searchParams.get('videoQuality')).toBe('100');
            expect(parsed.searchParams.get('videoResolution')).toBe('1280x720');
        });

        it('explicit maxBitrate wins over storage cap when lower', () => {
            Object.defineProperty(globalThis, 'localStorage', {
                value: {
                    getItem: (key: string) =>
                        key === LINEUP_STORAGE_KEYS.TRANSCODE_QUALITY ? '4000-720p' : null,
                },
                configurable: true,
            });

            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            const url = resolver.getTranscodeUrl('12345', { maxBitrate: 1500 });
            const parsed = new URL(url);

            expect(parsed.searchParams.get('maxVideoBitrate')).toBe('1500');
            expect(parsed.searchParams.get('videoQuality')).toBe('100');
            expect(parsed.searchParams.get('videoResolution')).toBe('1280x720');
        });

        it('applies compat mode and quality cap together', () => {
            Object.defineProperty(globalThis, 'localStorage', {
                value: {
                    getItem: (key: string) => {
                        if (key === LINEUP_STORAGE_KEYS.TRANSCODE_COMPAT) {
                            return '1';
                        }
                        if (key === LINEUP_STORAGE_KEYS.TRANSCODE_QUALITY) {
                            return '2000-720p';
                        }
                        return null;
                    },
                },
                configurable: true,
            });

            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            const url = resolver.getTranscodeUrl('12345', {});
            const parsed = new URL(url);

            expect(parsed.searchParams.get('subtitles')).toBe('none');
            expect(parsed.searchParams.get('subtitleStreamID')).toBe('0');
            expect(parsed.searchParams.get('subtitleFormat')).toBe('none');
            expect(parsed.searchParams.get('maxVideoBitrate')).toBe('2000');
            expect(parsed.searchParams.get('videoQuality')).toBe('100');
            expect(parsed.searchParams.get('videoResolution')).toBe('1280x720');
        });

        it('should throw when no server URI is available', () => {
            const config = createMockConfig({
                getServerUri: () => null,
            });
            const resolver = new PlexStreamResolver(config);

            expect(() => resolver.getTranscodeUrl('12345', {})).toThrow();
        });

        it('throws a typed parse error and emits it when the item key cannot build a metadata path', () => {
            const resolver = new PlexStreamResolver(createMockConfig());
            const errorHandler = jest.fn();
            const disposable = resolver.on('error', errorHandler);

            try {
                resolver.getTranscodeUrl('   ', {});
                throw new Error('Expected getTranscodeUrl() to throw');
            } catch (error) {
                expect(error).toMatchObject({
                    code: 'PARSE_ERROR',
                    message: expect.stringContaining('Invalid item key for transcode URL'),
                    recoverable: false,
                });
            }

            expect(errorHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'PARSE_ERROR',
                    recoverable: false,
                })
            );

            disposable.dispose();
            try {
                resolver.getTranscodeUrl('', {});
            } catch {
                // Expected; this assertion only verifies disposable listener cleanup.
            }
            expect(errorHandler).toHaveBeenCalledTimes(1);
        });
    });

    describe('direct-play url construction', () => {
        it('includes default identity params when auth headers are minimal', async () => {
            const item = createMockMediaItem({
                container: 'mp4',
                videoCodec: 'h264',
                audioCodec: 'aac',
            });
            const resolver = new PlexStreamResolver(
                createMockConfig({
                    getAuthHeaders: () => ({
                        'X-Plex-Token': 'mock-token',
                    }),
                    getItem: jest.fn().mockResolvedValue(item),
                })
            );

            const decision = await resolver.resolveStream({ itemKey: '12345' });
            const parsed = new URL(decision.playbackUrl);

            expect(parsed.searchParams.get('X-Plex-Token')).toBe('mock-token');
            expect(parsed.searchParams.get('X-Plex-Session-Identifier')).toMatch(
                /^[a-f0-9-]{36}$/i
            );
            expect(parsed.searchParams.get('X-Plex-Client-Identifier')).toBe('test-client-id');
            expect(parsed.searchParams.get('X-Plex-Platform')).toBe('webOS');
            expect(parsed.searchParams.get('X-Plex-Product')).toBeTruthy();
            expect(parsed.searchParams.get('X-Plex-Version')).toBeTruthy();
            expect(parsed.searchParams.get('X-Plex-Device')).toBeTruthy();
            expect(parsed.searchParams.get('X-Plex-Device-Name')).toBeTruthy();
            expect(parsed.searchParams.get('X-Plex-Model')).toBeTruthy();
            expect(parsed.searchParams.get('X-Plex-Platform-Version')).toBeTruthy();
        });

        it('keeps computed direct-play capabilities even when headers supply a different value', async () => {
            const item = createMockMediaItem({
                container: 'mp4',
                videoCodec: 'h264',
                audioCodec: 'aac',
            });
            const resolver = new PlexStreamResolver(
                createMockConfig({
                    getAuthHeaders: () => ({
                        'X-Plex-Token': 'mock-token',
                        'X-Plex-Client-Capabilities': 'overrides-from-header',
                    }),
                    getItem: jest.fn().mockResolvedValue(item),
                })
            );

            const decision = await resolver.resolveStream({ itemKey: '12345' });
            const parsed = new URL(decision.playbackUrl);

            expect(parsed.searchParams.get('X-Plex-Client-Capabilities')).not.toBe('overrides-from-header');
            expect(parsed.searchParams.get('X-Plex-Client-Capabilities')).toContain(
                'protocols=http-live-streaming'
            );
        });

        it('normalizes absolute direct-play keys to the selected playback origin', async () => {
            const item = createMockMediaItem(
                {
                    container: 'mp4',
                    videoCodec: 'h264',
                    audioCodec: 'aac',
                },
                {
                    partKey: 'http://evil.example/library/parts/12345/file.mp4?audioStreamID=audio-1',
                }
            );
            const resolver = new PlexStreamResolver(
                createMockConfig({
                    getItem: jest.fn().mockResolvedValue(item),
                })
            );

            const decision = await resolver.resolveStream({ itemKey: '12345' });
            const parsed = new URL(decision.playbackUrl);

            expect(parsed.origin).toBe('http://192.168.1.100:32400');
            expect(parsed.pathname).toBe('/library/parts/12345/file.mp4');
            expect(parsed.searchParams.get('audioStreamID')).toBe('audio-1');
            expect(parsed.searchParams.get('X-Plex-Session-Identifier')).toMatch(
                /^[a-f0-9-]{36}$/i
            );
        });
    });

    describe('transcode capability advertising', () => {
        it('advertises DTS codecs only when user-enabled and Chrome is modern', () => {
            expectConsoleWarn([
                'Transcode URL (compat=1):',
                expect.stringContaining('X-Plex-Token=REDACTED'),
            ]);
            Object.defineProperty(globalThis, 'localStorage', {
                value: { getItem: jest.fn().mockReturnValue('1') },
                configurable: true,
            });
            Object.defineProperty(globalThis, 'navigator', {
                value: { userAgent: 'Mozilla/5.0 (Web0S) AppleWebKit/537.36 Chrome/108.0.0.0 Safari/537.36' },
                configurable: true,
            });

            const capabilities = new URL(
                new PlexStreamResolver(createMockConfig()).getTranscodeUrl('12345', {})
            ).searchParams.get('X-Plex-Client-Capabilities');

            expect(capabilities).toContain('dts{bitrate:1536000}');
            expect(capabilities).toContain('dca{bitrate:1536000}');
            expect(capabilities).toContain('dca-ma{bitrate:1536000}');
        });

        it('does not advertise DTS codecs when Chrome is below 108', () => {
            expectConsoleWarn([
                'Transcode URL (compat=1):',
                expect.stringContaining('X-Plex-Token=REDACTED'),
            ]);
            Object.defineProperty(globalThis, 'localStorage', {
                value: { getItem: jest.fn().mockReturnValue('1') },
                configurable: true,
            });
            Object.defineProperty(globalThis, 'navigator', {
                value: { userAgent: 'Mozilla/5.0 (Web0S) AppleWebKit/537.36 Chrome/107.0.0.0 Safari/537.36' },
                configurable: true,
            });

            const capabilities = new URL(
                new PlexStreamResolver(createMockConfig()).getTranscodeUrl('12345', {})
            ).searchParams.get('X-Plex-Client-Capabilities');

            expect(capabilities).not.toContain('dts{bitrate:1536000}');
            expect(capabilities).not.toContain('dca{bitrate:1536000}');
            expect(capabilities).not.toContain('dca-ma{bitrate:1536000}');
        });

        it('does not advertise DTS codecs when user disables passthrough', () => {
            Object.defineProperty(globalThis, 'localStorage', {
                value: { getItem: jest.fn().mockReturnValue('0') },
                configurable: true,
            });
            Object.defineProperty(globalThis, 'navigator', {
                value: { userAgent: 'Mozilla/5.0 (Web0S) AppleWebKit/537.36 Chrome/108.0.0.0 Safari/537.36' },
                configurable: true,
            });

            const capabilities = new URL(
                new PlexStreamResolver(createMockConfig()).getTranscodeUrl('12345', {})
            ).searchParams.get('X-Plex-Client-Capabilities');

            expect(capabilities).not.toContain('dts{bitrate:1536000}');
            expect(capabilities).not.toContain('dca{bitrate:1536000}');
            expect(capabilities).not.toContain('dca-ma{bitrate:1536000}');
        });
    });

    describe('fetchUniversalTranscodeDecision', () => {
        it('should parse decision attributes from XML response', async () => {
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            mockFetch.mockResolvedValue(new Response(
                '<MediaContainer decisionCode="1000" decisionText="Transcode"><TranscodeSession videoDecision="copy" audioDecision="transcode" subtitleDecision="none" /></MediaContainer>',
                { status: 200, headers: { 'content-type': 'text/xml' } }
            ));

            const result = await resolver.fetchUniversalTranscodeDecision('12345', {
                sessionId: 'sess-1',
                startOffsetMs: 0,
                startOffsetSeconds: 0,
                maxBitrate: 20000,
                maxBitrateReason: 'explicit',
                transcodeCompatMode: false,
                transcodeQuality: null,
            });

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/video/:/transcode/universal/decision'),
                expect.objectContaining({
                    method: 'GET',
                    headers: expect.objectContaining({
                        'X-Plex-Token': 'mock-token',
                        Accept: 'application/json',
                    }),
                    signal: expect.any(AbortSignal),
                })
            );
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 4000);
            expect(result?.decisionCode).toBe('1000');
            expect(result?.decisionText).toBe('Transcode');
            expect(result?.videoDecision).toBe('copy');
            expect(result?.audioDecision).toBe('transcode');
            expect(result?.subtitleDecision).toBe('none');
            setTimeoutSpy.mockRestore();
        });

        it('rejects the optional decision when DOMParser returns parsererror XML', async () => {
            const originalDomParser = globalThis.DOMParser;
            Object.defineProperty(globalThis, 'DOMParser', {
                configurable: true,
                writable: true,
                value: class {
                    parseFromString(): Pick<Document, 'querySelector'> {
                        return {
                            querySelector: (selector: string): Element | null =>
                                selector === 'parsererror' ? ({} as Element) : null,
                        };
                    }
                },
            });
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            try {
                mockFetch.mockResolvedValue(new Response(
                    '<MediaContainer decisionCode="1000" decisionText="Transcode">' +
                    '<TranscodeSession videoDecision="copy" audioDecision="transcode" subtitleDecision="none">' +
                    '</MediaContainer>',
                    { status: 200, headers: { 'content-type': 'text/xml' } }
                ));

                await expect(resolver.fetchUniversalTranscodeDecision('12345', {
                    sessionId: 'sess-1',
                    startOffsetMs: 0,
                    startOffsetSeconds: 0,
                    maxBitrate: 20000,
                    maxBitrateReason: 'explicit',
                    transcodeCompatMode: false,
                    transcodeQuality: null,
                })).rejects.toThrow('Invalid universal transcode decision XML');
            } finally {
                Object.defineProperty(globalThis, 'DOMParser', {
                    configurable: true,
                    writable: true,
                    value: originalDomParser,
                });
            }
        });

        it('throws ACCESS_DENIED when Plex forbids the decision request', async () => {
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);
            const errorHandler = jest.fn();
            const disposable = resolver.on('error', errorHandler);

            mockFetch.mockResolvedValue({
                ok: false,
                status: 403,
                text: async () => '',
            });

            await expect(
                resolver.fetchUniversalTranscodeDecision('12345', {
                    sessionId: 'sess-1',
                    startOffsetMs: 0,
                    startOffsetSeconds: 0,
                    maxBitrate: 20000,
                    maxBitrateReason: 'explicit',
                    transcodeCompatMode: false,
                    transcodeQuality: null,
                })
            ).rejects.toMatchObject({
                code: AppErrorCode.ACCESS_DENIED,
                message: 'Access denied',
                recoverable: false,
            });
            expect(errorHandler).not.toHaveBeenCalled();
            disposable.dispose();
        });
    });

    describe('stopTranscodeSession', () => {
        it('should return silently when server URI is unavailable', async () => {
            const config = createMockConfig({
                getServerUri: () => null,
            });
            const resolver = new PlexStreamResolver(config);

            await resolver.stopTranscodeSession('sess-1');

            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should DELETE transcode session when server URI is available', async () => {
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
            });

            await resolver.stopTranscodeSession('sess-1');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/transcode/sessions/sess-1'),
                expect.objectContaining({
                    method: 'DELETE',
                    headers: expect.objectContaining({
                        'X-Plex-Token': 'mock-token',
                        Accept: 'application/json',
                    }),
                    signal: expect.any(AbortSignal),
                })
            );
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
            setTimeoutSpy.mockRestore();
        });

        it('refreshes a stale PMS token once and retries the stream request once', async () => {
            let token = 'pms-token-old';
            const refreshSelectedServerAccessToken = jest.fn(async (expectedToken: string) => {
                expect(expectedToken).toBe('pms-token-old');
                token = 'pms-token-new';
                return { kind: 'updated' as const };
            });
            const probeCurrentCredentialValidity = jest.fn(async () => ({
                kind: 'active_valid' as const,
            }));
            const resolver = new PlexStreamResolver(createMockConfig({
                getAuthHeaders: () => ({ 'X-Plex-Token': token }),
                refreshSelectedServerAccessToken,
                probeCurrentCredentialValidity,
            }));
            mockFetch
                .mockResolvedValueOnce({ ok: false, status: 401 })
                .mockResolvedValueOnce({ ok: true, status: 200 });

            await resolver.stopTranscodeSession('sess-1');

            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(new Headers(mockFetch.mock.calls[0]?.[1]?.headers).get('X-Plex-Token'))
                .toBe('pms-token-old');
            expect(new Headers(mockFetch.mock.calls[1]?.[1]?.headers).get('X-Plex-Token'))
                .toBe('pms-token-new');
            expect(refreshSelectedServerAccessToken).toHaveBeenCalledTimes(1);
            expect(probeCurrentCredentialValidity).not.toHaveBeenCalled();
        });

        it('classifies an unchanged PMS 401 without falling back to account auth', async () => {
            expectConsoleWarn([
                'stopTranscodeSession failed:',
                expect.objectContaining({
                    error: expect.objectContaining({
                        code: AppErrorCode.PLEX_PROFILE_SERVER_ACCESS_DENIED,
                    }),
                }),
            ]);
            const refreshSelectedServerAccessToken = jest.fn(async () => ({
                kind: 'unchanged' as const,
            }));
            const probeCurrentCredentialValidity = jest.fn(async () => ({
                kind: 'active_valid' as const,
            }));
            const resolver = new PlexStreamResolver(createMockConfig({
                refreshSelectedServerAccessToken,
                probeCurrentCredentialValidity,
            }));
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

            await resolver.stopTranscodeSession('sess-1');

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(refreshSelectedServerAccessToken).toHaveBeenCalledTimes(1);
            expect(probeCurrentCredentialValidity).toHaveBeenCalledTimes(1);
        });

        it('suppresses cloud classification when resource refresh is superseded', async () => {
            expectConsoleWarn([
                'stopTranscodeSession failed:',
                expect.objectContaining({
                    error: expect.objectContaining({
                        code: AppErrorCode.SERVER_UNREACHABLE,
                        message: 'Plex server authorization scope changed',
                    }),
                }),
            ]);
            const refreshSelectedServerAccessToken = jest.fn(async () => {
                throw new PlexDiscoverySelectionSupersededError();
            });
            const probeCurrentCredentialValidity = jest.fn(async () => ({
                kind: 'active_valid' as const,
            }));
            const resolver = new PlexStreamResolver(createMockConfig({
                refreshSelectedServerAccessToken,
                probeCurrentCredentialValidity,
            }));
            const errorHandler = jest.fn();
            resolver.on('error', errorHandler);
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

            await resolver.stopTranscodeSession('sess-1');

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(refreshSelectedServerAccessToken).toHaveBeenCalledTimes(1);
            expect(probeCurrentCredentialValidity).not.toHaveBeenCalled();
            expect(errorHandler).not.toHaveBeenCalled();
        });

        it('does not retry when selection changes but the PMS token stays identical', async () => {
            const originalScope = Object.freeze({ id: 'server-a' });
            let activeScope: object = originalScope;
            const scopeSuperseded = new Error('selected Plex scope superseded');
            expectConsoleWarn([
                'stopTranscodeSession failed:',
                expect.objectContaining({
                    error: expect.objectContaining({ message: scopeSuperseded.message }),
                }),
            ]);
            const refreshSelectedServerAccessToken = jest.fn(async () => {
                activeScope = Object.freeze({ id: 'server-b' });
                return { kind: 'unchanged' as const };
            });
            const probeCurrentCredentialValidity = jest.fn(async () => ({
                kind: 'active_valid' as const,
            }));
            const resolver = new PlexStreamResolver(createMockConfig({
                captureSelectedServerScope: () => activeScope,
                assertSelectedServerScopeCurrent: (scope) => {
                    if (scope !== activeScope) throw scopeSuperseded;
                },
                refreshSelectedServerAccessToken,
                probeCurrentCredentialValidity,
            }));
            mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

            await resolver.stopTranscodeSession('sess-1');

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(refreshSelectedServerAccessToken).toHaveBeenCalledTimes(1);
            expect(probeCurrentCredentialValidity).not.toHaveBeenCalled();
        });

        it('logs a warning with session context when stopTranscodeSession fails', async () => {
            expectConsoleWarn([
                'stopTranscodeSession failed:',
                expect.objectContaining({
                    sessionId: 'sess-1',
                    error: expect.anything(),
                }),
            ]);
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            mockFetch.mockRejectedValueOnce(new Error('network down'));

            await resolver.stopTranscodeSession('sess-1');
        });

        it.each([
            [401, AppErrorCode.AUTH_EXPIRED],
            [403, AppErrorCode.ACCESS_DENIED],
        ])(
            'logs but does not emit a stream error when stopTranscodeSession receives %s',
            async (status, code) => {
                expectConsoleWarn([
                    'stopTranscodeSession failed:',
                    expect.objectContaining({
                        sessionId: 'sess-1',
                        error: expect.objectContaining({ code }),
                    }),
                ]);
                const resolver = new PlexStreamResolver(createMockConfig());
                const errorHandler = jest.fn();
                const disposable = resolver.on('error', errorHandler);

                mockFetch.mockResolvedValueOnce({
                    ok: false,
                    status,
                });

                await resolver.stopTranscodeSession('sess-1');

                expect(errorHandler).not.toHaveBeenCalled();
                disposable.dispose();
            }
        );
    });

    // ========================================
    // Mixed Content Handling
    // ========================================

    describe('mixed content handling', () => {
        const originalWindow = global.window;

        beforeEach(() => {
            // Mock HTTPS app context
            global.window = {
                location: { protocol: 'https:' },
            } as Window & typeof globalThis;
        });

        afterEach(() => {
            global.window = originalWindow;
        });

        it('should use HTTPS connection when available', async () => {
            const mockItem = createMockMediaItem();
            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
                getServerUri: () => 'http://192.168.1.100:32400', // HTTP server
                getHttpsConnection: () => ({ uri: 'https://secure.plex.direct:32400' }),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.playbackUrl).toContain('https://secure.plex.direct');
        });

        it('should use relay connection as fallback', async () => {
            const mockItem = createMockMediaItem();
            expectConsoleWarn('Using Plex relay due to mixed content restrictions');
            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
                getServerUri: () => 'http://192.168.1.100:32400',
                getHttpsConnection: () => null,
                getRelayConnection: () => ({ uri: 'https://relay.plex.direct:32400' }),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.playbackUrl).toContain('https://relay.plex.direct');
        });

        it('should throw MIXED_CONTENT_BLOCKED when no fallback available', async () => {
            const mockItem = createMockMediaItem();
            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
                getServerUri: () => 'http://192.168.1.100:32400',
                getHttpsConnection: () => null,
                getRelayConnection: () => null,
            });
            const resolver = new PlexStreamResolver(config);

            await expect(resolver.resolveStream({ itemKey: '12345' })).rejects.toMatchObject({
                code: 'MIXED_CONTENT_BLOCKED',
                recoverable: false,
            });
        });

        it('still emits playback-critical resolver errors', async () => {
            const mockItem = createMockMediaItem();
            const resolver = new PlexStreamResolver(
                createMockConfig({
                    getItem: jest.fn().mockResolvedValue(mockItem),
                    getServerUri: () => 'http://192.168.1.100:32400',
                    getHttpsConnection: () => null,
                    getRelayConnection: () => null,
                })
            );
            const errorHandler = jest.fn();
            const disposable = resolver.on('error', errorHandler);

            await expect(resolver.resolveStream({ itemKey: '12345' })).rejects.toMatchObject({
                code: AppErrorCode.MIXED_CONTENT_BLOCKED,
                recoverable: false,
            });

            expect(errorHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: AppErrorCode.MIXED_CONTENT_BLOCKED,
                    recoverable: false,
                })
            );
            disposable.dispose();
        });
    });
});
