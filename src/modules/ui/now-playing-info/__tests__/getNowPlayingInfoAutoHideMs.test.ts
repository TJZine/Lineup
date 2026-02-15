import { getNowPlayingInfoAutoHideMs } from '../NowPlayingInfoCoordinator';
import type { NowPlayingInfoConfig } from '../types';
import { RETUNE_STORAGE_KEYS } from '../../../../config/storageKeys';

const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};
Object.defineProperty(global, 'localStorage', { value: mockLocalStorage, configurable: true });

describe('getNowPlayingInfoAutoHideMs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns configured autoHideMs when storage is unset', () => {
        mockLocalStorage.getItem.mockReturnValue(null);
        const config: NowPlayingInfoConfig = { containerId: 'x', autoHideMs: 15_000 };
        expect(getNowPlayingInfoAutoHideMs(config)).toBe(15_000);
    });

    it('allows autoHideMs = 0 when storage is unset', () => {
        mockLocalStorage.getItem.mockReturnValue(null);
        const config: NowPlayingInfoConfig = { containerId: 'x', autoHideMs: 0 };
        expect(getNowPlayingInfoAutoHideMs(config)).toBe(0);
    });

    it('allows stored auto-hide value of 0', () => {
        mockLocalStorage.getItem.mockImplementation((key: string) =>
            key === RETUNE_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS ? '0' : null
        );
        const config: NowPlayingInfoConfig = { containerId: 'x', autoHideMs: 15_000 };
        expect(getNowPlayingInfoAutoHideMs(config)).toBe(0);
    });

    it('ignores whitespace-only stored auto-hide and uses config fallback', () => {
        mockLocalStorage.getItem.mockImplementation((key: string) =>
            key === RETUNE_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS ? '   ' : null
        );
        const config: NowPlayingInfoConfig = { containerId: 'x', autoHideMs: 15_000 };
        expect(getNowPlayingInfoAutoHideMs(config)).toBe(15_000);
    });

    it('ignores non-decimal stored auto-hide and uses config fallback', () => {
        mockLocalStorage.getItem.mockImplementation((key: string) =>
            key === RETUNE_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS ? '0x0' : null
        );
        const config: NowPlayingInfoConfig = { containerId: 'x', autoHideMs: 15_000 };
        expect(getNowPlayingInfoAutoHideMs(config)).toBe(15_000);
    });
});

