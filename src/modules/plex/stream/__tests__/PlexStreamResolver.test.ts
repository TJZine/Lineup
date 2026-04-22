/**
 * @fileoverview Unit tests for PlexStreamResolver.
 * @module modules/plex/stream/__tests__/PlexStreamResolver.test
 */

import { PlexStreamResolver } from '../PlexStreamResolver';
import { generatePlexSessionId } from '../plexSessionId';
import type { PlexMediaFile, PlexMediaItem, PlexMediaPart, PlexStream } from '../types';
import { LINEUP_STORAGE_KEYS } from '../../../../config/storageKeys';
import type { PlatformIdentityService } from '../../../../platform';
import { createMockConfig, createMockMediaItem } from './testUtils';

// ============================================
// Tests
// ============================================

function requireValue<T>(value: T | null | undefined): NonNullable<T> {
    expect(value).not.toBeNull();
    expect(value).not.toBeUndefined();
    return value as NonNullable<T>;
}

function getPrimaryMedia(item: PlexMediaItem): PlexMediaFile {
    return requireValue(item.media[0]);
}

function getPrimaryPart(item: PlexMediaItem): PlexMediaPart {
    return requireValue(getPrimaryMedia(item).parts[0]);
}

function getPrimaryVideoStream(item: PlexMediaItem): PlexStream {
    return requireValue(getPrimaryPart(item).streams[0]) as PlexStream;
}

