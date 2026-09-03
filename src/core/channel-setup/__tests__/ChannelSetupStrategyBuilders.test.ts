import {
    buildChannelSetupStrategyBuckets,
    buildChannelSetupStrategyBucketsCooperatively,
} from '../planning/ChannelSetupStrategyBuilders';
import {
    buildChannelSetupPlan,
    buildChannelSetupPlanCooperatively,
} from '../planning/ChannelSetupPlanner';
import {
    createPeopleIndexFromItems,
    createPeopleSeriesIndexFromEpisodes,
} from '../planning/ChannelSetupPeopleSeriesIndex';
import type { ChannelSetupConfig } from '../types';
import type {
    PlexCollection,
    PlexLibrarySection,
    PlexMediaItem,
    PlexPlaylist,
    PlexTagDirectoryItem,
} from '../../../modules/plex/library';
import type { LibraryContentSource } from '../../../modules/scheduler/channel-manager';

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

const createEpisode = (
    title: string,
    seriesKey: string,
    people: { actors?: string[]; directors?: string[] }
): PlexMediaItem => ({
    ratingKey: title,
    key: `/library/metadata/${title}`,
    type: 'episode',
    title,
    sortTitle: title,
    summary: '',
    year: 2024,
    durationMs: 1000,
    addedAt: new Date(0),
    updatedAt: new Date(0),
    thumb: null,
    art: null,
    grandparentRatingKey: seriesKey,
    media: [],
    ...people,
} as PlexMediaItem);

