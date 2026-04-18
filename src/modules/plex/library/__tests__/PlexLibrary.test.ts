import { AppErrorCode } from '../../../../types/app-errors';
import { PlexLibrary, PlexLibraryError, PlexLibraryErrorCode } from '../PlexLibrary';
import type { PlexLibraryConfig, PlexTagDirectoryQueryOptions } from '../interfaces';
import { mockLocalStorage, installMockLocalStorage } from '../../../../__tests__/mocks/localStorage';
import { PLEX_LIBRARY_CONSTANTS, PLEX_MEDIA_TYPES } from '../constants';
import {
    mockCollectionsResponse,
    mockConfig,
    mockFetchJson,
    mockFetchSequence,
    mockFetchTextResponse,
    mockLibrarySectionsResponse,
    mockMediaItemResponse,
    mockPlaylistsResponse,
    mockSearchResponse,
    mockTagDirectoryResponse,
} from './plexLibraryTestUtils';

// ============================================
// Install Mock localStorage
// ============================================

installMockLocalStorage();

// ============================================
// Tests
// ============================================

describe('PlexLibrary', () => {
    beforeEach(() => {
        mockLocalStorage.clear();
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    describe('getLibraries', () => {
        it('should return all library sections', async () => {
            mockFetchJson(mockLibrarySectionsResponse);
            const library = new PlexLibrary(mockConfig);

            const libs = await library.getLibraries();
            const [movies] = libs;

            expect(libs).toHaveLength(4);
            expect(movies).toMatchObject({ id: '1', title: 'Movies' });
        });

        it('should populate contentCount when includeItemCounts is enabled', async () => {
            mockFetchSequence([
                { json: mockLibrarySectionsResponse },
                { json: { MediaContainer: { totalSize: 123 } } },
                { json: { MediaContainer: { totalSize: 456 } } },
                { json: { MediaContainer: { totalSize: 999 } } },
                { json: { MediaContainer: { totalSize: 789 } } },
                { json: { MediaContainer: { totalSize: 10 } } },
            ]);
            const library = new PlexLibrary(mockConfig);

            const libs = await library.getLibraries({ includeItemCounts: true, itemCountConcurrency: 1 });
            const [movies, shows, music, photos] = libs;

            expect(libs).toHaveLength(4);
            expect(movies?.contentCount).toBe(123);
            expect(shows?.contentCount).toBe(456);
            expect(shows?.episodeCount).toBe(999);
            expect(music?.contentCount).toBe(789);
            expect(photos?.contentCount).toBe(10);
        });

        it('does not reset contentCount when episodeCount fetch fails', async () => {
            mockFetchJson(mockLibrarySectionsResponse);
            const library = new PlexLibrary(mockConfig);

            const spy = jest.spyOn(library, 'getLibraryItemCount');
            spy.mockImplementation(async (_libraryId, options) => {
                const typeFilter = options?.filter?.type;
                if (typeFilter === 4) {
                    throw new Error('episode count failed');
                }
                return 456;
            });

            const libs = await library.getLibraries({ includeItemCounts: true, itemCountConcurrency: 1 });

            const showLib = libs.find((lib) => lib.type === 'show');
            expect(showLib?.contentCount).toBe(456);
            expect(showLib?.episodeCount).toBeUndefined();
        });

        it('preserves unknown contentCount when item-count fetch fails', async () => {
            mockFetchJson(mockLibrarySectionsResponse);
            const library = new PlexLibrary(mockConfig);

            const spy = jest.spyOn(library, 'getLibraryItemCount');
            spy.mockImplementation(async (_libraryId, options) => {
                const typeFilter = options?.filter?.type;
                if (typeFilter === 4) {
                    return 999;
                }
                if (_libraryId === '2') {
                    throw new Error('item count failed');
                }
                return 456;
            });

            const libs = await library.getLibraries({ includeItemCounts: true, itemCountConcurrency: 1 });

            const showLib = libs.find((lib) => lib.id === '2');
            expect(showLib?.contentCount).toBeNull();
            expect(showLib?.episodeCount).toBeUndefined();
        });

        it('does not assign null episodeCount when episode count is unavailable', async () => {
            mockFetchJson(mockLibrarySectionsResponse);
            const library = new PlexLibrary(mockConfig);

            const spy = jest.spyOn(library, 'getLibraryItemCount');
            spy.mockImplementation(async (_libraryId, options) => {
                if (options?.filter?.type === PLEX_MEDIA_TYPES.EPISODE) {
                    return null;
                }
                return 456;
            });

            const libs = await library.getLibraries({ includeItemCounts: true, itemCountConcurrency: 1 });

            const showLib = libs.find((lib) => lib.type === 'show');
            expect(showLib?.contentCount).toBe(456);
            expect(showLib?.episodeCount).toBeUndefined();
        });

        it('should sanitize itemCountConcurrency when includeItemCounts is enabled', async () => {
            const oneLibraryResponse = {
                MediaContainer: {
                    Directory: [
                        {
                            key: '1',
                            uuid: 'lib-1',
                            title: 'Movies',
                            type: 'movie',
                            agent: 'com.plexapp.agents.imdb',
                            scanner: 'Plex Movie Scanner',
                        },
                    ],
                },
            };
            mockFetchSequence([
                { json: oneLibraryResponse },
                { json: { MediaContainer: { totalSize: 123 } } },
            ]);
            const library = new PlexLibrary(mockConfig);

            const libs = await library.getLibraries({ includeItemCounts: true, itemCountConcurrency: Number.NaN });
            const [firstLibrary] = libs;

            expect(libs).toHaveLength(1);
            expect(firstLibrary?.contentCount).toBe(123);
            expect(fetch).toHaveBeenCalledTimes(2);
        });

        it('should parse library types correctly', async () => {
            mockFetchJson(mockLibrarySectionsResponse);
            const library = new PlexLibrary(mockConfig);

            const libs = await library.getLibraries();
            const [movies, shows, artist, photo] = libs;

            expect(movies?.type).toBe('movie');
            expect(shows?.type).toBe('show');
            expect(artist?.type).toBe('artist');
            expect(photo?.type).toBe('photo');
        });

        it('throws typed parse error when library sections payload omits Directory', async () => {
            mockFetchJson({ MediaContainer: {} });
            const library = new PlexLibrary(mockConfig);

            await expect(library.getLibraries()).rejects.toMatchObject({
                code: PlexLibraryErrorCode.PARSE_ERROR,
                message: expect.stringContaining('Invalid library sections payload'),
            });
        });

        it('throws typed parse error when library sections payload omits MediaContainer', async () => {
            mockFetchJson({});
            const library = new PlexLibrary(mockConfig);

            await expect(library.getLibraries()).rejects.toMatchObject({
                code: PlexLibraryErrorCode.PARSE_ERROR,
                message: expect.stringContaining('Invalid library sections payload'),
            });
        });

        it('should cache libraries', async () => {
            mockFetchJson(mockLibrarySectionsResponse);
            const library = new PlexLibrary(mockConfig);

            await library.getLibraries();
            await library.getLibrary('1');

            // Should only call fetch once due to cache
            expect(fetch).toHaveBeenCalledTimes(1);
        });

        it('should clear cache when server or account changes', async () => {
            const baseHeaders = {
                Accept: 'application/json',
                'X-Plex-Client-Identifier': 'mock-client-id',
            };
            let serverUri = 'http://192.168.1.100:32400';
            let token = 'mock-token';
            const config: PlexLibraryConfig = {
                getAuthHeaders: () => ({
                    ...baseHeaders,
                    'X-Plex-Token': token,
                }),
                getServerUri: () => serverUri,
                getAuthToken: () => token,
            };

            mockFetchSequence([
                { json: mockLibrarySectionsResponse },
                { json: mockLibrarySectionsResponse },
                { json: mockLibrarySectionsResponse },
            ]);
            const library = new PlexLibrary(config);

            await library.getLibraries();

            // Simulate server swap (or profile swap with different token) and ensure cache is not reused.
            serverUri = 'http://10.0.0.2:32400';

            await library.getLibrary('1');

            // Simulate account swap while keeping the same server; cache should also be cleared.
            token = 'other-token';

            await library.getLibrary('1');

            expect(fetch).toHaveBeenCalledTimes(3);
        });
    });

    describe('getLibrary', () => {
        it('should return specific library', async () => {
            mockFetchJson(mockLibrarySectionsResponse);
            const library = new PlexLibrary(mockConfig);

            const lib = await library.getLibrary('2');

            expect(lib).toMatchObject({ id: '2', title: 'TV Shows' });
        });

        it('should return null for non-existent library', async () => {
            mockFetchJson(mockLibrarySectionsResponse);
            const library = new PlexLibrary(mockConfig);

            const lib = await library.getLibrary('999');

            expect(lib).toBeNull();
        });

        it('throws typed error when section lookup is unavailable', async () => {
            mockFetchJson({ error: 'Not found' }, 404);
            const library = new PlexLibrary(mockConfig);

            await expect(library.getLibrary('1')).rejects.toMatchObject({
                code: PlexLibraryErrorCode.SERVER_ERROR,
            });
        });

        it('throws typed parse error when section lookup payload is malformed', async () => {
            mockFetchSequence([{ json: { MediaContainer: { Directory: {} } } as unknown }]);
            const library = new PlexLibrary(mockConfig);

            await expect(library.getLibrary('1')).rejects.toMatchObject({
                code: PlexLibraryErrorCode.PARSE_ERROR,
                message: expect.stringContaining('Invalid library sections payload'),
            });
        });
    });

    describe('getLibraryItemCount', () => {
        it('returns null when getLibraryItemCount receives no response', async () => {
            mockFetchJson({ error: 'Not found' }, 404);
            const library = new PlexLibrary(mockConfig);

            await expect(library.getLibraryItemCount('1')).resolves.toBeNull();
        });
    });

    describe('getLibraryItems', () => {
        it('should handle pagination transparently', async () => {
            // Mock 250 items across 3 pages
            const page1 = { MediaContainer: { Metadata: Array(100).fill(mockMediaItemResponse.MediaContainer.Metadata[0]) } };
            const page2 = { MediaContainer: { Metadata: Array(100).fill(mockMediaItemResponse.MediaContainer.Metadata[0]) } };
            const page3 = { MediaContainer: { Metadata: Array(50).fill(mockMediaItemResponse.MediaContainer.Metadata[0]) } };

            mockFetchSequence([
                { json: page1 },
                { json: page2 },
                { json: page3 },
            ]);

            const library = new PlexLibrary(mockConfig);
            const items = await library.getLibraryItems('1');

            expect(items).toHaveLength(250);
            expect(fetch).toHaveBeenCalledTimes(3);
        });

        it('should handle empty library', async () => {
            mockFetchJson({ MediaContainer: { Metadata: [] } });
            const library = new PlexLibrary(mockConfig);

            const items = await library.getLibraryItems('1');

            expect(items).toHaveLength(0);
            expect(items).toEqual([]);
        });

        it('should handle single-page result', async () => {
            mockFetchJson(mockMediaItemResponse);
            const library = new PlexLibrary(mockConfig);

            const items = await library.getLibraryItems('1');

            expect(items).toHaveLength(1);
            expect(fetch).toHaveBeenCalledTimes(1);
        });

        it('should apply filters', async () => {
            mockFetchJson(mockMediaItemResponse);
            const library = new PlexLibrary(mockConfig);

            await library.getLibraryItems('1', { filter: { year: 2020 } });

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('year=2020'),
                expect.any(Object)
            );
        });

        it('should use pagination parameters', async () => {
            mockFetchJson(mockMediaItemResponse);
            const library = new PlexLibrary(mockConfig);

            await library.getLibraryItems('1', { offset: 50, limit: 25 });

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('X-Plex-Container-Start=50'),
                expect.any(Object)
            );
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('X-Plex-Container-Size=25'),
                expect.any(Object)
            );
        });

        it('should throw when pagination guard is exceeded in getLibraryItems', async () => {
            const page = {
                MediaContainer: {
                    // Return exactly matching the default page size (100) to keep hasMore=true
                    Metadata: Array(100).fill(mockMediaItemResponse.MediaContainer.Metadata[0])
                }
            };

            // Mock fetch to always return a full page infinite times
            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: { get: () => null },
                json: async () => page,
                text: async () => JSON.stringify(page),
            });

            const warn = jest.fn();
            const library = new PlexLibrary({ ...mockConfig, logger: { warn, error: console.error } });

            // Limit must not be specified so it defaults to pageSize=100 which matches pageItems length
            await expect(library.getLibraryItems('infinite-lib')).rejects.toMatchObject({
                message: expect.stringContaining('Pagination guard tripped'),
                code: PlexLibraryErrorCode.PAGINATION_LIMIT_EXCEEDED,
            });

            expect(fetch).toHaveBeenCalledTimes(1000);
            expect(warn).not.toHaveBeenCalledWith(
                expect.stringContaining('Pagination circuit breaker tripped')
            );
        });
    });

    describe('getItem', () => {
        it('should return specific item', async () => {
            mockFetchJson(mockMediaItemResponse);
            const library = new PlexLibrary(mockConfig);

            const item = await library.getItem('12345');

            expect(item).toMatchObject({ ratingKey: '12345', title: 'Test Movie' });
        });

        it('should return null for 404', async () => {
            mockFetchJson({ error: 'Not found' }, 404);
            const library = new PlexLibrary(mockConfig);

            const item = await library.getItem('99999');

            expect(item).toBeNull();
        });

        it('throws typed parse error when item metadata payload is malformed', async () => {
            mockFetchJson({ MediaContainer: { Metadata: {} } });
            const library = new PlexLibrary(mockConfig);

            await expect(library.getItem('12345')).rejects.toMatchObject({
                code: PlexLibraryErrorCode.PARSE_ERROR,
                message: expect.stringContaining('item lookup'),
            });
        });

        it('should redact tokens in URL logs', async () => {
            const warn = jest.fn();
            const error = jest.fn();
            mockFetchJson({ error: 'Not found' }, 404);
            const library = new PlexLibrary({ ...mockConfig, logger: { warn, error } });

            await library.getItem('99999?X-Plex-Token=mock-token');

            const message = warn.mock.calls[0]?.[0] as string;
            expect(message).toContain('REDACTED');
            expect(message).not.toContain('mock-token');
        });

        it('should parse media files correctly', async () => {
            mockFetchJson(mockMediaItemResponse);
            const library = new PlexLibrary(mockConfig);

            const item = await library.getItem('12345');
            const media = item?.media[0];
            const part = media?.parts[0];

            expect(item?.media).toHaveLength(1);
            expect(media?.videoCodec).toBe('h264');
            expect(media?.parts).toHaveLength(1);
            expect(part?.streams).toHaveLength(2);
        });
    });

    describe('getShowEpisodes', () => {
        it('should fetch all episodes via allLeaves endpoint in a single call', async () => {
            const allLeavesResponse = {
                MediaContainer: {
                    Metadata: [
                        { ratingKey: 'e1', key: '/e1', type: 'episode', title: 'S1E1', parentIndex: 1, index: 1, duration: 2700000 },
                        { ratingKey: 'e2', key: '/e2', type: 'episode', title: 'S1E2', parentIndex: 1, index: 2, duration: 2700000 },
                        { ratingKey: 'e3', key: '/e3', type: 'episode', title: 'S2E1', parentIndex: 2, index: 1, duration: 2700000 },
                    ],
                },
            };
            mockFetchJson(allLeavesResponse);

            const library = new PlexLibrary(mockConfig);
            const episodes = await library.getShowEpisodes('show1');

            expect(episodes).toHaveLength(3);
            expect(fetch).toHaveBeenCalledTimes(1);
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/library/metadata/show1/allLeaves'),
                expect.any(Object)
            );
        });

        it('should sort episodes by season and episode number', async () => {
            const unorderedResponse = {
                MediaContainer: {
                    Metadata: [
                        { ratingKey: 'e3', key: '/e3', type: 'episode', title: 'S2E1', parentIndex: 2, index: 1, duration: 2700000 },
                        { ratingKey: 'e2', key: '/e2', type: 'episode', title: 'S1E2', parentIndex: 1, index: 2, duration: 2700000 },
                        { ratingKey: 'e1', key: '/e1', type: 'episode', title: 'S1E1', parentIndex: 1, index: 1, duration: 2700000 },
                    ],
                },
            };
            mockFetchJson(unorderedResponse);

            const library = new PlexLibrary(mockConfig);
            const episodes = await library.getShowEpisodes('show1');
            const [firstEpisode, secondEpisode, thirdEpisode] = episodes;

            expect(firstEpisode?.seasonNumber).toBe(1);
            expect(firstEpisode?.episodeNumber).toBe(1);
            expect(secondEpisode?.seasonNumber).toBe(1);
            expect(secondEpisode?.episodeNumber).toBe(2);
            expect(thirdEpisode?.seasonNumber).toBe(2);
            expect(thirdEpisode?.episodeNumber).toBe(1);
        });

        it('should sort episodes when allLeaves mid-pagination fetch returns null', async () => {
            // Arrange
            const page1 = {
                MediaContainer: {
                    totalSize: 4,
                    Metadata: [
                        { ratingKey: 'e2', key: '/e2', type: 'episode', title: 'S1E2', parentIndex: 1, index: 2, duration: 2700000 },
                        { ratingKey: 'e1', key: '/e1', type: 'episode', title: 'S1E1', parentIndex: 1, index: 1, duration: 2700000 },
                    ],
                },
            };
            mockFetchSequence([{ json: page1 }, { json: { error: 'Not found' }, status: 404 }]);
            const library = new PlexLibrary(mockConfig);

            // Act
            const episodes = await library.getShowEpisodes('show1');

            // Assert
            expect(episodes).toHaveLength(2);
            expect(fetch).toHaveBeenCalledTimes(2);
            expect(episodes[0]?.episodeNumber).toBe(1);
            expect(episodes[1]?.episodeNumber).toBe(2);
        });

        it('should return empty array when allLeaves returns null', async () => {
            mockFetchJson({ error: 'Not found' }, 404);

            const library = new PlexLibrary(mockConfig);
            const episodes = await library.getShowEpisodes('nonexistent');

            expect(episodes).toEqual([]);
        });

        it('should page allLeaves when totalSize indicates truncation', async () => {
            const page1 = {
                MediaContainer: {
                    totalSize: 4,
                    Metadata: [
                        { ratingKey: 'e1', key: '/e1', type: 'episode', title: 'S1E1', parentIndex: 1, index: 1, duration: 2700000 },
                        { ratingKey: 'e2', key: '/e2', type: 'episode', title: 'S1E2', parentIndex: 1, index: 2, duration: 2700000 },
                    ],
                },
            };
            const page2 = {
                MediaContainer: {
                    totalSize: 4,
                    Metadata: [
                        { ratingKey: 'e3', key: '/e3', type: 'episode', title: 'S2E1', parentIndex: 2, index: 1, duration: 2700000 },
                        { ratingKey: 'e4', key: '/e4', type: 'episode', title: 'S2E2', parentIndex: 2, index: 2, duration: 2700000 },
                    ],
                },
            };
            mockFetchSequence([{ json: page1 }, { json: page2 }]);

            const library = new PlexLibrary(mockConfig);
            const episodes = await library.getShowEpisodes('show1');

            expect(episodes).toHaveLength(4);
            expect(fetch).toHaveBeenCalledTimes(2);
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('X-Plex-Container-Start=0'),
                expect.any(Object)
            );
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('X-Plex-Container-Start=2'),
                expect.any(Object)
            );
        });

        it('should throw when pagination guard is exceeded in getShowEpisodes', async () => {
            const page = {
                MediaContainer: {
                    totalSize: 5000,
                    // Return only 2 items per loop to prevent OOM
                    Metadata: [
                        { ratingKey: 'e1', key: '/e1', type: 'episode', title: 'S1E1', duration: 2700000 },
                        { ratingKey: 'e2', key: '/e2', type: 'episode', title: 'S1E2', duration: 2700000 }
                    ]
                }
            };

            (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: { get: () => null },
                json: async () => page,
                text: async () => JSON.stringify(page),
            });

            const warn = jest.fn();
            const library = new PlexLibrary({ ...mockConfig, logger: { warn, error: console.error } });
            await expect(library.getShowEpisodes('infinite-show')).rejects.toMatchObject({
                message: expect.stringContaining('Pagination guard tripped'),
                code: PlexLibraryErrorCode.PAGINATION_LIMIT_EXCEEDED,
            });

            expect(fetch).toHaveBeenCalledTimes(1000);
            expect(warn).not.toHaveBeenCalledWith(
                expect.stringContaining('Pagination circuit breaker tripped')
            );
        });
    });

    describe('getImageUrl', () => {
        it('should append auth token', () => {
            const library = new PlexLibrary(mockConfig);

            const url = library.getImageUrl('/library/metadata/123/thumb');

            expect(url).toContain('X-Plex-Token=mock-token');
        });

        it('should normalize same-origin absolute image URLs onto the server origin', () => {
            const library = new PlexLibrary(mockConfig);

            const url = library.getImageUrl('http://192.168.1.100:32400/library/metadata/123/thumb');

            expect(url).toContain('http://192.168.1.100:32400/library/metadata/123/thumb');
            expect(url).toContain('X-Plex-Token=mock-token');
        });

        it('should return external absolute image URLs token-free', () => {
            const library = new PlexLibrary(mockConfig);

            const url = library.getImageUrl('https://malicious.example/library/metadata/123/thumb');

            expect(url).toBe('https://malicious.example/library/metadata/123/thumb');
        });

        it('should preserve resized external images through the Plex transcode path', () => {
            const library = new PlexLibrary(mockConfig);

            const url = library.getImageUrl('https://malicious.example/library/metadata/123/thumb', 300);
            const parsed = new URL(url);

            expect(parsed.origin).toBe('http://192.168.1.100:32400');
            expect(parsed.pathname).toBe('/photo/:/transcode');
            expect(parsed.searchParams.get('X-Plex-Token')).toBe('mock-token');
            expect(parsed.searchParams.get('width')).toBe('300');
            expect(parsed.searchParams.get('height')).toBe('300');
            expect(parsed.searchParams.get('url')).toBe('https://malicious.example/library/metadata/123/thumb');
        });

        it('should use transcoder for resized images', () => {
            const library = new PlexLibrary(mockConfig);

            const url = library.getImageUrl('/library/metadata/123/thumb', 300, 450);

            expect(url).toContain('/photo/:/transcode');
            expect(url).toContain('width=300');
            expect(url).toContain('height=450');
        });

        it('should use width for height if not specified', () => {
            const library = new PlexLibrary(mockConfig);

            const url = library.getImageUrl('/library/metadata/123/thumb', 300);

            expect(url).toContain('width=300');
            expect(url).toContain('height=300');
        });

        it('should return empty string for empty path', () => {
            const library = new PlexLibrary(mockConfig);

            const url = library.getImageUrl('');

            expect(url).toBe('');
        });

        it('should return empty string when no server URI', () => {
            const noServerConfig: PlexLibraryConfig = {
                ...mockConfig,
                getServerUri: () => null,
            };
            const library = new PlexLibrary(noServerConfig);

            const url = library.getImageUrl('/library/metadata/123/thumb');

            expect(url).toBe('');
        });
    });

    describe('search', () => {
        it('should return search results', async () => {
            mockFetchJson(mockSearchResponse);
            const library = new PlexLibrary(mockConfig);

            const results = await library.search('test');

            expect(results).toHaveLength(2);
            expect(results[0]?.title).toBe('Search Result 1');
        });

        it('should pass query parameter', async () => {
            mockFetchJson(mockSearchResponse);
            const library = new PlexLibrary(mockConfig);

            await library.search('my search query');

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('query=my+search+query'),
                expect.any(Object)
            );
        });

        it('should filter by library when specified', async () => {
            mockFetchJson(mockSearchResponse);
            const library = new PlexLibrary(mockConfig);

            await library.search('test', { libraryId: '1' });

            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('sectionId=1'),
                expect.any(Object)
            );
        });
    });

    describe('collections', () => {
        it('should return collections', async () => {
            mockFetchJson(mockCollectionsResponse);
            const library = new PlexLibrary(mockConfig);

            const collections = await library.getCollections('1');
            const [firstCollection] = collections;

            expect(collections).toHaveLength(2);
            expect(firstCollection?.title).toBe('Marvel');
            expect(firstCollection?.childCount).toBe(25);
        });

        it('should return collection items', async () => {
            mockFetchJson(mockMediaItemResponse);
            const library = new PlexLibrary(mockConfig);

            const items = await library.getCollectionItems('c1');

            expect(items).toHaveLength(1);
        });

        it('throws typed parse error when collections response is empty-success noise', async () => {
            mockFetchTextResponse('');
            const library = new PlexLibrary(mockConfig);

            await expect(library.getCollections('1')).rejects.toMatchObject({
                code: PlexLibraryErrorCode.PARSE_ERROR,
                message: expect.stringContaining('Empty response body'),
            });
        });
    });

    describe('playlists', () => {
        it('should return playlists', async () => {
            mockFetchJson(mockPlaylistsResponse);
            const library = new PlexLibrary(mockConfig);

            const playlists = await library.getPlaylists();
            const [firstPlaylist] = playlists;

            expect(playlists).toHaveLength(1);
            expect(firstPlaylist?.title).toBe('Favorites');
            expect(firstPlaylist?.leafCount).toBe(10);
        });

        it('should return playlist items', async () => {
            mockFetchJson(mockMediaItemResponse);
            const library = new PlexLibrary(mockConfig);

            const items = await library.getPlaylistItems('pl1');

            expect(items).toHaveLength(1);
        });
    });

    describe('tag directories', () => {
        it('should return actors from directory entries', async () => {
            mockFetchJson(mockTagDirectoryResponse);
            const library = new PlexLibrary(mockConfig);

            const actors = await library.getActors('1', { type: PLEX_MEDIA_TYPES.MOVIE });

            expect(actors).toHaveLength(2);
            expect(actors[0]).toEqual({
                key: 't1',
                title: 'Tag One',
                count: 12,
                fastKey: '/library/sections/1/actor?type=1&actor=Tag%20One',
                thumb: '/t1/thumb',
            });
        });

        it('should return studios from directory entries', async () => {
            mockFetchJson(mockTagDirectoryResponse);
            const library = new PlexLibrary(mockConfig);

            const studios = await library.getStudios('1', { type: PLEX_MEDIA_TYPES.MOVIE });

            expect(studios).toHaveLength(2);
            expect(studios[1]).toMatchObject({
                key: 't2',
                title: 'Tag Two',
                count: 3,
            });
            expect(studios[1]).not.toHaveProperty('fastKey');
            expect(studios[1]).not.toHaveProperty('thumb');
        });

        it('should return genres from directory entries', async () => {
            mockFetchJson(mockTagDirectoryResponse);
            const library = new PlexLibrary(mockConfig);

            const genres = await library.getGenres('1', { type: PLEX_MEDIA_TYPES.SHOW });

            expect(genres).toHaveLength(2);
            expect(genres[0]).toMatchObject({
                key: 't1',
                title: 'Tag One',
                count: 12,
            });
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/library/sections/1/genre'),
                expect.any(Object)
            );
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('type=2'),
                expect.any(Object)
            );
        });

        it('should return directors from directory entries', async () => {
            mockFetchJson(mockTagDirectoryResponse);
            const library = new PlexLibrary(mockConfig);

            const directors = await library.getDirectors('1', { type: PLEX_MEDIA_TYPES.EPISODE });

            expect(directors).toHaveLength(2);
            expect(directors[0]).toMatchObject({
                key: 't1',
                title: 'Tag One',
                count: 12,
            });
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/library/sections/1/director'),
                expect.any(Object)
            );
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('type=4'),
                expect.any(Object)
            );
        });

        it('should return years from directory entries', async () => {
            mockFetchJson(mockTagDirectoryResponse);
            const library = new PlexLibrary(mockConfig);

            const years = await library.getYears('1', { type: PLEX_MEDIA_TYPES.EPISODE });

            expect(years).toHaveLength(2);
            expect(years[0]).toMatchObject({
                key: 't1',
                title: 'Tag One',
                count: 12,
            });
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/library/sections/1/year'),
                expect.any(Object)
            );
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('type=4'),
                expect.any(Object)
            );
        });

        it('should return [] and invoke callback when genres endpoint is unavailable and requireEntries is true', async () => {
            mockFetchJson({ error: 'Not found' }, 404);
            const onUnsupported = jest.fn();
            const library = new PlexLibrary(mockConfig);

            const genres = await library.getGenres('1', { type: PLEX_MEDIA_TYPES.SHOW, onUnsupported, requireEntries: true });

            expect(genres).toEqual([]);
            expect(onUnsupported).toHaveBeenCalledWith('unavailable');
            expect(onUnsupported).toHaveBeenCalledTimes(1);
        });

        it('should return [] and invoke callback when directors endpoint is unavailable and requireEntries is true', async () => {
            mockFetchJson({ error: 'Not found' }, 404);
            const onUnsupported = jest.fn();
            const library = new PlexLibrary(mockConfig);

            const directors = await library.getDirectors('1', { type: PLEX_MEDIA_TYPES.EPISODE, onUnsupported, requireEntries: true });

            expect(directors).toEqual([]);
            expect(onUnsupported).toHaveBeenCalledWith('unavailable');
            expect(onUnsupported).toHaveBeenCalledTimes(1);
        });

        it('should return [] and invoke callback when years endpoint is unavailable and requireEntries is true', async () => {
            mockFetchJson({ error: 'Not found' }, 404);
            const onUnsupported = jest.fn();
            const library = new PlexLibrary(mockConfig);

            const years = await library.getYears('1', { type: PLEX_MEDIA_TYPES.EPISODE, onUnsupported, requireEntries: true });

            expect(years).toEqual([]);
            expect(onUnsupported).toHaveBeenCalledWith('unavailable');
            expect(onUnsupported).toHaveBeenCalledTimes(1);
        });

        it('should return [] and NOT invoke callback when genres endpoint is unavailable but requireEntries is false', async () => {
            mockFetchJson({ error: 'Not found' }, 404);
            const onUnsupported = jest.fn();
            const library = new PlexLibrary(mockConfig);

            const genres = await library.getGenres('1', { type: PLEX_MEDIA_TYPES.SHOW, onUnsupported }); // requireEntries defaults to false

            expect(genres).toEqual([]);
            expect(onUnsupported).not.toHaveBeenCalled();
        });

        it('should invoke callback when required genres endpoint returns no directory entries', async () => {
            mockFetchJson({ MediaContainer: { Directory: [] } });
            const onUnsupported = jest.fn();
            const library = new PlexLibrary(mockConfig);

            const genres = await library.getGenres('1', {
                type: PLEX_MEDIA_TYPES.SHOW,
                onUnsupported,
                requireEntries: true,
            });

            expect(genres).toEqual([]);
            expect(onUnsupported).toHaveBeenCalledWith('empty');
        });
    });

    describe('error handling', () => {
        it('should emit authExpired on 401', async () => {
            mockFetchJson({ error: 'Unauthorized' }, 401);
            const library = new PlexLibrary(mockConfig);
            const handler = jest.fn();
            library.on('authExpired', handler);

            await expect(library.getLibraries()).rejects.toThrow(PlexLibraryError);
            expect(handler).toHaveBeenCalled();
        });

        it('should throw AUTH_EXPIRED error code on 401', async () => {
            mockFetchJson({ error: 'Unauthorized' }, 401);
            const library = new PlexLibrary(mockConfig);
            const request = library.getLibraries();

            await expect(request).rejects.toBeInstanceOf(PlexLibraryError);
            await expect(request).rejects.toMatchObject({
                code: PlexLibraryErrorCode.AUTH_EXPIRED,
            });
        });

        it('surfaces thrown PlexLibraryError codes through the canonical subset export shape', async () => {
            mockFetchJson({ error: 'Unauthorized' }, 401);
            const library = new PlexLibrary(mockConfig);

            try {
                await library.getLibraries();
                throw new Error('Expected getLibraries() to throw');
            } catch (error) {
                expect(error).toBeInstanceOf(PlexLibraryError);
                expect((error as PlexLibraryError).code).toBe(PlexLibraryErrorCode.AUTH_EXPIRED);
                expect((error as PlexLibraryError).code).toBe(AppErrorCode.AUTH_EXPIRED);
            }
        });

        it('should throw SERVER_ERROR on 500', async () => {
            jest.useFakeTimers();
            try {
                const fetchMock = jest.fn().mockResolvedValue({
                    ok: false,
                    status: 500,
                    headers: { get: () => null },
                    json: async () => ({ error: 'Server error' }),
                });
                (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

                const library = new PlexLibrary(mockConfig);
                const promise = library.getLibraries();
                const rejection = expect(promise).rejects.toThrow();

                await jest.advanceTimersByTimeAsync(2000);

                await rejection;
            } finally {
                jest.useRealTimers();
            }
        });

        it('should throw NETWORK_TIMEOUT after exhausting timeout retries', async () => {
            jest.useFakeTimers();
            try {
                (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockImplementation(
                    (_url: string, options?: RequestInit) =>
                        new Promise((_resolve, reject) => {
                            const signal = options?.signal as AbortSignal | undefined;
                            if (signal?.aborted) {
                                reject(new DOMException('The operation was aborted', 'AbortError'));
                                return;
                            }
                            signal?.addEventListener(
                                'abort',
                                () => reject(new DOMException('The operation was aborted', 'AbortError')),
                                { once: true }
                            );
                        })
                );

                const library = new PlexLibrary(mockConfig);
                const request = library.getLibraries();
                const rejection = expect(request).rejects.toMatchObject({
                    code: PlexLibraryErrorCode.NETWORK_TIMEOUT,
                });
                await jest.runAllTimersAsync();

                await rejection;
                expect(fetch).toHaveBeenCalledTimes(PLEX_LIBRARY_CONSTANTS.MAX_TIMEOUT_RETRIES + 1);
            } finally {
                jest.useRealTimers();
            }
        });

        it('should fail interactive tag-directory requests within 15 seconds instead of using the default timeout budget', async () => {
            jest.useFakeTimers();
            try {
                const fetchMock = jest.fn().mockImplementation(
                    (_url: string, options?: RequestInit) =>
                        new Promise((_resolve, reject) => {
                            const signal = options?.signal as AbortSignal | undefined;
                            if (signal?.aborted) {
                                reject(new DOMException('The operation was aborted', 'AbortError'));
                                return;
                            }
                            signal?.addEventListener(
                                'abort',
                                () => reject(new DOMException('The operation was aborted', 'AbortError')),
                                { once: true }
                            );
                        })
                );
                (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

                const library = new PlexLibrary(mockConfig);
                const request = library.getGenres('1', {
                    type: PLEX_MEDIA_TYPES.SHOW,
                    requireEntries: true,
                    requestIntent: 'preview',
                } as PlexTagDirectoryQueryOptions);
                const settled = jest.fn();
                void request.then(
                    () => settled('resolved'),
                    (error) => settled(error)
                );

                await jest.advanceTimersByTimeAsync(15000);
                await Promise.resolve();
                await Promise.resolve();

                expect(settled).toHaveBeenCalledWith(
                    expect.objectContaining({ code: PlexLibraryErrorCode.NETWORK_TIMEOUT })
                );
                expect(fetchMock).toHaveBeenCalled();
            } finally {
                jest.useRealTimers();
            }
        });

        it('rethrows upstream aborts without treating them as retryable timeouts', async () => {
            jest.useFakeTimers();
            try {
                const controller = new AbortController();
                (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockImplementation(
                    (_url: string, options?: RequestInit) =>
                        new Promise((_resolve, reject) => {
                            const signal = options?.signal as AbortSignal | undefined;
                            if (signal?.aborted) {
                                reject(new DOMException('The operation was aborted', 'AbortError'));
                                return;
                            }
                            signal?.addEventListener(
                                'abort',
                                () => reject(new DOMException('The operation was aborted', 'AbortError')),
                                { once: true }
                            );
                        })
                );

                const library = new PlexLibrary(mockConfig);
                const request = library.getLibraries({ signal: controller.signal });
                const rejection = expect(request).rejects.toMatchObject({ name: 'AbortError' });
                controller.abort();
                await jest.runAllTimersAsync();

                await rejection;
                expect(fetch).toHaveBeenCalledTimes(1);
            } finally {
                jest.useRealTimers();
            }
        });

        it('should throw when no server URI available', async () => {
            const noServerConfig: PlexLibraryConfig = {
                ...mockConfig,
                getServerUri: () => null,
            };
            const library = new PlexLibrary(noServerConfig);

            await expect(library.getLibraries()).rejects.toThrow(PlexLibraryError);
        });

        it('should throw ACCESS_DENIED error code on 403', async () => {
            mockFetchJson({ error: 'Forbidden' }, 403);
            const library = new PlexLibrary(mockConfig);
            const request = library.getLibraries();

            await expect(request).rejects.toBeInstanceOf(PlexLibraryError);
            await expect(request).rejects.toMatchObject({
                code: PlexLibraryErrorCode.ACCESS_DENIED,
                httpStatus: 403,
            });
        });

        it('should NOT emit authExpired on 403', async () => {
            mockFetchJson({ error: 'Forbidden' }, 403);
            const library = new PlexLibrary(mockConfig);
            const handler = jest.fn();
            library.on('authExpired', handler);

            await expect(library.getLibraries()).rejects.toThrow(PlexLibraryError);
            expect(handler).not.toHaveBeenCalled();
        });

        it('should NOT retry on 403', async () => {
            mockFetchJson({ error: 'Forbidden' }, 403);
            const library = new PlexLibrary(mockConfig);

            await expect(library.getLibraries()).rejects.toThrow(PlexLibraryError);
            expect(fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('refreshLibrary', () => {
        it('should invalidate cache and re-fetch', async () => {
            mockFetchJson(mockLibrarySectionsResponse);
            const library = new PlexLibrary(mockConfig);

            // First fetch - populates cache
            await library.getLibraries();
            expect(fetch).toHaveBeenCalledTimes(1);

            // Get from cache - no fetch
            await library.getLibrary('1');
            expect(fetch).toHaveBeenCalledTimes(1);

            // Refresh - should fetch again
            await library.refreshLibrary('1');
            expect(fetch).toHaveBeenCalledTimes(2);
        });

        it('should emit libraryRefreshed event', async () => {
            mockFetchJson(mockLibrarySectionsResponse);
            const library = new PlexLibrary(mockConfig);
            const handler = jest.fn();
            library.on('libraryRefreshed', handler);

            await library.refreshLibrary('1');

            expect(handler).toHaveBeenCalledWith({ libraryId: '1' });
        });
    });
});
