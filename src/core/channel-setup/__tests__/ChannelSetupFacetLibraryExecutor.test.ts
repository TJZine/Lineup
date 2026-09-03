/**
 * @jest-environment jsdom
 */

import type { ChannelBuildProgress, ChannelSetupConfig } from '../types';
import { ChannelSetupFacetLibraryExecutor } from '../planning/ChannelSetupFacetLibraryExecutor';
import {
    ChannelSetupFacetSnapshotFailureBuilder,
    ChannelSetupFacetSnapshotLoadState,
} from '../planning/ChannelSetupFacetSnapshotFailures';
import {
    createFacetPlanningConfig,
    createFacetPlanningLibrary,
    createMockPlexLibrary,
    type FacetPlanningConfigOverrides,
} from './ChannelSetupFacetPlanningTestHelpers';
import { PlexLibraryScopeSupersededError, type PlexMediaItem } from '../../../modules/plex/library';
import { createDeferred } from '../../../__tests__/helpers';

const createConfig = (overrides: FacetPlanningConfigOverrides = {}): ChannelSetupConfig => createFacetPlanningConfig({
    selectedLibraryIds: ['lib-1'],
    maxChannels: 10,
    minItemsPerChannel: 1,
    ...overrides,
});

const createEnabledGenreConfig = (): ChannelSetupConfig => createConfig({
    strategyConfig: {
        ...createConfig().strategyConfig,
        genres: { enabled: true, priority: 3, scope: 'per-library' },
    },
});

const createFailureBuilder = (
    loadState: ChannelSetupFacetSnapshotLoadState,
    getLastTask: () => ChannelBuildProgress['task'] | undefined
): ChannelSetupFacetSnapshotFailureBuilder => new ChannelSetupFacetSnapshotFailureBuilder({
    addWarning: (message) => loadState.addWarning(message),
    incrementErrors: () => loadState.incrementErrors(),
    snapshotData: (hasTransientLoadFailure) => loadState.snapshotData(hasTransientLoadFailure, getLastTask()),
});

const createMovie = (
    ratingKey: string,
    people: { actors?: string[]; directors?: string[] } = {}
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
    ...people,
});

