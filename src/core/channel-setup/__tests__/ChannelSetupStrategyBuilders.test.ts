import { buildChannelSetupStrategyBuckets } from '../planning/ChannelSetupStrategyBuilders';
import type { ChannelSetupConfig } from '../types';
import type {
    PlexCollection,
    PlexLibrarySection,
    PlexPlaylist,
    PlexTagDirectoryItem,
} from '../../../modules/plex/library';

const createConfig = (overrides: Partial<ChannelSetupConfig> = {}): ChannelSetupConfig => ({
    serverId: 'server-1',
    selectedLibraryIds: ['lib-1'],
    maxChannels: 10,
    buildMode: 'replace',
    strategyConfig: {
        collections: { enabled: false, priority: 1, scope: 'per-library' },
        playlists: { enabled: true, priority: 2, scope: 'per-library' },
        genres: { enabled: false, priority: 3, scope: 'per-library' },
        directors: { enabled: false, priority: 4, scope: 'per-library' },
        decades: { enabled: false, priority: 5, scope: 'per-library' },
        recentlyAdded: { enabled: false, priority: 6, scope: 'per-library' },
        studios: { enabled: false, priority: 7, scope: 'per-library' },
        actors: { enabled: false, priority: 8, scope: 'per-library' },
    },
    actorStudioCombineMode: 'separate',
    minItemsPerChannel: 5,
    ...overrides,
});

const createLibrary = (overrides: Partial<PlexLibrarySection> = {}): PlexLibrarySection => ({
    id: 'lib-1',
    key: '1',
    title: 'Movies',
    type: 'movie',
    agent: 'tv.plex.agents.movie',
    scanner: 'Plex Movie',
    language: 'en',
    updatedAt: 0,
    uuid: 'uuid-1',
    icon: null,
    art: null,
    composite: null,
    content: true,
    refreshable: true,
    thumb: null,
    contentCount: 10,
    ...overrides,
} as PlexLibrarySection);

const createPlaylist = (title: string, leafCount: number, ratingKey: string): PlexPlaylist => ({
    title,
    leafCount,
    ratingKey,
} as PlexPlaylist);

const createCollection = (title: string, childCount: number, ratingKey: string): PlexCollection => ({
    title,
    childCount,
    ratingKey,
    key: `/library/collections/${ratingKey}`,
    thumb: null,
});

const createTag = (title: string, count: number | null, key: string = title.toLowerCase()): PlexTagDirectoryItem => ({
    key,
    title,
    count,
});

