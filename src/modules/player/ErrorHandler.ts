import { AppErrorCode } from '../../types/app-errors';
import type { PlaybackError } from './types';
import { RETRY_BASE_DELAY_MS } from './constants';

const MAX_BACKOFF_MS = 30000;

/**
 * Map MediaError code to PlaybackError.
 * Exported for deterministic testing as required by spec.
 *
 * @param mediaErrorCode - MediaError.code value (1-4)
 * @param retryCount - Current retry count
 * @param retryAttempts - Maximum retry attempts
 * @param retryDelayMs - Base delay for retries (from config)
 * @returns PlaybackError with appropriate code and recoverable flag
 */
export function mapMediaErrorCodeToPlaybackError(
    mediaErrorCode: number,
    retryCount: number,
    retryAttempts: number,
    retryDelayMs: number = RETRY_BASE_DELAY_MS
): PlaybackError {
    let code: AppErrorCode;
    let message: string;
    let recoverable: boolean;

    switch (mediaErrorCode) {
        case 1: // MEDIA_ERR_ABORTED
            code = AppErrorCode.UNKNOWN;
            message = 'Media loading aborted';
            recoverable = false;
            break;

        case 2: // MEDIA_ERR_NETWORK
            code = AppErrorCode.NETWORK_TIMEOUT;
            message = 'Network error during playback';
            // Recoverable only if we haven't exhausted retries
            recoverable = retryCount < retryAttempts;
            break;

        case 3: // MEDIA_ERR_DECODE
            code = AppErrorCode.PLAYBACK_DECODE_ERROR;
            message = 'Media decode error';
            recoverable = false;
            break;

        case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
            code = AppErrorCode.PLAYBACK_FORMAT_UNSUPPORTED;
            message = 'Media format not supported';
            recoverable = false;
            break;

        default:
            code = AppErrorCode.UNKNOWN;
            message = `Unknown media error (code: ${mediaErrorCode})`;
            recoverable = false;
    }

    const error: PlaybackError = {
        code,
        message,
        recoverable,
        retryCount,
    };

    // Only set retryAfterMs if recoverable
    if (recoverable) {
        error.retryAfterMs = calculateBackoffDelay(retryCount, retryDelayMs);
    }

    return error;
}

/**
 * Calculate retry delay using exponential backoff.
 * @param attemptNumber - Current attempt number (0-based)
 * @param baseDelayMs - Base delay in milliseconds
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(attemptNumber: number, baseDelayMs: number): number {
    const calculated = baseDelayMs * Math.pow(2, attemptNumber);
    return Math.min(calculated, MAX_BACKOFF_MS);
}
