/**
 * @jest-environment jsdom
 */

import { SettingsStore } from '../SettingsStore';
import { SETTINGS_STORAGE_KEYS, DEFAULT_SETTINGS } from '../constants';
import type { DeveloperSettingsStore } from '../../../settings/DeveloperSettingsStore';

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

    it('delegates debug logging toggle reads/writes to DeveloperSettingsStore', () => {
        const developerSettingsStore = {
            readDebugLoggingEnabled: jest.fn().mockReturnValue(true),
            writeDebugLoggingEnabled: jest.fn(),
            readSubtitleDebugLoggingEnabled: jest.fn().mockReturnValue(false),
            writeSubtitleDebugLoggingEnabled: jest.fn(),
        } as unknown as DeveloperSettingsStore;
        const delegatedStore = new SettingsStore({ developerSettingsStore });

        expect(delegatedStore.readToggleSetting('debugLogging')).toBe(true);
        expect(developerSettingsStore.readDebugLoggingEnabled).toHaveBeenCalledWith(DEFAULT_SETTINGS.developer.debugLogging);

        delegatedStore.writeToggleSetting('debugLogging', true);
        expect(developerSettingsStore.writeDebugLoggingEnabled).toHaveBeenCalledWith(true);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.DEBUG_LOGGING)).toBeNull();
    });

    it('delegates subtitle debug logging toggle reads/writes to DeveloperSettingsStore', () => {
        const developerSettingsStore = {
            readDebugLoggingEnabled: jest.fn().mockReturnValue(false),
            writeDebugLoggingEnabled: jest.fn(),
            readSubtitleDebugLoggingEnabled: jest.fn().mockReturnValue(true),
            writeSubtitleDebugLoggingEnabled: jest.fn(),
        } as unknown as DeveloperSettingsStore;
        const delegatedStore = new SettingsStore({ developerSettingsStore });

        expect(delegatedStore.readToggleSetting('subtitleDebugLogging')).toBe(true);
        expect(developerSettingsStore.readSubtitleDebugLoggingEnabled).toHaveBeenCalledWith(DEFAULT_SETTINGS.developer.subtitleDebugLogging);

        delegatedStore.writeToggleSetting('subtitleDebugLogging', false);
        expect(developerSettingsStore.writeSubtitleDebugLoggingEnabled).toHaveBeenCalledWith(false);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING)).toBeNull();
    });

    it('defaults epgNowWatchingEnabled toggle to true when missing', () => {
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED)).toBeNull();
        expect(store.readToggleSetting('epgNowWatchingEnabled')).toBe(true);
    });

    it('reads/writes hdr10 fallback mode values 0/1/2 via semantic helpers', () => {
        store.writeHdr10FallbackModeValue(1);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.SMART_HDR10_FALLBACK)).toBe('1');
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.FORCE_HDR10_FALLBACK)).toBe('0');
        expect(store.readHdr10FallbackModeValue()).toBe(1);

        store.writeHdr10FallbackModeValue(2);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.SMART_HDR10_FALLBACK)).toBe('0');
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.FORCE_HDR10_FALLBACK)).toBe('1');
        expect(store.readHdr10FallbackModeValue()).toBe(2);

        store.writeHdr10FallbackModeValue(0);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.SMART_HDR10_FALLBACK)).toBe('0');
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.FORCE_HDR10_FALLBACK)).toBe('0');
        expect(store.readHdr10FallbackModeValue()).toBe(0);
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

    it('reads EPG guide density and removes invalid persisted values', () => {
        expect(store.readEpgGuideDensityValue()).toBe(0);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_GUIDE_DENSITY)).toBeNull();

        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_GUIDE_DENSITY, 'wide');
        expect(store.readEpgGuideDensityValue()).toBe(1);

        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_GUIDE_DENSITY, 'detailed');
        expect(store.readEpgGuideDensityValue()).toBe(0);

        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_GUIDE_DENSITY, 'bogus');
        expect(store.readEpgGuideDensityValue()).toBe(0);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_GUIDE_DENSITY)).toBeNull();
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

    it('clears persisted transcode quality when the UI option list no longer supports the stored value', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY, '4000-720p');

        expect(store.readTranscodeQualityValue(TRANSCODE_OPTIONS)).toBe(0);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY)).toBeNull();
    });

    it('clamps now-playing auto-hide values and rewrites fallback when persisted value is invalid', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS, '1234');

        const value = store.readClampedNowPlayingAutoHideValue([0, 5000, 10000], 0);

        expect(value).toBe(0);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS)).toBe('0');
    });

    it('uses fallback when persisted now-playing auto-hide value is non-numeric and validates fallback against options', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS, 'bogus');

        const value = store.readClampedNowPlayingAutoHideValue([0, 5000], 5000);

        expect(value).toBe(5000);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS)).toBe('5000');
    });

    it('chooses a safe default when fallback is not in validOptions', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS, 'bogus');

        const value = store.readClampedNowPlayingAutoHideValue([5000], 1234);

        expect(value).toBe(5000);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS)).toBe('5000');
    });

    it('semantic toggle methods remain non-fatal when storage is blocked', () => {
        const getSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });
        const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });

        expect(() => store.readToggleSetting('debugLogging')).not.toThrow();
        expect(store.readToggleSetting('debugLogging')).toBe(DEFAULT_SETTINGS.developer.debugLogging);
        expect(() => store.writeToggleSetting('debugLogging', true)).not.toThrow();

        getSpy.mockRestore();
        setSpy.mockRestore();
    });
});
