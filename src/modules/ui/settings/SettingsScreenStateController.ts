import { DEFAULT_THEME, THEME_OPTIONS } from '../theme/themeDefinitions';
import type { GuideSettingChange, SettingsCategoryConfig } from './types';
import { SettingsStore } from './SettingsStore';
import type { ThemeName } from '../theme/themeDefinitions';
import {
    DEFAULT_SUBTITLE_MODE,
    SUBTITLE_MODES,
    type SubtitleMode,
} from '../../../shared/subtitle-mode';
import { dispatchDebugLoggingChanged } from '../../../config/events';
import { TRANSCODE_QUALITY_OPTIONS } from '../../../config/transcodeQuality';
import { NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS, NOW_PLAYING_INFO_DEFAULTS } from '../now-playing-info';
import {
    EPG_PAST_ITEMS_WINDOWS,
    type EpgPastItemsWindow,
} from '../../settings/EpgPreferencesStore';

const SUBTITLE_LANGUAGE_OPTIONS: Array<{ label: string; code: string | null }> = [
    { label: 'Auto (Plex)', code: null },
    { label: 'English', code: 'en' },
    { label: 'Spanish', code: 'es' },
    { label: 'French', code: 'fr' },
    { label: 'German', code: 'de' },
    { label: 'Italian', code: 'it' },
    { label: 'Portuguese', code: 'pt' },
    { label: 'Russian', code: 'ru' },
    { label: 'Japanese', code: 'ja' },
    { label: 'Korean', code: 'ko' },
    { label: 'Chinese', code: 'zh' },
];

const SUBTITLE_MODE_LABELS: Record<SubtitleMode, string> = {
    off: 'Off',
    direct: 'Direct only (fastest)',
    standard: 'Standard (avoid transcoding)',
    full: 'Full (Burn-in, default)',
};

const SUBTITLE_MODE_OPTIONS = SUBTITLE_MODES.map((mode) => ({
    label: SUBTITLE_MODE_LABELS[mode],
    mode,
}));

const EPG_PAST_ITEMS_LABELS: Record<EpgPastItemsWindow, string> = {
    auto: 'Auto (Recommended)',
    '0': 'Now (0m)',
    '15': '15m',
    '30': '30m',
};

const EPG_PAST_ITEMS_OPTIONS = EPG_PAST_ITEMS_WINDOWS.map((storageValue) => ({
    label: EPG_PAST_ITEMS_LABELS[storageValue],
    storageValue,
}));

const DEFAULT_THEME_VALUE = Math.max(
    0,
    THEME_OPTIONS.findIndex((option) => option.theme === DEFAULT_THEME)
);
const DEFAULT_SUBTITLE_MODE_VALUE = Math.max(
    0,
    SUBTITLE_MODE_OPTIONS.findIndex((option) => option.mode === DEFAULT_SUBTITLE_MODE)
);

export interface SettingsScreenStateControllerOptions {
    settingsStore?: SettingsStore;
    onSubtitleModeChange?: (mode: SubtitleMode) => void;
    onGuideSettingChange?: (change: GuideSettingChange) => void;
    onStateInvalidated?: () => void;
    getTheme?: () => ThemeName;
    setTheme?: (theme: ThemeName) => void;
}

export class SettingsScreenStateController {
    private readonly _settingsStore: SettingsStore;
    private readonly _onSubtitleModeChange: ((mode: SubtitleMode) => void) | null;
    private readonly _onGuideSettingChange: ((change: GuideSettingChange) => void) | null;
    private readonly _onStateInvalidated: (() => void) | null;
    private readonly _getTheme: () => ThemeName;
    private readonly _setTheme: (theme: ThemeName) => void;

    public constructor(options: SettingsScreenStateControllerOptions = {}) {
        this._settingsStore = options.settingsStore ?? new SettingsStore();
        this._onSubtitleModeChange = options.onSubtitleModeChange ?? null;
        this._onGuideSettingChange = options.onGuideSettingChange ?? null;
        this._onStateInvalidated = options.onStateInvalidated ?? null;
        this._getTheme = options.getTheme ?? ((): ThemeName => DEFAULT_THEME);
        this._setTheme = options.setTheme ?? ((_: ThemeName): void => undefined);
    }

