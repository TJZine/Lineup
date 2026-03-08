import { installMockLocalStorage, mockLocalStorage } from '../../../../__tests__/mocks/localStorage';
import { ChannelPersistenceStore } from '../ChannelPersistenceStore';
import { ChannelRepository } from '../ChannelRepository';
import { CURRENT_CHANNEL_KEY, STORAGE_KEY } from '../constants';
import type { StoredChannelData } from '../types';

installMockLocalStorage();

describe('ChannelRepository', () => {
    beforeEach(() => {
        mockLocalStorage.clear();
        jest.restoreAllMocks();
    });

    it('returns null and does not read current-channel key when payload missing', () => {
        const repo = new ChannelRepository();
        const readCurrentSpy = jest.spyOn(ChannelPersistenceStore.prototype, 'readCurrentChannelId');

        expect(repo.load()).toEqual({ stored: null, savedCurrentChannelId: null });
        expect(readCurrentSpy).not.toHaveBeenCalled();
    });

    it('returns null and does not read current-channel key when payload is invalid', () => {
        const repo = new ChannelRepository();
        const readCurrentSpy = jest.spyOn(ChannelPersistenceStore.prototype, 'readCurrentChannelId');
        mockLocalStorage.setItem(STORAGE_KEY, '{bad-json');
        mockLocalStorage.setItem(CURRENT_CHANNEL_KEY, 'channel-1');

        expect(repo.load()).toEqual({ stored: null, savedCurrentChannelId: null });
        expect(readCurrentSpy).not.toHaveBeenCalled();
    });

    it('reads stored payload and current-channel value together', () => {
        const repo = new ChannelRepository();
        const payload = {
            channels: [],
            channelOrder: [],
            currentChannelId: null,
            savedAt: Date.now(),
        } satisfies Partial<StoredChannelData>;
        const loadSpy = jest.spyOn(ChannelPersistenceStore.prototype, 'readStoredChannelData');
        const readCurrentSpy = jest.spyOn(ChannelPersistenceStore.prototype, 'readCurrentChannelId');
        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        mockLocalStorage.setItem(CURRENT_CHANNEL_KEY, 'channel-1');

        expect(repo.load()).toEqual({
            stored: payload,
            savedCurrentChannelId: 'channel-1',
        });
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(readCurrentSpy).toHaveBeenCalledTimes(1);
    });

    it('saveStoredChannelData delegates to store writer', () => {
        const repo = new ChannelRepository();
        const delegate = jest.spyOn(ChannelPersistenceStore.prototype, 'writeStoredChannelData').mockReturnValue('ok');
        const data = {
            channels: [],
            channelOrder: [],
            currentChannelId: null,
            savedAt: Date.now(),
        } as StoredChannelData;

        expect(repo.saveStoredChannelData(data)).toBe('ok');
        expect(delegate).toHaveBeenCalledWith(data);
    });

    it('saveCurrentChannelId delegates to store writer', () => {
        const repo = new ChannelRepository();
        const delegate = jest.spyOn(ChannelPersistenceStore.prototype, 'writeCurrentChannelId').mockReturnValue('ok');

        expect(repo.saveCurrentChannelId('channel-1')).toBe('ok');
        expect(delegate).toHaveBeenCalledWith('channel-1');
    });

    it('treats blocked storage on load through the underlying helper as non-fatal', () => {
        const repo = new ChannelRepository();
        jest.spyOn(mockLocalStorage, 'getItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });

        expect(() => repo.load()).not.toThrow();
    });
});
