/**
 * @fileoverview Unit tests for ResponseParser.
 * @module modules/plex/library/__tests__/ResponseParser.test
 */

import {
    parseLibrarySections,
    parseMediaItem,
    parseSeasons,
    parseCollections,
    parsePlaylists,
    parseDirectoryTags,
    mapLibraryType,
    mapMediaType,
    parseStream,
} from '../ResponseParser';
import { PlexLibraryErrorCode } from '../types';
import type {
    RawLibrarySection,
    RawMediaItem,
    RawSeason,
    RawCollection,
    RawPlaylist,
    RawDirectoryTag,
    RawStream,
} from '../types';

describe('ResponseParser', () => {
    describe('parseLibrarySections', () => {
        it('should parse library sections correctly', () => {
            const raw: RawLibrarySection[] = [
                {
                    key: '1',
                    uuid: 'lib-uuid-1',
                    title: 'Movies',
                    type: 'movie',
                    agent: 'com.plexapp.agents.imdb',
                    scanner: 'Plex Movie Scanner',
                    art: '/art/path',
                    thumb: '/thumb/path',
                    scannedAt: 1704067200,
                },
            ];

            const result = parseLibrarySections(raw);

            expect(result).toHaveLength(1);
            expect(result[0]!.id).toBe('1');
            expect(result[0]!.uuid).toBe('lib-uuid-1');
            expect(result[0]!.title).toBe('Movies');
            expect(result[0]!.type).toBe('movie');
            expect(result[0]!.agent).toBe('com.plexapp.agents.imdb');
            expect(result[0]!.scanner).toBe('Plex Movie Scanner');
            expect(result[0]!.art).toBe('/art/path');
            expect(result[0]!.thumb).toBe('/thumb/path');
        });

        it('requires callers to pass a validated library section array', () => {
            expect(() => parseLibrarySections(null as unknown as RawLibrarySection[])).toThrow();
            expect(() => parseLibrarySections(undefined as unknown as RawLibrarySection[])).toThrow();
        });

        it('should handle missing optional fields', () => {
            const raw: RawLibrarySection[] = [
                {
                    key: '1',
                    uuid: 'lib-uuid',
                    title: 'Test',
                    type: 'movie',
                    agent: 'agent',
                    scanner: 'scanner',
                },
            ];

            const result = parseLibrarySections(raw);

            expect(result[0]!.art).toBeNull();
            expect(result[0]!.thumb).toBeNull();
        });

        it('preserves an explicit zero scannedAt epoch', () => {
            const result = parseLibrarySections([
                {
                    key: '1',
                    uuid: 'lib-uuid',
                    title: 'Epoch',
                    type: 'movie',
                    agent: 'agent',
                    scanner: 'scanner',
                    scannedAt: 0,
                },
            ]);

            expect(result[0]!.lastScannedAt.toISOString()).toBe('1970-01-01T00:00:00.000Z');
        });

        it('throws a typed parse error with indexed context when a section entry is malformed', () => {
            expect(() => parseLibrarySections([null] as unknown as RawLibrarySection[])).toThrow(
                expect.objectContaining({
                    code: PlexLibraryErrorCode.PARSE_ERROR,
                    message: 'Invalid library sections[0] payload: expected an object',
                })
            );
        });

        it('throws a typed parse error for unknown library section types', () => {
            expect(() =>
                parseLibrarySections([
                    {
                        key: '1',
                        uuid: 'lib-uuid',
                        title: 'Mystery',
                        type: 'mystery',
                        agent: 'agent',
                        scanner: 'scanner',
                    },
                ])
            ).toThrow(
                expect.objectContaining({
                    code: PlexLibraryErrorCode.PARSE_ERROR,
                    message: 'Invalid library section payload: unknown library type "mystery"',
                })
            );
        });
    });

    describe('parseMediaItem', () => {
        it('should parse all media item fields', () => {
            const raw: RawMediaItem = {
                ratingKey: '12345',
                key: '/library/metadata/12345',
                type: 'movie',
                title: 'Test Movie',
                originalTitle: 'Original Title',
                titleSort: 'Test Movie Sort',
                summary: 'A summary',
                year: 2023,
                duration: 7200000,
                addedAt: 1704067200,
                updatedAt: 1704153600,
                thumb: '/thumb',
                art: '/art',
                banner: '/banner',
                rating: 8.5,
                audienceRating: 9.0,
                contentRating: 'PG-13',
                Genre: [{ id: 1, tag: 'Action' }],
                Director: [{ id: 2, tag: 'Director One' }],
                Role: [{ id: 3, tag: 'Actor One', role: 'Lead', thumb: '/actor/thumb' }],
                Studio: [{ id: 4, tag: 'Studio One' }],
                viewOffset: 1000,
                viewCount: 2,
                lastViewedAt: 1704240000,
            };

            const result = parseMediaItem(raw);

            expect(result.ratingKey).toBe('12345');
            expect(result.key).toBe('/library/metadata/12345');
            expect(result.type).toBe('movie');
            expect(result.title).toBe('Test Movie');
            expect(result.originalTitle).toBe('Original Title');
            expect(result.sortTitle).toBe('Test Movie Sort');
            expect(result.summary).toBe('A summary');
            expect(result.year).toBe(2023);
            expect(result.durationMs).toBe(7200000);
            expect(result.thumb).toBe('/thumb');
            expect(result.art).toBe('/art');
            expect(result.banner).toBe('/banner');
            expect(result.rating).toBe(8.5);
            expect(result.audienceRating).toBe(9.0);
            expect(result.contentRating).toBe('PG-13');
            expect(result.genres).toEqual(['Action']);
            expect(result.directors).toEqual(['Director One']);
            expect(result.actors).toEqual(['Actor One']);
            expect(result.actorRoles).toEqual([{ name: 'Actor One', role: 'Lead', thumb: '/actor/thumb' }]);
            expect(result.studios).toEqual(['Studio One']);
            expect(result.viewOffset).toBe(1000);
            expect(result.viewCount).toBe(2);
        });

        it('should parse clearLogo from Image array when present', () => {
            const raw = {
                ratingKey: 'rk-clearlogo',
                key: '/library/metadata/rk-clearlogo',
                type: 'movie',
                title: 'Logo Movie',
                Image: [
                    { type: 'clearArt', url: '/clearart.png' },
                    { type: 'clearLogo', url: '/clearlogo.png' },
                ],
            } as unknown as RawMediaItem;

            const result = parseMediaItem(raw);
            expect(result.clearLogo).toBe('/clearlogo.png');
        });

        it('should not set clearLogo when Image clearLogo url is empty string', () => {
            const raw = {
                ratingKey: 'rk-clearlogo-empty',
                key: '/library/metadata/rk-clearlogo-empty',
                type: 'movie',
                title: 'Empty Logo Movie',
                Image: [{ type: 'clearLogo', url: '' }],
            } as unknown as RawMediaItem;

            const result = parseMediaItem(raw);
            expect(result.clearLogo).toBeUndefined();
        });

        it('should not set clearLogo when Image clearLogo url is missing', () => {
            const raw = {
                ratingKey: 'rk-clearlogo-missing',
                key: '/library/metadata/rk-clearlogo-missing',
                type: 'movie',
                title: 'Missing Logo Movie',
                Image: [{ type: 'clearLogo' }],
            } as unknown as RawMediaItem;

            const result = parseMediaItem(raw);
            expect(result.clearLogo).toBeUndefined();
        });

        it('should not set clearLogo when Image has no clearLogo entry', () => {
            const raw = {
                ratingKey: 'rk-clearlogo-absent',
                key: '/library/metadata/rk-clearlogo-absent',
                type: 'movie',
                title: 'No ClearLogo Movie',
                Image: [{ type: 'clearArt', url: '/clearart.png' }],
            } as unknown as RawMediaItem;

            const result = parseMediaItem(raw);
            expect(result.clearLogo).toBeUndefined();
        });

        it('should not throw when Image is malformed', () => {
            const raw = {
                ratingKey: 'rk-malformed-image',
                key: '/library/metadata/rk-malformed-image',
                type: 'movie',
                title: 'Malformed Image Movie',
                Image: 'oops',
            } as unknown as RawMediaItem;

            const result = parseMediaItem(raw);
            expect(result.clearLogo).toBeUndefined();
        });

        it('should handle TV episode fields', () => {
            const raw: RawMediaItem = {
                ratingKey: 'e1',
                key: '/library/metadata/e1',
                type: 'episode',
                title: 'Episode Title',
                grandparentTitle: 'Show Name',
                grandparentThumb: '/show/thumb',
                parentThumb: '/season/thumb',
                parentTitle: 'Season 1',
                parentIndex: 1,
                index: 5,
                duration: 2700000,
            };

            const result = parseMediaItem(raw);

            expect(result.type).toBe('episode');
            expect(result.grandparentTitle).toBe('Show Name');
            expect(result.grandparentThumb).toBe('/show/thumb');
            expect(result.parentThumb).toBe('/season/thumb');
            expect(result.parentTitle).toBe('Season 1');
            expect(result.seasonNumber).toBe(1);
            expect(result.episodeNumber).toBe(5);
        });

        it('should default missing optional fields', () => {
            const raw: RawMediaItem = {
                ratingKey: '1',
                key: '/key',
                type: 'movie',
                title: 'Title',
            };

            const result = parseMediaItem(raw);

            expect(result.sortTitle).toBe('Title');
            expect(result.summary).toBe('');
            expect(result.year).toBe(0);
            expect(result.durationMs).toBe(0);
            expect(result.thumb).toBeNull();
            expect(result.art).toBeNull();
            expect(result.viewOffset).toBe(0);
            expect(result.viewCount).toBe(0);
            expect(result.media).toEqual([]);
        });
    });

    describe('parseSeasons', () => {
        it('should parse seasons correctly', () => {
            const raw: RawSeason[] = [
                {
                    ratingKey: 's1',
                    key: '/library/metadata/s1/children',
                    title: 'Season 1',
                    index: 1,
                    leafCount: 10,
                    viewedLeafCount: 5,
                    thumb: '/s1/thumb',
                },
            ];

            const result = parseSeasons(raw);

            expect(result).toHaveLength(1);
            expect(result[0]!.ratingKey).toBe('s1');
            expect(result[0]!.title).toBe('Season 1');
            expect(result[0]!.index).toBe(1);
            expect(result[0]!.leafCount).toBe(10);
            expect(result[0]!.viewedLeafCount).toBe(5);
            expect(result[0]!.thumb).toBe('/s1/thumb');
        });

        it('should handle missing optional fields', () => {
            const raw: RawSeason[] = [
                {
                    ratingKey: 's1',
                    key: '/key',
                    title: 'Season 1',
                    index: 1,
                    leafCount: 10,
                    viewedLeafCount: 0,
                },
            ];

            const result = parseSeasons(raw);

            expect(result[0]!.thumb).toBeNull();
        });
    });

    describe('parseCollections', () => {
        it('should parse collections correctly', () => {
            const raw: RawCollection[] = [
                {
                    ratingKey: 'c1',
                    key: '/library/collections/c1',
                    title: 'Marvel',
                    thumb: '/c1/thumb',
                    childCount: 25,
                },
            ];

            const result = parseCollections(raw);

            expect(result).toHaveLength(1);
            expect(result[0]!.ratingKey).toBe('c1');
            expect(result[0]!.title).toBe('Marvel');
            expect(result[0]!.childCount).toBe(25);
            expect(result[0]!.thumb).toBe('/c1/thumb');
        });
    });

    describe('parseStream', () => {
        it('should parse display and extended titles', () => {
            const raw: RawStream = {
                id: '1',
                streamType: 1,
                codec: 'hevc',
                displayTitle: 'HDR10',
                extendedDisplayTitle: 'HDR10 (SMPTE2084)',
            };

            const result = parseStream(raw);

            expect(result.displayTitle).toBe('HDR10');
            expect(result.extendedDisplayTitle).toBe('HDR10 (SMPTE2084)');
        });

        it('should parse DOVI profile and present flags', () => {
            const raw: RawStream = {
                id: '1',
                streamType: 1,
                codec: 'hevc',
                DOVIProfile: '8.1',
                DOVIPresent: 'true',
            };

            const result = parseStream(raw);

            expect(result.doviProfile).toBe('8.1');
            expect(result.doviPresent).toBe(true);
        });

        it('should coerce numeric DOVIPresent', () => {
            const raw: RawStream = {
                id: '1',
                streamType: 1,
                codec: 'hevc',
                DOVIPresent: 0,
            };

            const result = parseStream(raw);

            expect(result.doviPresent).toBe(false);
        });
    });

    describe('parsePlaylists', () => {
        it('should parse playlists correctly', () => {
            const raw: RawPlaylist[] = [
                {
                    ratingKey: 'pl1',
                    key: '/playlists/pl1',
                    title: 'Favorites',
                    thumb: '/pl1/thumb',
                    duration: 36000000,
                    leafCount: 10,
                },
            ];

            const result = parsePlaylists(raw);

            expect(result).toHaveLength(1);
            expect(result[0]!.ratingKey).toBe('pl1');
            expect(result[0]!.title).toBe('Favorites');
            expect(result[0]!.duration).toBe(36000000);
            expect(result[0]!.leafCount).toBe(10);
        });
    });

    describe('parseDirectoryTags', () => {
        it('should parse directory tag entries correctly', () => {
            const raw: RawDirectoryTag[] = [
                { key: 'k1', title: 'Studio A', count: 42, fastKey: '/library/sections/1/studio?type=1&studio=Studio%20A', thumb: '/thumb/a' },
                { key: 'k2', title: 'Actor B' },
            ];

            const result = parseDirectoryTags(raw);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                key: 'k1',
                title: 'Studio A',
                count: 42,
                fastKey: '/library/sections/1/studio?type=1&studio=Studio%20A',
                thumb: '/thumb/a',
            });
            expect(result[1]).toEqual({
                key: 'k2',
                title: 'Actor B',
                count: null,
            });
            expect(result[1]).not.toHaveProperty('fastKey');
            expect(result[1]).not.toHaveProperty('thumb');
        });

        it('preserves unknown tag counts instead of coercing them to zero', () => {
            const raw: RawDirectoryTag[] = [
                { key: 'k1', title: 'Studio A' },
                { key: 'k2', title: 'Actor B', count: '12' as unknown as number },
            ];

            const result = parseDirectoryTags(raw);

            expect(result).toEqual([
                { key: 'k1', title: 'Studio A', count: null },
                { key: 'k2', title: 'Actor B', count: 12 },
            ]);
        });
    });

    describe('mapLibraryType', () => {
        it('should map known library types', () => {
            expect(mapLibraryType('movie')).toBe('movie');
            expect(mapLibraryType('show')).toBe('show');
            expect(mapLibraryType('artist')).toBe('artist');
            expect(mapLibraryType('photo')).toBe('photo');
        });

        it('throws typed parse errors for unknown library types', () => {
            expect(() => mapLibraryType('unknown')).toThrow(
                expect.objectContaining({
                    code: PlexLibraryErrorCode.PARSE_ERROR,
                    message: 'Invalid library section payload: unknown library type "unknown"',
                })
            );
            expect(() => mapLibraryType('')).toThrow(
                expect.objectContaining({
                    code: PlexLibraryErrorCode.PARSE_ERROR,
                    message: 'Invalid library section payload: unknown library type ""',
                })
            );
        });
    });

    describe('mapMediaType', () => {
        it('should map known media types', () => {
            expect(mapMediaType('movie')).toBe('movie');
            expect(mapMediaType('episode')).toBe('episode');
            expect(mapMediaType('track')).toBe('track');
            expect(mapMediaType('clip')).toBe('clip');
        });

        it('should default unknown types to movie', () => {
            expect(mapMediaType('unknown')).toBe('movie');
            expect(mapMediaType('')).toBe('movie');
        });
    });
});
