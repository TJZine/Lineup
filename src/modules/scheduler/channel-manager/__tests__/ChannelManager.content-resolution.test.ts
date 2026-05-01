import { ChannelManager } from '../ChannelManager';
import { ContentResolver } from '../ContentResolver';
import type { IPlexLibraryMinimal, PlexMediaItemMinimal } from '../interfaces';
import { expectConsoleWarn } from '../../../../__tests__/helpers';
import {
    installMockLocalStorage,
    resetMockLocalStorage,
    restoreOriginalLocalStorage,
} from '../../../../__tests__/mocks/localStorage';
import {
    createMockContentSource,
    createMockItem,
    createMockLibrary,
    seedDefaultLibrary,
} from './channel-manager-test-helpers';

installMockLocalStorage();

describe('ChannelManager content resolution', () => {
    let mockLibrary: jest.Mocked<IPlexLibraryMinimal>;
    let manager: ChannelManager;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        resetMockLocalStorage();

        mockLibrary = createMockLibrary();
        seedDefaultLibrary(mockLibrary);

        manager = new ChannelManager({ plexLibrary: mockLibrary });
    });

    afterEach(async () => {
        if (manager) {
            await manager.flushSaves().catch(() => undefined);
        }
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    afterAll(() => {
        restoreOriginalLocalStorage();
    });

    describe('happy-path resolution', () => {
        it('should resolve library content source', async () => {
            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });

            const result = await manager.resolveChannelContent(channel.id);

            expect(result.items).toHaveLength(2);
            expect(result.channelId).toBe(channel.id);
        });

        it('should resolve collection content source', async () => {
            mockLibrary.getCollectionItems.mockResolvedValue([createMockItem()]);

            const channel = await manager.createChannel({
                contentSource: {
                    type: 'collection',
                    collectionKey: 'col1',
                    collectionName: 'My Collection',
                },
            });

            const result = await manager.resolveChannelContent(channel.id);
            expect(result.items).toHaveLength(1);
        });

        it('should resolve show content source', async () => {
            mockLibrary.getShowEpisodes.mockResolvedValue([
                createMockItem({ ratingKey: 'ep1', type: 'episode' }),
                createMockItem({ ratingKey: 'ep2', type: 'episode' }),
                createMockItem({ ratingKey: 'ep3', type: 'episode' }),
            ]);

            const channel = await manager.createChannel({
                contentSource: {
                    type: 'show',
                    showKey: 'show1',
                    showName: 'Test Show',
                },
            });

            const result = await manager.resolveChannelContent(channel.id);
            expect(result.items).toHaveLength(3);
        });

        it('should resolve manual content source', async () => {
            mockLibrary.getItem.mockResolvedValue(createMockItem({ ratingKey: 'manual1' }));

            const channel = await manager.createChannel({
                contentSource: {
                    type: 'manual',
                    items: [{ ratingKey: 'manual1', title: 'Manual', durationMs: 1000 }],
                },
            });

            const result = await manager.resolveChannelContent(channel.id);
            expect(result.items.length).toBeGreaterThan(0);
        });

        it('should cache resolved content', async () => {
            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });

            mockLibrary.getLibraryItems.mockClear();

            await manager.resolveChannelContent(channel.id);
            await manager.resolveChannelContent(channel.id);

            expect(mockLibrary.getLibraryItems).toHaveBeenCalledTimes(0);
        });

        it('should force refresh bypasses cache', async () => {
            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });

            mockLibrary.getLibraryItems.mockClear();

            await manager.refreshChannelContent(channel.id);

            expect(mockLibrary.getLibraryItems).toHaveBeenCalledTimes(1);
        });

        it('resolveChannelItemsForSchedule returns deep-cloned cached items', async () => {
            mockLibrary.getLibraryItems.mockResolvedValue([
                {
                    ...createMockItem({
                        ratingKey: 'nested-1',
                        title: 'Nested One',
                        durationMs: 6000,
                    }),
                    genres: ['Drama'],
                    directors: ['Director A'],
                    media: [{
                        videoResolution: '4k',
                        audioCodec: 'aac',
                        audioChannels: 6,
                        parts: [],
                    }],
                } as unknown as PlexMediaItemMinimal,
                {
                    ...createMockItem({
                        ratingKey: 'nested-2',
                        title: 'Nested Two',
                        year: 2025,
                        durationMs: 6000,
                    }),
                    genres: ['Comedy'],
                    directors: ['Director B'],
                    media: [{
                        videoResolution: '1080p',
                        audioCodec: 'ac3',
                        audioChannels: 2,
                        parts: [],
                    }],
                } as unknown as PlexMediaItemMinimal,
            ]);
            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });
            mockLibrary.getLibraryItems.mockClear();

            const first = await manager.resolveChannelItemsForSchedule(channel.id);
            expect(mockLibrary.getLibraryItems).toHaveBeenCalledTimes(0);

            first[0]!.title = 'Mutated Title';
            first[0]!.genres?.push('Mutated Genre');
            first[0]!.directors?.push('Mutated Director');
            if (first[0]!.mediaInfo) {
                first[0]!.mediaInfo.resolution = '240p';
            }

            const second = await manager.resolveChannelItemsForSchedule(channel.id);

            expect(mockLibrary.getLibraryItems).toHaveBeenCalledTimes(0);
            expect(second).not.toBe(first);
            expect(second[0]).not.toBe(first[0]);
            expect(second[0]!.title).toBe('Nested One');
            expect(second[0]!.genres).toEqual(['Drama']);
            expect(second[0]!.directors).toEqual(['Director A']);
            expect(second[0]!.mediaInfo).toEqual({
                resolution: '4K',
                audioCodec: 'aac',
                audioChannels: 6,
            });
        });

        it('does not clear all resolver caches when refreshing a single channel', async () => {
            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });
            const clearCachesSpy = jest.spyOn(ContentResolver.prototype, 'clearCaches');

            await manager.refreshChannelContent(channel.id);

            expect(clearCachesSpy).not.toHaveBeenCalled();
        });

        it('should handle library deleted gracefully', async () => {
            expectConsoleWarn([
                expect.stringContaining('Failed initial content resolution for channel'),
                expect.objectContaining({ message: '404' }),
            ]);
            mockLibrary.getLibraryItems.mockRejectedValue(new Error('404'));

            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });

            expect(channel.itemCount).toBe(0);
        });
    });

    describe('content filtering and sorting', () => {
        it('should apply content filters', async () => {
            mockLibrary.getLibraryItems.mockResolvedValue([
                createMockItem({ ratingKey: '1', year: 2018 }),
                createMockItem({ ratingKey: '2', year: 2020 }),
                createMockItem({ ratingKey: '3', year: 2022 }),
            ]);

            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
                contentFilters: [{ field: 'year', operator: 'gte', value: 2020 }],
            });

            expect(channel.itemCount).toBe(2);
        });

        it('should apply sort order', async () => {
            mockLibrary.getLibraryItems.mockResolvedValue([
                createMockItem({ ratingKey: '1', title: 'Zebra' }),
                createMockItem({ ratingKey: '2', title: 'Apple' }),
            ]);

            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
                sortOrder: 'title_asc',
            });

            const content = await manager.resolveChannelContent(channel.id);
            expect(content.items[0]!.title).toBe('Apple');
        });

        it('re-resolves cached content when filters change during update', async () => {
            mockLibrary.getLibraryItems.mockResolvedValue([
                createMockItem({ ratingKey: '1', year: 2018 }),
                createMockItem({ ratingKey: '2', year: 2020 }),
                createMockItem({ ratingKey: '3', year: 2022 }),
            ]);
            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });

            const updated = await manager.updateChannel(channel.id, {
                contentFilters: [{ field: 'year', operator: 'gte', value: 2020 }],
            });
            const content = await manager.resolveChannelContent(channel.id);

            expect(updated.itemCount).toBe(2);
            expect(content.items.map((item) => item.ratingKey)).toEqual(['2', '3']);
        });

        it('re-resolves cached content when sort order changes during update', async () => {
            mockLibrary.getLibraryItems.mockResolvedValue([
                createMockItem({ ratingKey: '1', title: 'Zebra' }),
                createMockItem({ ratingKey: '2', title: 'Apple' }),
            ]);
            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });

            await manager.updateChannel(channel.id, { sortOrder: 'title_asc' });
            const content = await manager.resolveChannelContent(channel.id);

            expect(content.items.map((item) => item.title)).toEqual(['Apple', 'Zebra']);
        });

        it('should filter out zero-duration items', async () => {
            mockLibrary.getLibraryItems.mockResolvedValue([
                createMockItem({ ratingKey: '1', durationMs: 0 }),
                createMockItem({ ratingKey: '2', durationMs: 7200000 }),
            ]);

            const channel = await manager.createChannel({
                contentSource: createMockContentSource(),
            });

            expect(channel.itemCount).toBe(1);
        });
    });
});
