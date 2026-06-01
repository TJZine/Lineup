/**
 * @fileoverview Unit tests for playback compatibility policy.
 */

import type { PlexMediaFile, PlexStream } from '../contracts/types';
import {
    detectHdrLabel,
    extractHdrLabelFromPlexMedia,
} from '../policy/hdr';
import {
    getDirectPlayDecision,
    getHdrCompatibilityDecision,
    isTrueHdCodec,
    selectCompatibleAudioTrack,
    shouldForceTranscodeAudioStreamId,
} from '../policy/playbackCompatibilityPolicy';
import {
    createPlaybackCapabilityProfile,
    type DolbyVisionDecoderProfile,
    type PlaybackCapabilityProfile,
} from '../capabilities/PlaybackCapabilityProfile';

function createPolicyMedia(overrides: {
    container?: string;
    videoCodec?: string;
    audioCodec?: string;
    width?: number;
    height?: number;
} = {}): PlexMediaFile {
    const {
        container = 'mp4',
        videoCodec = 'h264',
        audioCodec = 'aac',
        width = 1920,
        height = 1080,
    } = overrides;

    return {
        id: 'media-1',
        duration: 120000,
        bitrate: 4000,
        width,
        height,
        aspectRatio: width / height,
        videoCodec,
        audioCodec,
        audioChannels: 2,
        container,
        videoResolution: '1080',
        parts: [
            {
                id: 'part-1',
                key: '/library/parts/part-1/file.mp4',
                duration: 120000,
                file: '/path/file.mp4',
                size: 1000000,
                container,
                streams: [
                    {
                        id: 'video-1',
                        streamType: 1,
                        codec: videoCodec,
                    },
                    {
                        id: 'audio-1',
                        streamType: 2,
                        codec: audioCodec,
                        default: true,
                        language: 'English',
                        languageCode: 'en',
                    },
                ],
            },
        ],
    };
}

function createAudioTrack(id: string, codec: string, options: {
    isDefault?: boolean;
    languageCode?: string;
    title?: string;
} = {}): PlexStream {
    const title = options.title;

    return {
        id,
        streamType: 2,
        codec,
        default: options.isDefault ?? false,
        languageCode: options.languageCode ?? 'en',
        language: options.languageCode ?? 'en',
        ...(typeof title === 'string' ? { title } : {}),
    };
}

function createCapabilityProfile(options: {
    is4K?: boolean;
    dtsPassthroughEnabled?: boolean;
    chromeMajor?: number | null;
    userAgent?: string | null;
    isWebOs?: boolean;
    canPlayMimeType?: (mime: string) => boolean;
    declaredDolbyVisionProfiles?: readonly DolbyVisionDecoderProfile[];
} = {}): PlaybackCapabilityProfile {
    const input = {
        is4K: options.is4K ?? true,
        canPlayMimeType: options.canPlayMimeType ?? ((): boolean => false),
        chromeMajor: options.chromeMajor ?? 108,
        isWebOs: options.isWebOs ?? true,
        dtsPassthroughEnabled: options.dtsPassthroughEnabled ?? true,
        userAgent: options.userAgent ??
            'Mozilla/5.0 (Web0S) AppleWebKit/537.36 Chrome/108.0.0.0 Safari/537.36',
    };

    return createPlaybackCapabilityProfile(options.declaredDolbyVisionProfiles
        ? { ...input, declaredDolbyVisionProfiles: options.declaredDolbyVisionProfiles }
        : input);
}