    public getCategories(): SettingsCategoryConfig[] {
        const subtitleModeValue = this._readSubtitleModeValue();
        const subtitleMode = this._valueToSubtitleMode(subtitleModeValue);
        const subtitlesEnabled = subtitleMode !== 'off';

        const audioSubtitlesCategory: SettingsCategoryConfig = {
            id: 'audio_subtitles',
            label: '🔊 Audio & Subtitles',
            items: [
                {
                    id: 'settings-dts-passthrough',
                    label: 'DTS Passthrough',
                    description: 'Enable if you have an eARC receiver',
                    value: this._settingsStore.readToggleSettingAndClean('dtsPassthrough'),
                    onChange: (value: boolean) => this._settingsStore.writeToggleSetting('dtsPassthrough', value),
                },
                {
                    id: 'settings-direct-play-audio-fallback',
                    label: 'Direct Play Audio Fallback',
                    description: 'Allow Direct Play using a compatible fallback audio track',
                    value: this._settingsStore.readToggleSettingAndClean('directPlayAudioFallback'),
                    onChange: (value: boolean) =>
                        this._settingsStore.writeToggleSetting('directPlayAudioFallback', value),
                },
                {
                    id: 'settings-subtitle-mode',
                    label: 'Subtitle Mode',
                    description: 'Full is default (may transcode). Standard avoids transcoding when possible.',
                    value: subtitleModeValue,
                    options: SUBTITLE_MODE_OPTIONS.map((option, index) => ({
                        label: option.label,
                        value: index,
                    })),
                    onChange: (value: number): void => {
                        const mode = this._valueToSubtitleMode(value);
                        this._settingsStore.writeSubtitleMode(mode);
                        this._onSubtitleModeChange?.(mode);
                        this._onStateInvalidated?.();
                    },
                },
                {
                    id: 'settings-subtitle-language',
                    label: 'Preferred Subtitle Language',
                    description: 'Override Plex user preference (Auto uses Plex)',
                    value: this._readSubtitleLanguageValue(),
                    options: SUBTITLE_LANGUAGE_OPTIONS.map((option, index) => ({
                        label: option.label,
                        value: index,
                    })),
                    disabled: !subtitlesEnabled,
                    disabledReason: 'Enable Subtitle Mode first',
                    onChange: (value: number): void => {
                        this._writeSubtitleLanguageValue(value);
                    },
                },
                {
                    id: 'settings-subtitles-prefer-forced',
                    label: 'Prefer Forced Subtitles',
                    description: 'Auto-select forced (partial) subtitles over full subtitles',
                    value: this._settingsStore.readToggleSettingAndClean('subtitlePreferForced'),
                    disabled: !subtitlesEnabled,
                    disabledReason: 'Enable Subtitle Mode first',
                    onChange: (value: boolean): void => {
                        this._settingsStore.writeToggleSetting('subtitlePreferForced', value);
                    },
                },
            ],
        };

        const playbackHdrCategory: SettingsCategoryConfig = {
            id: 'playback_hdr',
            label: '▶ Playback & HDR',
            items: [
                {
                    id: 'settings-keep-playing',
                    label: 'Keep Playback Running in Settings',
                    description: 'Avoid pausing video when opening Settings (uses more CPU/GPU)',
                    value: this._settingsStore.readToggleSettingAndClean('keepPlayingInSettings'),
                    onChange: (value: boolean) => this._settingsStore.writeToggleSetting('keepPlayingInSettings', value),
                },
                {
                    id: 'settings-hdr10-fallback-mode',
                    label: 'HDR Fallback',
                    description:
                        'For DV MKV with HDR10 base layer only. Prefer HDR10 hides DV for direct-play; Force requests HLS/transcode.',
                    value: this._settingsStore.readHdr10FallbackModeValueAndClean(),
                    options: [
                        { label: 'Off', value: 0 },
                        { label: 'Prefer HDR10 (Direct Play)', value: 1 },
                        { label: 'Force HLS/Transcode', value: 2 },
                    ],
                    onChange: (value: number) => this._settingsStore.writeHdr10FallbackModeValue(value as 0 | 1 | 2),
                },
                {
                    id: 'settings-transcode-quality',
                    label: 'Transcode Quality',
                    description: 'Caps Plex transcoding bitrate/resolution (Direct Play is unaffected)',
                    value: this._readTranscodeQualityValue(),
                    options: TRANSCODE_QUALITY_OPTIONS.map((option, index) => ({
                        label: option.label,
                        value: index,
                    })),
                    onChange: (value: number): void => {
                        this._writeTranscodeQualityValue(value);
                    },
                },
                {
                    id: 'settings-transcode-compat',
                    label: 'Transcode Compat Mode',
                    description: 'Advanced: only use if transcoding fails; sends a minimal parameter set to Plex',
                    value: this._settingsStore.readToggleSettingAndClean('transcodeCompat'),
                    onChange: (value: boolean): void => {
                        this._settingsStore.writeToggleSetting('transcodeCompat', value);
                    },
                },
            ],
        };

        const appearanceCategory: SettingsCategoryConfig = {
            id: 'appearance',
            label: '🎨 Appearance',
            items: [
                {
                    id: 'settings-guide-library-tabs',
                    label: 'Library Tabs',
                    description: 'Filter the guide by source library',
                    value: this._settingsStore.readToggleSettingAndClean('epgLibraryTabsEnabled'),
                    onChange: (value: boolean): void => {
                        this._settingsStore.writeToggleSetting('epgLibraryTabsEnabled', value);
                        this._onGuideSettingChange?.({ key: 'libraryTabs', enabled: value });
                    },
                },
                {
                    id: 'settings-epg-now-watching',
                    label: 'Now Watching Banner',
                    description: 'Show current channel/program above the guide',
                    value: this._settingsStore.readToggleSettingAndClean('epgNowWatchingEnabled'),
                    onChange: (value: boolean): void => {
                        this._settingsStore.writeToggleSetting('epgNowWatchingEnabled', value);
                        this._onGuideSettingChange?.({ key: 'nowWatchingBanner', enabled: value });
                    },
                },
                {
                    id: 'settings-epg-aggressive-preload',
                    label: 'Aggressive Guide Preload (Experimental)',
                    description: 'Uses more memory to reduce loading in very large guides',
                    value: this._settingsStore.readToggleSettingAndClean('epgAggressivePreloadEnabled'),
                    onChange: (value: boolean): void => {
                        this._settingsStore.writeToggleSetting('epgAggressivePreloadEnabled', value);
                        this._onGuideSettingChange?.({ key: 'aggressivePreload', enabled: value });
                    },
                },
                {
                    id: 'settings-epg-density',
                    label: 'Guide Density',
                    description: 'Detailed shows 2 hours, Wide shows 3 hours',
                    value: this._readEpgGuideDensityValue(),
                    options: [
                        { label: 'Detailed (2h)', value: 0 },
                        { label: 'Wide (3h)', value: 1 },
                    ],
                    onChange: (value: number): void => {
                        this._writeEpgGuideDensityValue(value);
                        this._onGuideSettingChange?.({ key: 'guideDensity', density: value === 1 ? 'wide' : 'detailed' });
                    },
                },
                {
                    id: 'settings-epg-layout-mode',
                    label: 'Guide Layout',
                    description: 'Overlay keeps full-screen video; Classic shows PIP',
                    value: this._readEpgLayoutModeValue(),
                    options: [
                        { label: 'Overlay', value: 0 },
                        { label: 'Classic (PIP)', value: 1 },
                    ],
                    onChange: (value: number): void => {
                        this._writeEpgLayoutModeValue(value);
                        this._onGuideSettingChange?.({ key: 'layoutMode', mode: value === 1 ? 'classic' : 'overlay' });
                    },
                },
                {
                    id: 'settings-epg-past-items',
                    label: 'Past Items',
                    description: 'Auto uses Shows: 0m, Movies: 15m',
                    value: this._readEpgPastItemsWindowValue(),
                    options: EPG_PAST_ITEMS_OPTIONS.map((option, index) => ({
                        label: option.label,
                        value: index,
                    })),
                    onChange: (value: number): void => {
                        const stored = this._writeEpgPastItemsWindowValue(value);
                        this._onGuideSettingChange?.({ key: 'pastItemsWindow', value: stored });
                    },
                },
                {
                    id: 'settings-epg-info-background-mode',
                    label: 'Info Box Background',
                    description: 'Artwork Bleed uses poster color, Artwork shows backdrop art, Theme Default keeps the clean Ember & Steel overlay',
                    value: this._readEpgInfoBackgroundModeValue(),
                    options: [
                        { label: 'Artwork Bleed', value: 0 },
                        { label: 'Artwork', value: 2 },
                        { label: 'Theme Default', value: 1 },
                    ],
                    onChange: (value: number): void => {
                        const mode = this._writeEpgInfoBackgroundModeValue(value);
                        this._onGuideSettingChange?.({ key: 'infoBackgroundMode', mode });
                    },
                },
                {
                    id: 'settings-theme',
                    label: 'Theme',
                    description: 'Visual style of the application',
                    value: this._getThemeIndex(this._getTheme()),
                    options: THEME_OPTIONS.map((option, index) => ({
                        label: option.label,
                        value: index,
                    })),
                    onChange: (value: number): void => {
                        this._setTheme(THEME_OPTIONS[value]?.theme ?? DEFAULT_THEME);
                    },
                },
                {
                    id: 'settings-cinematic-now-playing',
                    label: 'Cinematic Now Playing',
                    description: 'Full-screen layout with blurred backdrop and large poster',
                    value: this._settingsStore.readToggleSettingAndClean('cinematicNowPlaying'),
                    onChange: (value: boolean): void => {
                        this._settingsStore.writeToggleSetting('cinematicNowPlaying', value);
                    },
                },
                {
                    id: 'settings-prefer-clear-logos',
                    label: 'Use Clear Logos',
                    description: 'Show clear logos instead of text titles when available',
                    value: this._settingsStore.readToggleSettingAndClean('preferClearLogos'),
                    onChange: (value: boolean): void => {
                        this._settingsStore.writeToggleSetting('preferClearLogos', value);
                    },
                },
                {
                    id: 'settings-now-playing-timeout',
                    label: 'Now Playing Auto-Hide',
                    description: 'Info overlay hide delay',
                    value: this._readClampedNowPlayingAutoHide(),
                    options: NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS.map((value) => ({
                        label: value === 0 ? 'Persistent' : `${Math.round(value / 1000)}s`,
                        value,
                    })),
                    onChange: (value: number): void => {
                        this._settingsStore.writeNowPlayingAutoHideValue(value);
                    },
                },
            ],
        };

        const accountCategory: SettingsCategoryConfig = {
            id: 'account',
            label: '👤 Account',
            items: [
                {
                    id: 'settings-profile-picker-startup',
                    label: 'Show Profile Picker on Startup',
                    description: 'When enabled, prompt for a Plex Home profile on launch',
                    value: this._settingsStore.readToggleSettingAndClean('showProfilePickerOnStartup'),
                    onChange: (value: boolean): void => {
                        this._settingsStore.writeToggleSetting('showProfilePickerOnStartup', value);
                    },
                },
            ],
        };

        const developerCategory: SettingsCategoryConfig = {
            id: 'developer',
            label: '🛠 Developer',
            items: [
                {
                    id: 'settings-debug-logging',
                    label: 'Debug Logging',
                    description: 'Enable verbose console output (applies immediately)',
                    value: this._settingsStore.readToggleSettingAndClean('debugLogging'),
                    onChange: (value: boolean): void => {
                        this._settingsStore.writeToggleSetting('debugLogging', value);
                        dispatchDebugLoggingChanged(value);
                    },
                },
                {
                    id: 'settings-subtitle-debug-logging',
                    label: 'Subtitle Debug Logging',
                    description: 'Log subtitle tracks and native textTracks state (tokens redacted)',
                    value: this._settingsStore.readToggleSettingAndClean('subtitleDebugLogging'),
                    onChange: (value: boolean): void => {
                        this._settingsStore.writeToggleSetting('subtitleDebugLogging', value);
                    },
                },
            ],
        };

        return [
            audioSubtitlesCategory,
            playbackHdrCategory,
            appearanceCategory,
            accountCategory,
            developerCategory,
        ];
    }

