import { ChannelManager } from '../ChannelManager';
import type { IPlexLibraryMinimal, PlexMediaItemMinimal } from '../interfaces';
import type { LibraryContentSource } from '../types';
import { CACHE_TTL_MS } from '../constants';
import { AppErrorCode } from '../../../lifecycle/types';
import { expectConsoleWarn } from '../../../../__tests__/helpers';
import {
    installMockLocalStorage,
    resetMockLocalStorage,
    restoreOriginalLocalStorage,
} from '../../../../__tests__/mocks/localStorage';

function createMockLibrary(): jest.Mocked<IPlexLibraryMinimal> {
    return {
        getLibraryItems: jest.fn(),
        getCollectionItems: jest.fn(),
        getShowEpisodes: jest.fn(),
        getPlaylistItems: jest.fn(),
        getItem: jest.fn(),
    };
}

function createMockItem(overrides: Partial<PlexMediaItemMinimal> = {}): PlexMediaItemMinimal {
    return {
        ratingKey: '1',
        type: 'movie',
        title: 'Test Movie',
        year: 2020,
        durationMs: 7200000,
        thumb: '/thumb/1',
        addedAt: new Date(),
        ...overrides,
    };
}

function createMockContentSource(libraryId = 'lib1'): LibraryContentSource {
    return {
        type: 'library',
        libraryId,
        libraryType: 'movie',
        includeWatched: true,
    };
}

installMockLocalStorage();

describe('ChannelManager stale content fallback', () => {
    let mockLibrary: jest.Mocked<IPlexLibraryMinimal>;
    let manager: ChannelManager;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        resetMockLocalStorage();

        mockLibrary = createMockLibrary();
        mockLibrary.getLibraryItems.mockResolvedValue([
            createMockItem({ ratingKey: '1' }),
            createMockItem({ ratingKey: '2' }),
        ]);

        manager = new ChannelManager({ plexLibrary: mockLibrary });
    });

    afterEach(async () => {
        await manager.flushSaves().catch(() => undefined);
        jest.clearAllTimers();
        jest.restoreAllMocks();
    });

    afterAll(() => {
        restoreOriginalLocalStorage();
    });

    it('records stale fallback metadata after a content-affecting update hits a deleted source', async () => {
        expectConsoleWarn([
            expect.stringContaining('Content unavailable for channel'),
            expect.objectContaining({
                code: AppErrorCode.CONTENT_UNAVAILABLE,
            }),
        ], { times: 2 });
        const contentResolvedHandler = jest.fn();
        manager.on('contentResolved', contentResolvedHandler);
        const channel = await manager.createChannel({
            name: 'Original',
            contentSource: createMockContentSource(),
        });
        const originalContent = await manager.resolveChannelContent(channel.id);
        contentResolvedHandler.mockClear();
        mockLibrary.getLibraryItems.mockResolvedValue([]);

        await manager.updateChannel(channel.id, {
            contentSource: createMockContentSource('deleted-lib'),
        });

        const cachedAfterFallback = await manager.resolveChannelContent(channel.id);
        expect(cachedAfterFallback.fromCache).toBe(true);
        expect(cachedAfterFallback.isStale).toBe(true);
        expect(cachedAfterFallback.cacheReason).toBe('content_unavailable');
        expect(cachedAfterFallback.items.map((item) => item.ratingKey)).toEqual(
            originalContent.items.map((item) => item.ratingKey)
        );
        expect(contentResolvedHandler).not.toHaveBeenCalled();
    });

    it('uses stale cache when runtime resolution receives a raw 404 for an expired source', async () => {
        expectConsoleWarn([
            expect.stringContaining('Content unavailable for channel'),
            expect.objectContaining({
                name: 'Error',
                message: '404',
            }),
        ]);
        const baseNow = Date.now();
        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(baseNow);
        const channel = await manager.createChannel({
            contentSource: createMockContentSource(),
        });
        const originalContent = await manager.resolveChannelContent(channel.id);

        nowSpy.mockReturnValue(baseNow + CACHE_TTL_MS + 1);
        mockLibrary.getLibraryItems.mockRejectedValue(new Error('404'));

        const staleResult = await manager.resolveChannelContent(channel.id);

        expect(staleResult.fromCache).toBe(true);
        expect(staleResult.isStale).toBe(true);
        expect(staleResult.cacheReason).toBe('content_unavailable');
        expect(staleResult.items.map((item) => item.ratingKey)).toEqual(
            originalContent.items.map((item) => item.ratingKey)
        );
    });
});
