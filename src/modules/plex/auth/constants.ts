export const PLEX_AUTH_CONSTANTS = {
    PLEX_TV_BASE_URL: 'https://plex.tv/api/v2',
    PLEX_TV_BASE_URL_V1: 'https://plex.tv/api',
    PIN_ENDPOINT: '/pins',
    USER_ENDPOINT: '/user',
    HOME_USERS_ENDPOINT: '/home/users',
    STORAGE_KEY: 'lineup_plex_auth',
    CLIENT_ID_KEY: 'lineup_client_id',
    PIN_POLL_INTERVAL_MS: 1000,
    PIN_TIMEOUT_MS: 300000,
    TOKEN_VALIDATION_TIMEOUT_MS: 5000,

    /** Per-request timeout for Plex auth network calls */
    REQUEST_TIMEOUT_MS: 10000,

    /** Number of retry attempts for network requests */
    RETRY_ATTEMPTS: 3,

    /** Initial retry delay (exponential backoff base) */
    RETRY_DELAY_MS: 1000,

    /** Storage version for future migrations */
    STORAGE_VERSION: 2,
} as const;

/**
 * User-facing error messages.
 * These are displayed to users during authentication failures.
 */
export const AUTH_ERROR_MESSAGES = {
    AUTH_REQUIRED: 'Please sign in to your Plex account to continue.',
    AUTH_EXPIRED: 'Your session has expired. Please sign in again.',
    AUTH_INVALID: 'Unable to verify your Plex account. Please try signing in again.',
    AUTH_FAILED: 'Sign in failed. Please check your internet connection and try again.',
    PIN_EXPIRED: 'The PIN code has expired. Please request a new one.',
    PIN_TIMEOUT: 'PIN entry timed out. Please try again.',
} as const;
