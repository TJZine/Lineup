import { AppErrorCode } from '../../../../types/app-errors';
import { expectConsoleWarn } from '../../../../__tests__/helpers';
import {
    installMockLocalStorage,
    mockLocalStorage,
    resetMockLocalStorage,
    restoreOriginalLocalStorage,
} from '../../../../__tests__/mocks/localStorage';
import { PlexLibraryError } from '../../../plex/library';
import { ChannelManager } from '../ChannelManager';
import { STORAGE_KEY } from '../constants';
import type { ChannelConfig } from '../contracts/types';
import { createMockItem, createMockLibrary } from './channel-manager-test-helpers';

installMockLocalStorage();

describe('collection recovery error classification', () => {
    const library = createMockLibrary();
    let manager: ChannelManager;

    beforeEach(() => {
        jest.clearAllMocks();
        resetMockLocalStorage();
        manager = new ChannelManager({ plexLibrary: library });
    });

    afterEach(() => {
        manager.dispose();
        jest.restoreAllMocks();
    });

    afterAll(() => restoreOriginalLocalStorage());

    async function prepareChannel(): Promise<ChannelConfig> {
        library.getCollectionItems.mockResolvedValue([createMockItem()]);
        const channel = await manager.createChannel({
            name: 'Daily',
            sourceLibraryId: 'library',
            contentSource: { type: 'collection', collectionKey: 'old', collectionName: 'Daily' },
        });
        await manager.flushSaves();
        library.getCollectionItems.mockClear();
        return channel;
    }

    it.each([
        [AppErrorCode.SERVER_UNAUTHORIZED, 401],
        [AppErrorCode.ACCESS_DENIED, 403],
        [AppErrorCode.NETWORK_TIMEOUT, undefined],
        [AppErrorCode.SERVER_UNREACHABLE, undefined],
        [AppErrorCode.SERVER_ERROR, 503],
        [AppErrorCode.PARSE_ERROR, undefined],
        [AppErrorCode.RESOURCE_NOT_FOUND, undefined],
    ])('does not rebind for %s with status %s', async (code, status) => {
        const channel = await prepareChannel();
        const persisted = mockLocalStorage.getItem(STORAGE_KEY);
        const updated = jest.fn();
        manager.on('channelUpdated', updated);
        library.getCollectionItems.mockRejectedValue(new PlexLibraryError(code, 'Request failed', status));
        if (code === AppErrorCode.ACCESS_DENIED) {
            expectConsoleWarn(['Access denied resolving channel content', expect.objectContaining({ httpStatus: 403 })]);
        }

        await expect(manager.refreshChannelContent(channel.id)).rejects.toMatchObject({ code });

        expect(library.getCollections).not.toHaveBeenCalled();
        expect(library.getCollectionItems).toHaveBeenCalledTimes(1);
        expect(manager.getChannel(channel.id)?.contentSource).toMatchObject({ collectionKey: 'old' });
        expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(persisted);
        expect(updated).not.toHaveBeenCalled();
    });

    it('does not reinterpret an existing empty collection as a missing reference', async () => {
        const channel = await prepareChannel();
        const persisted = mockLocalStorage.getItem(STORAGE_KEY);
        library.getCollectionItems.mockResolvedValue([]);

        await expect(manager.refreshChannelContent(channel.id)).rejects.toMatchObject({
            code: AppErrorCode.CONTENT_UNAVAILABLE,
        });
        expect(library.getCollections).not.toHaveBeenCalled();
        expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(persisted);
    });

    it.each([AppErrorCode.PARSE_ERROR, AppErrorCode.SERVER_ERROR])(
        'keeps the saved reference when candidate listing fails with %s', async code => {
            const channel = await prepareChannel();
            const persisted = mockLocalStorage.getItem(STORAGE_KEY);
            const updated = jest.fn();
            manager.on('channelUpdated', updated);
            library.getCollectionItems.mockRejectedValue(new PlexLibraryError(
                AppErrorCode.RESOURCE_NOT_FOUND, 'Missing collection', 404
            ));
            library.getCollections.mockRejectedValue(new PlexLibraryError(code, 'Listing failed'));

            await expect(manager.refreshChannelContent(channel.id)).rejects.toMatchObject({ code });
            expect(library.getCollectionItems).toHaveBeenCalledTimes(1);
            expect(manager.getChannel(channel.id)?.contentSource).toMatchObject({ collectionKey: 'old' });
            expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(persisted);
            expect(updated).not.toHaveBeenCalled();
        }
    );
});
