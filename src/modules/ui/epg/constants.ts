/**
 * @fileoverview EPG UI module constants
 * @module modules/ui/epg/constants
 */

import type { EPGConfig } from './types';

export const EPG_CONTAINER_ID = 'epg-container' as const;

/**
 * EPG configuration constants.
 * See ADR-003 for rationale on MAX_DOM_ELEMENTS and buffer sizes.
 */
export const EPG_CONSTANTS = {
    /** Number of visible channel rows at once */
    VISIBLE_CHANNELS: 5,
    /** Grid time slot granularity (minutes) */
    TIME_SLOT_MINUTES: 30,
    /** Hours visible at once */
    VISIBLE_HOURS: 2,
    /** Total hours in schedule */
    TOTAL_HOURS: 24,
    /** Pixels per minute (width scaling) */
    PIXELS_PER_MINUTE: 4,
    /** Pixels per channel row */
    ROW_HEIGHT: 108,
    /** Virtualization row buffer above/below visible */
    ROW_BUFFER: 2,
    /** Virtualization time buffer (minutes) */
    TIME_BUFFER_MINUTES: 60,
    /** Current time indicator update interval (ms) */
    TIME_INDICATOR_UPDATE_MS: 60_000,
    /** Maximum DOM elements for grid cells */
    MAX_DOM_ELEMENTS: 200,
    /** Maximum pool size for recycled elements */
    MAX_POOL_SIZE: 250,
    /** Scroll amount when navigating past visible window (minutes) */
    TIME_SCROLL_AMOUNT: 30,
    /** Channel column width (pixels) */
    CHANNEL_COLUMN_WIDTH: 200,
} as const;

/**
 * CSS class names used by EPG components.
 */
export const EPG_CLASSES = {
    CONTAINER: 'epg-container',
    CONTAINER_VISIBLE: 'visible',
    CONTAINER_PEEK: 'peek',
    CONTAINER_CLASSIC: 'layout-classic',
    GRID: 'epg-grid',
    CHANNEL_LIST: 'epg-channel-list',
    CHANNEL_ROW: 'epg-channel-row',
    CHANNEL_NUMBER: 'epg-channel-number',
    CHANNEL_ICON: 'epg-channel-icon',
    CHANNEL_NAME: 'epg-channel-name',
    PROGRAM_AREA: 'epg-program-area',
    CELL: 'epg-cell',
    CELL_FOCUSED: 'focused',
    CELL_CURRENT: 'current',
    CELL_PAST: 'past',
    CELL_LOADING: 'loading',
    CELL_TEXT_SHIFTED: 'text-shifted',
    CELL_TIER_WIDE: 'epg-cell-tier-wide',
    CELL_TIER_MEDIUM: 'epg-cell-tier-medium',
    CELL_TIER_NARROW: 'epg-cell-tier-narrow',
    CELL_TIER_TINY: 'epg-cell-tier-tiny',
    CELL_META: 'epg-cell-meta',
    CELL_EPISODE: 'epg-cell-episode',
    CELL_TITLE: 'epg-cell-title',
    CELL_TITLE_TICKER_READY: 'epg-cell-title-ticker-ready',
    CELL_TITLE_TICKER_RUNNING: 'epg-cell-title-ticker-running',
    CELL_SUBTITLE: 'epg-cell-subtitle',
    CELL_CONTENT: 'epg-cell-content',
    CELL_RAIL: 'epg-cell-rail',
    CELL_PROGRESS: 'epg-cell-progress',
    CELL_PROGRESS_FILL: 'epg-cell-progress-fill',
    CELL_TIME: 'epg-cell-time',
    CELL_TIME_COMPACT: 'epg-cell-time-compact',
    LIVE_BADGE: 'epg-live-badge',
    CELL_LIVE_COMPACT: 'epg-live-badge-compact',
    PROGRAM_EDGE_MASK: 'epg-program-edge-mask',
    PROGRAM_EDGE_MASK_LEFT: 'epg-program-edge-mask-left',
    PROGRAM_EDGE_MASK_RIGHT: 'epg-program-edge-mask-right',
    SCRUB_LABEL: 'epg-scrub-label',
    SCRUB_LABEL_VISIBLE: 'visible',
    SCRUB_LABEL_TITLE: 'epg-scrub-label-title',
    SCRUB_LABEL_TIME: 'epg-scrub-label-time',
    SCRUB_LABEL_CHANNEL: 'epg-scrub-label-channel',
    TIME_HEADER: 'epg-time-header',
    TIME_HEADER_SLOTS: 'epg-time-header-slots',
    TIME_HEADER_STICKY: 'epg-time-header-sticky',
    TIME_SLOT: 'epg-time-slot',
    TIME_INDICATOR: 'epg-time-indicator',
    TIME_INDICATOR_LABEL: 'epg-time-indicator-label',
    INFO_PANEL: 'epg-info-panel',
    INFO_MODE_BLEED: 'epg-info-mode-bleed',
    INFO_MODE_THEME_DEFAULT: 'epg-info-mode-theme-default',
    INFO_MODE_ARTWORK: 'epg-info-mode-artwork',
    LEGEND: 'epg-legend',
    INFO_BACKDROP: 'epg-info-backdrop',
    INFO_BACKDROP_IMG: 'epg-info-backdrop-img',
    INFO_GRADIENT_A: 'epg-info-gradient-a',
    INFO_GRADIENT_B: 'epg-info-gradient-b',
    INFO_GRADIENT_ACTIVE: 'epg-info-gradient-active',
    INFO_POSTER_WRAP: 'epg-info-poster-wrap',
    INFO_POSTER: 'epg-info-poster',
    INFO_CONTENT: 'epg-info-content',
    INFO_HEADER: 'epg-info-header',
    INFO_HEADING: 'epg-info-heading',
    INFO_META_CLUSTER: 'epg-info-meta-cluster',
    INFO_SHOW: 'epg-info-show',
    INFO_EYEBROW: 'epg-info-eyebrow',
    INFO_TITLE: 'epg-info-title',
    INFO_CLEAR_LOGO: 'epg-info-clear-logo',
    INFO_META: 'epg-info-meta',
    INFO_TAGS: 'epg-info-tags',
    INFO_PILL: 'epg-info-pill',
    INFO_GENRES: 'epg-info-genres',
    INFO_DESCRIPTION: 'epg-info-description',
    INFO_DESCRIPTION_INNER: 'epg-info-description-inner',
    INFO_QUALITY: 'epg-info-quality',
    INFO_QUALITY_BADGE: 'epg-info-quality-badge',
    OVERLAY_SHOWCASE: 'epg-overlay-showcase',
    DASHBOARD_BOTTOM: 'epg-dashboard-bottom',
    CHANNEL_LIST_WRAP_FLASH: 'wrap-flash',
    NOW_WATCHING_BANNER: 'epg-now-watching-banner',
    NOW_WATCHING_LIVE: 'epg-now-watching-live',
    NOW_WATCHING_CHANNEL: 'epg-now-watching-channel',
    NOW_WATCHING_PROGRAM: 'epg-now-watching-program',
    NOW_WATCHING_TIME: 'epg-now-watching-time',
} as const;

