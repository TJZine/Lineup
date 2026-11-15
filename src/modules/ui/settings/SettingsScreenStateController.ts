import { DEFAULT_THEME, THEME_OPTIONS } from '../theme/themeDefinitions';
import type {
    GuideSettingChange,
    SettingsCategoryConfig,
    SettingsMutationResult,
    SettingsPersistenceResult,
} from './types';
import { SettingsStore, type SettingsWriteResult } from './SettingsStore';
import type { ThemeName } from '../theme/themeDefinitions';
import {
    DEFAULT_SUBTITLE_MODE,
    SUBTITLE_MODES,
    type SubtitleMode,
} from '../../../shared/subtitle-mode';
import { dispatchDebugLoggingChanged } from '../../../config/events';
import { TRANSCODE_QUALITY_OPTIONS } from '../../../config/transcodeQuality';
import {
    EPG_PAST_ITEMS_WINDOWS,
    EPG_GUIDE_HOURS_OPTIONS,
    type EpgPastItemsWindow,
} from '../../settings/EpgPreferencesStore';
import { COMPACT_CONTROLS_TIMEOUT_SECONDS_OPTIONS, OVERLAY_TRANSPARENCY_OPTIONS } from '../../settings/NowPlayingDisplayStore';
import { SUPPORTED_SUBTITLE_LANGUAGES } from '../../../shared/subtitle-language';

const SUBTITLE_LANGUAGE_OPTIONS: Array<{ label: string; code: string | null }> = [
    { label: 'Auto (Plex)', code: null },
    ...SUPPORTED_SUBTITLE_LANGUAGES.map((language) => ({
        label: language.label,
        code: language.code,
    })),
];

function getSubtitleLanguageOptions(languageCode: string | null): Array<{ label: string; code: string | null }> {
    if (languageCode === null || SUBTITLE_LANGUAGE_OPTIONS.some((option) => option.code === languageCode)) {
        return SUBTITLE_LANGUAGE_OPTIONS;
    }

    return [...SUBTITLE_LANGUAGE_OPTIONS, { label: `Saved preference (${languageCode})`, code: languageCode }];
}

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
    '0': 'Current slot',
    '15': 'At least 15 min',
    '30': 'At least 30 min',
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
const SETTINGS_WRITE_FAILURE_MESSAGE = 'Could not save this setting. Check device storage and try again.';

export interface SettingsScreenStateControllerOptions {
    settingsStore?: SettingsStore;
    onSubtitleModeChange?: (mode: SubtitleMode) => void;
    onGuideSettingChange?: (change: GuideSettingChange) => void;
    onStateInvalidated?: () => void;
    getTheme?: () => ThemeName;
    setTheme?: (theme: ThemeName) => SettingsPersistenceResult;
    getThemePersistenceResult?: () => SettingsPersistenceResult;
    retryThemePersistence?: () => SettingsPersistenceResult;
    onKeepPlayingInSettingsChange?: (enabled: boolean) => void;
    onAccessibilityChange?: (name: 'reduceMotion' | 'largeFocus', enabled: boolean) => void;
    onOverlayTransparencyChange?: (value: (typeof OVERLAY_TRANSPARENCY_OPTIONS)[number]) => void;
    onSwitchProfile?: () => void;
    onSwitchServer?: () => void;
    onManageChannels?: () => void;
    onSignOut?: () => void | Promise<void>;
    getActiveUsername?: () => string | null;
    onOpenSupportReport?: () => void;
    onOpenNotices?: () => void;
    onClearSupportReport?: () => void;
}

