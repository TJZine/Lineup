/**
 * @jest-environment jsdom
 */

import { SettingsStore } from '../SettingsStore';
import { SETTINGS_STORAGE_KEYS, DEFAULT_SETTINGS } from '../constants';

const SUBTITLE_OPTIONS = [
    { code: null },
    { code: 'en' },
    { code: 'es' },
] as const;

const TRANSCODE_OPTIONS = [
    { storageValue: '' },
    { storageValue: '12000-1080p' },
] as const;

describe('SettingsStore', () => {
    let store: SettingsStore;

    beforeEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();
        store = new SettingsStore();
    });

    it('reads booleans with defaults and writes booleans as 1/0', () => {
        expect(store.readBool(SETTINGS_STORAGE_KEYS.DEBUG_LOGGING, false)).toBe(false);

        store.writeBool(SETTINGS_STORAGE_KEYS.DEBUG_LOGGING, true);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.DEBUG_LOGGING)).toBe('1');
        expect(store.readBool(SETTINGS_STORAGE_KEYS.DEBUG_LOGGING, false)).toBe(true);

        store.writeBool(SETTINGS_STORAGE_KEYS.DEBUG_LOGGING, false);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.DEBUG_LOGGING)).toBe('0');
    });

    it('normalizes invalid EPG info background mode by removing invalid persisted value', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '999');

        expect(store.readEpgInfoBackgroundModeValue()).toBe(DEFAULT_SETTINGS.display.epgInfoBackgroundMode);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE)).toBeNull();
    });

    it('normalizes invalid EPG past-items values by removing persisted value and returning fallback index', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW, 'bogus');

        expect(store.readEpgPastItemsWindowValue()).toBe(0);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW)).toBeNull();
    });

    it('normalizes subtitle language by trimming/lowercasing and removes invalid values', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE, ' EN ');
        expect(store.readSubtitleLanguageValue(SUBTITLE_OPTIONS)).toBe(1);

        localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE, 'zz');
        expect(store.readSubtitleLanguageValue(SUBTITLE_OPTIONS)).toBe(0);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE)).toBeNull();
    });

    it('normalizes transcode quality and removes unknown persisted values', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY, 'unknown-value');

        expect(store.readTranscodeQualityValue(TRANSCODE_OPTIONS)).toBe(0);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY)).toBeNull();

        store.writeTranscodeQualityValue(1, TRANSCODE_OPTIONS);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY)).toBe('12000-1080p');
    });

    it('clamps now-playing auto-hide values and rewrites fallback when persisted value is invalid', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS, '1234');

        const value = store.readClampedNowPlayingAutoHideValue([0, 5000, 10000], 0);

        expect(value).toBe(0);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS)).toBe('0');
    });

    it('treats blocked storage as non-fatal and returns defaults', () => {
        const getSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });
        const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });

        expect(() => store.readBool(SETTINGS_STORAGE_KEYS.DEBUG_LOGGING, false)).not.toThrow();
        expect(store.readBool(SETTINGS_STORAGE_KEYS.DEBUG_LOGGING, false)).toBe(false);
        expect(() => store.writeBool(SETTINGS_STORAGE_KEYS.DEBUG_LOGGING, true)).not.toThrow();

        getSpy.mockRestore();
        setSpy.mockRestore();
    });
});
