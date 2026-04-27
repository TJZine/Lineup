import { PLEX_AUTH_CONSTANTS } from './constants';
import type { PlexAuthConfig } from './interfaces';
import { AppErrorCode } from '../../lifecycle/types';
import { redactSensitiveTokens, safeStringifyForLog } from '../../../utils/redact';

/**
 * Error class for Plex API errors.
 */
export class PlexApiError extends Error {
    public readonly code: AppErrorCode;
    public readonly httpStatus: number | undefined;
    public readonly retryable: boolean;
    /**
     * Sanitized surrogate for the original cause. Raw throwables are intentionally
     * not forwarded to `super(message, { cause })` so token-bearing details do not
     * leak through native Error.cause consumers.
     */
    public readonly cause: unknown;

    constructor(
        code: AppErrorCode,
        message: string,
        httpStatus?: number,
        retryable: boolean = false,
        cause?: unknown
    ) {
        super(message);
        this.name = 'PlexApiError';
        this.code = code;
        this.httpStatus = httpStatus;
        this.retryable = retryable;
        this.cause = sanitizePlexApiErrorCause(cause);
    }
}

export function createPlexServiceError(status: number): PlexApiError {
    return new PlexApiError(
        AppErrorCode.SERVER_ERROR,
        'Plex service error: ' + String(status),
        status,
        true
    );
}

function sanitizePlexApiErrorCause(cause: unknown): unknown {
    if (cause === undefined) {
        return undefined;
    }
    if (cause instanceof Error) {
        return {
            name: cause.name,
            message: redactSensitiveTokens(cause.message),
            ...(typeof cause.stack === 'string'
                ? { stack: redactSensitiveTokens(cause.stack).slice(0, 8000) }
                : {}),
        };
    }
    if (typeof cause === 'string') {
        return redactSensitiveTokens(cause);
    }
    if (typeof cause === 'object' && cause !== null) {
        return {
            summary: safeStringifyForLog(cause),
        };
    }
    return cause;
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
        throw createPlexServiceError(response.status);
    }
}

function createNetworkError(cause?: unknown): PlexApiError {
    return new PlexApiError(
        AppErrorCode.SERVER_UNREACHABLE,
        'Network error',
        undefined,
        true,
        cause
    );
}

function isAbortError(error: unknown): error is Error {
    return (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        (error as { name?: unknown }).name === 'AbortError'
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
    const externalSignal = options.signal ?? null;

    for (let attempt = 0; attempt < PLEX_AUTH_CONSTANTS.RETRY_ATTEMPTS; attempt++) {
        try {
            const controller = new AbortController();
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
            if (externalSignal?.aborted && isAbortError(error)) {
                throw error;
            }
            if (error instanceof PlexApiError && !error.retryable) {
                throw error;
            }
            lastError = error instanceof PlexApiError ? error : createNetworkError(error);

            if (attempt < PLEX_AUTH_CONSTANTS.RETRY_ATTEMPTS - 1) {
                await sleep(delay);
                delay = delay * 2;
            }
        }
    }
    throw lastError;
}
