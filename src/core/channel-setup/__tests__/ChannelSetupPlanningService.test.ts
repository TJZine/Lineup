/**
 * @jest-environment jsdom
 */

import { ChannelSetupPlanningService } from '../ChannelSetupPlanningService';
import type { ChannelSetupConfig, SetupStrategyConfig, SetupStrategyKey } from '../types';
import { DEFAULT_STRATEGY_PRIORITIES, MIXED_SCOPE_STRATEGY_KEYS, SETUP_STRATEGY_KEYS } from '../constants';
import { PLEX_MEDIA_TYPES } from '../../../modules/plex/library';
import type {
    IPlexLibrary,
    PlexLibraryType,
    PlexTagDirectoryItem,
    PlexTagDirectoryUnsupportedReason,
} from '../../../modules/plex/library';
import type { IChannelManager } from '../../../modules/scheduler/channel-manager';

const makeLibrary = (overrides: Partial<PlexLibraryType>): PlexLibraryType => ({
    id: 'lib1',
    uuid: 'uuid-1',
    title: 'Shows',
    type: 'show',
    agent: 'agent',
    scanner: 'scanner',
    contentCount: 0,
    lastScannedAt: new Date(0),
    art: null,
    thumb: null,
    ...overrides,
});

const makeTag = (overrides: Partial<PlexTagDirectoryItem>): PlexTagDirectoryItem => ({
    key: 'tag',
    title: 'Tag One',
    count: 1,
    ...overrides,
});

