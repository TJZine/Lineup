/**
 * @jest-environment jsdom
 */

import { SettingsStore } from '../SettingsStore';
import type { SettingsStoreOptions } from '../SettingsStore';
import { SETTINGS_STORAGE_KEYS, DEFAULT_SETTINGS } from '../constants';
import { LINEUP_STORAGE_KEYS } from '../../../../config/storageKeys';
import type { DeveloperSettingsStore } from '../../../settings/DeveloperSettingsStore';
import { EPG_PAST_ITEMS_WINDOWS } from '../../../settings/EpgPreferencesStore';

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
            readDebugLoggingEnabledAndClean: jest.fn().mockReturnValue(true),
            writeDebugLoggingEnabled: jest.fn().mockReturnValue({ ok: true }),
            readSubtitleDebugLoggingEnabledAndClean: jest.fn().mockReturnValue(false),
            writeSubtitleDebugLoggingEnabled: jest.fn().mockReturnValue({ ok: true }),
        } as unknown as DeveloperSettingsStore;
        const delegatedStore = new SettingsStore({ developerSettingsStore });

        expect(delegatedStore.readToggleSettingAndClean('debugLogging')).toBe(true);
        expect(developerSettingsStore.readDebugLoggingEnabledAndClean).toHaveBeenCalledWith(
            DEFAULT_SETTINGS.developer.debugLogging
        );

        delegatedStore.writeToggleSetting('debugLogging', true);
        expect(developerSettingsStore.writeDebugLoggingEnabled).toHaveBeenCalledWith(true);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.DEBUG_LOGGING)).toBeNull();
    });

    it('delegates subtitle debug logging toggle reads/writes to DeveloperSettingsStore', () => {
        const developerSettingsStore = {
            readDebugLoggingEnabledAndClean: jest.fn().mockReturnValue(false),
            writeDebugLoggingEnabled: jest.fn().mockReturnValue({ ok: true }),
            readSubtitleDebugLoggingEnabledAndClean: jest.fn().mockReturnValue(true),
            writeSubtitleDebugLoggingEnabled: jest.fn().mockReturnValue({ ok: true }),
        } as unknown as DeveloperSettingsStore;
        const delegatedStore = new SettingsStore({ developerSettingsStore });

        expect(delegatedStore.readToggleSettingAndClean('subtitleDebugLogging')).toBe(true);
        expect(developerSettingsStore.readSubtitleDebugLoggingEnabledAndClean).toHaveBeenCalledWith(
            DEFAULT_SETTINGS.developer.subtitleDebugLogging
        );

        delegatedStore.writeToggleSetting('subtitleDebugLogging', false);
        expect(developerSettingsStore.writeSubtitleDebugLoggingEnabled).toHaveBeenCalledWith(false);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING)).toBeNull();
    });

    it('delegates smart/force HDR fallback toggle reads and writes explicitly', () => {
        const playbackSettingsStore = {
            readTranscodeCompatEnabledAndClean: jest.fn().mockReturnValue(false),
            writeTranscodeCompatEnabled: jest.fn(),
            readSmartHdr10FallbackEnabledAndClean: jest.fn().mockReturnValue(true),
            writeSmartHdr10FallbackEnabled: jest.fn().mockReturnValue({ ok: true }),
            readForceHdr10FallbackEnabledAndClean: jest.fn().mockReturnValue(false),
            writeForceHdr10FallbackEnabled: jest.fn().mockReturnValue({ ok: true }),
            readHdr10FallbackModeValueAndClean: jest.fn().mockReturnValue(0),
            writeHdr10FallbackModeValue: jest.fn().mockReturnValue({ ok: true }),
        } as unknown as NonNullable<SettingsStoreOptions['playbackSettingsStore']>;

        const delegatedStore = new SettingsStore({ playbackSettingsStore });

        expect(delegatedStore.readToggleSettingAndClean('smartHdr10Fallback')).toBe(true);
        expect(playbackSettingsStore.readSmartHdr10FallbackEnabledAndClean).toHaveBeenCalledWith(
            DEFAULT_SETTINGS.playback.smartHdr10Fallback
        );

        expect(delegatedStore.readToggleSettingAndClean('forceHdr10Fallback')).toBe(false);
        expect(playbackSettingsStore.readForceHdr10FallbackEnabledAndClean).toHaveBeenCalledWith(
            DEFAULT_SETTINGS.playback.forceHdr10Fallback
        );

        delegatedStore.writeToggleSetting('smartHdr10Fallback', false);
        delegatedStore.writeToggleSetting('forceHdr10Fallback', true);

        expect(playbackSettingsStore.writeSmartHdr10FallbackEnabled).toHaveBeenCalledWith(false);
        expect(playbackSettingsStore.writeForceHdr10FallbackEnabled).toHaveBeenCalledWith(true);
    });

    it('delegates HDR10 fallback mode value reads and writes to PlaybackSettingsStore', () => {
        const playbackSettingsStore = {
            readTranscodeCompatEnabledAndClean: jest.fn().mockReturnValue(false),
            writeTranscodeCompatEnabled: jest.fn(),
            readSmartHdr10FallbackEnabledAndClean: jest.fn(() => {
                throw new Error('SettingsStore must not compute HDR10 fallback mode from raw toggles');
            }),
            writeSmartHdr10FallbackEnabled: jest.fn().mockReturnValue({ ok: true }),
            readForceHdr10FallbackEnabledAndClean: jest.fn(() => {
                throw new Error('SettingsStore must not compute HDR10 fallback mode from raw toggles');
            }),
            writeForceHdr10FallbackEnabled: jest.fn().mockReturnValue({ ok: true }),
            readHdr10FallbackModeValueAndClean: jest.fn().mockReturnValue(2),
            writeHdr10FallbackModeValue: jest.fn().mockReturnValue({ ok: true }),
        } as unknown as NonNullable<SettingsStoreOptions['playbackSettingsStore']>;
        const delegatedStore = new SettingsStore({ playbackSettingsStore });

        expect(delegatedStore.readHdr10FallbackModeValueAndClean()).toBe(2);
        delegatedStore.writeHdr10FallbackModeValue(1);

        expect(playbackSettingsStore.readHdr10FallbackModeValueAndClean).toHaveBeenCalled();
        expect(playbackSettingsStore.writeHdr10FallbackModeValue).toHaveBeenCalledWith(1);
        expect(playbackSettingsStore.readSmartHdr10FallbackEnabledAndClean).not.toHaveBeenCalled();
        expect(playbackSettingsStore.readForceHdr10FallbackEnabledAndClean).not.toHaveBeenCalled();
        expect(playbackSettingsStore.writeSmartHdr10FallbackEnabled).not.toHaveBeenCalled();
        expect(playbackSettingsStore.writeForceHdr10FallbackEnabled).not.toHaveBeenCalled();
    });

    it('defaults epgNowWatchingEnabled toggle to true when missing', () => {
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED)).toBeNull();
        expect(store.readToggleSettingAndClean('epgNowWatchingEnabled')).toBe(true);
    });

    it('reads/writes hdr10 fallback mode values 0/1/2 via semantic helpers', () => {
        store.writeHdr10FallbackModeValue(1);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.SMART_HDR10_FALLBACK)).toBe('1');
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.FORCE_HDR10_FALLBACK)).toBe('0');
        expect(store.readHdr10FallbackModeValueAndClean()).toBe(1);

        store.writeHdr10FallbackModeValue(2);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.SMART_HDR10_FALLBACK)).toBe('0');
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.FORCE_HDR10_FALLBACK)).toBe('1');
        expect(store.readHdr10FallbackModeValueAndClean()).toBe(2);

        store.writeHdr10FallbackModeValue(0);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.SMART_HDR10_FALLBACK)).toBe('0');
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.FORCE_HDR10_FALLBACK)).toBe('0');
        expect(store.readHdr10FallbackModeValueAndClean()).toBe(0);
    });

    it('normalizes invalid EPG info background mode by removing invalid persisted value', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '999');

        expect(store.readEpgInfoBackgroundModeValueAndClean()).toBe(DEFAULT_SETTINGS.display.epgInfoBackgroundMode);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE)).toBeNull();
    });

    it('normalizes invalid EPG past-items values by removing persisted value and returning fallback index', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW, 'bogus');

        expect(store.readEpgPastItemsWindowValueAndClean()).toBe(0);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW)).toBeNull();
    });

    it('writes canonical EPG past-items storage values from the shared preference contract', () => {
        expect(store.writeEpgPastItemsWindowValue(2)).toEqual({ ok: true, value: 2 });
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW)).toBe(
            EPG_PAST_ITEMS_WINDOWS[2]
        );

        expect(store.writeEpgPastItemsWindowValue(99)).toEqual({ ok: true, value: 0 });
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW)).toBe(
            EPG_PAST_ITEMS_WINDOWS[0]
        );
    });

    it('exposes typed Guide hours and defers legacy density removal until consumer cutover', () => {
        localStorage.setItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY, 'wide');

        expect(store.readGuideHoursAndMigrate()).toEqual({ ok: true, value: 3, source: 'legacy' });
        expect(store.writeGuideHours(4)).toEqual({ ok: true, value: 4 });
        expect(store.readGuideHoursAndMigrate()).toEqual({ ok: true, value: 4, source: 'stored' });
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY)).toBe('wide');
        expect(store.writeGuideHours(5 as 2 | 3 | 4)).toEqual({
            ok: false,
            reason: 'invalid-value',
            effectiveValue: 4,
        });
        expect(store.writeOverlayTransparency('opaque' as 'standard')).toEqual({
            ok: false,
            reason: 'invalid-value',
            effectiveValue: 'standard',
        });
        expect(store.writeCompactControlsTimeoutSeconds(7 as 2 | 4 | 6 | 8 | 10 | 15)).toEqual({
            ok: false,
            reason: 'invalid-value',
            effectiveValue: 4,
        });

        expect(store.completeGuideHoursMigrationAfterConsumerCutover()).toEqual({
            ok: true,
            value: 4,
            legacyRemoved: true,
        });
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_GUIDE_HOURS)).toBe('4');
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.EPG_GUIDE_DENSITY)).toBeNull();
    });

    it('keeps new defaults and opt-in values independent from existing debug and artwork settings', () => {
        expect(DEFAULT_SETTINGS.display.overlayTransparency).toBe('standard');
        expect(DEFAULT_SETTINGS.guide.guideHours).toBe(2);
        expect(DEFAULT_SETTINGS.guide.sourceLabelsEnabled).toBe(false);
        expect(DEFAULT_SETTINGS.playback.compactControlsTimeoutSeconds).toBe(4);
        expect(DEFAULT_SETTINGS.accessibility).toEqual({ reduceMotion: false, largeFocus: false });
        expect(DEFAULT_SETTINGS.support.reportCollectionOptIn).toBe(false);

        localStorage.setItem(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, '2');
        expect(store.readOverlayTransparencyAndClean()).toBe('standard');
        expect(store.writeOverlayTransparency('reduced')).toEqual({ ok: true, value: 'reduced' });
        expect(store.writeCompactControlsTimeoutSeconds(15)).toEqual({ ok: true, value: 15 });
        expect(store.writeToggleSetting('epgSourceLabelsEnabled', true)).toEqual({ ok: true, value: true });
        expect(store.writeToggleSetting('reduceMotion', true)).toEqual({ ok: true, value: true });
        expect(store.writeToggleSetting('largeFocus', true)).toEqual({ ok: true, value: true });
        expect(store.writeToggleSetting('supportReportOptIn', true)).toEqual({ ok: true, value: true });

        expect(store.readOverlayTransparencyAndClean()).toBe('reduced');
        expect(store.readCompactControlsTimeoutSecondsAndClean()).toBe(15);
        expect(store.readToggleSettingAndClean('epgSourceLabelsEnabled')).toBe(true);
        expect(store.readToggleSettingAndClean('reduceMotion')).toBe(true);
        expect(store.readToggleSettingAndClean('largeFocus')).toBe(true);
        expect(store.readToggleSettingAndClean('supportReportOptIn')).toBe(true);
        expect(store.readToggleSettingAndClean('debugLogging')).toBe(false);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE)).toBe('2');
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.SUPPORT_REPORT_OPT_IN)).toBe('1');
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.DEBUG_LOGGING)).toBeNull();
        expect(localStorage.getItem(LINEUP_STORAGE_KEYS.ISSUE_DIAGNOSTICS_LOG)).toBeNull();
    });

    it('returns the prior effective value when a single-setting write fails', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK, '0');
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('blocked', 'SecurityError');
        });

        expect(store.writeToggleSetting('directPlayAudioFallback', true)).toEqual({
            ok: false,
            reason: 'unavailable',
            effectiveValue: false,
        });
    });

    it('reports HDR partial-write state after compensation through SettingsStore', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.SMART_HDR10_FALLBACK, '0');
        localStorage.setItem(SETTINGS_STORAGE_KEYS.FORCE_HDR10_FALLBACK, '1');
        const originalSetItem = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value): void {
            if (key === SETTINGS_STORAGE_KEYS.FORCE_HDR10_FALLBACK && value === '0') {
                throw new DOMException('blocked', 'SecurityError');
            }
            originalSetItem.call(this, key, value);
        });

        expect(store.writeHdr10FallbackModeValue(1)).toEqual({
            ok: false,
            reason: 'unavailable',
            effectiveValue: 2,
        });
        expect(store.readHdr10FallbackModeValueAndClean()).toBe(2);
    });

    it('normalizes subtitle language aliases and preserves values outside the UI option list', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE, ' EN ');
        expect(store.readSubtitleLanguageAndClean()).toBe('en');

        localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE, ' eng ');
        expect(store.readSubtitleLanguageAndClean()).toBe('en');

        localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE, 'Spanish');
        expect(store.readSubtitleLanguageAndClean()).toBe('es');

        localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE, 'zz');
        expect(store.readSubtitleLanguageAndClean()).toBe('zz');
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE)).toBe('zz');

        expect(store.writeSubtitleLanguage(null)).toEqual({ ok: true, value: null });
        expect(store.readSubtitleLanguageAndClean()).toBeNull();
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE)).toBeNull();
    });

    it('reports the retained unlisted subtitle language when a write fails and normalizes successful writes', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE, 'zz');
        const originalSetItem = Storage.prototype.setItem;
        const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value): void {
            if (key === SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE) {
                throw new DOMException('blocked', 'SecurityError');
            }
            originalSetItem.call(this, key, value);
        });

        expect(store.writeSubtitleLanguage('es')).toEqual({
            ok: false,
            reason: 'unavailable',
            effectiveValue: 'zz',
        });
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE)).toBe('zz');

        setItemSpy.mockRestore();
        const reopenedStore = new SettingsStore();
        expect(reopenedStore.readSubtitleLanguageAndClean()).toBe('zz');

        expect(reopenedStore.writeSubtitleLanguage(' ENG ')).toEqual({ ok: true, value: 'en' });
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE)).toBe('en');
    });

    it('normalizes transcode quality and removes unknown persisted values', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY, 'unknown-value');

        expect(store.readTranscodeQualityValueAndClean(TRANSCODE_OPTIONS)).toBe(0);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY)).toBeNull();

        store.writeTranscodeQualityValue(1, TRANSCODE_OPTIONS);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY)).toBe('12000-1080p');
    });

    it('clears persisted transcode quality when the UI option list no longer supports the stored value', () => {
        localStorage.setItem(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY, '4000-720p');

        expect(store.readTranscodeQualityValueAndClean(TRANSCODE_OPTIONS)).toBe(0);
        expect(localStorage.getItem(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY)).toBeNull();
    });

    it('semantic toggle methods remain non-fatal when storage is blocked', () => {
        const getSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });
        const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('Blocked', 'SecurityError');
        });

        expect(() => store.readToggleSettingAndClean('debugLogging')).not.toThrow();
        expect(store.readToggleSettingAndClean('debugLogging')).toBe(DEFAULT_SETTINGS.developer.debugLogging);
        expect(store.writeToggleSetting('debugLogging', true)).toEqual({
            ok: false,
            reason: 'unavailable',
            effectiveValue: DEFAULT_SETTINGS.developer.debugLogging,
        });

        getSpy.mockRestore();
        setSpy.mockRestore();
    });
});
