import { ChannelManager } from '../ChannelManager';
import type { SourceResolutionDiagnostic } from '../contracts/SourceResolutionDiagnostic';
import type { IPlexLibraryMinimal, PlexMediaItemMinimal } from '../contracts/interfaces';
import type {
    ChannelConfig,
    ChannelContentSource,
    LibraryContentSource,
    MixedContentSource,
} from '../contracts/types';
import {
    installMockLocalStorage,
    resetMockLocalStorage,
    restoreOriginalLocalStorage,
} from '../../../../__tests__/mocks/localStorage';
import {
    createBaseChannel,
    createMockItem,
    createMockLibrary,
} from './channel-manager-test-helpers';

installMockLocalStorage();

type Deferred<T> = {
    promise: Promise<T>;
    resolve(value: T): void;
};

function createDeferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise;
    });
    return { promise, resolve };
}

const sharedSource: LibraryContentSource = {
    type: 'library',
    libraryId: 'shared-library',
    libraryType: 'movie',
    includeWatched: true,
};

function makeChannel(
    id: string,
    number: number,
    contentSource: ChannelContentSource = sharedSource
): ChannelConfig {
    return createBaseChannel({
        id,
        number,
        name: `Channel ${number}`,
        contentSource,
    });
}

describe('ChannelManager shared source lifecycle', () => {
    let library: jest.Mocked<IPlexLibraryMinimal>;
    let manager: ChannelManager;

    beforeEach(async () => {
        resetMockLocalStorage();
        library = createMockLibrary();
        manager = new ChannelManager({ plexLibrary: library });
        await manager.replaceAllChannels([
            makeChannel('channel-a', 1),
            makeChannel('channel-b', 2),
        ]);
    });

    afterEach(async () => {
        await manager.flushSaves().catch(() => undefined);
        manager.dispose();
        jest.restoreAllMocks();
    });

    afterAll(() => {
        restoreOriginalLocalStorage();
    });

    it.each([
        ['channel-a', 'channel-b'],
        ['channel-b', 'channel-a'],
    ])('keeps a shared producer alive when creator %s is canceled and %s still waits', async (
        creatorId,
        joiningId
    ) => {
        const sourceResult = createDeferred<PlexMediaItemMinimal[]>();
        library.getLibraryItems.mockReturnValue(sourceResult.promise);
        const creator = new AbortController();
        const joining = new AbortController();

        const creatorResolution = manager.resolveChannelContent(creatorId, { signal: creator.signal });
        const joiningResolution = manager.resolveChannelContent(joiningId, { signal: joining.signal });
        await Promise.resolve();
        const reason = 'request-replaced';
        creator.abort(reason);
        sourceResult.resolve([createMockItem({ ratingKey: 'shared-result' })]);

        await expect(creatorResolution).rejects.toBe(reason);
        await expect(joiningResolution).resolves.toEqual(expect.objectContaining({
            channelId: joiningId,
            items: [expect.objectContaining({ ratingKey: 'shared-result' })],
        }));
        expect(joining.signal.aborted).toBe(false);
        expect(library.getLibraryItems).toHaveBeenCalledTimes(1);
    });

    it('retires the last-waiter producer and prevents its late result from replacing a newer entry', async () => {
        const obsolete = createDeferred<PlexMediaItemMinimal[]>();
        const current = createDeferred<PlexMediaItemMinimal[]>();
        let obsoleteSignal: AbortSignal | null = null;
        library.getLibraryItems
            .mockImplementationOnce((_id, options) => {
                obsoleteSignal = options?.signal ?? null;
                return obsolete.promise;
            })
            .mockImplementationOnce(() => current.promise);
        const firstCaller = new AbortController();

        const first = manager.resolveChannelContent('channel-a', { signal: firstCaller.signal });
        await Promise.resolve();
        firstCaller.abort('request-replaced');
        await expect(first).rejects.toBe('request-replaced');
        expect((obsoleteSignal as AbortSignal | null)?.aborted).toBe(true);

        const second = manager.resolveChannelContent('channel-b');
        await Promise.resolve();
        current.resolve([createMockItem({ ratingKey: 'current-result' })]);
        await expect(second).resolves.toEqual(expect.objectContaining({
            items: [expect.objectContaining({ ratingKey: 'current-result' })],
        }));

        obsolete.resolve([createMockItem({ ratingKey: 'obsolete-result' })]);
        await Promise.resolve();
        await expect(manager.resolveChannelContent('channel-a')).resolves.toEqual(expect.objectContaining({
            items: [expect.objectContaining({ ratingKey: 'current-result' })],
        }));
        expect(library.getLibraryItems).toHaveBeenCalledTimes(2);
    });

    it('drains a retired producer that ignores abort before a scope transition completes', async () => {
        const sourceResult = createDeferred<PlexMediaItemMinimal[]>();
        library.getLibraryItems.mockReturnValue(sourceResult.promise);
        const resolution = manager.resolveChannelContent('channel-a');
        await Promise.resolve();

        let drained = false;
        const drain = manager.supersedeActiveResolutions().then(() => {
            drained = true;
        });
        await Promise.resolve();
        await Promise.resolve();
        expect(drained).toBe(false);

        sourceResult.resolve([createMockItem({ ratingKey: 'late-result' })]);
        await expect(resolution).rejects.toMatchObject({ name: 'AbortError' });
        await drain;
        expect(drained).toBe(true);
    });

    it('lets a direct child consumer keep a mixed-source child producer alive', async () => {
        const mixedSource: MixedContentSource = {
            type: 'mixed',
            sources: [sharedSource],
            mixMode: 'sequential',
        };
        await manager.replaceAllChannels([
            makeChannel('mixed-channel', 1, mixedSource),
            makeChannel('direct-channel', 2, sharedSource),
        ]);
        const sourceResult = createDeferred<PlexMediaItemMinimal[]>();
        library.getLibraryItems.mockReturnValue(sourceResult.promise);
        const mixedCaller = new AbortController();

        const mixed = manager.resolveChannelContent('mixed-channel', { signal: mixedCaller.signal });
        await Promise.resolve();
        const direct = manager.resolveChannelContent('direct-channel');
        await Promise.resolve();
        mixedCaller.abort('request-replaced');
        sourceResult.resolve([createMockItem({ ratingKey: 'child-result' })]);

        await expect(mixed).rejects.toBe('request-replaced');
        await expect(direct).resolves.toEqual(expect.objectContaining({
            items: [expect.objectContaining({ ratingKey: 'child-result' })],
        }));
        expect(library.getLibraryItems).toHaveBeenCalledTimes(1);
    });

    it('revalidates completed empty caches, coalesces live recovery, and preserves a sibling waiter', async () => {
        library.getLibraryItems.mockResolvedValueOnce([]);
        await expect(manager.resolveChannelContent('channel-a')).rejects.toMatchObject({
            code: 'CONTENT_UNAVAILABLE',
        });
        await expect(manager.resolveChannelContent('channel-b')).rejects.toMatchObject({
            code: 'CONTENT_UNAVAILABLE',
        });
        expect(library.getLibraryItems).toHaveBeenCalledTimes(1);

        const recovered = createDeferred<PlexMediaItemMinimal[]>();
        library.getLibraryItems.mockReturnValueOnce(recovered.promise);
        const firstRetry = new AbortController();
        const retryA = manager.resolveChannelContent('channel-a', {
            signal: firstRetry.signal,
            cacheMode: 'revalidate',
        });
        const retryB = manager.resolveChannelContent('channel-b', { cacheMode: 'revalidate' });
        await Promise.resolve();
        firstRetry.abort('request-replaced');
        recovered.resolve([createMockItem({ ratingKey: 'restored-result' })]);

        await expect(retryA).rejects.toBe('request-replaced');
        await expect(retryB).resolves.toEqual(expect.objectContaining({
            items: [expect.objectContaining({ ratingKey: 'restored-result' })],
        }));
        expect(library.getLibraryItems).toHaveBeenCalledTimes(2);
    });

    it('revalidates completed empty caches recursively through a mixed source', async () => {
        const mixedSource: MixedContentSource = {
            type: 'mixed',
            sources: [sharedSource],
            mixMode: 'sequential',
        };
        await manager.replaceAllChannels([makeChannel('mixed-channel', 1, mixedSource)]);
        library.getLibraryItems
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([createMockItem({ ratingKey: 'restored-mixed-result' })]);
        const diagnostics: SourceResolutionDiagnostic[] = [];

        await expect(manager.resolveChannelContent('mixed-channel')).rejects.toMatchObject({
            code: 'CONTENT_UNAVAILABLE',
        });
        await expect(manager.resolveChannelContent('mixed-channel', {
            cacheMode: 'revalidate',
            onSourceDiagnostic: (event) => diagnostics.push(event),
        })).resolves.toEqual(expect.objectContaining({
            items: [expect.objectContaining({ ratingKey: 'restored-mixed-result' })],
        }));
        expect(library.getLibraryItems).toHaveBeenCalledTimes(2);
        expect(diagnostics.filter((event) => event.event === 'access')).toEqual([
            expect.objectContaining({ access: 'create', cacheMode: 'revalidate' }),
            expect.objectContaining({ access: 'create', cacheMode: 'revalidate' }),
        ]);
        expect(new Set(
            diagnostics
                .filter((event) => event.event === 'access')
                .map((event) => event.producerId)
        ).size).toBe(2);
    });
});
