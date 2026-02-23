/**
 * @fileoverview Shared timing constants across modules.
 * @module config/timing
 * @version 1.0.0
 */

/**
 * Timing configuration used by lifecycle, persistence, and network monitoring.
 */
export const TIMING_CONFIG = {
    /** Maximum time to wait for pause callbacks (ms) */
    CALLBACK_TIMEOUT_MS: 5000,
    /** Debounce time for state and channel saves (ms) */
    SAVE_DEBOUNCE_MS: 500,
    /** Minimum delay between persistence warnings (ms) */
    PERSISTENCE_WARNING_BACKOFF_MS: 60000,
    /** Maximum delay between persistence warnings (ms) */
    PERSISTENCE_WARNING_MAX_BACKOFF_MS: 10 * 60000,
    /** Network check timeout (ms) */
    NETWORK_CHECK_TIMEOUT_MS: 5000,
    /** Periodic network check interval (ms) */
    NETWORK_CHECK_INTERVAL_MS: 60000,
    /** Minimum delay between network warnings from monitoring (ms) */
    NETWORK_WARNING_BACKOFF_MS: 300000,
} as const;
