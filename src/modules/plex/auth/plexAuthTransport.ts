import { PLEX_AUTH_CONSTANTS } from './constants';
import type { PlexAuthConfig } from './interfaces';
import { AppErrorCode } from '../../lifecycle/types';

/**
 * Error class for Plex API errors.
 */
export class PlexApiError extends Error {
    public readonly code: AppErrorCode;
    public readonly httpStatus: number | undefined;
    public readonly retryable: boolean;

    constructor(
        code: AppErrorCode,
        message: string,
        httpStatus?: number,
        retryable: boolean = false
    ) {
        super(message);
        this.name = 'PlexApiError';
        this.code = code;
        this.httpStatus = httpStatus;
        this.retryable = retryable;
    }
}

/**
 * Build request headers for Plex API calls.
 * @param config - Plex auth configuration
 * @param token - Optional auth token
 * @param options - Optional additional headers
 * @returns Headers object
 */
export function buildRequestHeaders(
    config: PlexAuthConfig,
    token?: string,
    options?: { platformVersion?: string; deviceName?: string }
): Record<string, string> {
    const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Plex-Client-Identifier': config.clientIdentifier,
        'X-Plex-Product': config.product,
        'X-Plex-Version': config.version,
        'X-Plex-Platform': config.platform,
        'X-Plex-Device': config.device,
    };
    if (token) {
        headers['X-Plex-Token'] = token;
    }
    if (options?.platformVersion) {
        headers['X-Plex-Platform-Version'] = options.platformVersion;
    }
    if (options?.deviceName) {
        headers['X-Plex-Device-Name'] = options.deviceName;
    }
    return headers;
}

function sleep(ms: number): Promise<void> {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

/**
 * Handle HTTP response status and throw appropriate errors.
 * @param response - Fetch response
 * @throws PlexApiError for error statuses
 */
function handleResponseStatus(response: Response): void {
    // Authentication errors - not retryable
    if (response.status === 401) {
        throw new PlexApiError(
            AppErrorCode.AUTH_REQUIRED,
            'Unauthorized: authentication required',
            401,
            false
        );
    }
    if (response.status === 403) {
        throw new PlexApiError(
            AppErrorCode.AUTH_INVALID,
            'Forbidden: access denied',
            403,
            false
        );
    }
    // Rate limiting - retryable
    if (response.status === 429) {
        throw new PlexApiError(
            AppErrorCode.RATE_LIMITED,
            'Rate limited by Plex API',
            429,
            true
        );
    }
    // Not found - not retryable
    if (response.status === 404) {
        throw new PlexApiError(
            AppErrorCode.RESOURCE_NOT_FOUND,
            'Resource not found',
            404,
            false
        );
    }
    // Server errors - retryable
    if (response.status >= 500) {
        throw new PlexApiError(
            AppErrorCode.SERVER_UNREACHABLE,
            'Server error: ' + String(response.status),
            response.status,
            true
        );
    }
}

function createNetworkError(): PlexApiError {
    return new PlexApiError(
        AppErrorCode.SERVER_UNREACHABLE,
        'Network error',
        undefined,
        true
    );
}

/**
 * Fetch with retry logic and exponential backoff.
 * @param url - URL to fetch
 * @param options - Fetch options
 * @returns Response object
 * @throws PlexApiError on exhausted retries
 */
export async function fetchWithRetry(
    url: string,
    options: RequestInit
): Promise<Response> {
    let lastError: Error = new Error('Unknown error');
    let delay = PLEX_AUTH_CONSTANTS.RETRY_DELAY_MS;

    for (let attempt = 0; attempt < PLEX_AUTH_CONSTANTS.RETRY_ATTEMPTS; attempt++) {
        try {
            const controller = new AbortController();
            const externalSignal = options.signal ?? null;
            const onAbort = (): void => {
                try {
                    controller.abort();
                } catch {
                    // ignore
                }
            };

            if (externalSignal) {
                if (externalSignal.aborted) {
                    onAbort();
                } else {
                    externalSignal.addEventListener('abort', onAbort, { once: true });
                }
            }

            const timeoutId = setTimeout(() => onAbort(), PLEX_AUTH_CONSTANTS.REQUEST_TIMEOUT_MS);

            let response: Response;
            try {
                response = await fetch(url, { ...options, signal: controller.signal });
            } finally {
                clearTimeout(timeoutId);
                if (externalSignal) {
                    try {
                        externalSignal.removeEventListener('abort', onAbort);
                    } catch {
                        // ignore
                    }
                }
            }
            handleResponseStatus(response);
            return response;
        } catch (error) {
            if (error instanceof PlexApiError && !error.retryable) {
                throw error;
            }
            lastError = error instanceof PlexApiError ? error : createNetworkError();

            if (attempt < PLEX_AUTH_CONSTANTS.RETRY_ATTEMPTS - 1) {
                await sleep(delay);
                delay = delay * 2;
            }
        }
    }
    throw lastError;
}
