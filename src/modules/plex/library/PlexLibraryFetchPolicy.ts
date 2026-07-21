import { AppErrorCode } from '../../../types/app-errors';
import { redactSensitiveTokens } from '../../../utils/redact';
import { readAbortSignalReason } from '../../../utils/abortSignalReason';
import { readBoundedResponseText } from '../shared/boundedResponseText';
import { PlexApiError } from '../auth';
import { PLEX_LIBRARY_CONSTANTS } from './constants';
import { PlexLibraryError } from './PlexLibraryError';
import type { PlexLibraryConfig } from './interfaces';

type PlexLibraryLogger = NonNullable<PlexLibraryConfig['logger']>;

export type FetchResponseOutcome<T> =
    | { kind: 'success'; data: T }
    | { kind: 'authExpired' }
    | { kind: 'accessDenied' }
    | { kind: 'rateLimited'; retryAfterMs: number }
    | { kind: 'notFound' }
    | { kind: 'serverError'; status: number }
    | { kind: 'httpError'; status: number };

export type FetchErrorOutcome =
    | { kind: 'externalAbort'; error: unknown }
    | { kind: 'timeout'; error: unknown }
    | { kind: 'authOrAccessDenied'; error: PlexLibraryError }
    | { kind: 'networkFailure'; error: TypeError }
    | { kind: 'plexApiError'; error: PlexApiError }
    | { kind: 'libraryError'; error: PlexLibraryError }
    | { kind: 'unknown'; error: unknown };

function describeTopLevelJsonValue(value: unknown): string {
    if (value === null) {
        return 'null';
    }
    if (Array.isArray(value)) {
        return 'an array';
    }
    return typeof value;
}

function buildPagingHeaders(url: string): Record<string, string> {
    const pagingHeaders: Record<string, string> = {};
    try {
        const parsedUrl = new URL(url);
        const start = parsedUrl.searchParams.get('X-Plex-Container-Start');
        const size = parsedUrl.searchParams.get('X-Plex-Container-Size');
        if (start) pagingHeaders['X-Plex-Container-Start'] = start;
        if (size) pagingHeaders['X-Plex-Container-Size'] = size;
    } catch {
        // Ignore invalid URLs; fetch will surface a more actionable error.
    }
    return pagingHeaders;
}

export function buildFetchRequestInit(
    url: string,
    options: RequestInit,
    authHeaders: Record<string, string>
): RequestInit {
    const optionsWithoutSignal: RequestInit = { ...options };
    delete (optionsWithoutSignal as { signal?: AbortSignal | null }).signal;

    const pagingHeaders = buildPagingHeaders(url);
    const normalizedOptionHeaders = new Headers(options.headers);
    const requestHeaders = new Headers();

    requestHeaders.set('Accept', 'application/json');
    for (const [key, value] of Object.entries(authHeaders)) {
        requestHeaders.set(key, value);
    }
    for (const [key, value] of Object.entries(pagingHeaders)) {
        requestHeaders.set(key, value);
    }
    for (const [key, value] of normalizedOptionHeaders.entries()) {
        requestHeaders.set(key, value);
    }

    return {
        ...optionsWithoutSignal,
        headers: requestHeaders,
    };
}

function parseRetryAfterDelayMs(retryAfterHeader: string | null): number {
    if (!retryAfterHeader) {
        return PLEX_LIBRARY_CONSTANTS.DEFAULT_RATE_LIMIT_DELAY * 1000;
    }

    const parsed = parseInt(retryAfterHeader, 10);
    if (!isNaN(parsed)) {
        return Math.min(
            PLEX_LIBRARY_CONSTANTS.MAX_RATE_LIMIT_DELAY_MS,
            Math.max(0, parsed) * 1000
        );
    }

    const date = Date.parse(retryAfterHeader);
    if (!isNaN(date)) {
        return Math.min(
            PLEX_LIBRARY_CONSTANTS.MAX_RATE_LIMIT_DELAY_MS,
            Math.max(0, Math.ceil((date - Date.now()) / 1000)) * 1000
        );
    }

    return PLEX_LIBRARY_CONSTANTS.DEFAULT_RATE_LIMIT_DELAY * 1000;
}

