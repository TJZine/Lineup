import { TRANSCODE_QUALITY_OPTIONS } from '../../../config/transcodeQuality';
import { NOW_PLAYING_INFO_DEFAULTS } from '../now-playing-info/constants';
import { AudioSettingsStore } from '../../settings/AudioSettingsStore';
import {
    parseStoredEpgInfoBackgroundMode,
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSet,
} from '../../../utils/storage';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEYS } from './constants';

const EPG_PAST_ITEMS_STORAGE_VALUES = ['auto', '0', '15', '30'] as const;

type EpgPastItemsStorageValue = (typeof EPG_PAST_ITEMS_STORAGE_VALUES)[number];
type SubtitleLanguageOption = Readonly<{ code: string | null }>;
type TranscodeQualityOption = Readonly<{ storageValue: string }>;

export type ToggleSettingId =
    | 'dtsPassthrough'
    | 'directPlayAudioFallback'
    | 'keepPlayingInSettings'
    | 'transcodeCompat'
    | 'debugLogging'
    | 'subtitleDebugLogging'
    | 'subtitlePreferForced'
    | 'guideCategoryColors'
    | 'epgLibraryTabsEnabled'
    | 'epgNowWatchingEnabled'
    | 'epgAggressivePreloadEnabled'
    | 'showProfilePickerOnStartup'
    | 'cinematicNowPlaying'
    | 'preferClearLogos'
    | 'smartHdr10Fallback'
    | 'forceHdr10Fallback';

const TOGGLE_STORAGE_KEY_BY_ID: Record<ToggleSettingId, string> = {
    dtsPassthrough: SETTINGS_STORAGE_KEYS.DTS_PASSTHROUGH,
    directPlayAudioFallback: SETTINGS_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK,
    keepPlayingInSettings: SETTINGS_STORAGE_KEYS.KEEP_PLAYING_IN_SETTINGS,
    transcodeCompat: SETTINGS_STORAGE_KEYS.TRANSCODE_COMPAT,
    debugLogging: SETTINGS_STORAGE_KEYS.DEBUG_LOGGING,
    subtitleDebugLogging: SETTINGS_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING,
    subtitlePreferForced: SETTINGS_STORAGE_KEYS.SUBTITLE_PREFER_FORCED,
    guideCategoryColors: SETTINGS_STORAGE_KEYS.GUIDE_CATEGORY_COLORS,
    epgLibraryTabsEnabled: SETTINGS_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED,
    epgNowWatchingEnabled: SETTINGS_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED,
    epgAggressivePreloadEnabled: SETTINGS_STORAGE_KEYS.EPG_AGGRESSIVE_PRELOAD_ENABLED,
    showProfilePickerOnStartup: SETTINGS_STORAGE_KEYS.SHOW_PROFILE_PICKER_ON_STARTUP,
    cinematicNowPlaying: SETTINGS_STORAGE_KEYS.CINEMATIC_NOW_PLAYING,
    preferClearLogos: SETTINGS_STORAGE_KEYS.PREFER_CLEAR_LOGOS,
    smartHdr10Fallback: SETTINGS_STORAGE_KEYS.SMART_HDR10_FALLBACK,
    forceHdr10Fallback: SETTINGS_STORAGE_KEYS.FORCE_HDR10_FALLBACK,
};

const TOGGLE_DEFAULT_BY_ID: Record<ToggleSettingId, boolean> = {
    dtsPassthrough: DEFAULT_SETTINGS.audio.dtsPassthrough,
    directPlayAudioFallback: DEFAULT_SETTINGS.audio.directPlayAudioFallback,
    keepPlayingInSettings: DEFAULT_SETTINGS.playback.keepPlayingInSettings,
    transcodeCompat: false,
    debugLogging: DEFAULT_SETTINGS.developer.debugLogging,
    subtitleDebugLogging: DEFAULT_SETTINGS.developer.subtitleDebugLogging,
    subtitlePreferForced: DEFAULT_SETTINGS.subtitles.preferForced,
    guideCategoryColors: true,
    epgLibraryTabsEnabled: true,
    epgNowWatchingEnabled: true,
    epgAggressivePreloadEnabled: false,
    showProfilePickerOnStartup: DEFAULT_SETTINGS.account.showProfilePickerOnStartup,
    cinematicNowPlaying: DEFAULT_SETTINGS.display.cinematicNowPlaying,
    preferClearLogos: DEFAULT_SETTINGS.display.preferClearLogos,
    smartHdr10Fallback: DEFAULT_SETTINGS.playback.smartHdr10Fallback,
    forceHdr10Fallback: DEFAULT_SETTINGS.playback.forceHdr10Fallback,
};

