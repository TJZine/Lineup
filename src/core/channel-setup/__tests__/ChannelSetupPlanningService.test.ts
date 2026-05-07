/**
 * @jest-environment jsdom
 */

import { ChannelSetupPlanningService } from '../planning/ChannelSetupPlanningService';
import { ChannelSetupFacetSnapshotLoader } from '../planning/ChannelSetupFacetSnapshotLoader';
import { PLEX_MEDIA_TYPES } from '../../../modules/plex/library';
import type {
    IPlexLibrary,
    PlexLibrarySection,
    PlexTagDirectoryItem,
    PlexTagDirectoryUnsupportedReason,
} from '../../../modules/plex/library';
import type { IChannelManager } from '../../../modules/scheduler/channel-manager';
import { expectConsoleWarn, flushPromisesAndMacrotask } from '../../../__tests__/helpers';
import {
    createDeferred,
    createFacetPlanningConfig as createConfig,
    createFacetPlanningLibrary,
    createFacetPlanningTag as makeTag,
} from './ChannelSetupFacetPlanningTestHelpers';

const makeLibrary = (overrides: Partial<PlexLibrarySection>): PlexLibrarySection => createFacetPlanningLibrary({
    id: 'lib1',
    uuid: 'uuid-1',
    title: 'Shows',
    type: 'show',
    agent: 'agent',
    scanner: 'scanner',
    contentCount: 0,
    lastScannedAt: new Date(0),
    ...overrides,
});