/**
 * Error messages for EPG components.
 */
export const EPG_ERRORS = {
    CONTAINER_NOT_FOUND: 'EPG container element not found',
    DASHBOARD_CONTAINER_NOT_FOUND: 'EPG dashboard container element not found',
    OVERLAY_SHOWCASE_CONTAINER_NOT_FOUND: 'EPG overlay showcase container element not found',
    NO_CHANNELS_LOADED: 'No channels loaded',
    SCHEDULE_NOT_LOADED: 'Schedule not loaded for channel',
    INVALID_CHANNEL_INDEX: 'Invalid channel index',
    INVALID_PROGRAM_INDEX: 'Invalid program index',
} as const;

/**
 * Default EPG configuration values.
 */
export const DEFAULT_EPG_CONFIG: EPGConfig = {
    containerId: EPG_CONTAINER_ID,
    visibleChannels: EPG_CONSTANTS.VISIBLE_CHANNELS,
    timeSlotMinutes: EPG_CONSTANTS.TIME_SLOT_MINUTES,
    visibleHours: EPG_CONSTANTS.VISIBLE_HOURS,
    totalHours: EPG_CONSTANTS.TOTAL_HOURS,
    pixelsPerMinute: EPG_CONSTANTS.PIXELS_PER_MINUTE,
    autoFitPixelsPerMinute: true,
    minPixelsPerMinute: 6,
    maxPixelsPerMinute: 12,
    rowHeight: EPG_CONSTANTS.ROW_HEIGHT,
    showCurrentTimeIndicator: true,
    autoScrollToNow: true,
    layoutMode: 'classic',
    showNowWatchingBanner: true,
    debugStorageRefreshIntervalMs: 500,
    debugRenderGridLogIntervalMs: 1000,
};