export class SettingsStore {
    private readonly _audioSettingsStore = new AudioSettingsStore();

    readToggleSetting(id: ToggleSettingId): boolean {
        if (id === 'dtsPassthrough') {
            return this._audioSettingsStore.readDtsPassthroughEnabled(TOGGLE_DEFAULT_BY_ID.dtsPassthrough);
        }
        if (id === 'directPlayAudioFallback') {
            return this._audioSettingsStore.readDirectPlayAudioFallbackEnabled(TOGGLE_DEFAULT_BY_ID.directPlayAudioFallback);
        }

        return this._readBooleanKey(TOGGLE_STORAGE_KEY_BY_ID[id], TOGGLE_DEFAULT_BY_ID[id]);
    }

    writeToggleSetting(id: ToggleSettingId, value: boolean): void {
        if (id === 'dtsPassthrough') {
            this._audioSettingsStore.writeDtsPassthroughEnabled(value);
            return;
        }
        if (id === 'directPlayAudioFallback') {
            this._audioSettingsStore.writeDirectPlayAudioFallbackEnabled(value);
            return;
        }
        safeLocalStorageSet(TOGGLE_STORAGE_KEY_BY_ID[id], value ? '1' : '0');
    }

    readHdr10FallbackModeValue(): 0 | 1 | 2 {
        if (this.readToggleSetting('forceHdr10Fallback')) {
            return 2;
        }
        if (this.readToggleSetting('smartHdr10Fallback')) {
            return 1;
        }
        return 0;
    }

    writeHdr10FallbackModeValue(value: 0 | 1 | 2): void {
        switch (value) {
            case 1:
                this.writeToggleSetting('smartHdr10Fallback', true);
                this.writeToggleSetting('forceHdr10Fallback', false);
                return;
            case 2:
                this.writeToggleSetting('smartHdr10Fallback', false);
                this.writeToggleSetting('forceHdr10Fallback', true);
                return;
            case 0:
            default:
                this.writeToggleSetting('smartHdr10Fallback', false);
                this.writeToggleSetting('forceHdr10Fallback', false);
        }
    }

    private _readBooleanKey(key: string, fallback: boolean): boolean {
        const raw = safeLocalStorageGet(key);
        if (raw === '1') return true;
        if (raw === '0') return false;

        if (raw !== null) {
            safeLocalStorageRemove(key);
        }

        return fallback;
    }

    readEpgLayoutModeValue(): 0 | 1 {
        const raw = safeLocalStorageGet(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE);
        if (raw === 'overlay') return 0;
        if (raw === 'classic' || raw === null) return 1;
        safeLocalStorageRemove(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE);
        return 1;
    }

    writeEpgLayoutModeValue(value: 0 | 1): void {
        const mode = value === 1 ? 'classic' : 'overlay';
        safeLocalStorageSet(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE, mode);
    }

    readEpgGuideDensityValue(): 0 | 1 {
        const raw = safeLocalStorageGet(SETTINGS_STORAGE_KEYS.EPG_GUIDE_DENSITY);
        if (raw === 'wide') return 1;
        if (raw === 'detailed' || raw === null) return 0;
        safeLocalStorageRemove(SETTINGS_STORAGE_KEYS.EPG_GUIDE_DENSITY);
        return 0;
    }

    writeEpgGuideDensityValue(value: number): void {
        const density = value === 1 ? 'wide' : 'detailed';
        safeLocalStorageSet(SETTINGS_STORAGE_KEYS.EPG_GUIDE_DENSITY, density);
    }

    readEpgPastItemsWindowValue(): number {
        const raw = safeLocalStorageGet(SETTINGS_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW);
        const index = EPG_PAST_ITEMS_STORAGE_VALUES.findIndex((option) => option === raw);
        if (index >= 0) return index;
        if (raw !== null) {
            safeLocalStorageRemove(SETTINGS_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW);
        }
        return 0;
    }

