/**
 * @jest-environment jsdom
 */

import { ChannelSetupCoordinator } from '../ChannelSetupCoordinator';
import type { ChannelSetupCoordinatorDeps } from '../ChannelSetupCoordinator';
import { ChannelSetupPlanningService } from '../ChannelSetupPlanningService';
import type { ChannelSetupConfig, ChannelSetupRecord, SetupStrategyConfig, SetupStrategyKey } from '../types';
import type { IPlexLibrary, PlexLibraryType, PlexTagDirectoryItem } from '../../../modules/plex/library';
import type { IChannelManager, ChannelConfig } from '../../../modules/scheduler/channel-manager';
import type { INavigationManager } from '../../../modules/navigation';
import { DEFAULT_STRATEGY_PRIORITIES, MIXED_SCOPE_STRATEGY_KEYS, SETUP_STRATEGY_KEYS } from '../constants';
import { MAX_CHANNEL_NUMBER } from '../../../modules/scheduler/channel-manager/constants';

const mockBuilder = {
    createChannel: jest.fn(),
    getAllChannels: jest.fn(),
    dispose: jest.fn(),
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
        getGenres: jest.fn().mockResolvedValue([]),
        getDirectors: jest.fn().mockResolvedValue([]),
        getYears: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<IPlexLibrary>;

    const channelManager = {
        getAllChannels: jest.fn().mockReturnValue([mockChannelConfig]),
        getCurrentChannel: jest.fn().mockReturnValue(mockChannelConfig),
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
        ensureEpgInitialized: jest.fn().mockResolvedValue(undefined),
        clearSelectedChannelScheduleSnapshot: jest.fn(),
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
    let onCreateChannel: (() => void) | null = null;

    beforeEach(() => {
        jest.clearAllMocks();
        builtChannels = [];
        onCreateChannel = null;
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
            onCreateChannel?.();
            return channel;
        });
        mockBuilder.getAllChannels.mockImplementation(() => builtChannels);
        mockBuilder.dispose.mockReset();
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
        storage.set('lineup_channel_setup_v2:server-1', JSON.stringify(record));
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
        storage.set('lineup_channel_setup_v2:server-1', JSON.stringify({
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

        expect(storageRemove).toHaveBeenCalledWith('lineup_channel_setup_v2:server-9');
        expect(navigation.goTo).toHaveBeenCalledWith('channel-setup');
        expect(coordinator.shouldRunChannelSetup()).toBe(true);
    });

    it('cleanupStaleChannelBuildKeys removes only temp build keys and does not throw', () => {
        const { coordinator } = createCoordinator();
        localStorage.clear();
        localStorage.setItem('lineup_channels_build_tmp_v1:abc', '1');
        localStorage.setItem('lineup_current_channel_build_tmp_v1:def', '2');
        localStorage.setItem('lineup_channel_setup_v2:server-1', 'keep');

        expect(() => coordinator.cleanupStaleChannelBuildKeys()).not.toThrow();
        expect(localStorage.getItem('lineup_channels_build_tmp_v1:abc')).toBe(null);
        expect(localStorage.getItem('lineup_current_channel_build_tmp_v1:def')).toBe(null);
        expect(localStorage.getItem('lineup_channel_setup_v2:server-1')).toBe('keep');
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
        storage.set('lineup_channel_setup_v2:server-1', JSON.stringify(existing));
        channelManager.getAllChannels.mockReturnValue([mockChannelConfig]);

        coordinator.requestChannelSetupRerun();
        storage.set('lineup_channel_setup_v2:server-1', JSON.stringify(existing));
        coordinator.markSetupComplete('server-1', createConfig({ minItemsPerChannel: 7 }));

        const stored = storage.get('lineup_channel_setup_v2:server-1');
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

        const raw = storage.get('lineup_channel_setup_v2:server-1');
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

        const raw = storage.get('lineup_channel_setup_v2:server-1');
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
            variantType: 'none',
            variantBlockSize: 3,
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

    it('createChannelsFromSetup treats actual aborted signals as cancellation without errors', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        const controller = new AbortController();
        plexLibrary.getPlaylists.mockImplementation(() => {
            controller.abort();
            return Promise.reject(new DOMException('Aborted', 'AbortError'));
        });

        const summary = await coordinator.createChannelsFromSetup(createConfig({
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
        }), { signal: controller.signal });

        expect(summary.canceled).toBe(true);
        expect(summary.lastTask).toBe('fetch_playlists');
        expect(summary.errorCount).toBe(0);
    });

    it('createChannelsFromSetup treats aborted getLibrariesForSetup as cancellation', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        const controller = new AbortController();
        plexLibrary.getLibraries.mockImplementation(() => {
            controller.abort();
            return Promise.reject(new DOMException('Aborted', 'AbortError'));
        });

        const summary = await coordinator.createChannelsFromSetup(createConfig(), { signal: controller.signal });

        expect(summary.canceled).toBe(true);
        expect(summary.lastTask).toBe('fetch_playlists');
        expect(summary.errorCount).toBe(0);
    });

    it('createChannelsFromSetup treats playlist AbortError as a non-cancel failure when the caller signal is not aborted', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        const controller = new AbortController();
        plexLibrary.getPlaylists.mockRejectedValue(new DOMException('Aborted', 'AbortError'));

        const summary = await coordinator.createChannelsFromSetup(createConfig({
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
        }), { signal: controller.signal });

        expect(controller.signal.aborted).toBe(false);
        expect(summary.canceled).toBe(false);
        expect(summary.errorCount).toBeGreaterThan(0);
    });

    it('createChannelsFromSetup does not treat getLibraries AbortError as cancellation when the caller signal is not aborted', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        const controller = new AbortController();
        plexLibrary.getLibraries.mockRejectedValue(new DOMException('Aborted', 'AbortError'));

        await expect(
            coordinator.createChannelsFromSetup(createConfig(), { signal: controller.signal })
        ).rejects.toThrow('Aborted');
        expect(controller.signal.aborted).toBe(false);
    });

    it('createChannelsFromSetup falls back to default minItems for non-finite values', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([
            { id: 'lib1', title: 'Movies', type: 'movie', contentCount: 25 },
        ] as PlexLibraryType[]);
        plexLibrary.getGenres.mockResolvedValue([{ key: 'action', title: 'Action', count: 1 }]);

        await coordinator.createChannelsFromSetup(createConfig({
            selectedLibraryIds: ['lib1'],
            strategyConfig: createStrategyConfig({ genres: { enabled: true } }),
            minItemsPerChannel: Number.NaN,
        }));

        expect(plexLibrary.getGenres).toHaveBeenCalled();
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

    it('append mode commits channels sorted by channel number', async () => {
        const { coordinator, plexLibrary, channelManager } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([] as PlexLibraryType[]);
        plexLibrary.getPlaylists.mockResolvedValue([
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'Favorites', thumb: null, duration: 0, leafCount: 10 },
        ]);
        channelManager.getAllChannels.mockReturnValue([
            { ...mockChannelConfig, id: 'c1', number: 1, name: 'Existing 1' },
            { ...mockChannelConfig, id: 'c3', number: 3, name: 'Existing 3' },
        ]);
        channelManager.getCurrentChannel.mockReturnValue({ ...mockChannelConfig, id: 'c3', number: 3, name: 'Existing 3' });

        await coordinator.createChannelsFromSetup(createConfig({
            buildMode: 'append',
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
        }));

        const [replaceArgs] = channelManager.replaceAllChannels.mock.calls[0] ?? [];
        expect(replaceArgs?.map((channel: ChannelConfig) => channel.number)).toEqual([1, 2, 3]);
    });

    it('reuses the same lowest free number after a failed append-mode create', async () => {
        const { coordinator, plexLibrary, channelManager } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([] as PlexLibraryType[]);
        plexLibrary.getPlaylists.mockResolvedValue([
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'Favorites', thumb: null, duration: 0, leafCount: 10 },
            { ratingKey: 'pl2', key: '/playlists/pl2', title: 'Watchlist', thumb: null, duration: 0, leafCount: 10 },
        ]);
        channelManager.getAllChannels.mockReturnValue([
            { ...mockChannelConfig, id: 'c1', number: 1, name: 'Existing 1' },
            { ...mockChannelConfig, id: 'c3', number: 3, name: 'Existing 3' },
        ]);

        let failedOnce = false;
        mockBuilder.createChannel.mockImplementationOnce(async () => {
            failedOnce = true;
            throw new Error('builder failed');
        });

        const summary = await coordinator.createChannelsFromSetup(createConfig({
            buildMode: 'append',
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
        }));

        expect(failedOnce).toBe(true);
        expect(mockBuilder.createChannel).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ number: 2 }),
            expect.any(Object)
        );
        expect(mockBuilder.createChannel).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ number: 2 }),
            expect.any(Object)
        );
        expect(summary.errorCount).toBe(1);
        expect(summary.skipped).toBe(0);

        const [replaceArgs] = channelManager.replaceAllChannels.mock.calls[0] ?? [];
        expect(replaceArgs?.map((channel: ChannelConfig) => channel.number)).toEqual([1, 2, 3]);
    });

    it('counts cap-truncated pending channels as skipped in append mode', async () => {
        const { coordinator, plexLibrary, channelManager } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([] as PlexLibraryType[]);
        plexLibrary.getPlaylists.mockResolvedValue([
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'Favorites', thumb: null, duration: 0, leafCount: 10 },
        ]);
        channelManager.getAllChannels.mockReturnValue(
            Array.from({ length: MAX_CHANNEL_NUMBER }, (_, index) => ({
                ...mockChannelConfig,
                id: `existing-${index + 1}`,
                number: index + 1,
                name: `Existing ${index + 1}`,
            }))
        );

        const summary = await coordinator.createChannelsFromSetup(createConfig({
            buildMode: 'append',
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
        }));

        expect(summary.created).toBe(0);
        expect(summary.skipped).toBe(1);
        expect(summary.reachedMaxChannels).toBe(true);
    });

    it('keeps reachedMaxChannels synced on cancel during channel creation', async () => {
        const { coordinator, plexLibrary, channelManager } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([] as PlexLibraryType[]);
        plexLibrary.getPlaylists.mockResolvedValue([
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'P1', thumb: null, duration: 0, leafCount: 10 },
            { ratingKey: 'pl2', key: '/playlists/pl2', title: 'P2', thumb: null, duration: 0, leafCount: 10 },
            { ratingKey: 'pl3', key: '/playlists/pl3', title: 'P3', thumb: null, duration: 0, leafCount: 10 },
        ]);
        channelManager.getAllChannels.mockReturnValue(
            Array.from({ length: MAX_CHANNEL_NUMBER - 2 }, (_, index) => ({
                ...mockChannelConfig,
                id: `existing-${index + 1}`,
                number: index + 1,
                name: `Existing ${index + 1}`,
            }))
        );

        const abortController = new AbortController();
        onCreateChannel = (): void => {
            onCreateChannel = null;
            abortController.abort();
        };

        const summary = await coordinator.createChannelsFromSetup(
            createConfig({
                buildMode: 'append',
                strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
            }),
            { signal: abortController.signal }
        );

        expect(summary.canceled).toBe(true);
        expect(summary.reachedMaxChannels).toBe(true);
    });

    it('disposes the temporary builder before removing temp storage keys', async () => {
        const { coordinator, plexLibrary, storageRemove } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([] as PlexLibraryType[]);
        plexLibrary.getPlaylists.mockResolvedValue([
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'Favorites', thumb: null, duration: 0, leafCount: 10 },
        ]);

        await coordinator.createChannelsFromSetup(createConfig({
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
        }));

        expect(mockBuilder.dispose).toHaveBeenCalledTimes(1);
        const disposeOrder = mockBuilder.dispose.mock.invocationCallOrder[0];
        const firstRemoveOrder = storageRemove.mock.invocationCallOrder[0];
        expect(firstRemoveOrder).toBeDefined();
        expect(disposeOrder).toBeDefined();
        expect(disposeOrder as number).toBeLessThan(firstRemoveOrder as number);
    });

    it('keeps a saved-but-refresh-failed warning in the final progress update', async () => {
        const { coordinator, plexLibrary, deps } = createCoordinator({
            refreshEpgSchedules: jest.fn().mockRejectedValue(new Error('refresh failed')),
        });
        const progressEvents: Array<{ task: string; label: string; detail: string }> = [];
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        plexLibrary.getLibraries.mockResolvedValue([] as PlexLibraryType[]);
        plexLibrary.getPlaylists.mockResolvedValue([
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'Favorites', thumb: null, duration: 0, leafCount: 10 },
        ]);

        const summary = await coordinator.createChannelsFromSetup(
            createConfig({
                strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
            }),
            {
                onProgress: (event): void => {
                    progressEvents.push({
                        task: event.task,
                        label: event.label,
                        detail: event.detail,
                    });
                },
            }
        );

        expect(summary.created).toBe(1);
        expect(summary.lastTask).toBe('done');
        expect(deps.primeEpgChannels).toHaveBeenCalledTimes(1);
        expect(deps.refreshEpgSchedules).toHaveBeenCalledTimes(1);
        expect(progressEvents.at(-1)).toEqual({
            task: 'done',
            label: 'Done!',
            detail: 'Built 1 channels (guide refresh failed)',
        });
        expect(warnSpy).toHaveBeenCalledWith(
            '[ChannelSetup] EPG refresh failed after commit:',
            expect.objectContaining({ message: 'refresh failed' })
        );

        warnSpy.mockRestore();
    });

    it('clears the selected-channel snapshot before refreshing EPG with { reason: "channel-setup", debounceMs: 0 } from createChannelsFromSetup', async () => {
        const clearSelectedChannelScheduleSnapshot = jest.fn();
        const { coordinator, plexLibrary, deps } = createCoordinator({
            clearSelectedChannelScheduleSnapshot,
        });
        plexLibrary.getLibraries.mockResolvedValue([] as PlexLibraryType[]);
        plexLibrary.getPlaylists.mockResolvedValue([
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'Favorites', thumb: null, duration: 0, leafCount: 10 },
        ]);

        await coordinator.createChannelsFromSetup(createConfig({
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
        }));

        expect(clearSelectedChannelScheduleSnapshot).toHaveBeenCalledTimes(1);
        expect(deps.refreshEpgSchedules).toHaveBeenCalledWith({ reason: 'channel-setup', debounceMs: 0 });
        const clearOrder = clearSelectedChannelScheduleSnapshot.mock.invocationCallOrder[0];
        const refreshOrder = (deps.refreshEpgSchedules as jest.Mock).mock.invocationCallOrder[0];
        expect(clearOrder).toBeDefined();
        expect(refreshOrder).toBeDefined();
        expect(clearOrder as number).toBeLessThan(refreshOrder as number);
    });

    it('awaits EPG readiness before priming and refreshing after a successful build', async () => {
        const ensureEpgInitialized = jest.fn().mockResolvedValue(undefined);
        const { coordinator, plexLibrary, deps } = createCoordinator({
            ensureEpgInitialized,
        });
        plexLibrary.getLibraries.mockResolvedValue([] as PlexLibraryType[]);
        plexLibrary.getPlaylists.mockResolvedValue([
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'Favorites', thumb: null, duration: 0, leafCount: 10 },
        ]);

        await coordinator.createChannelsFromSetup(createConfig({
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
        }));

        expect(ensureEpgInitialized).toHaveBeenCalledTimes(1);
        expect(deps.primeEpgChannels).toHaveBeenCalledTimes(1);
        expect(deps.refreshEpgSchedules).toHaveBeenCalledWith({ reason: 'channel-setup', debounceMs: 0 });
        const ensureOrder = ensureEpgInitialized.mock.invocationCallOrder[0];
        const primeOrder = (deps.primeEpgChannels as jest.Mock).mock.invocationCallOrder[0];
        const refreshOrder = (deps.refreshEpgSchedules as jest.Mock).mock.invocationCallOrder[0];
        expect(ensureOrder).toBeDefined();
        expect(primeOrder).toBeDefined();
        expect(refreshOrder).toBeDefined();
        expect(ensureOrder as number).toBeLessThan(primeOrder as number);
        expect(primeOrder as number).toBeLessThan(refreshOrder as number);
    });

    it('returns done as the lastTask after a successful build', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([] as PlexLibraryType[]);
        plexLibrary.getPlaylists.mockResolvedValue([
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'Favorites', thumb: null, duration: 0, leafCount: 10 },
        ]);

        const summary = await coordinator.createChannelsFromSetup(createConfig({
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
        }));

        expect(summary.created).toBe(1);
        expect(summary.canceled).toBe(false);
        expect(summary.lastTask).toBe('done');
    });

    it('treats progress callback failures as non-fatal and completes the build', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        plexLibrary.getLibraries.mockResolvedValue([] as PlexLibraryType[]);
        plexLibrary.getPlaylists.mockResolvedValue([
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'Favorites', thumb: null, duration: 0, leafCount: 10 },
        ]);

        const summary = await coordinator.createChannelsFromSetup(
            createConfig({
                strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
            }),
            {
                onProgress: (): void => {
                    throw new Error('progress blew up');
                },
            }
        );

        expect(summary.created).toBe(1);
        expect(summary.canceled).toBe(false);
        expect(summary.lastTask).toBe('done');
        expect(warnSpy).toHaveBeenCalledWith(
            '[ChannelSetup] progress callback failed:',
            expect.objectContaining({ message: 'progress blew up' })
        );

        warnSpy.mockRestore();
    });

    it('logs cleanup failures without masking a successful build', async () => {
        const cleanupError = new Error('temp storage unavailable');
        const storageRemove = jest.fn(() => {
            throw cleanupError;
        });
        const { coordinator, plexLibrary, channelManager } = createCoordinator({
            storageRemove,
        });
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        plexLibrary.getLibraries.mockResolvedValue([] as PlexLibraryType[]);
        plexLibrary.getPlaylists.mockResolvedValue([
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'Favorites', thumb: null, duration: 0, leafCount: 10 },
        ]);

        const summary = await coordinator.createChannelsFromSetup(createConfig({
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
        }));

        expect(summary.created).toBe(1);
        expect(channelManager.replaceAllChannels).toHaveBeenCalledTimes(1);
        expect(storageRemove).toHaveBeenCalledTimes(2);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[ChannelSetup] cleanup failed (storageRemove('),
            expect.objectContaining({ message: 'temp storage unavailable' })
        );

        warnSpy.mockRestore();
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

    it('merge mode commits channels sorted by channel number when inserting a new channel into a gap', async () => {
        const { coordinator, plexLibrary, channelManager } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([] as PlexLibraryType[]);
        plexLibrary.getPlaylists.mockResolvedValue([
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'Favorites', thumb: null, duration: 0, leafCount: 10 },
            { ratingKey: 'pl2', key: '/playlists/pl2', title: 'Later', thumb: null, duration: 0, leafCount: 10 },
        ]);
        channelManager.getAllChannels.mockReturnValue([
            {
                ...mockChannelConfig,
                id: 'c1',
                name: 'Favorites',
                number: 1,
                isAutoGenerated: true,
                contentSource: { type: 'playlist', playlistKey: 'pl1', playlistName: 'Favorites' },
                playbackMode: 'shuffle',
            } as ChannelConfig,
            {
                ...mockChannelConfig,
                id: 'c3',
                name: 'Existing 3',
                number: 3,
                isAutoGenerated: false,
                contentSource: { type: 'library', libraryId: 'lib2', libraryType: 'movie', includeWatched: true },
                playbackMode: 'shuffle',
            } as ChannelConfig,
        ]);

        await coordinator.createChannelsFromSetup(createConfig({
            buildMode: 'merge',
            strategyConfig: createStrategyConfig({
                playlists: { enabled: true, priority: 1 },
                collections: { enabled: false },
            }),
        }));

        const [replaceArgs] = channelManager.replaceAllChannels.mock.calls[0] ?? [];
        expect(replaceArgs?.map((channel: ChannelConfig) => channel.number)).toEqual([1, 2, 3]);
    });

    it('preserves the current channel when replacing the full channel lineup after setup', async () => {
        const { coordinator, plexLibrary, channelManager } = createCoordinator();
        const currentChannel = { ...mockChannelConfig, id: 'current-2', number: 2, name: 'Current' } as ChannelConfig;
        plexLibrary.getLibraries.mockResolvedValue([] as PlexLibraryType[]);
        plexLibrary.getPlaylists.mockResolvedValue([
            { ratingKey: 'pl1', key: '/playlists/pl1', title: 'Favorites', thumb: null, duration: 0, leafCount: 10 },
        ]);
        channelManager.getAllChannels.mockReturnValue([
            { ...mockChannelConfig, id: 'existing-1', number: 1, name: 'Existing 1' },
            currentChannel,
        ]);
        channelManager.getCurrentChannel.mockReturnValue(currentChannel);

        await coordinator.createChannelsFromSetup(createConfig({
            buildMode: 'append',
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
        }));

        expect(channelManager.replaceAllChannels).toHaveBeenCalledWith(
            expect.any(Array),
            { currentChannelId: 'current-2' }
        );
    });

    it('passes blockSize when creating block-mode series channels', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([
            { id: 's1', title: 'Shows', type: 'show', contentCount: 25 },
        ] as PlexLibraryType[]);
        plexLibrary.getCollections.mockResolvedValue([
            { ratingKey: 'co1', key: '/library/collections/co1', title: 'Classics', thumb: null, childCount: 10 },
        ]);

        await coordinator.createChannelsFromSetup(createConfig({
            selectedLibraryIds: ['s1'],
            strategyConfig: createStrategyConfig({ collections: { enabled: true } }),
            seriesOrdering: {
                basePlaybackMode: 'block',
                baseBlockSize: 4,
            },
        }));

        expect(mockBuilder.createChannel).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Classics',
            playbackMode: 'block',
            blockSize: 4,
        }), expect.any(Object));
    });

    it('clears stale blockSize on merge when planned channel is non-block', async () => {
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
                isAutoGenerated: true,
                contentSource: { type: 'playlist', playlistKey: 'pl1', playlistName: 'Favorites' },
                playbackMode: 'block',
                blockSize: 5,
            } as ChannelConfig,
        ]);

        await coordinator.createChannelsFromSetup(createConfig({
            buildMode: 'merge',
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
        }));

        const replaceArgs = channelManager.replaceAllChannels.mock.calls[0]?.[0];
        expect(replaceArgs).toHaveLength(1);
        expect(replaceArgs?.[0]?.playbackMode).toBe('shuffle');
        expect(replaceArgs?.[0]?.blockSize).toBeUndefined();
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
                variantType: 'none',
                variantBlockSize: 3,
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
        plexLibrary.getLibraries.mockResolvedValue([
            { id: 's1', title: 'Shows', type: 'show', contentCount: 25 },
        ] as PlexLibraryType[]);
        plexLibrary.getCollections.mockResolvedValue([
            { ratingKey: 'co1', key: '/library/collections/co1', title: 'Classics', thumb: null, childCount: 10 },
        ]);

        await coordinator.createChannelsFromSetup(createConfig({
            selectedLibraryIds: ['s1'],
            strategyConfig: createStrategyConfig({ collections: { enabled: true } }),
            channelExpansion: {
                addAlternateLineups: true,
                alternateLineupCopies: 2,
                variantType: 'sequential',
                variantBlockSize: 3,
            },
        }));

        const calls = mockBuilder.createChannel.mock.calls.map(([cfg]) => cfg as ChannelConfig);
        expect(calls).toHaveLength(6);
        expect(calls.map((cfg) => cfg.name)).toEqual([
            'Classics',
            'Classics (2)',
            'Classics (3)',
            'Classics • Sequential',
            'Classics (2) • Sequential',
            'Classics (3) • Sequential',
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
                variantType: 'none',
                variantBlockSize: 3,
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
                variantType: 'sequential',
                variantBlockSize: 3,
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
        plexLibrary.getGenres.mockImplementation(async (libraryId: string) => {
            if (libraryId === 'm1') {
                return [{ key: 'action', title: 'Action', count: 1 }] as unknown as PlexTagDirectoryItem[];
            }
            if (libraryId === 's1') {
                return [{ key: 'action', title: 'Action', count: 1 }] as unknown as PlexTagDirectoryItem[];
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
        expect(
            genreChannels.every(
                (cfg) =>
                    cfg.contentSource.type === 'library'
                    && cfg.contentSource.libraryFilter?.genre === 'Action'
                    && cfg.contentFilters === undefined
            )
        ).toBe(true);
    });

    it('creates mixed cross-library genre channels only when explicitly enabled', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([
            { id: 'm1', title: 'Movies', type: 'movie', contentCount: 25 },
            { id: 's1', title: 'Shows', type: 'show', contentCount: 25 },
        ] as PlexLibraryType[]);
        plexLibrary.getGenres.mockImplementation(async (libraryId: string) => {
            if (libraryId === 'm1') {
                return [{ key: 'action', title: 'Action', count: 1 }] as unknown as PlexTagDirectoryItem[];
            }
            if (libraryId === 's1') {
                return [{ key: 'action', title: 'Action', count: 1 }] as unknown as PlexTagDirectoryItem[];
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

    it('surfaces playlist fetch failures as preview warnings', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getPlaylists.mockRejectedValue({
            name: 'Error',
            code: 'NETWORK_TIMEOUT',
            message: 'playlist fetch failed',
        });

        const preview = await coordinator.getSetupPreview(createConfig({
            strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
        }));

        expect(preview.warnings).toEqual(
            expect.arrayContaining([
                expect.stringContaining('fetch_playlists'),
                expect.stringContaining('playlist fetch failed'),
            ])
        );
    });

    it('surfaces required tag-directory stop warnings in review when a tag fetch fails', async () => {
        const { coordinator, plexLibrary } = createCoordinator();
        plexLibrary.getLibraries.mockResolvedValue([
            { id: 'm1', title: 'Movies', type: 'movie', contentCount: 25 },
        ] as PlexLibraryType[]);
        plexLibrary.getGenres.mockRejectedValue({
            name: 'Error',
            code: 'SERVER_ERROR',
            message: 'scan failed',
        });

        const review = await coordinator.getSetupReview(createConfig({
            selectedLibraryIds: ['m1'],
            strategyConfig: createStrategyConfig({ genres: { enabled: true } }),
            minItemsPerChannel: 1,
        }));

        expect(review.preview.warnings).toEqual(
            expect.arrayContaining([
                expect.stringContaining('stop and re-plan'),
                expect.stringContaining('scan failed'),
            ])
        );
        expect(review.diff.summary).toEqual({ created: 0, removed: 0, unchanged: 0 });
    });

    it('buildSetupPlan returns explicit warnings alongside partial plan results', async () => {
        const { plexLibrary, channelManager } = createCoordinator();
        const planningService = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        plexLibrary.getPlaylists.mockRejectedValue({
            name: 'Error',
            code: 'NETWORK_TIMEOUT',
            message: 'playlist fetch failed',
        });

        const result = await planningService.buildSetupPlan(
            planningService.normalizeConfig(createConfig({
                strategyConfig: createStrategyConfig({ playlists: { enabled: true } }),
            })),
            [],
            null
        );

        expect(result.canceled).toBe(false);
        expect(result.plan).not.toBeNull();
        expect(result.warnings).toEqual(
            expect.arrayContaining([
                expect.stringContaining('fetch_playlists'),
                expect.stringContaining('playlist fetch failed'),
            ])
        );
        expect(result.plan?.warnings).toEqual(expect.arrayContaining(result.warnings));
    });
});
