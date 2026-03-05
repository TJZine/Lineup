import { installMockLocalStorage, mockLocalStorage } from '../../../../__tests__/mocks/localStorage';
import { ChannelPersistenceStore } from '../ChannelPersistenceStore';
import { CURRENT_CHANNEL_KEY, STORAGE_KEY } from '../constants';

installMockLocalStorage();

describe('ChannelPersistenceStore', () => {
    beforeEach(() => {
        mockLocalStorage.clear();
        jest.restoreAllMocks();
    });

    it('returns null when no stored channel payload exists', () => {
        const store = new ChannelPersistenceStore();
        expect(store.readStoredChannelData()).toBeNull();
    });

    it('writes and reads current channel id using default keys', () => {
        const store = new ChannelPersistenceStore();

        store.writeCurrentChannelId('channel-9');

        expect(mockLocalStorage.getItem(CURRENT_CHANNEL_KEY)).toBe('channel-9');
        expect(store.readCurrentChannelId()).toBe('channel-9');
    });

    it('trims current channel id and rewrites normalized value', () => {
        const store = new ChannelPersistenceStore();
        mockLocalStorage.setItem(CURRENT_CHANNEL_KEY, '  channel-trim  ');

        expect(store.readCurrentChannelId()).toBe('channel-trim');
        expect(mockLocalStorage.getItem(CURRENT_CHANNEL_KEY)).toBe('channel-trim');
    });

    it('removes malformed JSON payload and returns null', () => {
        const store = new ChannelPersistenceStore();
        mockLocalStorage.setItem(STORAGE_KEY, '{bad-json');

        expect(store.readStoredChannelData()).toBeNull();
        expect(mockLocalStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('returns null and clears payload when top-level shape is invalid', () => {
        const store = new ChannelPersistenceStore();
        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify({ channels: 'bad', channelOrder: [] }));

        expect(store.readStoredChannelData()).toBeNull();
        expect(mockLocalStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('reads valid stored payload', () => {
        const store = new ChannelPersistenceStore();
        const payload = {
            channels: [],
            channelOrder: [],
            currentChannelId: null,
            savedAt: Date.now(),
        };
        mockLocalStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

        expect(store.readStoredChannelData()).toEqual(payload);
    });

    it('switches storage keys via setStorageKeys', () => {
        const store = new ChannelPersistenceStore();

        store.setStorageKeys('lineup_channels_server_v1:server-a:user-a', 'lineup_current_channel_v4:server-a:user-a');
        store.writeCurrentChannelId('channel-1');

        expect(mockLocalStorage.getItem('lineup_current_channel_v4:server-a:user-a')).toBe('channel-1');
        expect(mockLocalStorage.getItem(CURRENT_CHANNEL_KEY)).toBeNull();
    });

    it('treats blocked storage as non-fatal', () => {
        const store = new ChannelPersistenceStore();

        const getSpy = jest.spyOn(mockLocalStorage, 'getItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });
        const setSpy = jest.spyOn(mockLocalStorage, 'setItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });
        const removeSpy = jest.spyOn(mockLocalStorage, 'removeItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });

        expect(() => store.readStoredChannelData()).not.toThrow();
        expect(() => store.readCurrentChannelId()).not.toThrow();
        expect(() => store.writeCurrentChannelId('ch')).not.toThrow();
        expect(() => store.clearStoredChannelData()).not.toThrow();

        getSpy.mockRestore();
        setSpy.mockRestore();
        removeSpy.mockRestore();
    });
});
