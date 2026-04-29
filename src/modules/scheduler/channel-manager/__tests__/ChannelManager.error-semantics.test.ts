import { ChannelManager } from '../ChannelManager';
import { ChannelRepository } from '../ChannelRepository';
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
    createMockLibrary,
    seedDefaultLibrary,
} from './channel-manager-test-helpers';

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
});