export class SettingsScreenStateController {
    private readonly _settingsStore: SettingsStore;
    private readonly _onSubtitleModeChange: ((mode: SubtitleMode) => void) | null;
    private readonly _onGuideSettingChange: ((change: GuideSettingChange) => void) | null;
    private readonly _onStateInvalidated: (() => void) | null;
    private readonly _getTheme: () => ThemeName;
    private readonly _setTheme: (theme: ThemeName) => SettingsPersistenceResult;
    private readonly _getThemePersistenceResult: (() => SettingsPersistenceResult) | null;
    private readonly _retryThemePersistence: (() => SettingsPersistenceResult) | null;
    private readonly _onKeepPlayingInSettingsChange: ((enabled: boolean) => void) | null;
    private readonly _onAccessibilityChange: ((name: 'reduceMotion' | 'largeFocus', enabled: boolean) => void) | null;
    private readonly _onOverlayTransparencyChange: ((value: (typeof OVERLAY_TRANSPARENCY_OPTIONS)[number]) => void) | null;
    private readonly _onSwitchProfile: (() => void) | null;
    private readonly _onSwitchServer: (() => void) | null;
    private readonly _onManageChannels: (() => void) | null;
    private readonly _onSignOut: (() => void | Promise<void>) | null;
    private readonly _getActiveUsername: (() => string | null) | null;
    private readonly _onOpenSupportReport: (() => void) | null;
    private readonly _onOpenNotices: (() => void) | null;
    private readonly _onClearSupportReport: (() => void) | null;

    public constructor(options: SettingsScreenStateControllerOptions = {}) {
        this._settingsStore = options.settingsStore ?? new SettingsStore();
        this._onSubtitleModeChange = options.onSubtitleModeChange ?? null;
        this._onGuideSettingChange = options.onGuideSettingChange ?? null;
        this._onStateInvalidated = options.onStateInvalidated ?? null;
        this._getTheme = options.getTheme ?? ((): ThemeName => DEFAULT_THEME);
        this._setTheme = options.setTheme ?? ((_: ThemeName): SettingsPersistenceResult => ({ ok: false, effectiveValue: DEFAULT_THEME, migration: null, reason: 'unavailable', retryable: true }));
        this._getThemePersistenceResult = options.getThemePersistenceResult ?? null;
        this._retryThemePersistence = options.retryThemePersistence ?? null;
        this._onKeepPlayingInSettingsChange = options.onKeepPlayingInSettingsChange ?? null;
        this._onAccessibilityChange = options.onAccessibilityChange ?? null;
        this._onOverlayTransparencyChange = options.onOverlayTransparencyChange ?? null;
        this._onSwitchProfile = options.onSwitchProfile ?? null;
        this._onSwitchServer = options.onSwitchServer ?? null;
        this._onManageChannels = options.onManageChannels ?? null;
        this._onSignOut = options.onSignOut ?? null;
        this._getActiveUsername = options.getActiveUsername ?? null;
        this._onOpenSupportReport = options.onOpenSupportReport ?? null;
        this._onOpenNotices = options.onOpenNotices ?? null;
        this._onClearSupportReport = options.onClearSupportReport ?? null;
    }

