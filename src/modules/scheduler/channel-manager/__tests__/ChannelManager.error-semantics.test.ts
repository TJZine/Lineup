import { ChannelManager } from '../ChannelManager';
import { ChannelRepository } from '../ChannelRepository';
import { ContentResolver } from '../ContentResolver';
import type { IPlexLibraryMinimal } from '../interfaces';
import { AppErrorCode } from '../../../lifecycle/types';
import { expectConsoleWarn } from '../../../../__tests__/helpers';
import {
    installMockLocalStorage,
    mockLocalStorage,
    resetMockLocalStorage,
    restoreOriginalLocalStorage,
} from '../../../../__tests__/mocks/localStorage';
import {
    createMockContentSource,
    createMockItem,
    createMockLibrary,
    seedDefaultLibrary,
} from './channel-manager-test-helpers';
import { CACHE_TTL_MS } from '../constants';

installMockLocalStorage();

describe('ChannelManager error contracts', () => {
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

    it('propagates non-fallback create resolution failures without publishing a channel', async () => {
        const logger = { warn: jest.fn(), error: jest.fn() };
        manager = new ChannelManager({ plexLibrary: mockLibrary, logger });
        const createdHandler = jest.fn();
        const saveSpy = jest.spyOn(ChannelRepository.prototype, 'saveStoredChannelData');
        manager.on('channelCreated', createdHandler);
        mockLibrary.getLibraryItems.mockRejectedValue(
            Object.assign(new Error('Access denied'), {
                code: AppErrorCode.ACCESS_DENIED,
                httpStatus: 403,
            })
        );

        await expect(
            manager.createChannel({
                name: 'Denied Channel',
                contentSource: createMockContentSource(),
            })
        ).rejects.toMatchObject({
            name: 'ChannelError',
            code: AppErrorCode.ACCESS_DENIED,
            recoverable: false,
        });

        expect(manager.getAllChannels()).toHaveLength(0);
        expect(createdHandler).not.toHaveBeenCalled();
        expect(saveSpy).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(
            'Access denied resolving channel content',
            expect.objectContaining({
                contentSource: { type: 'library', id: 'lib1' },
                httpStatus: 403,
            })
        );
    });

    it('throws ACCESS_DENIED when refreshing a channel whose source is unavailable to the profile', async () => {
        expectConsoleWarn([
            'Access denied resolving channel content',
            expect.objectContaining({
                channelId: expect.any(String),
                contentSource: expect.objectContaining({
                    type: 'library',
                    id: 'lib1',
                }),
                error: expect.objectContaining({
                    code: AppErrorCode.ACCESS_DENIED,
                    message: 'Access denied',
                }),
            }),
        ]);
        const channel = await manager.createChannel({
            contentSource: createMockContentSource(),
        });

        const accessDeniedError = Object.assign(new Error('Access denied'), {
            code: AppErrorCode.ACCESS_DENIED,
        });
        mockLibrary.getLibraryItems.mockRejectedValue(accessDeniedError);

        await expect(manager.refreshChannelContent(channel.id)).rejects.toMatchObject({
            code: AppErrorCode.ACCESS_DENIED,
            recoverable: false,
        });
    });

    it('propagates non-fallback content-affecting update failures without mutating state or cache', async () => {
        expectConsoleWarn([
            'Access denied resolving channel content',
            expect.objectContaining({
                contentSource: { type: 'library', id: 'denied-lib' },
                httpStatus: 403,
            }),
        ]);
        const channel = await manager.createChannel({
            name: 'Original',
            contentSource: createMockContentSource(),
        });
        const originalContent = await manager.resolveChannelContent(channel.id);
        await manager.flushSaves();
        mockLocalStorage.setItem.mockClear();
        const updatedHandler = jest.fn();
        const saveSpy = jest.spyOn(ChannelRepository.prototype, 'saveStoredChannelData');
        manager.on('channelUpdated', updatedHandler);
        mockLibrary.getLibraryItems.mockClear();
        mockLibrary.getLibraryItems.mockRejectedValue(
            Object.assign(new Error('Access denied'), {
                code: AppErrorCode.ACCESS_DENIED,
                httpStatus: 403,
            })
        );

        await expect(
            manager.updateChannel(channel.id, {
                name: 'Denied Update',
                contentSource: createMockContentSource('denied-lib'),
            })
        ).rejects.toMatchObject({
            name: 'ChannelError',
            code: AppErrorCode.ACCESS_DENIED,
            recoverable: false,
        });

        expect(manager.getChannel(channel.id)).toEqual(channel);
        expect(updatedHandler).not.toHaveBeenCalled();
        expect(saveSpy).not.toHaveBeenCalled();
        expect(mockLocalStorage.setItem).not.toHaveBeenCalled();

        const cachedAfterFailure = await manager.resolveChannelContent(channel.id);
        expect(cachedAfterFailure.fromCache).toBe(true);
        expect(cachedAfterFailure.items.map((item) => item.ratingKey)).toEqual(
            originalContent.items.map((item) => item.ratingKey)
        );
        expect(mockLibrary.getLibraryItems).not.toHaveBeenCalledWith(
            'lib1',
            expect.anything()
        );
    });

    it('marks authoring network fallback cache stale after content-affecting updates', async () => {
        const logger = { warn: jest.fn(), error: jest.fn() };
        manager = new ChannelManager({ plexLibrary: mockLibrary, logger });
        const channel = await manager.createChannel({
            name: 'Original',
            contentSource: createMockContentSource(),
        });
        const originalContent = await manager.resolveChannelContent(channel.id);
        mockLibrary.getLibraryItems.mockClear();
        mockLibrary.getLibraryItems.mockRejectedValue(
            Object.assign(new Error('Network timeout'), {
                code: AppErrorCode.NETWORK_TIMEOUT,
            })
        );

        const updated = await manager.updateChannel(channel.id, {
            contentSource: createMockContentSource('network-lib'),
        });

        expect(updated.contentSource).toEqual(
            expect.objectContaining({ libraryId: 'network-lib' })
        );
        const cachedAfterFallback = await manager.resolveChannelContent(channel.id);
        expect(cachedAfterFallback.fromCache).toBe(true);
        expect(cachedAfterFallback.isStale).toBe(true);
        expect(cachedAfterFallback.cacheReason).toBe('network_error');
        expect(cachedAfterFallback.items.map((item) => item.ratingKey)).toEqual(
            originalContent.items.map((item) => item.ratingKey)
        );
        expect(mockLibrary.getLibraryItems).toHaveBeenCalledWith(
            'network-lib',
            expect.anything()
        );
        expect(mockLibrary.getLibraryItems).toHaveBeenCalledTimes(2);
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('using cached content as stale'),
            expect.any(Object)
        );
    });

    it('invalidates the source, cancels pending retries, and does not serve stale cache after ACCESS_DENIED', async () => {
        const logger = { warn: jest.fn(), error: jest.fn() };
        const localManager = new ChannelManager({ plexLibrary: mockLibrary, logger });
        const invalidateSourceSpy = jest.spyOn(ContentResolver.prototype, 'invalidateSource');
        const baseNow = Date.now();
        const nowSpy = jest.spyOn(Date, 'now');
        nowSpy.mockReturnValue(baseNow);

        try {
            const channel = await localManager.createChannel({
                contentSource: createMockContentSource(),
            });

            nowSpy.mockReturnValue(baseNow + CACHE_TTL_MS + 1);
            mockLibrary.getLibraryItems.mockRejectedValueOnce(
                Object.assign(new Error('Network timeout'), {
                    code: AppErrorCode.NETWORK_TIMEOUT,
                })
            );

            const staleResult = await localManager.resolveChannelContent(channel.id);
            expect(staleResult.items).toHaveLength(2);

            const accessDeniedError = Object.assign(new Error('Access denied'), {
                code: AppErrorCode.ACCESS_DENIED,
                httpStatus: 403,
            });
            mockLibrary.getLibraryItems.mockRejectedValueOnce(accessDeniedError);

            await expect(localManager.resolveChannelContent(channel.id)).rejects.toHaveProperty(
                'code',
                AppErrorCode.ACCESS_DENIED
            );

            expect(invalidateSourceSpy).toHaveBeenCalledWith(channel.contentSource);

            mockLibrary.getLibraryItems.mockRejectedValueOnce(
                Object.assign(new Error('Network timeout after 403'), {
                    code: AppErrorCode.NETWORK_TIMEOUT,
                })
            );

            await expect(localManager.resolveChannelContent(channel.id)).rejects.toHaveProperty(
                'code',
                AppErrorCode.NETWORK_TIMEOUT
            );

            jest.advanceTimersByTime(30_000);
            await Promise.resolve();

            expect(mockLibrary.getLibraryItems).toHaveBeenCalledTimes(4);
            expect(logger.warn).toHaveBeenCalledWith(
                'Access denied resolving channel content',
                expect.objectContaining({
                    channelId: channel.id,
                    httpStatus: 403,
                    contentSource: { type: 'library', id: 'lib1' },
                })
            );
        } finally {
            nowSpy.mockRestore();
            await localManager.flushSaves().catch(() => undefined);
            localManager.dispose();
        }
    });

    it('skips imported records when create hits a non-fallback content resolution failure', async () => {
        expectConsoleWarn([
            'Access denied resolving channel content',
            expect.objectContaining({
                contentSource: { type: 'library', id: 'denied-lib' },
                httpStatus: 403,
            }),
        ]);
        mockLibrary.getLibraryItems.mockImplementation(async (libraryId) => {
            if (libraryId === 'denied-lib') {
                throw Object.assign(new Error('Access denied'), {
                    code: AppErrorCode.ACCESS_DENIED,
                    httpStatus: 403,
                });
            }
            return [createMockItem({ ratingKey: `item-${libraryId}` })];
        });
        const importData = JSON.stringify([
            {
                name: 'Denied Channel',
                contentSource: {
                    ...createMockContentSource(),
                    libraryId: 'denied-lib',
                },
            },
            {
                name: 'Imported Channel',
                contentSource: createMockContentSource(),
            },
        ]);

        const result = await manager.importChannels(importData);

        expect(result.success).toBe(true);
        expect(result.importedCount).toBe(1);
        expect(result.skippedCount).toBe(1);
        expect(result.errors).toEqual([
            expect.stringContaining('Failed to import channel: Profile does not have access'),
        ]);
        expect(manager.getAllChannels()).toHaveLength(1);
        expect(manager.getAllChannels()[0]?.name).toBe('Imported Channel');
    });
});