describe('playbackCompatibilityPolicy', () => {
    describe('getDirectPlayDecision', () => {
        it('blocks unsupported video codec', () => {
            const decision = getDirectPlayDecision({
                media: createPolicyMedia({ videoCodec: 'mpeg2' }),
                capabilityProfile: createCapabilityProfile(),
            });

            expect(decision.canDirect).toBe(false);
            expect(decision.reasons).toContain('unsupported_video_codec:mpeg2');
        });

        it('blocks unsupported container', () => {
            const decision = getDirectPlayDecision({
                media: createPolicyMedia({ container: 'avi' }),
                capabilityProfile: createCapabilityProfile(),
            });

            expect(decision.canDirect).toBe(false);
            expect(decision.reasons).toContain('unsupported_container:avi');
        });

        it('normalizes container and video codec casing before compatibility checks', () => {
            const decision = getDirectPlayDecision({
                media: createPolicyMedia({ container: ' MKV ', videoCodec: ' H264 ' }),
                capabilityProfile: createCapabilityProfile(),
            });

            expect(decision.canDirect).toBe(true);
            expect(decision.reasons).toEqual([]);
        });

        it('blocks TrueHD audio by default', () => {
            const decision = getDirectPlayDecision({
                media: createPolicyMedia({ audioCodec: 'truehd' }),
                capabilityProfile: createCapabilityProfile(),
            });

            expect(decision.canDirect).toBe(false);
            expect(decision.reasons).toContain('unsupported_audio_codec:truehd');
        });

        it('allows explicit EAC3 aliases', () => {
            const decision = getDirectPlayDecision({
                media: createPolicyMedia({ audioCodec: 'eac3-joc' }),
                capabilityProfile: createCapabilityProfile(),
            });

            expect(decision.canDirect).toBe(true);
            expect(decision.reasons).toEqual([]);
        });

        it('blocks malformed supported-prefix audio codecs', () => {
            const decision = getDirectPlayDecision({
                media: createPolicyMedia({ audioCodec: 'aac-bogus' }),
                capabilityProfile: createCapabilityProfile(),
            });

            expect(decision.canDirect).toBe(false);
            expect(decision.reasons).toContain('unsupported_audio_codec:aac-bogus');
        });

        it('blocks DTS when passthrough toggle is disabled', () => {
            const decision = getDirectPlayDecision({
                media: createPolicyMedia({ audioCodec: 'dts' }),
                capabilityProfile: createCapabilityProfile({ dtsPassthroughEnabled: false }),
            });

            expect(decision.canDirect).toBe(false);
            expect(decision.reasons).toContain('dts_passthrough_disabled');
        });

        it('blocks DTS-HD MA when passthrough toggle is disabled', () => {
            const decision = getDirectPlayDecision({
                media: createPolicyMedia({ audioCodec: 'dca-ma' }),
                capabilityProfile: createCapabilityProfile({ dtsPassthroughEnabled: false }),
            });

            expect(decision.canDirect).toBe(false);
            expect(decision.reasons).toContain('dts_passthrough_disabled');
        });

        it('allows DTS when passthrough is enabled', () => {
            const decision = getDirectPlayDecision({
                media: createPolicyMedia({ audioCodec: 'dts' }),
                capabilityProfile: createCapabilityProfile(),
            });

            expect(decision.canDirect).toBe(true);
            expect(decision.reasons).toEqual([]);
        });

        it('blocks malformed DTS-family prefixes even when passthrough is enabled', () => {
            const decision = getDirectPlayDecision({
                media: createPolicyMedia({ audioCodec: 'dtsbogus' }),
                capabilityProfile: createCapabilityProfile(),
            });

            expect(decision.canDirect).toBe(false);
            expect(decision.reasons).toContain('unsupported_audio_codec:dtsbogus');
        });

        it('normalizes audio codec casing and whitespace before compatibility checks', () => {
            const decision = getDirectPlayDecision({
                media: createPolicyMedia({ audioCodec: ' DTS ' }),
                capabilityProfile: createCapabilityProfile({ dtsPassthroughEnabled: false }),
            });

            expect(decision.canDirect).toBe(false);
            expect(decision.reasons).toContain('dts_passthrough_disabled');
        });

        it('blocks legacy webOS MKV when webOS Chromium is too old', () => {
            const decision = getDirectPlayDecision({
                media: createPolicyMedia({ container: 'mkv' }),
                capabilityProfile: createCapabilityProfile({ chromeMajor: 86, userAgent: 'Mozilla/5.0 (Web0S) AppleWebKit/537.36 Chrome/86.0.0.0 Safari/537.36' }),
            });

            expect(decision.canDirect).toBe(false);
            expect(decision.reasons).toContain('mkv_legacy_webos');
        });

        it('allows MKV on webOS with modern Chromium', () => {
            const decision = getDirectPlayDecision({
                media: createPolicyMedia({ container: 'mkv' }),
                capabilityProfile: createCapabilityProfile(),
            });

            expect(decision.canDirect).toBe(true);
            expect(decision.reasons).toEqual([]);
        });

        it('blocks over-4K resolutions', () => {
            const decision = getDirectPlayDecision({
                media: createPolicyMedia({ width: 5120, height: 2880 }),
                capabilityProfile: createCapabilityProfile(),
            });

            expect(decision.canDirect).toBe(false);
            expect(decision.reasons).toContain('unsupported_resolution:5120x2880');
        });

        it('blocks 4K direct play for non-4K capability profiles', () => {
            const decision = getDirectPlayDecision({
                media: createPolicyMedia({ width: 3840, height: 2160 }),
                capabilityProfile: createCapabilityProfile({ is4K: false }),
            });

            expect(decision.canDirect).toBe(false);
            expect(decision.reasons).toContain('unsupported_resolution:3840x2160');
        });

        it('blocks Profile 5 Dolby Vision without explicit DV decoder support', () => {
            const media = createPolicyMedia({ container: 'mkv', videoCodec: 'hevc' });
            const videoStream = media.parts[0]!.streams[0]!;
            videoStream.displayTitle = 'Dolby Vision';
            videoStream.doviPresent = true;
            videoStream.doviProfile = '5';

            const decision = getDirectPlayDecision({
                media,
                videoStream,
                capabilityProfile: createCapabilityProfile(),
            });

            expect(decision.canDirect).toBe(false);
            expect(decision.reasons).toContain('unknown_dolby_vision_support:dvhe.05');
        });

        it('allows Profile 5 Dolby Vision when explicit matching DV decoder support exists', () => {
            const media = createPolicyMedia({ container: 'mkv', videoCodec: 'hevc' });
            const videoStream = media.parts[0]!.streams[0]!;
            videoStream.displayTitle = 'Dolby Vision';
            videoStream.doviPresent = true;
            videoStream.doviProfile = '5';

            const decision = getDirectPlayDecision({
                media,
                videoStream,
                capabilityProfile: createCapabilityProfile({
                    declaredDolbyVisionProfiles: ['dvhe.05'],
                }),
            });

            expect(decision.canDirect).toBe(true);
            expect(decision.reasons).toEqual([]);
        });
    });

    describe('audio compatibility', () => {
        it('respects explicit requested audio track IDs', () => {
            const stream = createPolicyMedia();
            stream.parts[0]!.streams.push(
                createAudioTrack('audio-direct', 'ac3', { isDefault: true, languageCode: 'en' }),
                createAudioTrack('audio-fallback', 'eac3', { languageCode: 'fr' })
            );

            const selected = selectCompatibleAudioTrack(stream.parts[0]!.streams, 'audio-fallback');

            expect(selected?.id).toBe('audio-fallback');
        });

        it('prefers default audio when it is not TrueHD', () => {
            const stream = createPolicyMedia();
            stream.parts[0]!.streams = [
                stream.parts[0]!.streams[0]!,
                createAudioTrack('audio-default', 'ac3', { isDefault: true, languageCode: 'fr' }),
                createAudioTrack('audio-fallback', 'aac'),
            ];

            const selected = selectCompatibleAudioTrack(stream.parts[0]!.streams);

            expect(selected?.id).toBe('audio-default');
        });

        it('selects EAC3/AC3/AAC fallback for TrueHD defaults with same-language preference', () => {
            const stream = createPolicyMedia({ audioCodec: 'truehd' });
            stream.parts[0]!.streams = [
                stream.parts[0]!.streams[0]!,
                createAudioTrack('audio-default', 'truehd', { isDefault: true, languageCode: 'en' }),
                createAudioTrack('audio-commentary', 'eac3', { languageCode: 'en', title: 'commentary track' }),
                createAudioTrack('audio-ac3', 'ac3', { languageCode: 'en' }),
                createAudioTrack('audio-eac3', 'eac3', { languageCode: 'fr' }),
                createAudioTrack('audio-aac', 'aac', { languageCode: 'en' }),
            ];

            const selected = selectCompatibleAudioTrack(stream.parts[0]!.streams);

            expect(selected?.id).toBe('audio-ac3');
        });

        it('avoids commentary-only fallback tracks when no other compatible option exists', () => {
            const stream = createPolicyMedia({ audioCodec: 'truehd' });
            stream.parts[0]!.streams = [
                stream.parts[0]!.streams[0]!,
                createAudioTrack('audio-default', 'truehd', { isDefault: true, languageCode: 'en' }),
                createAudioTrack('audio-commentary', 'eac3', { languageCode: 'en', title: 'Director commentary' }),
            ];

            const selected = selectCompatibleAudioTrack(stream.parts[0]!.streams);

            expect(selected?.id).toBe('audio-default');
        });

        it('forces transcode audioStreamID for explicit or TrueHD defaults', () => {
            const fallback: PlexStream[] = [
                {
                    id: 'audio-default',
                    streamType: 2,
                    codec: 'truehd',
                    default: true,
                    language: 'English',
                    languageCode: 'en',
                },
                {
                    id: 'audio-fallback',
                    streamType: 2,
                    codec: 'ac3',
                    language: 'English',
                    languageCode: 'en',
                },
            ];

            expect(shouldForceTranscodeAudioStreamId(fallback, 'audio-fallback')).toBe(true);
            expect(shouldForceTranscodeAudioStreamId(fallback)).toBe(true);
        });

        it('does not force transcode when default audio is already decodable', () => {
            const fallback: PlexStream[] = [
                {
                    id: 'audio-default',
                    streamType: 2,
                    codec: 'aac',
                    default: true,
                    language: 'English',
                    languageCode: 'en',
                },
            ];

            expect(shouldForceTranscodeAudioStreamId(fallback)).toBe(false);
        });

        it('classifies TrueHD codec aliases correctly', () => {
            expect(isTrueHdCodec('TrueHD')).toBe(true);
            expect(isTrueHdCodec('mlp')).toBe(true);
            expect(isTrueHdCodec('ac3')).toBe(false);
        });
    });

    describe('hdr helpers', () => {
        it('prefers explicit hdr labels before fallback detection', () => {
            expect(
                extractHdrLabelFromPlexMedia({
                    media: [
                        {
                            parts: [
                                {
                                    streams: [
                                        {
                                            streamType: 1,
                                            hdr: 'HDR10+',
                                            title: 'Dolby Vision',
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                })
            ).toBe('HDR10+');
        });

        it('detects Dolby Vision from dovi metadata', () => {
            expect(
                detectHdrLabel({
                    displayTitle: '4K Remux',
                    doviPresent: true,
                })
            ).toBe('Dolby Vision');
        });
    });

    describe('HDR compatibility', () => {
        function createDolbyVisionMedia(
            container: string,
            doviProfile: string,
            options: {
                aspectRatio?: number;
                width?: number;
                height?: number;
                displayTitle?: string;
            } = {}
        ): PlexMediaFile {
            const width = options.width ?? (options.aspectRatio ? Math.round(1920 * options.aspectRatio) : 1920);
            const height = options.height ?? 1080;
            const media = createPolicyMedia({ container, width, height });

            media.parts[0]!.streams[0] = {
                id: 'video-1',
                streamType: 1,
                codec: media.videoCodec,
                displayTitle: options.displayTitle ?? 'Dolby Vision HDR',
                doviProfile,
            };

            return media;
        }

        it('forces HLS and transcoding for force mode DV MKV with HDR10 base layer', () => {
            const media = createDolbyVisionMedia('mkv', '8.1');
            const decision = getHdrCompatibilityDecision({
                media,
                videoStream: media.parts[0]!.streams[0]!,
                hdr10FallbackMode: 'force',
            });

            expect(decision.isDolbyVision).toBe(true);
            expect(decision.applyHdr10Fallback).toBe(true);
            expect(decision.forceTranscodeForHdr10Fallback).toBe(true);
            expect(decision.fallbackReason).toBe('force');
        });

        it('does not apply HDR10 fallback in force mode to non-MKV content', () => {
            const media = createDolbyVisionMedia('mp4', '8.1');
            const decision = getHdrCompatibilityDecision({
                media,
                videoStream: media.parts[0]!.streams[0]!,
                hdr10FallbackMode: 'force',
            });

            expect(decision.applyHdr10Fallback).toBe(false);
            expect(decision.forceTranscodeForHdr10Fallback).toBe(false);
            expect(decision.fallbackReason).toBe('none');
        });

        it('applies smart HDR10 fallback for DV MKV with HDR10 base layer', () => {
            const media = createDolbyVisionMedia('mkv', '8.1', { aspectRatio: 1.78, width: 1920, height: 1080 });
            const decision = getHdrCompatibilityDecision({
                media,
                videoStream: media.parts[0]!.streams[0]!,
                hdr10FallbackMode: 'smart',
            });

            expect(decision.isDolbyVision).toBe(true);
            expect(decision.applyHdr10Fallback).toBe(true);
            expect(decision.forceTranscodeForHdr10Fallback).toBe(false);
            expect(decision.fallbackReason).toBe('smart');
        });

        it('normalizes whitespace-padded MKV container values before applying smart HDR10 fallback', () => {
            const media = createDolbyVisionMedia(' MKV ', '8.1', { aspectRatio: 1.78, width: 1920, height: 1080 });
            const decision = getHdrCompatibilityDecision({
                media,
                videoStream: media.parts[0]!.streams[0]!,
                hdr10FallbackMode: 'smart',
            });

            expect(decision.applyHdr10Fallback).toBe(true);
            expect(decision.forceTranscodeForHdr10Fallback).toBe(false);
            expect(decision.fallbackReason).toBe('smart');
        });

        it('does not apply smart HDR10 fallback for DV MKV without HDR10 base layer', () => {
            const media = createDolbyVisionMedia('mkv', '5', { aspectRatio: 1.78, width: 1920, height: 1080 });
            const decision = getHdrCompatibilityDecision({
                media,
                videoStream: media.parts[0]!.streams[0]!,
                hdr10FallbackMode: 'smart',
            });

            expect(decision.applyHdr10Fallback).toBe(false);
            expect(decision.forceTranscodeForHdr10Fallback).toBe(false);
            expect(decision.fallbackReason).toBe('none');
        });

        it('does not force HLS when Dolby Vision MKV has no HDR10 base layer', () => {
            const media = createDolbyVisionMedia('mkv', '5');
            const decision = getHdrCompatibilityDecision({
                media,
                videoStream: media.parts[0]!.streams[0]!,
                hdr10FallbackMode: 'off',
            });

            expect(decision.applyHdr10Fallback).toBe(false);
            expect(decision.fallbackReason).toBe('none');
        });

        it('does not apply force HDR10 fallback to MKV without HDR10 base layer', () => {
            const media = createDolbyVisionMedia(' MKV ', '5');
            const decision = getHdrCompatibilityDecision({
                media,
                videoStream: media.parts[0]!.streams[0]!,
                hdr10FallbackMode: 'force',
            });

            expect(decision.forceTranscodeForHdr10Fallback).toBe(false);
            expect(decision.applyHdr10Fallback).toBe(false);
            expect(decision.fallbackReason).toBe('none');
        });
    });
});
