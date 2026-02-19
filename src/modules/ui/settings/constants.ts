/**
 * @fileoverview Settings module constants - storage keys and defaults.
 * @module modules/ui/settings/constants
 * @version 1.0.0
 */

import type { SettingsConfig } from './types';
import { RETUNE_STORAGE_KEYS } from '../../../config/storageKeys';
import { DEFAULT_THEME } from './theme';
export { THEME_CLASSES } from './theme';

/**
 * localStorage keys for persisting settings.
 */
export const SETTINGS_STORAGE_KEYS = {
    /** DTS passthrough enabled */
    DTS_PASSTHROUGH: RETUNE_STORAGE_KEYS.DTS_PASSTHROUGH,
    /** Direct play audio fallback enabled */
    DIRECT_PLAY_AUDIO_FALLBACK: RETUNE_STORAGE_KEYS.DIRECT_PLAY_AUDIO_FALLBACK,
    /** Keep playback running in settings */
    KEEP_PLAYING_IN_SETTINGS: RETUNE_STORAGE_KEYS.KEEP_PLAYING_IN_SETTINGS,
    /** Smart HDR10 fallback for DV MKV */
    SMART_HDR10_FALLBACK: RETUNE_STORAGE_KEYS.SMART_HDR10_FALLBACK,
    /** Force HDR10 fallback for DV MKV */
    FORCE_HDR10_FALLBACK: RETUNE_STORAGE_KEYS.FORCE_HDR10_FALLBACK,
    /** Transcode compatibility mode override */
    TRANSCODE_COMPAT: RETUNE_STORAGE_KEYS.TRANSCODE_COMPAT,
    /** Transcode quality override */
    TRANSCODE_QUALITY: RETUNE_STORAGE_KEYS.TRANSCODE_QUALITY,
    /** Color theme */
    THEME: RETUNE_STORAGE_KEYS.THEME,
    /** Cinematic layout for Now Playing overlay */
    CINEMATIC_NOW_PLAYING: RETUNE_STORAGE_KEYS.CINEMATIC_NOW_PLAYING,
    /** Debug logging enabled */
    DEBUG_LOGGING: RETUNE_STORAGE_KEYS.DEBUG_LOGGING,
    /** Subtitle debug logging enabled */
    SUBTITLE_DEBUG_LOGGING: RETUNE_STORAGE_KEYS.SUBTITLE_DEBUG_LOGGING,
    /** FPS counter enabled */
    SHOW_FPS: RETUNE_STORAGE_KEYS.SHOW_FPS,
    /** Now Playing Info overlay auto-hide timeout (ms) */
    NOW_PLAYING_INFO_AUTO_HIDE_MS: RETUNE_STORAGE_KEYS.NOW_PLAYING_INFO_AUTO_HIDE_MS,
    /** Audio setup completed flag */
    AUDIO_SETUP_COMPLETE: RETUNE_STORAGE_KEYS.AUDIO_SETUP_COMPLETE,
    /** Subtitle mode */
    SUBTITLE_MODE: RETUNE_STORAGE_KEYS.SUBTITLE_MODE,
    /** Preferred subtitle language (app override) */
    SUBTITLE_LANGUAGE: RETUNE_STORAGE_KEYS.SUBTITLE_LANGUAGE,
    /** Prefer forced subtitles over full subtitles */
    SUBTITLE_PREFER_FORCED: RETUNE_STORAGE_KEYS.SUBTITLE_PREFER_FORCED,
    /** Guide category colors enabled */
    GUIDE_CATEGORY_COLORS: RETUNE_STORAGE_KEYS.GUIDE_CATEGORY_COLORS,
    /** Guide library tabs enabled */
    EPG_LIBRARY_TABS_ENABLED: RETUNE_STORAGE_KEYS.EPG_LIBRARY_TABS_ENABLED,
    /** EPG layout mode (overlay/classic) */
    EPG_LAYOUT_MODE: RETUNE_STORAGE_KEYS.EPG_LAYOUT_MODE,
    /** EPG guide density (detailed/wide) */
    EPG_GUIDE_DENSITY: RETUNE_STORAGE_KEYS.EPG_GUIDE_DENSITY,
    /** EPG now watching banner enabled */
    EPG_NOW_WATCHING_ENABLED: RETUNE_STORAGE_KEYS.EPG_NOW_WATCHING_ENABLED,
    /** Show profile picker on startup */
    SHOW_PROFILE_PICKER_ON_STARTUP: RETUNE_STORAGE_KEYS.SHOW_PROFILE_PICKER_ON_STARTUP,
} as const;

/**
 * Default settings values.
 */
export const DEFAULT_SETTINGS: SettingsConfig = {
    audio: {
        dtsPassthrough: false,
        directPlayAudioFallback: false,
    },
    playback: {
        keepPlayingInSettings: false,
        smartHdr10Fallback: false,
        forceHdr10Fallback: false,
    },
    display: {
        theme: DEFAULT_THEME,
        nowPlayingInfoAutoHideMs: 0,
        cinematicNowPlaying: false,
    },
    developer: {
        debugLogging: false,
        subtitleDebugLogging: false,
        showFps: false,
    },
    subtitles: {
        mode: 'full',
        language: null,
        preferForced: false,
    },
    account: {
        showProfilePickerOnStartup: false,
    },
};
