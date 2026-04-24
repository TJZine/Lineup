import { parseMediaItem } from '../parsing/mediaItemParser';
import type { RawMediaItem } from '../types';

describe('mediaItemParser', () => {
    it('normalizes codecs, containers, and timestamps', () => {
        const item = parseMediaItem({
            ratingKey: 'movie-1',
            key: '/library/metadata/movie-1',
            type: 'movie',
            title: 'Movie',
            addedAt: 1704067200,
            updatedAt: 1704153600,
            lastViewedAt: 1704240000,
            Media: [
                {
                    id: 9,
                    videoCodec: 'HEVC',
                    audioCodec: 'TRUEHD',
                    container: 'MKV',
                    Part: [
                        {
                            id: 12,
                            key: '/library/parts/12',
                            Stream: [{ id: 1, streamType: 1, codec: 'hevc' }],
                        },
                    ],
                },
            ],
        } as unknown as RawMediaItem);

        expect(item.addedAt.toISOString()).toBe('2024-01-01T00:00:00.000Z');
        expect(item.updatedAt.toISOString()).toBe('2024-01-02T00:00:00.000Z');
        expect(item.lastViewedAt?.toISOString()).toBe('2024-01-03T00:00:00.000Z');
        expect(item.media[0]).toMatchObject({
            videoCodec: 'hevc',
            audioCodec: 'truehd',
            container: 'mkv',
        });
        expect(item.media[0]?.parts[0]?.streams[0]?.streamType).toBe(1);
    });

    it('omits invalid optional Plex timestamps instead of synthesizing the Unix epoch', () => {
        const nanItem = parseMediaItem({
            ratingKey: 'movie-2',
            key: '/library/metadata/movie-2',
            type: 'movie',
            title: 'Movie 2',
            addedAt: 1704067200,
            updatedAt: 1704153600,
            lastViewedAt: Number.NaN,
            Media: [],
        } as unknown as RawMediaItem);

        const overflowItem = parseMediaItem({
            ratingKey: 'movie-3',
            key: '/library/metadata/movie-3',
            type: 'movie',
            title: 'Movie 3',
            addedAt: 1704067200,
            updatedAt: 1704153600,
            lastViewedAt: Number.MAX_VALUE,
            Media: [],
        } as unknown as RawMediaItem);

        expect(nanItem.addedAt.toISOString()).toBe('2024-01-01T00:00:00.000Z');
        expect(nanItem.updatedAt.toISOString()).toBe('2024-01-02T00:00:00.000Z');
        expect(nanItem.lastViewedAt).toBeUndefined();
        expect(overflowItem.lastViewedAt).toBeUndefined();
    });
});
