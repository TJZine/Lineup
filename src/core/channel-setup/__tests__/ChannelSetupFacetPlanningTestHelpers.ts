import type { IPlexLibrary, PlexLibrarySection, PlexTagDirectoryItem } from '../../../modules/plex/library';
import { DEFAULT_STRATEGY_PRIORITIES, MIXED_SCOPE_STRATEGY_KEYS, SETUP_STRATEGY_KEYS } from '../constants';
import type { ChannelSetupConfig, SetupStrategyConfig, SetupStrategyKey } from '../types';

export type FacetPlanningConfigOverrides = Omit<Partial<ChannelSetupConfig>, 'strategyConfig'> & {
    strategyConfig?: Partial<Record<SetupStrategyKey, Partial<SetupStrategyConfig>>>;
};

export const createFacetPlanningConfig = (
    overrides: FacetPlanningConfigOverrides = {}
): ChannelSetupConfig => {
    const { strategyConfig: strategyOverrides, ...rest } = overrides;
    const strategyConfig = SETUP_STRATEGY_KEYS.reduce<ChannelSetupConfig['strategyConfig']>((acc, key) => {
        const candidate = strategyOverrides?.[key];
        acc[key] = {
            enabled: candidate?.enabled ?? false,
            priority: candidate?.priority ?? DEFAULT_STRATEGY_PRIORITIES[key],
            scope: MIXED_SCOPE_STRATEGY_KEYS.has(key) && candidate?.scope === 'cross-library'
                ? 'cross-library'
                : 'per-library',
        };
        return acc;
    }, {} as ChannelSetupConfig['strategyConfig']);

    return {
        serverId: 'server-1',
        selectedLibraryIds: [],
        maxChannels: 25,
        buildMode: 'replace',
        strategyConfig,
        actorStudioCombineMode: 'separate',
        minItemsPerChannel: 5,
        ...rest,
    };
};

export const createFacetPlanningLibrary = (
    overrides: Partial<PlexLibrarySection> = {}
): PlexLibrarySection => ({
    id: 'lib-1',
    uuid: 'uuid-1',
    title: 'Movies',
    type: 'movie',
    agent: 'tv.plex.agents.movie',
    scanner: 'Plex Movie',
    contentCount: 10,
    lastScannedAt: new Date(0),
    art: null,
    thumb: null,
    ...overrides,
});

export const createFacetPlanningTag = (
    overrides: Partial<PlexTagDirectoryItem> = {}
): PlexTagDirectoryItem => ({
    key: 'tag',
    title: 'Tag One',
    count: 1,
    ...overrides,
});

export const createDeferred = <T>(): {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
} => {
    let resolve: ((value: T | PromiseLike<T>) => void) | undefined;
    let reject: ((reason?: unknown) => void) | undefined;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    if (!resolve || !reject) {
        throw new Error('Failed to create deferred promise');
    }
    return { promise, resolve, reject };
};

export const createMockPlexLibrary = (
    overrides: Partial<jest.Mocked<IPlexLibrary>> = {}
): jest.Mocked<IPlexLibrary> => {
    const mock: jest.Mocked<IPlexLibrary> = {
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
        getImageUrl: jest.fn(),
        refreshLibrary: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        ...overrides,
    };

    return mock;
};