describe('ChannelSetupStrategyBuilders', () => {
    it('accounts for playlist candidates before and after min-items filtering', () => {
        const result = buildChannelSetupStrategyBuckets({
            config: createConfig(),
            selectedLibraries: [createLibrary()],
            playlists: [
                createPlaylist('Short List', 4, 'pl-short'),
                createPlaylist('Long List', 7, 'pl-long'),
            ],
            collectionsByLibraryId: new Map(),
            genresByLibraryId: new Map(),
            directorsByLibraryId: new Map(),
            yearsByLibraryId: new Map(),
            actorsByLibraryId: new Map(),
            studiosByLibraryId: new Map(),
            minItems: 5,
            seedFor: (value) => value.length,
        });

        expect(result.candidatesBeforeMinItems).toMatchObject({ total: 2, playlists: 2 });
        expect(result.candidatesAfterMinItems).toMatchObject({ total: 1, playlists: 1 });
        expect(result.skipped).toBe(1);
        expect(result.strategyBuckets.playlists).toEqual([
            expect.objectContaining({
                name: 'Long List',
                buildStrategy: 'playlists',
                lineupReplicaIndex: 0,
                isPlaybackModeVariant: false,
                contentSource: expect.objectContaining({
                    type: 'playlist',
                    playlistKey: 'pl-long',
                }),
            }),
        ]);
    });

    it('keeps disabled strategy buckets empty without counting candidates', () => {
        const result = buildChannelSetupStrategyBuckets({
            config: createConfig({
                strategyConfig: {
                    ...createConfig().strategyConfig,
                    playlists: { enabled: false, priority: 2, scope: 'per-library' },
                    collections: { enabled: false, priority: 1, scope: 'per-library' },
                },
            }),
            selectedLibraries: [createLibrary()],
            playlists: [createPlaylist('Long List', 7, 'pl-long')],
            collectionsByLibraryId: new Map([
                ['lib-1', [createCollection('Directors Cut', 8, 'col-1')]],
            ]),
            genresByLibraryId: new Map(),
            directorsByLibraryId: new Map(),
            yearsByLibraryId: new Map(),
            actorsByLibraryId: new Map(),
            studiosByLibraryId: new Map(),
            minItems: 5,
            seedFor: (value) => value.length,
        });

        expect(result.strategyBuckets.playlists).toEqual([]);
        expect(result.strategyBuckets.collections).toEqual([]);
        expect(result.candidatesBeforeMinItems).toMatchObject({ total: 0, playlists: 0, collections: 0 });
        expect(result.candidatesAfterMinItems).toMatchObject({ total: 0, playlists: 0, collections: 0 });
        expect(result.skipped).toBe(0);
    });

    it('uses cross-library scope to build one mixed bucket per shared facet', () => {
        const result = buildChannelSetupStrategyBuckets({
            config: createConfig({
                selectedLibraryIds: ['lib-1', 'lib-2'],
                strategyConfig: {
                    ...createConfig().strategyConfig,
                    playlists: { enabled: false, priority: 2, scope: 'per-library' },
                    genres: { enabled: true, priority: 3, scope: 'cross-library' },
                },
            }),
            selectedLibraries: [
                createLibrary({ id: 'lib-1', title: 'Movies' }),
                createLibrary({ id: 'lib-2', title: 'TV', type: 'show' }),
            ],
            playlists: [],
            collectionsByLibraryId: new Map(),
            genresByLibraryId: new Map([
                ['lib-1', [createTag('Action', 6, 'genre-1')]],
                ['lib-2', [createTag('Action', 7, 'genre-2')]],
            ]),
            directorsByLibraryId: new Map(),
            yearsByLibraryId: new Map(),
            actorsByLibraryId: new Map(),
            studiosByLibraryId: new Map(),
            minItems: 5,
            seedFor: (value) => value.length,
        });

        expect(result.strategyBuckets.genres).toEqual([
            expect.objectContaining({
                name: 'Action',
                buildStrategy: 'genres',
                lineupReplicaIndex: 0,
                isPlaybackModeVariant: false,
                contentSource: expect.objectContaining({
                    type: 'mixed',
                    mixMode: 'interleave',
                    sources: expect.arrayContaining([
                        expect.objectContaining({ type: 'library', libraryId: 'lib-1' }),
                        expect.objectContaining({ type: 'library', libraryId: 'lib-2' }),
                    ]),
                }),
            }),
        ]);
        expect(result.candidatesBeforeMinItems).toMatchObject({ total: 1, genres: 1 });
        expect(result.candidatesAfterMinItems).toMatchObject({ total: 1, genres: 1 });
        expect(result.skipped).toBe(0);
    });

    it('builds mixed enabled strategy buckets with per-library and global metadata intact', () => {
        const result = buildChannelSetupStrategyBuckets({
            config: createConfig({
                strategyConfig: {
                    ...createConfig().strategyConfig,
                    playlists: { enabled: false, priority: 2, scope: 'per-library' },
                    collections: { enabled: true, priority: 1, scope: 'per-library' },
                    directors: { enabled: true, priority: 4, scope: 'per-library' },
                    recentlyAdded: { enabled: true, priority: 6, scope: 'per-library' },
                    studios: { enabled: true, priority: 7, scope: 'per-library' },
                    actors: { enabled: true, priority: 8, scope: 'per-library' },
                },
            }),
            selectedLibraries: [createLibrary()],
            playlists: [],
            collectionsByLibraryId: new Map([
                ['lib-1', [createCollection('Favorites', 9, 'col-fav')]],
            ]),
            genresByLibraryId: new Map(),
            directorsByLibraryId: new Map([
                ['lib-1', [createTag('Jane Director', 8, 'dir-1')]],
            ]),
            yearsByLibraryId: new Map(),
            actorsByLibraryId: new Map([
                ['lib-1', [createTag('Alex Actor', 7, 'actor-1')]],
            ]),
            studiosByLibraryId: new Map([
                ['lib-1', [createTag('Studio One', null, 'studio-1')]],
            ]),
            minItems: 5,
            seedFor: (value) => value.length,
        });

        expect(result.strategyBuckets.collections).toEqual([
            expect.objectContaining({
                name: 'Favorites',
                contentSource: expect.objectContaining({ type: 'collection', collectionKey: 'col-fav' }),
                sourceLibraryId: 'lib-1',
                sourceLibraryName: 'Movies',
            }),
        ]);
        expect(result.strategyBuckets.directors).toEqual([
            expect.objectContaining({
                name: 'Movies - Jane Director',
                contentFilters: [{ field: 'director', operator: 'eq', value: 'Jane Director' }],
                sourceLibraryId: 'lib-1',
            }),
        ]);
        expect(result.strategyBuckets.recentlyAdded).toEqual([
            expect.objectContaining({
                name: 'Movies - Recently Added',
                sortOrder: 'added_desc',
                contentSource: expect.objectContaining({ type: 'library', libraryId: 'lib-1' }),
            }),
        ]);
        expect(result.strategyBuckets.actors).toEqual([
            expect.objectContaining({
                name: 'Alex Actor - Movies',
                contentSource: expect.objectContaining({
                    type: 'library',
                    libraryFilter: expect.objectContaining({ actor: 'actor-1' }),
                }),
            }),
        ]);
        expect(result.strategyBuckets.studios).toEqual([
            expect.objectContaining({
                name: 'Studio One - Movies',
                contentSource: expect.objectContaining({
                    type: 'library',
                    libraryFilter: expect.objectContaining({ studio: 'studio-1' }),
                }),
            }),
        ]);
        expect(result.candidatesBeforeMinItems).toMatchObject({
            total: 5,
            collections: 1,
            directors: 1,
            recentlyAdded: 1,
            actors: 1,
            studios: 1,
        });
        expect(result.candidatesAfterMinItems).toMatchObject({
            total: 5,
            collections: 1,
            directors: 1,
            recentlyAdded: 1,
            actors: 1,
            studios: 1,
        });
        expect(result.skipped).toBe(0);
        for (const bucket of Object.values(result.strategyBuckets).flat()) {
            expect(bucket.lineupReplicaIndex).toBe(0);
            expect(bucket.isPlaybackModeVariant).toBe(false);
        }
    });
});