    private _getThemeIndex(theme: (typeof THEME_OPTIONS)[number]['theme']): number {
        const index = THEME_OPTIONS.findIndex((option) => option.theme === theme);
        return index >= 0 ? index : DEFAULT_THEME_VALUE;
    }

    private _subtitleModeToValue(mode: SubtitleMode): number {
        const index = SUBTITLE_MODE_OPTIONS.findIndex((option) => option.mode === mode);
        return index >= 0 ? index : DEFAULT_SUBTITLE_MODE_VALUE;
    }

    private _valueToSubtitleMode(value: number): SubtitleMode {
        const option = SUBTITLE_MODE_OPTIONS[value];
        if (!option) return DEFAULT_SUBTITLE_MODE;
        return option.mode;
    }

    private _readSubtitleModeValue(): number {
        return this._subtitleModeToValue(this._settingsStore.readSubtitleModeAndClean());
    }

    private _readSubtitleLanguageValue(): number {
        return this._settingsStore.readSubtitleLanguageValueAndClean(SUBTITLE_LANGUAGE_OPTIONS);
    }

    private _writeSubtitleLanguageValue(value: number): void {
        this._settingsStore.writeSubtitleLanguageValue(value, SUBTITLE_LANGUAGE_OPTIONS);
    }

    private _readTranscodeQualityValue(): number {
        return this._settingsStore.readTranscodeQualityValueAndClean(TRANSCODE_QUALITY_OPTIONS);
    }

