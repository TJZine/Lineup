/**
 * @fileoverview Unit tests for ContentResolver.
 * @module modules/scheduler/channel-manager/__tests__/ContentResolver.test
 */

import { ContentResolver } from '../ContentResolver';
import type { IPlexLibraryMinimal, PlexMediaItemMinimal } from '../interfaces';
import type {
    LibraryContentSource,
    CollectionContentSource,
    ShowContentSource,
    PlaylistContentSource,
    ManualContentSource,
    MixedContentSource,
    ContentFilter,
    ResolvedContentItem,
} from '../types';
import { PLEX_MEDIA_TYPES } from '../../../plex/library/constants';
import type { PlexMediaFile, PlexStream } from '../../../plex/library';

// ============================================
// Mock Setup
// ============================================

function createMockLibrary(): jest.Mocked<IPlexLibraryMinimal> {
    return {
        getLibraryItems: jest.fn(),
        getCollectionItems: jest.fn(),
        getShowEpisodes: jest.fn(),
        getPlaylistItems: jest.fn(),
        getItem: jest.fn(),
    };
}

function createMockItem(overrides: Partial<PlexMediaItemMinimal> = {}): PlexMediaItemMinimal {
    return {
        ratingKey: '1',
        type: 'movie',
        title: 'Test Movie',
        year: 2020,
        durationMs: 7200000,
        thumb: '/thumb/1',
        addedAt: new Date(),
        ...overrides,
    };
}

function createMockMedia(streamOverrides: Partial<PlexStream> = {}): PlexMediaFile {
    return {
        id: 'media-1',
        duration: 1000,
        bitrate: 1000,
        width: 1920,
        height: 1080,
        aspectRatio: 1.78,
        videoCodec: 'h264',
        audioCodec: 'aac',
        audioChannels: 2,
        container: 'mp4',
        videoResolution: '1080',
        parts: [
            {
                id: 'part-1',
                key: '/library/parts/1',
                duration: 1000,
                file: '/media.mp4',
                size: 1000,
                container: 'mp4',
                streams: [
                    {
                        id: 'stream-1',
                        streamType: 1,
                        codec: 'hevc',
                        ...streamOverrides,
                    },
                ],
            },
        ],
    };
}

function createMockEpisode(
    season: number,
    episode: number,
    overrides: Partial<PlexMediaItemMinimal> = {}
): PlexMediaItemMinimal {
    return {
        ratingKey: `s${season}e${episode}`,
        type: 'episode',
        title: `Episode ${episode}`,
        year: 2020,
        durationMs: 2700000,
        thumb: `/thumb/s${season}e${episode}`,
        grandparentTitle: 'Test Show',
        seasonNumber: season,
        episodeNumber: episode,
        addedAt: new Date(),
        ...overrides,
    };
}

function createDeferredPromise<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error?: unknown) => void;
} {
    let resolve!: (value: T) => void;
    let reject!: (error?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });

    return { promise, resolve, reject };
}

// ============================================
// Tests
// ============================================

