/**
 * @fileoverview Settings module type definitions.
 * @module modules/ui/settings/types
 * @version 1.0.0
 */

import type {
    EpgGuideDensity,
    EpgLayoutMode,
} from '../../settings/EpgPreferencesStore';
import type { ThemeName } from './theme';

/**
 * Audio settings configuration.
 */
export interface AudioSettings {
    /** Enable DTS passthrough for external receivers (requires webOS 23+) */
    dtsPassthrough: boolean;
    /** Allow Direct Play by selecting a compatible fallback audio track */
    directPlayAudioFallback: boolean;
}

/**
 * Playback settings configuration.
 */
interface PlaybackSettings {
    /** Keep playback running when opening settings */
    keepPlayingInSettings: boolean;
    /** Forces HDR10 playback for DV MKV only when cinematic aspect ratios are detected */
    smartHdr10Fallback: boolean;
    /** Forces HDR10 playback for all DV MKV (excluding profiles without HDR10 base layer) */
    forceHdr10Fallback: boolean;
}

/**
 * Display settings configuration.
 */
export interface DisplaySettings {
    /** Color theme */
    theme: ThemeName;
    /** Now Playing Info overlay auto-hide timeout (ms) */
    nowPlayingInfoAutoHideMs: number;
    /** Cinematic Now Playing overlay layout toggle */
    cinematicNowPlaying: boolean;
    /** Prefer clear logos over text titles when available */
    preferClearLogos: boolean;
    /** EPG info panel background mode */
    epgInfoBackgroundMode: 0 | 1 | 2;
}

/**
 * Developer/debug settings configuration.
 */
export interface DeveloperSettings {
    /** Enable verbose debug logging */
    debugLogging: boolean;
    /** Enable verbose subtitle debug logging */
    subtitleDebugLogging: boolean;
    /** Show FPS counter overlay */
    showFps: boolean;
}

/**
 * Subtitle settings configuration.
 */
interface SubtitleSettings {
    /**
     * Subtitle handling mode.
     * - off: do not automatically load/select subtitles
     * - direct: only show subtitles that can be fetched directly (best performance)
     * - standard: allow server extraction for text subtitles (recommended)
     * - full: allow burn-in (image/styled) subtitles via transcoding
     */
    mode: 'off' | 'direct' | 'standard' | 'full';
    /** Preferred subtitle language code (app override) */
    language: string | null;
    /** Prefer forced subtitles over full subtitles when auto-selecting */
    preferForced: boolean;
}

/**
 * Account settings configuration.
 */
interface AccountSettings {
    /** Show profile picker on startup when Plex Home has multiple users */
    showProfilePickerOnStartup: boolean;
}

/**
 * Complete settings configuration.
 */
export interface SettingsConfig {
    audio: AudioSettings;
    playback: PlaybackSettings;
    display: DisplaySettings;
    developer: DeveloperSettings;
    subtitles: SubtitleSettings;
    account: AccountSettings;
}

/**
 * Settings toggle item configuration.
 */
export interface SettingsToggleConfig {
    /** Unique identifier */
    id: string;
    /** Display label */
    label: string;
    /** Optional description text */
    description?: string;
    /** Current value */
    value: boolean;
    /** Whether the toggle is disabled */
    disabled?: boolean;
    /** Reason for being disabled (shown to user) */
    disabledReason?: string;
    /** Callback when value changes */
    onChange: (value: boolean) => void;
}

/**
 * Settings select option configuration.
 */
export interface SettingsSelectOption {
    label: string;
    value: number;
}

/**
 * Settings select item configuration.
 */
export interface SettingsSelectConfig {
    /** Unique identifier */
    id: string;
    /** Display label */
    label: string;
    /** Optional description text */
    description?: string;
    /** Current value */
    value: number;
    /** Available options */
    options: SettingsSelectOption[];
    /** Whether the select is disabled */
    disabled?: boolean;
    /** Reason for being disabled (shown to user) */
    disabledReason?: string;
    /** Callback when value changes */
    onChange: (value: number) => void;
}

export type SettingsItemConfig = SettingsToggleConfig | SettingsSelectConfig;

export type SettingsCategoryId = 'audio_subtitles' | 'playback_hdr' | 'appearance' | 'account' | 'developer';

export type EpgPastItemsWindowSetting = 'auto' | '0' | '15' | '30';

export type GuideSettingChange =
    | { key: 'categoryColors' | 'libraryTabs' | 'nowWatchingBanner' | 'aggressivePreload'; enabled: boolean }
    | { key: 'layoutMode'; mode: EpgLayoutMode }
    | { key: 'guideDensity'; density: EpgGuideDensity }
    | { key: 'pastItemsWindow'; value: EpgPastItemsWindowSetting }
    | { key: 'infoBackgroundMode'; mode: 0 | 1 | 2 };

/**
 * Settings category configuration.
 */
export interface SettingsCategoryConfig {
    /** Unique identifier */
    id: SettingsCategoryId;
    /** Category label */
    label: string;
    /** Settings items in this category */
    items: SettingsItemConfig[];
}
