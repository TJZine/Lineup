/**
 * @jest-environment jsdom
 */

import { ChannelSetupFacetSnapshotLoadSession } from '../planning/ChannelSetupFacetSnapshotLoadSession';
import {
    createFacetPlanningConfig,
    createFacetPlanningLibrary,
    createMockPlexLibrary,
    type FacetPlanningConfigOverrides,
} from './ChannelSetupFacetPlanningTestHelpers';
import type { ChannelSetupConfig } from '../types';
import { PLEX_MEDIA_TYPES, type PlexMediaItem } from '../../../modules/plex/library';
import { flushPromisesAndMacrotask } from '../../../__tests__/helpers';

const createConfig = (overrides: FacetPlanningConfigOverrides = {}): ChannelSetupConfig => createFacetPlanningConfig({
    selectedLibraryIds: ['lib-1'],
    maxChannels: 10,
    minItemsPerChannel: 1,
    ...overrides,
});

const createLibrary = createFacetPlanningLibrary;
const createPlexLibrary = createMockPlexLibrary;

const createEpisode = (
    title: string,
    seriesKey: string,
    actors: string[]
): PlexMediaItem => ({
    ratingKey: title,
    key: `/library/metadata/${title}`,
    type: 'episode',
    title,
    sortTitle: title,
    summary: '',
    year: 2024,
    durationMs: 1000,
    addedAt: new Date(0),
    updatedAt: new Date(0),
    thumb: null,
    art: null,
    grandparentRatingKey: seriesKey,
    actors,
    media: [],
} as PlexMediaItem);

