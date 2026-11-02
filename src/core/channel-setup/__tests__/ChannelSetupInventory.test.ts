/** @jest-environment jsdom */

import { ChannelSetupInventoryOwner } from '../planning/ChannelSetupInventory';
import { ChannelSetupFacetSnapshotLoader } from '../planning/ChannelSetupFacetSnapshotLoader';
import type { ChannelSetupFacetSnapshot } from '../planning/ChannelSetupPlanningTypes';
import type { ChannelSetupConfig } from '../types';
import type { IPlexLibrary, PlexLibrarySection } from '../../../modules/plex/library';

const config = (): ChannelSetupConfig => ({
    serverId: 's1', selectedLibraryIds: ['a', 'b'], maxChannels: 20, buildMode: 'replace',
    strategyConfig: {
        collections: { enabled: false, priority: 1, scope: 'per-library' },
        playlists: { enabled: false, priority: 2, scope: 'per-library' },
        genres: { enabled: true, priority: 3, scope: 'per-library' },
        directors: { enabled: false, priority: 4, scope: 'per-library' },
        decades: { enabled: false, priority: 5, scope: 'per-library' },
        recentlyAdded: { enabled: true, priority: 6, scope: 'per-library' },
        studios: { enabled: false, priority: 7, scope: 'per-library' },
        actors: { enabled: false, priority: 8, scope: 'per-library' },
    }, actorStudioCombineMode: 'separate', minItemsPerChannel: 1,
});

const libraries = [
    { id: 'a', title: 'A', type: 'movie', contentCount: 4 },
    { id: 'b', title: 'B', type: 'show', contentCount: 5 },
] as PlexLibrarySection[];

const ready = { status: 'ready', hasTransientLoadFailure: false } as ChannelSetupFacetSnapshot;
const failed = { status: 'blocked', failureReason: 'error', message: 'Required genres failed' } as ChannelSetupFacetSnapshot;

