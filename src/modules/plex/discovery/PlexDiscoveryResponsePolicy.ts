import { AppErrorCode } from '../../lifecycle/types';
import { PlexApiError } from '../auth/plexAuthTransport';
import { redactUrlForLog } from '../../../utils/redact';
import { PLEX_DISCOVERY_CONSTANTS } from './constants';

export function getDiscoveryRateLimitDelayMs(response: Response): number {
    const retryAfter = response.headers.get('Retry-After');
    const parsed = retryAfter ? parseInt(retryAfter, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0
        ? Math.min(
            parsed * 1000,
            PLEX_DISCOVERY_CONSTANTS.RATE_LIMIT_MAX_DELAY_MS
        )
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
