import { TRANSCODE_QUALITY_OPTIONS } from '../../../config/transcodeQuality';
import { NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS, NOW_PLAYING_INFO_DEFAULTS } from '../now-playing-info/constants';
import { AudioSettingsStore } from '../../settings/AudioSettingsStore';
import { DeveloperSettingsStore } from '../../settings/DeveloperSettingsStore';
import {
    EPG_PAST_ITEMS_WINDOWS,
    EpgPreferencesStore,
    type EpgPastItemsWindow,
} from '../../settings/EpgPreferencesStore';
import { NowPlayingDisplayStore } from '../../settings/NowPlayingDisplayStore';
import {
    PlaybackSettingsStore,
    type Hdr10FallbackModeValue,
} from '../../settings/PlaybackSettingsStore';
import { ProfileSessionStore } from '../../settings/ProfileSessionStore';
import { SubtitlePreferencesStore } from '../../settings/SubtitlePreferencesStore';
import {
    DEFAULT_SUBTITLE_MODE,
    type SubtitleMode,
} from '../../../shared/subtitle-mode';
import { DEFAULT_SETTINGS } from './constants';
type SubtitleLanguageOption = Readonly<{ code: string | null }>;

export type ToggleSettingId =
    | 'dtsPassthrough'
    | 'directPlayAudioFallback'
    | 'keepPlayingInSettings'
    | 'transcodeCompat'
    | 'debugLogging'
    | 'subtitleDebugLogging'
    | 'subtitlePreferForced'
    | 'epgLibraryTabsEnabled'
    | 'epgNowWatchingEnabled'
    | 'epgAggressivePreloadEnabled'
    | 'showProfilePickerOnStartup'
    | 'cinematicNowPlaying'
    | 'preferClearLogos'
    | 'smartHdr10Fallback'
    | 'forceHdr10Fallback';

const TOGGLE_DEFAULT_BY_ID: Record<ToggleSettingId, boolean> = {
    dtsPassthrough: DEFAULT_SETTINGS.audio.dtsPassthrough,
    directPlayAudioFallback: DEFAULT_SETTINGS.audio.directPlayAudioFallback,
    keepPlayingInSettings: DEFAULT_SETTINGS.playback.keepPlayingInSettings,
    transcodeCompat: false,
    debugLogging: DEFAULT_SETTINGS.developer.debugLogging,
    subtitleDebugLogging: DEFAULT_SETTINGS.developer.subtitleDebugLogging,
    subtitlePreferForced: DEFAULT_SETTINGS.subtitles.preferForced,
    epgLibraryTabsEnabled: true,
    epgNowWatchingEnabled: true,
    epgAggressivePreloadEnabled: false,
    showProfilePickerOnStartup: DEFAULT_SETTINGS.account.showProfilePickerOnStartup,
    cinematicNowPlaying: DEFAULT_SETTINGS.display.cinematicNowPlaying,
    preferClearLogos: DEFAULT_SETTINGS.display.preferClearLogos,
    smartHdr10Fallback: DEFAULT_SETTINGS.playback.smartHdr10Fallback,
    forceHdr10Fallback: DEFAULT_SETTINGS.playback.forceHdr10Fallback,
};

function assertNeverToggleSettingId(id: never): never {
    throw new Error(`Unhandled ToggleSettingId: ${String(id)}`);
}

export interface SettingsStoreOptions {
    audioSettingsStore?: AudioSettingsStore;
    developerSettingsStore?: DeveloperSettingsStore;
    playbackSettingsStore?: PlaybackSettingsStore;
    subtitlePreferencesStore?: SubtitlePreferencesStore;
    epgPreferencesStore?: EpgPreferencesStore;
    nowPlayingDisplayStore?: NowPlayingDisplayStore;
    profileSessionStore?: ProfileSessionStore;
}

export class SettingsStore {
    private readonly _audioSettingsStore: AudioSettingsStore;
    private readonly _developerSettingsStore: DeveloperSettingsStore;
    private readonly _playbackSettingsStore: PlaybackSettingsStore;
    private readonly _subtitlePreferencesStore: SubtitlePreferencesStore;
    private readonly _epgPreferencesStore: EpgPreferencesStore;
    private readonly _nowPlayingDisplayStore: NowPlayingDisplayStore;
    private readonly _profileSessionStore: ProfileSessionStore;

