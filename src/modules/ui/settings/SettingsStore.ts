import { TRANSCODE_QUALITY_OPTIONS } from '../../../config/transcodeQuality';
import { NOW_PLAYING_INFO_DEFAULTS } from '../now-playing-info/constants';
import { AudioSettingsStore } from '../../settings/AudioSettingsStore';
import { EpgPreferencesStore } from '../../settings/EpgPreferencesStore';
import { NowPlayingDisplayStore } from '../../settings/NowPlayingDisplayStore';
import { PlaybackSettingsStore } from '../../settings/PlaybackSettingsStore';
import { ProfileSessionStore } from '../../settings/ProfileSessionStore';
import { SubtitlePreferencesStore } from '../../settings/SubtitlePreferencesStore';
import type { SubtitleMode } from '../../../shared/subtitle-mode';
import {
    readStoredBooleanAndClean,
    safeLocalStorageSet,
} from '../../../utils/storage';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEYS } from './constants';

const EPG_PAST_ITEMS_STORAGE_VALUES = ['auto', '0', '15', '30'] as const;

type EpgPastItemsStorageValue = (typeof EPG_PAST_ITEMS_STORAGE_VALUES)[number];
type SubtitleLanguageOption = Readonly<{ code: string | null }>;

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

type DelegatedToggleSettingId =
    | 'dtsPassthrough'
    | 'directPlayAudioFallback'
    | 'transcodeCompat'
    | 'keepPlayingInSettings'
    | 'smartHdr10Fallback'
    | 'forceHdr10Fallback'
    | 'subtitlePreferForced'
    | 'guideCategoryColors'
    | 'epgLibraryTabsEnabled'
    | 'epgNowWatchingEnabled'
    | 'epgAggressivePreloadEnabled'
    | 'showProfilePickerOnStartup'
    | 'cinematicNowPlaying'
    | 'preferClearLogos';
type DirectStorageToggleSettingId = Exclude<ToggleSettingId, DelegatedToggleSettingId>;

