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
        expect(store.readHdr10FallbackModeValueAndClean()).toBe(1);

        store.writeSmartHdr10FallbackEnabled(false);
        store.writeForceHdr10FallbackEnabled(true);
        expect(store.readHdr10FallbackModeAndClean()).toBe('force');
        expect(store.readHdr10FallbackModeValueAndClean()).toBe(2);

        store.writeSmartHdr10FallbackEnabled(true);
        store.writeForceHdr10FallbackEnabled(true);
        expect(store.readHdr10FallbackModeAndClean()).toBe('force');
        expect(store.readHdr10FallbackModeValueAndClean()).toBe(2);
    });

    it('writes HDR10 fallback mode values through the storage owner', () => {
        store.writeHdr10FallbackModeValue(1);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK)).toBe('1');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK)).toBe('0');
        expect(store.readHdr10FallbackModeAndClean()).toBe('smart');

        store.writeHdr10FallbackModeValue(2);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK)).toBe('0');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK)).toBe('1');
        expect(store.readHdr10FallbackModeAndClean()).toBe('force');

        store.writeHdr10FallbackModeValue(0);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK)).toBe('0');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK)).toBe('0');
        expect(store.readHdr10FallbackModeAndClean()).toBe('off');
    });

    it('stops after a failed first HDR write and reports the original effective mode', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK, '0');
        localStorage.setItem(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK, '1');
        const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });

        expect(store.writeHdr10FallbackModeValue(1)).toEqual({
            ok: false,
            reason: 'unavailable',
            effectiveValue: 2,
        });
        expect(setSpy).toHaveBeenCalledTimes(1);
    });

    it('restores the exact prior first key after a failed second HDR write', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK, 'custom-prior');
        localStorage.setItem(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK, '1');
        const originalSetItem = Storage.prototype.setItem;
        const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
            this: Storage,
            key,
            value
        ): void {
            if (key === LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK && value === '0') {
                throw new DOMException('Blocked', 'SecurityError');
            }
            originalSetItem.call(this, key, value);
        });

        expect(store.writeHdr10FallbackModeValue(1)).toEqual({
            ok: false,
            reason: 'unavailable',
            effectiveValue: 2,
            compensationSucceeded: true,
        });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK)).toBe('custom-prior');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK)).toBe('1');
        expect(setSpy).toHaveBeenNthCalledWith(3, LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK, 'custom-prior');
    });

    it('reports the deterministic effective mode when HDR compensation also fails', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK, '1');
        localStorage.setItem(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK, '0');
        const originalSetItem = Storage.prototype.setItem;
        let writeCount = 0;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value): void {
            writeCount += 1;
            if (writeCount >= 2) {
                throw new DOMException('Blocked', 'SecurityError');
            }
            originalSetItem.call(this, key, value);
        });

        expect(store.writeHdr10FallbackModeValue(2)).toEqual({
            ok: false,
            reason: 'unavailable',
            effectiveValue: 2,
            compensationSucceeded: false,
        });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK)).toBe('1');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK)).toBe('1');
        expect(store.readHdr10FallbackModeValueAndClean()).toBe(2);
    });

    it('classifies HDR quota failures and restores the prior first key', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK, '0');
        localStorage.setItem(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK, '1');
        const originalSetItem = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value): void {
            if (key === LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK && value === '0') {
                throw new DOMException('Full', 'QuotaExceededError');
            }
            originalSetItem.call(this, key, value);
        });

        expect(store.writeHdr10FallbackModeValue(1)).toEqual({
            ok: false,
            reason: 'quota-exceeded',
            effectiveValue: 2,
            compensationSucceeded: true,
        });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK)).toBe('0');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK)).toBe('1');
    });

    it('removes a previously absent smart key when compensating a failed smart transition', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK, '1');
        const originalSetItem = Storage.prototype.setItem;
        const removeSpy = jest.spyOn(Storage.prototype, 'removeItem');
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value): void {
            if (key === LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK && value === '0') {
                throw new DOMException('Blocked', 'SecurityError');
            }
            originalSetItem.call(this, key, value);
        });

        expect(store.writeHdr10FallbackModeValue(1)).toEqual({
            ok: false,
            reason: 'unavailable',
            effectiveValue: 2,
            compensationSucceeded: true,
        });
        expect(removeSpy).toHaveBeenCalledWith(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK)).toBe('1');
    });

    it('restores a previously absent force key when the force transition second write fails', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK, '1');
        const originalSetItem = Storage.prototype.setItem;
        const removeSpy = jest.spyOn(Storage.prototype, 'removeItem');
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value): void {
            if (key === LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK && value === '0') {
                throw new DOMException('Blocked', 'SecurityError');
            }
            originalSetItem.call(this, key, value);
        });

        expect(store.writeHdr10FallbackModeValue(2)).toEqual({
            ok: false,
            reason: 'unavailable',
            effectiveValue: 1,
            compensationSucceeded: true,
        });
        expect(removeSpy).toHaveBeenCalledWith(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK);
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK)).toBe('1');
    });

    it('restores the prior smart key when the off transition second write fails', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK, '1');
        localStorage.setItem(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK, '1');
        const originalSetItem = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value): void {
            if (key === LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK && value === '0') {
                throw new DOMException('Blocked', 'SecurityError');
            }
            originalSetItem.call(this, key, value);
        });

        expect(store.writeHdr10FallbackModeValue(0)).toEqual({
            ok: false,
            reason: 'unavailable',
            effectiveValue: 2,
            compensationSucceeded: true,
        });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK)).toBe('1');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK)).toBe('1');
    });

    it.each([1, 2])('does not write when raw HDR read %i fails', (failedRead) => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.SMART_HDR10_FALLBACK, '1');
        localStorage.setItem(LINEUP_STORAGE_KEYS.FORCE_HDR10_FALLBACK, '0');
        const originalGetItem = Storage.prototype.getItem;
        let readCount = 0;
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key): string | null {
            readCount += 1;
            if (readCount === failedRead) {
                throw new DOMException('Blocked', 'SecurityError');
            }
            return originalGetItem.call(this, key);
        });
        const setSpy = jest.spyOn(Storage.prototype, 'setItem');

        expect(store.writeHdr10FallbackModeValue(2)).toEqual({ ok: false, reason: 'unavailable' });
        expect(setSpy).not.toHaveBeenCalled();
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
        expect(() => store.readHdr10FallbackModeValueAndClean()).not.toThrow();
        expect(() => store.readTranscodeQualityOptionAndClean()).not.toThrow();
        expect(() => store.readTranscodeQualityValueAndClean()).not.toThrow();
        expect(store.readTranscodeQualityValueAndClean()).toBe(0);
        expect(() => store.writeTranscodeCompatEnabled(true)).not.toThrow();
        expect(() => store.writeSmartHdr10FallbackEnabled(true)).not.toThrow();
        expect(() => store.writeForceHdr10FallbackEnabled(true)).not.toThrow();
        expect(store.writeHdr10FallbackModeValue(2)).toEqual({ ok: false, reason: 'unavailable' });
        expect(() => store.writeTranscodeQualityValue(1)).not.toThrow();

        getSpy.mockRestore();
        setSpy.mockRestore();
        removeSpy.mockRestore();
    });
});
