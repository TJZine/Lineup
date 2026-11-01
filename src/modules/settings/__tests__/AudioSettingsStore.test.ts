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
        expect(store.readDtsPassthroughState()).toEqual({
            kind: 'default',
            effectiveValue: false,
            reason: 'missing',
        });
        expect(store.readDirectPlayAudioFallbackState(true)).toEqual({
            kind: 'default',
            effectiveValue: true,
            reason: 'missing',
        });
    });

    it('distinguishes confirmed stored values for each preference', () => {
        store.writeDtsPassthroughEnabled(true);
        store.writeDirectPlayAudioFallbackEnabled(false);

        expect(store.readDtsPassthroughState()).toEqual({ kind: 'stored', value: true });
        expect(store.readDirectPlayAudioFallbackState(true)).toEqual({ kind: 'stored', value: false });

        store.writeDtsPassthroughEnabled(false);
        store.writeDirectPlayAudioFallbackEnabled(true);

        expect(store.readDtsPassthroughState(true)).toEqual({ kind: 'stored', value: false });
        expect(store.readDirectPlayAudioFallbackState()).toEqual({ kind: 'stored', value: true });
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

        expect(store.readDtsPassthroughState(true)).toEqual({
            kind: 'default',
            effectiveValue: true,
            reason: 'invalid',
        });
        expect(store.readDirectPlayAudioFallbackState()).toEqual({
            kind: 'default',
            effectiveValue: false,
            reason: 'invalid',
        });
        expect(store.readDtsPassthroughEnabledAndClean()).toBe(false);
        expect(store.readDirectPlayAudioFallbackEnabledAndClean()).toBe(false);
        expect(store.readAudioSetupCompleteAndClean()).toBe(false);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.DTS_PASSTHROUGH)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.AUDIO_SETUP_COMPLETE)).toBeNull();
    });

    it('reports blocked reads as unavailable without claiming saved values', () => {
        const getSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });

        try {
            expect(store.readDtsPassthroughState(true)).toEqual({ kind: 'unavailable', effectiveValue: true });
            expect(store.readDirectPlayAudioFallbackState()).toEqual({ kind: 'unavailable', effectiveValue: false });
        } finally {
            getSpy.mockRestore();
        }
    });

    it('performs fresh reads after a partial audio preference update', () => {
        store.writeDtsPassthroughEnabled(true);
        store.writeDirectPlayAudioFallbackEnabled(false);
        expect(store.readDtsPassthroughState()).toEqual({ kind: 'stored', value: true });
        expect(store.readDirectPlayAudioFallbackState()).toEqual({ kind: 'stored', value: false });

        const originalSetItem = Storage.prototype.setItem;
        const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
            if (key === LINEUP_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK) {
                throw new DOMException('Blocked', 'SecurityError');
            }
            return originalSetItem.call(this, key, value);
        });
        try {
            expect(store.writeDtsPassthroughEnabled(false)).toEqual({ ok: true });
            expect(store.writeDirectPlayAudioFallbackEnabled(true)).toEqual({ ok: false, reason: 'unavailable' });
        } finally {
            setSpy.mockRestore();
        }

        expect(store.readDtsPassthroughState()).toEqual({ kind: 'stored', value: false });
        expect(store.readDirectPlayAudioFallbackState()).toEqual({ kind: 'stored', value: false });
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
        expect(store.writeDtsPassthroughEnabled(true)).toEqual({ ok: false, reason: 'unavailable' });
        expect(store.writeDirectPlayAudioFallbackEnabled(true)).toEqual({ ok: false, reason: 'unavailable' });
        expect(() => store.writeAudioSetupComplete(true)).not.toThrow();
        expect(() => store.clearDirectPlayAudioFallbackEnabled()).not.toThrow();

        getSpy.mockRestore();
        setSpy.mockRestore();
        removeSpy.mockRestore();
    });
});
