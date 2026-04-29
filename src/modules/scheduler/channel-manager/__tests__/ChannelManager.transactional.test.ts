import { ChannelManager } from '../ChannelManager';
import { ChannelRepository } from '../ChannelRepository';
import type { IPlexLibraryMinimal, PlexMediaItemMinimal } from '../interfaces';
import type { ChannelConfig, LibraryContentSource } from '../types';
import { AppErrorCode } from '../../../lifecycle/types';
import { expectConsoleError, expectConsoleWarn } from '../../../../__tests__/helpers';
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

describe('ChannelManager replaceAllChannels transactional persistence', () => {
    let mockLibrary: jest.Mocked<IPlexLibraryMinimal>;
    let manager: ChannelManager;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        resetMockLocalStorage();

        mockLibrary = createMockLibrary();
        mockLibrary.getLibraryItems.mockResolvedValue([
            createMockItem({ ratingKey: 'old-1', title: 'Old Movie' }),
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

    it('preserves previous channels, current channel, and resolved-content cache when channel-data save fails', async () => {
        expectConsoleError([
            'ChannelManager.replaceAllChannels failed to persist channels',
            expect.objectContaining({
                name: 'ChannelError',
                code: AppErrorCode.PERSISTENCE_FALLBACK,
            }),
        ]);
        const oldChannel = await manager.createChannel({
            name: 'Old Channel',
            contentSource: createMockContentSource('old-lib'),
        });
        await manager.flushSaves();
        manager.setCurrentChannel(oldChannel.id);

        const cached = await manager.resolveChannelContent(oldChannel.id);
        expect(cached.fromCache).toBe(true);
        mockLibrary.getLibraryItems.mockClear();

        jest
            .spyOn(ChannelRepository.prototype, 'saveStoredChannelData')
            .mockReturnValue({ ok: false, reason: 'unavailable' });

        await expect(
            manager.replaceAllChannels([
                createBaseChannel({
                    id: 'new-channel',
                    number: 7,
                    name: 'New Channel',
                    contentSource: createMockContentSource('new-lib'),
                }),
            ], { currentChannelId: 'new-channel' })
        ).rejects.toMatchObject({
            name: 'ChannelError',
            code: AppErrorCode.PERSISTENCE_FALLBACK,
        });

        expect(manager.getAllChannels().map((channel) => channel.id)).toEqual([oldChannel.id]);
        expect(manager.getCurrentChannel()?.id).toBe(oldChannel.id);

        const afterFailure = await manager.resolveChannelContent(oldChannel.id);
        expect(afterFailure.fromCache).toBe(true);
        expect(afterFailure.items[0]?.ratingKey).toBe('old-1');
        expect(mockLibrary.getLibraryItems).not.toHaveBeenCalled();
    });

    it('normalizes replacement channels, persists channel data, and then applies current channel', async () => {
        const saveCurrentSpy = jest.spyOn(ChannelRepository.prototype, 'saveCurrentChannelId');

        await manager.replaceAllChannels([
            createBaseChannel({ id: 'first', number: 3, shuffleSeed: Number.NaN }),
            createBaseChannel({ id: 'second', number: 3, phaseSeed: Number.NaN }),
        ], { currentChannelId: 'second' });

        const channels = manager.getAllChannels();
        expect(channels.map((channel) => channel.id)).toEqual(['first', 'second']);
        expect(channels.map((channel) => channel.number)).toEqual([3, 1]);
        expect(channels.every((channel) => Number.isFinite(channel.shuffleSeed))).toBe(true);
        expect(channels.every((channel) => Number.isFinite(channel.phaseSeed))).toBe(true);
        expect(manager.getCurrentChannel()?.id).toBe('second');
        expect(saveCurrentSpy).toHaveBeenCalledWith('second');
    });

    it('resets persistence warning backoff after channel-data save even when current-channel persistence is best-effort', async () => {
        expectConsoleWarn([
            'Failed to persist current channel',
            expect.objectContaining({
                name: 'ChannelError',
                code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
            }),
        ], { times: 2 });
        jest
            .spyOn(ChannelRepository.prototype, 'saveCurrentChannelId')
            .mockReturnValue({ ok: false, reason: 'quota-exceeded' });
        const warningHandler = jest.fn();
        manager.on('persistenceWarning', warningHandler);

        await manager.replaceAllChannels([createBaseChannel({ id: 'first' })], {
            currentChannelId: 'first',
        });
        await manager.replaceAllChannels([]);
        await manager.replaceAllChannels([createBaseChannel({ id: 'second' })], {
            currentChannelId: 'second',
        });

        expect(warningHandler).toHaveBeenCalledTimes(2);
    });
});