    private _writeTranscodeQualityValue(value: number): void {
        this._settingsStore.writeTranscodeQualityValue(value, TRANSCODE_QUALITY_OPTIONS);
    }

    private _readEpgLayoutModeValue(): 0 | 1 {
        return this._settingsStore.readEpgLayoutModeValueAndClean();
    }

    private _writeEpgLayoutModeValue(value: number): void {
        this._settingsStore.writeEpgLayoutModeValue(value === 0 ? 0 : 1);
    }

    private _readEpgGuideDensityValue(): 0 | 1 {
        return this._settingsStore.readEpgGuideDensityValueAndClean();
    }

    private _writeEpgGuideDensityValue(value: number): void {
        this._settingsStore.writeEpgGuideDensityValue(value);
    }

    private _readEpgPastItemsWindowValue(): number {
        return this._settingsStore.readEpgPastItemsWindowValueAndClean();
    }

    private _writeEpgPastItemsWindowValue(value: number): EpgPastItemsWindow {
        return this._settingsStore.writeEpgPastItemsWindowValue(value);
    }

    private _readEpgInfoBackgroundModeValue(): 0 | 1 | 2 {
        return this._settingsStore.readEpgInfoBackgroundModeValueAndClean();
    }

    private _writeEpgInfoBackgroundModeValue(value: number): 0 | 1 | 2 {
        return this._settingsStore.writeEpgInfoBackgroundModeValue(value);
    }

    private _readClampedNowPlayingAutoHide(): number {
        return this._settingsStore.readClampedNowPlayingAutoHideValueAndClean(
            NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS,
            NOW_PLAYING_INFO_DEFAULTS.autoHideMs
        );
    }
}
