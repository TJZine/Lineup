import type {
    EpgGuideDensity,
    EpgLayoutMode,
    EpgPastItemsWindow,
} from '../../settings/EpgPreferencesStore';
import type { ThemeName } from '../theme';
import type { SubtitleMode } from '../../../shared/subtitle-mode';

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
    /** Hides DV capability for direct-play-first HDR10 preference on eligible DV MKV */
    smartHdr10Fallback: boolean;
    /** Advanced HLS/transcode-oriented HDR10 fallback for eligible DV MKV */
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
    mode: SubtitleMode;
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
    id: string;
    label: string;
    description?: string;
    value: boolean;
    disabled?: boolean;
    /** Reason for being disabled (shown to user) */
    disabledReason?: string;
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
    id: string;
    label: string;
    description?: string;
    value: number;
    options: SettingsSelectOption[];
    disabled?: boolean;
    /** Reason for being disabled (shown to user) */
    disabledReason?: string;
    onChange: (value: number) => void;
}

export type SettingsItemConfig = SettingsToggleConfig | SettingsSelectConfig;

export type SettingsCategoryId = 'audio_subtitles' | 'playback_hdr' | 'appearance' | 'account' | 'developer';

export type GuideSettingChange =
    | { key: 'libraryTabs' | 'nowWatchingBanner' | 'aggressivePreload'; enabled: boolean }
    | { key: 'layoutMode'; mode: EpgLayoutMode }
    | { key: 'guideDensity'; density: EpgGuideDensity }
    | { key: 'pastItemsWindow'; value: EpgPastItemsWindow }
    | { key: 'infoBackgroundMode'; mode: 0 | 1 | 2 };

/**
 * Settings category configuration.
 */
export interface SettingsCategoryConfig {
    id: SettingsCategoryId;
    label: string;
    items: SettingsItemConfig[];
}
