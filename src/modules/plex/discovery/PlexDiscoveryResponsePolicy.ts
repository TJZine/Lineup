import { AppErrorCode } from '../../lifecycle/types';
import { PlexApiError } from '../auth/plexAuthTransport';
import { redactUrlForLog } from '../../../utils/redact';
import { PLEX_DISCOVERY_CONSTANTS } from './constants';

export function getDiscoveryRateLimitDelayMs(response: Response): number {
    const retryAfter = response.headers.get('Retry-After');
    const parsedSeconds = retryAfter ? Number.parseFloat(retryAfter) : NaN;
    const maxRetrySeconds = PLEX_DISCOVERY_CONSTANTS.RATE_LIMIT_MAX_DELAY_MS / 1000;
    return Number.isFinite(parsedSeconds) && parsedSeconds > 0
        ? Math.min(parsedSeconds, maxRetrySeconds) * 1000
        : PLEX_DISCOVERY_CONSTANTS.RATE_LIMIT_DEFAULT_DELAY_MS;
}

export function handleResponseError(response: Response): never {
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
    if (response.status === 429) {
        throw new PlexApiError(
            AppErrorCode.RATE_LIMITED,
            'Request failed with status 429',
            429,
            true
        );
    }
    if (response.status >= 500) {
        throw new PlexApiError(
            AppErrorCode.SERVER_UNREACHABLE,
            'Server error: ' + String(response.status),
            response.status,
            true
        );
    }
    if (response.status >= 400 && response.status < 500) {
        throw new PlexApiError(
            AppErrorCode.SERVER_UNREACHABLE,
            'Client error during server discovery: ' + String(response.status),
            response.status,
            false
        );
    }
    throw new PlexApiError(
        AppErrorCode.SERVER_UNREACHABLE,
        'Unknown error during server discovery',
        response.status,
        true
    );
}

export function redactDiscoveryUrl(url: string | undefined): string {
    if (!url) return '';
    return redactUrlForLog(url);
}
