/**
 * @jest-environment jsdom
 */

import { LINEUP_STORAGE_KEYS } from '../../../config/storageKeys';
import { TRANSCODE_QUALITY_OPTIONS } from '../../../config/transcodeQuality';
import { PlaybackSettingsStore } from '../PlaybackSettingsStore';

describe('PlaybackSettingsStore', () => {
    let store: PlaybackSettingsStore;

    beforeEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
        store = new PlaybackSettingsStore();
    });

    it('defaults transcode compat and HDR fallback mode to false/off when storage is missing', () => {
        expect(store.readTranscodeCompatEnabledAndClean(false)).toBe(false);
        expect(store.readSmartHdr10FallbackEnabledAndClean(false)).toBe(false);
        expect(store.readForceHdr10FallbackEnabledAndClean(false)).toBe(false);
        expect(store.readHdr10FallbackModeAndClean()).toBe('off');
    });

    it('reads/writes boolean playback knobs as 1/0', () => {
        store.writeTranscodeCompatEnabled(true);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.TRANSCODE_COMPAT)).toBe('1');
        expect(store.readTranscodeCompatEnabledAndClean()).toBe(true);

        store.writeSmartHdr10FallbackEnabled(true);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK)).toBe('1');
        expect(store.readSmartHdr10FallbackEnabledAndClean()).toBe(true);

        store.writeForceHdr10FallbackEnabled(true);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK)).toBe('1');
        expect(store.readForceHdr10FallbackEnabledAndClean()).toBe(true);
    });

    it('normalizes invalid boolean values by removing them and falling back', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.TRANSCODE_COMPAT, 'yes');
        localStorage.setItem(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK, 'bad');
        localStorage.setItem(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK, 'bad');

        expect(store.readTranscodeCompatEnabledAndClean(false)).toBe(false);
        expect(store.readSmartHdr10FallbackEnabledAndClean(false)).toBe(false);
        expect(store.readForceHdr10FallbackEnabledAndClean(false)).toBe(false);

        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.TRANSCODE_COMPAT)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK)).toBeNull();
    });

    it('applies force-over-smart semantics for HDR10 fallback mode', () => {
        store.writeSmartHdr10FallbackEnabled(true);
        store.writeForceHdr10FallbackEnabled(false);
        expect(store.readHdr10FallbackModeAndClean()).toBe('smart');

        store.writeSmartHdr10FallbackEnabled(false);
        store.writeForceHdr10FallbackEnabled(true);
        expect(store.readHdr10FallbackModeAndClean()).toBe('force');

        store.writeSmartHdr10FallbackEnabled(true);
        store.writeForceHdr10FallbackEnabled(true);
        expect(store.readHdr10FallbackModeAndClean()).toBe('force');
    });

    it('reads transcode quality value/option via one normalization path and removes invalid raw values', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.TRANSCODE_QUALITY, '4000-720p');

        expect(store.readTranscodeQualityOptionAndClean()?.storageValue).toBe('4000-720p');
        expect(store.readTranscodeQualityValueAndClean(TRANSCODE_QUALITY_OPTIONS)).toBe(3);

        localStorage.setItem(LINEUP_STORAGE_KEYS.TRANSCODE_QUALITY, 'bogus');
        expect(store.readTranscodeQualityOptionAndClean()).toBeNull();
        expect(store.readTranscodeQualityValueAndClean(TRANSCODE_QUALITY_OPTIONS)).toBe(0);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.TRANSCODE_QUALITY)).toBeNull();
    });

    it('removes persisted transcode quality when the caller option list no longer supports it', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.TRANSCODE_QUALITY, '4000-720p');

        expect(store.readTranscodeQualityValueAndClean([{ storageValue: '' }, { storageValue: '12000-1080p' }])).toBe(0);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.TRANSCODE_QUALITY)).toBeNull();
    });

    it('writes transcode quality and removes key for invalid/empty option selections', () => {
        store.writeTranscodeQualityValue(1);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.TRANSCODE_QUALITY)).toBe('12000-1080p');

        localStorage.setItem(LINEUP_STORAGE_KEYS.TRANSCODE_QUALITY, '4000-720p');
        store.writeTranscodeQualityValue(99);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.TRANSCODE_QUALITY)).toBeNull();

        store.writeTranscodeQualityValue(0);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.TRANSCODE_QUALITY)).toBeNull();
    });

    it('is non-fatal when localStorage is blocked', () => {
        const getSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });
        const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });
        const removeSpy = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });

        expect(() => store.readTranscodeCompatEnabledAndClean(false)).not.toThrow();
        expect(store.readTranscodeCompatEnabledAndClean(false)).toBe(false);
        expect(() => store.readSmartHdr10FallbackEnabledAndClean(false)).not.toThrow();
        expect(() => store.readForceHdr10FallbackEnabledAndClean(false)).not.toThrow();
        expect(() => store.readHdr10FallbackModeAndClean()).not.toThrow();
        expect(() => store.readTranscodeQualityOptionAndClean()).not.toThrow();
        expect(() => store.readTranscodeQualityValueAndClean()).not.toThrow();
        expect(store.readTranscodeQualityValueAndClean()).toBe(0);
        expect(() => store.writeTranscodeCompatEnabled(true)).not.toThrow();
        expect(() => store.writeSmartHdr10FallbackEnabled(true)).not.toThrow();
        expect(() => store.writeForceHdr10FallbackEnabled(true)).not.toThrow();
        expect(() => store.writeTranscodeQualityValue(1)).not.toThrow();

        getSpy.mockRestore();
        setSpy.mockRestore();
        removeSpy.mockRestore();
    });
});