const createMovie = (
    title: string,
    people: { actors?: string[]; directors?: string[] }
): PlexMediaItem => ({
    ratingKey: title,
    key: `/library/metadata/${title}`,
    type: 'movie',
    title,
    sortTitle: title,
    summary: '',
    year: 2024,
    durationMs: 1000,
    addedAt: new Date(0),
    updatedAt: new Date(0),
    thumb: null,
    art: null,
    media: [],
    ...people,
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
            peopleSeriesIndexByLibraryId: new Map(),
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
            peopleSeriesIndexByLibraryId: new Map(),
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
            peopleSeriesIndexByLibraryId: new Map(),
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

    it('uses stable Plex tag keys for per-library genre and director shuffle seeds', () => {
        const seedFor = jest.fn((value: string) => {
            const seeds: Record<string, number> = {
                'genre:lib-1:genre-action': 101,
                'director:lib-1:director-jane': 202,
            };
            return seeds[value] ?? 0;
        });

        const result = buildChannelSetupStrategyBuckets({
            config: createConfig({
                strategyConfig: {
                    ...createConfig().strategyConfig,
                    playlists: { enabled: false, priority: 2, scope: 'per-library' },
                    genres: { enabled: true, priority: 3, scope: 'per-library' },
                    directors: { enabled: true, priority: 4, scope: 'per-library' },
                },
            }),
            selectedLibraries: [createLibrary()],
            playlists: [],
            collectionsByLibraryId: new Map(),
            genresByLibraryId: new Map([
                ['lib-1', [createTag(' Action ', 8, 'genre-action')]],
            ]),
            directorsByLibraryId: new Map([
                ['lib-1', [createTag('JANE Director', 8, 'director-jane')]],
            ]),
            yearsByLibraryId: new Map(),
            actorsByLibraryId: new Map(),
            studiosByLibraryId: new Map(),
            peopleSeriesIndexByLibraryId: new Map(),
            minItems: 5,
            seedFor,
        });

        expect(seedFor).toHaveBeenCalledWith('genre:lib-1:genre-action');
        expect(seedFor).toHaveBeenCalledWith('director:lib-1:director-jane');
        expect(result.strategyBuckets.genres[0]?.shuffleSeed).toBe(101);
        expect(result.strategyBuckets.directors[0]?.shuffleSeed).toBe(202);
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
                // Unknown Plex counts are allowed through min-items filtering.
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

    it('includes the source library title in per-library actor and studio channel names', () => {
        const result = buildChannelSetupStrategyBuckets({
            config: createConfig({
                selectedLibraryIds: ['lib-1', 'lib-2'],
                strategyConfig: {
                    ...createConfig().strategyConfig,
                    playlists: { enabled: false, priority: 2, scope: 'per-library' },
                    studios: { enabled: true, priority: 7, scope: 'per-library' },
                    actors: { enabled: true, priority: 8, scope: 'per-library' },
                },
            }),
            selectedLibraries: [
                createLibrary({ id: 'lib-1', title: 'Movies' }),
                createLibrary({ id: 'lib-2', title: 'Kids Movies' }),
            ],
            playlists: [],
            collectionsByLibraryId: new Map(),
            genresByLibraryId: new Map(),
            directorsByLibraryId: new Map(),
            yearsByLibraryId: new Map(),
            actorsByLibraryId: new Map([
                ['lib-1', [createTag('Alex Actor', 7, 'actor-1')]],
                ['lib-2', [createTag('Alex Actor', 7, 'actor-1')]],
            ]),
            studiosByLibraryId: new Map([
                ['lib-1', [createTag('Studio One', 7, 'studio-1')]],
                ['lib-2', [createTag('Studio One', 7, 'studio-1')]],
            ]),
            minItems: 5,
            seedFor: (value) => value.length,
        });

        expect(result.strategyBuckets.actors.map((channel) => channel.name)).toEqual([
            'Alex Actor - Movies',
            'Alex Actor - Kids Movies',
        ]);
        expect(result.strategyBuckets.studios.map((channel) => channel.name)).toEqual([
            'Studio One - Movies',
            'Studio One - Kids Movies',
        ]);
    });

    it('requires TV people to satisfy episode count and distinct series breadth', () => {
        const tvLibrary = createLibrary({ id: 'tv-1', title: 'TV', type: 'show' });
        const peopleSeriesIndex = createPeopleSeriesIndexFromEpisodes(tvLibrary, [
            createEpisode('qualified-1', 'show-a', { actors: ['Alex Actor'], directors: ['Dana Director'] }),
            createEpisode('qualified-2', 'show-b', { actors: ['Alex Actor'], directors: ['Dana Director'] }),
            createEpisode('qualified-3', 'show-c', { actors: ['Alex Actor'], directors: ['Dana Director'] }),
            createEpisode('qualified-4', 'show-c', { actors: ['Alex Actor'], directors: ['Dana Director'] }),
            createEpisode('single-series-1', 'show-a', { actors: ['Single Show Actor'], directors: ['Single Show Director'] }),
            createEpisode('single-series-2', 'show-a', { actors: ['Single Show Actor'], directors: ['Single Show Director'] }),
            createEpisode('single-series-3', 'show-a', { actors: ['Single Show Actor'], directors: ['Single Show Director'] }),
            createEpisode('single-series-4', 'show-a', { actors: ['Single Show Actor'], directors: ['Single Show Director'] }),
            createEpisode('below-min-1', 'show-a', { actors: ['Below Min Actor'], directors: ['Below Min Director'] }),
            createEpisode('below-min-2', 'show-b', { actors: ['Below Min Actor'], directors: ['Below Min Director'] }),
            createEpisode('below-min-3', 'show-c', { actors: ['Below Min Actor'], directors: ['Below Min Director'] }),
        ]);

        const result = buildChannelSetupStrategyBuckets({
            config: createConfig({
                selectedLibraryIds: ['tv-1'],
                strategyConfig: {
                    ...createConfig().strategyConfig,
                    playlists: { enabled: false, priority: 2, scope: 'per-library' },
                    actors: { enabled: true, priority: 8, scope: 'per-library' },
                    directors: { enabled: true, priority: 4, scope: 'per-library' },
                },
            }),
            selectedLibraries: [tvLibrary],
            playlists: [],
            collectionsByLibraryId: new Map(),
            genresByLibraryId: new Map(),
            directorsByLibraryId: new Map([['tv-1', [
                createTag('Dana Director', 4, 'director-qualified'),
                createTag('Single Show Director', 4, 'director-single'),
                createTag('Below Min Director', 3, 'director-below'),
            ]]]),
            yearsByLibraryId: new Map(),
            actorsByLibraryId: new Map([['tv-1', [
                createTag('Alex Actor', 4, 'actor-qualified'),
                createTag('Single Show Actor', 4, 'actor-single'),
                createTag('Below Min Actor', 3, 'actor-below'),
            ]]]),
            studiosByLibraryId: new Map(),
            peopleSeriesIndexByLibraryId: new Map([['tv-1', peopleSeriesIndex]]),
            minItems: 4,
            seedFor: (value) => value.length,
        });

        expect(result.strategyBuckets.actors.map((channel) => channel.name)).toEqual(['Alex Actor - TV']);
        expect(result.strategyBuckets.directors.map((channel) => channel.name)).toEqual(['TV - Dana Director']);
        expect(result.candidatesBeforeMinItems).toMatchObject({ actors: 3, directors: 3 });
        expect(result.candidatesAfterMinItems).toMatchObject({ actors: 1, directors: 1 });
        expect(result.skipped).toBe(4);
    });

    it('orders null-count TV actors by derived index count before applying the channel cap', async () => {
        const tvLibrary = createLibrary({ id: 'tv-1', title: 'TV', type: 'show' });
        const peopleSeriesIndex = createPeopleSeriesIndexFromEpisodes(tvLibrary, [
            createEpisode('zed-1', 'zed-series-1', { actors: ['Zed Actor'] }),
            createEpisode('zed-2', 'zed-series-2', { actors: ['Zed Actor'] }),
            createEpisode('zed-3', 'zed-series-3', { actors: ['Zed Actor'] }),
            createEpisode('zed-4', 'zed-series-1', { actors: ['Zed Actor'] }),
            createEpisode('zed-5', 'zed-series-2', { actors: ['Zed Actor'] }),
            createEpisode('alpha-1', 'alpha-series-1', { actors: ['Alpha Actor'] }),
            createEpisode('alpha-2', 'alpha-series-2', { actors: ['Alpha Actor'] }),
            createEpisode('alpha-3', 'alpha-series-3', { actors: ['Alpha Actor'] }),
            createEpisode('alpha-4', 'alpha-series-1', { actors: ['Alpha Actor'] }),
            createEpisode('beta-1', 'beta-series-1', { actors: ['Beta Actor'] }),
            createEpisode('beta-2', 'beta-series-2', { actors: ['Beta Actor'] }),
            createEpisode('beta-3', 'beta-series-3', { actors: ['Beta Actor'] }),
            createEpisode('beta-4', 'beta-series-1', { actors: ['Beta Actor'] }),
        ]);
        const config = createConfig({
            selectedLibraryIds: ['tv-1'],
            maxChannels: 1,
            minItemsPerChannel: 3,
            strategyConfig: {
                ...createConfig().strategyConfig,
                playlists: { enabled: false, priority: 2, scope: 'per-library' },
                actors: { enabled: true, priority: 8, scope: 'per-library' },
            },
        });
        const input = {
            config,
            libraries: [tvLibrary],
            selectedLibraries: [tvLibrary],
            playlists: [],
            collectionsByLibraryId: new Map(),
            genresByLibraryId: new Map(),
            directorsByLibraryId: new Map(),
            yearsByLibraryId: new Map(),
            actorsByLibraryId: new Map([['tv-1', [
                createTag('Alpha Actor', null, 'actor-alpha'),
                createTag('Beta Actor', null, 'actor-beta'),
                createTag('Zed Actor', null, 'actor-zed'),
            ]]]),
            studiosByLibraryId: new Map(),
            peopleSeriesIndexByLibraryId: new Map([['tv-1', peopleSeriesIndex]]),
            minItems: 3,
            seedFor: (value: string): number => value.length,
        };

        const syncResult = buildChannelSetupStrategyBuckets(input);
        expect(syncResult.strategyBuckets.actors.map((channel) => channel.name)).toEqual([
            'Zed Actor - TV',
            'Alpha Actor - TV',
            'Beta Actor - TV',
        ]);

        const cooperativeResult = await buildChannelSetupStrategyBucketsCooperatively(
            input,
            async (): Promise<void> => undefined
        );
        expect(cooperativeResult.strategyBuckets.actors.map((channel) => channel.name)).toEqual([
            'Zed Actor - TV',
            'Alpha Actor - TV',
            'Beta Actor - TV',
        ]);

        const planInput = { ...input, warnings: [] };
        const syncPlan = buildChannelSetupPlan(planInput);
        expect(syncPlan.reachedMaxChannels).toBe(true);
        expect(syncPlan.pendingChannels.map((channel) => channel.name)).toEqual(['Zed Actor - TV']);

        const cooperativePlan = await buildChannelSetupPlanCooperatively(
            planInput,
            async (): Promise<void> => undefined
        );
        expect(cooperativePlan.reachedMaxChannels).toBe(true);
        expect(cooperativePlan.pendingChannels.map((channel) => channel.name)).toEqual(['Zed Actor - TV']);
    });

    it('orders null-count TV directors by derived index count before applying the channel cap', async () => {
        const tvLibrary = createLibrary({ id: 'tv-1', title: 'TV', type: 'show' });
        const peopleSeriesIndex = createPeopleSeriesIndexFromEpisodes(tvLibrary, [
            createEpisode('zed-1', 'zed-series-1', { directors: ['Zed Director'] }),
            createEpisode('zed-2', 'zed-series-2', { directors: ['Zed Director'] }),
            createEpisode('zed-3', 'zed-series-3', { directors: ['Zed Director'] }),
            createEpisode('zed-4', 'zed-series-4', { directors: ['Zed Director'] }),
            createEpisode('zed-5', 'zed-series-5', { directors: ['Zed Director'] }),
            createEpisode('alpha-1', 'alpha-series-1', { directors: ['Alpha Director'] }),
            createEpisode('alpha-2', 'alpha-series-2', { directors: ['Alpha Director'] }),
            createEpisode('alpha-3', 'alpha-series-3', { directors: ['Alpha Director'] }),
            createEpisode('alpha-4', 'alpha-series-4', { directors: ['Alpha Director'] }),
            createEpisode('beta-1', 'beta-series-1', { directors: ['Beta Director'] }),
            createEpisode('beta-2', 'beta-series-2', { directors: ['Beta Director'] }),
            createEpisode('beta-3', 'beta-series-3', { directors: ['Beta Director'] }),
        ]);
        const config = createConfig({
            selectedLibraryIds: ['tv-1'],
            maxChannels: 1,
            minItemsPerChannel: 3,
            strategyConfig: {
                ...createConfig().strategyConfig,
                playlists: { enabled: false, priority: 2, scope: 'per-library' },
                directors: { enabled: true, priority: 4, scope: 'per-library' },
            },
        });
        const input = {
            config,
            libraries: [tvLibrary],
            selectedLibraries: [tvLibrary],
            playlists: [],
            collectionsByLibraryId: new Map(),
            genresByLibraryId: new Map(),
            directorsByLibraryId: new Map([['tv-1', [
                createTag('Alpha Director', null, 'director-alpha'),
                createTag('Beta Director', null, 'director-beta'),
                createTag('Zed Director', null, 'director-zed'),
            ]]]),
            yearsByLibraryId: new Map(),
            actorsByLibraryId: new Map(),
            studiosByLibraryId: new Map(),
            peopleSeriesIndexByLibraryId: new Map([['tv-1', peopleSeriesIndex]]),
            minItems: 3,
            seedFor: (value: string): number => value.length,
        };

        const syncResult = buildChannelSetupStrategyBuckets(input);
        expect(syncResult.strategyBuckets.directors.map((channel) => channel.name)).toEqual([
            'TV - Zed Director',
            'TV - Alpha Director',
            'TV - Beta Director',
        ]);

        const cooperativeResult = await buildChannelSetupStrategyBucketsCooperatively(
            input,
            async (): Promise<void> => undefined
        );
        expect(cooperativeResult.strategyBuckets.directors.map((channel) => channel.name)).toEqual([
            'TV - Zed Director',
            'TV - Alpha Director',
            'TV - Beta Director',
        ]);

        const planInput = { ...input, warnings: [] };
        const syncPlan = buildChannelSetupPlan(planInput);
        expect(syncPlan.reachedMaxChannels).toBe(true);
        expect(syncPlan.pendingChannels.map((channel) => channel.name)).toEqual(['TV - Zed Director']);

        const cooperativePlan = await buildChannelSetupPlanCooperatively(
            planInput,
            async (): Promise<void> => undefined
        );
        expect(cooperativePlan.reachedMaxChannels).toBe(true);
        expect(cooperativePlan.pendingChannels.map((channel) => channel.name)).toEqual(['TV - Zed Director']);
    });

    it('keeps movie people eligible by movie item count without a TV index', () => {
        const result = buildChannelSetupStrategyBuckets({
            config: createConfig({
                strategyConfig: {
                    ...createConfig().strategyConfig,
                    playlists: { enabled: false, priority: 2, scope: 'per-library' },
                    actors: { enabled: true, priority: 8, scope: 'per-library' },
                    directors: { enabled: true, priority: 4, scope: 'per-library' },
                },
            }),
            selectedLibraries: [createLibrary()],
            playlists: [],
            collectionsByLibraryId: new Map(),
            genresByLibraryId: new Map(),
            directorsByLibraryId: new Map([['lib-1', [
                createTag('Movie Director', 5, 'director-movie'),
            ]]]),
            yearsByLibraryId: new Map(),
            actorsByLibraryId: new Map([['lib-1', [
                createTag('Movie Actor', 5, 'actor-movie'),
            ]]]),
            studiosByLibraryId: new Map(),
            minItems: 5,
            seedFor: (value) => value.length,
        });

        expect(result.strategyBuckets.actors).toHaveLength(1);
        expect(result.strategyBuckets.directors).toHaveLength(1);
    });

    it('uses derived movie people counts for exact filtering and count-first ordering in sync and cooperative plans', async () => {
        const movieLibrary = createLibrary();
        const movieIndex = createPeopleIndexFromItems(movieLibrary, [
            createMovie('above-1', { actors: ['Zed Above'], directors: ['Zed Director'] }),
            createMovie('above-2', { actors: ['Zed Above'], directors: ['Zed Director'] }),
            createMovie('above-3', { actors: ['Zed Above'], directors: ['Zed Director'] }),
            createMovie('above-4', { actors: ['Zed Above'], directors: ['Zed Director'] }),
            createMovie('equal-1', { actors: ['Alpha Equal'], directors: ['Alpha Director'] }),
            createMovie('equal-2', { actors: ['Alpha Equal'], directors: ['Alpha Director'] }),
            createMovie('equal-3', { actors: ['Alpha Equal'], directors: ['Alpha Director'] }),
            createMovie('below-1', { actors: ['Below'], directors: ['Below Director'] }),
            createMovie('below-2', { actors: ['Below'], directors: ['Below Director'] }),
        ]);
        const config = createConfig({
            maxChannels: 1,
            minItemsPerChannel: 3,
            strategyConfig: {
                ...createConfig().strategyConfig,
                playlists: { enabled: false, priority: 2, scope: 'per-library' },
                actors: { enabled: true, priority: 8, scope: 'per-library' },
                directors: { enabled: true, priority: 4, scope: 'per-library' },
            },
        });
        const input = {
            config,
            libraries: [movieLibrary],
            selectedLibraries: [movieLibrary],
            playlists: [],
            collectionsByLibraryId: new Map(),
            genresByLibraryId: new Map(),
            directorsByLibraryId: new Map([['lib-1', [
                createTag('Alpha Director', null, 'director-equal'),
                createTag('Below Director', null, 'director-below'),
                createTag('Zed Director', null, 'director-above'),
            ]]]),
            yearsByLibraryId: new Map(),
            actorsByLibraryId: new Map([['lib-1', [
                createTag('Alpha Equal', null, 'actor-equal'),
                createTag('Below', null, 'actor-below'),
                createTag('Missing Person', null, 'actor-missing'),
                createTag('Zed Above', null, 'actor-above'),
            ]]]),
            studiosByLibraryId: new Map(),
            peopleSeriesIndexByLibraryId: new Map([['lib-1', movieIndex]]),
            minItems: 3,
            seedFor: (value: string): number => value.length,
        };

        const syncBuckets = buildChannelSetupStrategyBuckets(input);
        const cooperativeBuckets = await buildChannelSetupStrategyBucketsCooperatively(
            input,
            async (): Promise<void> => undefined
        );
        expect(syncBuckets.strategyBuckets.actors.map((channel) => channel.name)).toEqual([
            'Zed Above - Movies',
            'Alpha Equal - Movies',
        ]);
        expect(syncBuckets.strategyBuckets.directors.map((channel) => channel.name)).toEqual([
            'Movies - Zed Director',
            'Movies - Alpha Director',
        ]);
        expect(cooperativeBuckets).toEqual(syncBuckets);
        expect(syncBuckets.candidatesBeforeMinItems).toMatchObject({ actors: 4, directors: 3 });
        expect(syncBuckets.candidatesAfterMinItems).toMatchObject({ actors: 2, directors: 2 });

        const actorOnlyInput = {
            ...input,
            config: {
                ...config,
                strategyConfig: {
                    ...config.strategyConfig,
                    directors: { enabled: false, priority: 4, scope: 'per-library' as const },
                },
            },
            directorsByLibraryId: new Map<string, PlexTagDirectoryItem[]>(),
        };
        const syncPlan = buildChannelSetupPlan({ ...actorOnlyInput, warnings: [] });
        const cooperativePlan = await buildChannelSetupPlanCooperatively(
            { ...actorOnlyInput, warnings: [] },
            async (): Promise<void> => undefined
        );
        expect(syncPlan.pendingChannels.map((channel) => channel.name)).toEqual(['Zed Above - Movies']);
        expect(cooperativePlan).toEqual(syncPlan);
    });

    it('preserves a known movie tag count when a shared people scan has no matching metadata', () => {
        const movieLibrary = createLibrary();
        const movieIndex = createPeopleIndexFromItems(movieLibrary, [
            createMovie('movie-1', { directors: ['Indexed Director'] }),
        ]);
        const result = buildChannelSetupStrategyBuckets({
            config: createConfig({
                strategyConfig: {
                    ...createConfig().strategyConfig,
                    playlists: { enabled: false, priority: 2, scope: 'per-library' },
                    actors: { enabled: true, priority: 8, scope: 'per-library' },
                },
            }),
            selectedLibraries: [movieLibrary],
            playlists: [],
            collectionsByLibraryId: new Map(),
            genresByLibraryId: new Map(),
            directorsByLibraryId: new Map(),
            yearsByLibraryId: new Map(),
            actorsByLibraryId: new Map([['lib-1', [
                createTag('Known Native Actor', 7, 'actor-known'),
            ]]]),
            studiosByLibraryId: new Map(),
            peopleSeriesIndexByLibraryId: new Map([['lib-1', movieIndex]]),
            minItems: 5,
            seedFor: (value) => value.length,
        });

        expect(result.strategyBuckets.actors.map((channel) => channel.name)).toEqual([
            'Known Native Actor - Movies',
        ]);
    });

    it('skips unknown movie people sources when their required item index is unavailable', async () => {
        const unavailableLibrary = createLibrary({ id: 'movie-missing', title: 'Missing Index' });
        const knownLibrary = createLibrary({ id: 'movie-known', title: 'Known Counts' });
        const input = {
            config: createConfig({
                selectedLibraryIds: ['movie-missing', 'movie-known'],
                actorStudioCombineMode: 'combined',
                strategyConfig: {
                    ...createConfig().strategyConfig,
                    playlists: { enabled: false, priority: 2, scope: 'per-library' },
                    actors: { enabled: true, priority: 8, scope: 'cross-library' },
                },
            }),
            selectedLibraries: [unavailableLibrary, knownLibrary],
            playlists: [],
            collectionsByLibraryId: new Map(),
            genresByLibraryId: new Map(),
            directorsByLibraryId: new Map(),
            yearsByLibraryId: new Map(),
            actorsByLibraryId: new Map([
                ['movie-missing', [createTag('Shared Actor', null, 'actor-missing')]],
                ['movie-known', [createTag('Shared Actor', 7, 'actor-known')]],
            ]),
            studiosByLibraryId: new Map(),
            peopleSeriesIndexByLibraryId: new Map(),
            minItems: 5,
            seedFor: (value: string): number => value.length,
        };
        const syncResult = buildChannelSetupStrategyBuckets(input);
        const cooperativeResult = await buildChannelSetupStrategyBucketsCooperatively(
            input,
            async (): Promise<void> => undefined
        );

        expect(syncResult.strategyBuckets.actors).toHaveLength(1);
        expect(syncResult.strategyBuckets.actors[0]?.contentSource).toMatchObject({
            type: 'mixed',
            sources: [expect.objectContaining({ libraryId: 'movie-known' })],
        });
        expect(cooperativeResult).toEqual(syncResult);
    });

    it('keeps cross-library people sources library-scoped when TV breadth fails', () => {
        const movieLibrary = createLibrary({ id: 'movie-1', title: 'Movies', type: 'movie' });
        const eligibleTvLibrary = createLibrary({ id: 'tv-1', title: 'Good TV', type: 'show' });
        const rejectedTvLibrary = createLibrary({ id: 'tv-2', title: 'Thin TV', type: 'show' });
        const eligibleIndex = createPeopleSeriesIndexFromEpisodes(eligibleTvLibrary, [
            createEpisode('tv-good-1', 'show-a', { actors: ['Shared Person'], directors: ['Shared Director'] }),
            createEpisode('tv-good-2', 'show-b', { actors: ['Shared Person'], directors: ['Shared Director'] }),
            createEpisode('tv-good-3', 'show-c', { actors: ['Shared Person'], directors: ['Shared Director'] }),
            createEpisode('tv-good-4', 'show-c', { actors: ['Shared Person'], directors: ['Shared Director'] }),
            createEpisode('tv-good-5', 'show-c', { actors: ['Shared Person'], directors: ['Shared Director'] }),
        ]);
        const rejectedIndex = createPeopleSeriesIndexFromEpisodes(rejectedTvLibrary, [
            createEpisode('tv-thin-1', 'show-a', { actors: ['Shared Person'], directors: ['Shared Director'] }),
            createEpisode('tv-thin-2', 'show-a', { actors: ['Shared Person'], directors: ['Shared Director'] }),
            createEpisode('tv-thin-3', 'show-a', { actors: ['Shared Person'], directors: ['Shared Director'] }),
            createEpisode('tv-thin-4', 'show-a', { actors: ['Shared Person'], directors: ['Shared Director'] }),
            createEpisode('tv-thin-5', 'show-a', { actors: ['Shared Person'], directors: ['Shared Director'] }),
        ]);
        const movieIndex = createPeopleIndexFromItems(movieLibrary, Array.from(
            { length: 5 },
            (_, index) => createMovie(`movie-${index}`, {
                actors: ['Shared Person'],
                directors: ['Shared Director'],
            })
        ));

        const result = buildChannelSetupStrategyBuckets({
            config: createConfig({
                selectedLibraryIds: ['movie-1', 'tv-1', 'tv-2'],
                strategyConfig: {
                    ...createConfig().strategyConfig,
                    playlists: { enabled: false, priority: 2, scope: 'per-library' },
                    actors: { enabled: true, priority: 8, scope: 'cross-library' },
                    directors: { enabled: true, priority: 4, scope: 'cross-library' },
                },
                actorStudioCombineMode: 'combined',
            }),
            selectedLibraries: [movieLibrary, eligibleTvLibrary, rejectedTvLibrary],
            playlists: [],
            collectionsByLibraryId: new Map(),
            genresByLibraryId: new Map(),
            directorsByLibraryId: new Map([
                ['movie-1', [createTag('Shared Director', null, 'director-movie')]],
                ['tv-1', [createTag('Shared Director', 5, 'director-tv-good')]],
                ['tv-2', [createTag('Shared Director', 5, 'director-tv-thin')]],
            ]),
            yearsByLibraryId: new Map(),
            actorsByLibraryId: new Map([
                ['movie-1', [createTag('Shared Person', null, 'actor-movie')]],
                ['tv-1', [createTag('Shared Person', 5, 'actor-tv-good')]],
                ['tv-2', [createTag('Shared Person', 5, 'actor-tv-thin')]],
            ]),
            studiosByLibraryId: new Map(),
            peopleSeriesIndexByLibraryId: new Map([
                ['movie-1', movieIndex],
                ['tv-1', eligibleIndex],
                ['tv-2', rejectedIndex],
            ]),
            minItems: 5,
            seedFor: (value) => value.length,
        });

        const actorSource = result.strategyBuckets.actors[0]?.contentSource;
        const directorSource = result.strategyBuckets.directors[0]?.contentSource;
        expect(actorSource).toMatchObject({
            type: 'mixed',
            sources: [
                expect.objectContaining({ libraryId: 'movie-1' }),
                expect.objectContaining({ libraryId: 'tv-1' }),
            ],
        });
        expect(directorSource).toMatchObject({
            type: 'mixed',
            sources: [
                expect.objectContaining({ libraryId: 'movie-1' }),
                expect.objectContaining({ libraryId: 'tv-1' }),
            ],
        });
        const actorSourceLibraryIds = actorSource?.type === 'mixed'
            ? actorSource.sources
                .filter((source): source is LibraryContentSource => source.type === 'library')
                .map((source) => source.libraryId)
            : [];
        const directorSourceLibraryIds = directorSource?.type === 'mixed'
            ? directorSource.sources
                .filter((source): source is LibraryContentSource => source.type === 'library')
                .map((source) => source.libraryId)
            : [];
        expect(actorSourceLibraryIds).not.toContain('tv-2');
        expect(directorSourceLibraryIds).not.toContain('tv-2');
    });

    it('aggregates cross-library movie people counts before applying the item floor', () => {
        const movieLibraryA = createLibrary({ id: 'movie-1', title: 'Movies A', type: 'movie' });
        const movieLibraryB = createLibrary({ id: 'movie-2', title: 'Movies B', type: 'movie' });

        const result = buildChannelSetupStrategyBuckets({
            config: createConfig({
                selectedLibraryIds: ['movie-1', 'movie-2'],
                strategyConfig: {
                    ...createConfig().strategyConfig,
                    playlists: { enabled: false, priority: 2, scope: 'per-library' },
                    actors: { enabled: true, priority: 8, scope: 'cross-library' },
                    directors: { enabled: true, priority: 4, scope: 'cross-library' },
                },
            }),
            selectedLibraries: [movieLibraryA, movieLibraryB],
            playlists: [],
            collectionsByLibraryId: new Map(),
            genresByLibraryId: new Map(),
            directorsByLibraryId: new Map([
                ['movie-1', [
                    createTag('Shared Director', 3, 'director-shared-a'),
                    createTag('Thin Director', 2, 'director-thin-a'),
                ]],
                ['movie-2', [
                    createTag('Shared Director', 3, 'director-shared-b'),
                    createTag('Thin Director', 2, 'director-thin-b'),
                ]],
            ]),
            yearsByLibraryId: new Map(),
            actorsByLibraryId: new Map([
                ['movie-1', [
                    createTag('Shared Actor', 3, 'actor-shared-a'),
                    createTag('Thin Actor', 2, 'actor-thin-a'),
                ]],
                ['movie-2', [
                    createTag('Shared Actor', 3, 'actor-shared-b'),
                    createTag('Thin Actor', 2, 'actor-thin-b'),
                ]],
            ]),
            studiosByLibraryId: new Map(),
            peopleSeriesIndexByLibraryId: new Map(),
            minItems: 5,
            seedFor: (value) => value.length,
        });

        expect(result.strategyBuckets.actors.map((channel) => channel.name)).toEqual(['Shared Actor']);
        expect(result.strategyBuckets.directors.map((channel) => channel.name)).toEqual(['Shared Director']);
        expect(result.candidatesBeforeMinItems).toMatchObject({ actors: 2, directors: 2 });
        expect(result.candidatesAfterMinItems).toMatchObject({ actors: 1, directors: 1 });
        expect(result.skipped).toBe(2);
        expect(result.strategyBuckets.actors[0]?.contentSource).toMatchObject({
            type: 'mixed',
            sources: [
                expect.objectContaining({ libraryId: 'movie-1' }),
                expect.objectContaining({ libraryId: 'movie-2' }),
            ],
        });
        expect(result.strategyBuckets.directors[0]?.contentSource).toMatchObject({
            type: 'mixed',
            sources: [
                expect.objectContaining({ libraryId: 'movie-1' }),
                expect.objectContaining({ libraryId: 'movie-2' }),
            ],
        });
    });
});
