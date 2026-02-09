/**
 * @fileoverview Settings screen component.
 * @module modules/ui/settings/SettingsScreen
 * @version 1.0.0
 */

import type { INavigationManager, FocusableElement, KeyEvent } from '../../navigation';
import { createSettingsToggle } from './SettingsToggle';
import { createSettingsSelect } from './SettingsSelect';
import { SETTINGS_STORAGE_KEYS, DEFAULT_SETTINGS } from './constants';
import { DEFAULT_THEME, THEME_OPTIONS } from './theme';
import type {
    SettingsSectionConfig,
    SettingsItemConfig,
    SettingsSelectConfig,
    SettingsSectionId,
    GuideSettingChange,
} from './types';
import { NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS, NOW_PLAYING_INFO_DEFAULTS } from '../now-playing-info';
import { readStoredBoolean, safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from '../../../utils/storage';
import { ThemeManager } from '../theme';
import { getSubtitleMode, setSubtitleMode, type SubtitleMode } from '../../../shared/subtitle-mode';
import { RETUNE_STORAGE_KEYS } from '../../../config/storageKeys';
import { dispatchDebugLoggingChanged } from '../../../config/events';

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

const SUBTITLE_MODE_OPTIONS: Array<{ label: string; mode: SubtitleMode }> = [
    { label: 'Off', mode: 'off' },
    { label: 'Direct only (fastest)', mode: 'direct' },
    { label: 'Standard (Recommended)', mode: 'standard' },
    { label: 'Full (Burn-in)', mode: 'full' },
];

const DEFAULT_THEME_VALUE = Math.max(
    0,
    THEME_OPTIONS.findIndex((option) => option.theme === DEFAULT_THEME)
);

type ToggleMetadata = {
    storageKey: string;
    defaultValue: boolean;
    onRefresh?: (value: boolean) => void;
};

type SelectMetadata = {
    storageKey: string;
    defaultValue: number;
    onRefresh?: (value: number) => void;
};

const TOGGLE_METADATA: Record<string, ToggleMetadata> = {
    'settings-dts-passthrough': {
        storageKey: SETTINGS_STORAGE_KEYS.DTS_PASSTHROUGH,
        defaultValue: DEFAULT_SETTINGS.audio.dtsPassthrough,
    },
    'settings-direct-play-audio-fallback': {
        storageKey: SETTINGS_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK,
        defaultValue: DEFAULT_SETTINGS.audio.directPlayAudioFallback,
    },
    'settings-keep-playing': {
        storageKey: SETTINGS_STORAGE_KEYS.KEEP_PLAYING_IN_SETTINGS,
        defaultValue: DEFAULT_SETTINGS.playback.keepPlayingInSettings,
    },
    'settings-debug-logging': {
        storageKey: SETTINGS_STORAGE_KEYS.DEBUG_LOGGING,
        defaultValue: DEFAULT_SETTINGS.developer.debugLogging,
    },
    'settings-subtitle-debug-logging': {
        storageKey: SETTINGS_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING,
        defaultValue: DEFAULT_SETTINGS.developer.subtitleDebugLogging,
    },
    'settings-subtitles-global': {
        storageKey: SETTINGS_STORAGE_KEYS.SUBTITLE_PREFERENCE_GLOBAL_OVERRIDE,
        defaultValue: DEFAULT_SETTINGS.subtitles.useGlobalPreference,
    },
    'settings-subtitles-prefer-forced': {
        storageKey: SETTINGS_STORAGE_KEYS.SUBTITLE_PREFER_FORCED,
        defaultValue: DEFAULT_SETTINGS.subtitles.preferForced,
    },
    'settings-guide-category-colors': {
        storageKey: SETTINGS_STORAGE_KEYS.GUIDE_CATEGORY_COLORS,
        defaultValue: true,
    },
    'settings-guide-library-tabs': {
        storageKey: SETTINGS_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED,
        defaultValue: true,
    },
    'settings-epg-now-watching': {
        storageKey: SETTINGS_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED,
        defaultValue: true,
    },
    'settings-profile-picker-startup': {
        storageKey: SETTINGS_STORAGE_KEYS.SHOW_PROFILE_PICKER_ON_STARTUP,
        defaultValue: DEFAULT_SETTINGS.account.showProfilePickerOnStartup,
    },
};

const SELECT_METADATA: Record<string, SelectMetadata> = {
    'settings-now-playing-timeout': {
        storageKey: SETTINGS_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS,
        defaultValue: DEFAULT_SETTINGS.display.nowPlayingInfoAutoHideMs,
    },
    'settings-subtitle-mode': {
        storageKey: SETTINGS_STORAGE_KEYS.SUBTITLE_MODE,
        defaultValue: 2, // Standard (Recommended)
    },
    'settings-subtitle-language': {
        storageKey: SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE,
        defaultValue: 0,
    },
    'settings-hdr10-fallback-mode': {
        storageKey: SETTINGS_STORAGE_KEYS.SMART_HDR10_FALLBACK,
        defaultValue: 0,
    },
    'settings-epg-layout-mode': {
        storageKey: SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE,
        defaultValue: 0,
    },
    'settings-epg-density': {
        storageKey: SETTINGS_STORAGE_KEYS.EPG_GUIDE_DENSITY,
        defaultValue: 0,
    },
};

/**
 * Settings screen component.
 * Manages settings display, focus navigation, and persistence.
 */
export class SettingsScreen {
    private _container: HTMLElement;
    private _getNavigation: () => INavigationManager | null;
    private _onSubtitleModeChange: ((mode: SubtitleMode) => void) | null = null;
    private _onGuideSettingChange: ((change: GuideSettingChange) => void) | null = null;
    private _focusableIds: string[] = [];
    private _toggleElements: Map<string, ReturnType<typeof createSettingsToggle>> = new Map();
    private _selectElements: Map<string, ReturnType<typeof createSettingsSelect>> = new Map();
    private _focusableOrder: string[] = [];
    private _toggleMetadata: Map<string, ToggleMetadata> = new Map();
    private _selectMetadata: Map<string, SelectMetadata> = new Map();
    private _sectionHeaders: Map<string, HTMLButtonElement> = new Map();
    private _sectionBodies: Map<string, HTMLElement> = new Map();
    private _sectionExpanded: Record<SettingsSectionId, boolean> = {
        audio_subtitles: true,
        playback_hdr: false,
        appearance: false,
        account: false,
        developer: false,
    };
    private _switchProfileButton: HTMLButtonElement | null = null;
    private _navKeyHandler: ((event: KeyEvent) => void) | null = null;

    constructor(
        container: HTMLElement,
        getNavigation: () => INavigationManager | null,
        onSubtitleModeChange?: (mode: SubtitleMode) => void,
        onGuideSettingChange?: (change: GuideSettingChange) => void
    ) {
        this._container = container;
        this._getNavigation = getNavigation;
        this._onSubtitleModeChange = onSubtitleModeChange ?? null;
        this._onGuideSettingChange = onGuideSettingChange ?? null;
        this._buildUI();
    }

    /**
     * Build the settings UI.
     */
    private _buildUI(): void {
        this._container.className = 'settings-screen screen';
        this._container.id = 'settings-screen';
        this._focusableOrder = [];
        this._sectionHeaders.clear();
        this._sectionBodies.clear();

        const panel = document.createElement('div');
        panel.className = 'settings-panel';

        // Header
        const header = document.createElement('div');
        header.className = 'settings-header';

        const title = document.createElement('h1');
        title.className = 'settings-title';
        title.textContent = '⚙ Settings';

        const hint = document.createElement('span');
        hint.className = 'settings-hint';
        hint.textContent = 'Press BACK to return';

        header.appendChild(title);
        header.appendChild(hint);
        panel.appendChild(header);

        // Build sections
        const sections = this._buildSections();
        for (const section of sections) {
            panel.appendChild(this._createSection(section));
        }

        const actions = document.createElement('div');
        actions.className = 'settings-actions';

        const switchProfileButton = document.createElement('button');
        switchProfileButton.id = 'settings-switch-profile';
        switchProfileButton.className = 'screen-button';
        switchProfileButton.textContent = 'Switch Profile';
        switchProfileButton.addEventListener('click', () => {
            const nav = this._getNavigation();
            nav?.replaceScreen('profile-select');
        });
        actions.appendChild(switchProfileButton);
        this._switchProfileButton = switchProfileButton;
        this._focusableOrder.push(switchProfileButton.id);

        panel.appendChild(actions);

        this._container.appendChild(panel);
    }

    /**
     * Build section configurations from current settings.
     */
    private _buildSections(): SettingsSectionConfig[] {
        const nowPlayingAutoHide = this._loadClampedNowPlayingAutoHide();
        const themeValue = THEME_OPTIONS.findIndex((option) => option.theme === ThemeManager.getInstance().getTheme());
        const selectedThemeValue = themeValue >= 0 ? themeValue : DEFAULT_THEME_VALUE;
        const keepPlayingInSettings = this._loadBoolSetting(
            SETTINGS_STORAGE_KEYS.KEEP_PLAYING_IN_SETTINGS,
            DEFAULT_SETTINGS.playback.keepPlayingInSettings
        );
        const hdr10FallbackValue = this._readHdr10FallbackSelectValue();
        const subtitleModeValue = this._loadSubtitleModeValue();
        const subtitleMode = this._valueToSubtitleMode(subtitleModeValue);
        const subtitlesEnabled = subtitleMode !== 'off';
        const epgLayoutModeValue = this._loadEpgLayoutModeValue();
        const epgGuideDensityValue = this._loadEpgGuideDensityValue();
        const useGlobalSubtitlePreference = this._loadBoolSetting(
            SETTINGS_STORAGE_KEYS.SUBTITLE_PREFERENCE_GLOBAL_OVERRIDE,
            DEFAULT_SETTINGS.subtitles.useGlobalPreference
        );
        const preferForcedSubtitles = this._loadBoolSetting(
            SETTINGS_STORAGE_KEYS.SUBTITLE_PREFER_FORCED,
            DEFAULT_SETTINGS.subtitles.preferForced
        );
        const subtitleLanguageValue = this._loadSubtitleLanguageValue();
        const showProfilePickerOnStartup = this._loadBoolSetting(
            SETTINGS_STORAGE_KEYS.SHOW_PROFILE_PICKER_ON_STARTUP,
            DEFAULT_SETTINGS.account.showProfilePickerOnStartup
        );

        return [
            {
                id: 'audio_subtitles',
                title: '🔊 Audio & Subtitles',
                items: [
                    {
                        id: 'settings-dts-passthrough',
                        label: 'DTS Passthrough',
                        description: 'Enable if you have an eARC receiver',
                        value: this._loadBoolSetting(SETTINGS_STORAGE_KEYS.DTS_PASSTHROUGH, DEFAULT_SETTINGS.audio.dtsPassthrough),
                        onChange: (value: boolean) =>
                            this._saveBoolSetting(SETTINGS_STORAGE_KEYS.DTS_PASSTHROUGH, value),
                    },
                    {
                        id: 'settings-direct-play-audio-fallback',
                        label: 'Direct Play Audio Fallback',
                        description: 'Allow Direct Play using a compatible fallback audio track',
                        value: this._loadBoolSetting(
                            SETTINGS_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK,
                            DEFAULT_SETTINGS.audio.directPlayAudioFallback
                        ),
                        onChange: (value: boolean) =>
                            this._saveBoolSetting(SETTINGS_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK, value),
                    },
                    {
                        id: 'settings-subtitle-mode',
                        label: 'Subtitle Mode',
                        description: 'Standard is recommended. Full may require transcoding (burn-in).',
                        value: subtitleModeValue,
                        options: SUBTITLE_MODE_OPTIONS.map((option, index) => ({
                            label: option.label,
                            value: index,
                        })),
                        onChange: (value: number): void => {
                            const mode = this._valueToSubtitleMode(value);
                            this._saveSubtitleMode(mode);
                            this._updateSubtitleDependentControls(mode);
                            this._onSubtitleModeChange?.(mode);
                        },
                    },
                    {
                        id: 'settings-subtitle-language',
                        label: 'Preferred Subtitle Language',
                        description: 'Override Plex user preference (Auto uses Plex)',
                        value: subtitleLanguageValue,
                        options: SUBTITLE_LANGUAGE_OPTIONS.map((option, index) => ({
                            label: option.label,
                            value: index,
                        })),
                        disabled: !subtitlesEnabled,
                        disabledReason: 'Enable Subtitle Mode first',
                        onChange: (value: number): void => {
                            this._saveSubtitleLanguageValue(value);
                        },
                    },
                    {
                        id: 'settings-subtitles-global',
                        label: 'Use Global Subtitle Preference',
                        description: 'Apply a single subtitle choice to all channels',
                        value: useGlobalSubtitlePreference,
                        disabled: !subtitlesEnabled,
                        disabledReason: 'Enable Subtitle Mode first',
                        onChange: (value: boolean): void => {
                            this._saveBoolSetting(
                                SETTINGS_STORAGE_KEYS.SUBTITLE_PREFERENCE_GLOBAL_OVERRIDE,
                                value
                            );
                        },
                    },
                    {
                        id: 'settings-subtitles-prefer-forced',
                        label: 'Prefer Forced Subtitles',
                        description: 'Auto-select forced (partial) subtitles over full subtitles',
                        value: preferForcedSubtitles,
                        disabled: !subtitlesEnabled,
                        disabledReason: 'Enable Subtitle Mode first',
                        onChange: (value: boolean): void => {
                            this._saveBoolSetting(
                                SETTINGS_STORAGE_KEYS.SUBTITLE_PREFER_FORCED,
                                value
                            );
                        },
                    },
                ],
            },
            {
                id: 'playback_hdr',
                title: '▶ Playback & HDR',
                items: [
                    {
                        id: 'settings-keep-playing',
                        label: 'Keep Playback Running in Settings',
                        description: 'Avoid pausing video when opening Settings (uses more CPU/GPU)',
                        value: keepPlayingInSettings,
                        onChange: (value: boolean) =>
                            this._saveBoolSetting(SETTINGS_STORAGE_KEYS.KEEP_PLAYING_IN_SETTINGS, value),
                    },
                    {
                        id: 'settings-hdr10-fallback-mode',
                        label: 'HDR Fallback',
                        description:
                            'For Dolby Vision MKV only. Does not affect MP4/TS. Only applies when an HDR10 base layer exists (DV profile 7 or 8.1).',
                        value: hdr10FallbackValue,
                        options: [
                            { label: 'Off', value: 0 },
                            { label: 'Smart (Recommended)', value: 1 },
                            { label: 'Force', value: 2 },
                        ],
                        onChange: (value: number) =>
                            this._applyHdr10FallbackSelectValue(value as 0 | 1 | 2),
                    },
                ],
            },
            {
                id: 'appearance',
                title: '🎨 Appearance',
                items: [
                    {
                        id: 'settings-guide-category-colors',
                        label: 'Category Colors',
                        description: 'Show colored left border for auto-setup channel types',
                        value: this._loadBoolSetting(SETTINGS_STORAGE_KEYS.GUIDE_CATEGORY_COLORS, true),
                        onChange: (value: boolean): void => {
                            this._saveBoolSetting(SETTINGS_STORAGE_KEYS.GUIDE_CATEGORY_COLORS, value);
                            this._onGuideSettingChange?.({ key: 'categoryColors', enabled: value });
                        },
                    },
                    {
                        id: 'settings-guide-library-tabs',
                        label: 'Library Tabs',
                        description: 'Filter the guide by source library',
                        value: this._loadBoolSetting(SETTINGS_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, true),
                        onChange: (value: boolean): void => {
                            this._saveBoolSetting(SETTINGS_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED, value);
                            this._onGuideSettingChange?.({ key: 'libraryTabs', enabled: value });
                        },
                    },
                    {
                        id: 'settings-epg-now-watching',
                        label: 'Now Watching Banner',
                        description: 'Show current channel/program above the guide',
                        value: this._loadBoolSetting(SETTINGS_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED, true),
                        onChange: (value: boolean): void => {
                            this._saveBoolSetting(SETTINGS_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED, value);
                            this._onGuideSettingChange?.({ key: 'nowWatchingBanner', enabled: value });
                        },
                    },
                    {
                        id: 'settings-epg-density',
                        label: 'Guide Density',
                        description: 'Detailed shows 2 hours, Wide shows 3 hours',
                        value: epgGuideDensityValue,
                        options: [
                            { label: 'Detailed (2h)', value: 0 },
                            { label: 'Wide (3h)', value: 1 },
                        ],
                        onChange: (value: number): void => {
                            const density = this._mapEpgGuideDensityValue(value);
                            this._saveEpgGuideDensityValue(value);
                            this._onGuideSettingChange?.({ key: 'guideDensity', density });
                        },
                    },
                    {
                        id: 'settings-epg-layout-mode',
                        label: 'Guide Layout',
                        description: 'Overlay keeps full-screen video; Classic shows PIP',
                        value: epgLayoutModeValue,
                        options: [
                            { label: 'Overlay', value: 0 },
                            { label: 'Classic (PIP)', value: 1 },
                        ],
                        onChange: (value: number): void => {
                            const mode = value === 1 ? 'classic' : 'overlay';
                            this._saveEpgLayoutModeValue(value);
                            this._onGuideSettingChange?.({ key: 'layoutMode', mode });
                        },
                    },
                    {
                        id: 'settings-theme',
                        label: 'Theme',
                        description: 'Visual style of the application',
                        value: selectedThemeValue,
                        options: THEME_OPTIONS.map((option, index) => ({
                            label: option.label,
                            value: index,
                        })),
                        onChange: (value: number): void => {
                            ThemeManager.getInstance().setTheme(THEME_OPTIONS[value]?.theme ?? DEFAULT_THEME);
                        },
                    },
                    {
                        id: 'settings-now-playing-timeout',
                        label: 'Now Playing Auto-Hide',
                        description: 'Info overlay hide delay',
                        value: nowPlayingAutoHide,
                        options: NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS.map((value) => ({
                            label: `${Math.round(value / 1000)}s`,
                            value,
                        })),
                        onChange: (value: number): void => {
                            this._saveNumberSetting(SETTINGS_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS, value);
                        },
                    },
                ],
            },
            {
                id: 'account',
                title: '👤 Account',
                items: [
                    {
                        id: 'settings-profile-picker-startup',
                        label: 'Show Profile Picker on Startup',
                        description: 'When enabled, prompt for a Plex Home profile on launch',
                        value: showProfilePickerOnStartup,
                        onChange: (value: boolean): void => {
                            this._saveBoolSetting(
                                SETTINGS_STORAGE_KEYS.SHOW_PROFILE_PICKER_ON_STARTUP,
                                value
                            );
                        },
                    },
                ],
            },
            {
                id: 'developer',
                title: '🛠 Developer',
                items: [
                    {
                        id: 'settings-debug-logging',
                        label: 'Debug Logging',
                        description: 'Enable verbose console output (applies immediately)',
                        value: this._loadBoolSetting(SETTINGS_STORAGE_KEYS.DEBUG_LOGGING, DEFAULT_SETTINGS.developer.debugLogging),
                        onChange: (value: boolean): void => {
                            this._saveBoolSetting(SETTINGS_STORAGE_KEYS.DEBUG_LOGGING, value);
                            this._notifyDebugLoggingChanged(value);
                        },
                    },
                    {
                        id: 'settings-subtitle-debug-logging',
                        label: 'Subtitle Debug Logging',
                        description: 'Log subtitle tracks and native textTracks state (tokens redacted)',
                        value: this._loadBoolSetting(
                            SETTINGS_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING,
                            DEFAULT_SETTINGS.developer.subtitleDebugLogging
                        ),
                        onChange: (value: boolean) =>
                            this._saveBoolSetting(SETTINGS_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING, value),
                    },
                ],
            },
        ];
    }

    /**
     * Create a section DOM element.
     */
    private _createSection(config: SettingsSectionConfig): HTMLElement {
        const section = document.createElement('div');
        section.className = 'settings-section';

        const expanded = this._sectionExpanded[config.id];
        const header = document.createElement('button');
        header.id = `settings-section-${config.id}`;
        header.className = 'settings-section-header';

        const indicator = document.createElement('span');
        indicator.className = 'settings-section-indicator';
        indicator.textContent = expanded ? '▼' : '►';

        const title = document.createElement('span');
        title.className = 'settings-section-title';
        title.textContent = config.title;

        const count = document.createElement('span');
        count.className = 'settings-section-count';
        count.textContent = `(${config.items.length})`;

        header.appendChild(indicator);
        header.appendChild(title);
        header.appendChild(count);

        header.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        header.setAttribute('aria-controls', `settings-section-${config.id}-body`);
        section.appendChild(header);

        const items = document.createElement('div');
        items.className = 'settings-section-items';
        items.id = `settings-section-${config.id}-body`;
        items.hidden = !expanded;

        this._sectionHeaders.set(header.id, header);
        this._sectionBodies.set(items.id, items);
        this._focusableOrder.push(header.id);

        for (const item of config.items) {
            const element = this._createItem(item);
            items.appendChild(element);
        }

        section.appendChild(items);

        header.addEventListener('click', () => {
            const nextExpanded = !this._sectionExpanded[config.id];
            this._sectionExpanded[config.id] = nextExpanded;
            items.hidden = !nextExpanded;
            indicator.textContent = nextExpanded ? '▼' : '►';
            header.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false');
            this._unregisterFocusables();
            this._registerFocusables();
            const nav = this._getNavigation();
            nav?.setFocus(header.id);
        });

        return section;
    }

    /**
     * Show the settings screen and register focusables.
     */
    public show(): void {
        this._container.classList.add('visible');
        this._refreshValues();
        const nav = this._getNavigation();
        if (nav && !this._navKeyHandler) {
            this._navKeyHandler = (event: KeyEvent): void => {
                if (event.handled) return;
                const focusedId = nav.getFocusedElement()?.id;
                if (!focusedId) return;
                const select = this._selectElements.get(focusedId);
                if (!select || select.isDisabled()) return;
                if (event.button === 'left') {
                    select.cyclePrev();
                    event.handled = true;
                } else if (event.button === 'right') {
                    select.cycleNext();
                    event.handled = true;
                }
            };
            nav.on('keyPress', this._navKeyHandler);
        }
        this._registerFocusables();
    }

    /**
     * Hide the settings screen and unregister focusables.
     */
    public hide(): void {
        this._container.classList.remove('visible');
        if (this._navKeyHandler) {
            const nav = this._getNavigation();
            nav?.off('keyPress', this._navKeyHandler);
            this._navKeyHandler = null;
        }
        this._unregisterFocusables();
    }

    /**
     * Register all toggles as focusable elements.
     */
    private _registerFocusables(preferredFocusId?: string | null): void {
        const nav = this._getNavigation();
        if (!nav) return;

        const focusableIds = this._focusableOrder.filter((id) => {
            if (!this._isFocusableEnabled(id)) return false;
            const element = this._getFocusableElement(id);
            return element ? element.offsetParent !== null : false;
        });
        this._focusableIds = focusableIds;

        const currentFocusId = nav.getFocusedElement()?.id ?? null;
        for (let i = 0; i < focusableIds.length; i++) {
            const id = focusableIds[i];
            if (!id) continue;

            const element = this._getFocusableElement(id);
            if (!element) continue;

            const upId = i > 0 ? focusableIds[i - 1] : undefined;
            const downId = i < focusableIds.length - 1 ? focusableIds[i + 1] : undefined;

            const neighbors: FocusableElement['neighbors'] = {};
            if (upId) neighbors.up = upId;
            if (downId) neighbors.down = downId;

            const isSelect = this._selectElements.has(id);
            const onSelect = isSelect
                ? (): void => { }
                : (): void => {
                    element.click();
                };
            const focusable: FocusableElement = {
                id,
                element,
                neighbors,
                onSelect,
            };
            nav.registerFocusable(focusable);
        }

        // Preserve current focus if still enabled, otherwise focus the first available
        const preferredId = preferredFocusId && focusableIds.includes(preferredFocusId)
            ? preferredFocusId
            : currentFocusId && focusableIds.includes(currentFocusId)
                ? currentFocusId
                : focusableIds[0];
        if (preferredId) {
            nav.setFocus(preferredId);
        }
    }

    /**
     * Unregister all focusables.
     */
    private _unregisterFocusables(): void {
        const nav = this._getNavigation();
        if (!nav) return;

        for (const id of this._focusableIds) {
            nav.unregisterFocusable(id);
        }
        this._focusableIds = [];
    }

    /**
     * Load a boolean setting from localStorage.
     */
    private _loadBoolSetting(key: string, defaultValue: boolean): boolean {
        return readStoredBoolean(key, defaultValue);
    }

    private _loadNumberSetting(key: string, defaultValue: number): number {
        const raw = safeLocalStorageGet(key);
        if (raw === null) return defaultValue;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : defaultValue;
    }

    private _loadEpgLayoutModeValue(): number {
        const raw = safeLocalStorageGet(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE);
        return raw === 'classic' ? 1 : 0;
    }

    private _loadEpgGuideDensityValue(): number {
        const raw = safeLocalStorageGet(SETTINGS_STORAGE_KEYS.EPG_GUIDE_DENSITY);
        return raw === 'wide' ? 1 : 0;
    }

    private _loadSubtitleLanguageValue(): number {
        const raw = safeLocalStorageGet(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE);
        if (raw === null) return 0;
        const normalized = raw.trim().toLowerCase();
        if (!normalized) {
            safeLocalStorageRemove(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE);
            return 0;
        }
        const index = SUBTITLE_LANGUAGE_OPTIONS.findIndex((option) => {
            if (!option.code) return false;
            return option.code.toLowerCase() === normalized;
        });
        if (index >= 0) return index;
        safeLocalStorageRemove(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE);
        return 0;
    }

    /**
     * Save a boolean setting to localStorage.
     */
    private _saveBoolSetting(key: string, value: boolean): void {
        safeLocalStorageSet(key, value ? '1' : '0');
    }

    private _saveNumberSetting(key: string, value: number): void {
        safeLocalStorageSet(key, String(value));
    }

    private _notifyDebugLoggingChanged(enabled: boolean): void {
        dispatchDebugLoggingChanged(enabled);
    }

    private _saveEpgLayoutModeValue(value: number): void {
        const mode = value === 1 ? 'classic' : 'overlay';
        safeLocalStorageSet(SETTINGS_STORAGE_KEYS.EPG_LAYOUT_MODE, mode);
    }

    private _saveEpgGuideDensityValue(value: number): void {
        const density = this._mapEpgGuideDensityValue(value);
        safeLocalStorageSet(SETTINGS_STORAGE_KEYS.EPG_GUIDE_DENSITY, density);
    }

    private _mapEpgGuideDensityValue(value: number): 'wide' | 'detailed' {
        return value === 1 ? 'wide' : 'detailed';
    }

    private _saveSubtitleLanguageValue(value: number): void {
        const option = SUBTITLE_LANGUAGE_OPTIONS[value];
        if (!option || !option.code) {
            safeLocalStorageRemove(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE);
            return;
        }
        safeLocalStorageSet(SETTINGS_STORAGE_KEYS.SUBTITLE_LANGUAGE, option.code);
    }

    private _subtitleModeToValue(mode: SubtitleMode): number {
        const index = SUBTITLE_MODE_OPTIONS.findIndex((o) => o.mode === mode);
        return index >= 0 ? index : 2;
    }

    private _valueToSubtitleMode(value: number): SubtitleMode {
        const option = SUBTITLE_MODE_OPTIONS[value];
        if (!option) return 'standard';
        return option.mode;
    }

    private _loadSubtitleModeValue(): number {
        // getSubtitleMode() performs legacy migration + persistence.
        const mode = getSubtitleMode();
        return this._subtitleModeToValue(mode);
    }

    private _saveSubtitleMode(mode: SubtitleMode): void {
        setSubtitleMode(mode);
        // Best-effort legacy compatibility: keep old gating key in sync so older builds behave.
        try {
            safeLocalStorageSet(RETUNE_STORAGE_KEYS.SUBTITLES_ENABLED, mode === 'off' ? '0' : '1');
        } catch {
            // ignore
        }
    }

    private _readHdr10FallbackSelectValue(): 0 | 1 | 2 {
        const force = this._loadBoolSetting(
            SETTINGS_STORAGE_KEYS.FORCE_HDR10_FALLBACK,
            DEFAULT_SETTINGS.playback.forceHdr10Fallback
        );
        if (force) return 2;
        const smart = this._loadBoolSetting(
            SETTINGS_STORAGE_KEYS.SMART_HDR10_FALLBACK,
            DEFAULT_SETTINGS.playback.smartHdr10Fallback
        );
        if (smart) return 1;
        return 0;
    }

    private _applyHdr10FallbackSelectValue(value: 0 | 1 | 2): void {
        switch (value) {
            case 1:
                this._saveBoolSetting(SETTINGS_STORAGE_KEYS.SMART_HDR10_FALLBACK, true);
                this._saveBoolSetting(SETTINGS_STORAGE_KEYS.FORCE_HDR10_FALLBACK, false);
                return;
            case 2:
                this._saveBoolSetting(SETTINGS_STORAGE_KEYS.SMART_HDR10_FALLBACK, false);
                this._saveBoolSetting(SETTINGS_STORAGE_KEYS.FORCE_HDR10_FALLBACK, true);
                return;
            case 0:
            default:
                this._saveBoolSetting(SETTINGS_STORAGE_KEYS.SMART_HDR10_FALLBACK, false);
                this._saveBoolSetting(SETTINGS_STORAGE_KEYS.FORCE_HDR10_FALLBACK, false);
        }
    }


    private _refreshValues(): void {
        const selectLoaders: Record<string, () => number> = {
            'settings-now-playing-timeout': () => this._loadClampedNowPlayingAutoHide(),
            'settings-subtitle-mode': () => this._loadSubtitleModeValue(),
            'settings-subtitle-language': () => this._loadSubtitleLanguageValue(),
            'settings-hdr10-fallback-mode': () => this._readHdr10FallbackSelectValue(),
            'settings-epg-density': () => this._loadEpgGuideDensityValue(),
            'settings-epg-layout-mode': () => this._loadEpgLayoutModeValue(),
        };
        for (const [id, meta] of this._toggleMetadata.entries()) {
            const toggle = this._toggleElements.get(id);
            if (!toggle) continue;
            const value = this._loadBoolSetting(meta.storageKey, meta.defaultValue);
            toggle.update(value);
            meta.onRefresh?.(value);
        }
        for (const [id, meta] of this._selectMetadata.entries()) {
            const select = this._selectElements.get(id);
            if (!select) continue;
            const loader = selectLoaders[id];
            const value = loader
                ? loader()
                : this._loadNumberSetting(meta.storageKey, meta.defaultValue);
            select.update(value);
            meta.onRefresh?.(value);
        }
        const themeSelect = this._selectElements.get('settings-theme');
        if (themeSelect) {
            const themeValue = THEME_OPTIONS.findIndex((option) => option.theme === ThemeManager.getInstance().getTheme());
            themeSelect.update(themeValue >= 0 ? themeValue : DEFAULT_THEME_VALUE);
        }
        const mode = this._valueToSubtitleMode(this._loadSubtitleModeValue());
        this._updateSubtitleDependentControls(mode);
    }

    private _updateSubtitleDependentControls(mode: SubtitleMode): void {
        const subtitlesEnabled = mode !== 'off';
        const subtitleLanguage = this._selectElements.get('settings-subtitle-language');
        subtitleLanguage?.setDisabled(!subtitlesEnabled);
        const subtitleGlobal = this._toggleElements.get('settings-subtitles-global');
        subtitleGlobal?.setDisabled(!subtitlesEnabled);
        const subtitlePreferForced = this._toggleElements.get('settings-subtitles-prefer-forced');
        subtitlePreferForced?.setDisabled(!subtitlesEnabled);
        const nav = this._getNavigation();
        const focusedId = nav?.getFocusedElement()?.id ?? null;
        if (this._container.classList.contains('visible') && this._focusableIds.length > 0) {
            this._unregisterFocusables();
            this._registerFocusables(focusedId);
        }
    }

    private _isFocusableEnabled(id: string): boolean {
        if (this._sectionHeaders.has(id)) {
            return true;
        }
        if (this._switchProfileButton && id === this._switchProfileButton.id) {
            return true;
        }
        const toggle = this._toggleElements.get(id);
        if (toggle) {
            return !toggle.isDisabled();
        }
        const select = this._selectElements.get(id);
        if (select) {
            return !select.isDisabled();
        }
        return false;
    }

    private _loadClampedNowPlayingAutoHide(): number {
        const rawValue = this._loadNumberSetting(
            SETTINGS_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS,
            DEFAULT_SETTINGS.display.nowPlayingInfoAutoHideMs
        );
        if (NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS.includes(rawValue as (typeof NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS)[number])) {
            return rawValue;
        }
        const fallback = NOW_PLAYING_INFO_DEFAULTS.autoHideMs;
        this._saveNumberSetting(SETTINGS_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS, fallback);
        return fallback;
    }

    private _inferToggleMetadata(
        id: string
    ): ToggleMetadata | null {
        return TOGGLE_METADATA[id] ?? null;
    }

    private _inferSelectMetadata(
        id: string
    ): SelectMetadata | null {
        return SELECT_METADATA[id] ?? null;
    }

    private _createItem(item: SettingsItemConfig): HTMLElement {
        if (isSelectItem(item)) {
            const select = createSettingsSelect(item);
            this._selectElements.set(item.id, select);
            const meta = this._inferSelectMetadata(item.id);
            if (meta) {
                this._selectMetadata.set(item.id, meta);
            }
            this._focusableOrder.push(item.id);
            return select.element;
        }

        const toggle = createSettingsToggle(item);
        this._toggleElements.set(item.id, toggle);
        const meta = this._inferToggleMetadata(item.id);
        if (meta) {
            this._toggleMetadata.set(item.id, meta);
        }
        this._focusableOrder.push(item.id);
        return toggle.element;
    }

    private _getFocusableElement(id: string): HTMLButtonElement | null {
        const header = this._sectionHeaders.get(id);
        if (header) return header;
        if (this._switchProfileButton && id === this._switchProfileButton.id) {
            return this._switchProfileButton;
        }
        const toggle = this._toggleElements.get(id);
        if (toggle) return toggle.element;
        const select = this._selectElements.get(id);
        if (select) return select.element;
        return null;
    }

    /**
     * Destroy the component.
     */
    public destroy(): void {
        this._unregisterFocusables();
        this._toggleElements.clear();
        this._selectElements.clear();
        this._toggleMetadata.clear();
        this._selectMetadata.clear();
        this._sectionHeaders.clear();
        this._sectionBodies.clear();
        this._focusableOrder = [];
        this._switchProfileButton = null;
        this._container.innerHTML = '';
    }
}

function isSelectItem(item: SettingsItemConfig): item is SettingsSelectConfig {
    return 'options' in item;
}
