/**
 * @jest-environment jsdom
 */

import {
    assertRecoveredTagCount,
    ChannelSetupFacetSnapshotLoader,
    type ChannelSetupFacetSnapshotWaitOptions,
    ChannelSetupPlanningError,
} from '../planning/ChannelSetupFacetSnapshotLoader';
import { flushPromises, flushPromisesAndMacrotask } from '../../../__tests__/helpers';
import type { PlexTagDirectoryItem } from '../../../modules/plex/library';
import {
    createDeferred,
    createFacetPlanningConfig,
    createFacetPlanningLibrary,
    createFacetPlanningTag,
    createMockPlexLibrary,
    type FacetPlanningConfigOverrides,
} from './ChannelSetupFacetPlanningTestHelpers';

const createConfig = (overrides: FacetPlanningConfigOverrides = {}) => createFacetPlanningConfig({
    selectedLibraryIds: ['lib-1'],
    maxChannels: 10,
    minItemsPerChannel: 1,
    ...overrides,
    strategyConfig: {
        genres: { enabled: true, priority: 3, scope: 'per-library' },
        ...overrides.strategyConfig,
    },
});

const createLibrary = createFacetPlanningLibrary;

const createPlexLibrary = (overrides = {}) => createMockPlexLibrary({
    getCollections: jest.fn().mockResolvedValue([]),
    getPlaylists: jest.fn().mockResolvedValue([]),
    getActors: jest.fn().mockResolvedValue([]),
    getStudios: jest.fn().mockResolvedValue([]),
    getGenres: jest.fn().mockResolvedValue([]),
    getDirectors: jest.fn().mockResolvedValue([]),
    getYears: jest.fn().mockResolvedValue([]),
    ...overrides,
});

const createWaitOptions = (
    overrides: Partial<ChannelSetupFacetSnapshotWaitOptions> = {}
): ChannelSetupFacetSnapshotWaitOptions => ({
    signal: null,
    requestIntent: 'preview',
    detachFromSignal: false,
    ...overrides,
});

