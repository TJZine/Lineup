import { ChannelManager } from '../ChannelManager';
import { ChannelRepository } from '../persistence/ChannelRepository';
import { ContentResolver } from '../resolution/ContentResolver';
import type { IPlexLibraryMinimal } from '../contracts/interfaces';
import { AppErrorCode } from '../../../../types/app-errors';
import { STORAGE_QUOTA_EXCEEDED_MESSAGE } from '../../../../shared/persistenceMessages';
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

const expectPersistCurrentChannelWarning = (times: number = 1): void => {
    expectConsoleWarn([
        'Failed to persist current channel',
        expect.objectContaining({
            name: 'ChannelError',
            code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
            message: STORAGE_QUOTA_EXCEEDED_MESSAGE,
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

    it('rejects unknown authored replacement fields before changing memory or storage', async () => {
        await manager.replaceAllChannels([createBaseChannel({ id: 'before' })]);
        const body = mockLocalStorage.getItem(STORAGE_KEY);
        const revision = manager.getStructuralBase().revision;
        const polluted = {
            ...createBaseChannel({
                id: 'replace-color',
                number: 7,
                name: 'Replace Color',
                contentSource: createMockContentSource('new-lib'),
            }),
            color: '#ff0000',
        } as unknown as ReturnType<typeof createBaseChannel>;

        expect((await manager.tryReplaceAllChannels([polluted])).kind).toBe('invalid');
        expect(manager.getAllChannels().map((channel) => channel.id)).toEqual(['before']);
        expect(manager.getStructuralBase().revision).toBe(revision);
        expect(mockLocalStorage.getItem(STORAGE_KEY)).toBe(body);
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
                message: STORAGE_QUOTA_EXCEEDED_MESSAGE,
            })
        );
    });

    it('keeps replaceAllChannels strict for channel data and best-effort for the current-channel pointer', async () => {
        expectPersistCurrentChannelWarning();
        const warningHandler = jest.fn();
        manager.on('persistenceWarning', warningHandler);
        jest
            .spyOn(ChannelRepository.prototype, 'saveCurrentChannelId')
            .mockReturnValue({ ok: false, reason: 'quota-exceeded' });

        await expect(manager.replaceAllChannels([createBaseChannel({ id: 'replace-1', number: 10 })], {
            currentChannelId: 'replace-1',
        })).resolves.toBeUndefined();

        expect(manager.getAllChannels().map((channel) => channel.id)).toEqual(['replace-1']);
        expect(manager.getCurrentChannel()?.id).toBe('replace-1');
        expect(warningHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
                isQuotaError: true,
            })
        );
    });

    it('resets persistence warning backoff after channel-data save even when current-channel persistence is best-effort', async () => {
        expectConsoleWarn([
            'Failed to persist current channel',
            expect.objectContaining({
                name: 'ChannelError',
                code: AppErrorCode.STORAGE_QUOTA_EXCEEDED,
            }),
        ], { times: 3 });
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

        expect(warningHandler).toHaveBeenCalledTimes(3);
    });
});