async function parseJsonResponse<T>(
    response: Response,
    url: string,
    logger: PlexLibraryLogger,
    redactUrl: (url: string) => string,
    signal: AbortSignal
): Promise<T> {
    let text = '';
    try {
        text = await readBoundedResponseText(response, {
            maxBytes: PLEX_LIBRARY_CONSTANTS.MAX_RESPONSE_BODY_BYTES,
            signal,
        });

        if (!text || text.trim() === '') {
            throw new PlexLibraryError(
                AppErrorCode.PARSE_ERROR,
                `Empty response body from ${redactUrl(url)}`
            );
        }

        const data = JSON.parse(text) as T;

        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            throw new PlexLibraryError(
                AppErrorCode.PARSE_ERROR,
                `Invalid JSON response from ${redactUrl(url)}: expected a top-level JSON object but received ${describeTopLevelJsonValue(data)}`
            );
        }

        return data;
    } catch (parseError) {
        if (signal.aborted) {
            throw readAbortSignalReason(signal);
        }
        const responseBodySnippet = redactSensitiveTokens(text.substring(0, 500));
        logger.error(
            `[PlexLibrary] Parse error for ${redactUrl(url)}:`,
            parseError,
            `Response body: ${responseBodySnippet}`
        );

        if (parseError instanceof PlexLibraryError) {
            throw parseError;
        }

        const message = parseError instanceof Error ? parseError.message : String(parseError);
        throw new PlexLibraryError(
            AppErrorCode.PARSE_ERROR,
            `Invalid JSON response from ${redactUrl(url)}: ${message}`,
            undefined,
            {
                cause: parseError,
                context: {
                    url: redactUrl(url),
                    responseBodySnippet,
                },
            }
        );
    }
}

export async function classifyFetchResponse<T>(
    response: Response,
    url: string,
    logger: PlexLibraryLogger,
    redactUrl: (url: string) => string,
    signal: AbortSignal
): Promise<FetchResponseOutcome<T>> {
    if (response.status === 401) {
        return { kind: 'authExpired' };
    }
    if (response.status === 403) {
        return { kind: 'accessDenied' };
    }
    if (response.status === 429) {
        return {
            kind: 'rateLimited',
            retryAfterMs: parseRetryAfterDelayMs(response.headers.get('Retry-After')),
        };
    }
    if (response.status === 404) {
        return { kind: 'notFound' };
    }
    if (response.status >= 500) {
        return { kind: 'serverError', status: response.status };
    }
    if (!response.ok) {
        return { kind: 'httpError', status: response.status };
    }
    return {
        kind: 'success',
        data: await parseJsonResponse<T>(response, url, logger, redactUrl, signal),
    };
}

function getErrorName(error: unknown): string {
    return typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        typeof (error as { name?: unknown }).name === 'string'
        ? (error as { name: string }).name
        : '';
}

export function classifyFetchError(
    error: unknown,
    externalAborted: boolean,
    externalSignal: AbortSignal | null
): FetchErrorOutcome {
    if (externalAborted || externalSignal?.aborted) {
        return { kind: 'externalAbort', error };
    }
    if (getErrorName(error) === 'AbortError') {
        return { kind: 'timeout', error };
    }
    if (
        error instanceof PlexLibraryError &&
        (error.code === AppErrorCode.AUTH_EXPIRED ||
            error.code === AppErrorCode.ACCESS_DENIED)
    ) {
        return { kind: 'authOrAccessDenied', error };
    }
    if (error instanceof TypeError) {
        return { kind: 'networkFailure', error };
    }
    if (error instanceof PlexApiError) {
        return { kind: 'plexApiError', error };
    }
    if (error instanceof PlexLibraryError) {
        return { kind: 'libraryError', error };
    }
    return { kind: 'unknown', error };
}
