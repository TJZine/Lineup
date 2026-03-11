/**
 * @fileoverview Now Playing Info overlay constants.
 * @module modules/ui/now-playing-info/constants
 */

export const NOW_PLAYING_INFO_MODAL_ID = 'now-playing-info';
export const NOW_PLAYING_INFO_CONTAINER_ID = 'now-playing-info-container';

export const NOW_PLAYING_INFO_CLASSES = {
    CONTAINER: NOW_PLAYING_INFO_CONTAINER_ID,
    CINEMATIC: 'now-playing-info-cinematic',
    PANEL: 'now-playing-info-panel',
    BACKDROP: 'now-playing-info-backdrop',
    POSTER: 'now-playing-info-poster',
    CONTENT: 'now-playing-info-content',
    CLEAR_LOGO: 'now-playing-info-clear-logo',
    TITLE: 'now-playing-info-title',
    SUBTITLE: 'now-playing-info-subtitle',
    BADGES: 'now-playing-info-badges',
    BADGE: 'now-playing-info-badge',
    META: 'now-playing-info-meta',
    META_LINE: 'now-playing-info-meta-line',
    PLAYBACK: 'now-playing-info-playback',
    PLAYBACK_SUMMARY: 'now-playing-info-playback-summary',
    ACTORS: 'now-playing-info-actors',
    CAST: 'now-playing-info-cast',
    ACTOR: 'now-playing-info-actor',
    ACTOR_IMAGE: 'now-playing-info-actor-image',
    ACTOR_MORE: 'now-playing-info-actor-more',
    DESCRIPTION: 'now-playing-info-description',
    DESCRIPTION_INNER: 'now-playing-info-description-inner',
    PROGRESS: 'now-playing-info-progress',
    PROGRESS_BAR: 'now-playing-info-progress-bar',
    PROGRESS_FILL: 'now-playing-info-progress-fill',
    PROGRESS_META: 'now-playing-info-progress-meta',
} as const;

export const NOW_PLAYING_INFO_DEFAULTS = {
    autoHideMs: 0,
    posterWidth: 320,
    posterHeight: 480,
    actorThumbSize: 128,
    actorHeadshotCount: 6,
} as const;

export const NOW_PLAYING_INFO_AUTO_HIDE_OPTIONS = [
    0,
    5_000,
    10_000,
    15_000,
    30_000,
    60_000,
    120_000,
] as const;
