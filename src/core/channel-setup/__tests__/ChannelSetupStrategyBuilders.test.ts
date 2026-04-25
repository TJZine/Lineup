import { buildChannelSetupStrategyBuckets } from '../planning/ChannelSetupStrategyBuilders';
import type { ChannelSetupConfig } from '../types';
import type {
    PlexLibrarySection,
    PlexPlaylist,
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
});
