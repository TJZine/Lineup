/**
 * @fileoverview Settings screen component.
 * @module modules/ui/settings/SettingsScreen
 * @version 1.0.0
 */

import type { INavigationManager, FocusableElement, KeyEvent } from '../../navigation';
import { createSettingsToggle } from './SettingsToggle';
import { createSettingsSelect } from './SettingsSelect';
import { createSettingsDropdown } from './SettingsDropdown';
import { DEFAULT_THEME, THEME_OPTIONS } from './theme';
import type {
    SettingsCategoryConfig,
    SettingsItemConfig,
    SettingsSelectConfig,
    SettingsCategoryId,
    GuideSettingChange,
} from './types';
import { NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS, NOW_PLAYING_INFO_DEFAULTS } from '../now-playing-info';
import { SettingsStore, type ToggleSettingId } from './SettingsStore';
import { ThemeManager } from '../theme';
import { getSubtitleMode, setSubtitleMode, type SubtitleMode } from '../../../shared/subtitle-mode';
import { dispatchDebugLoggingChanged } from '../../../config/events';
import { TRANSCODE_QUALITY_OPTIONS } from '../../../config/transcodeQuality';

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
    { label: 'Standard (avoid transcoding)', mode: 'standard' },
    { label: 'Full (Burn-in, default)', mode: 'full' },
];

const EPG_PAST_ITEMS_OPTIONS = [
    { label: 'Auto (Recommended)', storageValue: 'auto' as const },
    { label: 'Now (0m)', storageValue: '0' as const },
    { label: '15m', storageValue: '15' as const },
    { label: '30m', storageValue: '30' as const },
];

const DEFAULT_THEME_VALUE = Math.max(
    0,
    THEME_OPTIONS.findIndex((option) => option.theme === DEFAULT_THEME)
);

type ToggleMetadata = {
    toggleSettingId: ToggleSettingId;
    onRefresh?: (value: boolean) => void;
};

type SelectMetadata = {
    onRefresh?: (value: number) => void;
};

const TOGGLE_METADATA: Record<string, ToggleMetadata> = {
    'settings-dts-passthrough': {
        toggleSettingId: 'dtsPassthrough',
    },
    'settings-direct-play-audio-fallback': {
        toggleSettingId: 'directPlayAudioFallback',
    },
    'settings-keep-playing': {
        toggleSettingId: 'keepPlayingInSettings',
    },
    'settings-transcode-compat': {
        toggleSettingId: 'transcodeCompat',
    },
    'settings-debug-logging': {
        toggleSettingId: 'debugLogging',
    },
    'settings-subtitle-debug-logging': {
        toggleSettingId: 'subtitleDebugLogging',
    },
    'settings-subtitles-prefer-forced': {
        toggleSettingId: 'subtitlePreferForced',
    },
    'settings-guide-category-colors': {
        toggleSettingId: 'guideCategoryColors',
    },
    'settings-guide-library-tabs': {
        toggleSettingId: 'epgLibraryTabsEnabled',
    },
    'settings-epg-now-watching': {
        toggleSettingId: 'epgNowWatchingEnabled',
    },
    'settings-epg-aggressive-preload': {
        toggleSettingId: 'epgAggressivePreloadEnabled',
    },
    'settings-profile-picker-startup': {
        toggleSettingId: 'showProfilePickerOnStartup',
    },
    'settings-cinematic-now-playing': {
        toggleSettingId: 'cinematicNowPlaying',
    },
    'settings-prefer-clear-logos': {
        toggleSettingId: 'preferClearLogos',
    },
};

