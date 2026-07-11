import { AppErrorCode } from '../../../types/app-errors';
import { redactSensitiveTokens, safeStringifyForLog } from '../../../utils/redact';

export interface PlexLibraryErrorOptions {
    cause?: unknown;
    context?: unknown;
}

const PLEX_LIBRARY_SCOPE_SUPERSEDED_MESSAGE = 'Plex library request scope superseded';

/**
 * Signals that a library operation completed after the active server/account
 * identity moved to a newer library-local request scope.
 */
export class PlexLibraryScopeSupersededError extends Error {
    constructor() {
        super(PLEX_LIBRARY_SCOPE_SUPERSEDED_MESSAGE);
        this.name = 'PlexLibraryScopeSupersededError';
    }
}

export function isPlexLibraryScopeSupersededError(
    error: unknown
): error is PlexLibraryScopeSupersededError {
    return error instanceof PlexLibraryScopeSupersededError;
}

/**
 * Plex Library error with typed error code.
 */
export class PlexLibraryError extends Error {
    /**
     * Sanitized surrogate for the original cause. Raw throwables are intentionally
     * not forwarded to native Error.cause so token-bearing details cannot leak.
     */
    public readonly cause: unknown;
    public readonly context: unknown;

    constructor(
        public readonly code: AppErrorCode,
        message: string,
        public readonly httpStatus?: number,
        options: PlexLibraryErrorOptions = {}
    ) {
        super(message);
        this.name = 'PlexLibraryError';
        this.cause = sanitizePlexLibraryErrorValue(options.cause);
        this.context = sanitizePlexLibraryErrorValue(options.context);
    }
}

function sanitizePlexLibraryErrorValue(value: unknown): unknown {
    if (value === undefined) {
        return undefined;
    }
    if (value instanceof PlexLibraryError) {
        return {
            name: value.name,
            code: value.code,
            message: redactSensitiveTokens(value.message),
            ...(value.httpStatus !== undefined ? { httpStatus: value.httpStatus } : {}),
            ...(value.context !== undefined ? { context: value.context } : {}),
        };
    }
    if (value instanceof Error) {
        return {
            name: value.name,
            message: redactSensitiveTokens(value.message),
            ...(typeof value.stack === 'string'
                ? { stack: redactSensitiveTokens(value.stack).slice(0, 8000) }
                : {}),
        };
    }
    if (typeof value === 'string') {
        return redactSensitiveTokens(value);
    }
    if (typeof value === 'object' && value !== null) {
        return {
            summary: safeStringifyForLog(value),
        };
    }
    return value;
}
