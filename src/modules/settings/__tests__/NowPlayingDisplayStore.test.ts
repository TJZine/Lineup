/**
 * @jest-environment jsdom
 */

import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS } from '../../ui/now-playing-info/constants';
import { NowPlayingDisplayStore } from '../NowPlayingDisplayStore';

describe('NowPlayingDisplayStore', () => {
    let store: NowPlayingDisplayStore;

    beforeEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
        store = new NowPlayingDisplayStore();
    });

    it('reads/writes cinematic and clear-logo toggles', () => {
        store.writeCinematicNowPlayingEnabled(true);
        store.writePreferClearLogosEnabled(false);

        expect(store.readCinematicNowPlayingEnabledAndClean(false)).toBe(true);
        expect(store.readPreferClearLogosEnabledAndClean(true)).toBe(false);
    });

    it('reads stored auto-hide values when valid and normalizes invalid persisted values', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS, '5000');
        expect(store.readClampedAutoHideMsAndClean(NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS, 7000)).toBe(5000);

        localStorage.setItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS, 'bogus');
        expect(store.readClampedAutoHideMsAndClean(NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS, 7000)).toBe(0);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS)).toBe('0');
    });

    it('normalizes invalid auto-hide writes to the first valid option', () => {
        store.writeAutoHideMs(7_000, NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS);

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS)).toBe('0');
        expect(store.readClampedAutoHideMsAndClean(NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS, 7_000)).toBe(0);
    });
});
