import { AppErrorCode } from '../../lifecycle/types';
import { PlexApiError } from '../auth/plexAuthTransport';
import { redactUrlForLog } from '../../../utils/redact';
import { PLEX_DISCOVERY_CONSTANTS } from './constants';

const NUMERIC_RETRY_AFTER_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

export function getDiscoveryRateLimitDelayMs(response: Response): number {
    const retryAfter = response.headers.get('Retry-After');
    if (!retryAfter) {
        return PLEX_DISCOVERY_CONSTANTS.RATE_LIMIT_DEFAULT_DELAY_MS;
    }

    const delayMs = parseRetryAfterDelayMs(retryAfter);
    if (!Number.isFinite(delayMs) || delayMs <= 0) {
        return PLEX_DISCOVERY_CONSTANTS.RATE_LIMIT_DEFAULT_DELAY_MS;
    }

    return Math.min(delayMs, PLEX_DISCOVERY_CONSTANTS.RATE_LIMIT_MAX_DELAY_MS);
}

function parseRetryAfterDelayMs(retryAfter: string): number {
    const trimmed = retryAfter.trim();
    if (NUMERIC_RETRY_AFTER_PATTERN.test(trimmed)) {
        return Number.parseFloat(trimmed) * 1000;
    }

    const parsedDateMs = Date.parse(trimmed);
    if (!Number.isFinite(parsedDateMs)) {
        return NaN;
    }

    return Math.max(0, parsedDateMs - Date.now());
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
    if (response.status === 404) {
        throw new PlexApiError(
            AppErrorCode.RESOURCE_NOT_FOUND,
            'Discovery resource not found: ' + String(response.status),
            response.status,
            false
        );
    }
    if (response.status >= 400 && response.status < 500) {
        throw new PlexApiError(
            AppErrorCode.SERVER_ERROR,
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
