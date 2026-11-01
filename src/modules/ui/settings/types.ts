import type {
    EpgGuideHours,
    EpgGuideDensity,
    EpgLayoutMode,
    EpgPastItemsWindow,
} from '../../settings/EpgPreferencesStore';
import type {
    CompactControlsTimeoutSeconds,
    OverlayTransparency,
} from '../../settings/NowPlayingDisplayStore';
import type { ThemeName } from '../theme';
import type { SubtitleMode } from '../../../shared/subtitle-mode';

export interface AudioSettings {
    /** Enable DTS passthrough for external receivers (requires webOS 23+) */
    dtsPassthrough: boolean;
    /** Allow Direct Play by selecting a compatible fallback audio track */
    directPlayAudioFallback: boolean;
}

interface PlaybackSettings {
    /** Keep playback running when opening settings */
    keepPlayingInSettings: boolean;
    /** Advanced parameter compatibility mode used for troubleshooting transcodes. */
    transcodeCompat: boolean;
    /** Hides DV capability for direct-play-first HDR10 preference on eligible DV MKV */
    smartHdr10Fallback: boolean;
    /** Advanced HLS/transcode-oriented HDR10 fallback for eligible DV MKV */
    forceHdr10Fallback: boolean;
    /** Compact player-controls timeout in seconds; independent of the retired Info timeout. */
    compactControlsTimeoutSeconds: CompactControlsTimeoutSeconds;
}

export interface DisplaySettings {
    theme: ThemeName;
    /** Prefer clear logos over text titles when available */
    preferClearLogos: boolean;
    /** EPG info panel background mode */
    epgInfoBackgroundMode: 0 | 1 | 2;
    /** Player overlay scrim opacity choice, independent of Guide artwork background mode. */
    overlayTransparency: OverlayTransparency;
}

export interface GuideSettings {
    libraryTabsEnabled: boolean;
    nowWatchingBannerEnabled: boolean;
    aggressivePreloadEnabled: boolean;
    guideHours: EpgGuideHours;
    sourceLabelsEnabled: boolean;
}

export interface AccessibilitySettings {
    reduceMotion: boolean;
    largeFocus: boolean;
}

export interface SupportSettings {
    reportCollectionOptIn: boolean;
}

export interface DeveloperSettings {
    debugLogging: boolean;
    subtitleDebugLogging: boolean;
    showFps: boolean;
}

interface SubtitleSettings {
    /**
     * Subtitle handling mode.
     * - off: do not automatically load/select subtitles
     * - direct: only show subtitles that can be fetched directly (best performance)
     * - standard: allow server extraction for text subtitles (recommended)
     * - full: allow burn-in (image/styled) subtitles via transcoding
     */
    mode: SubtitleMode;
    /** Preferred subtitle language code (app override) */
    language: string | null;
    /** Prefer forced subtitles over full subtitles when auto-selecting */
    preferForced: boolean;
}

interface AccountSettings {
    /** Show profile picker on startup when Plex Home has multiple users */
    showProfilePickerOnStartup: boolean;
}

export interface SettingsConfig {
    audio: AudioSettings;
    playback: PlaybackSettings;
    display: DisplaySettings;
    guide: GuideSettings;
    accessibility: AccessibilitySettings;
    support: SupportSettings;
    developer: DeveloperSettings;
    subtitles: SubtitleSettings;
    account: AccountSettings;
}

export type SettingsMutationResult<T extends boolean | number> =
    | { ok: true }
    | { ok: false; message: string; effectiveValue?: T };

export type SettingsPersistenceResult =
    | { ok: true; effectiveValue: ThemeName; migration: 'glass-to-ember-steel' | null }
    | { ok: false; effectiveValue: ThemeName; migration: 'glass-to-ember-steel' | null; reason: string; retryable: true };

export interface SettingsToggleConfig {
    id: string;
    label: string;
    description?: string;
    value: boolean;
    disabled?: boolean;
    /** Reason for being disabled (shown to user) */
    disabledReason?: string;
    onChange: (value: boolean) => SettingsMutationResult<boolean>;
}

export interface SettingsSelectOption {
    label: string;
    value: number;
}

export interface SettingsSelectConfig {
    id: string;
    label: string;
    description?: string;
    value: number;
    options: SettingsSelectOption[];
    disabled?: boolean;
    /** Reason for being disabled (shown to user) */
    disabledReason?: string;
    onChange: (value: number) => SettingsMutationResult<number>;
}

export interface SettingsActionConfig {
    id: string;
    label: string;
    description?: string;
    action: () => void | Promise<void>;
}

export type SettingsItemConfig = SettingsToggleConfig | SettingsSelectConfig | SettingsActionConfig;

export type SettingsCategoryId = 'appearance' | 'guide' | 'playback' | 'audio_subtitles' | 'accessibility' | 'account' | 'support';

export type GuideSettingChange =
    | { key: 'libraryTabs' | 'nowWatchingBanner' | 'aggressivePreload'; enabled: boolean }
    | { key: 'layoutMode'; mode: EpgLayoutMode }
    | { key: 'guideDensity'; density: EpgGuideDensity }
    | { key: 'guideHours'; hours: EpgGuideHours }
    | { key: 'sourceLabels'; enabled: boolean }
    | { key: 'pastItemsWindow'; value: EpgPastItemsWindow }
    | { key: 'infoBackgroundMode'; mode: 0 | 1 | 2 };

export interface SettingsCategoryConfig {
    id: SettingsCategoryId;
    label: string;
    description?: string;
    sectionLabel?: string;
    items: SettingsItemConfig[];
}
