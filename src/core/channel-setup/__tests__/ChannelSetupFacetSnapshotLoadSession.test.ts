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

const createConfig = (overrides: FacetPlanningConfigOverrides = {}) => createFacetPlanningConfig({
    selectedLibraryIds: ['lib-1'],
    maxChannels: 10,
    minItemsPerChannel: 1,
    ...overrides,
});

const createLibrary = createFacetPlanningLibrary;
const createPlexLibrary = createMockPlexLibrary;

describe('ChannelSetupFacetSnapshotLoadSession', () => {
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
});
