import { ChannelManager } from '../ChannelManager';
import { ChannelRepository } from '../ChannelRepository';
import type { IPlexLibraryMinimal } from '../interfaces';
import { AppErrorCode } from '../../../lifecycle/types';
import {
    installMockLocalStorage,
    resetMockLocalStorage,
    restoreOriginalLocalStorage,
} from '../../../../__tests__/mocks/localStorage';
import {
    createBaseChannel,
    createMockContentSource,
    createMockItem,
    createMockLibrary,
} from './channel-manager-test-helpers';

installMockLocalStorage();

describe('ChannelManager import and reorder contracts', () => {
    let mockLibrary: jest.Mocked<IPlexLibraryMinimal>;
    let manager: ChannelManager;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        resetMockLocalStorage();

        mockLibrary = createMockLibrary();
        mockLibrary.getLibraryItems.mockResolvedValue([createMockItem()]);

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

    it('summarizes non-Error import failures without an undefined message', async () => {
        mockLibrary.getLibraryItems.mockRejectedValueOnce('plain failure');

        const result = await manager.importChannels(JSON.stringify([
            {
                name: 'Rejected Channel',
                contentSource: createMockContentSource('rejecting-lib'),
            },
        ]));

        expect(result.success).toBe(false);
        expect(result.importedCount).toBe(0);
        expect(result.skippedCount).toBe(1);
        expect(result.errors).toEqual(['Failed to import channel: plain failure']);
    });

    it('accepts an exact full reorder and queues persistence', async () => {
        await manager.replaceAllChannels([
            createBaseChannel({ id: 'one', number: 1 }),
            createBaseChannel({ id: 'two', number: 2 }),
            createBaseChannel({ id: 'three', number: 3 }),
        ]);
        const saveSpy = jest.spyOn(ChannelRepository.prototype, 'saveStoredChannelData');

        await manager.reorderChannels(['three', 'one', 'two']);
        jest.runOnlyPendingTimers();

        expect(manager.getAllChannels().map((channel) => channel.id)).toEqual(['three', 'one', 'two']);
        expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({
            channelOrder: ['three', 'one', 'two'],
        }));
    });

    it.each([
        ['missing existing id', ['three', 'one']],
        ['unknown id', ['three', 'one', 'two', 'unknown']],
        ['duplicate id', ['three', 'one', 'one']],
    ])('rejects reorder with %s before mutating or queueing persistence', async (_caseName, orderedIds) => {
        await manager.replaceAllChannels([
            createBaseChannel({ id: 'one', number: 1 }),
            createBaseChannel({ id: 'two', number: 2 }),
            createBaseChannel({ id: 'three', number: 3 }),
        ]);
        const saveSpy = jest.spyOn(ChannelRepository.prototype, 'saveStoredChannelData');

        await expect(manager.reorderChannels(orderedIds)).rejects.toMatchObject({
            name: 'ChannelError',
            code: AppErrorCode.STORAGE_VALIDATION_FAILED,
        });
        jest.runOnlyPendingTimers();

        expect(manager.getAllChannels().map((channel) => channel.id)).toEqual(['one', 'two', 'three']);
        expect(saveSpy).not.toHaveBeenCalled();
    });
});