    constructor(options: SettingsStoreOptions = {}) {
        this._audioSettingsStore = options.audioSettingsStore ?? new AudioSettingsStore();
        this._developerSettingsStore = options.developerSettingsStore ?? new DeveloperSettingsStore();
        this._playbackSettingsStore = options.playbackSettingsStore ?? new PlaybackSettingsStore();
        this._subtitlePreferencesStore = options.subtitlePreferencesStore ?? new SubtitlePreferencesStore();
        this._epgPreferencesStore = options.epgPreferencesStore ?? new EpgPreferencesStore();
        this._nowPlayingDisplayStore = options.nowPlayingDisplayStore ?? new NowPlayingDisplayStore();
        this._profileSessionStore = options.profileSessionStore ?? new ProfileSessionStore();
    }

    readToggleSettingAndClean(id: ToggleSettingId): boolean {
        switch (id) {
            case 'dtsPassthrough':
                return this._audioSettingsStore.readDtsPassthroughEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.dtsPassthrough
                );
            case 'directPlayAudioFallback':
                return this._audioSettingsStore.readDirectPlayAudioFallbackEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.directPlayAudioFallback
                );
            case 'keepPlayingInSettings':
                return this._profileSessionStore.readKeepPlayingInSettingsAndClean(
                    TOGGLE_DEFAULT_BY_ID.keepPlayingInSettings
                );
            case 'transcodeCompat':
                return this._playbackSettingsStore.readTranscodeCompatEnabledAndClean(TOGGLE_DEFAULT_BY_ID.transcodeCompat);
            case 'debugLogging':
                return this._developerSettingsStore.readDebugLoggingEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.debugLogging
                );
            case 'subtitleDebugLogging':
                return this._developerSettingsStore.readSubtitleDebugLoggingEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.subtitleDebugLogging
                );
            case 'subtitlePreferForced':
                return this._subtitlePreferencesStore.readSubtitlePreferForcedAndClean(
                    TOGGLE_DEFAULT_BY_ID.subtitlePreferForced
                );
            case 'epgLibraryTabsEnabled':
                return this._epgPreferencesStore.readLibraryTabsEnabledAndClean(TOGGLE_DEFAULT_BY_ID.epgLibraryTabsEnabled);
            case 'epgNowWatchingEnabled':
                return this._epgPreferencesStore.readNowWatchingEnabledAndClean(TOGGLE_DEFAULT_BY_ID.epgNowWatchingEnabled);
            case 'epgAggressivePreloadEnabled':
                return this._epgPreferencesStore.readAggressivePreloadEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.epgAggressivePreloadEnabled
                );
            case 'showProfilePickerOnStartup':
                return this._profileSessionStore.readShowProfilePickerOnStartupAndClean(
                    TOGGLE_DEFAULT_BY_ID.showProfilePickerOnStartup
                );
            case 'cinematicNowPlaying':
                return this._nowPlayingDisplayStore.readCinematicNowPlayingEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.cinematicNowPlaying
                );
            case 'preferClearLogos':
                return this._nowPlayingDisplayStore.readPreferClearLogosEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.preferClearLogos
                );
            case 'smartHdr10Fallback':
                return this._playbackSettingsStore.readSmartHdr10FallbackEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.smartHdr10Fallback
                );
            case 'forceHdr10Fallback':
                return this._playbackSettingsStore.readForceHdr10FallbackEnabledAndClean(
                    TOGGLE_DEFAULT_BY_ID.forceHdr10Fallback
                );
            default:
                return assertNeverToggleSettingId(id);
        }
    }

    writeToggleSetting(id: ToggleSettingId, value: boolean): void {
        switch (id) {
            case 'dtsPassthrough':
                this._audioSettingsStore.writeDtsPassthroughEnabled(value);
                return;
            case 'directPlayAudioFallback':
                this._audioSettingsStore.writeDirectPlayAudioFallbackEnabled(value);
                return;
            case 'keepPlayingInSettings':
                this._profileSessionStore.writeKeepPlayingInSettings(value);
                return;
            case 'transcodeCompat':
                this._playbackSettingsStore.writeTranscodeCompatEnabled(value);
                return;
            case 'debugLogging':
                this._developerSettingsStore.writeDebugLoggingEnabled(value);
                return;
            case 'subtitleDebugLogging':
                this._developerSettingsStore.writeSubtitleDebugLoggingEnabled(value);
                return;
            case 'subtitlePreferForced':
                this._subtitlePreferencesStore.writeSubtitlePreferForced(value);
                return;
            case 'epgLibraryTabsEnabled':
                this._epgPreferencesStore.writeLibraryTabsEnabled(value);
                return;
            case 'epgNowWatchingEnabled':
                this._epgPreferencesStore.writeNowWatchingEnabled(value);
                return;
            case 'epgAggressivePreloadEnabled':
                this._epgPreferencesStore.writeAggressivePreloadEnabled(value);
                return;
            case 'showProfilePickerOnStartup':
                this._profileSessionStore.writeShowProfilePickerOnStartup(value);
                return;
            case 'cinematicNowPlaying':
                this._nowPlayingDisplayStore.writeCinematicNowPlayingEnabled(value);
                return;
            case 'preferClearLogos':
                this._nowPlayingDisplayStore.writePreferClearLogosEnabled(value);
                return;
            case 'smartHdr10Fallback':
                this._playbackSettingsStore.writeSmartHdr10FallbackEnabled(value);
                return;
            case 'forceHdr10Fallback':
                this._playbackSettingsStore.writeForceHdr10FallbackEnabled(value);
                return;
            default:
                return assertNeverToggleSettingId(id);
        }
    }

    readHdr10FallbackModeValueAndClean(): Hdr10FallbackModeValue {
        return this._playbackSettingsStore.readHdr10FallbackModeValueAndClean();
    }

    writeHdr10FallbackModeValue(value: Hdr10FallbackModeValue): void {
        this._playbackSettingsStore.writeHdr10FallbackModeValue(value);
    }

    readEpgLayoutModeValueAndClean(): 0 | 1 {
        return this._epgPreferencesStore.readLayoutModeAndClean('classic') === 'overlay' ? 0 : 1;
    }

    writeEpgLayoutModeValue(value: 0 | 1): void {
        const mode = value === 1 ? 'classic' : 'overlay';
        this._epgPreferencesStore.writeLayoutMode(mode);
    }

    readEpgGuideDensityValueAndClean(): 0 | 1 {
        return this._epgPreferencesStore.readGuideDensityAndClean('detailed') === 'wide' ? 1 : 0;
    }

    writeEpgGuideDensityValue(value: number): void {
        const density = value === 1 ? 'wide' : 'detailed';
        this._epgPreferencesStore.writeGuideDensity(density);
    }

    readEpgPastItemsWindowValueAndClean(): number {
        const raw = this._epgPreferencesStore.readPastItemsWindowAndClean('auto');
        const index = EPG_PAST_ITEMS_WINDOWS.findIndex((option) => option === raw);
        if (index >= 0) return index;
        return 0;
    }

    writeEpgPastItemsWindowValue(value: number): EpgPastItemsWindow {
        const option = EPG_PAST_ITEMS_WINDOWS[value] ?? EPG_PAST_ITEMS_WINDOWS[0];
        this._epgPreferencesStore.writePastItemsWindow(option);
        return option;
    }

    readEpgInfoBackgroundModeValueAndClean(): 0 | 1 | 2 {
        return this._epgPreferencesStore.readInfoBackgroundModeAndClean(DEFAULT_SETTINGS.display.epgInfoBackgroundMode);
    }

    writeEpgInfoBackgroundModeValue(value: number): 0 | 1 | 2 {
        const mode: 0 | 1 | 2 = value === 2 ? 2 : value === 1 ? 1 : 0;
        this._epgPreferencesStore.writeInfoBackgroundMode(mode);
        return mode;
    }

    readSubtitleModeAndClean(): SubtitleMode {
        return this._subtitlePreferencesStore.readSubtitleModeAndClean(DEFAULT_SUBTITLE_MODE);
    }

    writeSubtitleMode(mode: SubtitleMode): void {
        this._subtitlePreferencesStore.writeSubtitleMode(mode);
    }

    readSubtitleLanguageValueAndClean(options: ReadonlyArray<SubtitleLanguageOption>): number {
        const raw = this._subtitlePreferencesStore.readSubtitleLanguageAndClean();
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

    readTranscodeQualityValueAndClean(options: ReadonlyArray<{ storageValue: string }> = TRANSCODE_QUALITY_OPTIONS): number {
        return this._playbackSettingsStore.readTranscodeQualityValueAndClean(options);
    }

    writeTranscodeQualityValue(value: number, options: ReadonlyArray<{ storageValue: string }> = TRANSCODE_QUALITY_OPTIONS): void {
        this._playbackSettingsStore.writeTranscodeQualityValue(value, options);
    }

    readClampedNowPlayingAutoHideValueAndClean(validOptions: readonly number[], fallback: number = NOW_PLAYING_INFO_DEFAULTS.autoHideMs): number {
        return this._nowPlayingDisplayStore.readClampedAutoHideMsAndClean(
            validOptions,
            validOptions.includes(fallback)
                ? fallback
                : (validOptions.includes(NOW_PLAYING_INFO_DEFAULTS.autoHideMs)
                    ? NOW_PLAYING_INFO_DEFAULTS.autoHideMs
                    : (validOptions[0] ?? NOW_PLAYING_INFO_DEFAULTS.autoHideMs))
        );
    }

    writeNowPlayingAutoHideValue(value: number): void {
        this._nowPlayingDisplayStore.writeAutoHideMs(value, NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS);
    }
}