const TOGGLE_STORAGE_KEY_BY_ID: Record<DirectStorageToggleSettingId, string> = {
    debugLogging: SETTINGS_STORAGE_KEYS.DEBUG_LOGGING,
    subtitleDebugLogging: SETTINGS_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING,
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

export interface SettingsStoreOptions {
    audioSettingsStore?: AudioSettingsStore;
    playbackSettingsStore?: PlaybackSettingsStore;
    subtitlePreferencesStore?: SubtitlePreferencesStore;
    epgPreferencesStore?: EpgPreferencesStore;
    nowPlayingDisplayStore?: NowPlayingDisplayStore;
    profileSessionStore?: ProfileSessionStore;
}

export class SettingsStore {
    private readonly _audioSettingsStore: AudioSettingsStore;
    private readonly _playbackSettingsStore: PlaybackSettingsStore;
    private readonly _subtitlePreferencesStore: SubtitlePreferencesStore;
    private readonly _epgPreferencesStore: EpgPreferencesStore;
    private readonly _nowPlayingDisplayStore: NowPlayingDisplayStore;
    private readonly _profileSessionStore: ProfileSessionStore;

    constructor(options: SettingsStoreOptions = {}) {
        this._audioSettingsStore = options.audioSettingsStore ?? new AudioSettingsStore();
        this._playbackSettingsStore = options.playbackSettingsStore ?? new PlaybackSettingsStore();
        this._subtitlePreferencesStore = options.subtitlePreferencesStore ?? new SubtitlePreferencesStore();
        this._epgPreferencesStore = options.epgPreferencesStore ?? new EpgPreferencesStore();
        this._nowPlayingDisplayStore = options.nowPlayingDisplayStore ?? new NowPlayingDisplayStore();
        this._profileSessionStore = options.profileSessionStore ?? new ProfileSessionStore();
    }

    readToggleSetting(id: ToggleSettingId): boolean {
        if (id === 'dtsPassthrough') {
            return this._audioSettingsStore.readDtsPassthroughEnabled(TOGGLE_DEFAULT_BY_ID.dtsPassthrough);
        }
        if (id === 'directPlayAudioFallback') {
            return this._audioSettingsStore.readDirectPlayAudioFallbackEnabled(TOGGLE_DEFAULT_BY_ID.directPlayAudioFallback);
        }
        if (id === 'transcodeCompat') {
            return this._playbackSettingsStore.readTranscodeCompatEnabled(TOGGLE_DEFAULT_BY_ID.transcodeCompat);
        }
        if (id === 'keepPlayingInSettings') {
            return this._profileSessionStore.readKeepPlayingInSettings(TOGGLE_DEFAULT_BY_ID.keepPlayingInSettings);
        }
        if (id === 'smartHdr10Fallback') {
            return this._playbackSettingsStore.readSmartHdr10FallbackEnabled(TOGGLE_DEFAULT_BY_ID.smartHdr10Fallback);
        }
        if (id === 'forceHdr10Fallback') {
            return this._playbackSettingsStore.readForceHdr10FallbackEnabled(TOGGLE_DEFAULT_BY_ID.forceHdr10Fallback);
        }
        if (id === 'subtitlePreferForced') {
            return this._subtitlePreferencesStore.readSubtitlePreferForced(TOGGLE_DEFAULT_BY_ID.subtitlePreferForced);
        }
        if (id === 'guideCategoryColors') {
            return this._epgPreferencesStore.readGuideCategoryColorsEnabled(TOGGLE_DEFAULT_BY_ID.guideCategoryColors);
        }
        if (id === 'epgLibraryTabsEnabled') {
            return this._epgPreferencesStore.readLibraryTabsEnabled(TOGGLE_DEFAULT_BY_ID.epgLibraryTabsEnabled);
        }
        if (id === 'epgNowWatchingEnabled') {
            return this._epgPreferencesStore.readNowWatchingEnabled(TOGGLE_DEFAULT_BY_ID.epgNowWatchingEnabled);
        }
        if (id === 'epgAggressivePreloadEnabled') {
            return this._epgPreferencesStore.readAggressivePreloadEnabled(TOGGLE_DEFAULT_BY_ID.epgAggressivePreloadEnabled);
        }
        if (id === 'showProfilePickerOnStartup') {
            return this._profileSessionStore.readShowProfilePickerOnStartup(TOGGLE_DEFAULT_BY_ID.showProfilePickerOnStartup);
        }
        if (id === 'cinematicNowPlaying') {
            return this._nowPlayingDisplayStore.readCinematicNowPlayingEnabled(TOGGLE_DEFAULT_BY_ID.cinematicNowPlaying);
        }
        if (id === 'preferClearLogos') {
            return this._nowPlayingDisplayStore.readPreferClearLogosEnabled(TOGGLE_DEFAULT_BY_ID.preferClearLogos);
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
        if (id === 'transcodeCompat') {
            this._playbackSettingsStore.writeTranscodeCompatEnabled(value);
            return;
        }
        if (id === 'keepPlayingInSettings') {
            this._profileSessionStore.writeKeepPlayingInSettings(value);
            return;
        }
        if (id === 'smartHdr10Fallback') {
            this._playbackSettingsStore.writeSmartHdr10FallbackEnabled(value);
            return;
        }
        if (id === 'forceHdr10Fallback') {
            this._playbackSettingsStore.writeForceHdr10FallbackEnabled(value);
            return;
        }
        if (id === 'subtitlePreferForced') {
            this._subtitlePreferencesStore.writeSubtitlePreferForced(value);
            return;
        }
        if (id === 'guideCategoryColors') {
            this._epgPreferencesStore.writeGuideCategoryColorsEnabled(value);
            return;
        }
        if (id === 'epgLibraryTabsEnabled') {
            this._epgPreferencesStore.writeLibraryTabsEnabled(value);
            return;
        }
        if (id === 'epgNowWatchingEnabled') {
            this._epgPreferencesStore.writeNowWatchingEnabled(value);
            return;
        }
        if (id === 'epgAggressivePreloadEnabled') {
            this._epgPreferencesStore.writeAggressivePreloadEnabled(value);
            return;
        }
        if (id === 'showProfilePickerOnStartup') {
            this._profileSessionStore.writeShowProfilePickerOnStartup(value);
            return;
        }
        if (id === 'cinematicNowPlaying') {
            this._nowPlayingDisplayStore.writeCinematicNowPlayingEnabled(value);
            return;
        }
        if (id === 'preferClearLogos') {
            this._nowPlayingDisplayStore.writePreferClearLogosEnabled(value);
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
        return readStoredBooleanAndClean(key, fallback);
    }

    readEpgLayoutModeValue(): 0 | 1 {
        return this._epgPreferencesStore.readLayoutMode('classic') === 'overlay' ? 0 : 1;
    }

    writeEpgLayoutModeValue(value: 0 | 1): void {
        const mode = value === 1 ? 'classic' : 'overlay';
        this._epgPreferencesStore.writeLayoutMode(mode);
    }

    readEpgGuideDensityValue(): 0 | 1 {
        return this._epgPreferencesStore.readGuideDensity('detailed') === 'wide' ? 1 : 0;
    }

    writeEpgGuideDensityValue(value: number): void {
        const density = value === 1 ? 'wide' : 'detailed';
        this._epgPreferencesStore.writeGuideDensity(density);
    }

    readEpgPastItemsWindowValue(): number {
        const raw = this._epgPreferencesStore.readPastItemsWindow('auto');
        const index = EPG_PAST_ITEMS_STORAGE_VALUES.findIndex((option) => option === raw);
        if (index >= 0) return index;
        return 0;
    }

    writeEpgPastItemsWindowValue(value: number): EpgPastItemsStorageValue {
        const option = EPG_PAST_ITEMS_STORAGE_VALUES[value] ?? EPG_PAST_ITEMS_STORAGE_VALUES[0];
        this._epgPreferencesStore.writePastItemsWindow(option);
        return option;
    }

    readEpgInfoBackgroundModeValue(): 0 | 1 | 2 {
        return this._epgPreferencesStore.readInfoBackgroundMode(DEFAULT_SETTINGS.display.epgInfoBackgroundMode);
    }

    writeEpgInfoBackgroundModeValue(value: number): 0 | 1 | 2 {
        const mode: 0 | 1 | 2 = value === 2 ? 2 : value === 1 ? 1 : 0;
        this._epgPreferencesStore.writeInfoBackgroundMode(mode);
        return mode;
    }

    readSubtitleMode(): SubtitleMode {
        return this._subtitlePreferencesStore.readSubtitleMode('full');
    }

    writeSubtitleMode(mode: SubtitleMode): void {
        this._subtitlePreferencesStore.writeSubtitleMode(mode);
    }

    readSubtitleLanguageValue(options: ReadonlyArray<SubtitleLanguageOption>): number {
        const raw = this._subtitlePreferencesStore.readSubtitleLanguage();
        if (raw === null) return 0;

        const index = options.findIndex((option) => {
            if (!option.code) return false;
            return option.code.toLowerCase() === raw;
        });

        if (index >= 0) return index;

        this._subtitlePreferencesStore.writeSubtitleLanguage(null);
        return 0;
    }

    writeSubtitleLanguageValue(value: number, options: ReadonlyArray<SubtitleLanguageOption>): void {
        const option = options[value];
        this._subtitlePreferencesStore.writeSubtitleLanguage(option?.code ?? null);
    }

    readTranscodeQualityValue(options: ReadonlyArray<{ storageValue: string }> = TRANSCODE_QUALITY_OPTIONS): number {
        return this._playbackSettingsStore.readTranscodeQualityValue(options);
    }

    writeTranscodeQualityValue(value: number, options: ReadonlyArray<{ storageValue: string }> = TRANSCODE_QUALITY_OPTIONS): void {
        this._playbackSettingsStore.writeTranscodeQualityValue(value, options);
    }

    readClampedNowPlayingAutoHideValue(validOptions: readonly number[], fallback: number = NOW_PLAYING_INFO_DEFAULTS.autoHideMs): number {
        return this._nowPlayingDisplayStore.readClampedAutoHideMs(
            validOptions,
            validOptions.includes(fallback)
                ? fallback
                : (validOptions.includes(NOW_PLAYING_INFO_DEFAULTS.autoHideMs)
                    ? NOW_PLAYING_INFO_DEFAULTS.autoHideMs
                    : (validOptions[0] ?? NOW_PLAYING_INFO_DEFAULTS.autoHideMs))
        );
    }

    writeNowPlayingAutoHideValue(value: number): void {
        this._nowPlayingDisplayStore.writeAutoHideMs(value);
    }
}