    public getCategories(): SettingsCategoryConfig[] {
        const subtitleModeValue = this._readSubtitleModeValue();
        const subtitlesEnabled = this._valueToSubtitleMode(subtitleModeValue) !== 'off';
        const subtitleLanguageCode = this._settingsStore.readSubtitleLanguageAndClean();
        const subtitleLanguageOptions = getSubtitleLanguageOptions(subtitleLanguageCode);
        const subtitleLanguageValue = this._subtitleLanguageIndex(subtitleLanguageCode, subtitleLanguageOptions) ?? 0;
        const guideHoursRead = this._settingsStore.readGuideHoursAndMigrate();
        const guideHours = guideHoursRead.ok ? guideHoursRead.value : guideHoursRead.effectiveValue;
        const themePersistence = this._getThemePersistenceResult?.();
        const themeHelp = themePersistence && !themePersistence.ok
            ? `Theme is ${themePersistence.effectiveValue}; saving failed (${themePersistence.reason}). Select a theme or retry saving.`
            : 'Choose the visual style for Lineup.';

        return [
            {
                id: 'appearance', label: 'Appearance', description: 'Choose how Lineup looks on this TV.', items: [
                    {
                        id: 'settings-theme', label: 'Theme', description: themeHelp,
                        value: this._getThemeIndex(this._getTheme()),
                        options: THEME_OPTIONS.map((option, index) => ({ label: option.label, value: index })),
                        onChange: (value: number): SettingsMutationResult<number> => {
                            const result = this._setTheme(THEME_OPTIONS[value]?.theme ?? DEFAULT_THEME);
                            return result.ok
                                ? { ok: true }
                                : this._failedMutationResult(this._getThemeIndex(result.effectiveValue));
                        },
                    },
                    ...(themePersistence && !themePersistence.ok && this._retryThemePersistence ? [{
                        id: 'settings-theme-retry', label: 'Retry saving theme',
                        description: `Current theme: ${themePersistence.effectiveValue}. The previous write did not save.`,
                        action: (): void => { this._retryThemePersistence?.(); this._onStateInvalidated?.(); },
                    }] : []),
                    {
                        id: 'settings-epg-info-background-mode', label: 'Artwork Background',
                        description: 'Artwork Bleed uses poster color; Artwork shows backdrop art; Theme Default uses the theme surface.',
                        value: this._readEpgInfoBackgroundModeValue(),
                        options: [
                            { label: 'Artwork Bleed', value: 0 },
                            { label: 'Theme Default', value: 1 },
                            { label: 'Artwork', value: 2 },
                        ],
                        onChange: (value: number): SettingsMutationResult<number> => {
                            const result = this._settingsStore.writeEpgInfoBackgroundModeValue(value);
                            if (!result.ok) return this._failedMutationResult(result.effectiveValue);
                            this._onGuideSettingChange?.({ key: 'infoBackgroundMode', mode: result.value });
                            return { ok: true };
                        },
                    },
                    {
                        id: 'settings-overlay-transparency', label: 'Overlay Transparency',
                        description: 'Changes the opacity of player overlay surfaces; artwork background is separate.',
                        value: OVERLAY_TRANSPARENCY_OPTIONS.indexOf(this._settingsStore.readOverlayTransparencyAndClean()),
                        options: OVERLAY_TRANSPARENCY_OPTIONS.map((option, index) => ({
                            label: option === 'more-transparent' ? 'More transparent' : option === 'reduced' ? 'Reduce transparency' : 'Standard',
                            value: index,
                        })),
                        onChange: (value: number): SettingsMutationResult<number> => {
                            const option = OVERLAY_TRANSPARENCY_OPTIONS[value] ?? 'standard';
                            const result = this._settingsStore.writeOverlayTransparency(option);
                            if (!result.ok) return this._failedMutationResult(OVERLAY_TRANSPARENCY_OPTIONS.indexOf(result.effectiveValue));
                            this._onOverlayTransparencyChange?.(result.value);
                            return { ok: true };
                        },
                    },
                    {
                        id: 'settings-prefer-clear-logos', label: 'Use Clear Logos',
                        description: 'Show clear logos when available; text titles remain the fallback.',
                        value: this._settingsStore.readToggleSettingAndClean('preferClearLogos'),
                        onChange: (value: boolean) => this._toMutationResult(this._settingsStore.writeToggleSetting('preferClearLogos', value)),
                    },
                ],
            },
            {
                id: 'guide', label: 'Guide', description: 'Choose what appears while browsing channels.', items: [
                    ...(this._onManageChannels ? [{ id: 'settings-manage-channels', label: 'Manage channels',
                        description: 'Search, edit and organize the saved lineup.', action: this._onManageChannels }] : []),
                    {
                        id: 'settings-guide-library-tabs', label: 'Library Tabs',
                        description: 'Filter the guide by source library.',
                        value: this._settingsStore.readToggleSettingAndClean('epgLibraryTabsEnabled'),
                        onChange: (value: boolean): SettingsMutationResult<boolean> => {
                            const result = this._settingsStore.writeToggleSetting('epgLibraryTabsEnabled', value);
                            if (!result.ok) return this._failedMutationResult(result.effectiveValue);
                            this._onGuideSettingChange?.({ key: 'libraryTabs', enabled: value });
                            return { ok: true };
                        },
                    },
                    {
                        id: 'settings-epg-now-watching', label: 'Now Watching Banner',
                        description: 'Show the current channel and program above the guide.',
                        value: this._settingsStore.readToggleSettingAndClean('epgNowWatchingEnabled'),
                        onChange: (value: boolean): SettingsMutationResult<boolean> => {
                            const result = this._settingsStore.writeToggleSetting('epgNowWatchingEnabled', value);
                            if (!result.ok) return this._failedMutationResult(result.effectiveValue);
                            this._onGuideSettingChange?.({ key: 'nowWatchingBanner', enabled: value });
                            return { ok: true };
                        },
                    },
                    {
                        id: 'settings-guide-hours', label: 'Guide Hours',
                        description: guideHoursRead.ok ? 'Time span visible in the Guide.' : 'Guide hours could not be saved. Retry the migration or choose a different value.',
                        value: EPG_GUIDE_HOURS_OPTIONS.indexOf(guideHours),
                        options: EPG_GUIDE_HOURS_OPTIONS.map((hours, index) => ({ label: `${hours} hours`, value: index })),
                        onChange: (value: number): SettingsMutationResult<number> => {
                            const result = this._settingsStore.writeGuideHours(EPG_GUIDE_HOURS_OPTIONS[value] ?? 2);
                            if (!result.ok) return this._failedMutationResult(EPG_GUIDE_HOURS_OPTIONS.indexOf(result.effectiveValue));
                            this._onGuideSettingChange?.({ key: 'guideHours', hours: result.value });
                            if (!guideHoursRead.ok) this._onStateInvalidated?.();
                            return { ok: true };
                        },
                    },
                    ...(!guideHoursRead.ok ? [{
                        id: 'settings-guide-hours-retry', label: 'Retry saving Guide Hours',
                        description: `Current effective range: ${guideHours} hours. The migration has not been saved.`,
                        action: (): void => {
                            // Retry the current migration, never the displayed fallback or
                            // an older selection captured when this recovery row was built.
                            const result = this._settingsStore.readGuideHoursAndMigrate();
                            if (!result.ok) throw new Error('Guide Hours migration failed');
                            this._onGuideSettingChange?.({ key: 'guideHours', hours: result.value });
                            this._onStateInvalidated?.();
                        },
                    }] : []),
                    {
                        id: 'settings-epg-source-labels', label: 'Channel Source Labels',
                        description: 'Show a channel’s source beside its name in the Guide.',
                        value: this._settingsStore.readToggleSettingAndClean('epgSourceLabelsEnabled'),
                        onChange: (value: boolean): SettingsMutationResult<boolean> => {
                            const result = this._settingsStore.writeToggleSetting('epgSourceLabelsEnabled', value);
                            if (!result.ok) return this._failedMutationResult(result.effectiveValue);
                            this._onGuideSettingChange?.({ key: 'sourceLabels', enabled: result.value });
                            return { ok: true };
                        },
                    },
                    {
                        id: 'settings-epg-past-items', label: 'Past Items',
                        description: 'Advanced: Auto keeps the current slot for shows and at least 15 minutes for movies.',
                        value: this._readEpgPastItemsWindowValue(),
                        options: EPG_PAST_ITEMS_OPTIONS.map((option, index) => ({ label: option.label, value: index })),
                        onChange: (value: number): SettingsMutationResult<number> => {
                            const result = this._settingsStore.writeEpgPastItemsWindowValue(value);
                            if (!result.ok) return this._failedMutationResult(result.effectiveValue);
                            this._onGuideSettingChange?.({ key: 'pastItemsWindow', value: EPG_PAST_ITEMS_WINDOWS[result.value] ?? 'auto' });
                            return { ok: true };
                        },
                    },
                    {
                        id: 'settings-epg-aggressive-preload', label: 'Aggressive Guide Preload',
                        description: 'Advanced: uses more memory to reduce loading in very large guides.',
                        value: this._settingsStore.readToggleSettingAndClean('epgAggressivePreloadEnabled'),
                        onChange: (value: boolean): SettingsMutationResult<boolean> => {
                            const result = this._settingsStore.writeToggleSetting('epgAggressivePreloadEnabled', value);
                            if (!result.ok) return this._failedMutationResult(result.effectiveValue);
                            this._onGuideSettingChange?.({ key: 'aggressivePreload', enabled: value });
                            return { ok: true };
                        },
                    },
                ],
            },
            {
                id: 'playback', label: 'Playback', description: 'Choose how video plays and how controls behave.', items: [
                    {
                        id: 'settings-keep-playing', label: 'Keep Playback Running in Settings',
                        description: 'Continue video while Settings is open; uses more CPU and GPU.',
                        value: this._settingsStore.readToggleSettingAndClean('keepPlayingInSettings'),
                        onChange: (value: boolean): SettingsMutationResult<boolean> => {
                            const result = this._settingsStore.writeToggleSetting('keepPlayingInSettings', value);
                            if (!result.ok) return this._failedMutationResult(result.effectiveValue);
                            this._onKeepPlayingInSettingsChange?.(value);
                            return { ok: true };
                        },
                    },
                    {
                        id: 'settings-hdr10-fallback-mode', label: 'HDR Fallback',
                        description: 'For eligible DV MKV with an HDR10 base layer. Force requests HLS or transcoding.',
                        value: this._settingsStore.readHdr10FallbackModeValueAndClean(),
                        options: [
                            { label: 'Off', value: 0 },
                            { label: 'Prefer HDR10 (Direct Play)', value: 1 },
                            { label: 'Force HLS/Transcode', value: 2 },
                        ],
                        onChange: (value: number) => this._toMutationResult(this._settingsStore.writeHdr10FallbackModeValue(value as 0 | 1 | 2)),
                    },
                    {
                        id: 'settings-transcode-quality', label: 'Transcode Quality',
                        description: 'Caps Plex transcode bitrate and resolution. Direct Play is unaffected.',
                        value: this._readTranscodeQualityValue(),
                        options: TRANSCODE_QUALITY_OPTIONS.map((option, index) => ({ label: option.label, value: index })),
                        onChange: (value: number) => this._writeTranscodeQualityValue(value),
                    },
                    {
                        id: 'settings-compact-controls-timeout', label: 'Compact Controls Timeout',
                        description: 'Hide compact player controls after inactivity. Expanded information stays open.',
                        value: COMPACT_CONTROLS_TIMEOUT_SECONDS_OPTIONS.indexOf(this._settingsStore.readCompactControlsTimeoutSecondsAndClean()),
                        options: COMPACT_CONTROLS_TIMEOUT_SECONDS_OPTIONS.map((seconds, index) => ({ label: `${seconds} seconds`, value: index })),
                        onChange: (value: number): SettingsMutationResult<number> => {
                            const result = this._settingsStore.writeCompactControlsTimeoutSeconds(COMPACT_CONTROLS_TIMEOUT_SECONDS_OPTIONS[value] ?? 4);
                            return result.ok ? { ok: true } : this._failedMutationResult(COMPACT_CONTROLS_TIMEOUT_SECONDS_OPTIONS.indexOf(result.effectiveValue));
                        },
                    },
                    {
                        id: 'settings-transcode-compat', label: 'Transcode Compat Mode',
                        description: 'Advanced: send minimal Plex parameters only if transcoding fails.',
                        value: this._settingsStore.readToggleSettingAndClean('transcodeCompat'),
                        onChange: (value: boolean) => this._toMutationResult(this._settingsStore.writeToggleSetting('transcodeCompat', value)),
                    },
                ],
            },
            {
                id: 'audio_subtitles', label: 'Audio & Subtitles', description: 'Choose how Lineup plays audio and displays subtitles on this TV.', items: [
                    {
                        id: 'settings-dts-passthrough', label: 'DTS Passthrough',
                        description: 'Enable when an eARC receiver supports DTS.',
                        value: this._settingsStore.readToggleSettingAndClean('dtsPassthrough'),
                        onChange: (value: boolean) => this._toMutationResult(this._settingsStore.writeToggleSetting('dtsPassthrough', value)),
                    },
                    {
                        id: 'settings-direct-play-audio-fallback', label: 'Direct Play Audio Fallback',
                        description: 'Allow a compatible audio track to keep video in Direct Play.',
                        value: this._settingsStore.readToggleSettingAndClean('directPlayAudioFallback'),
                        onChange: (value: boolean) => this._toMutationResult(this._settingsStore.writeToggleSetting('directPlayAudioFallback', value)),
                    },
                    {
                        id: 'settings-subtitle-mode', label: 'Subtitle Mode',
                        description: 'Full may transcode; Standard avoids transcoding when possible.',
                        value: subtitleModeValue,
                        options: SUBTITLE_MODE_OPTIONS.map((option, index) => ({ label: option.label, value: index })),
                        onChange: (value: number): SettingsMutationResult<number> => {
                            const mode = this._valueToSubtitleMode(value);
                            const result = this._settingsStore.writeSubtitleMode(mode);
                            if (!result.ok) return this._failedMutationResult(this._subtitleModeToValue(result.effectiveValue));
                            this._onSubtitleModeChange?.(mode);
                            this._onStateInvalidated?.();
                            return { ok: true };
                        },
                    },
                    {
                        id: 'settings-subtitle-language', label: 'Preferred Subtitle Language',
                        description: 'Override Plex user preference; Auto follows Plex.',
                        value: subtitleLanguageValue,
                        options: subtitleLanguageOptions.map((option, index) => ({ label: option.label, value: index })),
                        disabled: !subtitlesEnabled, disabledReason: 'Enable Subtitle Mode first.',
                        onChange: (value: number) => this._writeSubtitleLanguageValue(value, subtitleLanguageOptions),
                    },
                    {
                        id: 'settings-subtitles-prefer-forced', label: 'Prefer Forced Subtitles',
                        description: 'Auto-select forced partial subtitles over full subtitles.',
                        value: this._settingsStore.readToggleSettingAndClean('subtitlePreferForced'),
                        disabled: !subtitlesEnabled, disabledReason: 'Enable Subtitle Mode first.',
                        onChange: (value: boolean) => this._toMutationResult(this._settingsStore.writeToggleSetting('subtitlePreferForced', value)),
                    },
                ],
            },
            {
                id: 'accessibility', label: 'Accessibility', description: 'Make Lineup easier to navigate and read.', items: [
                    {
                        id: 'settings-reduce-motion', label: 'Reduce Motion',
                        description: 'Reduce animations; TV system motion settings still apply.',
                        value: this._settingsStore.readToggleSettingAndClean('reduceMotion'),
                        onChange: (value: boolean): SettingsMutationResult<boolean> => {
                            const result = this._settingsStore.writeToggleSetting('reduceMotion', value);
                            if (!result.ok) return this._failedMutationResult(result.effectiveValue);
                            this._onAccessibilityChange?.('reduceMotion', value);
                            return { ok: true };
                        },
                    },
                    {
                        id: 'settings-large-focus', label: 'Large Focus',
                        description: 'Increase focus outlines throughout the app.',
                        value: this._settingsStore.readToggleSettingAndClean('largeFocus'),
                        onChange: (value: boolean): SettingsMutationResult<boolean> => {
                            const result = this._settingsStore.writeToggleSetting('largeFocus', value);
                            if (!result.ok) return this._failedMutationResult(result.effectiveValue);
                            this._onAccessibilityChange?.('largeFocus', value);
                            return { ok: true };
                        },
                    },
                ],
            },
            {
                id: 'account', label: 'Account',
                description: `Current profile: ${this._getActiveUsername?.() ?? 'Plex account'}. Manage the profile and server used on this TV.`,
                items: [
                    {
                        id: 'settings-profile-picker-startup', label: 'Show Profile Picker on Startup',
                        description: 'Prompt for a Plex Home profile on a cold launch.',
                        value: this._settingsStore.readToggleSettingAndClean('showProfilePickerOnStartup'),
                        onChange: (value: boolean) => this._toMutationResult(this._settingsStore.writeToggleSetting('showProfilePickerOnStartup', value)),
                    },
                    ...(this._onSwitchProfile ? [{ id: 'settings-switch-profile', label: 'Switch profile', description: 'Choose another Plex Home profile.', action: this._onSwitchProfile }] : []),
                    ...(this._onSwitchServer ? [{ id: 'settings-switch-server', label: 'Switch server', description: 'Choose another Plex Media Server.', action: this._onSwitchServer }] : []),
                    ...(this._onSignOut ? [{ id: 'settings-sign-out', label: 'Sign out', description: 'Sign out of Plex on this TV.', action: this._onSignOut }] : []),
                ],
            },
            {
                id: 'support', label: 'Support', description: 'Local report and offline notices. Nothing is sent automatically.', sectionLabel: 'Support report', items: [
                    {
                        id: 'settings-support-report-opt-in', label: 'Collect Support Report',
                        description: 'Off by default. Records only limited event codes, times and outcomes on this TV.',
                        value: this._settingsStore.readToggleSettingAndClean('supportReportOptIn'),
                        onChange: (value: boolean): SettingsMutationResult<boolean> => {
                            const result = this._settingsStore.writeToggleSetting('supportReportOptIn', value);
                            if (!result.ok && !value && result.effectiveValue === false) {
                                return {
                                    ok: false,
                                    effectiveValue: false,
                                    message: 'Collection is off, but the retained report could not be cleared. Use Clear local report to retry.',
                                };
                            }
                            return this._toMutationResult(result);
                        },
                    },
                    ...(this._onOpenSupportReport ? [{ id: 'settings-support-view-report', label: 'View local report', description: 'Create and read a sanitized report on this TV.', action: this._onOpenSupportReport }] : []),
                    ...(this._onClearSupportReport ? [{ id: 'settings-support-clear-report', label: 'Clear local report', description: 'Remove the retained Support report. Retry if storage is unavailable.', action: this._onClearSupportReport }] : []),
                    ...(this._onOpenNotices ? [{ id: 'settings-support-notices', label: 'Offline notices', description: 'Read bundled license text without a network connection.', action: this._onOpenNotices }] : []),
                    {
                        id: 'settings-debug-logging', label: 'Debug Logging',
                        description: 'Advanced: enable verbose console logging.',
                        value: this._settingsStore.readToggleSettingAndClean('debugLogging'),
                        onChange: (value: boolean): SettingsMutationResult<boolean> => {
                            const result = this._settingsStore.writeToggleSetting('debugLogging', value);
                            if (!result.ok) return this._failedMutationResult(result.effectiveValue);
                            dispatchDebugLoggingChanged(value);
                            return { ok: true };
                        },
                    },
                    {
                        id: 'settings-subtitle-debug-logging', label: 'Subtitle Debug Logging',
                        description: 'Advanced: log subtitle track state with tokens redacted.',
                        value: this._settingsStore.readToggleSettingAndClean('subtitleDebugLogging'),
                        onChange: (value: boolean) => this._toMutationResult(this._settingsStore.writeToggleSetting('subtitleDebugLogging', value)),
                    },
                ],
            },
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

    private _subtitleLanguageIndex(
        languageCode: string | null,
        options: ReadonlyArray<{ label: string; code: string | null }>
    ): number | undefined {
        const index = options.findIndex((option) => option.code === languageCode);
        return index < 0 ? undefined : index;
    }

    private _writeSubtitleLanguageValue(
        value: number,
        options: ReadonlyArray<{ label: string; code: string | null }>
    ): SettingsMutationResult<number> {
        const selectedOption = options[value] ?? options[0];
        const result = this._settingsStore.writeSubtitleLanguage(selectedOption?.code ?? null);
        if (result.ok) return { ok: true };

        const effectiveValue = this._subtitleLanguageIndex(result.effectiveValue, options);
        return this._failedMutationResult(effectiveValue);
    }

    private _readTranscodeQualityValue(): number {
        return this._settingsStore.readTranscodeQualityValueAndClean(TRANSCODE_QUALITY_OPTIONS);
    }

    private _writeTranscodeQualityValue(value: number): SettingsMutationResult<number> {
        return this._toMutationResult(
            this._settingsStore.writeTranscodeQualityValue(value, TRANSCODE_QUALITY_OPTIONS)
        );
    }

    private _readEpgPastItemsWindowValue(): number {
        return this._settingsStore.readEpgPastItemsWindowValueAndClean();
    }

    private _readEpgInfoBackgroundModeValue(): 0 | 1 | 2 {
        return this._settingsStore.readEpgInfoBackgroundModeValueAndClean();
    }

    private _toMutationResult<T extends boolean | number>(result: SettingsWriteResult<T>): SettingsMutationResult<T> {
        return result.ok ? { ok: true } : this._failedMutationResult(result.effectiveValue);
    }

    private _failedMutationResult<T extends boolean | number>(effectiveValue?: T): SettingsMutationResult<T> {
        return effectiveValue === undefined
            ? { ok: false, message: SETTINGS_WRITE_FAILURE_MESSAGE }
            : { ok: false, message: SETTINGS_WRITE_FAILURE_MESSAGE, effectiveValue };
    }

}
