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

describe('ChannelSetupFacetLibraryExecutor', () => {
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
