/**
 * @fileoverview Lineup localStorage key constants.
 * @module config/storageKeys
 * @version 1.0.0
 */

/**
 * Canonical localStorage keys used across modules.
 *
 * Keep this file free of UI imports so core/player/plex can depend on it safely.
 */
export const LINEUP_STORAGE_KEYS = {
    // Audio / Playback
    DTS_PASSTHROUGH: 'lineup_enable_dts_passthrough',
    DIRECT_PLAY_AUDIO_FALLBACK: 'lineup_direct_play_audio_fallback',
    KEEP_PLAYING_IN_SETTINGS: 'lineup_keep_playing_in_settings',

    // Transcoding (user-facing)
    /** Transcode request parameter compatibility mode (advanced) */
    TRANSCODE_COMPAT: 'lineup_transcode_compat',
    /** Max transcode quality override (see src/config/transcodeQuality.ts) */
    TRANSCODE_QUALITY: 'lineup_transcode_quality',

    // Display / HDR / Dolby Vision
    SMART_HDR10_FALLBACK: 'lineup_smart_hdr10_fallback',
    FORCE_HDR10_FALLBACK: 'lineup_force_hdr10_fallback',

    // Setup / Onboarding
    AUDIO_SETUP_COMPLETE: 'lineup_audio_setup_complete',
    LAST_PROFILE_ID: 'lineup_last_profile_id',

    // Display
    THEME: 'lineup_theme',
    CINEMATIC_NOW_PLAYING: 'lineup_cinematic_now_playing',
    PREFER_CLEAR_LOGOS: 'lineup_prefer_clear_logos',
    NOW_PLAYING_INFO_AUTO_HIDE_MS: 'lineup_now_playing_info_auto_hide_ms',
    NOW_PLAYING_STREAM_DEBUG: 'lineup_now_playing_stream_debug',
    NOW_PLAYING_STREAM_DEBUG_AUTO_SHOW: 'lineup_now_playing_stream_debug_auto_show',
    /**
     * Subtitle handling mode:
     * - off: no automatic subtitle loading/selection
     * - direct: only show subtitles that can be fetched directly (best performance)
     * - standard: allow extraction for text subtitles while avoiding burn-in transcoding
     * - full: allow burn-in (image/styled) subtitles via transcoding (default)
     */
    SUBTITLE_MODE: 'lineup_subtitle_mode',
    SUBTITLE_LANGUAGE: 'lineup_subtitle_language',
    SUBTITLE_ALLOW_BURN_IN: 'lineup_subtitle_allow_burn_in',
    /** Prefer forced subtitles over full subtitles */
    SUBTITLE_PREFER_FORCED: 'lineup_subtitle_prefer_forced',
    // Guide / EPG
    GUIDE_CATEGORY_COLORS: 'lineup_guide_category_colors',
    EPG_DEBUG: 'lineup_debug_epg',
    EPG_LIBRARY_TABS_ENABLED: 'lineup_epg_library_tabs_enabled',
    EPG_LIBRARY_FILTER: 'lineup_epg_library_filter',
    EPG_LAYOUT_MODE: 'lineup_epg_layout_mode',
    EPG_GUIDE_DENSITY: 'lineup_epg_guide_density',
    EPG_NOW_WATCHING_ENABLED: 'lineup_epg_now_watching_enabled',
    EPG_AGGRESSIVE_PRELOAD_ENABLED: 'lineup_epg_aggressive_preload_enabled',
    /** Show Plex Home profile picker on startup */
    SHOW_PROFILE_PICKER_ON_STARTUP: 'lineup_show_profile_picker_on_startup',

    // Developer / Debug
    DEBUG_LOGGING: 'lineup_debug_logging',
    SUBTITLE_DEBUG_LOGGING: 'lineup_subtitle_debug_logging',
    SHOW_FPS: 'lineup_show_fps',

    // Dev menu overrides (transcode)
    /** Force Plex transcode profile matching (dev-only; not user-facing). */
    TRANSCODE_PROFILE_NAME: 'lineup_transcode_profile_name',
} as const;