const createDeferred = <T>(): {
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

const createConfig = (
    overrides: Omit<Partial<ChannelSetupConfig>, 'strategyConfig'> & {
        strategyConfig?: Partial<Record<SetupStrategyKey, Partial<SetupStrategyConfig>>>;
    }
): ChannelSetupConfig => {
    const { strategyConfig: strategyOverrides, ...rest } = overrides;
    const strategyConfig = SETUP_STRATEGY_KEYS.reduce<ChannelSetupConfig['strategyConfig']>((acc, key) => {
        const candidate = strategyOverrides?.[key];
        acc[key] = {
            enabled: candidate?.enabled ?? false,
            priority: candidate?.priority ?? DEFAULT_STRATEGY_PRIORITIES[key],
            scope: MIXED_SCOPE_STRATEGY_KEYS.has(key) && candidate?.scope === 'cross-library' ? 'cross-library' : 'per-library',
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

describe('ChannelSetupPlanningService', () => {
    it('uses tag directories and avoids scan truncation warning for show libraries', async () => {
        const plexLibrary = {
            getPlaylists: jest.fn(),
            getCollections: jest.fn(),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockResolvedValue([
                makeTag({ title: 'Comedy', count: 10 }),
            ]),
            getDirectors: jest.fn().mockResolvedValue([
                makeTag({ title: 'Jane Doe', count: 12 }),
            ]),
            getYears: jest.fn().mockResolvedValue([
                makeTag({ title: '1981', count: 3 }),
                makeTag({ title: '1988', count: 2 }),
                makeTag({ title: '1995', count: 4 }),
            ]),
            getActors: jest.fn(),
            getStudios: jest.fn(),
        } as unknown as jest.Mocked<IPlexLibrary>;

        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;

        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const config = service.normalizeConfig(createConfig({
            selectedLibraryIds: ['shows'],
            minItemsPerChannel: 3,
            strategyConfig: {
                genres: { enabled: true, priority: 1, scope: 'per-library' },
                decades: { enabled: true, priority: 2, scope: 'per-library' },
                directors: { enabled: true, priority: 3, scope: 'per-library' },
            },
        }));

        const libraries = [makeLibrary({
            id: 'shows',
            title: 'Shows',
            type: 'show',
            contentCount: 1200,
        })];
        const result = await service.buildSetupPlan(config, libraries, null);

        expect(result.canceled).toBe(false);
        expect(result.plan).not.toBeNull();
        expect(result.warnings.join('\n')).not.toContain('truncated at 500');
        expect(result.warnings.join('\n')).not.toContain('scan_library_items');
        expect(plexLibrary.getLibraryItems).not.toHaveBeenCalled();
        expect(plexLibrary.getGenres).toHaveBeenCalledWith(
            'shows',
            expect.objectContaining({ type: PLEX_MEDIA_TYPES.SHOW })
        );
        expect(plexLibrary.getDirectors).toHaveBeenCalledWith(
            'shows',
            expect.objectContaining({ type: PLEX_MEDIA_TYPES.EPISODE })
        );
        expect(plexLibrary.getYears).toHaveBeenCalledWith(
            'shows',
            expect.objectContaining({ type: PLEX_MEDIA_TYPES.EPISODE })
        );
        expect(result.plan?.pendingChannels.some((c) => c.name.includes('Shows - Comedy'))).toBe(true);
        expect(result.plan?.pendingChannels.some((c) => c.name.includes('Shows - Jane Doe'))).toBe(true);
        expect(result.plan?.pendingChannels.some((c) => c.name.includes('Shows - 1980s'))).toBe(true);
    });

    it('stops planning when a required tag directory endpoint is unsupported', async () => {
        const plexLibrary = {
            getPlaylists: jest.fn(),
            getCollections: jest.fn(),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockImplementation(
                async (
                    _libraryId: string,
                    options: { onUnsupported?: (reason: PlexTagDirectoryUnsupportedReason) => void }
                ) => {
                    const reason: PlexTagDirectoryUnsupportedReason = 'unavailable';
                    options.onUnsupported?.(reason);
                    return [];
                }
            ),
            getDirectors: jest.fn(),
            getYears: jest.fn(),
            getActors: jest.fn(),
            getStudios: jest.fn(),
        } as unknown as jest.Mocked<IPlexLibrary>;

        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;

        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const config = service.normalizeConfig(createConfig({
            selectedLibraryIds: ['shows'],
            strategyConfig: {
                genres: { enabled: true, priority: 1, scope: 'per-library' },
            },
        }));

        const libraries = [makeLibrary({
            id: 'shows',
            title: 'Shows',
            type: 'show',
            contentCount: 1200,
        })];

        const result = await service.buildSetupPlan(config, libraries, null);

        expect(result.canceled).toBe(false);
        expect(result.blockedMessage).toContain('stop and re-plan');
        expect(result.lastTask).toBe('scan_library_items');
        expect(result.plan).toBeNull();
        expect(result.warnings.join('\n')).toContain('stop and re-plan');
        expect(result.warnings.join('\n')).toContain('genres');
        expect(plexLibrary.getLibraryItems).not.toHaveBeenCalled();
    });

    it('stops planning when a required tag directory fetch fails', async () => {
        const plexLibrary = {
            getPlaylists: jest.fn(),
            getCollections: jest.fn(),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn(),
            getDirectors: jest.fn().mockRejectedValue({
                name: 'Error',
                code: 'SERVER_ERROR',
                message: 'director endpoint failed',
            }),
            getYears: jest.fn(),
            getActors: jest.fn(),
            getStudios: jest.fn(),
        } as unknown as jest.Mocked<IPlexLibrary>;

        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;

        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const config = service.normalizeConfig(createConfig({
            selectedLibraryIds: ['shows'],
            strategyConfig: {
                directors: { enabled: true, priority: 1, scope: 'per-library' },
            },
        }));

        const libraries = [makeLibrary({
            id: 'shows',
            title: 'Shows',
            type: 'show',
            contentCount: 1200,
        })];

        const result = await service.buildSetupPlan(config, libraries, null);

        expect(result.canceled).toBe(false);
        expect(result.blockedMessage).toContain('stop and re-plan');
        expect(result.lastTask).toBe('scan_library_items');
        expect(result.plan).toBeNull();
        expect(result.warnings.join('\n')).toContain('stop and re-plan');
        expect(result.warnings.join('\n')).toContain('director endpoint failed');
        expect(plexLibrary.getLibraryItems).not.toHaveBeenCalled();
    });

    it('reuses the same facet snapshot across preview, review, and build-equivalent planning paths', async () => {
        const libraries = [
            makeLibrary({
                id: 'shows',
                title: 'Shows',
                type: 'show',
                contentCount: 1200,
            }),
        ];
        const plexLibrary = {
            getLibraries: jest.fn().mockResolvedValue(libraries),
            getPlaylists: jest.fn().mockResolvedValue([]),
            getCollections: jest.fn().mockResolvedValue([]),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockResolvedValue([
                makeTag({ title: 'Comedy', count: 10 }),
            ]),
            getDirectors: jest.fn().mockResolvedValue([
                makeTag({ title: 'Jane Doe', count: 12 }),
            ]),
            getYears: jest.fn().mockResolvedValue([
                makeTag({ title: '1981', count: 3 }),
                makeTag({ title: '1988', count: 2 }),
                makeTag({ title: '1995', count: 4 }),
            ]),
            getActors: jest.fn().mockResolvedValue([]),
            getStudios: jest.fn().mockResolvedValue([]),
        } as unknown as jest.Mocked<IPlexLibrary>;

        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;

        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const config = service.normalizeConfig(createConfig({
            selectedLibraryIds: ['shows'],
            minItemsPerChannel: 3,
            strategyConfig: {
                genres: { enabled: true, priority: 1, scope: 'per-library' },
                decades: { enabled: true, priority: 2, scope: 'per-library' },
                directors: { enabled: true, priority: 3, scope: 'per-library' },
            },
        }));

        const preview = await service.getSetupPreview(config);
        const review = await service.getSetupReview(config);
        const planResult = await service.buildSetupPlan(config, libraries, null);

        expect(preview.estimates.total).toBeGreaterThan(0);
        expect(review.preview.estimates.total).toBe(planResult.plan?.estimates.total);
        expect(planResult.plan).not.toBeNull();
        expect(plexLibrary.getGenres).toHaveBeenCalledTimes(1);
        expect(plexLibrary.getDirectors).toHaveBeenCalledTimes(1);
        expect(plexLibrary.getYears).toHaveBeenCalledTimes(1);
    });

    it('lets build cancellation stop waiting on an inflight snapshot started by preview', async () => {
        const libraries = [
            makeLibrary({
                id: 'shows',
                title: 'Shows',
                type: 'show',
                contentCount: 1200,
            }),
        ];
        const genres = createDeferred<PlexTagDirectoryItem[]>();
        const plexLibrary = {
            getLibraries: jest.fn().mockResolvedValue(libraries),
            getPlaylists: jest.fn().mockResolvedValue([]),
            getCollections: jest.fn().mockResolvedValue([]),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockImplementation(() => genres.promise),
            getDirectors: jest.fn().mockResolvedValue([]),
            getYears: jest.fn().mockResolvedValue([]),
            getActors: jest.fn().mockResolvedValue([]),
            getStudios: jest.fn().mockResolvedValue([]),
        } as unknown as jest.Mocked<IPlexLibrary>;
        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;
        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const config = service.normalizeConfig(createConfig({
            selectedLibraryIds: ['shows'],
            strategyConfig: {
                genres: { enabled: true, priority: 1, scope: 'per-library' },
            },
        }));

        void service.getSetupPreview(config, { signal: new AbortController().signal });
        await Promise.resolve();
        await Promise.resolve();
        expect(plexLibrary.getGenres).toHaveBeenCalledTimes(1);

        const buildAbortController = new AbortController();
        const settled = jest.fn();
        const buildPromise = service.buildSetupPlan(config, libraries, buildAbortController.signal, jest.fn());
        void buildPromise.then(settled);
        await Promise.resolve();

        buildAbortController.abort();
        const buildResult = await Promise.race([
            buildPromise,
            new Promise<'pending'>((resolve) => {
                setTimeout(() => resolve('pending'), 0);
            }),
        ]);

        expect(buildResult).toEqual(expect.objectContaining({
            canceled: true,
            lastTask: 'scan_library_items',
        }));
        expect(settled).toHaveBeenCalledTimes(1);

        genres.resolve([makeTag({ title: 'Comedy', count: 10 })]);
        await Promise.resolve();
    });

    it('treats unknown item counts as still requiring native-facet validation', async () => {
        const plexLibrary = {
            getPlaylists: jest.fn(),
            getCollections: jest.fn(),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockImplementation(
                async (
                    _libraryId: string,
                    options: { onUnsupported?: (reason: PlexTagDirectoryUnsupportedReason) => void }
                ) => {
                    options.onUnsupported?.('unavailable');
                    return [];
                }
            ),
            getDirectors: jest.fn(),
            getYears: jest.fn(),
            getActors: jest.fn(),
            getStudios: jest.fn(),
        } as unknown as jest.Mocked<IPlexLibrary>;
        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;
        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const config = service.normalizeConfig(createConfig({
            selectedLibraryIds: ['shows'],
            strategyConfig: {
                genres: { enabled: true, priority: 1, scope: 'per-library' },
            },
        }));
        const libraries = [makeLibrary({
            id: 'shows',
            title: 'Shows',
            type: 'show',
            contentCount: null,
        })];

        const result = await service.buildSetupPlan(config, libraries, null);

        expect(result.canceled).toBe(false);
        expect(result.blockedMessage).toContain('stop and re-plan');
        expect(result.failureReason).toBe('unsupported');
    });

    it('fetches selected libraries with bounded concurrency instead of a strict serial chain', async () => {
        const libraries = [
            makeLibrary({ id: 's1', title: 'Shows 1', type: 'show', contentCount: 1200 }),
            makeLibrary({ id: 's2', title: 'Shows 2', type: 'show', contentCount: 1200 }),
            makeLibrary({ id: 's3', title: 'Shows 3', type: 'show', contentCount: 1200 }),
        ];
        const deferredByLibraryId = new Map(
            libraries.map((library) => [library.id, createDeferred<PlexTagDirectoryItem[]>()])
        );
        const plexLibrary = {
            getPlaylists: jest.fn().mockResolvedValue([]),
            getCollections: jest.fn().mockResolvedValue([]),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockImplementation((libraryId: string) => {
                const deferred = deferredByLibraryId.get(libraryId);
                if (!deferred) {
                    throw new Error(`Missing deferred for ${libraryId}`);
                }
                return deferred.promise;
            }),
            getDirectors: jest.fn().mockResolvedValue([]),
            getYears: jest.fn().mockResolvedValue([]),
            getActors: jest.fn().mockResolvedValue([]),
            getStudios: jest.fn().mockResolvedValue([]),
        } as unknown as jest.Mocked<IPlexLibrary>;
        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;
        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const config = service.normalizeConfig(createConfig({
            selectedLibraryIds: ['s1', 's2', 's3'],
            strategyConfig: {
                genres: { enabled: true, priority: 1, scope: 'per-library' },
            },
        }));

        const pendingPlan = service.buildSetupPlan(config, libraries, null);
        await Promise.resolve();

        expect(plexLibrary.getGenres).toHaveBeenCalledTimes(2);
        expect(plexLibrary.getGenres).toHaveBeenNthCalledWith(1, 's1', expect.any(Object));
        expect(plexLibrary.getGenres).toHaveBeenNthCalledWith(2, 's2', expect.any(Object));

        deferredByLibraryId.get('s1')?.resolve([makeTag({ title: 'Comedy', count: 10 })]);
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
        });

        expect(plexLibrary.getGenres).toHaveBeenCalledTimes(3);
        expect(plexLibrary.getGenres).toHaveBeenNthCalledWith(3, 's3', expect.any(Object));

        deferredByLibraryId.get('s2')?.resolve([makeTag({ title: 'Drama', count: 8 })]);
        deferredByLibraryId.get('s3')?.resolve([makeTag({ title: 'Mystery', count: 6 })]);
        const result = await pendingPlan;

        expect(result.plan).not.toBeNull();
    });

    it('ignores stale progress from an invalidated detached snapshot load', async () => {
        const libraries = [
            makeLibrary({ id: 'old-1', title: 'Old 1', type: 'show', contentCount: 1200 }),
            makeLibrary({ id: 'old-2', title: 'Old 2', type: 'show', contentCount: 1200 }),
            makeLibrary({ id: 'old-3', title: 'Old 3', type: 'show', contentCount: 1200 }),
            makeLibrary({ id: 'new-1', title: 'New 1', type: 'show', contentCount: 1200 }),
        ];
        const deferredByLibraryId = new Map(
            libraries.map((library) => [library.id, createDeferred<PlexTagDirectoryItem[]>()])
        );
        const plexLibrary = {
            getLibraries: jest.fn().mockResolvedValue(libraries),
            getPlaylists: jest.fn().mockResolvedValue([]),
            getCollections: jest.fn().mockResolvedValue([]),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockImplementation((libraryId: string) => {
                const deferred = deferredByLibraryId.get(libraryId);
                if (!deferred) {
                    throw new Error(`Missing deferred for ${libraryId}`);
                }
                return deferred.promise;
            }),
            getDirectors: jest.fn().mockResolvedValue([]),
            getYears: jest.fn().mockResolvedValue([]),
            getActors: jest.fn().mockResolvedValue([]),
            getStudios: jest.fn().mockResolvedValue([]),
        } as unknown as jest.Mocked<IPlexLibrary>;
        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;
        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const oldConfig = service.normalizeConfig(createConfig({
            selectedLibraryIds: ['old-1', 'old-2', 'old-3'],
            strategyConfig: {
                genres: { enabled: true, priority: 1, scope: 'per-library' },
            },
        }));
        const newConfig = service.normalizeConfig(createConfig({
            selectedLibraryIds: ['new-1'],
            strategyConfig: {
                genres: { enabled: true, priority: 1, scope: 'per-library' },
            },
        }));

        const oldPreviewPromise = service.getSetupPreview(oldConfig, {
            signal: new AbortController().signal,
        });
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
        });
        expect(plexLibrary.getGenres).toHaveBeenCalledTimes(2);

        service.invalidateFacetSnapshot();

        const reportProgress = jest.fn();
        const newBuildPromise = service.buildSetupPlan(
            newConfig,
            libraries,
            new AbortController().signal,
            reportProgress
        );
        await Promise.resolve();

        expect(reportProgress).toHaveBeenCalledWith(
            'scan_library_items',
            'Resolving filters...',
            'New 1',
            0,
            1
        );

        deferredByLibraryId.get('old-1')?.resolve([makeTag({ title: 'Comedy', count: 10 })]);
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
        });

        expect(reportProgress.mock.calls).toEqual([
            ['scan_library_items', 'Resolving filters...', 'New 1', 0, 1],
        ]);

        deferredByLibraryId.get('new-1')?.resolve([makeTag({ title: 'Drama', count: 8 })]);
        const newBuildResult = await newBuildPromise;
        expect(newBuildResult.plan).not.toBeNull();

        deferredByLibraryId.get('old-2')?.resolve([makeTag({ title: 'Thriller', count: 6 })]);
        deferredByLibraryId.get('old-3')?.resolve([makeTag({ title: 'Mystery', count: 4 })]);
        await oldPreviewPromise;
    });

    it('fails fast and aborts slow sibling library work after the first blocked result', async () => {
        const libraries = [
            makeLibrary({ id: 'fast', title: 'Fast Library', type: 'show', contentCount: 1200 }),
            makeLibrary({ id: 'slow', title: 'Slow Library', type: 'show', contentCount: 1200 }),
        ];
        let slowSignal: AbortSignal | undefined;
        const plexLibrary = {
            getPlaylists: jest.fn().mockResolvedValue([]),
            getCollections: jest.fn().mockResolvedValue([]),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockImplementation(
                async (
                    libraryId: string,
                    options: {
                        signal?: AbortSignal | null;
                        onUnsupported?: (reason: PlexTagDirectoryUnsupportedReason) => void;
                    }
                ) => {
                    if (libraryId === 'fast') {
                        options.onUnsupported?.('unavailable');
                        return [];
                    }
                    slowSignal = options.signal ?? undefined;
                    return new Promise<PlexTagDirectoryItem[]>((_resolve, reject) => {
                        options.signal?.addEventListener('abort', () => {
                            reject(new DOMException('Aborted', 'AbortError'));
                        }, { once: true });
                    });
                }
            ),
            getDirectors: jest.fn().mockResolvedValue([]),
            getYears: jest.fn().mockResolvedValue([]),
            getActors: jest.fn().mockResolvedValue([]),
            getStudios: jest.fn().mockResolvedValue([]),
        } as unknown as jest.Mocked<IPlexLibrary>;
        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;
        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const config = service.normalizeConfig(createConfig({
            selectedLibraryIds: ['fast', 'slow'],
            strategyConfig: {
                genres: { enabled: true, priority: 1, scope: 'per-library' },
            },
        }));

        const resultPromise = service.buildSetupPlan(config, libraries, null);
        const result = await Promise.race([
            resultPromise,
            new Promise<'pending'>((resolve) => {
                setTimeout(() => resolve('pending'), 0);
            }),
        ]);

        expect(result).not.toBe('pending');
        expect(result).toEqual(expect.objectContaining({
            plan: null,
            canceled: false,
            blockedMessage: expect.stringContaining('stop and re-plan'),
            failureReason: 'unsupported',
        }));
        expect(slowSignal).toBeDefined();
        expect(slowSignal?.aborted).toBe(true);
    });

    it('fails fast when one facet fails immediately but another facet in the same library is still hanging', async () => {
        const libraries = [
            makeLibrary({ id: 'mixed', title: 'Mixed Library', type: 'show', contentCount: 1200 }),
            makeLibrary({ id: 'slow', title: 'Slow Library', type: 'show', contentCount: 1200 }),
        ];
        let mixedActorsSignal: AbortSignal | undefined;
        let slowGenresSignal: AbortSignal | undefined;
        const plexLibrary = {
            getPlaylists: jest.fn().mockResolvedValue([]),
            getCollections: jest.fn().mockResolvedValue([]),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockImplementation(
                async (
                    libraryId: string,
                    options: {
                        signal?: AbortSignal | null;
                        onUnsupported?: (reason: PlexTagDirectoryUnsupportedReason) => void;
                    }
                ) => {
                    if (libraryId === 'mixed') {
                        options.onUnsupported?.('unavailable');
                        return [];
                    }
                    slowGenresSignal = options.signal ?? undefined;
                    return new Promise<PlexTagDirectoryItem[]>((_resolve, reject) => {
                        options.signal?.addEventListener('abort', () => {
                            reject(new DOMException('Aborted', 'AbortError'));
                        }, { once: true });
                    });
                }
            ),
            getDirectors: jest.fn().mockResolvedValue([]),
            getYears: jest.fn().mockResolvedValue([]),
            getActors: jest.fn().mockImplementation(
                async (
                    libraryId: string,
                    options: {
                        signal?: AbortSignal | null;
                    }
                ) => {
                    if (libraryId === 'mixed') {
                        mixedActorsSignal = options.signal ?? undefined;
                        return new Promise<PlexTagDirectoryItem[]>((_resolve, reject) => {
                            options.signal?.addEventListener('abort', () => {
                                reject(new DOMException('Aborted', 'AbortError'));
                            }, { once: true });
                        });
                    }
                    return [];
                }
            ),
            getStudios: jest.fn().mockResolvedValue([]),
        } as unknown as jest.Mocked<IPlexLibrary>;
        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;
        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const config = service.normalizeConfig(createConfig({
            selectedLibraryIds: ['mixed', 'slow'],
            strategyConfig: {
                genres: { enabled: true, priority: 1, scope: 'per-library' },
                actors: { enabled: true, priority: 2, scope: 'per-library' },
            },
        }));

        const resultPromise = service.buildSetupPlan(config, libraries, null);
        const result = await Promise.race([
            resultPromise,
            new Promise<'pending'>((resolve) => {
                setTimeout(() => resolve('pending'), 0);
            }),
        ]);

        expect(result).not.toBe('pending');
        expect(result).toEqual(expect.objectContaining({
            plan: null,
            canceled: false,
            blockedMessage: expect.stringContaining('stop and re-plan'),
            failureReason: 'unsupported',
        }));
        expect(mixedActorsSignal).toBeDefined();
        expect(mixedActorsSignal?.aborted).toBe(true);
        expect(slowGenresSignal).toBeDefined();
        expect(slowGenresSignal?.aborted).toBe(true);
    });

    it('returns the first observed library failure instead of worker index order under concurrent failure races', async () => {
        const libraries = [
            makeLibrary({ id: 'worker-0', title: 'Worker Zero', type: 'show', contentCount: 1200 }),
            makeLibrary({ id: 'worker-1', title: 'Worker One', type: 'show', contentCount: 1200 }),
        ];
        const workerZeroGenre = createDeferred<PlexTagDirectoryItem[]>();
        const plexLibrary = {
            getPlaylists: jest.fn().mockResolvedValue([]),
            getCollections: jest.fn().mockResolvedValue([]),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockImplementation(
                async (
                    libraryId: string,
                    options: {
                        onUnsupported?: (reason: PlexTagDirectoryUnsupportedReason) => void;
                    }
                ) => {
                    if (libraryId === 'worker-1') {
                        throw {
                            name: 'Error',
                            code: 'NETWORK_TIMEOUT',
                            message: 'worker one timed out first',
                        };
                    }
                    const genres = await workerZeroGenre.promise;
                    options.onUnsupported?.('unavailable');
                    return genres;
                }
            ),
            getDirectors: jest.fn().mockResolvedValue([]),
            getYears: jest.fn().mockResolvedValue([]),
            getActors: jest.fn().mockResolvedValue([]),
            getStudios: jest.fn().mockResolvedValue([]),
        } as unknown as jest.Mocked<IPlexLibrary>;
        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;
        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const config = service.normalizeConfig(createConfig({
            selectedLibraryIds: ['worker-0', 'worker-1'],
            strategyConfig: {
                genres: { enabled: true, priority: 1, scope: 'per-library' },
            },
        }));

        const resultPromise = service.buildSetupPlan(config, libraries, null);
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
        });
        workerZeroGenre.resolve([]);
        const result = await resultPromise;

        expect(result.plan).toBeNull();
        expect(result.failureReason).toBe('timeout');
        expect(result.previewStatus).toBe('slow');
        expect(result.blockedMessage).toContain('Worker One');
        expect(result.blockedMessage).toContain('timed out');
    });
});