const SELECT_METADATA: Record<string, SelectMetadata> = {
    'settings-now-playing-timeout': {},
    'settings-subtitle-mode': {},
    'settings-subtitle-language': {},
    'settings-hdr10-fallback-mode': {},
    'settings-transcode-quality': {},
    'settings-epg-layout-mode': {},
    'settings-epg-density': {},
    'settings-epg-past-items': {},
    'settings-epg-info-background-mode': {},
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
    private _getActiveUsername: (() => string | null) | null = null;
    private _categories: SettingsCategoryConfig[] = [];
    private _activeCategoryId: SettingsCategoryId | null = null;
    private _lastFocusedItemByCategory: Partial<Record<SettingsCategoryId, string>> = {};
    private _focusableIds: string[] = [];
    private _toggleElements: Map<string, ReturnType<typeof createSettingsToggle>> = new Map();
    private _selectElements: Map<string, ReturnType<typeof createSettingsSelect>> = new Map();
    private _categoryButtons: Map<SettingsCategoryId, HTMLButtonElement> = new Map();
    private _activeCategoryItemIds: string[] = [];
    private _toggleMetadata: Map<string, ToggleMetadata> = new Map();
    private _selectMetadata: Map<string, SelectMetadata> = new Map();
    private _detailTitle: HTMLHeadingElement | null = null;
    private _detailItems: HTMLElement | null = null;
    private _switchProfileButton: HTMLButtonElement | null = null;
    private _activeDropdown: { destroy: () => void; dismiss: () => void } | null = null;
    private _navKeyHandler: ((event: KeyEvent) => void) | null = null;
    private _detailSwapFrame: number | null = null;
    private _detailRevealFrame: number | null = null;
    private readonly _settingsStore: SettingsStore;
    // When a category swap is deferred via RAF, we must preserve the focus intent
    // (e.g., RIGHT into details) and apply it after detail items exist.
    private _pendingFocusRestore: { categoryId: SettingsCategoryId; preferredFocusId: string | null } | null = null;

    constructor(
        container: HTMLElement,
        getNavigation: () => INavigationManager | null,
        onSubtitleModeChange?: (mode: SubtitleMode) => void,
        onGuideSettingChange?: (change: GuideSettingChange) => void,
        getActiveUsername?: () => string | null,
        settingsStore: SettingsStore = new SettingsStore()
    ) {
        this._container = container;
        this._getNavigation = getNavigation;
        this._onSubtitleModeChange = onSubtitleModeChange ?? null;
        this._onGuideSettingChange = onGuideSettingChange ?? null;
        this._getActiveUsername = getActiveUsername ?? null;
        this._settingsStore = settingsStore;
        this._buildUI();
    }

    /**
     * Build the settings UI.
     */
    private _buildUI(): void {
        this._container.className = 'settings-screen';
        this._container.id = 'settings-screen';
        this._categoryButtons.clear();
        this._toggleElements.clear();
        this._selectElements.clear();
        this._toggleMetadata.clear();
        this._selectMetadata.clear();
        this._activeCategoryItemIds = [];

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

        const categoryRail = document.createElement('div');
        categoryRail.className = 'settings-categories';
        categoryRail.setAttribute('aria-label', 'Settings categories');
        categoryRail.appendChild(header);

        const content = document.createElement('div');
        content.className = 'settings-content';

        const detail = document.createElement('div');
        detail.className = 'settings-detail';

        const detailTitle = document.createElement('h2');
        detailTitle.className = 'settings-detail-title';
        this._detailTitle = detailTitle;

        const detailItems = document.createElement('div');
        detailItems.className = 'settings-detail-items';
        this._detailItems = detailItems;

        detail.appendChild(detailTitle);
        detail.appendChild(detailItems);

        this._categories = this._buildCategories();
        if (!this._activeCategoryId || !this._categories.some((category) => category.id === this._activeCategoryId)) {
            this._activeCategoryId = this._categories[0]?.id ?? null;
        }
        for (const category of this._categories) {
            categoryRail.appendChild(this._createCategoryButton(category));
        }
        this._renderActiveCategory();

        content.appendChild(detail);
        panel.appendChild(categoryRail);
        panel.appendChild(content);

        const profileRow = document.createElement('button');
        profileRow.id = 'settings-switch-profile';
        profileRow.className = 'settings-profile-row';
        profileRow.addEventListener('click', () => {
            const nav = this._getNavigation();
            nav?.replaceScreen('profile-select');
        });

        const profileIcon = document.createElement('span');
        profileIcon.className = 'settings-profile-icon';
        profileIcon.textContent = '👤';
        profileIcon.setAttribute('aria-hidden', 'true');

        const profileText = document.createElement('div');
        profileText.className = 'settings-profile-text';

        const profileName = document.createElement('span');
        profileName.className = 'settings-profile-name';
        profileName.textContent = this._getActiveUsername?.() ?? 'Profile';

        const profileAction = document.createElement('span');
        profileAction.className = 'settings-profile-action';
        profileAction.textContent = 'Switch Profile →';

        profileText.appendChild(profileName);
        profileText.appendChild(profileAction);
        profileRow.appendChild(profileIcon);
        profileRow.appendChild(profileText);
        profileRow.setAttribute('aria-label', `Switch profile. Current: ${profileName.textContent}`);

        this._switchProfileButton = profileRow;
        categoryRail.appendChild(profileRow);

        this._container.appendChild(panel);
    }

    /**
     * Build category configurations from current settings.
     */
    private _buildCategories(): SettingsCategoryConfig[] {
        const nowPlayingAutoHide = this._loadClampedNowPlayingAutoHide();
        const selectedThemeValue = this._getThemeIndex(ThemeManager.getInstance().getTheme());
        const keepPlayingInSettings = this._settingsStore.readToggleSetting('keepPlayingInSettings');
        const transcodeCompat = this._settingsStore.readToggleSetting('transcodeCompat');
        const transcodeQualityValue = this._loadTranscodeQualityValue();
        const hdr10FallbackValue = this._settingsStore.readHdr10FallbackModeValue();
        const subtitleModeValue = this._loadSubtitleModeValue();
        const subtitleMode = this._valueToSubtitleMode(subtitleModeValue);
        const subtitlesEnabled = subtitleMode !== 'off';
        const epgLayoutModeValue = this._loadEpgLayoutModeValue();
        const epgPastItemsValue = this._loadEpgPastItemsWindowValue();
        const epgGuideDensityValue = this._loadEpgGuideDensityValue();
        const preferForcedSubtitles = this._settingsStore.readToggleSetting('subtitlePreferForced');
        const subtitleLanguageValue = this._loadSubtitleLanguageValue();
        const showProfilePickerOnStartup = this._settingsStore.readToggleSetting('showProfilePickerOnStartup');

        return [
            {
                id: 'audio_subtitles',
                label: '🔊 Audio & Subtitles',
                items: [
                    {
                        id: 'settings-dts-passthrough',
                        label: 'DTS Passthrough',
                        description: 'Enable if you have an eARC receiver',
                        value: this._settingsStore.readToggleSetting('dtsPassthrough'),
                        onChange: (value: boolean) =>
                            this._settingsStore.writeToggleSetting('dtsPassthrough', value),
                    },
                    {
                        id: 'settings-direct-play-audio-fallback',
                        label: 'Direct Play Audio Fallback',
                        description: 'Allow Direct Play using a compatible fallback audio track',
                        value: this._settingsStore.readToggleSetting('directPlayAudioFallback'),
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
                        id: 'settings-subtitles-prefer-forced',
                        label: 'Prefer Forced Subtitles',
                        description: 'Auto-select forced (partial) subtitles over full subtitles',
                        value: preferForcedSubtitles,
                        disabled: !subtitlesEnabled,
                        disabledReason: 'Enable Subtitle Mode first',
                        onChange: (value: boolean): void => {
                            this._settingsStore.writeToggleSetting('subtitlePreferForced', value);
                        },
                    },
                ],
            },
            {
                id: 'playback_hdr',
                label: '▶ Playback & HDR',
                items: [
                    {
                        id: 'settings-keep-playing',
                        label: 'Keep Playback Running in Settings',
                        description: 'Avoid pausing video when opening Settings (uses more CPU/GPU)',
                        value: keepPlayingInSettings,
                        onChange: (value: boolean) =>
                            this._settingsStore.writeToggleSetting('keepPlayingInSettings', value),
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
                            this._settingsStore.writeHdr10FallbackModeValue(value as 0 | 1 | 2),
                    },
                    {
                        id: 'settings-transcode-quality',
                        label: 'Transcode Quality',
                        description: 'Caps Plex transcoding bitrate/resolution (Direct Play is unaffected)',
                        value: transcodeQualityValue,
                        options: TRANSCODE_QUALITY_OPTIONS.map((option, index) => ({
                            label: option.label,
                            value: index,
                        })),
                        onChange: (value: number): void => {
                            this._saveTranscodeQualityValue(value);
                        },
                    },
                    {
                        id: 'settings-transcode-compat',
                        label: 'Transcode Compat Mode',
                        description: 'Advanced: only use if transcoding fails; sends a minimal parameter set to Plex',
                        value: transcodeCompat,
                        onChange: (value: boolean): void => {
                            this._settingsStore.writeToggleSetting('transcodeCompat', value);
                        },
                    },
                ],
            },
            {
                id: 'appearance',
                label: '🎨 Appearance',
                items: [
                    {
                        id: 'settings-guide-category-colors',
                        label: 'Category Colors',
                        description: 'Show colored left border for auto-setup channel types',
                        value: this._settingsStore.readToggleSetting('guideCategoryColors'),
                        onChange: (value: boolean): void => {
                            this._settingsStore.writeToggleSetting('guideCategoryColors', value);
                            this._onGuideSettingChange?.({ key: 'categoryColors', enabled: value });
                        },
                    },
                    {
                        id: 'settings-guide-library-tabs',
                        label: 'Library Tabs',
                        description: 'Filter the guide by source library',
                        value: this._settingsStore.readToggleSetting('epgLibraryTabsEnabled'),
                        onChange: (value: boolean): void => {
                            this._settingsStore.writeToggleSetting('epgLibraryTabsEnabled', value);
                            this._onGuideSettingChange?.({ key: 'libraryTabs', enabled: value });
                        },
                    },
                    {
                        id: 'settings-epg-now-watching',
                        label: 'Now Watching Banner',
                        description: 'Show current channel/program above the guide',
                        value: this._settingsStore.readToggleSetting('epgNowWatchingEnabled'),
                        onChange: (value: boolean): void => {
                            this._settingsStore.writeToggleSetting('epgNowWatchingEnabled', value);
                            this._onGuideSettingChange?.({ key: 'nowWatchingBanner', enabled: value });
                        },
                    },
                    {
                        id: 'settings-epg-aggressive-preload',
                        label: 'Aggressive Guide Preload (Experimental)',
                        description: 'Uses more memory to reduce loading in very large guides',
                        value: this._settingsStore.readToggleSetting('epgAggressivePreloadEnabled'),
                        onChange: (value: boolean): void => {
                            this._settingsStore.writeToggleSetting('epgAggressivePreloadEnabled', value);
                            this._onGuideSettingChange?.({ key: 'aggressivePreload', enabled: value });
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
                            const density = value === 1 ? 'wide' : 'detailed';
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
                        id: 'settings-epg-past-items',
                        label: 'Past Items',
                        description: 'Auto uses Shows: 0m, Movies: 15m',
                        value: epgPastItemsValue,
                        options: EPG_PAST_ITEMS_OPTIONS.map((option, index) => ({
                            label: option.label,
                            value: index,
                        })),
                        onChange: (value: number): void => {
                            const stored = this._saveEpgPastItemsWindowValue(value);
                            this._onGuideSettingChange?.({ key: 'pastItemsWindow', value: stored });
                        },
                    },
                    {
                        id: 'settings-epg-info-background-mode',
                        label: 'Info Box Background',
                        description: 'Artwork Bleed uses poster color, Artwork shows backdrop art, Theme Default keeps the clean Ember & Steel overlay',
                        value: this._loadEpgInfoBackgroundModeValue(),
                        options: [
                            { label: 'Artwork Bleed', value: 0 },
                            { label: 'Artwork', value: 2 },
                            { label: 'Theme Default', value: 1 },
                        ],
                        onChange: (value: number): void => {
                            const mode = this._saveEpgInfoBackgroundModeValue(value);
                            this._onGuideSettingChange?.({ key: 'infoBackgroundMode', mode });
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
                        id: 'settings-cinematic-now-playing',
                        label: 'Cinematic Now Playing',
                        description: 'Full-screen layout with blurred backdrop and large poster',
                        value: this._settingsStore.readToggleSetting('cinematicNowPlaying'),
                        onChange: (value: boolean): void => {
                            this._settingsStore.writeToggleSetting('cinematicNowPlaying', value);
                        },
                    },
                    {
                        id: 'settings-prefer-clear-logos',
                        label: 'Use Clear Logos',
                        description: 'Show clear logos instead of text titles when available',
                        value: this._settingsStore.readToggleSetting('preferClearLogos'),
                        onChange: (value: boolean): void => {
                            this._settingsStore.writeToggleSetting('preferClearLogos', value);
                        },
                    },
                    {
                        id: 'settings-now-playing-timeout',
                        label: 'Now Playing Auto-Hide',
                        description: 'Info overlay hide delay',
                        value: nowPlayingAutoHide,
                        options: NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS.map((value) => ({
                            label: value === 0 ? 'Persistent' : `${Math.round(value / 1000)}s`,
                            value,
                        })),
                        onChange: (value: number): void => {
                            this._settingsStore.writeNowPlayingAutoHideValue(value);
                        },
                    },
                ],
            },
            {
                id: 'account',
                label: '👤 Account',
                items: [
                    {
                        id: 'settings-profile-picker-startup',
                        label: 'Show Profile Picker on Startup',
                        description: 'When enabled, prompt for a Plex Home profile on launch',
                        value: showProfilePickerOnStartup,
                        onChange: (value: boolean): void => {
                            this._settingsStore.writeToggleSetting('showProfilePickerOnStartup', value);
                        },
                    },
                ],
            },
            {
                id: 'developer',
                label: '🛠 Developer',
                items: [
                    {
                        id: 'settings-debug-logging',
                        label: 'Debug Logging',
                        description: 'Enable verbose console output (applies immediately)',
                        value: this._settingsStore.readToggleSetting('debugLogging'),
                        onChange: (value: boolean): void => {
                            this._settingsStore.writeToggleSetting('debugLogging', value);
                            this._notifyDebugLoggingChanged(value);
                        },
                    },
                    {
                        id: 'settings-subtitle-debug-logging',
                        label: 'Subtitle Debug Logging',
                        description: 'Log subtitle tracks and native textTracks state (tokens redacted)',
                        value: this._settingsStore.readToggleSetting('subtitleDebugLogging'),
                        onChange: (value: boolean) =>
                            this._settingsStore.writeToggleSetting('subtitleDebugLogging', value),
                    },
                ],
            },
        ];
    }

    private _createCategoryButton(config: SettingsCategoryConfig): HTMLButtonElement {
        const button = document.createElement('button');
        button.id = this._getCategoryButtonId(config.id);
        button.className = 'settings-category-button';
        button.textContent = config.label;
        button.setAttribute('aria-selected', config.id === this._activeCategoryId ? 'true' : 'false');
        button.addEventListener('click', () => {
            this._setActiveCategory(config.id, { preferredFocusId: button.id });
        });
        this._categoryButtons.set(config.id, button);
        return button;
    }

    private _cancelDetailFrames(): void {
        if (this._detailSwapFrame !== null) {
            cancelAnimationFrame(this._detailSwapFrame);
            this._detailSwapFrame = null;
        }
        if (this._detailRevealFrame !== null) {
            cancelAnimationFrame(this._detailRevealFrame);
            this._detailRevealFrame = null;
        }
    }

    private _renderActiveCategory(): void {
        const activeCategory = this._getActiveCategory();
        this._toggleElements.clear();
        this._selectElements.clear();
        this._toggleMetadata.clear();
        this._selectMetadata.clear();
        this._activeCategoryItemIds = [];

        if (this._detailTitle) {
            this._detailTitle.textContent = activeCategory?.label ?? '';
        }

        this._cancelDetailFrames();

        if (this._detailItems) {
            const renderItems = (): void => {
                if (!this._detailItems) return;
                this._detailItems.innerHTML = '';
                if (activeCategory) {
                    for (const item of activeCategory.items) {
                        this._activeCategoryItemIds.push(item.id);
                        this._detailItems.appendChild(this._createItem(item));
                    }
                }
            };

            const shouldCrossfade = this._detailItems.childElementCount > 0 && this._focusableIds.length > 0;
            if (!shouldCrossfade) {
                this._detailItems.classList.remove('transitioning');
                renderItems();
            } else {
                const expectedCategoryId = this._activeCategoryId;
                this._detailItems.classList.add('transitioning');

                this._detailSwapFrame = requestAnimationFrame(() => {
                    this._detailSwapFrame = null;
                    if (!this._detailItems || expectedCategoryId !== this._activeCategoryId) return;

                    renderItems();

                    // Detail controls are recreated asynchronously; re-register focusables
                    // so D-pad navigation reflects the active category after the swap frame.
                    const pendingPreferredFocusId =
                        this._pendingFocusRestore?.categoryId === expectedCategoryId
                            ? this._pendingFocusRestore.preferredFocusId
                            : null;
                    // Always clear pending intent once the swap for that category has completed, even if hidden.
                    if (this._pendingFocusRestore?.categoryId === expectedCategoryId) {
                        this._pendingFocusRestore = null;
                    }

                    if (this._container.classList.contains('visible')) {
                        const nav = this._getNavigation();
                        const preferredFocusId = pendingPreferredFocusId ?? nav?.getFocusedElement()?.id ?? null;
                        this._unregisterFocusables();
                        this._registerFocusables(preferredFocusId);
                    }

                    this._detailRevealFrame = requestAnimationFrame(() => {
                        this._detailRevealFrame = null;
                        if (expectedCategoryId !== this._activeCategoryId) return;
                        this._detailItems?.classList.remove('transitioning');
                    });
                });
            }
        }

        for (const category of this._categories) {
            const button = this._categoryButtons.get(category.id);
            if (!button) continue;
            const isActive = category.id === this._activeCategoryId;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        }
    }

    private _setActiveCategory(
        categoryId: SettingsCategoryId,
        options: { preferredFocusId?: string | null; focusDetail?: boolean } = {}
    ): void {
        if (this._activeDropdown) {
            this._closeDropdown();
        }

        // Focus-only path: pressing RIGHT on an already-active category should not re-render
        // the detail pane. It should simply move focus into the detail controls.
        if (this._activeCategoryId === categoryId && options.focusDetail) {
            if (!this._container.classList.contains('visible')) {
                return;
            }
            const preferredFocusId =
                this._getPreferredDetailFocusId(categoryId) ?? this._getCategoryButtonId(categoryId);
            // If a category swap is currently deferred, detail items may not exist yet. Preserve intent so
            // the swap frame can focus the desired detail control once it is created.
            const isDeferredSwapActive =
                this._detailSwapFrame !== null || this._detailItems?.classList.contains('transitioning') === true;
            if (isDeferredSwapActive && preferredFocusId !== this._getCategoryButtonId(categoryId)) {
                this._pendingFocusRestore = { categoryId, preferredFocusId };
            }
            this._unregisterFocusables();
            this._registerFocusables(preferredFocusId);
            return;
        }

        if (this._activeCategoryId === categoryId && !options.focusDetail) {
            return;
        }

        this._activeCategoryId = categoryId;
        this._categories = this._buildCategories();
        if (!this._categories.some((category) => category.id === this._activeCategoryId)) {
            this._activeCategoryId = this._categories[0]?.id ?? null;
        }

        const resolvedCategoryId = this._activeCategoryId;
        const isVisible = this._container.classList.contains('visible');
        const resolvedCategoryButtonId = resolvedCategoryId ? this._getCategoryButtonId(resolvedCategoryId) : null;
        const resolvedCategoryConfig = resolvedCategoryId
            ? this._categories.find((entry) => entry.id === resolvedCategoryId)
            : undefined;
        const preferredFocusId = !isVisible || !resolvedCategoryId || !resolvedCategoryButtonId
            ? null
            : options.focusDetail
                ? this._lastFocusedItemByCategory[resolvedCategoryId] ??
                    resolvedCategoryConfig?.items[0]?.id ??
                    resolvedCategoryButtonId
                : options.preferredFocusId ?? resolvedCategoryButtonId;
        if (isVisible && resolvedCategoryId) {
            this._pendingFocusRestore = { categoryId: resolvedCategoryId, preferredFocusId };
        }

        this._renderActiveCategory();

        if (!isVisible) {
            return;
        }
        this._unregisterFocusables();
        this._registerFocusables(preferredFocusId);
    }

    private _getActiveCategory(): SettingsCategoryConfig | undefined {
        if (!this._activeCategoryId) return undefined;
        return this._categories.find((category) => category.id === this._activeCategoryId);
    }

    private _getCategoryButtonId(id: SettingsCategoryId): string {
        return `settings-category-${id}`;
    }

    private _getCategoryIdFromButtonId(id: string): SettingsCategoryId | null {
        const prefix = 'settings-category-';
        if (!id.startsWith(prefix)) return null;
        const categoryId = id.slice(prefix.length) as SettingsCategoryId;
        return this._categories.some((category) => category.id === categoryId) ? categoryId : null;
    }

    private _getPreferredDetailFocusId(categoryId: SettingsCategoryId): string | undefined {
        const rememberedId = this._lastFocusedItemByCategory[categoryId];
        if (rememberedId) {
            if (this._activeCategoryId !== categoryId || this._isFocusableEnabled(rememberedId)) {
                return rememberedId;
            }
        }
        if (this._activeCategoryId === categoryId) {
            // During deferred detail swaps, `_activeCategoryItemIds` may not be populated yet.
            // Prefer the first enabled detail id if available, otherwise fall back to the category config below.
            const activeId =
                this._activeCategoryItemIds.find((id) => this._isFocusableEnabled(id)) ?? this._activeCategoryItemIds[0];
            if (activeId) {
                return activeId;
            }
        }
        const category = this._categories.find((entry) => entry.id === categoryId);
        return category?.items[0]?.id;
    }

    private _isDetailFocusable(id: string): boolean {
        return this._toggleElements.has(id) || this._selectElements.has(id) || id === this._switchProfileButton?.id;
    }

    /**
     * Show the settings screen and register focusables.
     */
    public show(): void {
        this._container.classList.add('visible');
        this._categories = this._buildCategories();
        if (!this._activeCategoryId || !this._categories.some((category) => category.id === this._activeCategoryId)) {
            this._activeCategoryId = this._categories[0]?.id ?? null;
        }
        this._renderActiveCategory();
        this._refreshValues();
        if (this._switchProfileButton && this._getActiveUsername) {
            const username = this._getActiveUsername() ?? 'Profile';
            const nameEl = this._switchProfileButton.querySelector('.settings-profile-name');
            if (nameEl) nameEl.textContent = username;
            this._switchProfileButton.setAttribute('aria-label', `Switch profile. Current: ${username}`);
        }
        const nav = this._getNavigation();
        if (nav && !this._navKeyHandler) {
            this._navKeyHandler = (event: KeyEvent): void => {
                if (event.handled) return;

                // Dismiss dropdown on Back key.
                if (this._activeDropdown && event.button === 'back') {
                    event.handled = true;
                    this._dismissDropdown();
                    return;
                }

                const focusedId = nav.getFocusedElement()?.id;
                if (!focusedId) return;
                const focusedCategoryId = this._getCategoryIdFromButtonId(focusedId);
                if (focusedCategoryId && event.button === 'right') {
                    this._setActiveCategory(focusedCategoryId, { focusDetail: true });
                    event.handled = true;
                    return;
                }
                const select = this._selectElements.get(focusedId);
                if (select && !select.isDisabled() && event.button === 'left') {
                    const changed = select.cyclePrev();
                    if (!changed) {
                        const activeCategoryId = this._activeCategoryId;
                        if (activeCategoryId) {
                            nav.setFocus(this._getCategoryButtonId(activeCategoryId));
                        }
                    }
                    event.handled = true;
                    return;
                }
                if (select && !select.isDisabled() && event.button === 'right') {
                    select.cycleNext();
                    event.handled = true;
                    return;
                }
                if (event.button === 'left' && this._isDetailFocusable(focusedId)) {
                    const activeCategoryId = this._activeCategoryId;
                    if (activeCategoryId) {
                        nav.setFocus(this._getCategoryButtonId(activeCategoryId));
                        event.handled = true;
                    }
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
        this._closeDropdown();
        this._container.classList.remove('visible');
        if (this._navKeyHandler) {
            const nav = this._getNavigation();
            nav?.off('keyPress', this._navKeyHandler);
            this._navKeyHandler = null;
        }
        this._cancelDetailFrames();
        this._detailItems?.classList.remove('transitioning');
        this._pendingFocusRestore = null;
        this._unregisterFocusables();
    }

    private _openDropdownForSelect(selectId: string): void {
        // Close any existing dropdown.
        this._closeDropdown();

        const select = this._selectElements.get(selectId);
        if (!select || select.isDisabled()) return;

        const nav = this._getNavigation();
        this._activeDropdown = createSettingsDropdown({
            anchor: select.element,
            container: this._container,
            options: select.getOptions(),
            currentValue: select.getValue(),
            onSelect: (value: number): void => {
                try {
                    select.setValue(value);
                } finally {
                    this._closeDropdown();
                    try {
                        nav?.setFocus(selectId);
                    } catch {
                        // Ignore focus restore failures.
                    }
                }
            },
            onDismiss: (): void => {
                if (nav) {
                    nav.setFocus(selectId);
                }
            },
            nav,
        });
    }

    private _dismissDropdown(): void {
        if (!this._activeDropdown) return;
        const dropdown = this._activeDropdown;
        try {
            dropdown.dismiss();
        } finally {
            if (this._activeDropdown === dropdown) {
                this._activeDropdown = null;
            }
        }
    }

    private _closeDropdown(): void {
        if (this._activeDropdown) {
            this._activeDropdown.destroy();
            this._activeDropdown = null;
        }
    }

    /**
     * Register all toggles as focusable elements.
     */
    private _registerFocusables(preferredFocusId?: string | null): void {
        const nav = this._getNavigation();
        if (!nav) return;

        const categoryIds = this._categories.map((category) => this._getCategoryButtonId(category.id));
        const detailIds = this._activeCategoryItemIds.filter((id) => this._isFocusableEnabled(id));
        const switchProfileId = this._switchProfileButton?.id;

        const focusableIds = [
            ...categoryIds,
            ...detailIds,
            ...(switchProfileId ? [switchProfileId] : []),
        ].filter((id) => {
            const element = this._getFocusableElement(id);
            return Boolean(element) && this._isFocusableEnabled(id);
        });
        this._focusableIds = focusableIds;

        const currentFocusId = nav.getFocusedElement()?.id ?? null;
        const activeCategoryId = this._activeCategoryId;
        const activeCategoryButtonId = activeCategoryId ? this._getCategoryButtonId(activeCategoryId) : undefined;
        const lastDetailId = detailIds.length > 0 ? detailIds[detailIds.length - 1] : undefined;

        for (const id of focusableIds) {
            const element = this._getFocusableElement(id);
            if (!element) continue;

            const neighbors: FocusableElement['neighbors'] = {};
            let onFocus: (() => void) | undefined;
            let onSelect: (() => void) | undefined;

            const categoryId = this._getCategoryIdFromButtonId(id);
            if (categoryId) {
                const categoryIndex = categoryIds.indexOf(id);
                const upId = categoryIndex > 0 ? categoryIds[categoryIndex - 1] : undefined;
                const downId = categoryIndex >= 0 && categoryIndex < categoryIds.length - 1
                    ? categoryIds[categoryIndex + 1]
                    : undefined;
                if (upId) neighbors.up = upId;
                if (downId) neighbors.down = downId;
                const preferredDetailId = this._getPreferredDetailFocusId(categoryId);
                if (preferredDetailId) {
                    neighbors.right = preferredDetailId;
                }
                onFocus = (): void => {
                    if (this._activeCategoryId === categoryId) return;
                    this._setActiveCategory(categoryId, { preferredFocusId: id });
                };
                onSelect = (): void => {
                    this._setActiveCategory(categoryId, { preferredFocusId: id });
                };
            } else if (detailIds.includes(id)) {
                const detailIndex = detailIds.indexOf(id);
                const upId = detailIndex > 0 ? detailIds[detailIndex - 1] : undefined;
                const downId = detailIndex < detailIds.length - 1
                    ? detailIds[detailIndex + 1]
                    : switchProfileId;
                if (upId) neighbors.up = upId;
                if (downId) neighbors.down = downId;
                if (activeCategoryButtonId) {
                    neighbors.left = activeCategoryButtonId;
                }
                onFocus = (): void => {
                    if (!activeCategoryId) return;
                    this._lastFocusedItemByCategory[activeCategoryId] = id;
                };
                const isSelect = this._selectElements.has(id);
                onSelect = isSelect
                    ? (): void => {
                        this._openDropdownForSelect(id);
                    }
                    : (): void => {
                        element.click();
                    };
            } else if (switchProfileId && id === switchProfileId) {
                if (lastDetailId) {
                    neighbors.up = lastDetailId;
                }
                if (activeCategoryButtonId) {
                    neighbors.left = activeCategoryButtonId;
                }
                onSelect = (): void => {
                    element.click();
                };
            }

            const focusable: FocusableElement = {
                id,
                element,
                neighbors,
            };
            if (onFocus) {
                focusable.onFocus = onFocus;
            }
            if (onSelect) {
                focusable.onSelect = onSelect;
            }
            nav.registerFocusable(focusable);
        }

        // If focus currently points at a different category button than the active one, do not preserve it.
        // Preserving it would immediately trigger that button's onFocus handler and revert the active category swap.
        const currentFocusedCategoryId = currentFocusId ? this._getCategoryIdFromButtonId(currentFocusId) : null;
        const shouldIgnoreCurrentFocus =
            Boolean(currentFocusedCategoryId && activeCategoryId && currentFocusedCategoryId !== activeCategoryId);
        const usableCurrentFocusId = shouldIgnoreCurrentFocus ? null : currentFocusId;

        // Preserve current focus if still enabled, otherwise focus the first available
        const preferredId = preferredFocusId && focusableIds.includes(preferredFocusId)
            ? preferredFocusId
            : usableCurrentFocusId && focusableIds.includes(usableCurrentFocusId)
                ? usableCurrentFocusId
                : activeCategoryButtonId && focusableIds.includes(activeCategoryButtonId)
                    ? activeCategoryButtonId
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

    private _loadEpgLayoutModeValue(): number {
        return this._settingsStore.readEpgLayoutModeValue();
    }

    private _loadEpgGuideDensityValue(): number {
        return this._settingsStore.readEpgGuideDensityValue();
    }

    private _loadEpgPastItemsWindowValue(): number {
        return this._settingsStore.readEpgPastItemsWindowValue();
    }

    private _loadEpgInfoBackgroundModeValue(): 0 | 1 | 2 {
        return this._settingsStore.readEpgInfoBackgroundModeValue();
    }

    private _loadSubtitleLanguageValue(): number {
        return this._settingsStore.readSubtitleLanguageValue(SUBTITLE_LANGUAGE_OPTIONS);
    }

    private _loadTranscodeQualityValue(): number {
        return this._settingsStore.readTranscodeQualityValue(TRANSCODE_QUALITY_OPTIONS);
    }

    private _saveTranscodeQualityValue(value: number): void {
        this._settingsStore.writeTranscodeQualityValue(value, TRANSCODE_QUALITY_OPTIONS);
    }

    private _notifyDebugLoggingChanged(enabled: boolean): void {
        dispatchDebugLoggingChanged(enabled);
    }

    private _saveEpgLayoutModeValue(value: number): void {
        const normalized: 0 | 1 = value === 0 ? 0 : 1;
        this._settingsStore.writeEpgLayoutModeValue(normalized);
    }

    private _saveEpgGuideDensityValue(value: number): void {
        this._settingsStore.writeEpgGuideDensityValue(value);
    }

    private _saveEpgPastItemsWindowValue(value: number): 'auto' | '0' | '15' | '30' {
        return this._settingsStore.writeEpgPastItemsWindowValue(value);
    }

    private _saveEpgInfoBackgroundModeValue(value: number): 0 | 1 | 2 {
        return this._settingsStore.writeEpgInfoBackgroundModeValue(value);
    }

    private _saveSubtitleLanguageValue(value: number): void {
        this._settingsStore.writeSubtitleLanguageValue(value, SUBTITLE_LANGUAGE_OPTIONS);
    }

    private _subtitleModeToValue(mode: SubtitleMode): number {
        const index = SUBTITLE_MODE_OPTIONS.findIndex((o) => o.mode === mode);
        return index >= 0 ? index : 3;
    }

    private _valueToSubtitleMode(value: number): SubtitleMode {
        const option = SUBTITLE_MODE_OPTIONS[value];
        if (!option) return 'full';
        return option.mode;
    }

    private _loadSubtitleModeValue(): number {
        const mode = getSubtitleMode();
        return this._subtitleModeToValue(mode);
    }

    private _saveSubtitleMode(mode: SubtitleMode): void {
        setSubtitleMode(mode);
    }

    private _refreshValues(): void {
        const selectLoaders: Record<string, () => number> = {
            'settings-now-playing-timeout': () => this._loadClampedNowPlayingAutoHide(),
            'settings-subtitle-mode': () => this._loadSubtitleModeValue(),
            'settings-subtitle-language': () => this._loadSubtitleLanguageValue(),
            'settings-hdr10-fallback-mode': () => this._settingsStore.readHdr10FallbackModeValue(),
            'settings-transcode-quality': () => this._loadTranscodeQualityValue(),
            'settings-epg-density': () => this._loadEpgGuideDensityValue(),
            'settings-epg-layout-mode': () => this._loadEpgLayoutModeValue(),
            'settings-epg-past-items': () => this._loadEpgPastItemsWindowValue(),
            'settings-epg-info-background-mode': () => this._loadEpgInfoBackgroundModeValue(),
        };
        for (const [id, meta] of this._toggleMetadata.entries()) {
            const toggle = this._toggleElements.get(id);
            if (!toggle) continue;
            const value = this._settingsStore.readToggleSetting(meta.toggleSettingId);
            toggle.update(value);
            meta.onRefresh?.(value);
        }
        for (const [id, meta] of this._selectMetadata.entries()) {
            const select = this._selectElements.get(id);
            if (!select) continue;
            const loader = selectLoaders[id];
            if (!loader) {
                throw new Error(`Missing select loader for ${id}`);
            }
            const value = loader();
            select.update(value);
            meta.onRefresh?.(value);
        }
        const themeSelect = this._selectElements.get('settings-theme');
        if (themeSelect) {
            themeSelect.update(this._getThemeIndex(ThemeManager.getInstance().getTheme()));
        }
        const mode = this._valueToSubtitleMode(this._loadSubtitleModeValue());
        this._updateSubtitleDependentControls(mode);
    }

    private _getThemeIndex(theme: (typeof THEME_OPTIONS)[number]['theme']): number {
        const index = THEME_OPTIONS.findIndex((option) => option.theme === theme);
        return index >= 0 ? index : DEFAULT_THEME_VALUE;
    }

    private _updateSubtitleDependentControls(mode: SubtitleMode): void {
        const subtitlesEnabled = mode !== 'off';
        const subtitleLanguage = this._selectElements.get('settings-subtitle-language');
        subtitleLanguage?.setDisabled(!subtitlesEnabled);
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
        if (this._getCategoryIdFromButtonId(id)) {
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
        return this._settingsStore.readClampedNowPlayingAutoHideValue(
            NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS,
            NOW_PLAYING_INFO_DEFAULTS.autoHideMs
        );
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
            return select.element;
        }

        const toggle = createSettingsToggle(item);
        this._toggleElements.set(item.id, toggle);
        const meta = this._inferToggleMetadata(item.id);
        if (meta) {
            this._toggleMetadata.set(item.id, meta);
        }
        return toggle.element;
    }

    private _getFocusableElement(id: string): HTMLButtonElement | null {
        const categoryId = this._getCategoryIdFromButtonId(id);
        if (categoryId) {
            return this._categoryButtons.get(categoryId) ?? null;
        }
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
        if (this._navKeyHandler) {
            this._getNavigation()?.off('keyPress', this._navKeyHandler);
            this._navKeyHandler = null;
        }
        this._closeDropdown();
        this._unregisterFocusables();
        this._categories = [];
        this._activeCategoryId = null;
        this._lastFocusedItemByCategory = {};
        this._toggleElements.clear();
        this._selectElements.clear();
        this._categoryButtons.clear();
        this._activeCategoryItemIds = [];
        this._toggleMetadata.clear();
        this._selectMetadata.clear();
        this._detailTitle = null;
        this._detailItems = null;
        this._switchProfileButton = null;
        this._cancelDetailFrames();
        this._container.innerHTML = '';
    }
}

function isSelectItem(item: SettingsItemConfig): item is SettingsSelectConfig {
    return 'options' in item;
}