describe('ChannelSetupFacetSnapshotLoader', () => {
    it('throws a typed planning error when a recovered tag count is unavailable', () => {
        expect(() => assertRecoveredTagCount(null, 'actor', 'Alex Star')).toThrow(ChannelSetupPlanningError);
        expect(() => assertRecoveredTagCount(null, 'actor', 'Alex Star')).toThrow(
            expect.objectContaining({
                name: 'ChannelSetupPlanningError',
                code: 'COUNT_UNAVAILABLE',
            })
        );
    });

    it('returns the recovered count when available', () => {
        expect(assertRecoveredTagCount(7, 'actor', 'Alex Star')).toBe(7);
    });

    it('accounts for native facet query time even when tag fetches fail', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        let currentNow = 1_000;
        const performanceNowSpy = jest.spyOn(performance, 'now').mockImplementation(() => {
            currentNow += 5;
            return currentNow;
        });
        const loader = new ChannelSetupFacetSnapshotLoader({
            plexLibrary: createPlexLibrary({
                getGenres: jest.fn().mockImplementation(async () => {
                    await Promise.resolve();
                    throw new Error('genre fetch failed');
                }),
            }),
        });
        try {
            const snapshot = await loader.loadSnapshot(
                createConfig(),
                [createLibrary()],
                'preview',
                {
                    signal: null,
                    requestIntent: 'preview',
                    detachFromSignal: false,
                }
            );

            expect(snapshot.status).toBe('blocked');
            expect(snapshot.libraryQueryMs).toBeGreaterThan(0);
        } finally {
            warnSpy.mockRestore();
            performanceNowSpy.mockRestore();
        }
    });

    it('returns cached same-key snapshots after rejecting already-aborted callers without refetching or replaying progress', async () => {
        const getGenres = jest.fn().mockResolvedValue([
            createFacetPlanningTag({ title: 'Comedy', count: 4 }),
        ]);
        const loader = new ChannelSetupFacetSnapshotLoader({
            plexLibrary: createPlexLibrary({ getGenres }),
        });
        const firstProgress = jest.fn();

        const first = await loader.loadSnapshot(
            createConfig(),
            [createLibrary()],
            'preview',
            createWaitOptions({ reportProgress: firstProgress })
        );
        expect(first.status).toBe('ready');
        expect(getGenres).toHaveBeenCalledTimes(1);
        expect(firstProgress).toHaveBeenCalledWith(expect.objectContaining({
            task: 'scan_library_items',
            detail: 'Movies',
        }));

        const abortController = new AbortController();
        abortController.abort();
        await expect(
            loader.loadSnapshot(
                createConfig(),
                [createLibrary()],
                'preview',
                createWaitOptions({ signal: abortController.signal })
            )
        ).rejects.toMatchObject({ name: 'AbortError' });

        const cachedProgress = jest.fn();
        const second = await loader.loadSnapshot(
            createConfig(),
            [createLibrary()],
            'preview',
            createWaitOptions({ reportProgress: cachedProgress })
        );

        expect(second).toBe(first);
        expect(getGenres).toHaveBeenCalledTimes(1);
        expect(cachedProgress).not.toHaveBeenCalled();
    });

    it('caches unsupported and empty blocked snapshots but not timeout or error blocked snapshots', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            const unsupportedGenres = jest.fn().mockImplementation(async (_libraryId, options) => {
                options.onUnsupported?.('unavailable');
                return [];
            });
            const unsupportedLoader = new ChannelSetupFacetSnapshotLoader({
                plexLibrary: createPlexLibrary({ getGenres: unsupportedGenres }),
            });
            await expect(unsupportedLoader.loadSnapshot(
                createConfig(),
                [createLibrary()],
                'preview',
                createWaitOptions()
            )).resolves.toMatchObject({ status: 'blocked', failureReason: 'unsupported' });
            await expect(unsupportedLoader.loadSnapshot(
                createConfig(),
                [createLibrary()],
                'preview',
                createWaitOptions()
            )).resolves.toMatchObject({ status: 'blocked', failureReason: 'unsupported' });
            expect(unsupportedGenres).toHaveBeenCalledTimes(1);

            const emptyGenres = jest.fn().mockImplementation(async (_libraryId, options) => {
                options.onUnsupported?.('empty');
                return [];
            });
            const emptyLoader = new ChannelSetupFacetSnapshotLoader({
                plexLibrary: createPlexLibrary({ getGenres: emptyGenres }),
            });
            await expect(emptyLoader.loadSnapshot(
                createConfig(),
                [createLibrary()],
                'preview',
                createWaitOptions()
            )).resolves.toMatchObject({ status: 'blocked', failureReason: 'empty' });
            await expect(emptyLoader.loadSnapshot(
                createConfig(),
                [createLibrary()],
                'preview',
                createWaitOptions()
            )).resolves.toMatchObject({ status: 'blocked', failureReason: 'empty' });
            expect(emptyGenres).toHaveBeenCalledTimes(1);

            const timeoutGenres = jest.fn()
                .mockRejectedValueOnce({ name: 'Error', code: 'NETWORK_TIMEOUT', message: 'timed out' })
                .mockResolvedValueOnce([createFacetPlanningTag({ title: 'Comedy', count: 4 })]);
            const timeoutLoader = new ChannelSetupFacetSnapshotLoader({
                plexLibrary: createPlexLibrary({ getGenres: timeoutGenres }),
            });
            await expect(timeoutLoader.loadSnapshot(
                createConfig(),
                [createLibrary()],
                'preview',
                createWaitOptions()
            )).resolves.toMatchObject({ status: 'slow', failureReason: 'timeout' });
            await expect(timeoutLoader.loadSnapshot(
                createConfig(),
                [createLibrary()],
                'preview',
                createWaitOptions()
            )).resolves.toMatchObject({ status: 'ready' });
            expect(timeoutGenres).toHaveBeenCalledTimes(2);

            const errorGenres = jest.fn()
                .mockRejectedValueOnce(new Error('genre failed'))
                .mockResolvedValueOnce([createFacetPlanningTag({ title: 'Comedy', count: 4 })]);
            const errorLoader = new ChannelSetupFacetSnapshotLoader({
                plexLibrary: createPlexLibrary({ getGenres: errorGenres }),
            });
            await expect(errorLoader.loadSnapshot(
                createConfig(),
                [createLibrary()],
                'preview',
                createWaitOptions()
            )).resolves.toMatchObject({ status: 'blocked', failureReason: 'error' });
            await expect(errorLoader.loadSnapshot(
                createConfig(),
                [createLibrary()],
                'preview',
                createWaitOptions()
            )).resolves.toMatchObject({ status: 'ready' });
            expect(errorGenres).toHaveBeenCalledTimes(2);
        } finally {
            warnSpy.mockRestore();
        }
    });

    it('does not cache ready snapshots with transient enrichment failures', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const getPlaylists = jest.fn()
            .mockRejectedValueOnce({ name: 'Error', code: 'NETWORK_TIMEOUT', message: 'playlist timed out' })
            .mockResolvedValueOnce([
                {
                    ratingKey: 'pl-1',
                    key: '/playlists/pl-1',
                    title: 'Favorites',
                    thumb: null,
                    duration: 0,
                    leafCount: 10,
                },
            ]);
        const loader = new ChannelSetupFacetSnapshotLoader({
            plexLibrary: createPlexLibrary({ getPlaylists }),
        });
        const config = createConfig({
            selectedLibraryIds: [],
            strategyConfig: {
                genres: { enabled: false, priority: 3, scope: 'per-library' },
                playlists: { enabled: true, priority: 2, scope: 'per-library' },
            },
        });
        try {
            await expect(loader.loadSnapshot(
                config,
                [],
                'preview',
                createWaitOptions()
            )).resolves.toMatchObject({
                status: 'ready',
                hasTransientLoadFailure: true,
                playlists: [],
            });
            await expect(loader.loadSnapshot(
                config,
                [],
                'preview',
                createWaitOptions()
            )).resolves.toMatchObject({
                status: 'ready',
                hasTransientLoadFailure: false,
                playlists: [expect.objectContaining({ title: 'Favorites' })],
            });
            expect(getPlaylists).toHaveBeenCalledTimes(2);
        } finally {
            warnSpy.mockRestore();
        }
    });

    it('shares same-key in-flight loads, replays the last progress to late waiters, and delivers later progress to all active waiters', async () => {
        const libraries = [
            createLibrary({ id: 'lib-a', title: 'A Movies' }),
            createLibrary({ id: 'lib-b', title: 'B Movies' }),
            createLibrary({ id: 'lib-c', title: 'C Movies' }),
        ];
        const deferredByLibraryId = new Map(
            libraries.map((library) => [library.id, createDeferred<PlexTagDirectoryItem[]>()])
        );
        const getGenres = jest.fn().mockImplementation((libraryId: string) => {
            const deferred = deferredByLibraryId.get(libraryId);
            if (!deferred) {
                throw new Error(`Missing deferred for ${libraryId}`);
            }
            return deferred.promise;
        });
        const loader = new ChannelSetupFacetSnapshotLoader({
            plexLibrary: createPlexLibrary({
                getGenres,
            }),
        });
        const config = createConfig({
            selectedLibraryIds: libraries.map((library) => library.id),
        });
        const firstProgress = jest.fn();
        const firstLoad = loader.loadSnapshot(
            config,
            libraries,
            'preview',
            createWaitOptions({ reportProgress: firstProgress })
        );
        await flushPromises();
        expect(firstProgress).toHaveBeenCalledWith(expect.objectContaining({ detail: 'B Movies' }));

        const secondProgress = jest.fn();
        const secondLoad = loader.loadSnapshot(
            config,
            libraries,
            'preview',
            createWaitOptions({ reportProgress: secondProgress })
        );
        expect(secondProgress).toHaveBeenCalledTimes(1);
        expect(secondProgress).toHaveBeenLastCalledWith(expect.objectContaining({ detail: 'B Movies' }));

        deferredByLibraryId.get('lib-a')?.resolve([createFacetPlanningTag({ title: 'Action', count: 4 })]);
        deferredByLibraryId.get('lib-b')?.resolve([createFacetPlanningTag({ title: 'Comedy', count: 5 })]);
        for (let attempt = 0; attempt < 5 && getGenres.mock.calls.length < 3; attempt++) {
            await flushPromisesAndMacrotask();
        }

        expect(firstProgress).toHaveBeenCalledWith(expect.objectContaining({ detail: 'C Movies' }));
        expect(secondProgress).toHaveBeenCalledWith(expect.objectContaining({ detail: 'C Movies' }));
        expect(getGenres).toHaveBeenCalledTimes(3);

        deferredByLibraryId.get('lib-c')?.resolve([createFacetPlanningTag({ title: 'Drama', count: 6 })]);
        await expect(firstLoad).resolves.toMatchObject({ status: 'ready' });
        await expect(secondLoad).resolves.toMatchObject({ status: 'ready' });
    });

    it('detaches an aborted waiter without aborting the shared load or delivering later progress to that waiter', async () => {
        const libraries = [
            createLibrary({ id: 'lib-a', title: 'A Movies' }),
            createLibrary({ id: 'lib-b', title: 'B Movies' }),
            createLibrary({ id: 'lib-c', title: 'C Movies' }),
        ];
        const deferredByLibraryId = new Map(
            libraries.map((library) => [library.id, createDeferred<PlexTagDirectoryItem[]>()])
        );
        const signalByLibraryId = new Map<string, AbortSignal | undefined>();
        const loader = new ChannelSetupFacetSnapshotLoader({
            plexLibrary: createPlexLibrary({
                getGenres: jest.fn().mockImplementation((libraryId: string, options) => {
                    signalByLibraryId.set(libraryId, options.signal);
                    const deferred = deferredByLibraryId.get(libraryId);
                    if (!deferred) {
                        throw new Error(`Missing deferred for ${libraryId}`);
                    }
                    return deferred.promise;
                }),
            }),
        });
        const config = createConfig({
            selectedLibraryIds: libraries.map((library) => library.id),
        });
        const firstProgress = jest.fn();
        const firstLoad = loader.loadSnapshot(
            config,
            libraries,
            'preview',
            createWaitOptions({ reportProgress: firstProgress })
        );
        await flushPromises();

        const secondProgress = jest.fn();
        const secondAbortController = new AbortController();
        const secondLoad = loader.loadSnapshot(
            config,
            libraries,
            'preview',
            createWaitOptions({
                signal: secondAbortController.signal,
                reportProgress: secondProgress,
            })
        );
        expect(secondProgress).toHaveBeenCalledTimes(1);
        secondAbortController.abort();
        await expect(secondLoad).rejects.toMatchObject({
            name: 'AbortError',
            lastTask: 'scan_library_items',
        });
        expect(signalByLibraryId.get('lib-a')?.aborted).toBe(false);
        expect(signalByLibraryId.get('lib-b')?.aborted).toBe(false);

        deferredByLibraryId.get('lib-a')?.resolve([createFacetPlanningTag({ title: 'Action', count: 4 })]);
        deferredByLibraryId.get('lib-b')?.resolve([createFacetPlanningTag({ title: 'Comedy', count: 5 })]);
        for (let attempt = 0; attempt < 5 && firstProgress.mock.calls.length < 2; attempt++) {
            await flushPromisesAndMacrotask();
        }
        expect(firstProgress).toHaveBeenCalledWith(expect.objectContaining({ detail: 'C Movies' }));
        expect(secondProgress).not.toHaveBeenCalledWith(expect.objectContaining({ detail: 'C Movies' }));

        deferredByLibraryId.get('lib-c')?.resolve([createFacetPlanningTag({ title: 'Drama', count: 6 })]);
        await expect(firstLoad).resolves.toMatchObject({ status: 'ready' });
    });

    it('invalidates cached and in-flight snapshots, aborts active snapshot work, and ignores stale progress', async () => {
        const cachedGenres = jest.fn().mockResolvedValueOnce([
            createFacetPlanningTag({ title: 'Cached', count: 4 }),
        ]).mockResolvedValueOnce([
            createFacetPlanningTag({ title: 'Refetched', count: 5 }),
        ]);
        const cacheLoader = new ChannelSetupFacetSnapshotLoader({
            plexLibrary: createPlexLibrary({ getGenres: cachedGenres }),
        });
        await expect(cacheLoader.loadSnapshot(
            createConfig(),
            [createLibrary()],
            'preview',
            createWaitOptions()
        )).resolves.toMatchObject({ status: 'ready' });
        cacheLoader.invalidate();
        await expect(cacheLoader.loadSnapshot(
            createConfig(),
            [createLibrary()],
            'preview',
            createWaitOptions()
        )).resolves.toMatchObject({ status: 'ready' });
        expect(cachedGenres).toHaveBeenCalledTimes(2);

        const libraries = [
            createLibrary({ id: 'old-a', title: 'Old A' }),
            createLibrary({ id: 'old-b', title: 'Old B' }),
            createLibrary({ id: 'old-c', title: 'Old C' }),
        ];
        const oldDeferredByLibraryId = new Map(
            libraries.map((library) => [library.id, createDeferred<PlexTagDirectoryItem[]>()])
        );
        const replacementDeferredByLibraryId = new Map(
            libraries.map((library) => [library.id, createDeferred<PlexTagDirectoryItem[]>()])
        );
        const requestCountByLibraryId = new Map<string, number>();
        const signalByLibraryId = new Map<string, AbortSignal | undefined>();
        const loader = new ChannelSetupFacetSnapshotLoader({
            plexLibrary: createPlexLibrary({
                getGenres: jest.fn().mockImplementation((libraryId: string, options) => {
                    signalByLibraryId.set(libraryId, options.signal);
                    const requestCount = requestCountByLibraryId.get(libraryId) ?? 0;
                    requestCountByLibraryId.set(libraryId, requestCount + 1);
                    const deferred = requestCount === 0
                        ? oldDeferredByLibraryId.get(libraryId)
                        : replacementDeferredByLibraryId.get(libraryId);
                    if (!deferred) {
                        throw new Error(`Missing deferred for ${libraryId}`);
                    }
                    return deferred.promise;
                }),
            }),
        });
        const config = createConfig({ selectedLibraryIds: libraries.map((library) => library.id) });
        const progress = jest.fn();
        const load = loader.loadSnapshot(
            config,
            libraries,
            'preview',
            createWaitOptions({ reportProgress: progress })
        );
        const rejected = expect(load).rejects.toMatchObject({ name: 'AbortError' });
        await flushPromises();
        expect(progress).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Old B' }));

        loader.invalidate();
        expect(signalByLibraryId.get('old-a')?.aborted).toBe(true);
        expect(signalByLibraryId.get('old-b')?.aborted).toBe(true);

        const replacementProgress = jest.fn();
        const replacementLoad = loader.loadSnapshot(
            config,
            libraries,
            'preview',
            createWaitOptions({ reportProgress: replacementProgress })
        );
        await flushPromises();
        expect(replacementProgress).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Old B' }));

        oldDeferredByLibraryId.get('old-a')?.resolve([createFacetPlanningTag({ title: 'Stale Action', count: 4 })]);
        oldDeferredByLibraryId.get('old-b')?.resolve([createFacetPlanningTag({ title: 'Stale Comedy', count: 5 })]);
        await flushPromises();
        expect(progress).not.toHaveBeenCalledWith(expect.objectContaining({ detail: 'Old C' }));
        expect(replacementProgress).not.toHaveBeenCalledWith(expect.objectContaining({ detail: 'Old C' }));

        oldDeferredByLibraryId.get('old-c')?.resolve([createFacetPlanningTag({ title: 'Stale Drama', count: 6 })]);
        await flushPromises();
        expect(replacementProgress).not.toHaveBeenCalledWith(expect.objectContaining({ detail: 'Old C' }));
        await rejected;

        replacementDeferredByLibraryId.get('old-a')?.resolve([createFacetPlanningTag({ title: 'Action', count: 4 })]);
        replacementDeferredByLibraryId.get('old-b')?.resolve([createFacetPlanningTag({ title: 'Comedy', count: 5 })]);
        for (let attempt = 0; attempt < 5 && replacementProgress.mock.calls.length < 2; attempt++) {
            await flushPromisesAndMacrotask();
        }
        expect(replacementProgress).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Old C' }));
        replacementDeferredByLibraryId.get('old-c')?.resolve([createFacetPlanningTag({ title: 'Drama', count: 6 })]);
        await expect(replacementLoad).resolves.toMatchObject({ status: 'ready' });
    });

    it('resolves all active same-key waiters from one in-flight failure result and clears the failed load before retrying', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const getGenres = jest.fn()
            .mockRejectedValueOnce(new Error('genre failed'))
            .mockResolvedValueOnce([createFacetPlanningTag({ title: 'Comedy', count: 4 })]);
        const loader = new ChannelSetupFacetSnapshotLoader({
            plexLibrary: createPlexLibrary({ getGenres }),
        });
        try {
            const first = loader.loadSnapshot(
                createConfig(),
                [createLibrary()],
                'preview',
                createWaitOptions()
            );
            const second = loader.loadSnapshot(
                createConfig(),
                [createLibrary()],
                'preview',
                createWaitOptions()
            );
            await expect(first).resolves.toMatchObject({ status: 'blocked', failureReason: 'error' });
            await expect(second).resolves.toMatchObject({ status: 'blocked', failureReason: 'error' });
            expect(getGenres).toHaveBeenCalledTimes(1);

            await expect(loader.loadSnapshot(
                createConfig(),
                [createLibrary()],
                'preview',
                createWaitOptions()
            )).resolves.toMatchObject({ status: 'ready' });
            expect(getGenres).toHaveBeenCalledTimes(2);
        } finally {
            warnSpy.mockRestore();
        }
    });

    it('rejects only the canceling caller for shared detached work and does not cache that cancellation', async () => {
        const genres = createDeferred<PlexTagDirectoryItem[]>();
        const getGenres = jest.fn()
            .mockImplementationOnce(() => genres.promise)
            .mockResolvedValueOnce([createFacetPlanningTag({ title: 'Comedy', count: 4 })]);
        const loader = new ChannelSetupFacetSnapshotLoader({
            plexLibrary: createPlexLibrary({ getGenres }),
        });
        const first = loader.loadSnapshot(
            createConfig(),
            [createLibrary()],
            'preview',
            createWaitOptions({ detachFromSignal: true })
        );
        await flushPromises();
        expect(getGenres).toHaveBeenCalledTimes(1);

        const abortController = new AbortController();
        const second = loader.loadSnapshot(
            createConfig(),
            [createLibrary()],
            'preview',
            createWaitOptions({
                signal: abortController.signal,
                detachFromSignal: true,
            })
        );
        abortController.abort();
        await expect(second).rejects.toMatchObject({
            name: 'AbortError',
            lastTask: 'scan_library_items',
        });

        genres.resolve([createFacetPlanningTag({ title: 'Drama', count: 5 })]);
        await expect(first).resolves.toMatchObject({ status: 'ready' });
        await expect(loader.loadSnapshot(
            createConfig(),
            [createLibrary()],
            'preview',
            createWaitOptions()
        )).resolves.toMatchObject({ status: 'ready' });
        expect(getGenres).toHaveBeenCalledTimes(1);

        const attachedGenres = jest.fn()
            .mockImplementationOnce((_libraryId: string, options: { signal?: AbortSignal | null }) =>
                new Promise<PlexTagDirectoryItem[]>((_resolve, reject) => {
                    options.signal?.addEventListener('abort', () => {
                        reject(new DOMException('Aborted', 'AbortError'));
                    }, { once: true });
                })
            )
            .mockResolvedValueOnce([createFacetPlanningTag({ title: 'Comedy', count: 4 })]);
        const attachedLoader = new ChannelSetupFacetSnapshotLoader({
            plexLibrary: createPlexLibrary({ getGenres: attachedGenres }),
        });
        const attachedAbortController = new AbortController();
        const attachedCancellation = attachedLoader.loadSnapshot(
            createConfig({ selectedLibraryIds: ['lib-2'] }),
            [createLibrary({ id: 'lib-2' })],
            'preview',
            createWaitOptions({ signal: attachedAbortController.signal })
        );
        await flushPromises();
        const attachedSecondWaiter = attachedLoader.loadSnapshot(
            createConfig({ selectedLibraryIds: ['lib-2'] }),
            [createLibrary({ id: 'lib-2' })],
            'preview',
            createWaitOptions()
        );
        attachedAbortController.abort();
        await expect(attachedCancellation).rejects.toMatchObject({ name: 'AbortError' });
        await expect(attachedSecondWaiter).rejects.toMatchObject({ name: 'AbortError' });
        await flushPromisesAndMacrotask();
        await expect(attachedLoader.loadSnapshot(
            createConfig({ selectedLibraryIds: ['lib-2'] }),
            [createLibrary({ id: 'lib-2' })],
            'preview',
            createWaitOptions()
        )).resolves.toMatchObject({ status: 'ready' });
        expect(attachedGenres).toHaveBeenCalledTimes(2);
    });

    it('waits for sibling native facet tasks to settle before propagating cancellation', async () => {
        let secondSettled = false;
        let resolveGenresStarted: (() => void) | null = null;
        let resolveDirectorsStarted: (() => void) | null = null;
        const genresStarted = new Promise<void>((resolve) => {
            resolveGenresStarted = resolve;
        });
        const directorsStarted = new Promise<void>((resolve) => {
            resolveDirectorsStarted = resolve;
        });
        const loader = new ChannelSetupFacetSnapshotLoader({
            plexLibrary: createPlexLibrary({
                getGenres: jest.fn().mockImplementation((_libraryId, options) => {
                    resolveGenresStarted?.();
                    return new Promise<PlexTagDirectoryItem[]>((_, reject) => {
                        options.signal?.addEventListener('abort', () => {
                            reject(new DOMException('Aborted', 'AbortError'));
                        }, { once: true });
                    });
                }),
                getDirectors: jest.fn().mockImplementation((_libraryId, options) => {
                    resolveDirectorsStarted?.();
                    return new Promise<PlexTagDirectoryItem[]>((_, reject) => {
                        options.signal?.addEventListener('abort', () => {
                            void Promise.resolve().then(() => {
                                secondSettled = true;
                                reject(new DOMException('Aborted', 'AbortError'));
                            });
                        }, { once: true });
                    });
                }),
            }),
        });
        const controller = new AbortController();

        const loadPromise = loader.loadSnapshot(
            createConfig({
                strategyConfig: {
                    ...createConfig().strategyConfig,
                    directors: { enabled: true, priority: 4, scope: 'per-library' },
                },
            }),
            [createLibrary()],
            'preview',
            {
                signal: controller.signal,
                requestIntent: 'preview',
                detachFromSignal: false,
            }
        );

        await Promise.all([genresStarted, directorsStarted]);
        controller.abort();

        await expect(loadPromise).rejects.toMatchObject({ name: 'AbortError' });
        await flushPromises();
        expect(secondSettled).toBe(true);
    });

    it('preserves an earlier different-key load when a newer key starts', async () => {
        let resolveGenresStarted: (() => void) | null = null;
        let resolveGenres: (tags: PlexTagDirectoryItem[]) => void = () => undefined;
        let genresAborted = false;
        const genresStarted = new Promise<void>((resolve) => {
            resolveGenresStarted = resolve;
        });
        const genresResult = new Promise<PlexTagDirectoryItem[]>((resolve) => {
            resolveGenres = resolve;
        });
        const loader = new ChannelSetupFacetSnapshotLoader({
            plexLibrary: createPlexLibrary({
                getGenres: jest.fn().mockImplementation((_libraryId, options) => {
                    resolveGenresStarted?.();
                    options.signal?.addEventListener('abort', () => {
                        genresAborted = true;
                    }, { once: true });
                    return genresResult;
                }),
                getDirectors: jest.fn().mockResolvedValue([
                    { key: 'director-1', title: 'Jane Director', count: 2 },
                ]),
            }),
        });

        const firstLoad = loader.loadSnapshot(
            createConfig(),
            [createLibrary()],
            'preview',
            {
                signal: null,
                requestIntent: 'preview',
                detachFromSignal: false,
            }
        );
        await genresStarted;

        const secondLoad = loader.loadSnapshot(
            createConfig({
                strategyConfig: {
                    ...createConfig().strategyConfig,
                    genres: { enabled: false, priority: 3, scope: 'per-library' },
                    directors: { enabled: true, priority: 4, scope: 'per-library' },
                },
            }),
            [createLibrary()],
            'preview',
            {
                signal: null,
                requestIntent: 'preview',
                detachFromSignal: false,
            }
        );

        await expect(secondLoad).resolves.toMatchObject({ status: 'ready' });
        expect(genresAborted).toBe(false);
        resolveGenres([{ key: 'genre-1', title: 'Action', count: 2 }]);
        await expect(firstLoad).resolves.toMatchObject({ status: 'ready' });
    });

    it('aborts sibling recovered-count requests after the first recovery failure', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        let secondCountSignalAborted = false;
        let countRequestIndex = 0;
        const loader = new ChannelSetupFacetSnapshotLoader({
            plexLibrary: createPlexLibrary({
                getActors: jest.fn().mockResolvedValue([
                    { key: 'actor-1', title: 'Alex Actor', count: null },
                    { key: 'actor-2', title: 'Blair Actor', count: null },
                ]),
                getLibraryItemCount: jest.fn().mockImplementation((_libraryId, options) => {
                    countRequestIndex++;
                    if (countRequestIndex === 1) {
                        return Promise.reject(new Error('count failed'));
                    }
                    return new Promise<number | null>((_resolve, reject) => {
                        options.signal?.addEventListener('abort', () => {
                            secondCountSignalAborted = true;
                            reject(new DOMException('Aborted', 'AbortError'));
                        }, { once: true });
                    });
                }),
            }),
        });

        try {
            const snapshot = await loader.loadSnapshot(
                createConfig({
                    strategyConfig: {
                        ...createConfig().strategyConfig,
                        genres: { enabled: false, priority: 3, scope: 'per-library' },
                        actors: { enabled: true, priority: 8, scope: 'per-library' },
                    },
                }),
                [createLibrary()],
                'preview',
                {
                    signal: null,
                    requestIntent: 'preview',
                    detachFromSignal: false,
                }
            );

            expect(snapshot).toMatchObject({
                status: 'blocked',
                failureReason: 'error',
            });
            expect(secondCountSignalAborted).toBe(true);
        } finally {
            warnSpy.mockRestore();
        }
    });

    it('preserves the original recovered-count failure when aborting sibling requests', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        let resolveFirstCount: (count: number | null) => void = () => undefined;
        let secondCountStarted: (() => void) | null = null;
        let countRequestIndex = 0;
        const secondStarted = new Promise<void>((resolve) => {
            secondCountStarted = resolve;
        });
        const loader = new ChannelSetupFacetSnapshotLoader({
            plexLibrary: createPlexLibrary({
                getActors: jest.fn().mockResolvedValue([
                    { key: 'actor-1', title: 'Alex Actor', count: null },
                    { key: 'actor-2', title: 'Blair Actor', count: null },
                ]),
                getLibraryItemCount: jest.fn().mockImplementation((_libraryId, options) => {
                    countRequestIndex++;
                    if (countRequestIndex === 1) {
                        return new Promise<number | null>((resolve) => {
                            resolveFirstCount = resolve;
                        });
                    }
                    secondCountStarted?.();
                    return new Promise<number | null>((_resolve, reject) => {
                        options.signal?.addEventListener('abort', () => {
                            reject(new DOMException('Aborted', 'AbortError'));
                        }, { once: true });
                    });
                }),
            }),
        });

        try {
            const loadPromise = loader.loadSnapshot(
                createConfig({
                    strategyConfig: {
                        ...createConfig().strategyConfig,
                        genres: { enabled: false, priority: 3, scope: 'per-library' },
                        actors: { enabled: true, priority: 8, scope: 'per-library' },
                    },
                }),
                [createLibrary()],
                'preview',
                {
                    signal: null,
                    requestIntent: 'preview',
                    detachFromSignal: false,
                }
            );

            await secondStarted;
            resolveFirstCount(null);
            await expect(loadPromise).resolves.toMatchObject({
                status: 'blocked',
                message: expect.stringContaining('actor count unavailable for Alex Actor'),
            });
        } finally {
            warnSpy.mockRestore();
        }
    });

    it('recovers unknown counts for independent facet families in parallel', async () => {
        const countResolvers: Array<(count: number | null) => void> = [];
        let activeCountRequests = 0;
        let maxActiveCountRequests = 0;
        const loader = new ChannelSetupFacetSnapshotLoader({
            plexLibrary: createPlexLibrary({
                getActors: jest.fn().mockResolvedValue([
                    { key: 'actor-1', title: 'Alex Actor', count: null },
                ]),
                getStudios: jest.fn().mockResolvedValue([
                    { key: 'studio-1', title: 'Studio One', count: null },
                ]),
                getLibraryItemCount: jest.fn().mockImplementation(() => {
                    activeCountRequests++;
                    maxActiveCountRequests = Math.max(maxActiveCountRequests, activeCountRequests);
                    return new Promise<number | null>((resolve) => {
                        countResolvers.push((count) => {
                            activeCountRequests--;
                            resolve(count);
                        });
                    });
                }),
            }),
        });

        const loadPromise = loader.loadSnapshot(
            createConfig({
                strategyConfig: {
                    ...createConfig().strategyConfig,
                    genres: { enabled: false, priority: 3, scope: 'per-library' },
                    studios: { enabled: true, priority: 7, scope: 'per-library' },
                    actors: { enabled: true, priority: 8, scope: 'per-library' },
                },
            }),
            [createLibrary()],
            'preview',
            {
                signal: null,
                requestIntent: 'preview',
                detachFromSignal: false,
            }
        );

        for (let attempt = 0; attempt < 5 && maxActiveCountRequests < 2; attempt++) {
            await flushPromises();
        }
        const observedMaxActiveCountRequests = maxActiveCountRequests;

        while (countResolvers.length > 0) {
            const pendingResolvers = countResolvers.splice(0);
            for (const resolve of pendingResolvers) {
                resolve(7);
            }
            await flushPromises();
        }
        expect(observedMaxActiveCountRequests).toBe(2);
        await expect(loadPromise).resolves.toMatchObject({ status: 'ready' });
    });
});
