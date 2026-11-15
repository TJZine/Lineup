/**
 * @jest-environment jsdom
 */

import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { NowPlayingDisplayStore } from '../NowPlayingDisplayStore';

describe('NowPlayingDisplayStore', () => {
    let store: NowPlayingDisplayStore;

    beforeEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
        store = new NowPlayingDisplayStore();
    });

    it('reads and writes the clear-logo preference', () => {
        expect(store.writePreferClearLogosEnabled(false)).toEqual({ ok: true });
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

    it('uses a bounded compact-controls timeout', () => {
        expect(store.readCompactControlsTimeoutSecondsAndClean()).toBe(4);
        expect(store.writeCompactControlsTimeoutSeconds(6)).toEqual({ ok: true });
        expect(store.readCompactControlsTimeoutSecondsAndClean()).toBe(6);
        localStorage.setItem(LINEUP_STORAGE_KEYS.COMPACT_CONTROLS_TIMEOUT_SECONDS, '7');
        expect(store.readCompactControlsTimeoutSecondsAndClean()).toBe(4);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.COMPACT_CONTROLS_TIMEOUT_SECONDS)).toBeNull();
    });

    it('removes both retired viewing keys without changing current preferences or importing the old timeout', () => {
        localStorage.setItem('lineup_cinematic_now_playing', '1');
        localStorage.setItem('lineup_now_playing_info_auto_hide_ms', '15000');
        localStorage.setItem(LINEUP_STORAGE_KEYS.PREFER_CLEAR_LOGOS, '0');
        localStorage.setItem(LINEUP_STORAGE_KEYS.OVERLAY_TRANSPARENCY, 'reduced');

        expect(store.cleanupRetiredViewingSettings()).toEqual({ ok: true });
        expect(localStorage.getItem('lineup_cinematic_now_playing')).toBeNull();
        expect(localStorage.getItem('lineup_now_playing_info_auto_hide_ms')).toBeNull();
        expect(store.readPreferClearLogosEnabledAndClean()).toBe(false);
        expect(store.readOverlayTransparencyAndClean()).toBe('reduced');
        expect(store.readCompactControlsTimeoutSecondsAndClean()).toBe(4);

        expect(store.writeCompactControlsTimeoutSeconds(6)).toEqual({ ok: true });
        expect(store.cleanupRetiredViewingSettings()).toEqual({ ok: true });
        expect(store.readCompactControlsTimeoutSecondsAndClean()).toBe(6);
    });

    it('reports a failed removal and retries it independently on the next cleanup', () => {
        localStorage.setItem('lineup_cinematic_now_playing', '1');
        localStorage.setItem('lineup_now_playing_info_auto_hide_ms', '15000');
        const originalRemove = Storage.prototype.removeItem;
        const removeSpy = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key) {
            if (key === 'lineup_cinematic_now_playing') throw new DOMException('Blocked', 'SecurityError');
            originalRemove.call(this, key);
        });

        expect(store.cleanupRetiredViewingSettings()).toEqual({
            ok: false,
            failedKeys: ['lineup_cinematic_now_playing'],
        });
        expect(localStorage.getItem('lineup_cinematic_now_playing')).toBe('1');
        expect(localStorage.getItem('lineup_now_playing_info_auto_hide_ms')).toBeNull();

        removeSpy.mockRestore();
        expect(store.cleanupRetiredViewingSettings()).toEqual({ ok: true });
        expect(localStorage.getItem('lineup_cinematic_now_playing')).toBeNull();
    });

    it('reports blocked writes without throwing', () => {
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });

        expect(store.writePreferClearLogosEnabled(false)).toEqual({ ok: false, reason: 'unavailable' });
        expect(store.writeOverlayTransparency('reduced')).toEqual({ ok: false, reason: 'unavailable' });
        expect(store.writeCompactControlsTimeoutSeconds(6)).toEqual({ ok: false, reason: 'unavailable' });
    });
});
