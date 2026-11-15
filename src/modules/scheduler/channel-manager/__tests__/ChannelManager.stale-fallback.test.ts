import { ChannelManager } from '../ChannelManager';
import type { IPlexLibraryMinimal } from '../contracts/interfaces';
import { CACHE_TTL_MS, STORAGE_KEY } from '../constants';
import { AppErrorCode } from '../../../../types/app-errors';
import { createDeferred, expectConsoleWarn } from '../../../../__tests__/helpers';
import {
    createMockContentSource,
    createMockItem,
    createMockLibrary,
    seedDefaultLibrary,
} from './channel-manager-test-helpers';
import {
    installMockLocalStorage,
    resetMockLocalStorage,
    restoreOriginalLocalStorage,
} from '../../../../__tests__/mocks/localStorage';

installMockLocalStorage();

describe('ChannelManager stale content fallback', () => {
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
        await manager.flushSaves().catch(() => undefined);
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    afterAll(() => {
        restoreOriginalLocalStorage();
    });

    it('preserves stale cached content when a content-affecting update hits a deleted source fallback', async () => {
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

    it.each([
        { oldMode: 'block' as const, oldSpecials: true, newMode: 'block' as const,
            newSpecials: false, failure: 'network' as const },
        { oldMode: 'block' as const, oldSpecials: false, newMode: 'block' as const,
            newSpecials: true, failure: 'empty' as const },
        { oldMode: 'shuffle' as const, oldSpecials: false, newMode: 'block' as const,
            newSpecials: false, failure: 'network' as const },
        { oldMode: 'block' as const, oldSpecials: false, newMode: 'shuffle' as const,
            newSpecials: false, failure: 'empty' as const },
    ])('rejects an unavailable $failure update when $oldMode/$oldSpecials to $newMode/$newSpecials changes specials selection',
        async ({ oldMode, oldSpecials, newMode, newSpecials, failure }) => {
            mockLibrary.getLibraryItems.mockResolvedValue([
                createMockItem({ ratingKey: 'special', type: 'episode', seasonNumber: 0 }),
                createMockItem({ ratingKey: 'regular', type: 'episode', seasonNumber: 1 }),
            ]);
            const channel = await manager.createChannel({
                contentSource: { ...createMockContentSource(), libraryType: 'show' },
                playbackMode: oldMode, includeSpecials: oldSpecials,
            });
            const original = await manager.resolveChannelContent(channel.id);
            await manager.flushSaves();
            const beforeBody = globalThis.localStorage.getItem(STORAGE_KEY);
            const beforeBase = manager.getStructuralBase();
            const channelUpdated = jest.fn();
            manager.on('channelUpdated', channelUpdated);
            const now = Date.now();
            jest.spyOn(Date, 'now').mockReturnValue(now + 6 * 60_000);
            if (failure === 'network') mockLibrary.getLibraryItems.mockRejectedValue(new Error('network offline'));
            else mockLibrary.getLibraryItems.mockResolvedValue([]);

            const result = await manager.tryUpdateChannel(channel.id, {
                playbackMode: newMode, includeSpecials: newSpecials,
            });

            expect(result.kind).toBe('invalid');
            expect(manager.getChannel(channel.id)).toMatchObject({
                playbackMode: oldMode, includeSpecials: oldSpecials,
            });
            expect(manager.getStructuralBase()).toEqual(beforeBase);
            expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBe(beforeBody);
            expect(channelUpdated).not.toHaveBeenCalled();
            const stillCached = await manager.resolveChannelContent(channel.id);
            expect(stillCached.items.map((item) => item.ratingKey))
                .toEqual(original.items.map((item) => item.ratingKey));
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

    it('rejects an async stale fallback after the channel owner is edited', async () => {
        const baseNow = Date.now();
        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(baseNow);
        const channel = await manager.createChannel({
            contentSource: createMockContentSource(),
        });
        await manager.resolveChannelContent(channel.id);
        const failedResolution = createDeferred<never>();
        nowSpy.mockReturnValue(baseNow + CACHE_TTL_MS + 1);
        mockLibrary.getLibraryItems.mockReturnValue(failedResolution.promise);

        const staleResolution = manager.resolveChannelContent(channel.id);
        await Promise.resolve();
        await manager.updateChannel(channel.id, { name: 'Edited while resolving' });
        failedResolution.reject(new Error('404'));

        await expect(staleResolution).rejects.toMatchObject({ name: 'AbortError' });
        expect(manager.getChannel(channel.id)?.name).toBe('Edited while resolving');
    });
});