const resolvePendingAfterMacrotask = async (): Promise<'pending'> => {
    await flushPromisesAndMacrotask();
    return 'pending';
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
        const result = await service.buildSetupPlan(config, libraries, null, 'preview');

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

    it('sorts concurrent partial warnings deterministically before returning them', async () => {
        expectConsoleWarn([
            'Failed to fetch collections for library Zulu:',
            expect.objectContaining({ message: 'zulu collections failed' }),
        ]);
        expectConsoleWarn([
            'Failed to fetch collections for library Alpha:',
            expect.objectContaining({ message: 'alpha collections failed' }),
        ]);
        const alphaCollections = createDeferred<never>();
        const zuluCollections = createDeferred<never>();
        const plexLibrary = {
            getPlaylists: jest.fn(),
            getCollections: jest.fn().mockImplementation((libraryId: string) => {
                if (libraryId === 'lib-z') {
                    return zuluCollections.promise;
                }
                if (libraryId === 'lib-a') {
                    return alphaCollections.promise;
                }
                return Promise.resolve([]);
            }),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn(),
            getDirectors: jest.fn(),
            getYears: jest.fn(),
            getActors: jest.fn(),
            getStudios: jest.fn(),
        } as unknown as jest.Mocked<IPlexLibrary>;

        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;

        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const planPromise = service.buildSetupPlan(
            createConfig({
                selectedLibraryIds: ['lib-z', 'lib-a'],
                strategyConfig: {
                    collections: { enabled: true, priority: 1, scope: 'per-library' },
                },
            }),
            [
                makeLibrary({ id: 'lib-z', title: 'Zulu', type: 'show' }),
                makeLibrary({ id: 'lib-a', title: 'Alpha', type: 'show' }),
            ],
            null,
            'preview'
        );

        zuluCollections.reject(new Error('zulu collections failed'));
        alphaCollections.reject(new Error('alpha collections failed'));

        const result = await planPromise;

        expect(result.plan).not.toBeNull();
        expect(result.warnings).toEqual([
            'Partial setup plan (fetch_collections): fetch_collections failed for Alpha (alpha collections failed)',
            'Partial setup plan (fetch_collections): fetch_collections failed for Zulu (zulu collections failed)',
        ]);
    });

    it('preserves primitive partial warning details from snapshot load failures', async () => {
        expectConsoleWarn([
            'Failed to fetch collections for library Shows:',
            'collections endpoint failed',
        ]);
        const plexLibrary = {
            getPlaylists: jest.fn(),
            getCollections: jest.fn().mockRejectedValue('collections endpoint failed'),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn(),
            getDirectors: jest.fn(),
            getYears: jest.fn(),
            getActors: jest.fn(),
            getStudios: jest.fn(),
        } as unknown as jest.Mocked<IPlexLibrary>;
        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;
        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });

        const result = await service.buildSetupPlan(
            createConfig({
                selectedLibraryIds: ['shows'],
                strategyConfig: {
                    collections: { enabled: true, priority: 1, scope: 'per-library' },
                },
            }),
            [makeLibrary({ id: 'shows', title: 'Shows', type: 'show' })],
            null,
            'preview'
        );

        expect(result.plan).not.toBeNull();
        expect(result.warnings).toContain(
            'Partial setup plan (fetch_collections): fetch_collections failed for Shows (collections endpoint failed)'
        );
    });

    it('retains playlist and collection failures as partial warnings while native tag failures block planning', async () => {
        expectConsoleWarn([
            'Failed to fetch playlists:',
            expect.objectContaining({ message: 'playlist endpoint failed' }),
        ]);
        expectConsoleWarn([
            'Failed to fetch collections for library Shows:',
            expect.objectContaining({ message: 'collections endpoint failed' }),
        ]);
        expectConsoleWarn([
            'Failed to fetch genres for Shows:',
            expect.objectContaining({ message: 'genre endpoint failed' }),
        ]);
        const enrichmentPlexLibrary = {
            getPlaylists: jest.fn().mockRejectedValue({
                name: 'Error',
                code: 'SERVER_ERROR',
                message: 'playlist endpoint failed',
            }),
            getCollections: jest.fn().mockRejectedValue({
                name: 'Error',
                code: 'SERVER_ERROR',
                message: 'collections endpoint failed',
            }),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn()
                .mockResolvedValueOnce([])
                .mockRejectedValueOnce({
                    name: 'Error',
                    code: 'SERVER_ERROR',
                    message: 'genre endpoint failed',
                }),
            getDirectors: jest.fn(),
            getYears: jest.fn(),
            getActors: jest.fn(),
            getStudios: jest.fn(),
        } as unknown as jest.Mocked<IPlexLibrary>;
        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;
        const enrichmentService = new ChannelSetupPlanningService({
            plexLibrary: enrichmentPlexLibrary,
            channelManager,
        });
        const libraries = [makeLibrary({
            id: 'shows',
            title: 'Shows',
            type: 'show',
            contentCount: 1200,
        })];

        const enrichmentOnly = await enrichmentService.buildSetupPlan(
            createConfig({
                selectedLibraryIds: ['shows'],
                strategyConfig: {
                    playlists: { enabled: true, priority: 1, scope: 'per-library' },
                    collections: { enabled: true, priority: 2, scope: 'per-library' },
                },
            }),
            libraries,
            null,
            'preview'
        );

        expect(enrichmentOnly.plan).not.toBeNull();
        expect(enrichmentOnly.failureReason).toBeUndefined();
        expect(enrichmentOnly.blockedMessage).toBeUndefined();
        expect(enrichmentOnly.warnings.join('\n')).toContain('fetch_playlists failed');
        expect(enrichmentOnly.warnings.join('\n')).toContain('fetch_collections failed');

        const nativePlexLibrary = {
            getPlaylists: jest.fn(),
            getCollections: jest.fn(),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockRejectedValue({
                name: 'Error',
                code: 'SERVER_ERROR',
                message: 'genre endpoint failed',
            }),
            getDirectors: jest.fn(),
            getYears: jest.fn(),
            getActors: jest.fn(),
            getStudios: jest.fn(),
        } as unknown as jest.Mocked<IPlexLibrary>;
        const nativeService = new ChannelSetupPlanningService({
            plexLibrary: nativePlexLibrary,
            channelManager,
        });

        const nativeTagRequired = await nativeService.buildSetupPlan(
            createConfig({
                selectedLibraryIds: ['shows'],
                strategyConfig: {
                    genres: { enabled: true, priority: 1, scope: 'per-library' },
                },
            }),
            libraries,
            null,
            'preview'
        );

        expect(nativeTagRequired.plan).toBeNull();
        expect(nativeTagRequired.failureReason).toBe('error');
        expect(nativeTagRequired.previewStatus).toBe('blocked');
        expect(nativeTagRequired.blockedMessage).toContain('stop and re-plan');
    });

    it('recovers missing native tag counts before applying min-items filtering', async () => {
        const plexLibrary = {
            getPlaylists: jest.fn(),
            getCollections: jest.fn(),
            getLibraryItemCount: jest.fn().mockImplementation(
                async (
                    _libraryId: string,
                    options?: { filter?: Record<string, string | number> }
                ) => {
                    const filter = options?.filter ?? {};
                    if (filter.genre === 'Comedy') return 4;
                    if (filter.genre === 'Drama') return 8;
                    if (filter.director === 'Jane Doe') return 3;
                    if (filter.director === 'John Roe') return 9;
                    if (filter.year === '1981') return 2;
                    if (filter.year === '1988') return 4;
                    if (filter.year === '1991') return 1;
                    if (filter.actor === 'Alex Star') return 6;
                    if (filter.actor === 'actor-2') return 2;
                    if (filter.studio === 'Studio A') return 7;
                    if (filter.studio === 'studio-2') return 1;
                    return 0;
                }
            ),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockResolvedValue([
                makeTag({ title: 'Comedy', count: null }),
                makeTag({ title: 'Drama', count: null }),
            ]),
            getDirectors: jest.fn().mockResolvedValue([
                makeTag({ title: 'Jane Doe', count: null }),
                makeTag({ title: 'John Roe', count: null }),
            ]),
            getYears: jest.fn().mockResolvedValue([
                makeTag({ title: '1981', count: null }),
                makeTag({ title: '1988', count: null }),
                makeTag({ title: '1991', count: null }),
            ]),
            getActors: jest.fn().mockResolvedValue([
                makeTag({
                    key: 'actor-1',
                    title: 'Alex Star',
                    count: null,
                    fastKey: '/library/sections/shows/actor?type=4&actor=Alex%20Star',
                }),
                makeTag({ key: 'actor-2', title: 'Taylor Guest', count: null }),
            ]),
            getStudios: jest.fn().mockResolvedValue([
                makeTag({
                    key: 'studio-1',
                    title: 'Studio A',
                    count: null,
                    fastKey: '/library/sections/shows/studio?type=4&studio=Studio%20A',
                }),
                makeTag({ key: 'studio-2', title: 'Studio B', count: null }),
            ]),
        } as unknown as jest.Mocked<IPlexLibrary>;

        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;

        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const config = service.normalizeConfig(createConfig({
            selectedLibraryIds: ['shows'],
            minItemsPerChannel: 5,
            strategyConfig: {
                genres: { enabled: true, priority: 1, scope: 'per-library' },
                directors: { enabled: true, priority: 2, scope: 'per-library' },
                decades: { enabled: true, priority: 3, scope: 'per-library' },
                studios: { enabled: true, priority: 4, scope: 'per-library' },
                actors: { enabled: true, priority: 5, scope: 'per-library' },
            },
        }));

        const libraries = [makeLibrary({
            id: 'shows',
            title: 'Shows',
            type: 'show',
            contentCount: 1200,
        })];
        const result = await service.buildSetupPlan(config, libraries, null, 'preview');

        expect(result.canceled).toBe(false);
        expect(result.plan).not.toBeNull();
        expect(result.failureReason).toBeUndefined();
        expect(result.blockedMessage).toBeUndefined();
        expect(result.plan?.estimates).toEqual(expect.objectContaining({
            genres: 1,
            directors: 1,
            decades: 1,
            studios: 1,
            actors: 1,
        }));
        expect(result.plan?.pendingChannels.some((c) => c.name.includes('Shows - Drama'))).toBe(true);
        expect(result.plan?.pendingChannels.some((c) => c.name.includes('Shows - Comedy'))).toBe(false);
        expect(result.plan?.pendingChannels.some((c) => c.name.includes('Shows - John Roe'))).toBe(true);
        expect(result.plan?.pendingChannels.some((c) => c.name.includes('Shows - Jane Doe'))).toBe(false);
        expect(result.plan?.pendingChannels.some((c) => c.name.includes('Shows - 1980s'))).toBe(true);
        expect(result.plan?.pendingChannels.some((c) => c.name.includes('Shows - 1990s'))).toBe(false);
        expect(result.plan?.pendingChannels.some((c) => c.name === 'Alex Star - Shows')).toBe(true);
        expect(result.plan?.pendingChannels.some((c) => c.name === 'Taylor Guest - Shows')).toBe(false);
        expect(result.plan?.pendingChannels.some((c) => c.name === 'Studio A - Shows')).toBe(true);
        expect(result.plan?.pendingChannels.some((c) => c.name === 'Studio B - Shows')).toBe(false);
        expect(plexLibrary.getLibraryItemCount).toHaveBeenCalledWith('shows', expect.objectContaining({
            filter: { type: PLEX_MEDIA_TYPES.SHOW, genre: 'Comedy' },
            signal: expect.any(Object),
        }));
        expect(plexLibrary.getLibraryItemCount).toHaveBeenCalledWith('shows', expect.objectContaining({
            filter: { type: PLEX_MEDIA_TYPES.EPISODE, director: 'Jane Doe' },
            signal: expect.any(Object),
        }));
        expect(plexLibrary.getLibraryItemCount).toHaveBeenCalledWith('shows', expect.objectContaining({
            filter: { type: PLEX_MEDIA_TYPES.SHOW, genre: 'Drama' },
            signal: expect.any(Object),
        }));
        expect(plexLibrary.getLibraryItemCount).toHaveBeenCalledWith('shows', expect.objectContaining({
            filter: { type: PLEX_MEDIA_TYPES.EPISODE, director: 'John Roe' },
            signal: expect.any(Object),
        }));
        expect(plexLibrary.getLibraryItemCount).toHaveBeenCalledWith('shows', expect.objectContaining({
            filter: { type: PLEX_MEDIA_TYPES.EPISODE, year: '1988' },
            signal: expect.any(Object),
        }));
        expect(plexLibrary.getLibraryItemCount).toHaveBeenCalledWith('shows', expect.objectContaining({
            filter: { type: PLEX_MEDIA_TYPES.EPISODE, year: '1981' },
            signal: expect.any(Object),
        }));
        expect(plexLibrary.getLibraryItemCount).toHaveBeenCalledWith('shows', expect.objectContaining({
            filter: { type: PLEX_MEDIA_TYPES.EPISODE, actor: 'Alex Star' },
            signal: expect.any(Object),
        }));
        expect(plexLibrary.getLibraryItemCount).toHaveBeenCalledWith('shows', expect.objectContaining({
            filter: { type: PLEX_MEDIA_TYPES.EPISODE, actor: 'actor-2' },
            signal: expect.any(Object),
        }));
        expect(plexLibrary.getLibraryItemCount).toHaveBeenCalledWith('shows', expect.objectContaining({
            filter: { type: PLEX_MEDIA_TYPES.EPISODE, studio: 'Studio A' },
            signal: expect.any(Object),
        }));
        expect(plexLibrary.getLibraryItemCount).toHaveBeenCalledWith('shows', expect.objectContaining({
            filter: { type: PLEX_MEDIA_TYPES.EPISODE, studio: 'studio-2' },
            signal: expect.any(Object),
        }));
    });

    it('counts failed fallback tag recovery time in libraryQueryMs', async () => {
        expectConsoleWarn([
            'Failed to recover genre counts for Shows:',
            expect.objectContaining({
                code: 'SERVER_ERROR',
                message: 'count endpoint failed',
            }),
        ]);
        const performanceNowSpy = jest.spyOn(performance, 'now')
            .mockReturnValueOnce(10)
            .mockReturnValueOnce(11)
            .mockReturnValueOnce(100)
            .mockReturnValueOnce(117);
        const plexLibrary = {
            getPlaylists: jest.fn(),
            getCollections: jest.fn(),
            getLibraryItemCount: jest.fn().mockRejectedValue({
                name: 'Error',
                code: 'SERVER_ERROR',
                message: 'count endpoint failed',
            }),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockResolvedValue([
                makeTag({ title: 'Drama', count: null }),
            ]),
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

        const result = await service.buildSetupPlan(config, libraries, null, 'preview');

        expect(result.plan).toBeNull();
        expect(result.failureReason).toBe('error');
        expect(result.blockedMessage).toContain('count endpoint failed');
        expect(result.libraryQueryMs).toBe(18);

        performanceNowSpy.mockRestore();
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

        const result = await service.buildSetupPlan(config, libraries, null, 'preview');

        expect(result.canceled).toBe(false);
        expect(result.blockedMessage).toContain('stop and re-plan');
        expect(result.lastTask).toBe('scan_library_items');
        expect(result.plan).toBeNull();
        expect(result.warnings.join('\n')).toContain('stop and re-plan');
        expect(result.warnings.join('\n')).toContain('genres');
        expect(plexLibrary.getLibraryItems).not.toHaveBeenCalled();
    });

    it('stops planning when a required tag directory fetch fails', async () => {
        expectConsoleWarn([
            'Failed to fetch directors for Shows:',
            expect.objectContaining({
                code: 'SERVER_ERROR',
                message: 'director endpoint failed',
            }),
        ]);
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

        const result = await service.buildSetupPlan(config, libraries, null, 'preview');

        expect(result.canceled).toBe(false);
        expect(result.blockedMessage).toContain('stop and re-plan');
        expect(result.lastTask).toBe('scan_library_items');
        expect(result.plan).toBeNull();
        expect(result.warnings.join('\n')).toContain('stop and re-plan');
        expect(result.warnings.join('\n')).toContain('director endpoint failed');
        expect(plexLibrary.getLibraryItems).not.toHaveBeenCalled();
    });

    it('does not stop planning when one selected library returns empty studios but another selected library has studio tags', async () => {
        const plexLibrary = {
            getPlaylists: jest.fn(),
            getCollections: jest.fn(),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn(),
            getDirectors: jest.fn(),
            getYears: jest.fn(),
            getActors: jest.fn(),
            getStudios: jest.fn().mockImplementation(
                async (
                    libraryId: string,
                    options: { onUnsupported?: (reason: PlexTagDirectoryUnsupportedReason) => void }
                ) => {
                    if (libraryId === 'anime') {
                        options.onUnsupported?.('empty');
                        return [];
                    }
                    return [makeTag({ key: 'studio-a', title: 'Studio A', count: 12 })];
                }
            ),
        } as unknown as jest.Mocked<IPlexLibrary>;

        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;

        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const config = service.normalizeConfig(createConfig({
            selectedLibraryIds: ['anime', 'tv'],
            strategyConfig: {
                studios: { enabled: true, priority: 1, scope: 'per-library' },
            },
        }));

        const libraries = [
            makeLibrary({ id: 'anime', title: 'Anime Home', type: 'show', contentCount: 1200 }),
            makeLibrary({ id: 'tv', title: 'TV Home', type: 'show', contentCount: 1200 }),
        ];

        const result = await service.buildSetupPlan(config, libraries, null, 'preview');

        expect(result.canceled).toBe(false);
        expect(result.plan).not.toBeNull();
        expect(result.failureReason).toBeUndefined();
        expect(result.previewStatus).toBeUndefined();
        expect(result.blockedMessage).toBeUndefined();
        expect(result.warnings).toContain('Skipped studios for Anime Home: Plex returned no tag entries (type=4).');
        expect(result.plan?.pendingChannels.some((c) => c.name.includes('Studio A'))).toBe(true);
    });

    it('warns and skips one selected library facet when another selected media type can still build channels', async () => {
        const plexLibrary = {
            getPlaylists: jest.fn(),
            getCollections: jest.fn(),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockImplementation(
                async (
                    libraryId: string,
                    options: {
                        type?: number;
                        onUnsupported?: (reason: PlexTagDirectoryUnsupportedReason) => void;
                    }
                ) => {
                    if (libraryId === 'movies') {
                        expect(options.type).toBe(PLEX_MEDIA_TYPES.MOVIE);
                        return [makeTag({ key: 'movie-comedy', title: 'Movie Comedy', count: 12 })];
                    }
                    expect(options.type).toBe(PLEX_MEDIA_TYPES.SHOW);
                    options.onUnsupported?.('empty');
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
            selectedLibraryIds: ['movies', 'shows'],
            strategyConfig: {
                genres: { enabled: true, priority: 1, scope: 'per-library' },
            },
        }));

        const libraries = [
            makeLibrary({ id: 'movies', title: 'Movie Home', type: 'movie', contentCount: 1200 }),
            makeLibrary({ id: 'shows', title: 'Show Home', type: 'show', contentCount: 1200 }),
        ];

        const result = await service.buildSetupPlan(config, libraries, null, 'preview');

        expect(result.canceled).toBe(false);
        expect(result.plan).not.toBeNull();
        expect(result.failureReason).toBeUndefined();
        expect(result.previewStatus).toBeUndefined();
        expect(result.blockedMessage).toBeUndefined();
        expect(result.warnings).toContain('Skipped genres for Show Home: Plex returned no tag entries (type=2).');
        expect(result.plan?.pendingChannels.some((c) => c.name.includes('Movie Comedy'))).toBe(true);
        expect(result.plan?.pendingChannels.some((c) => c.name.includes('Show Home'))).toBe(false);
    });

    it('records returned facet tags without warning when Plex reports empty but still returns entries', async () => {
        const plexLibrary = {
            getPlaylists: jest.fn(),
            getCollections: jest.fn(),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockImplementation(
                async (
                    _libraryId: string,
                    options: { onUnsupported?: (reason: PlexTagDirectoryUnsupportedReason) => void }
                ) => {
                    options.onUnsupported?.('empty');
                    return [makeTag({ key: 'genre-a', title: 'Genre A', count: 12 })];
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

        const result = await service.buildSetupPlan(config, libraries, null, 'preview');

        expect(result.canceled).toBe(false);
        expect(result.plan).not.toBeNull();
        expect(result.failureReason).toBeUndefined();
        expect(result.previewStatus).toBeUndefined();
        expect(result.blockedMessage).toBeUndefined();
        expect(result.warnings).toEqual([]);
        expect(result.plan?.pendingChannels.some((c) => c.name.includes('Genre A'))).toBe(true);
    });

    it('reports empty-tag skip warnings in deterministic sorted order instead of task completion order', async () => {
        const genresDeferred = createDeferred<PlexTagDirectoryItem[]>();
        const directorsDeferred = createDeferred<PlexTagDirectoryItem[]>();

        const plexLibrary = {
            getPlaylists: jest.fn(),
            getCollections: jest.fn(),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockImplementation(
                async (
                    _libraryId: string,
                    options: { onUnsupported?: (reason: PlexTagDirectoryUnsupportedReason) => void }
                ) => {
                    const result = await genresDeferred.promise;
                    options.onUnsupported?.('empty');
                    return result;
                }
            ),
            getDirectors: jest.fn().mockImplementation(
                async (
                    _libraryId: string,
                    options: { onUnsupported?: (reason: PlexTagDirectoryUnsupportedReason) => void }
                ) => {
                    const result = await directorsDeferred.promise;
                    options.onUnsupported?.('empty');
                    return result;
                }
            ),
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
                directors: { enabled: true, priority: 2, scope: 'per-library' },
            },
        }));

        const libraries = [makeLibrary({
            id: 'shows',
            title: 'Shows',
            type: 'show',
            contentCount: 1200,
        })];

        const resultPromise = service.buildSetupPlan(config, libraries, null, 'preview');

        genresDeferred.resolve([]);
        directorsDeferred.resolve([]);

        const result = await resultPromise;

        expect(result.canceled).toBe(false);
        expect(result.plan).toBeNull();
        expect(result.failureReason).toBe('empty');
        expect(result.blockedMessage).toContain('could not build any channels');
        expect(result.warnings).toEqual([
            'Skipped directors for Shows: Plex returned no tag entries (type=4).',
            'Skipped genres for Shows: Plex returned no tag entries (type=2).',
        ]);
    });

    it('stops planning with skip warnings when enabled strategies produce no channels', async () => {
        const plexLibrary = {
            getPlaylists: jest.fn(),
            getCollections: jest.fn(),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn(),
            getDirectors: jest.fn(),
            getYears: jest.fn(),
            getActors: jest.fn(),
            getStudios: jest.fn().mockImplementation(
                async (
                    _libraryId: string,
                    options: { onUnsupported?: (reason: PlexTagDirectoryUnsupportedReason) => void }
                ) => {
                    options.onUnsupported?.('empty');
                    return [];
                }
            ),
        } as unknown as jest.Mocked<IPlexLibrary>;

        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;

        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const config = service.normalizeConfig(createConfig({
            selectedLibraryIds: ['anime', 'tv'],
            strategyConfig: {
                studios: { enabled: true, priority: 1, scope: 'per-library' },
            },
        }));

        const libraries = [
            makeLibrary({ id: 'anime', title: 'Anime Home', type: 'show', contentCount: 1200 }),
            makeLibrary({ id: 'tv', title: 'TV Home', type: 'show', contentCount: 1200 }),
        ];

        const result = await service.buildSetupPlan(config, libraries, null, 'preview');

        expect(result.canceled).toBe(false);
        expect(result.plan).toBeNull();
        expect(result.failureReason).toBe('empty');
        expect(result.previewStatus).toBe('blocked');
        expect(result.blockedMessage).toContain('could not build any channels');
        expect(result.warnings).toEqual([
            'Skipped studios for Anime Home: Plex returned no tag entries (type=4).',
            'Skipped studios for TV Home: Plex returned no tag entries (type=4).',
        ]);
    });

    it('separates preview and build facet snapshots by intent', async () => {
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
        const planResult = await service.buildSetupPlan(config, libraries, null, 'build');

        expect(preview.estimates.total).toBeGreaterThan(0);
        expect(review.preview.estimates.total).toBe(planResult.plan?.estimates.total);
        expect(planResult.plan).not.toBeNull();
        expect(plexLibrary.getGenres).toHaveBeenCalledTimes(2);
        expect(plexLibrary.getDirectors).toHaveBeenCalledTimes(2);
        expect(plexLibrary.getYears).toHaveBeenCalledTimes(2);
    });

    it('forwards distinct Plex request intents for preview and build flows', async () => {
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
            getGenres: jest.fn().mockResolvedValue([makeTag({ title: 'Comedy', count: 10 })]),
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

        await service.getSetupPreview(config);
        expect(plexLibrary.getGenres).toHaveBeenCalledWith(
            'shows',
            expect.objectContaining({ requestIntent: 'preview' })
        );

        plexLibrary.getGenres.mockClear();

        await service.buildSetupPlan(config, libraries, null, 'build');
        expect(plexLibrary.getGenres).toHaveBeenCalledWith(
            'shows',
            expect.objectContaining({ requestIntent: 'background' })
        );
    });

    it('returns planner diagnostics for a saved setup config without changing the fetch path', async () => {
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
            getGenres: jest.fn().mockResolvedValue([makeTag({ title: 'Comedy', count: 10 })]),
            getDirectors: jest.fn().mockResolvedValue([makeTag({ title: 'Jane Doe', count: 6 })]),
            getYears: jest.fn().mockResolvedValue([]),
            getActors: jest.fn().mockResolvedValue([makeTag({ key: 'actor-1', title: 'Alex Star', count: 7 })]),
            getStudios: jest.fn().mockResolvedValue([makeTag({ key: 'studio-1', title: 'Studio A', count: 8 })]),
        } as unknown as jest.Mocked<IPlexLibrary>;
        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;
        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const config = service.normalizeConfig(createConfig({
            selectedLibraryIds: ['shows'],
            strategyConfig: {
                genres: { enabled: true, priority: 1, scope: 'per-library' },
                directors: { enabled: true, priority: 2, scope: 'per-library' },
                studios: { enabled: true, priority: 3, scope: 'per-library' },
                actors: { enabled: true, priority: 4, scope: 'per-library' },
            },
        }));

        const result = await service.getSetupPlanDiagnostics(config);

        expect(result).toEqual(expect.objectContaining({
            status: 'ready',
            reachedMaxChannels: false,
            diagnostics: expect.objectContaining({
                fetchedTagsByFamily: expect.objectContaining({
                    genres: [{ libraryId: 'shows', libraryName: 'Shows', count: 1 }],
                    directors: [{ libraryId: 'shows', libraryName: 'Shows', count: 1 }],
                    studios: [{ libraryId: 'shows', libraryName: 'Shows', count: 1 }],
                    actors: [{ libraryId: 'shows', libraryName: 'Shows', count: 1 }],
                }),
                candidatesBeforeMinItems: expect.objectContaining({
                    total: 4,
                    genres: 1,
                    directors: 1,
                    studios: 1,
                    actors: 1,
                }),
            }),
        }));
        expect(plexLibrary.getGenres).toHaveBeenCalledWith(
            'shows',
            expect.objectContaining({ requestIntent: 'background' })
        );
    });

    it('does not cache timeout snapshots', async () => {
        expectConsoleWarn([
            'Failed to fetch genres for Shows:',
            expect.objectContaining({
                code: 'NETWORK_TIMEOUT',
                message: 'timed out',
            }),
        ]);
        const libraries = [
            makeLibrary({
                id: 'shows',
                title: 'Shows',
                type: 'show',
                contentCount: 1200,
            }),
        ];
        const getGenres = jest.fn()
            .mockRejectedValueOnce({ name: 'Error', code: 'NETWORK_TIMEOUT', message: 'timed out' })
            .mockResolvedValueOnce([makeTag({ title: 'Comedy', count: 10 })]);
        const plexLibrary = {
            getLibraries: jest.fn().mockResolvedValue(libraries),
            getPlaylists: jest.fn().mockResolvedValue([]),
            getCollections: jest.fn().mockResolvedValue([]),
            getLibraryItems: jest.fn(),
            getGenres,
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

        const first = await service.buildSetupPlan(config, libraries, null, 'preview');
        expect(first.plan).toBeNull();
        expect(first.failureReason).toBe('timeout');

        const second = await service.buildSetupPlan(config, libraries, null, 'preview');
        expect(second.plan).not.toBeNull();
        expect(getGenres).toHaveBeenCalledTimes(2);
    });

    it('classifies Error instances with NETWORK_TIMEOUT code as timeout failures', async () => {
        expectConsoleWarn([
            'Failed to fetch genres for Shows:',
            expect.objectContaining({
                code: 'NETWORK_TIMEOUT',
                message: 'timed out',
            }),
        ]);
        const libraries = [
            makeLibrary({
                id: 'shows',
                title: 'Shows',
                type: 'show',
                contentCount: 1200,
            }),
        ];
        const timeoutError = new Error('timed out') as Error & { code?: unknown };
        timeoutError.code = 'NETWORK_TIMEOUT';
        const plexLibrary = {
            getLibraries: jest.fn().mockResolvedValue(libraries),
            getPlaylists: jest.fn().mockResolvedValue([]),
            getCollections: jest.fn().mockResolvedValue([]),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockRejectedValue(timeoutError),
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

        const result = await service.buildSetupPlan(config, libraries, null, 'preview');

        expect(result.plan).toBeNull();
        expect(result.failureReason).toBe('timeout');
        expect(result.blockedMessage).toContain('timed out');
    });

    it('aborts the in-flight snapshot signal when invalidating a detached snapshot load', async () => {
        const libraries = [
            makeLibrary({ id: 'old-1', title: 'Old 1', type: 'show', contentCount: 1200 }),
            makeLibrary({ id: 'old-2', title: 'Old 2', type: 'show', contentCount: 1200 }),
        ];
        const deferredByLibraryId = new Map(
            libraries.map((library) => [library.id, createDeferred<PlexTagDirectoryItem[]>()])
        );
        const signalByLibraryId = new Map<string, AbortSignal | undefined>();
        const plexLibrary = {
            getLibraries: jest.fn().mockResolvedValue(libraries),
            getPlaylists: jest.fn().mockResolvedValue([]),
            getCollections: jest.fn().mockResolvedValue([]),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockImplementation((libraryId: string, options?: { signal?: AbortSignal | null }) => {
                signalByLibraryId.set(libraryId, options?.signal ?? undefined);
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
            selectedLibraryIds: ['old-1', 'old-2'],
            strategyConfig: {
                genres: { enabled: true, priority: 1, scope: 'per-library' },
            },
        }));

        const previewPromise = service.getSetupPreview(config, {
            signal: new AbortController().signal,
        });
        const previewRejected = expect(previewPromise).rejects.toThrow();
        await flushPromisesAndMacrotask();

        expect(plexLibrary.getGenres).toHaveBeenCalledTimes(2);
        expect(signalByLibraryId.get('old-1')?.aborted).toBe(false);
        expect(signalByLibraryId.get('old-2')?.aborted).toBe(false);

        service.invalidateFacetSnapshot();

        expect(signalByLibraryId.get('old-1')?.aborted).toBe(true);
        expect(signalByLibraryId.get('old-2')?.aborted).toBe(true);

        deferredByLibraryId.get('old-1')?.resolve([makeTag({ title: 'Comedy', count: 10 })]);
        deferredByLibraryId.get('old-2')?.resolve([makeTag({ title: 'Drama', count: 8 })]);

        await previewRejected;
    });

    it('caches unsupported snapshots', async () => {
        const libraries = [
            makeLibrary({
                id: 'shows',
                title: 'Shows',
                type: 'show',
                contentCount: 1200,
            }),
        ];
        const getGenres = jest.fn().mockImplementation(async (_libraryId: string, options: { onUnsupported?: (reason: PlexTagDirectoryUnsupportedReason) => void }) => {
            options.onUnsupported?.('unavailable');
            return [];
        });
        const plexLibrary = {
            getLibraries: jest.fn().mockResolvedValue(libraries),
            getPlaylists: jest.fn().mockResolvedValue([]),
            getCollections: jest.fn().mockResolvedValue([]),
            getLibraryItems: jest.fn(),
            getGenres,
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

        const first = await service.buildSetupPlan(config, libraries, null, 'preview');
        const second = await service.buildSetupPlan(config, libraries, null, 'preview');

        expect(first.failureReason).toBe('unsupported');
        expect(second.failureReason).toBe('unsupported');
        expect(getGenres).toHaveBeenCalledTimes(1);
    });

    it('does not cache a ready snapshot degraded by transient playlist failure', async () => {
        expectConsoleWarn([
            'Failed to fetch playlists:',
            expect.objectContaining({
                code: 'NETWORK_TIMEOUT',
                message: 'playlist timed out',
            }),
        ]);
        const getPlaylists = jest.fn()
            .mockRejectedValueOnce({ name: 'Error', code: 'NETWORK_TIMEOUT', message: 'playlist timed out' })
            .mockResolvedValueOnce([
                {
                    ratingKey: 'pl1',
                    key: '/playlists/pl1',
                    title: 'Favorites',
                    thumb: null,
                    leafCount: 10,
                },
            ]);
        const plexLibrary = {
            getLibraries: jest.fn().mockResolvedValue([]),
            getPlaylists,
            getCollections: jest.fn(),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn(),
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
            strategyConfig: {
                playlists: { enabled: true, priority: 1, scope: 'per-library' },
            },
        }));

        const first = await service.buildSetupPlan(config, [], null, 'preview');
        const second = await service.buildSetupPlan(config, [], null, 'preview');

        expect(first.plan).not.toBeNull();
        expect(first.plan?.estimates.playlists).toBe(0);
        expect(first.warnings.join('\n')).toContain('fetch_playlists failed');
        expect(second.plan).not.toBeNull();
        expect(second.plan?.estimates.playlists).toBe(1);
        expect(second.warnings.join('\n')).not.toContain('fetch_playlists failed');
        expect(getPlaylists).toHaveBeenCalledTimes(2);
    });

    it('caches a clean ready snapshot', async () => {
        const getPlaylists = jest.fn().mockResolvedValue([
            {
                ratingKey: 'pl1',
                key: '/playlists/pl1',
                title: 'Favorites',
                thumb: null,
                leafCount: 10,
            },
        ]);
        const plexLibrary = {
            getLibraries: jest.fn().mockResolvedValue([]),
            getPlaylists,
            getCollections: jest.fn(),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn(),
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
            strategyConfig: {
                playlists: { enabled: true, priority: 1, scope: 'per-library' },
            },
        }));

        const first = await service.buildSetupPlan(config, [], null, 'preview');
        const second = await service.buildSetupPlan(config, [], null, 'preview');

        expect(first.plan?.estimates.playlists).toBe(1);
        expect(second.plan?.estimates.playlists).toBe(1);
        expect(getPlaylists).toHaveBeenCalledTimes(1);
    });

    it('rejects an already-aborted caller instead of returning a cached snapshot', async () => {
        const getPlaylists = jest.fn().mockResolvedValue([
            {
                ratingKey: 'pl1',
                key: '/playlists/pl1',
                title: 'Favorites',
                thumb: null,
                leafCount: 10,
            },
        ]);
        const plexLibrary = {
            getPlaylists,
            getCollections: jest.fn(),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn(),
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
            strategyConfig: {
                playlists: { enabled: true, priority: 1, scope: 'per-library' },
            },
        }));

        const first = await service.buildSetupPlan(config, [], null, 'preview');
        expect(first.plan?.estimates.playlists).toBe(1);

        const abortController = new AbortController();
        abortController.abort();

        await expect(
            service.buildSetupPlan(config, [], abortController.signal, 'preview')
        ).rejects.toMatchObject({ name: 'AbortError' });
        expect(getPlaylists).toHaveBeenCalledTimes(1);
    });

    it('rejects an already-aborted detached caller before starting uncached snapshot work', async () => {
        const getPlaylists = jest.fn().mockResolvedValue([
            {
                ratingKey: 'pl1',
                key: '/playlists/pl1',
                title: 'Favorites',
                thumb: null,
                leafCount: 10,
            },
        ]);
        const plexLibrary = {
            getPlaylists,
            getCollections: jest.fn(),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn(),
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
            strategyConfig: {
                playlists: { enabled: true, priority: 1, scope: 'per-library' },
            },
        }));
        const abortController = new AbortController();
        abortController.abort();

        await expect(
            service.buildSetupPlan(config, [], abortController.signal, 'preview')
        ).rejects.toMatchObject({ name: 'AbortError' });
        expect(getPlaylists).not.toHaveBeenCalled();
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

        const previewPromise = service.getSetupPreview(config, { signal: new AbortController().signal });
        void previewPromise.catch(() => undefined);
        await Promise.resolve();
        await Promise.resolve();
        expect(plexLibrary.getGenres).toHaveBeenCalledTimes(1);

        const buildAbortController = new AbortController();
        const settled = jest.fn();
        const buildPromise = service.buildSetupPlan(
            config,
            libraries,
            buildAbortController.signal,
            'build',
            jest.fn()
        );
        void buildPromise.then(settled);
        await Promise.resolve();

        buildAbortController.abort();
        const buildResult = await Promise.race([
            buildPromise,
            resolvePendingAfterMacrotask(),
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

        const result = await service.buildSetupPlan(config, libraries, null, 'preview');

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

        const pendingPlan = service.buildSetupPlan(config, libraries, null, 'preview');
        await Promise.resolve();

        expect(plexLibrary.getGenres).toHaveBeenCalledTimes(2);
        expect(plexLibrary.getGenres).toHaveBeenNthCalledWith(1, 's1', expect.any(Object));
        expect(plexLibrary.getGenres).toHaveBeenNthCalledWith(2, 's2', expect.any(Object));

        deferredByLibraryId.get('s1')?.resolve([makeTag({ title: 'Comedy', count: 10 })]);
        await flushPromisesAndMacrotask();

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
        const oldPreviewRejected = expect(oldPreviewPromise).rejects.toThrow();
        await flushPromisesAndMacrotask();
        expect(plexLibrary.getGenres).toHaveBeenCalledTimes(2);

        service.invalidateFacetSnapshot();

        const reportProgress = jest.fn();
        const newBuildPromise = service.buildSetupPlan(
            newConfig,
            libraries,
            new AbortController().signal,
            'build',
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
        await flushPromisesAndMacrotask();

        expect(reportProgress.mock.calls).toEqual([
            ['scan_library_items', 'Resolving filters...', 'New 1', 0, 1],
        ]);

        deferredByLibraryId.get('new-1')?.resolve([makeTag({ title: 'Drama', count: 8 })]);
        const newBuildResult = await newBuildPromise;
        expect(newBuildResult.plan).not.toBeNull();

        deferredByLibraryId.get('old-2')?.resolve([makeTag({ title: 'Thriller', count: 6 })]);
        deferredByLibraryId.get('old-3')?.resolve([makeTag({ title: 'Mystery', count: 4 })]);
        await oldPreviewRejected;
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

        const resultPromise = service.buildSetupPlan(config, libraries, null, 'preview');
        const result = await Promise.race([
            resultPromise,
            resolvePendingAfterMacrotask(),
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

        const resultPromise = service.buildSetupPlan(config, libraries, null, 'preview');
        const result = await Promise.race([
            resultPromise,
            resolvePendingAfterMacrotask(),
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
        expectConsoleWarn([
            'Failed to fetch genres for Worker One:',
            expect.objectContaining({
                code: 'NETWORK_TIMEOUT',
                message: 'worker one timed out first',
            }),
        ]);
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

        const resultPromise = service.buildSetupPlan(config, libraries, null, 'preview');
        await flushPromisesAndMacrotask();
        workerZeroGenre.resolve([]);
        const result = await resultPromise;

        expect(result.plan).toBeNull();
        expect(result.failureReason).toBe('timeout');
        expect(result.previewStatus).toBe('slow');
        expect(result.blockedMessage).toContain('Worker One');
        expect(result.blockedMessage).toContain('timed out');
    });

    it('returns the first observed facet failure within one library when multiple facets fail differently', async () => {
        expectConsoleWarn([
            'Failed to fetch actors for Mixed Library:',
            expect.objectContaining({
                code: 'NETWORK_TIMEOUT',
                message: 'actors timed out first',
            }),
        ]);
        const libraries = [
            makeLibrary({ id: 'mixed', title: 'Mixed Library', type: 'show', contentCount: 1200 }),
        ];
        const plexLibrary = {
            getPlaylists: jest.fn().mockResolvedValue([]),
            getCollections: jest.fn().mockResolvedValue([]),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockImplementation(async (
                _libraryId: string,
                options: {
                    onUnsupported?: (reason: PlexTagDirectoryUnsupportedReason) => void;
                }
            ) => {
                await Promise.resolve();
                options.onUnsupported?.('unavailable');
                return [];
            }),
            getDirectors: jest.fn().mockResolvedValue([]),
            getYears: jest.fn().mockResolvedValue([]),
            getActors: jest.fn().mockImplementation(async () => {
                throw {
                    name: 'Error',
                    code: 'NETWORK_TIMEOUT',
                    message: 'actors timed out first',
                };
            }),
            getStudios: jest.fn().mockResolvedValue([]),
        } as unknown as jest.Mocked<IPlexLibrary>;
        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;
        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const config = service.normalizeConfig(createConfig({
            selectedLibraryIds: ['mixed'],
            strategyConfig: {
                genres: { enabled: true, priority: 1, scope: 'per-library' },
                actors: { enabled: true, priority: 2, scope: 'per-library' },
            },
        }));

        const result = await service.buildSetupPlan(config, libraries, null, 'preview');

        expect(result.plan).toBeNull();
        expect(result.failureReason).toBe('timeout');
        expect(result.previewStatus).toBe('slow');
        expect(result.blockedMessage).toContain('Mixed Library');
        expect(result.blockedMessage).toContain('timed out');
    });

    it('returns the first observed unsupported facet failure within one library even when another facet times out later', async () => {
        expectConsoleWarn([
            'Failed to fetch actors for Mixed Library:',
            expect.objectContaining({
                code: 'NETWORK_TIMEOUT',
                message: 'actors timed out second',
            }),
        ]);
        const libraries = [
            makeLibrary({ id: 'mixed', title: 'Mixed Library', type: 'show', contentCount: 1200 }),
        ];
        const plexLibrary = {
            getPlaylists: jest.fn().mockResolvedValue([]),
            getCollections: jest.fn().mockResolvedValue([]),
            getLibraryItems: jest.fn(),
            getGenres: jest.fn().mockImplementation(async (
                _libraryId: string,
                options: {
                    onUnsupported?: (reason: PlexTagDirectoryUnsupportedReason) => void;
                }
            ) => {
                options.onUnsupported?.('unavailable');
                return [];
            }),
            getDirectors: jest.fn().mockResolvedValue([]),
            getYears: jest.fn().mockResolvedValue([]),
            getActors: jest.fn().mockImplementation(async () => {
                await Promise.resolve();
                throw {
                    name: 'Error',
                    code: 'NETWORK_TIMEOUT',
                    message: 'actors timed out second',
                };
            }),
            getStudios: jest.fn().mockResolvedValue([]),
        } as unknown as jest.Mocked<IPlexLibrary>;
        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;
        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const config = service.normalizeConfig(createConfig({
            selectedLibraryIds: ['mixed'],
            strategyConfig: {
                genres: { enabled: true, priority: 1, scope: 'per-library' },
                actors: { enabled: true, priority: 2, scope: 'per-library' },
            },
        }));

        const result = await service.buildSetupPlan(config, libraries, null, 'preview');

        expect(result.plan).toBeNull();
        expect(result.failureReason).toBe('unsupported');
        expect(result.previewStatus).toBe('blocked');
        expect(result.blockedMessage).toContain('Mixed Library');
        expect(result.blockedMessage).toContain('unsupported');
    });

    it('preserves empty blocked messages in preview and review fallbacks', async () => {
        const plexLibrary = {
            getLibraries: jest.fn().mockResolvedValue([
                makeLibrary({ id: 'shows', title: 'Shows', type: 'show' }),
            ]),
        } as unknown as jest.Mocked<IPlexLibrary>;
        const channelManager = {
            getAllChannels: jest.fn().mockReturnValue([]),
        } as unknown as jest.Mocked<IChannelManager>;
        const service = new ChannelSetupPlanningService({ plexLibrary, channelManager });
        const loadSnapshotSpy = jest.spyOn(ChannelSetupFacetSnapshotLoader.prototype, 'loadSnapshot');
        try {
            loadSnapshotSpy.mockResolvedValue({
                status: 'blocked',
                playlists: [],
                collectionsByLibraryId: new Map(),
                genresByLibraryId: new Map(),
                directorsByLibraryId: new Map(),
                yearsByLibraryId: new Map(),
                actorsByLibraryId: new Map(),
                studiosByLibraryId: new Map(),
                warnings: ['timed out during genre scan'],
                hasTransientLoadFailure: false,
                message: '',
                failureReason: 'timeout',
                errorsTotal: 1,
                playlistMs: 0,
                collectionsMs: 0,
                libraryQueryMs: 0,
            });

            const preview = await service.getSetupPreview(createConfig({
                selectedLibraryIds: ['shows'],
            }));
            const review = await service.getSetupReview(createConfig({
                selectedLibraryIds: ['shows'],
            }));

            expect(preview).toEqual(expect.objectContaining({
                status: 'blocked',
                message: '',
                failureReason: 'timeout',
                warnings: ['timed out during genre scan'],
            }));
            expect(review.preview).toEqual(expect.objectContaining({
                status: 'blocked',
                message: '',
                failureReason: 'timeout',
                warnings: ['timed out during genre scan'],
            }));
        } finally {
            loadSnapshotSpy.mockRestore();
        }
    });
});
