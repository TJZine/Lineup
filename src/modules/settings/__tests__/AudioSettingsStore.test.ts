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
        expect(store.readDtsPassthroughEnabledAndClean()).toBe(false);
        expect(store.readDirectPlayAudioFallbackEnabledAndClean()).toBe(false);
        expect(store.readAudioSetupCompleteAndClean()).toBe(false);
    });

    it('reads/writes booleans as 1/0', () => {
        store.writeDtsPassthroughEnabled(true);
        store.writeDirectPlayAudioFallbackEnabled(true);
        store.writeAudioSetupComplete(true);

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.DTS_PASSTHROUGH)).toBe('1');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK)).toBe('1');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.AUDIO_SETUP_COMPLETE)).toBe('1');

        store.writeDtsPassthroughEnabled(false);
        store.writeDirectPlayAudioFallbackEnabled(false);
        store.writeAudioSetupComplete(false);

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.DTS_PASSTHROUGH)).toBe('0');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK)).toBe('0');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.AUDIO_SETUP_COMPLETE)).toBe('0');
    });

    it('normalizes invalid values by removing persisted garbage', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.DTS_PASSTHROUGH, 'bogus');
        localStorage.setItem(LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK, 'bogus');
        localStorage.setItem(LINEUP_STORAGE_KEYS.AUDIO_SETUP_COMPLETE, 'bogus');

        expect(store.readDtsPassthroughEnabledAndClean()).toBe(false);
        expect(store.readDirectPlayAudioFallbackEnabledAndClean()).toBe(false);
        expect(store.readAudioSetupCompleteAndClean()).toBe(false);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.DTS_PASSTHROUGH)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.AUDIO_SETUP_COMPLETE)).toBeNull();
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

        expect(() => store.readDtsPassthroughEnabledAndClean()).not.toThrow();
        expect(() => store.readDirectPlayAudioFallbackEnabledAndClean()).not.toThrow();
        expect(() => store.readAudioSetupCompleteAndClean()).not.toThrow();
        expect(() => store.writeDtsPassthroughEnabled(true)).not.toThrow();
        expect(() => store.writeDirectPlayAudioFallbackEnabled(true)).not.toThrow();
        expect(() => store.writeAudioSetupComplete(true)).not.toThrow();
        expect(() => store.clearDirectPlayAudioFallbackEnabled()).not.toThrow();

        getSpy.mockRestore();
        setSpy.mockRestore();
        removeSpy.mockRestore();
    });
});
