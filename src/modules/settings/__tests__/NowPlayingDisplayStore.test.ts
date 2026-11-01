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

    it('uses the overlay transparency enum independently of the Guide background mode', () => {
        expect(store.readOverlayTransparencyAndClean()).toBe('standard');
        expect(store.writeOverlayTransparency('more-transparent')).toEqual({ ok: true });
        expect(store.readOverlayTransparencyAndClean()).toBe('more-transparent');
        expect(store.writeOverlayTransparency('reduced')).toEqual({ ok: true });
        expect(store.readOverlayTransparencyAndClean()).toBe('reduced');

        localStorage.setItem(LINEUP_STORAGE_KEYS.OVERLAY_TRANSPARENCY, 'opaque');
        expect(store.readOverlayTransparencyAndClean()).toBe('standard');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.OVERLAY_TRANSPARENCY)).toBeNull();
    });

    it('uses a bounded compact-controls timeout independent of the legacy Info timeout', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS, '15000');

        expect(store.readCompactControlsTimeoutSecondsAndClean()).toBe(4);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.COMPACT_CONTROLS_TIMEOUT_SECONDS)).toBeNull();
        expect(store.writeCompactControlsTimeoutSeconds(6)).toEqual({ ok: true });
        expect(store.readCompactControlsTimeoutSecondsAndClean()).toBe(6);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS)).toBe('15000');

        localStorage.setItem(LINEUP_STORAGE_KEYS.COMPACT_CONTROLS_TIMEOUT_SECONDS, '7');
        expect(store.readCompactControlsTimeoutSecondsAndClean()).toBe(4);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.COMPACT_CONTROLS_TIMEOUT_SECONDS)).toBeNull();
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

    it('reports blocked writes without throwing', () => {
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });

        expect(store.writeCinematicNowPlayingEnabled(true)).toEqual({ ok: false, reason: 'unavailable' });
        expect(store.writePreferClearLogosEnabled(false)).toEqual({ ok: false, reason: 'unavailable' });
        expect(store.writeOverlayTransparency('reduced')).toEqual({ ok: false, reason: 'unavailable' });
        expect(store.writeCompactControlsTimeoutSeconds(6)).toEqual({ ok: false, reason: 'unavailable' });
        expect(store.writeAutoHideMs(5_000, NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS)).toEqual({
            ok: false,
            reason: 'unavailable',
        });
    });
});
