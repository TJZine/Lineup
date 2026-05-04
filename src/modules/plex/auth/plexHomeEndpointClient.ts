import { AppErrorCode } from '../../../types/app-errors';
import { PLEX_AUTH_CONSTANTS } from './constants';
import { PlexApiError } from './plexAuthTransport';
import { fetchWithTimeout } from '../shared/fetchWithTimeout';

export type PlexHomeEndpointResult =
    | { kind: 'response'; response: Response; endpointIndex: number }
    | { kind: 'unsupported' };

export function createPlexHomeNetworkError(message: string, cause?: unknown): PlexApiError {
    return new PlexApiError(
        AppErrorCode.SERVER_UNREACHABLE,
        message,
        undefined,
        true,
        sanitizePlexHomeErrorCause(cause)
    );
}

export function shouldTryNextPlexHomeEndpoint(response: Response): boolean {
    return (
        response.status === 404 ||
        response.status === 405 ||
        (!response.ok && response.status !== 401 && response.status !== 403)
    );
}

export async function requestFirstSupportedHomeEndpointOrThrowReachabilityError(
    endpoints: string[],
    init: RequestInit,
    signal: AbortSignal | null,
    networkErrorMessage: string
): Promise<PlexHomeEndpointResult> {
    try {
        return await requestFirstSupportedHomeEndpoint(endpoints, init, signal);
    } catch (error) {
        if (signal?.aborted) {
            throw error;
        }
        if (error instanceof PlexApiError) {
            throw error;
        }
        throw createPlexHomeNetworkError(networkErrorMessage, error);
    }
}

export async function requestFirstSupportedHomeEndpoint(
    endpoints: string[],
    init: RequestInit,
    signal: AbortSignal | null
): Promise<PlexHomeEndpointResult> {
    let lastError: unknown = null;
    let lastRetryableResponse: Response | null = null;
    for (let index = 0; index < endpoints.length; index++) {
        const url = endpoints[index];
        if (!url) {
            continue;
        }
        try {
            throwIfAborted(signal);
            const response = await fetchWithTimeout({
                url,
                init,
                timeoutMs: PLEX_AUTH_CONSTANTS.REQUEST_TIMEOUT_MS,
                upstreamSignal: signal ?? null,
            });
            throwIfAborted(signal);

            if (shouldTryNextPlexHomeEndpoint(response)) {
                if (response.status === 404 || response.status === 405) {
                    continue;
                }

                lastRetryableResponse = response;
                lastError = null;
                continue;
            }
            return { kind: 'response', response, endpointIndex: index };
        } catch (error) {
            if (signal?.aborted) {
                throw error;
            }
            lastError = error;
        }
    }

    if (lastError !== null) {
        throw lastError;
    }

    if (lastRetryableResponse) {
        return {
            kind: 'response',
            response: lastRetryableResponse,
            endpointIndex: endpoints.length - 1,
        };
    }

    return { kind: 'unsupported' };
}

function throwIfAborted(signal: AbortSignal | null | undefined): void {
    if (!signal?.aborted) {
        return;
    }
    throw signal.reason ?? new DOMException('Aborted', 'AbortError');
}

function sanitizePlexHomeErrorCause(cause: unknown): unknown {
    if (cause instanceof Error) {
        const sanitized = new Error(redactPlexHomePin(cause.message));
        sanitized.name = cause.name;
        if (typeof cause.stack === 'string') {
            sanitized.stack = redactPlexHomePin(cause.stack);
        }
        return sanitized;
    }
    if (typeof cause === 'string') {
        return redactPlexHomePin(cause);
    }
    if (typeof cause === 'object' && cause !== null) {
        return sanitizePlexHomeObjectCause(cause);
    }
    return cause;
}

function sanitizePlexHomeObjectCause(
    value: object,
    seen: WeakSet<object> = new WeakSet()
): unknown {
    if (seen.has(value)) {
        return '[Circular]';
    }
    seen.add(value);

    if (value instanceof Error) {
        return {
            name: value.name,
            message: redactPlexHomePin(value.message),
            ...(typeof value.stack === 'string'
                ? { stack: redactPlexHomePin(value.stack) }
                : {}),
        };
    }

    if (Array.isArray(value)) {
        return value.map((item) => sanitizePlexHomeCauseValue(item, seen));
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
        sanitized[key] = isPlexHomePinKey(key)
            ? sanitizePlexHomePinField(child, seen)
            : sanitizePlexHomeCauseValue(child, seen);
    }
    return sanitized;
}

function isPlexHomePinKey(key: string): boolean {
    return key.toLowerCase() === 'pin';
}

function sanitizePlexHomePinField(value: unknown, seen: WeakSet<object>): unknown {
    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value === 'object') {
        return sanitizePlexHomeObjectCause(value, seen);
    }
    return 'REDACTED';
}

function sanitizePlexHomeCauseValue(value: unknown, seen: WeakSet<object>): unknown {
    if (typeof value === 'string') {
        return redactPlexHomePin(value);
    }
    if (typeof value === 'object' && value !== null) {
        return sanitizePlexHomeObjectCause(value, seen);
    }
    return value;
}

function redactPlexHomePin(value: string): string {
    return value.replace(/([?&]pin=)[^&#\s)'"<>]+/gi, '$1REDACTED');
}
