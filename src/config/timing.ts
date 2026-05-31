export const TIMING_CONFIG = {
    CALLBACK_TIMEOUT_MS: 5000,
    /** Applies to state and channel saves. */
    SAVE_DEBOUNCE_MS: 500,
    PERSISTENCE_WARNING_BACKOFF_MS: 60000,
    PERSISTENCE_WARNING_MAX_BACKOFF_MS: 10 * 60000,
    NETWORK_CHECK_TIMEOUT_MS: 5000,
    NETWORK_CHECK_INTERVAL_MS: 60000,
    NETWORK_WARNING_BACKOFF_MS: 300000,
} as const;

export function secondsToMilliseconds(valueSeconds: number): number {
    return valueSeconds * 1000;
}
