/**
 * @jest-environment jsdom
 */

import type { IPlexLibrary, PlexLibrarySection } from '../../../modules/plex/library';
import type { ChannelSetupConfig } from '../types';
import { ChannelSetupFacetSnapshotLoadSession } from '../planning/ChannelSetupFacetSnapshotLoadSession';

const createConfig = (overrides: Partial<ChannelSetupConfig> = {}): ChannelSetupConfig => ({
    serverId: 'server-1',
    selectedLibraryIds: ['lib-1'],
    maxChannels: 10,
    buildMode: 'replace',
    strategyConfig: {
        collections: { enabled: false, priority: 1, scope: 'per-library' },
        playlists: { enabled: false, priority: 2, scope: 'per-library' },
        genres: { enabled: false, priority: 3, scope: 'per-library' },
        directors: { enabled: false, priority: 4, scope: 'per-library' },
        decades: { enabled: false, priority: 5, scope: 'per-library' },
        recentlyAdded: { enabled: false, priority: 6, scope: 'per-library' },
        studios: { enabled: false, priority: 7, scope: 'per-library' },
        actors: { enabled: false, priority: 8, scope: 'per-library' },
    },
    actorStudioCombineMode: 'separate',
    minItemsPerChannel: 1,
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

const createPlexLibrary = (): jest.Mocked<IPlexLibrary> => ({
    getLibraries: jest.fn(),
    getLibrary: jest.fn(),
    getLibraryItems: jest.fn(),
    getLibraryItemCount: jest.fn(),
    getItem: jest.fn(),
    getShows: jest.fn(),
    getShowSeasons: jest.fn(),
    getSeasonEpisodes: jest.fn(),
    getShowEpisodes: jest.fn(),
    search: jest.fn(),
    getCollections: jest.fn(),
    getCollectionItems: jest.fn(),
    getPlaylists: jest.fn(),
    getPlaylistItems: jest.fn(),
    getActors: jest.fn(),
    getStudios: jest.fn(),
    getGenres: jest.fn(),
    getDirectors: jest.fn(),
    getYears: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
} as unknown as jest.Mocked<IPlexLibrary>);

describe('ChannelSetupFacetSnapshotLoadSession', () => {
    it('returns an empty ready snapshot when no facet strategies are enabled', async () => {
        const session = new ChannelSetupFacetSnapshotLoadSession({
            plexLibrary: createPlexLibrary(),
            config: createConfig(),
            libraries: [createLibrary()],
            signal: null,
            requestIntent: 'preview',
            snapshotAbortController: new AbortController(),
            reportProgress: undefined,
        });

        await expect(session.load()).resolves.toMatchObject({
            status: 'ready',
            playlists: [],
            warnings: [],
            hasTransientLoadFailure: false,
            errorsTotal: 0,
        });
    });

    it('forwards a caller abort into the snapshot abort signal', async () => {
        const callerAbortController = new AbortController();
        const snapshotAbortController = new AbortController();
        callerAbortController.abort();

        const session = new ChannelSetupFacetSnapshotLoadSession({
            plexLibrary: createPlexLibrary(),
            config: createConfig(),
            libraries: [createLibrary()],
            signal: callerAbortController.signal,
            requestIntent: 'preview',
            snapshotAbortController,
            reportProgress: undefined,
        });

        await expect(session.load()).rejects.toMatchObject({ name: 'AbortError' });
        expect(snapshotAbortController.signal.aborted).toBe(true);
    });
});
