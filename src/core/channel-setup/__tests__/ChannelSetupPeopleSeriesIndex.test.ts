import type { PlexLibrarySection, PlexMediaItem } from '../../../modules/plex/library';
import {
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
});
