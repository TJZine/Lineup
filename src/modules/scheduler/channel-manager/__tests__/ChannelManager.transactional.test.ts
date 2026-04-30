import { ChannelManager } from '../ChannelManager';
import { ChannelRepository } from '../ChannelRepository';
import type { IPlexLibraryMinimal } from '../interfaces';
import { AppErrorCode } from '../../../lifecycle/types';
import { expectConsoleError, expectConsoleWarn } from '../../../../__tests__/helpers';
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

    it('skips duplicate channel ids without duplicating persisted order', async () => {
        const warn = jest.fn();
        manager = new ChannelManager({ plexLibrary: mockLibrary, logger: { warn, error: jest.fn() } });

        await manager.replaceAllChannels([
            createBaseChannel({ id: 'duplicate', name: 'First', number: 1 }),
            createBaseChannel({ id: 'duplicate', name: 'Second', number: 2 }),
            createBaseChannel({ id: 'third', name: 'Third', number: 3 }),
        ]);

        expect(manager.getAllChannels().map((channel) => channel.name)).toEqual(['First', 'Third']);
        expect(JSON.parse(mockLocalStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual(expect.objectContaining({
            channelOrder: ['duplicate', 'third'],
        }));
        expect(warn).toHaveBeenCalledWith(
            'Skipping duplicate channel Second (duplicate) during replaceAllChannels'
        );
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