describe('per-library setup inventory', () => {
    afterEach(() => jest.restoreAllMocks());

    it('keeps a ready library while retrying only a failed library', async () => {
        const calls: string[] = [];
        let bReady = false;
        jest.spyOn(ChannelSetupFacetSnapshotLoader.prototype, 'loadSnapshot').mockImplementation(async (choices) => {
            const id = choices.selectedLibraryIds[0] ?? '';
            calls.push(id);
            return id === 'a' || bReady ? ready : failed;
        });
        const owner = new ChannelSetupInventoryOwner({} as IPlexLibrary);
        const first = await owner.scan('scope-1', config(), libraries);
        expect(first.libraries.map((fact) => [fact.libraryId, fact.status])).toEqual([
            ['a', 'ready'], ['b', 'failed'],
        ]);
        expect(first.acceptedReadyLibraryIds).toEqual(['a']);
        expect(first.libraries[0]?.requiredFamilies).toEqual(['genres', 'recentlyAdded']);
        await owner.scan('scope-1', config(), libraries);
        expect(calls).toEqual(['a', 'b', 'b']);

        bReady = true;
        owner.retry('b');
        const retried = await owner.scan('scope-1', config(), libraries);
        expect(retried.acceptedReadyLibraryIds).toEqual(['a', 'b']);
        expect(calls.filter((id) => id === 'a')).toHaveLength(1);
    });

    it('loads one shared playlist fact for multiple libraries and retains it across local retry', async () => {
        const calls: string[] = [];
        const shared = { ...ready, playlists: [{ ratingKey: 'p1', key: '/p1', title: 'Shared',
            thumb: null, duration: 0, leafCount: 2 }] } as ChannelSetupFacetSnapshot;
        jest.spyOn(ChannelSetupFacetSnapshotLoader.prototype, 'loadSnapshot').mockImplementation(async (choices) => {
            const id = choices.selectedLibraryIds[0] ?? 'shared';
            calls.push(id);
            return id === 'shared' ? shared : ready;
        });
        const owner = new ChannelSetupInventoryOwner({} as IPlexLibrary);
        const choices = config();
        choices.strategyConfig.playlists.enabled = true;
        const first = await owner.scan('scope-1', choices, libraries);
        expect(first.sharedPlaylistsStatus).toBe('ready');
        expect(first.acceptedReadyLibraryIds).toEqual(['a', 'b']);
        expect(owner.getSharedPlaylistSnapshot()).toBe(shared);
        await owner.scan('scope-1', choices, libraries);
        owner.retry('a');
        await owner.scan('scope-1', choices, libraries);
        expect(calls).toEqual(['shared', 'a', 'b', 'a']);
    });

    it('fetches the actual server playlist catalog once for a two-library scan', async () => {
        const getPlaylists = jest.fn().mockResolvedValue([{ ratingKey: 'p1', key: '/p1',
            title: 'Shared', thumb: null, duration: 0, leafCount: 2 }]);
        const owner = new ChannelSetupInventoryOwner({ getPlaylists } as unknown as IPlexLibrary);
        const choices = config();
        for (const strategy of Object.values(choices.strategyConfig)) strategy.enabled = false;
        choices.strategyConfig.playlists.enabled = true;

        const first = await owner.scan('scope-1', choices, libraries);
        const second = await owner.scan('scope-1', choices, libraries);
        expect(first.acceptedReadyLibraryIds).toEqual(['a', 'b']);
        expect(second.sharedPlaylistsStatus).toBe('ready');
        expect(owner.getSharedPlaylistSnapshot()?.playlists.map((playlist) => playlist.ratingKey)).toEqual(['p1']);
        expect(getPlaylists).toHaveBeenCalledTimes(1);
    });

    it('blocks all playlist-using libraries on failed shared evidence and retries that one fact', async () => {
        let sharedReady = false;
        const calls: string[] = [];
        jest.spyOn(ChannelSetupFacetSnapshotLoader.prototype, 'loadSnapshot').mockImplementation(async (choices) => {
            const id = choices.selectedLibraryIds[0] ?? 'shared';
            calls.push(id);
            return id === 'shared' && !sharedReady ? failed : ready;
        });
        const owner = new ChannelSetupInventoryOwner({} as IPlexLibrary);
        const choices = config();
        choices.strategyConfig.playlists.enabled = true;
        const first = await owner.scan('scope-1', choices, libraries);
        expect(first.sharedPlaylistsStatus).toBe('failed');
        expect(first.acceptedReadyLibraryIds).toEqual([]);
        expect(owner.getSharedPlaylistSnapshot()).toBeNull();
        sharedReady = true;
        owner.retry('a');
        const retried = await owner.scan('scope-1', choices, libraries);
        expect(retried.sharedPlaylistsStatus).toBe('ready');
        expect(retried.acceptedReadyLibraryIds).toEqual(['a', 'b']);
        expect(calls.filter((id) => id === 'shared')).toHaveLength(2);
    });

    it('lets one of two shared-playlist callers cancel without aborting the common producer', async () => {
        let finishShared: ((snapshot: ChannelSetupFacetSnapshot) => void) | undefined;
        let producerSignal: AbortSignal | null | undefined;
        jest.spyOn(ChannelSetupFacetSnapshotLoader.prototype, 'loadSnapshot').mockImplementation((choices, _libraries,
            _intent, options) => {
            if (choices.selectedLibraryIds.length > 0) return Promise.resolve(ready);
            producerSignal = options.signal;
            return new Promise((resolve) => { finishShared = resolve; });
        });
        const owner = new ChannelSetupInventoryOwner({} as IPlexLibrary);
        const choices = config();
        choices.strategyConfig.playlists.enabled = true;
        const firstController = new AbortController();
        const first = owner.scan('scope-1', choices, libraries, firstController.signal);
        const second = owner.scan('scope-1', choices, libraries);
        firstController.abort();
        const canceled = await first;
        expect(canceled.sharedPlaylistsStatus).toBe('canceled');
        expect(canceled.acceptedReadyLibraryIds).toEqual([]);
        expect(producerSignal?.aborted).toBe(false);

        finishShared?.({ ...ready, playlists: [] } as ChannelSetupFacetSnapshot);
        const completed = await second;
        expect(completed.sharedPlaylistsStatus).toBe('ready');
        expect(completed.acceptedReadyLibraryIds).toEqual(['a', 'b']);
    });

    it('aborts the shared producer when its final caller leaves and projects cancellation', async () => {
        let producerSignal: AbortSignal | null | undefined;
        jest.spyOn(ChannelSetupFacetSnapshotLoader.prototype, 'loadSnapshot').mockImplementation((choices, _libraries,
            _intent, options) => {
            if (choices.selectedLibraryIds.length > 0) return Promise.resolve(ready);
            producerSignal = options.signal;
            return new Promise((_resolve, reject) => {
                options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
            });
        });
        const owner = new ChannelSetupInventoryOwner({} as IPlexLibrary);
        const choices = config();
        choices.strategyConfig.playlists.enabled = true;
        const controller = new AbortController();
        const scan = owner.scan('scope-1', choices, libraries, controller.signal);
        controller.abort();

        const canceled = await scan;
        expect(producerSignal?.aborted).toBe(true);
        expect(canceled.sharedPlaylistsStatus).toBe('canceled');
        expect(owner.getSharedPlaylistSnapshot()).toBeNull();
    });

    it.each(['canceled', 'failed'] as const)(
        'aborts a rescan after %s shared evidence and ignores both late results', async (firstOutcome) => {
            const finishShared: Array<(snapshot: ChannelSetupFacetSnapshot) => void> = [];
            const producerSignals: AbortSignal[] = [];
            jest.spyOn(ChannelSetupFacetSnapshotLoader.prototype, 'loadSnapshot').mockImplementation((choices,
                _libraries, _intent, options) => {
                if (choices.selectedLibraryIds.length > 0) return Promise.resolve(ready);
                producerSignals.push(options.signal!);
                if (producerSignals.length === 3) return Promise.resolve(ready);
                return new Promise((resolve) => { finishShared.push(resolve); });
            });
            const owner = new ChannelSetupInventoryOwner({} as IPlexLibrary);
            const choices = config();
            choices.strategyConfig.playlists.enabled = true;
            const firstController = new AbortController();
            const first = owner.scan('scope-1', choices, libraries, firstController.signal);
            if (firstOutcome === 'canceled') firstController.abort();
            else finishShared[0]?.(failed);
            expect((await first).sharedPlaylistsStatus).toBe(firstOutcome);

            const secondController = new AbortController();
            const progress: string[] = [];
            const second = owner.scan('scope-1', choices, libraries, secondController.signal,
                (inventory) => { progress.push(inventory.sharedPlaylistsStatus); });
            expect(progress.at(-1)).toBe('pending');
            secondController.abort();
            expect((await second).sharedPlaylistsStatus).toBe('canceled');
            expect(producerSignals[1]?.aborted).toBe(true);

            const replacement = await owner.scan('scope-1', choices, libraries);
            expect(replacement.sharedPlaylistsStatus).toBe('ready');
            finishShared[1]?.(failed);
            if (firstOutcome === 'canceled') finishShared[0]?.(failed);
            await Promise.resolve();
            expect(owner.getSharedPlaylistSnapshot()?.status).toBe('ready');
            expect((await owner.scan('scope-1', choices, libraries)).acceptedReadyLibraryIds).toEqual(['a', 'b']);
        }
    );

    it('ignores an old shared result that settles after retry publishes replacement-ready facts', async () => {
        let finishOld: ((snapshot: ChannelSetupFacetSnapshot) => void) | undefined;
        let sharedCalls = 0;
        jest.spyOn(ChannelSetupFacetSnapshotLoader.prototype, 'loadSnapshot').mockImplementation((choices) => {
            if (choices.selectedLibraryIds.length > 0) return Promise.resolve(ready);
            sharedCalls++;
            return sharedCalls === 1
                ? new Promise((resolve) => { finishOld = resolve; })
                : Promise.resolve({ ...ready, playlists: [] } as ChannelSetupFacetSnapshot);
        });
        const owner = new ChannelSetupInventoryOwner({} as IPlexLibrary);
        const choices = config();
        choices.strategyConfig.playlists.enabled = true;
        const staleOutcome = owner.scan('scope-1', choices, libraries).catch((error: unknown) => error);
        owner.retry('a');
        const replacement = await owner.scan('scope-1', choices, libraries);
        expect(replacement.sharedPlaylistsStatus).toBe('ready');
        finishOld?.(failed);
        await expect(staleOutcome).resolves.toMatchObject({ name: 'AbortError' });
        expect(owner.getSharedPlaylistSnapshot()?.status).toBe('ready');
        expect((await owner.scan('scope-1', choices, libraries)).acceptedReadyLibraryIds).toEqual(['a', 'b']);
    });

    it('does not publish an old scope after a new server scope starts', async () => {
        let finishOld: ((snapshot: ChannelSetupFacetSnapshot) => void) | undefined;
        jest.spyOn(ChannelSetupFacetSnapshotLoader.prototype, 'loadSnapshot').mockImplementation((choices) => {
            if (choices.serverId === 's1') {
                return new Promise((resolve) => { finishOld = resolve; });
            }
            return Promise.resolve(ready);
        });
        const owner = new ChannelSetupInventoryOwner({} as IPlexLibrary);
        const stale = owner.scan('scope-1', config(), libraries.slice(0, 1));
        const newConfig = { ...config(), serverId: 's2' };
        const current = await owner.scan('scope-2', newConfig, libraries.slice(0, 1));
        expect(current.scopeKey).toBe('scope-2');
        finishOld?.(ready);
        await expect(stale).rejects.toMatchObject({ name: 'AbortError' });
        expect(owner.getSnapshot(libraries[0]!, newConfig)).toBe(ready);
    });

    it('does not present a newer strategy snapshot as ready to an older accepted scan', async () => {
        let finishOld: ((snapshot: ChannelSetupFacetSnapshot) => void) | undefined;
        jest.spyOn(ChannelSetupFacetSnapshotLoader.prototype, 'loadSnapshot').mockImplementation((choices) => {
            return choices.strategyConfig.genres.enabled
                ? new Promise((resolve) => { finishOld = resolve; }) : Promise.resolve(ready);
        });
        const owner = new ChannelSetupInventoryOwner({} as IPlexLibrary);
        const oldChoices = { ...config(), selectedLibraryIds: ['a'] };
        const oldScan = owner.scan('scope-1', oldChoices, libraries);
        const newChoices = config();
        newChoices.selectedLibraryIds = ['a'];
        newChoices.strategyConfig.genres.enabled = false;
        const current = await owner.scan('scope-1', newChoices, libraries);
        finishOld?.(ready);
        const stale = await oldScan;
        expect(current.acceptedReadyLibraryIds).toEqual(['a']);
        expect(stale.acceptedReadyLibraryIds).toEqual([]);
        expect(owner.getSnapshot(libraries[0]!, oldChoices)).toBeNull();
    });

    it('cancels only the departing caller while a coalesced scan can finish', async () => {
        let finish: ((snapshot: ChannelSetupFacetSnapshot) => void) | undefined;
        const load = jest.spyOn(ChannelSetupFacetSnapshotLoader.prototype, 'loadSnapshot')
            .mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
        const owner = new ChannelSetupInventoryOwner({} as IPlexLibrary);
        const oneLibrary = { ...config(), selectedLibraryIds: ['a'] };
        const controller = new AbortController();
        const canceled = owner.scan('scope-1', oneLibrary, libraries, controller.signal);
        const retained = owner.scan('scope-1', oneLibrary, libraries);
        controller.abort();
        const canceledFacts = await canceled;
        expect(canceledFacts.libraries[0]?.status).toBe('canceled');
        finish?.(ready);
        const completed = await retained;
        expect(completed.acceptedReadyLibraryIds).toEqual(['a']);
        expect(load).toHaveBeenCalledTimes(1);
    });

    it('does not invalidate an unrelated in-flight library when one library is retried', async () => {
        let finishB: ((snapshot: ChannelSetupFacetSnapshot) => void) | undefined;
        jest.spyOn(ChannelSetupFacetSnapshotLoader.prototype, 'loadSnapshot').mockImplementation((choices) => {
            if (choices.selectedLibraryIds[0] === 'b') {
                return new Promise((resolve) => { finishB = resolve; });
            }
            return Promise.resolve(ready);
        });
        const owner = new ChannelSetupInventoryOwner({} as IPlexLibrary);
        const scanning = owner.scan('scope-1', config(), libraries);
        await Promise.resolve();
        owner.retry('a');
        finishB?.(ready);
        const result = await scanning;
        expect(result.libraries.find((fact) => fact.libraryId === 'b')?.status).toBe('ready');
        expect(owner.getSnapshot(libraries[1]!, config())).toBe(ready);
    });
});
