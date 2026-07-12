import { ChannelManager } from '../ChannelManager';
import { ContentResolver } from '../resolution/ContentResolver';
import type { IPlexLibraryMinimal, PlexMediaItemMinimal } from '../contracts/interfaces';
import type { ResolvedContentItem } from '../contracts/types';
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
        it('cancels first and drains abort-ignoring resolution before clearing scope state', async () => {
            const channel = await manager.createChannel(
                { contentSource: createMockContentSource() },
                { initialContent: [{
                    ratingKey: 'initial',
                    type: 'movie',
                    title: 'Initial',
                    fullTitle: 'Initial',
                    durationMs: 1000,
                    thumb: null,
                    year: 2026,
                    scheduledIndex: 0,
                }] }
            );
            let release: () => void = () => undefined;
            mockLibrary.getLibraryItems.mockImplementation(() => new Promise((resolve) => {
                release = (): void => resolve([createMockItem({ ratingKey: 'late' })]);
            }));
            const resolution = manager.refreshChannelContent(channel.id);
            let transitionSettled = false;
            const transition = manager.clearRuntimeStateForScopeTransition().then(() => {
                transitionSettled = true;
            });

            await Promise.resolve();
            expect(transitionSettled).toBe(false);
            release();

            await expect(resolution).rejects.toMatchObject({ name: 'AbortError' });
            await transition;
            expect(manager.getAllChannels()).toEqual([]);
        });

        it('keeps general resolution closed while one exact initial-tune authorization resolves once', async () => {
            const channel = await manager.createChannel(
                { contentSource: createMockContentSource() },
                { initialContent: [{
                    ratingKey: 'initial-authorized',
                    type: 'movie',
                    title: 'Initial Authorized',
                    fullTitle: 'Initial Authorized',
                    durationMs: 1000,
                    thumb: null,
                    year: 2026,
                    scheduledIndex: 0,
                }] }
            );
            const unrelated = await manager.createChannel(
                { contentSource: createMockContentSource('unrelated-library') },
                { initialContent: [{
                    ratingKey: 'unrelated',
                    type: 'movie',
                    title: 'Unrelated',
                    fullTitle: 'Unrelated',
                    durationMs: 1000,
                    thumb: null,
                    year: 2026,
                    scheduledIndex: 0,
                }] }
            );
            await manager.supersedeActiveResolutions();
            await expect(manager.resolveChannelContent(channel.id)).rejects.toMatchObject({
                name: 'AbortError',
            });
            const validator = { assertCurrent: jest.fn() };
            const authorization = manager.createInitialTuneResolutionAuthorization(
                channel.id,
                validator
            );

            await expect(manager.resolveChannelContentForInitialTune(
                unrelated.id,
                authorization
            )).rejects.toMatchObject({ name: 'AbortError' });

            await expect(manager.resolveChannelContentForInitialTune(
                channel.id,
                authorization
            )).resolves.toEqual(expect.objectContaining({ channelId: channel.id }));
            await expect(manager.resolveChannelContentForInitialTune(
                channel.id,
                authorization
            )).rejects.toMatchObject({ name: 'AbortError' });
            expect(validator.assertCurrent).toHaveBeenCalled();
        });

        it('invalidates an unused initial-tune resolution authorization on the next supersession', async () => {
            const channel = await manager.createChannel(
                { contentSource: createMockContentSource() },
                { initialContent: [] }
            );
            mockLibrary.getLibraryItems.mockClear();
            await manager.supersedeActiveResolutions();
            const authorization = manager.createInitialTuneResolutionAuthorization(
                channel.id,
                { assertCurrent: jest.fn() }
            );
            await manager.supersedeActiveResolutions();

            await expect(manager.resolveChannelContentForInitialTune(
                channel.id,
                authorization
            )).rejects.toMatchObject({ name: 'AbortError' });
            expect(mockLibrary.getLibraryItems).not.toHaveBeenCalled();
        });

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

        it('takes ownership of initial content arrays passed during channel creation', async () => {
            const initialContent: ResolvedContentItem[] = [
                {
                    ratingKey: 'initial-1',
                    type: 'movie' as const,
                    title: 'Initial Movie',
                    fullTitle: 'Initial Movie',
                    durationMs: 6000,
                    thumb: null,
                    year: 2026,
                    scheduledIndex: 0,
                    genres: ['Drama'],
                    mediaInfo: { resolution: '1080p' },
                },
            ];

            const channel = await manager.createChannel(
                { contentSource: createMockContentSource() },
                { initialContent }
            );

            initialContent.push({
                ratingKey: 'mutated-array',
                type: 'movie',
                title: 'Mutated Array',
                fullTitle: 'Mutated Array',
                durationMs: 6000,
                thumb: null,
                year: 2026,
                scheduledIndex: 1,
            });
            initialContent[0]!.title = 'Mutated Title';
            initialContent[0]!.genres?.push('Mutated Genre');
            initialContent[0]!.mediaInfo!.resolution = '240p';

            const resolved = await manager.resolveChannelContent(channel.id);

            expect(resolved.items).toHaveLength(1);
            expect(resolved.items[0]?.title).toBe('Initial Movie');
            expect(resolved.items[0]?.genres).toEqual(['Drama']);
            expect(resolved.items[0]?.mediaInfo).toEqual({ resolution: '1080p' });
        });

        it('applies playback ordering to initial content during channel creation', async () => {
            const initialContent: ResolvedContentItem[] = [
                createResolvedEpisode('a1', 'Series A'),
                createResolvedEpisode('b1', 'Series B'),
                createResolvedEpisode('a2', 'Series A'),
                createResolvedEpisode('b2', 'Series B'),
                createResolvedEpisode('a3', 'Series A'),
            ];

            const channel = await manager.createChannel(
                {
                    contentSource: createMockContentSource(),
                    playbackMode: 'block',
                    blockSize: 2,
                },
                { initialContent }
            );

            const resolved = await manager.resolveChannelContent(channel.id);
            const orderedShowTitles = resolved.orderedItems.map((item) => item.showTitle);

            expect(resolved.items.map((item) => item.ratingKey)).toEqual(['a1', 'b1', 'a2', 'b2', 'a3']);
            expect(resolved.orderedItems.map((item) => item.ratingKey)).not.toEqual(['a1', 'b1', 'a2', 'b2', 'a3']);
            expect(orderedShowTitles[0]).toBe(orderedShowTitles[1]);
            expect(orderedShowTitles[2]).toBe(orderedShowTitles[3]);
            expect(orderedShowTitles[0]).not.toBe(orderedShowTitles[2]);
            expect(orderedShowTitles[4]).toBe('Series A');
            expect(channel.itemCount).toBe(5);
            expect(channel.totalDurationMs).toBe(30000);
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

function createResolvedEpisode(ratingKey: string, showTitle: string): ResolvedContentItem {
    return {
        ratingKey,
        type: 'episode',
        title: ratingKey,
        fullTitle: `${showTitle} - ${ratingKey}`,
        showTitle,
        durationMs: 6000,
        thumb: null,
        year: 2026,
        scheduledIndex: 0,
    };
}
