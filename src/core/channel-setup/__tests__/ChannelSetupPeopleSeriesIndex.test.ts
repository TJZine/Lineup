import type { PlexLibrarySection, PlexMediaItem } from '../../../modules/plex/library';
import {
    createPeopleIndexFromItems,
    createPeopleIndexFromItemsCooperatively,
    createPeopleSeriesIndexFromEpisodes,
    createPeopleSeriesIndexFromEpisodesCooperatively,
} from '../planning/ChannelSetupPeopleSeriesIndex';
import { yieldForChannelSetupPlanning } from '../planning/ChannelSetupPlanningCheckpoint';

const library: PlexLibrarySection = {
    id: 'shows',
    uuid: 'shows-uuid',
    title: 'Shows',
    type: 'show',
    agent: 'agent',
    scanner: 'scanner',
    art: null,
    thumb: null,
    contentCount: 5000,
    lastScannedAt: new Date(0),
};

const createEpisodes = (count: number): PlexMediaItem[] => Array.from({ length: count }, (_, index) => ({
    ratingKey: `episode-${index}`,
    key: `/library/metadata/episode-${index}`,
    type: 'episode',
    title: `Episode ${index}`,
    sortTitle: `Episode ${index}`,
    summary: '',
    year: 2024,
    durationMs: 1000,
    addedAt: new Date(0),
    updatedAt: new Date(0),
    thumb: null,
    art: null,
    grandparentRatingKey: `series-${index % 20}`,
    actors: [`Actor ${index}`],
    directors: [`Director ${index}`],
    media: [],
} as PlexMediaItem));

const movieLibrary: PlexLibrarySection = {
    ...library,
    id: 'movies',
    uuid: 'movies-uuid',
    title: 'Movies',
    type: 'movie',
};

const createMovie = (
    ratingKey: string,
    people: { actors?: string[]; directors?: string[] }
): PlexMediaItem => ({
    ratingKey,
    key: `/library/metadata/${ratingKey}`,
    type: 'movie',
    title: ratingKey,
    sortTitle: ratingKey,
    summary: '',
    year: 2024,
    durationMs: 1000,
    addedAt: new Date(0),
    updatedAt: new Date(0),
    thumb: null,
    art: null,
    media: [],
    ...(people.actors ? { actors: people.actors } : {}),
    ...(people.directors ? { directors: people.directors } : {}),
});

describe('ChannelSetupPeopleSeriesIndex cooperative planning', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('checkpoints within one large episode scan and preserves the exact frozen index', async () => {
        const episodes = createEpisodes(1024);
        const expected = createPeopleSeriesIndexFromEpisodes(library, episodes);
        const checkpoint = jest.fn(async (): Promise<void> => undefined);

        const actual = await createPeopleSeriesIndexFromEpisodesCooperatively(
            library,
            episodes,
            checkpoint
        );

        expect(checkpoint.mock.calls.length).toBeGreaterThan(20);
        expect(actual).toEqual(expected);
        expect(Object.isFrozen(actual.actorsByName.get('actor 0'))).toBe(true);
    });

    it('lets abort stop a single large episode scan at an internal iteration checkpoint', async () => {
        jest.useFakeTimers();
        const abortController = new AbortController();
        const pending = createPeopleSeriesIndexFromEpisodesCooperatively(
            library,
            createEpisodes(1024),
            () => yieldForChannelSetupPlanning(abortController.signal)
        );

        await jest.advanceTimersToNextTimerAsync();
        abortController.abort();

        await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('counts each movie once per normalized person and keeps sync/cooperative results identical', async () => {
        const movies = [
            createMovie('movie-1', {
                actors: [' Alex Actor ', 'alex actor', ''],
                directors: ['Dana Director'],
            }),
            createMovie('movie-2', {
                actors: ['Alex Actor'],
                directors: ['Dana Director', 'Other Director'],
            }),
        ];
        const expected = createPeopleIndexFromItems(movieLibrary, movies);

        const actual = await createPeopleIndexFromItemsCooperatively(
            movieLibrary,
            movies,
            async (): Promise<void> => undefined
        );

        expect(actual).toEqual(expected);
        expect(actual.actorsByName.get('alex actor')).toEqual({
            title: 'Alex Actor',
            episodeCount: 2,
            distinctSeriesCount: 0,
        });
        expect(actual.directorsByName.get('dana director')?.episodeCount).toBe(2);
    });

    it('ignores missing and malformed movie people metadata without creating entries', () => {
        const malformed = createMovie('movie-1', {
            actors: [null, undefined, 42, '  '] as unknown as string[],
        });

        const index = createPeopleIndexFromItems(movieLibrary, [malformed]);

        expect(index.actorsByName.size).toBe(0);
        expect(index.directorsByName.size).toBe(0);
    });
});
