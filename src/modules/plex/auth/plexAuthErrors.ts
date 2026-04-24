import { AppErrorCode, type AppError } from '../../lifecycle/types';

const PLEX_AUTH_RECOVERABLE_CODES: ReadonlySet<AppErrorCode> = new Set([
    AppErrorCode.AUTH_REQUIRED,
    AppErrorCode.AUTH_INVALID,
    AppErrorCode.AUTH_EXPIRED,
]);

export function isPlexAuthRecoverable(error: unknown): error is AppError {
    const code = typeof error === 'object' && error !== null
        ? (error as { code?: unknown }).code
        : undefined;

    return PLEX_AUTH_RECOVERABLE_CODES.has(code as AppErrorCode);
}