describe('ChannelSetupFacetSnapshotLoadSession', () => {
    it('builds required tag failures through the runtime snapshot state owners', async () => {
        const expectedMessage = 'Required genres tag directory (type=1) is unsupported for Movies; stop and re-plan.';
        const plexLibrary = createPlexLibrary();
        plexLibrary.getGenres.mockImplementation((_libraryId, options) => {
            options.onUnsupported?.('unavailable');
            return Promise.resolve([]);
        });

        const session = new ChannelSetupFacetSnapshotLoadSession({
            plexLibrary,
            config: createConfig({
                strategyConfig: {
                    ...createConfig().strategyConfig,
                    genres: { enabled: true, priority: 3, scope: 'per-library' },
                },
            }),
            libraries: [createLibrary()],
            signal: null,
            requestIntent: 'preview',
            snapshotAbortController: new AbortController(),
            reportProgress: undefined,
        });

        const snapshot = await session.load();

        expect(snapshot).toMatchObject({
            status: 'blocked',
            failureReason: 'unsupported',
            message: expectedMessage,
            errorsTotal: 1,
            hasTransientLoadFailure: false,
        });
        expect(snapshot.warnings).toEqual([expectedMessage]);
        expect(Object.isFrozen(snapshot.warnings)).toBe(true);
    });

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

    it('returns immutable snapshot collection copies', async () => {
        const plexLibrary = createPlexLibrary();
        plexLibrary.getPlaylists.mockResolvedValue([
            {
                ratingKey: 'pl-1',
                key: '/playlists/pl-1',
                title: 'Favorites',
                thumb: null,
                duration: 0,
                leafCount: 10,
            },
        ]);
        plexLibrary.getCollections.mockResolvedValue([
            {
                ratingKey: 'col-1',
                key: '/library/collections/col-1',
                title: 'Classics',
                thumb: null,
                childCount: 12,
            },
        ]);

        const session = new ChannelSetupFacetSnapshotLoadSession({
            plexLibrary,
            config: createConfig({
                strategyConfig: {
                    ...createConfig().strategyConfig,
                    playlists: { enabled: true, priority: 2, scope: 'per-library' },
                    collections: { enabled: true, priority: 1, scope: 'per-library' },
                },
            }),
            libraries: [createLibrary()],
            signal: null,
            requestIntent: 'preview',
            snapshotAbortController: new AbortController(),
            reportProgress: undefined,
        });

        const snapshot = await session.load();

        expect(snapshot.status).toBe('ready');
        expect(Object.isFrozen(snapshot.playlists)).toBe(true);
        expect(Object.isFrozen(snapshot.warnings)).toBe(true);
        expect(Object.isFrozen(snapshot.collectionsByLibraryId)).toBe(true);
        expect('set' in snapshot.collectionsByLibraryId).toBe(false);
        expect(Object.isFrozen(snapshot.collectionsByLibraryId.get('lib-1'))).toBe(true);
    });

    it('records playlist and collection elapsed time when fetches fail', async () => {
        const nowSpy = jest.spyOn(performance, 'now')
            .mockReturnValueOnce(10)
            .mockReturnValueOnce(25)
            .mockReturnValueOnce(40)
            .mockReturnValueOnce(70);
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const plexLibrary = createPlexLibrary();
        plexLibrary.getPlaylists.mockRejectedValue(new Error('playlist unavailable'));
        plexLibrary.getCollections.mockRejectedValue(new Error('collections unavailable'));

        try {
            const session = new ChannelSetupFacetSnapshotLoadSession({
                plexLibrary,
                config: createConfig({
                    strategyConfig: {
                        ...createConfig().strategyConfig,
                        playlists: { enabled: true, priority: 2, scope: 'per-library' },
                        collections: { enabled: true, priority: 1, scope: 'per-library' },
                    },
                }),
                libraries: [createLibrary()],
                signal: null,
                requestIntent: 'preview',
                snapshotAbortController: new AbortController(),
                reportProgress: undefined,
            });

            const snapshot = await session.load();

            expect(snapshot.status).toBe('ready');
            expect(snapshot.playlistMs).toBe(15);
            expect(snapshot.collectionsMs).toBe(30);
            expect(snapshot.errorsTotal).toBe(2);
        } finally {
            nowSpy.mockRestore();
            warnSpy.mockRestore();
        }
    });

    it('builds a compact TV people series index once when actor or director strategies are enabled', async () => {
        const plexLibrary = createPlexLibrary();
        plexLibrary.getActors.mockResolvedValue([
            { key: 'actor-1', title: 'Alex Actor', count: 3 },
        ]);
        plexLibrary.getLibraryItems.mockResolvedValue([
            createEpisode('ep-1', 'show-a', ['Alex Actor']),
            createEpisode('ep-2', 'show-b', ['Alex Actor']),
            createEpisode('ep-3', 'show-c', ['Alex Actor']),
        ]);

        const session = new ChannelSetupFacetSnapshotLoadSession({
            plexLibrary,
            config: createConfig({
                strategyConfig: {
                    ...createConfig().strategyConfig,
                    actors: { enabled: true, priority: 8, scope: 'per-library' },
                },
            }),
            libraries: [createLibrary({ type: 'show', contentCount: 3 })],
            signal: null,
            requestIntent: 'preview',
            snapshotAbortController: new AbortController(),
            reportProgress: undefined,
        });

        const snapshot = await session.load();

        expect(snapshot.status).toBe('ready');
        expect(plexLibrary.getLibraryItems).toHaveBeenCalledTimes(1);
        expect(plexLibrary.getLibraryItems).toHaveBeenCalledWith(
            'lib-1',
            expect.objectContaining({ filter: { type: PLEX_MEDIA_TYPES.EPISODE } })
        );
        expect(snapshot.peopleSeriesIndexByLibraryId.get('lib-1')?.actorsByName.get('alex actor')).toEqual({
            title: 'Alex Actor',
            episodeCount: 3,
            distinctSeriesCount: 3,
        });
    });

    it('keeps TV people index episode fetches abortable through the snapshot signal', async () => {
        const callerAbortController = new AbortController();
        const plexLibrary = createPlexLibrary();
        plexLibrary.getActors.mockResolvedValue([
            { key: 'actor-1', title: 'Alex Actor', count: 3 },
        ]);
        plexLibrary.getLibraryItems.mockImplementation((_libraryId, options) => new Promise<PlexMediaItem[]>((_resolve, reject) => {
            if (options?.signal?.aborted) {
                reject({ name: 'AbortError' });
                return;
            }
            options?.signal?.addEventListener('abort', () => reject({ name: 'AbortError' }), { once: true });
        }));

        const session = new ChannelSetupFacetSnapshotLoadSession({
            plexLibrary,
            config: createConfig({
                strategyConfig: {
                    ...createConfig().strategyConfig,
                    actors: { enabled: true, priority: 8, scope: 'per-library' },
                },
            }),
            libraries: [createLibrary({ type: 'show', contentCount: 3 })],
            signal: callerAbortController.signal,
            requestIntent: 'preview',
            snapshotAbortController: new AbortController(),
            reportProgress: undefined,
        });
        const loadPromise = session.load();

        for (let attempts = 0; attempts < 25 && plexLibrary.getLibraryItems.mock.calls.length === 0; attempts += 1) {
            await flushPromisesAndMacrotask();
        }
        if (plexLibrary.getLibraryItems.mock.calls.length === 0) {
            throw new Error('Timed out waiting for plexLibrary.getLibraryItems to be called.');
        }
        const options = plexLibrary.getLibraryItems.mock.calls[0]?.[1];
        callerAbortController.abort();

        await expect(loadPromise).rejects.toMatchObject({ name: 'AbortError' });
        expect(options?.signal?.aborted).toBe(true);
    });

    it('aborts sibling native facet requests while preserving the original blocking failure snapshot', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        let rejectGenres: (reason?: unknown) => void = () => undefined;
        let resolveGenresStarted: (() => void) | null = null;
        let resolveDirectorsStarted: (() => void) | null = null;
        let directorsAborted = false;
        const genresStarted = new Promise<void>((resolve) => {
            resolveGenresStarted = resolve;
        });
        const directorsStarted = new Promise<void>((resolve) => {
            resolveDirectorsStarted = resolve;
        });
        const plexLibrary = createPlexLibrary();
        plexLibrary.getGenres.mockImplementation((_libraryId, options) => {
            resolveGenresStarted?.();
            return new Promise((_, reject) => {
                rejectGenres = reject;
                options.signal?.addEventListener('abort', () => {
                    reject(new DOMException('Aborted', 'AbortError'));
                }, { once: true });
            });
        });
        plexLibrary.getDirectors.mockImplementation((_libraryId, options) => {
            resolveDirectorsStarted?.();
            return new Promise((_, reject) => {
                options.signal?.addEventListener('abort', () => {
                    directorsAborted = true;
                    reject(new DOMException('Aborted', 'AbortError'));
                }, { once: true });
            });
        });

        try {
            const session = new ChannelSetupFacetSnapshotLoadSession({
                plexLibrary,
                config: createConfig({
                    strategyConfig: {
                        ...createConfig().strategyConfig,
                        genres: { enabled: true, priority: 3, scope: 'per-library' },
                        directors: { enabled: true, priority: 4, scope: 'per-library' },
                    },
                }),
                libraries: [createLibrary()],
                signal: null,
                requestIntent: 'preview',
                snapshotAbortController: new AbortController(),
                reportProgress: undefined,
            });
            const loadPromise = session.load();

            await Promise.all([genresStarted, directorsStarted]);
            rejectGenres(new Error('genre directory failed'));

            await expect(loadPromise).resolves.toMatchObject({
                status: 'blocked',
                failureReason: 'error',
                message: expect.stringContaining('genre directory failed'),
            });
            expect(directorsAborted).toBe(true);
        } finally {
            warnSpy.mockRestore();
        }
    });
});
