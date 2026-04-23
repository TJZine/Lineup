/**
 * @jest-environment jsdom
 */

import {
    assertRecoveredTagCount,
    ChannelSetupFacetSnapshotLoader,
    ChannelSetupPlanningError,
} from '../ChannelSetupFacetSnapshotLoader';
import { flushPromises } from '../../../__tests__/helpers';
import type { ChannelSetupConfig } from '../types';
import type { IPlexLibrary, PlexLibrarySection, PlexTagDirectoryItem } from '../../../modules/plex/library';

const createConfig = (overrides: Partial<ChannelSetupConfig> = {}): ChannelSetupConfig => ({
    serverId: 'server-1',
    selectedLibraryIds: ['lib-1'],
    maxChannels: 10,
    buildMode: 'replace',
    strategyConfig: {
        collections: { enabled: false, priority: 1, scope: 'per-library' },
        playlists: { enabled: false, priority: 2, scope: 'per-library' },
        genres: { enabled: true, priority: 3, scope: 'per-library' },
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

const createPlexLibrary = (overrides: Partial<jest.Mocked<IPlexLibrary>> = {}): jest.Mocked<IPlexLibrary> => ({
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
    getCollections: jest.fn().mockResolvedValue([]),
    getCollectionItems: jest.fn(),
    getPlaylists: jest.fn().mockResolvedValue([]),
    getPlaylistItems: jest.fn(),
    getActors: jest.fn().mockResolvedValue([]),
    getStudios: jest.fn().mockResolvedValue([]),
    getGenres: jest.fn().mockResolvedValue([]),
    getDirectors: jest.fn().mockResolvedValue([]),
    getYears: jest.fn().mockResolvedValue([]),
    on: jest.fn(),
    off: jest.fn(),
    ...overrides,
} as unknown as jest.Mocked<IPlexLibrary>);

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
});
