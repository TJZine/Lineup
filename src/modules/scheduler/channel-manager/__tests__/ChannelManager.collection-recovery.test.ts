import { AppErrorCode } from '../../../../types/app-errors';
import { PlexLibraryError } from '../../../plex/library';
import {
    installMockLocalStorage,
    mockLocalStorage,
    resetMockLocalStorage,
    restoreOriginalLocalStorage,
} from '../../../../__tests__/mocks/localStorage';
import { STORAGE_KEY } from '../constants';
import { ChannelManager } from '../ChannelManager';
import {
    createDeferred,
    expectConsoleWarn,
    flushPromises,
} from '../../../../__tests__/helpers';
import type { IPlexLibraryMinimal } from '../contracts/interfaces';
import type { ResolvedContentItem } from '../contracts/types';
import {
    createMockLibrary,
    createMockItem,
} from './channel-manager-test-helpers';

installMockLocalStorage();

function createResolvedItem(ratingKey: string): ResolvedContentItem {
    return {
        ratingKey,
        type: 'movie',
        title: `Item ${ratingKey}`,
        fullTitle: `Item ${ratingKey}`,
        durationMs: 1_000,
        thumb: null,
        year: 2026,
        scheduledIndex: 0,
    };
}

function missingCollectionError(): PlexLibraryError {
    return new PlexLibraryError(
        AppErrorCode.RESOURCE_NOT_FOUND,
        'Plex resource not found',
        404
    );
}

