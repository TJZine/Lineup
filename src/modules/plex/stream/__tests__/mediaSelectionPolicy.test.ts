/**
 * @fileoverview Unit tests for media selection policy.
 */

import type { PlexMediaFile, PlexStream } from '../types';
import { selectBestMedia, selectBestMediaWithSubtitleStream } from '../mediaSelectionPolicy';

function createMediaPart(overrides: {
    id: string;
    container: string;
    width: number;
    height: number;
    bitrate: number;
    subtitleStreams?: PlexStream[];
}): PlexMediaFile {
    return {
        id: overrides.id,
        duration: 120000,
        bitrate: overrides.bitrate,
        width: overrides.width,
        height: overrides.height,
        aspectRatio: overrides.width / overrides.height,
        videoCodec: 'h264',
        audioCodec: 'aac',
        audioChannels: 2,
        container: overrides.container,
        videoResolution: '1080',
        parts: [
            {
                id: `part-${overrides.id}`,
                key: `/library/parts/${overrides.id}`,
                duration: 120000,
                file: `/path/${overrides.id}.mp4`,
                size: 1000000,
                container: overrides.container,
                streams: [
                    {
                        id: 'video-1',
                        streamType: 1,
                        codec: 'h264',
                    },
                    {
                        id: 'audio-1',
                        streamType: 2,
                        codec: 'aac',
                        default: true,
                        language: 'en',
                        languageCode: 'en',
                    },
                    ...(overrides.subtitleStreams ?? []),
                ],
            },
        ],
    };
}

describe('mediaSelectionPolicy', () => {
    it('selects the highest-resolution version when no bitrate cap applies', () => {
        const media = [
            createMediaPart({ id: 'low', container: 'mp4', width: 1280, height: 720, bitrate: 1200 }),
            createMediaPart({ id: 'hi', container: 'mp4', width: 1920, height: 1080, bitrate: 2500 }),
        ];

        const result = selectBestMedia(media);

        expect(result).not.toBeNull();
        expect(result!.media.id).toBe('hi');
        expect(result!.mediaIndex).toBe(1);
    });

    it('respects bitrate cap and ignores versions above cap while preserving resolution preference', () => {
        const media = [
            createMediaPart({ id: 'hi', container: 'mp4', width: 3840, height: 2160, bitrate: 8000 }),
            createMediaPart({ id: 'mid', container: 'mp4', width: 1920, height: 1080, bitrate: 2500 }),
            createMediaPart({ id: 'low', container: 'mp4', width: 1280, height: 720, bitrate: 1200 }),
        ];

        const result = selectBestMedia(media, 3000);

        expect(result).not.toBeNull();
        expect(result!.media.id).toBe('mid');
        expect(result!.mediaIndex).toBe(1);
    });

    it('falls back to the lowest bitrate when nothing fits the bitrate cap', () => {
        const media = [
            createMediaPart({ id: 'hi', container: 'mp4', width: 3840, height: 2160, bitrate: 9000 }),
            createMediaPart({ id: 'low', container: 'mp4', width: 1280, height: 720, bitrate: 3000 }),
            createMediaPart({ id: 'mid', container: 'mp4', width: 1920, height: 1080, bitrate: 6000 }),
        ];

        const result = selectBestMedia(media, 1000);

        expect(result).not.toBeNull();
        expect(result!.media.id).toBe('low');
        expect(result!.mediaIndex).toBe(1);
    });

    it('filters by subtitle stream id before choosing highest bitrate-compliant media', () => {
        const withSubtitle = createMediaPart({
            id: 'with-sub',
            container: 'mp4',
            width: 1920,
            height: 1080,
            bitrate: 4000,
            subtitleStreams: [
                { id: 'sub-1', streamType: 3, codec: 'srt' },
            ],
        });
        const withoutSubtitle = createMediaPart({ id: 'without-sub', container: 'mp4', width: 2560, height: 1440, bitrate: 3000 });
        const withSubtitleLow = createMediaPart({
            id: 'with-sub-low',
            container: 'mp4',
            width: 1280,
            height: 720,
            bitrate: 1200,
            subtitleStreams: [
                { id: 'sub-1', streamType: 3, codec: 'srt' },
            ],
        });
        const media = [withoutSubtitle, withSubtitle, withSubtitleLow];

        const result = selectBestMediaWithSubtitleStream(media, 'sub-1');

        expect(result).not.toBeNull();
        expect(result!.media.id).toBe('with-sub');
        expect(result!.mediaIndex).toBe(1);
    });

    it('returns null when no media matches subtitle id', () => {
        const media = [
            createMediaPart({ id: 'no-sub', container: 'mp4', width: 1920, height: 1080, bitrate: 2500 }),
        ];

        const result = selectBestMediaWithSubtitleStream(media, 'sub-1');

        expect(result).toBeNull();
    });

    it('detects subtitle streams in non-first media parts', () => {
        const multiPart: PlexMediaFile = {
            ...createMediaPart({ id: 'multi', container: 'mp4', width: 1920, height: 1080, bitrate: 4000 }),
            parts: [
                {
                    id: 'part-0',
                    key: '/library/parts/multi-0',
                    duration: 120000,
                    file: '/path/multi-0.mp4',
                    size: 1000000,
                    container: 'mp4',
                    streams: [
                        { id: 'video-0', streamType: 1, codec: 'h264' },
                        { id: 'audio-0', streamType: 2, codec: 'aac', default: true, language: 'en', languageCode: 'en' },
                    ],
                },
                {
                    id: 'part-1',
                    key: '/library/parts/multi-1',
                    duration: 120000,
                    file: '/path/multi-1.mp4',
                    size: 1000000,
                    container: 'mp4',
                    streams: [
                        { id: 'video-1', streamType: 1, codec: 'h264' },
                        { id: 'audio-1', streamType: 2, codec: 'aac', default: true, language: 'en', languageCode: 'en' },
                        { id: 'sub-1', streamType: 3, codec: 'srt' },
                    ],
                },
            ],
        };

        const media = [
            createMediaPart({ id: 'other', container: 'mp4', width: 1280, height: 720, bitrate: 1200 }),
            multiPart,
        ];

        const result = selectBestMediaWithSubtitleStream(media, 'sub-1');

        expect(result).not.toBeNull();
        expect(result!.media.id).toBe('multi');
        expect(result!.partIndex).toBe(1);
    });

    it('returns null for empty media list', () => {
        const result = selectBestMedia([]);

        expect(result).toBeNull();
    });
});
