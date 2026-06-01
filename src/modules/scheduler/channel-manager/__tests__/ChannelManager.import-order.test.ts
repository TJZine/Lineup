import { ChannelManager } from '../ChannelManager';
import { ChannelRepository } from '../persistence/ChannelRepository';
import type { IPlexLibraryMinimal } from '../contracts/interfaces';
import { AppErrorCode } from '../../../../types/app-errors';
import {
    installMockLocalStorage,
    mockLocalStorage,
    resetMockLocalStorage,
    restoreOriginalLocalStorage,
} from '../../../../__tests__/mocks/localStorage';
import { STORAGE_KEY } from '../constants';
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
        jest.useRealTimers();
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

    it('imports valid channel records from JSON', async () => {
        const importData = JSON.stringify([
            {
                name: 'Imported Channel',
                contentSource: createMockContentSource(),
                color: '#ff0000',
            },
        ]);

        const result = await manager.importChannels(importData);

        expect(result.success).toBe(true);
        expect(result.importedCount).toBe(1);
        expect(result.errors).toHaveLength(0);
        expect(manager.getAllChannels()).toHaveLength(1);
        expect(manager.getAllChannels()[0]).not.toHaveProperty('color');

        await manager.flushSaves();
        const persisted = JSON.parse(mockLocalStorage.getItem(STORAGE_KEY) ?? '{}') as {
            channels?: Array<Record<string, unknown>>;
        };
        expect(persisted.channels?.[0]?.color).toBeUndefined();
    });

    it('omits invalid enum-like fields and content filters during import', async () => {
        const importData = JSON.stringify([
            {
                name: 'Imported Channel',
                contentSource: createMockContentSource(),
                buildStrategy: 'not-a-strategy',
                playbackMode: 'not-a-mode',
                sortOrder: 'not-a-sort-order',
                contentFilters: [{ field: 'year', operator: 'definitely', value: 2020 }],
            },
        ]);

        const result = await manager.importChannels(importData);

        expect(result.success).toBe(true);
        expect(result.importedCount).toBe(1);
        expect(result.errors).toHaveLength(0);

        const [channel] = manager.getAllChannels();
        expect(channel).toEqual(expect.objectContaining({
            name: 'Imported Channel',
            playbackMode: 'sequential',
        }));
        expect(channel?.buildStrategy).toBeUndefined();
        expect(channel?.sortOrder).toBeUndefined();
        expect(channel?.contentFilters).toBeUndefined();
    });

    it('preserves valid enum-like fields and content filters during import', async () => {
        const importData = JSON.stringify([
            {
                name: 'Imported Channel',
                contentSource: createMockContentSource(),
                buildStrategy: 'genres',
                playbackMode: 'shuffle',
                sortOrder: 'title_asc',
                contentFilters: [{ field: 'year', operator: 'gte', value: 2020 }],
            },
        ]);

        const result = await manager.importChannels(importData);

        expect(result.success).toBe(true);
        expect(result.importedCount).toBe(1);

        const [channel] = manager.getAllChannels();
        expect(channel).toEqual(expect.objectContaining({
            buildStrategy: 'genres',
            playbackMode: 'shuffle',
            sortOrder: 'title_asc',
            contentFilters: [{ field: 'year', operator: 'gte', value: 2020 }],
        }));
    });

    it('omits the entire content filter array during import when any filter is invalid', async () => {
        const importData = JSON.stringify([
            {
                name: 'Imported Channel',
                contentSource: createMockContentSource(),
                contentFilters: [
                    { field: 'year', operator: 'gte', value: 2020 },
                    { field: 'year', operator: 'definitely', value: 2020 },
                ],
            },
        ]);

        const result = await manager.importChannels(importData);

        expect(result.success).toBe(true);
        expect(result.importedCount).toBe(1);
        expect(result.errors).toHaveLength(0);

        const [channel] = manager.getAllChannels();
        expect(channel?.contentFilters).toBeUndefined();
    });

    it('omits fractional channel numbers during import', async () => {
        const importData = JSON.stringify([
            {
                name: 'Fractional Channel',
                number: 7.5,
                contentSource: createMockContentSource(),
            },
        ]);

        const result = await manager.importChannels(importData);

        expect(result.success).toBe(true);
        expect(result.importedCount).toBe(1);
        expect(result.errors).toHaveLength(0);

        const [channel] = manager.getAllChannels();
        expect(channel?.number).toBe(1);
    });

    it('ignores legacy isSequentialVariant when importing channels without canonical playback variant metadata', async () => {
        const importData = JSON.stringify([
            {
                name: 'Imported Variant',
                contentSource: createMockContentSource(),
                playbackMode: 'block',
                blockSize: 4,
                isSequentialVariant: true,
            },
        ]);

        const result = await manager.importChannels(importData);

        expect(result.success).toBe(true);
        expect(result.importedCount).toBe(1);
        expect(result.errors).toHaveLength(0);

        const channels = manager.getAllChannels();
        expect(channels).toHaveLength(1);
        expect(channels[0]?.isPlaybackModeVariant).toBeUndefined();
    });

    it('reports invalid import data', async () => {
        const result = await manager.importChannels('not valid json');

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('skips invalid channels during import', async () => {
        const importData = JSON.stringify([
            { name: 'Missing contentSource' },
            { name: 'Valid', contentSource: createMockContentSource() },
        ]);

        const result = await manager.importChannels(importData);

        expect(result.importedCount).toBe(1);
        expect(result.skippedCount).toBe(1);
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

    it('reorders channels created through the public create API', async () => {
        const ch1 = await manager.createChannel({
            name: 'Ch1',
            contentSource: createMockContentSource(),
        });
        const ch2 = await manager.createChannel({
            name: 'Ch2',
            contentSource: createMockContentSource(),
        });
        const ch3 = await manager.createChannel({
            name: 'Ch3',
            contentSource: createMockContentSource(),
        });

        await manager.reorderChannels([ch3.id, ch1.id, ch2.id]);

        const all = manager.getAllChannels();
        expect(all[0]!.id).toBe(ch3.id);
        expect(all[1]!.id).toBe(ch1.id);
        expect(all[2]!.id).toBe(ch2.id);
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
