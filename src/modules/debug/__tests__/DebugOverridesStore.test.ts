/**
 * @jest-environment jsdom
 */

import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { DebugOverridesStore } from '../DebugOverridesStore';

describe('DebugOverridesStore', () => {
    let store: DebugOverridesStore;

    beforeEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
        store = new DebugOverridesStore();
    });

    it('returns default disabled values when debug keys are missing', () => {
        expect(store.readNowPlayingStreamDebugEnabled()).toBe(false);
        expect(store.readNowPlayingStreamDebugAutoShowEnabled()).toBe(false);
        expect(store.readEpgDebugEnabled()).toBe(false);
        expect(store.readTranscodeProfileName()).toBeNull();
    });

    it('reads and writes now-playing debug flags as 1/0', () => {
        store.writeNowPlayingStreamDebugEnabled(true);
        store.writeNowPlayingStreamDebugAutoShowEnabled(true);
        store.writeEpgDebugEnabled(true);

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG)).toBe('1');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG_AUTO_SHOW)).toBe('1');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_DEBUG)).toBe('1');
        expect(store.readNowPlayingStreamDebugEnabled()).toBe(true);
        expect(store.readNowPlayingStreamDebugAutoShowEnabled()).toBe(true);
        expect(store.readEpgDebugEnabled()).toBe(true);

        store.writeNowPlayingStreamDebugEnabled(false);
        store.writeNowPlayingStreamDebugAutoShowEnabled(false);
        store.writeEpgDebugEnabled(false);

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG)).toBe('0');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG_AUTO_SHOW)).toBe('0');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_DEBUG)).toBe('0');
    });

    it('normalizes invalid boolean values by removing persisted garbage', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG, 'bogus');
        localStorage.setItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG_AUTO_SHOW, 'bogus');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_DEBUG, 'bogus');

        expect(store.readNowPlayingStreamDebugEnabled()).toBe(false);
        expect(store.readNowPlayingStreamDebugAutoShowEnabled()).toBe(false);
        expect(store.readEpgDebugEnabled()).toBe(false);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG_AUTO_SHOW)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_DEBUG)).toBeNull();
    });

    it('reads and normalizes transcode profile name (trim + clamp + rewrite)', () => {
        const longName = `  ${'A'.repeat(200)}  `;
        localStorage.setItem(LINEUP_STORAGE_KEYS.TRANSCODE_PROFILE_NAME, longName);

        const value = store.readTranscodeProfileName();

        expect(value).toBe('A'.repeat(128));
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.TRANSCODE_PROFILE_NAME)).toBe('A'.repeat(128));
    });

    it('removes invalid transcode profile names', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.TRANSCODE_PROFILE_NAME, 'bad\nname');

        expect(store.readTranscodeProfileName()).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.TRANSCODE_PROFILE_NAME)).toBeNull();

        store.writeTranscodeProfileName('   ');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.TRANSCODE_PROFILE_NAME)).toBeNull();
    });

    it('clears playback override keys without disabling EPG debug', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG, '1');
        localStorage.setItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG_AUTO_SHOW, '1');
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_DEBUG, '1');
        localStorage.setItem(LINEUP_STORAGE_KEYS.TRANSCODE_PROFILE_NAME, 'HTML TV App');

        store.clearDebugOverrides();

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.NOW_PLAYING_STREAM_DEBUG_AUTO_SHOW)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.TRANSCODE_PROFILE_NAME)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_DEBUG)).toBe('1');
    });

    it('treats blocked storage as non-fatal', () => {
        const getSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });
        const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });
        const removeSpy = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });

        expect(() => store.readNowPlayingStreamDebugEnabled()).not.toThrow();
        expect(() => store.readNowPlayingStreamDebugAutoShowEnabled()).not.toThrow();
        expect(() => store.readEpgDebugEnabled()).not.toThrow();
        expect(() => store.readTranscodeProfileName()).not.toThrow();
        expect(() => store.writeNowPlayingStreamDebugEnabled(true)).not.toThrow();
        expect(() => store.writeNowPlayingStreamDebugAutoShowEnabled(true)).not.toThrow();
        expect(() => store.writeEpgDebugEnabled(true)).not.toThrow();
        expect(() => store.writeTranscodeProfileName('HTML TV App')).not.toThrow();
        expect(() => store.clearDebugOverrides()).not.toThrow();

        getSpy.mockRestore();
        setSpy.mockRestore();
        removeSpy.mockRestore();
    });
});
