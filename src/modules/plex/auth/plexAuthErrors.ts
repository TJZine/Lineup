import { AppErrorCode } from '../../../types/app-errors';

const PLEX_AUTH_RECOVERABLE_CODES: ReadonlySet<AppErrorCode> = new Set([
    AppErrorCode.AUTH_REQUIRED,
    AppErrorCode.AUTH_INVALID,
    AppErrorCode.AUTH_EXPIRED,
]);

type PlexAuthRecoverableError = { code: AppErrorCode };

export function isPlexAuthRecoverable(error: unknown): error is PlexAuthRecoverableError {
    if (!error || typeof error !== 'object' || Array.isArray(error)) {
        return false;
    }

    const code = (error as { code?: unknown }).code;
    return PLEX_AUTH_RECOVERABLE_CODES.has(code as AppErrorCode);
}
