/**
 * @fileoverview Retune localStorage key constants.
 * @module config/storageKeys
 * @version 1.0.0
 */

/**
 * Canonical localStorage keys used across modules.
 *
 * Keep this file free of UI imports so core/player/plex can depend on it safely.
 */
export const RETUNE_STORAGE_KEYS = {
    // Audio / Playback
    DTS_PASSTHROUGH: 'retune_enable_dts_passthrough',
    DIRECT_PLAY_AUDIO_FALLBACK: 'retune_direct_play_audio_fallback',
    KEEP_PLAYING_IN_SETTINGS: 'retune_keep_playing_in_settings',
    /** Transcode request parameter compatibility mode (advanced) */
    TRANSCODE_COMPAT: 'retune_transcode_compat',
    /** Max transcode quality override (see src/config/transcodeQuality.ts) */
    TRANSCODE_QUALITY: 'retune_transcode_quality',
    // Display / HDR / Dolby Vision
    SMART_HDR10_FALLBACK: 'retune_smart_hdr10_fallback',
    FORCE_HDR10_FALLBACK: 'retune_force_hdr10_fallback',

    // Setup / Onboarding
    AUDIO_SETUP_COMPLETE: 'retune_audio_setup_complete',
    LAST_PROFILE_ID: 'retune_last_profile_id',

    // Display
    THEME: 'retune_theme',
    CINEMATIC_NOW_PLAYING: 'retune_cinematic_now_playing',
    NOW_PLAYING_INFO_AUTO_HIDE_MS: 'retune_now_playing_info_auto_hide_ms',
    NOW_PLAYING_STREAM_DEBUG: 'retune_now_playing_stream_debug',
    NOW_PLAYING_STREAM_DEBUG_AUTO_SHOW: 'retune_now_playing_stream_debug_auto_show',
    /**
     * Subtitle handling mode:
     * - off: no automatic subtitle loading/selection
     * - direct: only show subtitles that can be fetched directly (best performance)
     * - standard: allow extraction for text subtitles while avoiding burn-in transcoding
     * - full: allow burn-in (image/styled) subtitles via transcoding (default)
     */
    SUBTITLE_MODE: 'retune_subtitle_mode',
    SUBTITLE_LANGUAGE: 'retune_subtitle_language',
    SUBTITLE_ALLOW_BURN_IN: 'retune_subtitle_allow_burn_in',
    /** Prefer forced subtitles over full subtitles */
    SUBTITLE_PREFER_FORCED: 'retune_subtitle_prefer_forced',
    // Guide / EPG
    GUIDE_CATEGORY_COLORS: 'retune_guide_category_colors',
    EPG_LIBRARY_TABS_ENABLED: 'retune_epg_library_tabs_enabled',
    EPG_LIBRARY_FILTER: 'retune_epg_library_filter',
    EPG_LAYOUT_MODE: 'retune_epg_layout_mode',
    EPG_GUIDE_DENSITY: 'retune_epg_guide_density',
    EPG_NOW_WATCHING_ENABLED: 'retune_epg_now_watching_enabled',
    /** Show Plex Home profile picker on startup */
    SHOW_PROFILE_PICKER_ON_STARTUP: 'retune_show_profile_picker_on_startup',

    // Developer / Debug
    DEBUG_LOGGING: 'retune_debug_logging',
    SUBTITLE_DEBUG_LOGGING: 'retune_subtitle_debug_logging',
    SHOW_FPS: 'retune_show_fps',

    // Dev menu overrides (transcode)
    /** Force Plex transcode profile matching (dev-only). */
    TRANSCODE_PROFILE_NAME: 'retune_transcode_profile_name',
} as const;