    writeEpgPastItemsWindowValue(value: number): EpgPastItemsStorageValue {
        const option = EPG_PAST_ITEMS_STORAGE_VALUES[value] ?? EPG_PAST_ITEMS_STORAGE_VALUES[0];
        safeLocalStorageSet(SETTINGS_STORAGE_KEYS.EPG_PAST_ITEMS_WINDOW, option);
        return option;
    }

    readEpgInfoBackgroundModeValue(): 0 | 1 | 2 {
        const raw = safeLocalStorageGet(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE);
        const parsed = parseStoredEpgInfoBackgroundMode(raw);
        if (parsed !== null) return parsed;
        if (raw !== null) {
            safeLocalStorageRemove(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE);
        }
        return DEFAULT_SETTINGS.display.epgInfoBackgroundMode;
    }

    writeEpgInfoBackgroundModeValue(value: number): 0 | 1 | 2 {
        const mode: 0 | 1 | 2 = value === 2 ? 2 : value === 1 ? 1 : 0;
        safeLocalStorageSet(SETTINGS_STORAGE_KEYS.EPG_INFO_BACKGROUND_MODE, String(mode));
        return mode;
    }

    readSubtitleLanguageValue(options: ReadonlyArray<SubtitleLanguageOption>): number {
        const raw = safeLocalStorageGet(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE);
        if (raw === null) return 0;

        const normalized = raw.trim().toLowerCase();
        if (!normalized) {
            safeLocalStorageRemove(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE);
            return 0;
        }

        const index = options.findIndex((option) => {
            if (!option.code) return false;
            return option.code.toLowerCase() === normalized;
        });

        if (index >= 0) return index;

        safeLocalStorageRemove(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE);
        return 0;
    }

    writeSubtitleLanguageValue(value: number, options: ReadonlyArray<SubtitleLanguageOption>): void {
        const option = options[value];
        if (!option || !option.code) {
            safeLocalStorageRemove(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE);
            return;
        }
        safeLocalStorageSet(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE, option.code);
    }

    readTranscodeQualityValue(options: ReadonlyArray<TranscodeQualityOption> = TRANSCODE_QUALITY_OPTIONS): number {
        const stored = safeLocalStorageGet(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY) ?? '';
        const matchIndex = options.findIndex((option) => option.storageValue === stored);
        if (matchIndex >= 0) return matchIndex;
        if (stored) {
            safeLocalStorageRemove(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY);
        }
        return 0;
    }

    writeTranscodeQualityValue(value: number, options: ReadonlyArray<TranscodeQualityOption> = TRANSCODE_QUALITY_OPTIONS): void {
        const option = options[value] ?? options[0];
        if (!option || option.storageValue.length === 0) {
            safeLocalStorageRemove(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY);
            return;
        }
        safeLocalStorageSet(SETTINGS_STORAGE_KEYS.TRANSCODE_QUALITY, option.storageValue);
    }

    readClampedNowPlayingAutoHideValue(validOptions: readonly number[], fallback: number = NOW_PLAYING_INFO_DEFAULTS.autoHideMs): number {
        const raw = safeLocalStorageGet(SETTINGS_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS);
        const parsed = raw === null ? NaN : Number(raw);
        const candidate = Number.isFinite(parsed) ? parsed : fallback;

        const normalized = ((): number => {
            if (validOptions.includes(candidate)) return candidate;
            if (validOptions.includes(fallback)) return fallback;
            if (validOptions.includes(NOW_PLAYING_INFO_DEFAULTS.autoHideMs)) return NOW_PLAYING_INFO_DEFAULTS.autoHideMs;
            return validOptions[0] ?? NOW_PLAYING_INFO_DEFAULTS.autoHideMs;
        })();

        if (raw === null) {
            return normalized;
        }

        if (Number.isFinite(parsed) && validOptions.includes(parsed)) {
            return parsed;
        }

        safeLocalStorageSet(SETTINGS_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS, String(normalized));
        return normalized;
    }

    writeNowPlayingAutoHideValue(value: number): void {
        safeLocalStorageSet(SETTINGS_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS, String(value));
    }
}
