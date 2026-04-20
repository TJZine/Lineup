import { buildBaseMediaItem } from '../mediaItemBaseParser';
import { parseMediaItem } from '../mediaItemCoreParser';
import { applyMediaItemDetails, toPlexDate } from '../mediaItemDetailsParser';
import { parseMediaItems } from '../mediaItemParser';
import { PlexLibraryError } from '../PlexLibraryError';
import { mapMediaType } from '../mediaTypeParser';
import type { RawMediaItem } from '../types';

describe('media item internals', () => {
    it('maps supported Plex media types and defaults unknown types to movie', () => {
        expect(mapMediaType('show')).toBe('show');
        expect(mapMediaType('mystery')).toBe('movie');
    });

    it('builds the base media item shape', () => {
        const item = buildBaseMediaItem({
            ratingKey: 'item-1',
            key: '/library/metadata/item-1',
            type: 'movie',
            title: 'Item One',
            titleSort: 'Item One Sort',
            addedAt: 1704067200,
            updatedAt: 1704153600,
        } as RawMediaItem);

        expect(item).toMatchObject({
            ratingKey: 'item-1',
            sortTitle: 'Item One Sort',
            type: 'movie',
        });
        expect(item.addedAt.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    });

    it('applies optional media details without overwriting absent fields', () => {
        const item = buildBaseMediaItem({
            ratingKey: 'episode-1',
            key: '/library/metadata/episode-1',
            type: 'episode',
            title: 'Episode',
        } as RawMediaItem);

        applyMediaItemDetails(item, {
            ratingKey: 'episode-1',
            key: '/library/metadata/episode-1',
            type: 'episode',
            title: 'Episode',
            parentIndex: 2,
            index: 7,
            Director: [{ tag: 'Director One' }],
            Studio: [{ tag: 'Studio One' }],
        } as RawMediaItem);

        expect(item.seasonNumber).toBe(2);
        expect(item.episodeNumber).toBe(7);
        expect(item.directors).toEqual(['Director One']);
        expect(item.studios).toEqual(['Studio One']);
    });

    it('parses a full media item through the core parser', () => {
        const item = parseMediaItem({
            ratingKey: 'movie-1',
            key: '/library/metadata/movie-1',
            type: 'movie',
            title: 'Movie',
            Media: [{ id: 'm1', duration: 1, bitrate: 1, width: 1, height: 1, aspectRatio: 1, videoCodec: 'h264', audioCodec: 'aac', audioChannels: 2, container: 'mp4', videoResolution: 'sd' }],
        } as RawMediaItem);

        expect(item.title).toBe('Movie');
        expect(item.media).toHaveLength(1);
    });

    it('throws a typed parse error when nested media arrays are malformed', () => {
        expect(() =>
            parseMediaItem({
                ratingKey: 'movie-1',
                key: '/library/metadata/movie-1',
                type: 'movie',
                title: 'Movie',
                Media: {} as never,
            } as RawMediaItem)
        ).toThrow(PlexLibraryError);
    });

    it('throws a typed parse error when a media item entry is malformed', () => {
        expect(() => parseMediaItems([null])).toThrow(PlexLibraryError);
    });

    it('throws a typed parse error when nested role arrays are malformed', () => {
        const item = buildBaseMediaItem({
            ratingKey: 'episode-1',
            key: '/library/metadata/episode-1',
            type: 'episode',
            title: 'Episode',
        } as RawMediaItem);

        expect(() =>
            applyMediaItemDetails(item, {
                ratingKey: 'episode-1',
                key: '/library/metadata/episode-1',
                type: 'episode',
                title: 'Episode',
                Role: {} as never,
            } as RawMediaItem)
        ).toThrow(PlexLibraryError);
    });

    it('normalizes whitespace-only actor roles to null', () => {
        const item = buildBaseMediaItem({
            ratingKey: 'episode-1',
            key: '/library/metadata/episode-1',
            type: 'episode',
            title: 'Episode',
        } as RawMediaItem);

        applyMediaItemDetails(item, {
            ratingKey: 'episode-1',
            key: '/library/metadata/episode-1',
            type: 'episode',
            title: 'Episode',
            Role: [{ tag: 'Actor One', role: '   ', thumb: '/actor/thumb' }],
        } as RawMediaItem);

        expect(item.actorRoles).toEqual([{ name: 'Actor One', role: null, thumb: '/actor/thumb' }]);
    });

    it('throws a typed parse error when nested tag entries are malformed', () => {
        const item = buildBaseMediaItem({
            ratingKey: 'episode-1',
            key: '/library/metadata/episode-1',
            type: 'episode',
            title: 'Episode',
        } as RawMediaItem);

        expect(() =>
            applyMediaItemDetails(item, {
                ratingKey: 'episode-1',
                key: '/library/metadata/episode-1',
                type: 'episode',
                title: 'Episode',
                Director: [null] as never,
            } as RawMediaItem)
        ).toThrow(PlexLibraryError);
    });

    it('converts Plex timestamps into Date instances', () => {
        expect(toPlexDate(1704067200).toISOString()).toBe('2024-01-01T00:00:00.000Z');
        expect(toPlexDate(undefined).toISOString()).toBe('1970-01-01T00:00:00.000Z');
    });

    it('falls back to the Unix epoch for invalid Plex timestamps', () => {
        expect(toPlexDate(Number.NaN).toISOString()).toBe('1970-01-01T00:00:00.000Z');
        expect(toPlexDate(Number.POSITIVE_INFINITY).toISOString()).toBe('1970-01-01T00:00:00.000Z');
        expect(toPlexDate(Number.NEGATIVE_INFINITY).toISOString()).toBe('1970-01-01T00:00:00.000Z');
        expect(toPlexDate(Number.MAX_VALUE).toISOString()).toBe('1970-01-01T00:00:00.000Z');
    });
});
