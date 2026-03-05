/**
 * @jest-environment jsdom
 */

import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { AudioSettingsStore } from '../AudioSettingsStore';

describe('AudioSettingsStore', () => {
    let store: AudioSettingsStore;

    beforeEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
        store = new AudioSettingsStore();
    });

    it('returns defaults when keys are missing', () => {
        expect(store.readDtsPassthroughEnabled()).toBe(false);
        expect(store.readDirectPlayAudioFallbackEnabled()).toBe(false);
    });

    it('reads/writes booleans as 1/0', () => {
        store.writeDtsPassthroughEnabled(true);
        store.writeDirectPlayAudioFallbackEnabled(true);

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.DTS_PASSTHROUGH)).toBe('1');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK)).toBe('1');

        store.writeDtsPassthroughEnabled(false);
        store.writeDirectPlayAudioFallbackEnabled(false);

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.DTS_PASSTHROUGH)).toBe('0');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK)).toBe('0');
    });

    it('normalizes invalid values by removing persisted garbage', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.DTS_PASSTHROUGH, 'bogus');
        localStorage.setItem(LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK, 'bogus');

        expect(store.readDtsPassthroughEnabled()).toBe(false);
        expect(store.readDirectPlayAudioFallbackEnabled()).toBe(false);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.DTS_PASSTHROUGH)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK)).toBeNull();
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

        expect(() => store.readDtsPassthroughEnabled()).not.toThrow();
        expect(() => store.readDirectPlayAudioFallbackEnabled()).not.toThrow();
        expect(() => store.writeDtsPassthroughEnabled(true)).not.toThrow();
        expect(() => store.writeDirectPlayAudioFallbackEnabled(true)).not.toThrow();
        expect(() => store.clearDirectPlayAudioFallbackEnabled()).not.toThrow();

        getSpy.mockRestore();
        setSpy.mockRestore();
        removeSpy.mockRestore();
    });
});