describe('ChannelSetupFacetLibraryExecutor', () => {
    const createExecutor = (
        plexLibrary: ReturnType<typeof createMockPlexLibrary>,
        config: ChannelSetupConfig,
        loadState = new ChannelSetupFacetSnapshotLoadState()
    ): ChannelSetupFacetLibraryExecutor => {
        const getLastTask = (): ChannelBuildProgress['task'] => 'scan_library_items';
        return new ChannelSetupFacetLibraryExecutor({
            plexLibrary,
            config,
            requestIntent: 'preview',
            requestSignal: new AbortController().signal,
            selectedLibraryCount: 1,
            loadState,
            failureBuilder: createFailureBuilder(loadState, getLastTask),
            getLastTask,
            callerCanceled: (): boolean => false,
            failureStopRequested: (): boolean => false,
            requestAbortRequiresThrow: (): boolean => false,
            reportSnapshotProgress: jest.fn(),
            addPartialWarning: (task, detail, error): void => loadState.addPartialWarning(task, detail, error),
            abortSiblingRequests: jest.fn(),
            checkpoint: async (): Promise<void> => undefined,
        });
    };

    it('rethrows collection supersession before empty fallback state mutation', async () => {
        const stale = new PlexLibraryScopeSupersededError();
        const plexLibrary = createMockPlexLibrary();
        plexLibrary.getCollections.mockRejectedValue(stale);
        const loadState = new ChannelSetupFacetSnapshotLoadState();
        const config = createConfig({
            strategyConfig: {
                ...createConfig().strategyConfig,
                collections: { enabled: true, priority: 1, scope: 'per-library' },
            },
        });

        await expect(createExecutor(plexLibrary, config, loadState)
            .loadLibraryFacets(createFacetPlanningLibrary(), 0)).rejects.toBe(stale);
        expect(loadState.collectionsByLibraryId.has('lib-1')).toBe(false);
    });

    it('rethrows required tag supersession before blocking-failure conversion', async () => {
        const stale = new PlexLibraryScopeSupersededError();
        const plexLibrary = createMockPlexLibrary();
        plexLibrary.getGenres.mockRejectedValue(stale);

        await expect(createExecutor(plexLibrary, createEnabledGenreConfig())
            .loadLibraryFacets(createFacetPlanningLibrary(), 0)).rejects.toBe(stale);
    });

    it('rethrows tag-count supersession before blocking-failure conversion', async () => {
        const stale = new PlexLibraryScopeSupersededError();
        const plexLibrary = createMockPlexLibrary();
        plexLibrary.getGenres.mockResolvedValue([{ key: 'genre-1', title: 'Comedy', count: null }]);
        plexLibrary.getLibraryItemCount.mockRejectedValue(stale);

        await expect(createExecutor(plexLibrary, createEnabledGenreConfig())
            .loadLibraryFacets(createFacetPlanningLibrary(), 0)).rejects.toBe(stale);
    });

    it('aborts and drains sibling count recovery before rethrowing supersession', async () => {
        const stale = new PlexLibraryScopeSupersededError();
        const plexLibrary = createMockPlexLibrary();
        const requestsStarted = createDeferred<void>();
        const supersededRequest = createDeferred<number | null>();
        const siblingSettled = createDeferred<void>();
        const signals: AbortSignal[] = [];
        plexLibrary.getGenres.mockResolvedValue([{ key: 'genre-1', title: 'Comedy', count: null }]);
        plexLibrary.getStudios.mockResolvedValue([{ key: 'studio-1', title: 'Studio', count: null }]);
        plexLibrary.getLibraryItemCount.mockImplementation((_libraryId, options) => {
            const signal = options?.signal;
            if (!signal) throw new Error('Expected count recovery signal');
            signals.push(signal);
            if (signals.length === 2) requestsStarted.resolve();
            if (signals.length === 1) return supersededRequest.promise;
            return new Promise<number | null>((_resolve, reject) => {
                signal.addEventListener('abort', () => {
                    siblingSettled.resolve();
                    reject(signal.reason);
                }, { once: true });
            });
        });
        const baseConfig = createEnabledGenreConfig();
        const config = createConfig({
            strategyConfig: {
                ...baseConfig.strategyConfig,
                genres: { enabled: true, priority: 3, scope: 'per-library' },
                studios: { enabled: true, priority: 7, scope: 'per-library' },
            },
        });

        const load = createExecutor(plexLibrary, config)
            .loadLibraryFacets(createFacetPlanningLibrary(), 0);
        await requestsStarted.promise;
        supersededRequest.reject(stale);

        await expect(load).rejects.toBe(stale);
        await siblingSettled.promise;
        expect(signals[1]?.aborted).toBe(true);
    });

    it('rethrows people-index supersession before partial-warning behavior', async () => {
        const stale = new PlexLibraryScopeSupersededError();
        const plexLibrary = createMockPlexLibrary();
        plexLibrary.getActors.mockResolvedValue([
            { key: 'actor-1', title: 'Alex Actor', count: 3 },
        ]);
        plexLibrary.getLibraryItems.mockRejectedValue(stale);
        const loadState = new ChannelSetupFacetSnapshotLoadState();
        const config = createConfig({
            strategyConfig: {
                ...createConfig().strategyConfig,
                actors: { enabled: true, priority: 8, scope: 'per-library' },
            },
        });

        await expect(createExecutor(plexLibrary, config, loadState).loadLibraryFacets(
            createFacetPlanningLibrary({ type: 'show', title: 'Shows', contentCount: 3 }),
            0
        )).rejects.toBe(stale);
        expect(loadState.peopleSeriesIndexByLibraryId.has('lib-1')).toBe(false);
        expect(plexLibrary.getLibraryItems).toHaveBeenCalledWith(
            'lib-1',
            expect.objectContaining({ filter: { type: 4 } })
        );
    });

    it('skips TV actor and director count recovery while preserving the people-series index', async () => {
        const loadState = new ChannelSetupFacetSnapshotLoadState();
        const plexLibrary = createMockPlexLibrary();
        const episode: PlexMediaItem = {
            ratingKey: 'episode-1',
            key: '/library/metadata/episode-1',
            type: 'episode',
            title: 'Episode 1',
            sortTitle: 'Episode 1',
            summary: '',
            year: 2024,
            durationMs: 1000,
            addedAt: new Date(0),
            updatedAt: new Date(0),
            thumb: null,
            art: null,
            grandparentRatingKey: 'series-1',
            actors: ['Alex Actor'],
            directors: ['Dana Director'],
            media: [],
        };
        plexLibrary.getActors.mockResolvedValue([
            { key: 'actor-1', title: 'Alex Actor', count: null },
        ]);
        plexLibrary.getDirectors.mockResolvedValue([
            { key: 'director-1', title: 'Dana Director', count: null },
        ]);
        plexLibrary.getLibraryItems.mockResolvedValue([episode]);
        const baseConfig = createConfig();
        const config = createConfig({
            strategyConfig: {
                ...baseConfig.strategyConfig,
                actors: { enabled: true, priority: 8, scope: 'per-library' },
                directors: { enabled: true, priority: 4, scope: 'per-library' },
            },
        });

        await expect(createExecutor(plexLibrary, config, loadState).loadLibraryFacets(
            createFacetPlanningLibrary({ type: 'show', title: 'Shows', contentCount: 1 }),
            0
        )).resolves.toBeNull();

        expect(plexLibrary.getLibraryItemCount).not.toHaveBeenCalled();
        expect(loadState.actorsByLibraryId.get('lib-1')).toEqual([
            { key: 'actor-1', title: 'Alex Actor', count: null },
        ]);
        expect(loadState.directorsByLibraryId.get('lib-1')).toEqual([
            { key: 'director-1', title: 'Dana Director', count: null },
        ]);
        expect(loadState.peopleSeriesIndexByLibraryId.get('lib-1')?.actorsByName.get('alex actor'))
            .toEqual({ title: 'Alex Actor', episodeCount: 1, distinctSeriesCount: 1 });
        expect(loadState.peopleSeriesIndexByLibraryId.get('lib-1')?.directorsByName.get('dana director'))
            .toEqual({ title: 'Dana Director', episodeCount: 1, distinctSeriesCount: 1 });
        expect(plexLibrary.getLibraryItems).toHaveBeenCalledWith('lib-1', expect.objectContaining({
            filter: { type: 4 },
        }));
    });

    it('uses one shared movie scan and no per-person count recovery for unknown actors and directors', async () => {
        const loadState = new ChannelSetupFacetSnapshotLoadState();
        const plexLibrary = createMockPlexLibrary();
        plexLibrary.getActors.mockResolvedValue([
            { key: 'actor-1', title: 'Alex Actor', count: null },
        ]);
        plexLibrary.getDirectors.mockResolvedValue([
            { key: 'director-1', title: 'Dana Director', count: null },
        ]);
        plexLibrary.getLibraryItems.mockResolvedValue([
            createMovie('movie-1', { actors: ['Alex Actor'], directors: ['Dana Director'] }),
            createMovie('movie-2', { actors: ['Alex Actor'] }),
        ]);
        const baseConfig = createConfig();
        const config = createConfig({
            strategyConfig: {
                ...baseConfig.strategyConfig,
                actors: { enabled: true, priority: 8, scope: 'per-library' },
                directors: { enabled: true, priority: 4, scope: 'per-library' },
            },
        });

        await expect(createExecutor(plexLibrary, config, loadState)
            .loadLibraryFacets(createFacetPlanningLibrary(), 0)).resolves.toBeNull();

        expect(loadState.actorsByLibraryId.get('lib-1')).toEqual([
            { key: 'actor-1', title: 'Alex Actor', count: null },
        ]);
        expect(loadState.directorsByLibraryId.get('lib-1')).toEqual([
            { key: 'director-1', title: 'Dana Director', count: null },
        ]);
        expect(plexLibrary.getLibraryItemCount).not.toHaveBeenCalled();
        expect(plexLibrary.getLibraryItems).toHaveBeenCalledTimes(1);
        expect(plexLibrary.getLibraryItems).toHaveBeenCalledWith('lib-1', expect.objectContaining({
            filter: { type: 1 },
        }));
        expect(loadState.peopleSeriesIndexByLibraryId.get('lib-1')?.actorsByName.get('alex actor'))
            .toEqual({ title: 'Alex Actor', episodeCount: 2, distinctSeriesCount: 0 });
        expect(loadState.peopleSeriesIndexByLibraryId.get('lib-1')?.directorsByName.get('dana director'))
            .toEqual({ title: 'Dana Director', episodeCount: 1, distinctSeriesCount: 0 });
    });

    it('avoids a movie scan when all enabled people tag counts are known', async () => {
        const plexLibrary = createMockPlexLibrary();
        plexLibrary.getActors.mockResolvedValue([
            { key: 'actor-1', title: 'Alex Actor', count: 8 },
        ]);
        plexLibrary.getDirectors.mockResolvedValue([
            { key: 'director-1', title: 'Dana Director', count: 6 },
        ]);
        const baseConfig = createConfig();
        const config = createConfig({
            strategyConfig: {
                ...baseConfig.strategyConfig,
                actors: { enabled: true, priority: 8, scope: 'per-library' },
                directors: { enabled: true, priority: 4, scope: 'per-library' },
            },
        });

        await expect(createExecutor(plexLibrary, config)
            .loadLibraryFacets(createFacetPlanningLibrary(), 0)).resolves.toBeNull();

        expect(plexLibrary.getLibraryItems).not.toHaveBeenCalled();
        expect(plexLibrary.getLibraryItemCount).not.toHaveBeenCalled();
    });

    it('hydrates unknown native facet counts through count recovery without changing loaded tags', async () => {
        const loadState = new ChannelSetupFacetSnapshotLoadState();
        const getLastTask = (): ChannelBuildProgress['task'] => 'scan_library_items';
        const plexLibrary = createMockPlexLibrary();
        plexLibrary.getGenres.mockResolvedValue([
            { key: 'genre-1', title: 'Comedy', count: null },
            { key: 'genre-2', title: 'Drama', count: 7 },
        ]);
        plexLibrary.getLibraryItemCount.mockResolvedValue(11);
        const reportSnapshotProgress = jest.fn();
        const executor = new ChannelSetupFacetLibraryExecutor({
            plexLibrary,
            config: createEnabledGenreConfig(),
            requestIntent: 'preview',
            requestSignal: new AbortController().signal,
            selectedLibraryCount: 1,
            loadState,
            failureBuilder: createFailureBuilder(loadState, getLastTask),
            getLastTask,
            callerCanceled: (): boolean => false,
            failureStopRequested: (): boolean => false,
            requestAbortRequiresThrow: (): boolean => false,
            reportSnapshotProgress,
            addPartialWarning: (task, detail, error): void => loadState.addPartialWarning(task, detail, error),
            abortSiblingRequests: jest.fn(),
            checkpoint: async (): Promise<void> => undefined,
        });

        await expect(executor.loadLibraryFacets(createFacetPlanningLibrary(), 0)).resolves.toBeNull();

        expect(loadState.genresByLibraryId.get('lib-1')).toEqual([
            { key: 'genre-1', title: 'Comedy', count: 11 },
            { key: 'genre-2', title: 'Drama', count: 7 },
        ]);
        expect(plexLibrary.getLibraryItemCount).toHaveBeenCalledWith('lib-1', expect.objectContaining({
            filter: { type: 1, genre: 'Comedy' },
            signal: expect.any(Object),
        }));
        expect(reportSnapshotProgress).toHaveBeenCalledWith(expect.objectContaining({
            task: 'scan_library_items',
            detail: 'Movies',
        }));
    });

    it('requires facet-directory entries when the library item count is unknown', async () => {
        const plexLibrary = createMockPlexLibrary();
        plexLibrary.getGenres.mockResolvedValue([
            { key: 'genre-1', title: 'Comedy', count: 3 },
        ]);
        const executor = createExecutor(plexLibrary, createEnabledGenreConfig());

        await expect(executor.loadLibraryFacets(createFacetPlanningLibrary({ contentCount: null }), 0))
            .resolves.toBeNull();

        expect(plexLibrary.getGenres).toHaveBeenCalledWith('lib-1', expect.objectContaining({
            requireEntries: true,
        }));
    });

    it('returns the first blocking snapshot when count recovery fails', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const loadState = new ChannelSetupFacetSnapshotLoadState();
        const getLastTask = (): ChannelBuildProgress['task'] => 'scan_library_items';
        const abortSiblingRequests = jest.fn();
        const plexLibrary = createMockPlexLibrary();
        plexLibrary.getGenres.mockResolvedValue([
            { key: 'genre-1', title: 'Comedy', count: null },
        ]);
        plexLibrary.getLibraryItemCount.mockRejectedValue(new Error('count service failed'));
        const executor = new ChannelSetupFacetLibraryExecutor({
            plexLibrary,
            config: createEnabledGenreConfig(),
            requestIntent: 'preview',
            requestSignal: new AbortController().signal,
            selectedLibraryCount: 1,
            loadState,
            failureBuilder: createFailureBuilder(loadState, getLastTask),
            getLastTask,
            callerCanceled: (): boolean => false,
            failureStopRequested: (): boolean => false,
            requestAbortRequiresThrow: (): boolean => false,
            reportSnapshotProgress: jest.fn(),
            addPartialWarning: (task, detail, error): void => loadState.addPartialWarning(task, detail, error),
            abortSiblingRequests,
            checkpoint: async (): Promise<void> => undefined,
        });

        try {
            const snapshot = await executor.loadLibraryFacets(createFacetPlanningLibrary(), 0);

            expect(snapshot).toMatchObject({
                status: 'blocked',
                failureReason: 'error',
                message: expect.stringContaining('Required genres item counts (type=1) failed for Movies'),
                errorsTotal: 1,
            });
            expect(snapshot?.warnings).toEqual([
                expect.stringContaining('Required genres item counts (type=1) failed for Movies'),
            ]);
            expect(abortSiblingRequests).toHaveBeenCalledTimes(1);
        } finally {
            warnSpy.mockRestore();
        }
    });
});
