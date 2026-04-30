import { ChannelManager } from '../ChannelManager';
import { ChannelRepository } from '../ChannelRepository';
import { ContentResolver } from '../ContentResolver';
import type { IPlexLibraryMinimal } from '../interfaces';
import { AppErrorCode } from '../../../lifecycle/types';
import { STORAGE_CONFIG } from '../../../lifecycle/constants';
import { expectConsoleError, expectConsoleWarn } from '../../../../__tests__/helpers';
import {
    installMockLocalStorage,
    mockLocalStorage,
    resetMockLocalStorage,
    restoreOriginalLocalStorage,
} from '../../../../__tests__/mocks/localStorage';
import { MAX_CHANNELS, STORAGE_KEY } from '../constants';
import {
    createBaseChannel,
    createMockContentSource,
    createMockItem,
    createMockLibrary,
} from './channel-manager-test-helpers';

installMockLocalStorage();

const expectPersistCurrentChannelWarning = (times: number = 1): void => {
    expectConsoleWarn([
        'Failed to persist current channel',
        expect.objectContaining({
            name: 'ChannelError',
            code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
            message: STORAGE_CONFIG.STORAGE_QUOTA_EXCEEDED,
        }),
    ], { times });
};

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
        jest.useRealTimers();
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

    it('normalizes duplicate and invalid channel numbers in input order', async () => {
        const channels = [
            createBaseChannel({ id: 'c1', number: 1 }),
            createBaseChannel({ id: 'c2', number: 1 }),
            createBaseChannel({ id: 'c3', number: 999 }),
            createBaseChannel({ id: 'c4', number: 2 }),
        ];

        await manager.replaceAllChannels(channels);

        const result = manager.getAllChannels();
        expect(result).toHaveLength(4);
        expect(result[0]!.number).toBe(1);
        expect(result[1]!.number).toBe(2);
        expect(result[2]!.number).toBe(3);
        expect(result[3]!.number).toBe(4);
    });

    it('skips channels over MAX_CHANNELS and warns per skipped channel', async () => {
        const warn = jest.fn();
        manager = new ChannelManager({ plexLibrary: mockLibrary, logger: { warn, error: jest.fn() } });

        const channels = Array.from({ length: MAX_CHANNELS + 2 }, (_, index) => ({
            ...createBaseChannel({ id: `c${index + 1}`, number: index + 1 }),
        }));

        await manager.replaceAllChannels(channels);

        expect(manager.getAllChannels()).toHaveLength(MAX_CHANNELS);
        expect(warn).toHaveBeenCalledTimes(2);
    });

    it('clears resolver source cache when replacing full lineup', async () => {
        const clearCachesSpy = jest.spyOn(ContentResolver.prototype, 'clearCaches');

        await manager.replaceAllChannels([createBaseChannel({ id: 'replace-1', number: 10 })]);

        expect(clearCachesSpy).toHaveBeenCalledTimes(1);
    });

    it('routes replaceAllChannels current-channel persistence through ChannelRepository.saveCurrentChannelId', async () => {
        const writeCurrentSpy = jest.spyOn(ChannelRepository.prototype, 'saveCurrentChannelId');
        const channels = [createBaseChannel({ id: 'replace-1', number: 10 })];

        await manager.replaceAllChannels(channels, { currentChannelId: 'replace-1' });

        expect(writeCurrentSpy).toHaveBeenCalledWith('replace-1');
    });

    it('emits quota-specific persistenceWarning when replaceAllChannels current-channel write hits quota', async () => {
        expectPersistCurrentChannelWarning();
        const warningHandler = jest.fn();
        manager.on('persistenceWarning', warningHandler);
        jest
            .spyOn(ChannelRepository.prototype, 'saveCurrentChannelId')
            .mockReturnValue({ ok: false, reason: 'quota-exceeded' });

        await manager.replaceAllChannels([createBaseChannel({ id: 'replace-1', number: 10 })], {
            currentChannelId: 'replace-1',
        });

        expect(warningHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
                isQuotaError: true,
                message: STORAGE_CONFIG.STORAGE_QUOTA_EXCEEDED,
            })
        );
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
