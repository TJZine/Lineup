import { ChannelSetupCoordinator } from '../ChannelSetupCoordinator';
import type { ChannelSetupCoordinatorDeps } from '../ChannelSetupCoordinator';
import type { ChannelSetupConfig, ChannelSetupRecord, SetupStrategyConfig, SetupStrategyKey } from '../types';
import type { IPlexLibrary, PlexLibraryType, PlexMediaItem } from '../../../modules/plex/library';
import type { IChannelManager, ChannelConfig } from '../../../modules/scheduler/channel-manager';
import type { INavigationManager } from '../../../modules/navigation';
import { DEFAULT_STRATEGY_PRIORITIES, MIXED_SCOPE_STRATEGY_KEYS, SETUP_STRATEGY_KEYS } from '../constants';

const mockBuilder = {
    createChannel: jest.fn(),
    getAllChannels: jest.fn(),
};

jest.mock('../../../modules/scheduler/channel-manager', () => ({
    ChannelManager: jest.fn(() => mockBuilder),
}));

const createStrategyConfig = (
    overrides?: Partial<Record<SetupStrategyKey, Partial<SetupStrategyConfig>>>
): Record<SetupStrategyKey, SetupStrategyConfig> => (
    SETUP_STRATEGY_KEYS.reduce<Record<SetupStrategyKey, SetupStrategyConfig>>((acc, key) => {
        const candidate = overrides?.[key];
        acc[key] = {
            enabled: candidate?.enabled ?? false,
            priority: candidate?.priority ?? DEFAULT_STRATEGY_PRIORITIES[key],
            scope: MIXED_SCOPE_STRATEGY_KEYS.has(key) && candidate?.scope === 'cross-library' ? 'cross-library' : 'per-library',
        };
        return acc;
    }, {} as Record<SetupStrategyKey, SetupStrategyConfig>)
);

const createConfig = (overrides?: Partial<ChannelSetupConfig>): ChannelSetupConfig => ({
    serverId: 'server-1',
    selectedLibraryIds: [],
    maxChannels: 25,
    buildMode: 'replace',
    strategyConfig: createStrategyConfig(),
    actorStudioCombineMode: 'separate',
    minItemsPerChannel: 5,
    ...overrides,
});

const expectedStrategyPriorities: Record<string, number> = {
    playlists: 1,
    collections: 2,
    recentlyAdded: 3,
    genres: 4,
    studios: 5,
    actors: 6,
    decades: 7,
    directors: 8,
};

const mockChannelConfig = {
    id: 'ch1',
    name: 'Channel 1',
    number: 1,
    contentSource: { type: 'library', libraryId: 'lib1', libraryType: 'movie', includeWatched: true },
    playbackMode: 'shuffle' as const,
    shuffleSeed: 123,
    phaseSeed: 456,
    startTimeAnchor: 0,
    isManual: false,
    isFavorite: false,
    enabled: true,
} as unknown as ChannelConfig;

type CoordinatorHarness = {
    coordinator: ChannelSetupCoordinator;
    deps: ChannelSetupCoordinatorDeps;
    plexLibrary: jest.Mocked<IPlexLibrary>;
    channelManager: jest.Mocked<IChannelManager>;
    navigation: jest.Mocked<INavigationManager>;
    storage: Map<string, string>;
    storageGet: jest.Mock<string | null, [string]>;
    storageSet: jest.Mock<void, [string, string]>;
    storageRemove: jest.Mock<void, [string]>;
    getSelectedServerId: jest.Mock<string | null, []>;
};

