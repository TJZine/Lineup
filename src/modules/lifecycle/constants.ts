export { TIMING_CONFIG } from '../../config/timing';
import { STORAGE_QUOTA_EXCEEDED_MESSAGE } from '../../shared/persistenceMessages';

export const STORAGE_CONFIG = {
    STATE_KEY: 'lineup_app_state',
    STATE_VERSION: 1,
    // Removal-only quota cleanup helpers; the lifecycle state store does not own their schemas or migrations.
    CLEANUP_KEYS: [
        'lineup_focus_memory',
        'lineup_image_cache',
        'lineup_schedule_cache',
    ],
} as const;

/**
 * Lifecycle-owned endpoint used for best-effort internet reachability checks.
 */
export const NETWORK_CHECK_PROBE_URL = 'https://example.com' as const;

/**
 * Memory thresholds for webOS.
 * Total app budget: 300MB peak.
 */
export const MEMORY_THRESHOLDS = {
    WARNING_BYTES: 250 * 1024 * 1024,
    CRITICAL_BYTES: 280 * 1024 * 1024,
    LIMIT_BYTES: 300 * 1024 * 1024,
    CHECK_INTERVAL_MS: 30000,
} as const;

export const DEFAULT_USER_PREFERENCES = {
    theme: 'dark' as const,
    volume: 70,
    subtitleLanguage: null,
    audioLanguage: null,
};

export const ERROR_MESSAGES = {
    AUTH_EXPIRED: 'Please sign in again',
    AUTH_RATE_LIMITED: 'Too many sign-in attempts. Please wait a moment',
    NETWORK_UNAVAILABLE: 'No internet connection',
    PLEX_UNREACHABLE: 'Cannot connect to Plex server',
    DATA_CORRUPTION: 'Settings were reset',
    PLAYBACK_FAILED: 'Unable to play content',
    CONTENT_UNAVAILABLE: 'That content is unavailable right now',
    ACCESS_DENIED: 'This profile does not have access to that library',
    OUT_OF_MEMORY: 'App needs to restart',
    STORAGE_QUOTA_EXCEEDED: STORAGE_QUOTA_EXCEEDED_MESSAGE,
    PAGINATION_LIMIT_EXCEEDED: 'Unable to load all items from that library',
    MODULE_INIT_FAILED: 'App failed to start. Please try again',
    UNRECOVERABLE: 'A critical error occurred. Please restart the app',
} as const;

/**
 * Valid phase transitions.
 * Key is current phase, value is array of valid next phases.
 */
export const VALID_PHASE_TRANSITIONS: Record<string, readonly string[]> = {
    initializing: ['authenticating', 'loading_data', 'error'],
    authenticating: ['loading_data', 'error'],
    loading_data: ['ready', 'error'],
    ready: ['loading_data', 'backgrounded', 'terminating', 'error'],
    backgrounded: ['ready', 'resuming', 'terminating'],
    resuming: ['ready', 'error'],
    error: ['authenticating', 'loading_data', 'ready', 'terminating'],
    terminating: [],
} as const;

/**
 * Package-internal migration registry consumed by the lifecycle state store only.
 * Intentionally not re-exported from the lifecycle barrel; missing older-version
 * entries mean that persisted version is unsupported and load() returns null.
 */
export const MIGRATIONS: Record<number, (state: Record<string, unknown>) => Record<string, unknown>> = {
};
