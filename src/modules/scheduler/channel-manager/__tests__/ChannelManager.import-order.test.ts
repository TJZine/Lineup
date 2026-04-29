import { ChannelManager } from '../ChannelManager';
import { ChannelRepository } from '../ChannelRepository';
import type { IPlexLibraryMinimal, PlexMediaItemMinimal } from '../interfaces';
import type { ChannelConfig, LibraryContentSource } from '../types';
import { AppErrorCode } from '../../../lifecycle/types';
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

function createBaseChannel(overrides: Partial<ChannelConfig> = {}): ChannelConfig {
    return {
        id: 'base',
        number: 1,
        name: 'Base Channel',
        contentSource: createMockContentSource(),
        playbackMode: 'shuffle',
        shuffleSeed: 1,
        phaseSeed: 1,
        startTimeAnchor: 0,
        skipIntros: false,
        skipCredits: false,
        createdAt: 0,
        updatedAt: 0,
        lastContentRefresh: 0,
        itemCount: 0,
        totalDurationMs: 0,
        ...overrides,
    };
}

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