describe('PlexStreamResolver', () => {
    let mockFetch: jest.Mock;
    let originalNavigator: unknown;
    let originalLocalStorage: unknown;

    beforeEach(() => {
        mockFetch = jest.fn().mockResolvedValue({ ok: true });
        global.fetch = mockFetch;

        originalNavigator = (globalThis as unknown as { navigator?: unknown }).navigator;
        originalLocalStorage = (globalThis as unknown as { localStorage?: unknown }).localStorage;
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

        it('should return false for empty media array', () => {
            const item = createMockMediaItem();
            item.media = [];
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            expect(resolver.canDirectPlay(item)).toBe(false);
        });

        it('should evaluate only the first media entry for canDirectPlay', () => {
            const first = createMockMediaItem({
                container: 'avi',
                videoCodec: 'mpeg2',
                audioCodec: 'aac',
            });
            const second = createMockMediaItem({
                container: 'mp4',
                videoCodec: 'h264',
                audioCodec: 'aac',
            });
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            first.media = [getPrimaryMedia(first), getPrimaryMedia(second)];

            expect(resolver.canDirectPlay(first)).toBe(false);
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
            expect(decision.directPlay?.reasons).toContain('hdr10_fallback_smart');
            expect(decision.directPlay?.reasons).toContain('unsupported_audio_codec:truehd');
            expect(decision.transcodeRequest?.hideDolbyVision).toBe(true);
        });

        it('logs a warning when PMS universal decision fetch fails in debug mode', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
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
            expect(warnSpy).toHaveBeenCalledWith(
                'PMS universal decision fetch failed:',
                expect.objectContaining({ itemKey: '12345' })
            );
        });

        it('logs debug stream decision summary and HDR10 fallback reason', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
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

            const resolver = new PlexStreamResolver(
                createMockConfig({ getItem: jest.fn().mockResolvedValue(dvItem) })
            );

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.isTranscoding).toBe(true);
            expect(warnSpy).toHaveBeenCalledWith(
                'HDR10 fallback applied:',
                expect.objectContaining({ itemKey: '12345', reason: expect.any(String) })
            );
            expect(warnSpy).toHaveBeenCalledWith(
                'Stream decision:',
                expect.objectContaining({ itemKey: '12345', mode: 'transcode' })
            );
        });

        it('allows direct play for DV MKV when Smart is enabled but not letterbox', async () => {
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

        it('does not force HLS for DV MP4 profile 5 when fallback is off', async () => {
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

            expect(decision.isDirectPlay).toBe(true);
            expect(decision.isTranscoding).toBe(false);
        });

        it('forces HLS for DV MKV profile 5 even when fallback is off', async () => {
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

            expect(decision.isTranscoding).toBe(true);
            expect(decision.protocol).toBe('hls');
            expect(decision.directPlay?.reasons).toContain('dv_profile_no_hdr10_base_layer');
            expect(decision.playbackUrl).toContain('directStream=1');
        });

        it('forces HLS for DV MKV profile 8 HLG even when fallback is off', async () => {
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

            expect(decision.isTranscoding).toBe(true);
            expect(decision.protocol).toBe('hls');
            expect(decision.directPlay?.reasons).toContain('dv_profile_no_hdr10_base_layer');
            expect(decision.playbackUrl).toContain('directStream=1');
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
            const parsed = new URL(decision.playbackUrl);
            expect(parsed.searchParams.get('subtitles')).toBe('burn');
            expect(parsed.searchParams.get('subtitleStreamID')).toBe('sub-1');
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
                    debugOverridesStore: { readTranscodeProfileNameAndClean },
                })
            );

            const parsed = new URL(resolver.getTranscodeUrl('12345', {}));

            expect(readTranscodeProfileNameAndClean).toHaveBeenCalledTimes(1);
            expect(parsed.searchParams.get('X-Plex-Client-Profile-Name')).toBe('Generic');
        });

        it('falls back to HTML TV App when injected profile override is absent', () => {
            const resolver = new PlexStreamResolver(
                createMockConfig({
                    debugOverridesStore: { readTranscodeProfileNameAndClean: () => null },
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

        it('preserves transcode X-Plex-Client-Capabilities header precedence over computed value', () => {
            const config = createMockConfig({
                getAuthHeaders: () => ({
                    'X-Plex-Token': 'mock-token',
                    'X-Plex-Client-Capabilities': 'header-capabilities',
                }),
            });
            const resolver = new PlexStreamResolver(config);

            const parsed = new URL(resolver.getTranscodeUrl('12345', {}));

            expect(parsed.searchParams.get('X-Plex-Client-Capabilities')).toBe('header-capabilities');
        });

        it('redacts X-Plex-Token in transcode debug logs', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
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
            expect(warnSpy).toHaveBeenCalledWith(
                'Transcode URL (compat=0):',
                expect.stringContaining('X-Plex-Token=REDACTED')
            );
            expect(warnSpy.mock.calls.some((call) =>
                typeof call[1] === 'string' && call[1].includes('X-Plex-Token=mock-token')
            )).toBe(false);
            warnSpy.mockRestore();
        });

        it('should respect bitrate limits', () => {
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            const url = resolver.getTranscodeUrl('12345', { maxBitrate: 4000 });

            expect(url).toContain('maxVideoBitrate=4000');
        });

        it('should use default bitrate when not specified', () => {
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            const url = resolver.getTranscodeUrl('12345', {});

            expect(url).toContain('maxVideoBitrate=20000');
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
            resolver.on('error', errorHandler);

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

            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                text: async () =>
                    '<MediaContainer decisionCode="1000" decisionText="Transcode"><TranscodeSession videoDecision="copy" audioDecision="transcode" subtitleDecision="none" /></MediaContainer>',
            });

            const result = await resolver.fetchUniversalTranscodeDecision('12345', { sessionId: 'sess-1', maxBitrate: 20000 });

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

        it('logs a warning with session context when stopTranscodeSession fails', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            const config = createMockConfig();
            const resolver = new PlexStreamResolver(config);

            mockFetch.mockRejectedValueOnce(new Error('network down'));

            await resolver.stopTranscodeSession('sess-1');

            expect(warnSpy).toHaveBeenCalledWith(
                'stopTranscodeSession failed:',
                expect.objectContaining({
                    sessionId: 'sess-1',
                    error: expect.anything(),
                })
            );
        });
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
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
            const config = createMockConfig({
                getItem: jest.fn().mockResolvedValue(mockItem),
                getServerUri: () => 'http://192.168.1.100:32400',
                getHttpsConnection: () => null,
                getRelayConnection: () => ({ uri: 'https://relay.plex.direct:32400' }),
            });
            const resolver = new PlexStreamResolver(config);

            const decision = await resolver.resolveStream({ itemKey: '12345' });

            expect(decision.playbackUrl).toContain('https://relay.plex.direct');
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                'Using Plex relay due to mixed content restrictions'
            );
            consoleWarnSpy.mockRestore();
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
    });
});

describe('generatePlexSessionId', () => {
    const originalCrypto = globalThis.crypto;

    afterEach(() => {
        Object.defineProperty(globalThis, 'crypto', {
            configurable: true,
            value: originalCrypto,
        });
    });

    it('uses crypto.randomUUID when available', () => {
        const randomUUID = jest.fn(() => 'uuid-from-crypto');
        Object.defineProperty(globalThis, 'crypto', {
            configurable: true,
            value: { randomUUID },
        });

        expect(generatePlexSessionId()).toBe('uuid-from-crypto');
        expect(randomUUID).toHaveBeenCalledTimes(1);
    });

    it('falls back to a UUID-like value when crypto.randomUUID is unavailable', () => {
        Object.defineProperty(globalThis, 'crypto', {
            configurable: true,
            value: {},
        });

        expect(generatePlexSessionId()).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        );
    });
});