describe('ContentResolver', () => {
    let mockLibrary: jest.Mocked<IPlexLibraryMinimal>;
    let resolver: ContentResolver;

    beforeEach(() => {
        mockLibrary = createMockLibrary();
        resolver = new ContentResolver(mockLibrary);
    });

    describe('resolveSource', () => {
        it('should resolve library source', async () => {
            const items = [createMockItem({ ratingKey: '1' }), createMockItem({ ratingKey: '2' })];
            mockLibrary.getLibraryItems.mockResolvedValue(items);

            const source: LibraryContentSource = {
                type: 'library',
                libraryId: 'lib1',
                libraryType: 'movie',
                includeWatched: true,
            };

            const result = await resolver.resolveSource(source);

            expect(mockLibrary.getLibraryItems).toHaveBeenCalledWith('lib1', expect.anything());
            expect(result).toHaveLength(2);
            expect(result[0]!.ratingKey).toBe('1');
        });

        it('reuses cached movie-library source payload across sequential resolveSource calls', async () => {
            const items = [createMockItem({ ratingKey: '1' }), createMockItem({ ratingKey: '2' })];
            mockLibrary.getLibraryItems.mockResolvedValue(items);

            const source: LibraryContentSource = {
                type: 'library',
                libraryId: 'lib1',
                libraryType: 'movie',
                includeWatched: true,
            };

            await resolver.resolveSource(source);
            await resolver.resolveSource(source);

            expect(mockLibrary.getLibraryItems).toHaveBeenCalledTimes(1);
        });

        it('dedupes concurrent resolveSource calls for identical source key', async () => {
            const deferred = createDeferredPromise<PlexMediaItemMinimal[]>();
            mockLibrary.getLibraryItems.mockReturnValue(deferred.promise);

            const source: LibraryContentSource = {
                type: 'library',
                libraryId: 'lib-concurrent',
                libraryType: 'movie',
                includeWatched: true,
            };

            const firstResolve = resolver.resolveSource(source);
            const secondResolve = resolver.resolveSource(source);
            deferred.resolve([createMockItem({ ratingKey: 'concurrent-1' })]);

            const [firstResult, secondResult] = await Promise.all([firstResolve, secondResolve]);

            expect(mockLibrary.getLibraryItems).toHaveBeenCalledTimes(1);
            expect(firstResult).toEqual(secondResult);
        });

        it('does not allow one caller abort to cancel shared in-flight source resolve for other callers', async () => {
            const deferred = createDeferredPromise<PlexMediaItemMinimal[]>();
            mockLibrary.getLibraryItems.mockImplementation((_libraryId: string, options?: { signal?: AbortSignal | null }) => {
                const signal = options?.signal;
                return new Promise<PlexMediaItemMinimal[]>((resolve, reject) => {
                    if (signal?.aborted) {
                        reject({ name: 'AbortError' });
                        return;
                    }
                    const onAbort = (): void => reject({ name: 'AbortError' });
                    signal?.addEventListener('abort', onAbort, { once: true });
                    deferred.promise
                        .then((items) => {
                            signal?.removeEventListener('abort', onAbort);
                            resolve(items);
                        })
                        .catch((error) => {
                            signal?.removeEventListener('abort', onAbort);
                            reject(error);
                        });
                });
            });

            const source: LibraryContentSource = {
                type: 'library',
                libraryId: 'lib-abort',
                libraryType: 'movie',
                includeWatched: true,
            };

            const controllerA = new AbortController();
            const controllerB = new AbortController();

            const promiseA = resolver.resolveSource(source, { signal: controllerA.signal });
            const promiseB = resolver.resolveSource(source, { signal: controllerB.signal });

            controllerA.abort();
            deferred.resolve([createMockItem({ ratingKey: 'abort-safe-1' })]);

            await expect(promiseA).rejects.toMatchObject({ name: 'AbortError' });
            await expect(promiseB).resolves.toEqual(
                expect.arrayContaining([expect.objectContaining({ ratingKey: 'abort-safe-1' })])
            );
            expect(mockLibrary.getLibraryItems).toHaveBeenCalledTimes(1);
        });

        it('respects cache TTL expiry and refetches after expiration', async () => {
            const nowSpy = jest.spyOn(Date, 'now');
            let nowMs = 0;
            nowSpy.mockImplementation(() => nowMs);

            mockLibrary.getLibraryItems.mockResolvedValue([createMockItem({ ratingKey: 'ttl-1' })]);

            const source: LibraryContentSource = {
                type: 'library',
                libraryId: 'lib-ttl',
                libraryType: 'movie',
                includeWatched: true,
            };

            await resolver.resolveSource(source);
            nowMs = 300001;
            await resolver.resolveSource(source);

            expect(mockLibrary.getLibraryItems).toHaveBeenCalledTimes(2);
            nowSpy.mockRestore();
        });

        it('should resolve collection source', async () => {
            const items = [createMockItem({ ratingKey: 'c1' })];
            mockLibrary.getCollectionItems.mockResolvedValue(items);

            const source: CollectionContentSource = {
                type: 'collection',
                collectionKey: 'col1',
                collectionName: 'My Collection',
            };

            const result = await resolver.resolveSource(source);

            expect(mockLibrary.getCollectionItems).toHaveBeenCalledWith('col1', expect.anything());
            expect(result).toHaveLength(1);
        });

        it('propagates clearLogo into ResolvedContentItem when present', async () => {
            const items = [createMockItem({ ratingKey: '1', clearLogo: '/clearlogo.png' })];
            mockLibrary.getLibraryItems.mockResolvedValue(items);

            const source: LibraryContentSource = {
                type: 'library',
                libraryId: 'lib1',
                libraryType: 'movie',
                includeWatched: true,
            };

            const result = await resolver.resolveSource(source);
            expect(result[0]?.clearLogo).toBe('/clearlogo.png');
        });

        it('should expand show containers returned by a collection source and propagate show metadata', async () => {
            const show = createMockItem({
                ratingKey: 'show-1',
                type: 'show',
                title: 'My Show',
                durationMs: 123456, // Some servers populate this even for show containers
                clearLogo: '/clearlogo/show-1.png',
                genres: ['Animation'],
                contentRating: 'PG',
            });
            // We set ratingKey in createMockEpisode overrides to strictly match expectations
            const episodes = [
                createMockEpisode(1, 1, { ratingKey: 'ep-1', grandparentRatingKey: 'show-1' }),
                createMockEpisode(1, 2, { ratingKey: 'ep-2', grandparentRatingKey: 'show-1' })
            ];

            mockLibrary.getCollectionItems.mockResolvedValue([show]);
            mockLibrary.getShowEpisodes.mockResolvedValue(episodes);

            const source: CollectionContentSource = {
                type: 'collection',
                collectionKey: 'col-shows',
                collectionName: 'Show Collection',
            };

            const result = await resolver.resolveSource(source);

            expect(mockLibrary.getCollectionItems).toHaveBeenCalledWith('col-shows', expect.anything());
            expect(mockLibrary.getShowEpisodes).toHaveBeenCalledTimes(1);
            expect(mockLibrary.getShowEpisodes).toHaveBeenCalledWith('show-1', expect.anything());

            expect(result).toHaveLength(2);
            expect(result[0]!.type).toBe('episode');
            expect(result[0]!.ratingKey).toBe('ep-1');
            expect(result[1]!.ratingKey).toBe('ep-2');
            expect(result[0]!.genres).toEqual(['Animation']);
            expect(result[0]!.clearLogo).toBe('/clearlogo/show-1.png');
            expect(result[0]!.scheduledIndex).toBe(0);
            expect(result[1]!.scheduledIndex).toBe(1);
        });

        it('should decorate inline-expanded episodes with parent show metadata', async () => {
            const show = createMockItem({
                ratingKey: 'show-inline',
                type: 'show',
                title: 'Inline Show',
                durationMs: 0, // Triggers inline expansion (durationMs: 0, no season/episode numbers)
                thumb: '/thumb/inline-show',
                clearLogo: '/clearlogo/inline-show.png',
                genres: ['Drama'],
                contentRating: 'TV-14',
            });
            const episodes = [
                createMockEpisode(1, 1, { grandparentTitle: '', grandparentThumb: null, clearLogo: null }),
                createMockEpisode(1, 2, { grandparentTitle: '', grandparentThumb: null, clearLogo: null }),
            ];

            mockLibrary.getCollectionItems.mockResolvedValue([show]);
            mockLibrary.getShowEpisodes.mockResolvedValue(episodes);

            const source: CollectionContentSource = {
                type: 'collection',
                collectionKey: 'col-inline',
                collectionName: 'Inline Show Collection',
            };

            const result = await resolver.resolveSource(source);

            expect(mockLibrary.getCollectionItems).toHaveBeenCalledWith('col-inline', expect.anything());
            expect(mockLibrary.getShowEpisodes).toHaveBeenCalledWith('show-inline', expect.anything());
            expect(result).toHaveLength(2);
            expect(result[0]!.type).toBe('episode');
            expect(result[0]!.showTitle).toBe('Inline Show');
            expect(result[0]!.showThumb).toBe('/thumb/inline-show');
            expect(result[0]!.clearLogo).toBe('/clearlogo/inline-show.png');
            expect(result[0]!.genres).toEqual(['Drama']);
            expect(result[0]!.contentRating).toBe('TV-14');
        });

        it('propagates clearLogo from show list to episodes in show libraries', async () => {
            const episodes = [
                createMockEpisode(1, 1, { ratingKey: 'ep1', grandparentRatingKey: 'show1' }),
            ];
            const shows = [
                createMockItem({ ratingKey: 'show1', type: 'show', genres: ['Drama'], clearLogo: '/clearlogo/show1.png' }),
            ];
            mockLibrary.getLibraryItems.mockImplementation((_, options) => {
                if (options?.filter?.type === PLEX_MEDIA_TYPES.EPISODE) {
                    return Promise.resolve(episodes);
                }
                return Promise.resolve(shows);
            });

            const source: LibraryContentSource = {
                type: 'library',
                libraryId: 'show-lib',
                libraryType: 'show',
                includeWatched: true,
            };

            const result = await resolver.resolveSource(source);
            expect(result).toHaveLength(1);
            expect(result[0]!.clearLogo).toBe('/clearlogo/show1.png');
        });

        it('should resolve show source with all episodes', async () => {
            const episodes = [
                createMockEpisode(1, 1),
                createMockEpisode(1, 2),
                createMockEpisode(2, 1),
            ];
            mockLibrary.getShowEpisodes.mockResolvedValue(episodes);

            const source: ShowContentSource = {
                type: 'show',
                showKey: 'show1',
                showName: 'Test Show',
            };

            const result = await resolver.resolveSource(source);

            expect(mockLibrary.getShowEpisodes).toHaveBeenCalledWith('show1', expect.anything());
            expect(result).toHaveLength(3);
        });

        it('should resolve show source with season filter', async () => {
            const episodes = [
                createMockEpisode(1, 1),
                createMockEpisode(1, 2),
                createMockEpisode(2, 1),
                createMockEpisode(3, 1),
            ];
            mockLibrary.getShowEpisodes.mockResolvedValue(episodes);

            const source: ShowContentSource = {
                type: 'show',
                showKey: 'show1',
                showName: 'Test Show',
                seasonFilter: [1, 2],
            };

            const result = await resolver.resolveSource(source);

            expect(result).toHaveLength(3);
            expect(result.every((ep) => [1, 2].includes(ep.seasonNumber!))).toBe(true);
        });

        it('should resolve playlist source', async () => {
            const items = [createMockItem({ ratingKey: 'p1' })];
            mockLibrary.getPlaylistItems.mockResolvedValue(items);

            const source: PlaylistContentSource = {
                type: 'playlist',
                playlistKey: 'playlist1',
                playlistName: 'My Playlist',
            };

            const result = await resolver.resolveSource(source);

            expect(mockLibrary.getPlaylistItems).toHaveBeenCalledWith('playlist1', expect.anything());
            expect(result).toHaveLength(1);
        });

        // Issue 7: Manual source now uses cached metadata without fetching from Plex
        it('should resolve manual source from cached metadata', async () => {
            const source: ManualContentSource = {
                type: 'manual',
                items: [{ ratingKey: 'm1', title: 'Manual Item', durationMs: 3600000 }],
            };

            const result = await resolver.resolveSource(source);

            // Should NOT call getItem - uses cached metadata
            expect(mockLibrary.getItem).not.toHaveBeenCalled();
            expect(result).toHaveLength(1);
            expect(result[0]!.title).toBe('Manual Item');
            expect(result[0]!.durationMs).toBe(3600000);
        });

        it('should resolve mixed source with sequential mode', async () => {
            const libraryItems = [createMockItem({ ratingKey: 'l1' })];
            const collectionItems = [createMockItem({ ratingKey: 'c1' })];
            mockLibrary.getLibraryItems.mockResolvedValue(libraryItems);
            mockLibrary.getCollectionItems.mockResolvedValue(collectionItems);

            const source: MixedContentSource = {
                type: 'mixed',
                sources: [
                    { type: 'library', libraryId: 'lib1', libraryType: 'movie', includeWatched: true },
                    { type: 'collection', collectionKey: 'col1', collectionName: 'Col' },
                ],
                mixMode: 'sequential',
            };

            const result = await resolver.resolveSource(source);

            expect(result).toHaveLength(2);
            expect(result[0]!.ratingKey).toBe('l1');
            expect(result[1]!.ratingKey).toBe('c1');
        });

        it('should resolve mixed source with interleave mode', async () => {
            const libraryItems = [
                createMockItem({ ratingKey: 'l1' }),
                createMockItem({ ratingKey: 'l2' }),
            ];
            const collectionItems = [createMockItem({ ratingKey: 'c1' })];
            mockLibrary.getLibraryItems.mockResolvedValue(libraryItems);
            mockLibrary.getCollectionItems.mockResolvedValue(collectionItems);

            const source: MixedContentSource = {
                type: 'mixed',
                sources: [
                    { type: 'library', libraryId: 'lib1', libraryType: 'movie', includeWatched: true },
                    { type: 'collection', collectionKey: 'col1', collectionName: 'Col' },
                ],
                mixMode: 'interleave',
            };

            const result = await resolver.resolveSource(source);

            // Interleave: l1, c1, l2
            expect(result).toHaveLength(3);
            expect(result[0]!.ratingKey).toBe('l1');
            expect(result[1]!.ratingKey).toBe('c1');
            expect(result[2]!.ratingKey).toBe('l2');
        });

        it('interleave mode remains stable with uneven source sizes and consumes all items', async () => {
            mockLibrary.getLibraryItems.mockResolvedValue([
                createMockItem({ ratingKey: 'l1' }),
                createMockItem({ ratingKey: 'l2' }),
                createMockItem({ ratingKey: 'l3' }),
            ]);
            mockLibrary.getCollectionItems.mockResolvedValue([
                createMockItem({ ratingKey: 'c1' }),
            ]);
            mockLibrary.getPlaylistItems.mockResolvedValue([
                createMockItem({ ratingKey: 'p1' }),
                createMockItem({ ratingKey: 'p2' }),
            ]);

            const source: MixedContentSource = {
                type: 'mixed',
                sources: [
                    { type: 'library', libraryId: 'lib1', libraryType: 'movie', includeWatched: true },
                    { type: 'collection', collectionKey: 'col1', collectionName: 'Col' },
                    { type: 'playlist', playlistKey: 'pl1', playlistName: 'Playlist' },
                ],
                mixMode: 'interleave',
            };

            const result = await resolver.resolveSource(source);

            expect(result.map((item) => item.ratingKey)).toEqual(['l1', 'c1', 'p1', 'l2', 'p2', 'l3']);
            expect(result).toHaveLength(6);
        });

        it('sequential mixed mode preserves sub-source order', async () => {
            mockLibrary.getLibraryItems.mockResolvedValue([
                createMockItem({ ratingKey: 'l1' }),
                createMockItem({ ratingKey: 'l2' }),
            ]);
            mockLibrary.getCollectionItems.mockResolvedValue([
                createMockItem({ ratingKey: 'c1' }),
                createMockItem({ ratingKey: 'c2' }),
            ]);

            const source: MixedContentSource = {
                type: 'mixed',
                sources: [
                    { type: 'library', libraryId: 'lib1', libraryType: 'movie', includeWatched: true },
                    { type: 'collection', collectionKey: 'col1', collectionName: 'Col' },
                ],
                mixMode: 'sequential',
            };

            const result = await resolver.resolveSource(source);

            expect(result.map((item) => item.ratingKey)).toEqual(['l1', 'l2', 'c1', 'c2']);
        });

        it('resolves mixed category sources across movie and show libraries with same filter key', async () => {
            mockLibrary.getLibraryItems.mockImplementation(async (libraryId, options) => {
                if (libraryId === 'movie-lib') {
                    return [
                        createMockItem({ ratingKey: 'm1', genres: ['Action'] }),
                        createMockItem({ ratingKey: 'm2', genres: ['Action'] }),
                    ];
                }
                if (libraryId === 'show-lib' && options?.filter?.type === PLEX_MEDIA_TYPES.EPISODE) {
                    return [
                        createMockEpisode(1, 1, { ratingKey: 's1e1', genres: ['Action'] }),
                    ];
                }
                if (libraryId === 'show-lib') {
                    return [];
                }
                return [];
            });

            const source: MixedContentSource = {
                type: 'mixed',
                sources: [
                    {
                        type: 'library',
                        libraryId: 'movie-lib',
                        libraryType: 'movie',
                        includeWatched: true,
                        libraryFilter: { genre: 'Action' },
                    },
                    {
                        type: 'library',
                        libraryId: 'show-lib',
                        libraryType: 'show',
                        includeWatched: true,
                        libraryFilter: { genre: 'Action' },
                    },
                ],
                mixMode: 'interleave',
            };

            const result = await resolver.resolveSource(source);

            expect(result.map((item) => item.ratingKey)).toEqual(['m1', 's1e1', 'm2']);
            expect(mockLibrary.getLibraryItems).toHaveBeenCalledWith(
                'movie-lib',
                expect.objectContaining({ filter: expect.objectContaining({ genre: 'Action' }) })
            );
            expect(mockLibrary.getLibraryItems).toHaveBeenCalledWith(
                'show-lib',
                expect.objectContaining({ filter: expect.objectContaining({ genre: 'Action', type: PLEX_MEDIA_TYPES.EPISODE }) })
            );
        });

        // Issue 5: Errors now propagate for cached fallback handling by ChannelManager
        it('should propagate errors for cached fallback handling', async () => {
            mockLibrary.getLibraryItems.mockRejectedValue(new Error('404'));

            const source: LibraryContentSource = {
                type: 'library',
                libraryId: 'lib1',
                libraryType: 'movie',
                includeWatched: true,
            };

            await expect(resolver.resolveSource(source)).rejects.toThrow('404');
        });

        it('should cache show lists for show libraries within TTL', async () => {
            const episodes = [createMockEpisode(1, 1, { ratingKey: 'ep1', grandparentRatingKey: 'show1' })];
            const shows = [createMockItem({ ratingKey: 'show1', type: 'show', genres: ['Drama'] })];
            mockLibrary.getLibraryItems.mockImplementation((_, options) => {
                if (options?.filter?.type === PLEX_MEDIA_TYPES.EPISODE) {
                    return Promise.resolve(episodes);
                }
                return Promise.resolve(shows);
            });

            const source: LibraryContentSource = {
                type: 'library',
                libraryId: 'show-lib',
                libraryType: 'show',
                includeWatched: true,
            };

            await resolver.resolveSource(source);
            await resolver.resolveSource(source);

            const showCalls = mockLibrary.getLibraryItems.mock.calls.filter(
                ([, options]) => !options?.filter || options.filter.type === undefined
            );
            expect(showCalls).toHaveLength(1);
        });

        it('should use cached show list when show fetch fails', async () => {
            const episodes = [createMockEpisode(1, 1, { ratingKey: 'ep1', grandparentRatingKey: 'show1' })];
            const shows = [createMockItem({ ratingKey: 'show1', type: 'show', genres: ['Drama'] })];
            let showCallCount = 0;
            mockLibrary.getLibraryItems.mockImplementation((_, options) => {
                if (options?.filter?.type === PLEX_MEDIA_TYPES.EPISODE) {
                    return Promise.resolve(episodes);
                }
                showCallCount++;
                if (showCallCount === 1) {
                    return Promise.resolve(shows);
                }
                return Promise.reject(new Error('show fetch failed'));
            });
            const nowSpy = jest.spyOn(Date, 'now');
            let nowMs = 0;
            nowSpy.mockImplementation(() => nowMs);

            const source: LibraryContentSource = {
                type: 'library',
                libraryId: 'show-lib',
                libraryType: 'show',
                includeWatched: true,
            };

            await resolver.resolveSource(source);
            nowMs = 300001;
            const second = await resolver.resolveSource(source);

            expect(second).toHaveLength(1);
            expect(showCallCount).toBe(2);
            nowSpy.mockRestore();
        });

        it('should propagate AbortError instead of using cached show list', async () => {
            const episodes = [createMockEpisode(1, 1, { ratingKey: 'ep1', grandparentRatingKey: 'show1' })];
            const shows = [createMockItem({ ratingKey: 'show1', type: 'show', genres: ['Drama'] })];
            let showCallCount = 0;
            mockLibrary.getLibraryItems.mockImplementation((_, options) => {
                if (options?.filter?.type === PLEX_MEDIA_TYPES.EPISODE) {
                    return Promise.resolve(episodes);
                }
                showCallCount++;
                if (showCallCount === 1) {
                    return Promise.resolve(shows);
                }
                return Promise.reject({ name: 'AbortError' });
            });
            const nowSpy = jest.spyOn(Date, 'now');
            let nowMs = 0;
            nowSpy.mockImplementation(() => nowMs);

            const source: LibraryContentSource = {
                type: 'library',
                libraryId: 'show-lib',
                libraryType: 'show',
                includeWatched: true,
            };

            await resolver.resolveSource(source);
            nowMs = 300001;
            await expect(resolver.resolveSource(source)).rejects.toMatchObject({ name: 'AbortError' });
            nowSpy.mockRestore();
        });

        it('propagates grandparentThumb into showThumb for episodes', async () => {
            const episode = createMockEpisode(1, 1, {
                thumb: '/thumb/episode',
                grandparentThumb: '/thumb/show',
            });
            mockLibrary.getShowEpisodes.mockResolvedValue([episode]);

            const source: ShowContentSource = {
                type: 'show',
                showKey: 'show-1',
                showName: 'Test Show',
            };

            const result = await resolver.resolveSource(source);

            expect(result[0]?.showThumb).toBe('/thumb/show');
        });
    });

    describe('mediaInfo HDR detection', () => {
        it.each([
            {
                name: 'detects Dolby Vision via display title',
                stream: { displayTitle: 'Dolby Vision', doviPresent: true },
                expected: 'Dolby Vision',
            },
            {
                name: 'detects Dolby Vision via DOVI profile',
                stream: { doviProfile: '8.1' },
                expected: 'Dolby Vision',
            },
            {
                name: 'detects Dolby Vision via extended display title',
                stream: { extendedDisplayTitle: 'Dolby Vision (Profile 7)' },
                expected: 'Dolby Vision',
            },
            {
                name: 'detects HDR10+ via hdr field',
                stream: { hdr: 'HDR10+' },
                expected: 'HDR10+',
            },
            {
                name: 'detects HDR10 via dynamicRange',
                stream: { dynamicRange: 'HDR10' },
                expected: 'HDR10',
            },
            {
                name: 'detects HDR10 via colorTrc',
                stream: { colorTrc: 'smpte2084' },
                expected: 'HDR10',
            },
            {
                name: 'detects HLG via colorTrc',
                stream: { colorTrc: 'arib-std-b67' },
                expected: 'HLG',
            },
        ])('$name', async ({ stream, expected }) => {
            const item = createMockItem({
                media: [createMockMedia(stream)],
            });
            mockLibrary.getLibraryItems.mockResolvedValue([item]);

            const source: LibraryContentSource = {
                type: 'library',
                libraryId: 'lib-hdr',
                libraryType: 'movie',
                includeWatched: true,
            };

            const result = await resolver.resolveSource(source);

            expect(result[0]?.mediaInfo?.hdr).toBe(expected);
        });

        it('does not label SDR content as HDR', async () => {
            const item = createMockItem({
                media: [createMockMedia({})],
            });
            mockLibrary.getLibraryItems.mockResolvedValue([item]);

            const source: LibraryContentSource = {
                type: 'library',
                libraryId: 'lib-sdr',
                libraryType: 'movie',
                includeWatched: true,
            };

            const result = await resolver.resolveSource(source);

            expect(result[0]?.mediaInfo?.hdr).toBeUndefined();
        });
    });

    describe('applyFilters', () => {
        const items: ResolvedContentItem[] = [
            { ratingKey: '1', type: 'movie', title: 'A', fullTitle: 'A', durationMs: 3600000, thumb: null, year: 2018, scheduledIndex: 0 },
            { ratingKey: '2', type: 'movie', title: 'B', fullTitle: 'B', durationMs: 7200000, thumb: null, year: 2020, scheduledIndex: 1 },
            { ratingKey: '3', type: 'movie', title: 'C', fullTitle: 'C', durationMs: 5400000, thumb: null, year: 2022, scheduledIndex: 2 },
        ];

        it('should filter by year gte', () => {
            const filter: ContentFilter = { field: 'year', operator: 'gte', value: 2020 };
            const result = resolver.applyFilters(items, [filter]);
            expect(result).toHaveLength(2);
            expect(result.every((i) => i.year >= 2020)).toBe(true);
        });

        it('should filter by year eq', () => {
            const filter: ContentFilter = { field: 'year', operator: 'eq', value: 2020 };
            const result = resolver.applyFilters(items, [filter]);
            expect(result).toHaveLength(1);
            expect(result[0]!.year).toBe(2020);
        });

        it('should filter by duration lt', () => {
            const filter: ContentFilter = { field: 'duration', operator: 'lt', value: 6000000 };
            const result = resolver.applyFilters(items, [filter]);
            expect(result).toHaveLength(2);
        });

        it('should apply multiple filters with AND logic', () => {
            const filters: ContentFilter[] = [
                { field: 'year', operator: 'gte', value: 2019 },
                { field: 'duration', operator: 'lte', value: 6000000 },
            ];
            const result = resolver.applyFilters(items, filters);
            expect(result).toHaveLength(1);
            expect(result[0]!.ratingKey).toBe('3');
        });

        it('should reject items missing rating/contentRating/watched/addedAt when filter present', () => {
            const missing: ResolvedContentItem = {
                ratingKey: 'm1',
                type: 'movie',
                title: 'Missing',
                fullTitle: 'Missing',
                durationMs: 1000,
                thumb: null,
                year: 2020,
                scheduledIndex: 0,
            };
            const filtered = resolver.applyFilters([missing], [
                { field: 'rating', operator: 'gte', value: 5 },
                { field: 'contentRating', operator: 'eq', value: 'PG' },
                { field: 'watched', operator: 'eq', value: true },
                { field: 'addedAt', operator: 'gte', value: 10 },
            ]);
            expect(filtered).toHaveLength(0);
        });

        it('should treat missing genre/director arrays as empty for neq/notContains', () => {
            const missing: ResolvedContentItem = {
                ratingKey: 'm2',
                type: 'movie',
                title: 'Missing',
                fullTitle: 'Missing',
                durationMs: 1000,
                thumb: null,
                year: 2020,
                scheduledIndex: 0,
            };
            const result = resolver.applyFilters([missing], [
                { field: 'genre', operator: 'neq', value: 'Drama' },
                { field: 'director', operator: 'notContains', value: 'Smith' },
            ]);
            expect(result).toHaveLength(1);
        });
    });

    describe('source cache key stability', () => {
        it('treats optional undefined fields as omitted for cache keys', async () => {
            mockLibrary.getLibraryItems.mockResolvedValue([createMockItem({ ratingKey: 'cache-1' })]);

            const base = {
                type: 'library',
                libraryId: 'lib-cache',
                libraryType: 'movie',
                includeWatched: true,
            } as const;

            const withUndefined = ({
                ...base,
                libraryFilter: undefined,
            } as unknown) as LibraryContentSource;

            const omitted = (base as unknown) as LibraryContentSource;

            await resolver.resolveSource(withUndefined);
            await resolver.resolveSource(omitted);

            expect(mockLibrary.getLibraryItems).toHaveBeenCalledTimes(1);
        });
    });

    describe('applySort', () => {
        const items: ResolvedContentItem[] = [
            { ratingKey: '1', type: 'movie', title: 'Zebra', fullTitle: 'Zebra', durationMs: 3600000, thumb: null, year: 2020, scheduledIndex: 0 },
            { ratingKey: '2', type: 'movie', title: 'Apple', fullTitle: 'Apple', durationMs: 7200000, thumb: null, year: 2018, scheduledIndex: 1 },
            { ratingKey: '3', type: 'movie', title: 'Mango', fullTitle: 'Mango', durationMs: 5400000, thumb: null, year: 2022, scheduledIndex: 2 },
        ];

        it('should sort by title ascending', () => {
            const result = resolver.applySort(items, 'title_asc');
            expect(result[0]!.title).toBe('Apple');
            expect(result[2]!.title).toBe('Zebra');
        });

        it('should sort by title descending', () => {
            const result = resolver.applySort(items, 'title_desc');
            expect(result[0]!.title).toBe('Zebra');
            expect(result[2]!.title).toBe('Apple');
        });

        it('should sort by year ascending', () => {
            const result = resolver.applySort(items, 'year_asc');
            expect(result[0]!.year).toBe(2018);
            expect(result[2]!.year).toBe(2022);
        });

        it('should sort by duration descending', () => {
            const result = resolver.applySort(items, 'duration_desc');
            expect(result[0]!.durationMs).toBe(7200000);
            expect(result[2]!.durationMs).toBe(3600000);
        });

        it('should sort by episode order', () => {
            const episodes: ResolvedContentItem[] = [
                { ratingKey: '1', type: 'episode', title: 'Ep3', fullTitle: 'Ep3', durationMs: 1000, thumb: null, year: 2020, seasonNumber: 2, episodeNumber: 1, scheduledIndex: 0 },
                { ratingKey: '2', type: 'episode', title: 'Ep1', fullTitle: 'Ep1', durationMs: 1000, thumb: null, year: 2020, seasonNumber: 1, episodeNumber: 1, scheduledIndex: 1 },
                { ratingKey: '3', type: 'episode', title: 'Ep2', fullTitle: 'Ep2', durationMs: 1000, thumb: null, year: 2020, seasonNumber: 1, episodeNumber: 2, scheduledIndex: 2 },
            ];
            const result = resolver.applySort(episodes, 'episode_order');
            expect(result[0]!.seasonNumber).toBe(1);
            expect(result[0]!.episodeNumber).toBe(1);
            expect(result[1]!.episodeNumber).toBe(2);
            expect(result[2]!.seasonNumber).toBe(2);
        });
    });

    describe('applyPlaybackMode', () => {
        const items: ResolvedContentItem[] = [
            { ratingKey: '1', type: 'movie', title: 'A', fullTitle: 'A', durationMs: 1000, thumb: null, year: 2020, scheduledIndex: 0 },
            { ratingKey: '2', type: 'movie', title: 'B', fullTitle: 'B', durationMs: 1000, thumb: null, year: 2020, scheduledIndex: 1 },
            { ratingKey: '3', type: 'movie', title: 'C', fullTitle: 'C', durationMs: 1000, thumb: null, year: 2020, scheduledIndex: 2 },
        ];

        it('should preserve order for sequential mode', () => {
            const result = resolver.applyPlaybackMode(items, 'sequential', 12345);
            expect(result.map((i) => i.ratingKey)).toEqual(['1', '2', '3']);
        });

        it('should shuffle deterministically for shuffle mode', () => {
            const result1 = resolver.applyPlaybackMode(items, 'shuffle', 12345);
            const result2 = resolver.applyPlaybackMode(items, 'shuffle', 12345);
            expect(result1.map((i) => i.ratingKey)).toEqual(result2.map((i) => i.ratingKey));
        });

        it('should update scheduledIndex after shuffle', () => {
            const result = resolver.applyPlaybackMode(items, 'shuffle', 12345);
            expect(result[0]!.scheduledIndex).toBe(0);
            expect(result[1]!.scheduledIndex).toBe(1);
            expect(result[2]!.scheduledIndex).toBe(2);
        });
    });

    describe('fullTitle generation', () => {
        it('should build full title for episodes', async () => {
            const episode = createMockEpisode(1, 5, {
                grandparentTitle: 'Breaking Bad',
                title: 'Gray Matter',
            });
            mockLibrary.getShowEpisodes.mockResolvedValue([episode]);

            const source: ShowContentSource = {
                type: 'show',
                showKey: 'show1',
                showName: 'Breaking Bad',
            };

            const result = await resolver.resolveSource(source);

            expect(result[0]!.fullTitle).toBe('Breaking Bad - S01E05 - Gray Matter');
        });

        it('should use title only for movies', async () => {
            const movie = createMockItem({ title: 'Inception' });
            mockLibrary.getLibraryItems.mockResolvedValue([movie]);

            const source: LibraryContentSource = {
                type: 'library',
                libraryId: 'lib1',
                libraryType: 'movie',
                includeWatched: true,
            };

            const result = await resolver.resolveSource(source);

            expect(result[0]!.fullTitle).toBe('Inception');
        });
    });
});