const createCoordinator = (overrides?: Partial<ChannelSetupCoordinatorDeps>): CoordinatorHarness => {
    const plexLibrary = {
        getLibraries: jest.fn().mockResolvedValue([]),
        getPlaylists: jest.fn().mockResolvedValue([]),
        getCollections: jest.fn().mockResolvedValue([]),
        getLibraryItems: jest.fn().mockResolvedValue([]),
        getLibraryItemCount: jest.fn().mockResolvedValue(0),
        getActors: jest.fn().mockResolvedValue([]),
        getStudios: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<IPlexLibrary>;

    const channelManager = {
        getAllChannels: jest.fn().mockReturnValue([mockChannelConfig]),
        replaceAllChannels: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IChannelManager>;

    const navigation = {
        goTo: jest.fn(),
    } as unknown as jest.Mocked<INavigationManager>;

    const storage = new Map<string, string>();
    const storageGet = jest.fn((key: string) => storage.get(key) ?? null);
    const storageSet = jest.fn((key: string, value: string) => {
        storage.set(key, value);
    });
    const storageRemove = jest.fn((key: string) => {
        storage.delete(key);
    });

    const getSelectedServerId = jest.fn().mockReturnValue('server-1');

    const deps: ChannelSetupCoordinatorDeps = {
        plexLibrary,
        channelManager,
        navigation,
        getSelectedServerId,
        storageGet,
        storageSet,
        storageRemove,
        handleGlobalError: jest.fn(),
        primeEpgChannels: jest.fn(),
        refreshEpgSchedules: jest.fn().mockResolvedValue(undefined),
        ...overrides,
    };

    const coordinator = new ChannelSetupCoordinator(deps);

    return {
        coordinator,
        deps,
        plexLibrary,
        channelManager,
        navigation,
        storage,
        storageGet,
        storageSet,
        storageRemove,
        getSelectedServerId,
    };
};

describe('ChannelSetupCoordinator', () => {
    let builtChannels: ChannelConfig[] = [];

    beforeEach(() => {
        jest.clearAllMocks();
        builtChannels = [];
        mockBuilder.createChannel.mockImplementation(async (config: Partial<ChannelConfig>) => {
            const number = typeof config.number === 'number' ? config.number : builtChannels.length + 1;
            const channel: ChannelConfig = {
                id: `built-${number}`,
                name: config.name ?? `Channel ${number}`,
                number,
                contentSource: config.contentSource ?? { type: 'library', libraryId: 'lib1', libraryType: 'movie', includeWatched: true },
                playbackMode: config.playbackMode ?? 'shuffle',
                shuffleSeed: typeof config.shuffleSeed === 'number' ? config.shuffleSeed : 1,
                startTimeAnchor: 0,
                skipIntros: false,
                skipCredits: false,
                createdAt: 0,
                updatedAt: 0,
                lastContentRefresh: 0,
                itemCount: 0,
                totalDurationMs: 0,
            };
            if (config.contentFilters) channel.contentFilters = config.contentFilters;
            if (config.sortOrder) channel.sortOrder = config.sortOrder;
            if (typeof config.isAutoGenerated === 'boolean') {
                channel.isAutoGenerated = config.isAutoGenerated;
            }
            builtChannels.push(channel);
            return channel;
        });
        mockBuilder.getAllChannels.mockImplementation(() => builtChannels);
    });

    it('shouldRunChannelSetup returns false without server id', () => {
        const noServer = createCoordinator({ getSelectedServerId: jest.fn().mockReturnValue(null) });
        expect(noServer.coordinator.shouldRunChannelSetup()).toBe(false);
    });

    it('shouldRunChannelSetup returns true after rerun is requested', () => {
        const { coordinator } = createCoordinator();

        coordinator.requestChannelSetupRerun();

        expect(coordinator.shouldRunChannelSetup()).toBe(true);
    });

    it('shouldRunChannelSetup returns true when no channels exist', () => {
        const { coordinator, channelManager, storage } = createCoordinator();
        const record: ChannelSetupRecord = {
            ...createConfig(),
            createdAt: 1,
            updatedAt: 2,
        };
        storage.set('retune_channel_setup_v1:server-1', JSON.stringify(record));
        channelManager.getAllChannels.mockReturnValue([]);

        expect(coordinator.shouldRunChannelSetup()).toBe(true);
    });

    it('shouldRunChannelSetup returns true when setup record is missing', () => {
        const { coordinator, channelManager } = createCoordinator();
        channelManager.getAllChannels.mockReturnValue([mockChannelConfig]);

        expect(coordinator.shouldRunChannelSetup()).toBe(true);
    });

    it('shouldRunChannelSetup returns true when setup record is invalid', () => {
        const { coordinator, channelManager, storage } = createCoordinator();
        channelManager.getAllChannels.mockReturnValue([mockChannelConfig]);
        storage.set('retune_channel_setup_v1:server-1', JSON.stringify({
            serverId: 'server-1',
            selectedLibraryIds: ['lib1', 123],
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
            createdAt: 1,
            updatedAt: 2,
        }));

        expect(coordinator.shouldRunChannelSetup()).toBe(true);
    });

    it('requestChannelSetupRerun does nothing without a server id', () => {
        const { coordinator, storageRemove, navigation } = createCoordinator({
            getSelectedServerId: jest.fn().mockReturnValue(null),
        });

        coordinator.requestChannelSetupRerun();

        expect(storageRemove).not.toHaveBeenCalled();
        expect(navigation.goTo).not.toHaveBeenCalled();
    });

    it('requestChannelSetupRerun clears storage and navigates when server id exists', () => {
        const { coordinator, storageRemove, navigation } = createCoordinator({
            getSelectedServerId: jest.fn().mockReturnValue('server-9'),
        });

        coordinator.requestChannelSetupRerun();

        expect(storageRemove).toHaveBeenCalledWith('retune_channel_setup_v1:server-9');
        expect(navigation.goTo).toHaveBeenCalledWith('channel-setup');
        expect(coordinator.shouldRunChannelSetup()).toBe(true);
    });

    it('getSetupContextForSelectedServer returns first-time when selected server has no channels', () => {
        const { coordinator, channelManager } = createCoordinator({
            getSelectedServerId: jest.fn().mockReturnValue('server-1'),
        });
        channelManager.getAllChannels.mockReturnValue([]);

        expect(coordinator.getSetupContextForSelectedServer()).toBe('first-time');
    });

    it('getSetupContextForSelectedServer returns existing when selected server has channels', () => {
        const { coordinator, channelManager } = createCoordinator({
            getSelectedServerId: jest.fn().mockReturnValue('server-1'),
        });
        channelManager.getAllChannels.mockReturnValue([mockChannelConfig]);

        expect(coordinator.getSetupContextForSelectedServer()).toBe('existing');
    });

    it('getSetupContextForSelectedServer returns unknown when server is missing', () => {
        const noServer = createCoordinator({ getSelectedServerId: jest.fn().mockReturnValue(null) });
        expect(noServer.coordinator.getSetupContextForSelectedServer()).toBe('unknown');
    });

    it('markSetupComplete preserves createdAt and clears rerun flag', () => {
        const { coordinator, storage, channelManager } = createCoordinator();
        const existing: ChannelSetupRecord = {
            ...createConfig(),
            createdAt: 123,
            updatedAt: 456,
        };
        storage.set('retune_channel_setup_v1:server-1', JSON.stringify(existing));
        channelManager.getAllChannels.mockReturnValue([mockChannelConfig]);

        coordinator.requestChannelSetupRerun();
        storage.set('retune_channel_setup_v1:server-1', JSON.stringify(existing));
        coordinator.markSetupComplete('server-1', createConfig({ minItemsPerChannel: 7 }));

        const stored = storage.get('retune_channel_setup_v1:server-1');
        expect(stored).toBeTruthy();
        const parsed = JSON.parse(stored as string) as ChannelSetupRecord;
        expect(parsed.createdAt).toBe(123);
        expect(parsed.updatedAt).toBeGreaterThan(456);
        expect(parsed.minItemsPerChannel).toBe(7);
        expect(coordinator.shouldRunChannelSetup()).toBe(false);
    });

    it('persists enabled flags from strategyConfig', () => {
        const { coordinator, storage } = createCoordinator();
        const config = createConfig({
            strategyConfig: createStrategyConfig({
                collections: { enabled: true },
                playlists: { enabled: false },
                genres: { enabled: true },
                recentlyAdded: { enabled: true },
                studios: { enabled: false },
                actors: { enabled: true },
                decades: { enabled: true },
                directors: { enabled: false },
            }),
        });

        coordinator.markSetupComplete('server-1', config);

        const raw = storage.get('retune_channel_setup_v1:server-1');
        expect(raw).toBeTruthy();
        const parsed = JSON.parse(raw as string) as Record<string, unknown>;
        const strategyConfig = parsed.strategyConfig as Record<string, { enabled: boolean }> | undefined;
        expect(strategyConfig).toBeDefined();
        expect(strategyConfig?.collections?.enabled).toBe(true);
        expect(strategyConfig?.playlists?.enabled).toBe(false);
        expect(strategyConfig?.genres?.enabled).toBe(true);
    });

    it('normalizes strategy priorities, per-library scope, and channel expansion defaults', () => {
        const { coordinator, storage } = createCoordinator();

        coordinator.markSetupComplete('server-1', createConfig());

        const raw = storage.get('retune_channel_setup_v1:server-1');
        expect(raw).toBeTruthy();
        const parsed = JSON.parse(raw as string) as Record<string, unknown>;
        const strategyConfig = parsed.strategyConfig as Record<string, { priority: number; scope: string }> | undefined;
        const channelExpansion = parsed.channelExpansion as Record<string, unknown> | undefined;

        expect(strategyConfig).toBeDefined();
        for (const [key, priority] of Object.entries(expectedStrategyPriorities)) {
            expect(strategyConfig?.[key]?.priority).toBe(priority);
            expect(strategyConfig?.[key]?.scope).toBe('per-library');
        }
        expect(channelExpansion).toEqual({
            addAlternateLineups: false,
            alternateLineupCopies: 1,
            addSequentialVariants: false,
        });
    });

    it('createChannelsFromSetup returns canceled when signal is already aborted', async () => {
        const { coordinator } = createCoordinator();
        const controller = new AbortController();
        controller.abort();

        const summary = await coordinator.createChannelsFromSetup(createConfig(), { signal: controller.signal });

        expect(summary.canceled).toBe(true);
        expect(summary.lastTask).toBe('init');
    });

    it('createChannelsFromSetup treats AbortError as cancellation without errors', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getPlaylists.mockRejectedValue({ name: 'AbortError' });

        const summary = await coordinator.createChannelsFromSetup(createConfig({
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
        }));

        expect(summary.canceled).toBe(true);
        expect(summary.lastTask).toBe('fetch_playlists');
        expect(summary.errorCount).toBe(0);
    });

    it('createChannelsFromSetup treats AbortError from getLibrariesForSetup as cancellation', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getLibraries.mockRejectedValue({ name: 'AbortError' });

        const summary = await coordinator.createChannelsFromSetup(createConfig());

        expect(summary.canceled).toBe(true);
        expect(summary.lastTask).toBe('fetch_playlists');
        expect(summary.errorCount).toBe(0);
    });

    it('createChannelsFromSetup falls back to default minItems for non-finite values', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([
            { id: 'lib1', title: 'Movies', type: 'movie', contentCount: 25 },
        ] as PlexLibraryType[]);
        plexLibrary.getLibraryItems.mockResolvedValue([]);

        await coordinator.createChannelsFromSetup(createConfig({
            selectedLibraryIds: ['lib1'],
            strategyConfig: createStrategyConfig({ genres: { enabled: true } }),
            minItemsPerChannel: Number.NaN,
        }));

        expect(plexLibrary.getLibraryItems).toHaveBeenCalled();
    });

    it('logs safe summaries for playlist fetch errors', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        const error = { name: 'Error', code: 'BAD', message: 'http://plex?X-Plex-Token=secret' };
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

        plexLibrary.getPlaylists.mockRejectedValue(error);

        await coordinator.createChannelsFromSetup(createConfig({
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
        }));

        const warnCalls = warnSpy.mock.calls.filter((call) => call[0] === 'Failed to fetch playlists:');
        expect(warnCalls.length).toBe(1);
        const firstCall = warnCalls[0];
        expect(firstCall).toBeDefined();
        if (!firstCall) {
            throw new Error('Expected warn call for playlists');
        }
        expect(firstCall[1]).not.toBe(error);
        expect(firstCall[1].message).toMatch(/X-Plex-Token=REDACTED/i);
        expect(firstCall[1].message).not.toMatch(/X-Plex-Token=secret/i);

        warnSpy.mockRestore();
    });

    it('creates recently added channels per library', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([
            { id: 'm1', title: 'Movies', type: 'movie', contentCount: 25 },
            { id: 's1', title: 'Shows', type: 'show', contentCount: 25 },
        ] as PlexLibraryType[]);

        await coordinator.createChannelsFromSetup(createConfig({
            selectedLibraryIds: ['m1', 's1'],
            strategyConfig: createStrategyConfig({ recentlyAdded: { enabled: true } }),
        }));

        expect(mockBuilder.createChannel).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Movies - Recently Added',
            sortOrder: 'added_desc',
            playbackMode: 'sequential',
        }), expect.any(Object));
        expect(mockBuilder.createChannel).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Shows - Recently Added',
            sortOrder: 'added_desc',
            playbackMode: 'sequential',
        }), expect.any(Object));
    });

    it('creates studio and actor channels from directory tags', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([
            { id: 'm1', title: 'Movies', type: 'movie', contentCount: 25 },
        ] as PlexLibraryType[]);
        plexLibrary.getStudios.mockResolvedValue([
            { key: 's1', title: 'Studio A', count: 5, fastKey: '/library/sections/1/studio?type=1&studio=Studio%20A' },
        ]);
        plexLibrary.getActors.mockResolvedValue([
            { key: 'a1', title: 'Actor A', count: 5, fastKey: '/library/sections/1/actor?type=1&actor=Actor%20A' },
        ]);

        await coordinator.createChannelsFromSetup(createConfig({
            selectedLibraryIds: ['m1'],
            strategyConfig: createStrategyConfig({ studios: { enabled: true }, actors: { enabled: true } }),
        }));

        expect(mockBuilder.createChannel).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Studio A - Movies',
            contentSource: expect.objectContaining({
                libraryFilter: expect.objectContaining({ studio: 'Studio A' }),
            }),
        }), expect.any(Object));

        expect(mockBuilder.createChannel).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Actor A - Movies',
            contentSource: expect.objectContaining({
                libraryFilter: expect.objectContaining({ actor: 'Actor A' }),
            }),
        }), expect.any(Object));
    });

    it('sanitizes fastKey filters and ignores token params', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([
            { id: 'm1', title: 'Movies', type: 'movie', contentCount: 25 },
        ] as PlexLibraryType[]);
        plexLibrary.getActors.mockResolvedValue([
            { key: 'a1', title: 'Actor A', count: 5, fastKey: '/library/sections/1/actor?actor=Actor%20A&X-Plex-Token=secret' },
        ]);

        await coordinator.createChannelsFromSetup(createConfig({
            selectedLibraryIds: ['m1'],
            strategyConfig: createStrategyConfig({ actors: { enabled: true } }),
        }));

        const actorCall = mockBuilder.createChannel.mock.calls.find(
            ([config]) => (config as ChannelConfig).name === 'Actor A - Movies'
        );
        const actorFilter = (actorCall?.[0] as ChannelConfig).contentSource;
        const libraryFilter = (actorFilter as { libraryFilter?: Record<string, string | number> }).libraryFilter;
        expect(libraryFilter).toBeDefined();
        expect(libraryFilter).toEqual(expect.objectContaining({ actor: 'Actor A' }));
        expect(Object.keys(libraryFilter ?? {}).some((key) => /token/i.test(key))).toBe(false);
    });

    it('parses fastKey filters even when fastKey is an absolute URL', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([
            { id: 'm1', title: 'Movies', type: 'movie', contentCount: 25 },
        ] as PlexLibraryType[]);
        plexLibrary.getActors.mockResolvedValue([
            { key: 'a1', title: 'Actor A', count: 5, fastKey: 'https://plex.example/library/sections/1/actor?actor=Actor%20A' },
        ]);

        await coordinator.createChannelsFromSetup(createConfig({
            selectedLibraryIds: ['m1'],
            strategyConfig: createStrategyConfig({ actors: { enabled: true } }),
        }));

        const actorCall = mockBuilder.createChannel.mock.calls.find(
            ([config]) => (config as ChannelConfig).name === 'Actor A - Movies'
        );
        const actorFilter = (actorCall?.[0] as ChannelConfig).contentSource;
        const libraryFilter = (actorFilter as { libraryFilter?: Record<string, string | number> }).libraryFilter;
        expect(libraryFilter).toEqual({ actor: 'Actor A' });
    });

    it('append mode keeps existing channels and assigns next available numbers', async () => {
        const { coordinator, plexLibrary, channelManager } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([] as PlexLibraryType[]);
        plexLibrary.getPlaylists.mockResolvedValue([
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'Favorites', thumb: null, duration: 0, leafCount: 10 },
        ]);
        channelManager.getAllChannels.mockReturnValue([
            { ...mockChannelConfig, id: 'c1', number: 1, name: 'Existing' },
        ]);

        await coordinator.createChannelsFromSetup(createConfig({
            buildMode: 'append',
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
        }));

        const replaceArgs = channelManager.replaceAllChannels.mock.calls[0]?.[0];
        expect(replaceArgs).toHaveLength(2);
        expect(replaceArgs?.[0]?.name).toBe('Existing');
        expect(replaceArgs?.[1]?.number).toBe(2);
    });

    it('merge mode updates auto-generated names and preserves ids', async () => {
        const { coordinator, plexLibrary, channelManager } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([] as PlexLibraryType[]);
        plexLibrary.getPlaylists.mockResolvedValue([
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'Favorites', thumb: null, duration: 0, leafCount: 10 },
        ]);
        channelManager.getAllChannels.mockReturnValue([
            {
                ...mockChannelConfig,
                id: 'c1',
                name: 'Old Name',
                number: 1,
                isAutoGenerated: true,
                contentSource: { type: 'playlist', playlistKey: 'pl1', playlistName: 'Favorites' },
                playbackMode: 'sequential',
            } as ChannelConfig,
        ]);

        await coordinator.createChannelsFromSetup(createConfig({
            buildMode: 'merge',
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
        }));

        const replaceArgs = channelManager.replaceAllChannels.mock.calls[0]?.[0];
        expect(replaceArgs).toHaveLength(1);
        expect(replaceArgs?.[0]?.id).toBe('c1');
        expect(replaceArgs?.[0]?.name).toBe('Favorites');
        expect(replaceArgs?.[0]?.playbackMode).toBe('shuffle');
        expect(mockBuilder.createChannel).not.toHaveBeenCalled();
    });

    it('review diff matches channels when only playback/sort differ', async () => {
        const { coordinator, plexLibrary, channelManager } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([] as PlexLibraryType[]);
        plexLibrary.getPlaylists.mockResolvedValue([
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'Favorites', thumb: null, duration: 0, leafCount: 10 },
        ]);
        channelManager.getAllChannels.mockReturnValue([
            {
                ...mockChannelConfig,
                id: 'c1',
                name: 'Favorites',
                number: 1,
                contentSource: { type: 'playlist', playlistKey: 'pl1', playlistName: 'Favorites' },
                playbackMode: 'sequential',
            } as ChannelConfig,
        ]);

        const review = await coordinator.getSetupReview(createConfig({
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
        }));

        expect(review.diff.summary.created).toBe(0);
        expect(review.diff.summary.removed).toBe(0);
        expect(review.diff.summary.unchanged).toBe(1);
    });

    it('review diff categorizes replace vs append vs merge', async () => {
        const { coordinator, plexLibrary, channelManager } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([] as PlexLibraryType[]);
        channelManager.getAllChannels.mockReturnValue([
            { ...mockChannelConfig, id: 'c1', name: 'Existing', number: 1 },
        ]);

        const baseConfig = createConfig();

        const replaceReview = await coordinator.getSetupReview({ ...baseConfig, buildMode: 'replace' });
        expect(replaceReview.diff.summary.removed).toBe(1);

        const appendReview = await coordinator.getSetupReview({ ...baseConfig, buildMode: 'append' });
        expect(appendReview.diff.summary.removed).toBe(0);
        expect(appendReview.diff.summary.unchanged).toBe(1);

        const mergeReview = await coordinator.getSetupReview({ ...baseConfig, buildMode: 'merge' });
        expect(mergeReview.diff.summary.removed).toBe(0);
        expect(mergeReview.diff.summary.unchanged).toBe(1);
    });

    it('orders generated channels by strategy priority', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([
            { id: 'lib1', title: 'Movies', type: 'movie', contentCount: 25 },
        ] as PlexLibraryType[]);
        plexLibrary.getPlaylists.mockResolvedValue([
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'Favorites', thumb: null, duration: 0, leafCount: 10 },
        ]);
        plexLibrary.getCollections.mockResolvedValue([
            { ratingKey: 'co1', key: '/library/collections/co1', title: 'Classics', thumb: null, childCount: 10 },
        ]);

        await coordinator.createChannelsFromSetup(createConfig({
            selectedLibraryIds: ['lib1'],
            strategyConfig: createStrategyConfig({
                playlists: { enabled: true, priority: 9 },
                collections: { enabled: true, priority: 1 },
            }),
        }));

        const names = mockBuilder.createChannel.mock.calls.map(([cfg]) => (cfg as ChannelConfig).name);
        expect(names[0]).toBe('Classics');
        expect(names[1]).toBe('Favorites');
    });

    it('adds alternate lineup copies for non-sequential channels', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([] as PlexLibraryType[]);
        plexLibrary.getPlaylists.mockResolvedValue([
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'Favorites', thumb: null, duration: 0, leafCount: 10 },
        ]);

        await coordinator.createChannelsFromSetup(createConfig({
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
            channelExpansion: {
                addAlternateLineups: true,
                alternateLineupCopies: 2,
                addSequentialVariants: false,
            },
        }));

        const calls = mockBuilder.createChannel.mock.calls.map(([cfg]) => cfg as ChannelConfig);
        expect(calls).toHaveLength(3);
        expect(calls.map((cfg) => cfg.name)).toEqual(['Favorites', 'Favorites (2)', 'Favorites (3)']);
        expect(calls.map((cfg) => cfg.lineupReplicaIndex)).toEqual([0, 1, 2]);
        expect(new Set(calls.map((cfg) => cfg.shuffleSeed)).size).toBe(3);
    });

    it('adds sequential variants after alternate-lineup expansion', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([] as PlexLibraryType[]);
        plexLibrary.getPlaylists.mockResolvedValue([
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'Favorites', thumb: null, duration: 0, leafCount: 10 },
        ]);

        await coordinator.createChannelsFromSetup(createConfig({
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
            channelExpansion: {
                addAlternateLineups: true,
                alternateLineupCopies: 2,
                addSequentialVariants: true,
            },
        }));

        const calls = mockBuilder.createChannel.mock.calls.map(([cfg]) => cfg as ChannelConfig);
        expect(calls).toHaveLength(6);
        expect(calls.map((cfg) => cfg.name)).toEqual([
            'Favorites',
            'Favorites (2)',
            'Favorites (3)',
            'Favorites • Sequential',
            'Favorites (2) • Sequential',
            'Favorites (3) • Sequential',
        ]);
        expect(calls.filter((cfg) => cfg.isSequentialVariant === true)).toHaveLength(3);
    });

    it('keeps sequential expansion off by default', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([] as PlexLibraryType[]);
        plexLibrary.getPlaylists.mockResolvedValue([
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'Favorites', thumb: null, duration: 0, leafCount: 10 },
        ]);

        await coordinator.createChannelsFromSetup(createConfig({
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
        }));

        const names = mockBuilder.createChannel.mock.calls.map(([cfg]) => (cfg as ChannelConfig).name);
        expect(names).toEqual(['Favorites']);
    });

    it('skips alternate-lineup copies when base channel playback is sequential', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([
            { id: 's1', title: 'Shows', type: 'show', contentCount: 25 },
        ] as PlexLibraryType[]);

        await coordinator.createChannelsFromSetup(createConfig({
            selectedLibraryIds: ['s1'],
            strategyConfig: createStrategyConfig({ recentlyAdded: { enabled: true } }),
            channelExpansion: {
                addAlternateLineups: true,
                alternateLineupCopies: 2,
                addSequentialVariants: false,
            },
        }));

        const calls = mockBuilder.createChannel.mock.calls.map(([cfg]) => cfg as ChannelConfig);
        expect(calls).toHaveLength(1);
        expect(calls[0]?.name).toBe('Shows - Recently Added');
    });

    it('skips sequential variants for already-sequential channels', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([
            { id: 's1', title: 'Shows', type: 'show', contentCount: 25 },
        ] as PlexLibraryType[]);

        await coordinator.createChannelsFromSetup(createConfig({
            selectedLibraryIds: ['s1'],
            strategyConfig: createStrategyConfig({ recentlyAdded: { enabled: true } }),
            channelExpansion: {
                addAlternateLineups: false,
                alternateLineupCopies: 1,
                addSequentialVariants: true,
            },
        }));

        const calls = mockBuilder.createChannel.mock.calls.map(([cfg]) => cfg as ChannelConfig);
        expect(calls).toHaveLength(1);
        expect(calls[0]?.name).toBe('Shows - Recently Added');
    });

    it('keeps genre strategy per-library by default', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([
            { id: 'm1', title: 'Movies', type: 'movie', contentCount: 25 },
            { id: 's1', title: 'Shows', type: 'show', contentCount: 25 },
        ] as PlexLibraryType[]);
        plexLibrary.getLibraryItems.mockImplementation(async (libraryId: string) => {
            if (libraryId === 'm1') {
                return [{ genres: ['Action'] }] as unknown as PlexMediaItem[];
            }
            if (libraryId === 's1') {
                return [{ genres: ['Action'] }] as unknown as PlexMediaItem[];
            }
            return [];
        });

        await coordinator.createChannelsFromSetup(createConfig({
            selectedLibraryIds: ['m1', 's1'],
            strategyConfig: createStrategyConfig({ genres: { enabled: true } }),
            minItemsPerChannel: 1,
        }));

        const calls = mockBuilder.createChannel.mock.calls.map(([cfg]) => cfg as ChannelConfig);
        const genreChannels = calls.filter((cfg) => cfg.buildStrategy === 'genres');
        expect(genreChannels).toHaveLength(2);
        expect(genreChannels.map((cfg) => cfg.name)).toEqual(['Movies - Action', 'Shows - Action']);
        expect(genreChannels.every((cfg) => cfg.contentSource.type === 'library')).toBe(true);
    });

    it('creates mixed cross-library genre channels only when explicitly enabled', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([
            { id: 'm1', title: 'Movies', type: 'movie', contentCount: 25 },
            { id: 's1', title: 'Shows', type: 'show', contentCount: 25 },
        ] as PlexLibraryType[]);
        plexLibrary.getLibraryItems.mockImplementation(async (libraryId: string) => {
            if (libraryId === 'm1') {
                return [{ genres: ['Action'] }] as unknown as PlexMediaItem[];
            }
            if (libraryId === 's1') {
                return [{ genres: ['Action'] }] as unknown as PlexMediaItem[];
            }
            return [];
        });

        await coordinator.createChannelsFromSetup(createConfig({
            selectedLibraryIds: ['m1', 's1'],
            strategyConfig: createStrategyConfig({ genres: { enabled: true, scope: 'cross-library' } }),
            minItemsPerChannel: 1,
        }));

        const calls = mockBuilder.createChannel.mock.calls.map(([cfg]) => cfg as ChannelConfig);
        const genreChannels = calls.filter((cfg) => cfg.buildStrategy === 'genres');
        expect(genreChannels).toHaveLength(1);
        expect(genreChannels[0]?.name).toBe('Action');
        expect(genreChannels[0]?.contentSource.type).toBe('mixed');
        expect((genreChannels[0]?.contentSource as { mixMode?: string }).mixMode).toBe('interleave');
    });
});