describe('ChannelManager collection reference recovery', () => {
    let mockLibrary: jest.Mocked<IPlexLibraryMinimal>;
    let manager: ChannelManager;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        resetMockLocalStorage();
        mockLibrary = createMockLibrary();
        manager = new ChannelManager({ plexLibrary: mockLibrary });
    });

    afterEach(() => {
        manager.dispose();
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    afterAll(() => {
        restoreOriginalLocalStorage();
    });

    async function createPersistedCollectionChannel(): Promise<ReturnType<ChannelManager['getChannel']> extends infer T ? Exclude<T, null> : never> {
        const channel = await manager.createChannel(
            {
                name: 'Recovered Collection',
                sourceLibraryId: 'library-1',
                contentSource: {
                    type: 'collection',
                    collectionKey: 'old-key',
                    collectionName: 'Daily Collection',
                },
            },
            { initialContent: [createResolvedItem('initial')] }
        );
        await manager.flushSaves();
        return channel;
    }

    it('repairs one exact same-library replacement and persists it before returning content', async () => {
        const channel = await createPersistedCollectionChannel();
        const updatedEvents: unknown[] = [];
        manager.on('channelUpdated', (updated) => updatedEvents.push(updated));
        mockLibrary.getCollectionItems.mockImplementation(async (key) => {
            if (key === 'old-key') throw missingCollectionError();
            return [createMockItem({ ratingKey: 'replacement-item' })];
        });
        mockLibrary.getCollections.mockResolvedValue([{
            ratingKey: 'new-key',
            key: '/library/collections/new-key',
            title: 'Daily Collection',
            thumb: null,
            childCount: 67,
        }]);

        const resolved = await manager.refreshChannelContent(channel.id);
        const current = manager.getChannel(channel.id);
        const persisted = JSON.parse(mockLocalStorage.getItem(STORAGE_KEY) ?? '{}') as {
            channels?: Array<{ id: string; contentSource?: { collectionKey?: string } }>;
        };

        expect(resolved.items).toHaveLength(1);
        expect(current?.contentSource).toMatchObject({
            type: 'collection',
            collectionKey: 'new-key',
            collectionName: 'Daily Collection',
        });
        expect(persisted.channels?.find((candidate) => candidate.id === channel.id)?.contentSource)
            .toMatchObject({ collectionKey: 'new-key' });
        expect(updatedEvents).toHaveLength(1);

        manager.clearRuntimeState();
        await manager.loadChannels();
        expect(manager.getChannel(channel.id)?.contentSource).toMatchObject({ collectionKey: 'new-key' });
    });

    it('refuses repair when the old key is still present in the complete listing', async () => {
        const channel = await createPersistedCollectionChannel();
        mockLibrary.getCollectionItems.mockRejectedValue(missingCollectionError());
        mockLibrary.getCollections.mockResolvedValue([
            {
                ratingKey: 'old-key',
                key: '/library/collections/old-key',
                title: 'Daily Collection',
                thumb: null,
                childCount: 67,
            },
            {
                ratingKey: 'new-key',
                key: '/library/collections/new-key',
                title: 'Daily Collection',
                thumb: null,
                childCount: 67,
            },
        ]);

        await expect(manager.refreshChannelContent(channel.id)).rejects.toMatchObject({
            code: AppErrorCode.RESOURCE_NOT_FOUND,
            httpStatus: 404,
        });
        expect(manager.getChannel(channel.id)?.contentSource).toMatchObject({ collectionKey: 'old-key' });
    });

    it('refuses zero or multiple exact-name candidates and missing library metadata', async () => {
        const channel = await createPersistedCollectionChannel();
        mockLibrary.getCollectionItems.mockRejectedValue(missingCollectionError());

        for (const collections of [
            [],
            [
                {
                    ratingKey: 'new-key-1',
                    key: '/library/collections/new-key-1',
                    title: 'Daily Collection',
                    thumb: null,
                    childCount: 67,
                },
                {
                    ratingKey: 'new-key-2',
                    key: '/library/collections/new-key-2',
                    title: 'Daily Collection',
                    thumb: null,
                    childCount: 67,
                },
            ],
        ]) {
            mockLibrary.getCollections.mockResolvedValue(collections);
            await expect(manager.refreshChannelContent(channel.id)).rejects.toMatchObject({
                code: AppErrorCode.RESOURCE_NOT_FOUND,
                httpStatus: 404,
            });
            expect(manager.getChannel(channel.id)?.contentSource).toMatchObject({ collectionKey: 'old-key' });
        }

        const withoutLibrary = await manager.createChannel(
            {
                contentSource: {
                    type: 'collection',
                    collectionKey: 'old-key-2',
                    collectionName: 'Daily Collection',
                },
            },
            { initialContent: [createResolvedItem('initial-2')] }
        );
        mockLibrary.getCollectionItems.mockRejectedValue(missingCollectionError());
        await expect(manager.refreshChannelContent(withoutLibrary.id)).rejects.toMatchObject({
            code: AppErrorCode.RESOURCE_NOT_FOUND,
            httpStatus: 404,
        });
        expect(mockLibrary.getCollections).toHaveBeenCalledTimes(2);
    });

    it('keeps the old reference when the replacement resolves empty', async () => {
        const channel = await createPersistedCollectionChannel();
        mockLibrary.getCollectionItems.mockImplementation(async (key) => {
            if (key === 'old-key') throw missingCollectionError();
            return [];
        });
        mockLibrary.getCollections.mockResolvedValue([{
            ratingKey: 'new-key',
            key: '/library/collections/new-key',
            title: 'Daily Collection',
            thumb: null,
            childCount: 67,
        }]);

        await expect(manager.refreshChannelContent(channel.id)).rejects.toMatchObject({
            code: AppErrorCode.CONTENT_UNAVAILABLE,
        });
        expect(manager.getChannel(channel.id)?.contentSource).toMatchObject({ collectionKey: 'old-key' });
    });

    it('does not repair or persist a missing collection during schedule-only resolution', async () => {
        const channel = await createPersistedCollectionChannel();
        const persistedBefore = mockLocalStorage.getItem(STORAGE_KEY);
        const updatedEvents: unknown[] = [];
        manager.on('channelUpdated', (updated) => updatedEvents.push(updated));
        mockLibrary.getCollectionItems.mockRejectedValue(missingCollectionError());
        mockLibrary.getCollections.mockResolvedValue([{
            ratingKey: 'new-key',
            key: '/library/collections/new-key',
            title: 'Daily Collection',
            thumb: null,
            childCount: 67,
        }]);

        await expect(manager.resolveChannelItemsForSchedule(channel.id, { cacheMode: 'revalidate' }))
            .rejects.toMatchObject({ code: AppErrorCode.RESOURCE_NOT_FOUND, httpStatus: 404 });
        expect(mockLibrary.getCollections).not.toHaveBeenCalled();
        expect(manager.getChannel(channel.id)?.contentSource).toMatchObject({ collectionKey: 'old-key' });
        expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(persistedBefore);
        expect(updatedEvents).toHaveLength(0);
    });

    it('keeps valid mixed-source children when a direct collection child is confirmed missing', async () => {
        const channel = await manager.createChannel(
            {
                contentSource: {
                    type: 'mixed',
                    mixMode: 'sequential',
                    sources: [
                        {
                            type: 'library',
                            libraryId: 'library-1',
                            libraryType: 'movie',
                            includeWatched: true,
                        },
                        {
                            type: 'collection',
                            collectionKey: 'missing-child',
                            collectionName: 'Missing Child',
                        },
                    ],
                },
            },
            { initialContent: [createResolvedItem('initial-mixed')] }
        );
        mockLibrary.getLibraryItems.mockResolvedValue([createMockItem({ ratingKey: 'library-item' })]);
        mockLibrary.getCollectionItems.mockRejectedValue(missingCollectionError());

        const resolved = await manager.refreshChannelContent(channel.id);

        expect(resolved.items).toHaveLength(1);
        expect(resolved.items[0]?.ratingKey).toBe('library-item');
        expect(mockLibrary.getCollections).not.toHaveBeenCalled();
    });

    it('does not swallow access denial from a mixed-source collection child', async () => {
        const channel = await manager.createChannel(
            {
                contentSource: {
                    type: 'mixed',
                    mixMode: 'sequential',
                    sources: [
                        {
                            type: 'library',
                            libraryId: 'library-1',
                            libraryType: 'movie',
                            includeWatched: true,
                        },
                        {
                            type: 'collection',
                            collectionKey: 'forbidden-child',
                            collectionName: 'Forbidden Child',
                        },
                    ],
                },
            },
            { initialContent: [createResolvedItem('initial-forbidden')] }
        );
        mockLibrary.getLibraryItems.mockResolvedValue([createMockItem({ ratingKey: 'library-item' })]);
        mockLibrary.getCollectionItems.mockRejectedValue(new PlexLibraryError(
            AppErrorCode.ACCESS_DENIED,
            'Access denied',
            403
        ));
        expectConsoleWarn([
            'Access denied resolving channel content',
            expect.objectContaining({ httpStatus: 403 }),
        ]);

        await expect(manager.refreshChannelContent(channel.id)).rejects.toMatchObject({
            code: AppErrorCode.ACCESS_DENIED,
        });
    });

    it('leaves memory, persistence, and success events unchanged when repair persistence fails', async () => {
        const channel = await createPersistedCollectionChannel();
        const updatedEvents: unknown[] = [];
        manager.on('channelUpdated', (updated) => updatedEvents.push(updated));
        const persistedBefore = mockLocalStorage.getItem(STORAGE_KEY);
        mockLibrary.getCollectionItems.mockImplementation(async (key) => {
            if (key === 'old-key') throw missingCollectionError();
            return [createMockItem({ ratingKey: 'replacement-item' })];
        });
        mockLibrary.getCollections.mockResolvedValue([{
            ratingKey: 'new-key',
            key: '/library/collections/new-key',
            title: 'Daily Collection',
            thumb: null,
            childCount: 67,
        }]);
        mockLocalStorage.setItem.mockImplementation(() => {
            throw new DOMException('quota', 'QuotaExceededError');
        });
        expectConsoleWarn([
            expect.stringContaining('ChannelManager collection recovery failed to persist channel'),
            expect.objectContaining({ code: AppErrorCode.STORAGE_QUOTA_EXCEEDED }),
        ]);

        await expect(manager.refreshChannelContent(channel.id)).rejects.toMatchObject({
            code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
        });
        expect(manager.getChannel(channel.id)?.contentSource).toMatchObject({ collectionKey: 'old-key' });
        expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(persistedBefore);
        expect(updatedEvents).toHaveLength(0);
    });

    it('supersedes a same-channel consumer that is still resolving the old key', async () => {
        const channel = await createPersistedCollectionChannel();
        let rejectOld!: (error: unknown) => void;
        const oldItems = new Promise<never>((_resolve, reject) => {
            rejectOld = reject;
        });
        let resolveCollections!: (collections: Array<{
            ratingKey: string;
            key: string;
            title: string;
            thumb: null;
            childCount: number;
        }>) => void;
        const collections = new Promise<Array<{
            ratingKey: string;
            key: string;
            title: string;
            thumb: null;
            childCount: number;
        }>>((resolve) => {
            resolveCollections = resolve;
        });
        mockLibrary.getCollectionItems.mockImplementation((key) => {
            if (key === 'old-key') return oldItems;
            return Promise.resolve([createMockItem({ ratingKey: 'replacement-item' })]);
        });
        mockLibrary.getCollections.mockReturnValue(collections);

        const first = manager.resolveChannelContent(channel.id, { cacheMode: 'revalidate' });
        await Promise.resolve();
        const second = manager.resolveChannelContent(channel.id, { cacheMode: 'revalidate' });
        rejectOld(missingCollectionError());
        resolveCollections([{
            ratingKey: 'new-key',
            key: '/library/collections/new-key',
            title: 'Daily Collection',
            thumb: null,
            childCount: 67,
        }]);

        const results = await Promise.allSettled([first, second]);
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
        const rejected = results.find((result) => result.status === 'rejected');
        expect(rejected).toMatchObject({
            status: 'rejected',
            reason: expect.objectContaining({ name: 'AbortError' }),
        });
        expect(manager.getChannel(channel.id)?.contentSource).toMatchObject({ collectionKey: 'new-key' });
    });

    it('keeps a queued old snapshot pending when recovery persistence fails', async () => {
        const channel = await createPersistedCollectionChannel();
        await manager.reorderChannels([channel.id]);
        expect(jest.getTimerCount()).toBeGreaterThan(0);

        mockLibrary.getCollectionItems.mockImplementation(async (key) => {
            if (key === 'old-key') throw missingCollectionError();
            return [createMockItem({ ratingKey: 'replacement-item' })];
        });
        mockLibrary.getCollections.mockResolvedValue([{
            ratingKey: 'new-key',
            key: '/library/collections/new-key',
            title: 'Daily Collection',
            thumb: null,
            childCount: 67,
        }]);
        mockLocalStorage.setItem.mockImplementation(() => {
            throw new DOMException('quota', 'QuotaExceededError');
        });
        expectConsoleWarn([
            expect.stringContaining('ChannelManager collection recovery failed to persist channel'),
            expect.objectContaining({ code: AppErrorCode.STORAGE_QUOTA_EXCEEDED }),
        ]);

        await expect(manager.refreshChannelContent(channel.id)).rejects.toMatchObject({
            code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
        });
        expect(manager.getChannel(channel.id)?.contentSource).toMatchObject({ collectionKey: 'old-key' });
        expect(JSON.parse(mockLocalStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual(
            expect.objectContaining({
                channels: [expect.objectContaining({
                    id: channel.id,
                    contentSource: expect.objectContaining({ collectionKey: 'old-key' }),
                })],
            })
        );
    });

    it('preserves an unrelated queued channel edit when recovery persistence succeeds', async () => {
        const channel = await createPersistedCollectionChannel();
        const other = await manager.createChannel(
            {
                name: 'Other Channel',
                contentSource: {
                    type: 'manual',
                    items: [{ ratingKey: 'other', title: 'Other', durationMs: 1_000 }],
                },
            },
            { initialContent: [createResolvedItem('other')] }
        );
        await manager.flushSaves();
        await manager.updateChannel(other.id, { name: 'Pending Rename' });
        expect(jest.getTimerCount()).toBeGreaterThan(0);

        mockLibrary.getCollectionItems.mockImplementation(async (key) => {
            if (key === 'old-key') throw missingCollectionError();
            return [createMockItem({ ratingKey: 'replacement-item' })];
        });
        mockLibrary.getCollections.mockResolvedValue([{
            ratingKey: 'new-key',
            key: '/library/collections/new-key',
            title: 'Daily Collection',
            thumb: null,
            childCount: 67,
        }]);

        await manager.refreshChannelContent(channel.id);
        await manager.flushSaves();

        const persisted = JSON.parse(mockLocalStorage.getItem(STORAGE_KEY) ?? '{}') as {
            channels?: Array<{ id: string; name?: string; contentSource?: { collectionKey?: string } }>;
        };
        expect(persisted.channels).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: other.id, name: 'Pending Rename' }),
            expect.objectContaining({
                id: channel.id,
                contentSource: expect.objectContaining({ collectionKey: 'new-key' }),
            }),
        ]));
    });

    it('aborts recovery without stale publication when the channel is edited during candidate lookup', async () => {
        const channel = await createPersistedCollectionChannel();
        const collections = createDeferred<Array<{
            ratingKey: string;
            key: string;
            title: string;
            thumb: null;
            childCount: number;
        }>>();
        const updatedEvents: Array<{ contentSource: { type: string; collectionKey?: string } }> = [];
        manager.on('channelUpdated', (updated) => updatedEvents.push(updated));
        mockLibrary.getCollectionItems.mockImplementation((key) => {
            if (key === 'old-key') return Promise.reject(missingCollectionError());
            return Promise.resolve([createMockItem({ ratingKey: 'edited-item' })]);
        });
        mockLibrary.getCollections.mockReturnValue(collections.promise);

        const staleResolution = manager.resolveChannelContent(channel.id, { cacheMode: 'revalidate' });
        await flushPromises(30);
        expect(mockLibrary.getCollections).toHaveBeenCalledTimes(1);

        const edited = await manager.updateChannel(channel.id, {
            contentSource: {
                type: 'collection',
                collectionKey: 'edited-key',
                collectionName: 'Edited Collection',
            },
        });
        collections.resolve([{
            ratingKey: 'new-key',
            key: '/library/collections/new-key',
            title: 'Daily Collection',
            thumb: null,
            childCount: 67,
        }]);

        await expect(staleResolution).rejects.toMatchObject({ name: 'AbortError' });
        expect(edited.contentSource).toMatchObject({ collectionKey: 'edited-key' });
        expect(manager.getChannel(channel.id)?.contentSource).toMatchObject({ collectionKey: 'edited-key' });
        expect(updatedEvents).toHaveLength(1);
        expect(updatedEvents[0]?.contentSource).toMatchObject({ collectionKey: 'edited-key' });
    });

    it('aborts recovery without stale publication when the channel is deleted during candidate lookup', async () => {
        const channel = await createPersistedCollectionChannel();
        const collections = createDeferred<Array<{
            ratingKey: string;
            key: string;
            title: string;
            thumb: null;
            childCount: number;
        }>>();
        const updatedEvents: unknown[] = [];
        manager.on('channelUpdated', (updated) => updatedEvents.push(updated));
        mockLibrary.getCollectionItems.mockRejectedValue(missingCollectionError());
        mockLibrary.getCollections.mockReturnValue(collections.promise);

        const staleResolution = manager.resolveChannelContent(channel.id, { cacheMode: 'revalidate' });
        await flushPromises(30);
        await manager.deleteChannel(channel.id);
        collections.resolve([{
            ratingKey: 'new-key',
            key: '/library/collections/new-key',
            title: 'Daily Collection',
            thumb: null,
            childCount: 67,
        }]);

        await expect(staleResolution).rejects.toMatchObject({ name: 'AbortError' });
        expect(manager.getChannel(channel.id)).toBeNull();
        expect(updatedEvents).toHaveLength(0);
    });

    it('stops outer publication when a channelUpdated listener edits the channel', async () => {
        const channel = await createPersistedCollectionChannel();
        const contentEvents: unknown[] = [];
        let handlingEvent = false;
        manager.on('contentResolved', (content) => contentEvents.push(content));
        manager.on('channelUpdated', () => {
            if (handlingEvent) return;
            handlingEvent = true;
            void manager.updateChannel(channel.id, { name: 'Edited in listener' }).catch(() => undefined);
        });
        mockLibrary.getCollectionItems.mockImplementation(async (key) => {
            if (key === 'old-key') throw missingCollectionError();
            return [createMockItem({ ratingKey: 'replacement-item' })];
        });
        mockLibrary.getCollections.mockResolvedValue([{
            ratingKey: 'new-key',
            key: '/library/collections/new-key',
            title: 'Daily Collection',
            thumb: null,
            childCount: 67,
        }]);

        await expect(manager.refreshChannelContent(channel.id)).rejects.toMatchObject({ name: 'AbortError' });
        await flushPromises(4);
        expect(manager.getChannel(channel.id)).toMatchObject({
            name: 'Edited in listener',
            contentSource: { type: 'collection', collectionKey: 'new-key' },
        });
        expect(contentEvents).toHaveLength(0);
        await manager.flushSaves();
        expect(JSON.parse(mockLocalStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual(
            expect.objectContaining({
                channels: [expect.objectContaining({
                    id: channel.id,
                    name: 'Edited in listener',
                    contentSource: expect.objectContaining({ collectionKey: 'new-key' }),
                })],
            })
        );
    });

    it('stops outer publication when a channelUpdated listener deletes the channel', async () => {
        const channel = await createPersistedCollectionChannel();
        const contentEvents: unknown[] = [];
        manager.on('contentResolved', (content) => contentEvents.push(content));
        manager.on('channelUpdated', () => {
            void manager.deleteChannel(channel.id);
        });
        mockLibrary.getCollectionItems.mockImplementation(async (key) => {
            if (key === 'old-key') throw missingCollectionError();
            return [createMockItem({ ratingKey: 'replacement-item' })];
        });
        mockLibrary.getCollections.mockResolvedValue([{
            ratingKey: 'new-key',
            key: '/library/collections/new-key',
            title: 'Daily Collection',
            thumb: null,
            childCount: 67,
        }]);

        await expect(manager.refreshChannelContent(channel.id)).rejects.toMatchObject({ name: 'AbortError' });
        await flushPromises(4);
        expect(manager.getChannel(channel.id)).toBeNull();
        expect(contentEvents).toHaveLength(0);
        await manager.flushSaves();
        expect(JSON.parse(mockLocalStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual(
            expect.objectContaining({ channels: [] })
        );
    });

    it('drains an in-flight recovery producer during scope supersession', async () => {
        const channel = await createPersistedCollectionChannel();
        const collections = createDeferred<Array<{
            ratingKey: string;
            key: string;
            title: string;
            thumb: null;
            childCount: number;
        }>>();
        mockLibrary.getCollectionItems.mockRejectedValue(missingCollectionError());
        mockLibrary.getCollections.mockReturnValue(collections.promise);

        const staleResolution = manager.resolveChannelContent(channel.id, { cacheMode: 'revalidate' });
        await flushPromises(30);
        expect(mockLibrary.getCollections).toHaveBeenCalledTimes(1);
        const drain = manager.supersedeActiveResolutions();
        let drained = false;
        void drain.then(() => {
            drained = true;
        });
        await Promise.resolve();
        expect(drained).toBe(false);

        collections.resolve([]);
        await drain;
        await expect(staleResolution).rejects.toMatchObject({ name: 'AbortError' });
        manager.resumeActiveResolutions();
    });

    it('allows the authorized initial tune to recover while general admission is suspended', async () => {
        const channel = await createPersistedCollectionChannel();
        await manager.supersedeActiveResolutions();
        mockLibrary.getCollectionItems.mockImplementation(async (key) => {
            if (key === 'old-key') throw missingCollectionError();
            return [createMockItem({ ratingKey: 'replacement-item' })];
        });
        mockLibrary.getCollections.mockResolvedValue([{
            ratingKey: 'new-key',
            key: '/library/collections/new-key',
            title: 'Daily Collection',
            thumb: null,
            childCount: 67,
        }]);
        const authorization = manager.createInitialTuneResolutionAuthorization(
            channel.id,
            { assertCurrent: jest.fn() }
        );

        const resolved = await manager.resolveChannelContentForInitialTune(channel.id, authorization);

        expect(resolved.items).toHaveLength(1);
        expect(manager.getChannel(channel.id)?.contentSource).toMatchObject({ collectionKey: 'new-key' });
        manager.resumeActiveResolutions();
    });
});
