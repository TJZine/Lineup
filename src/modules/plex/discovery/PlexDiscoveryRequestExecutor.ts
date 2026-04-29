import { AppErrorCode } from '../../../types/app-errors';
import { PlexApiError } from '../auth/plexAuthTransport';
import { redactSensitiveTokens } from '../../../utils/redact';
import { PLEX_DISCOVERY_CONSTANTS } from './constants';
import { buildDiscoveryFetchVariants } from './PlexDiscoveryFetchVariants';
import {
    getDiscoveryRateLimitDelayMs,
    handleResponseError,
    redactDiscoveryUrl,
} from './PlexDiscoveryResponsePolicy';

export async function fetchDiscoveryResponse(
    headers: Record<string, string>,
    onAttemptUrl: (url: string) => void
): Promise<Response> {
    const variants = buildDiscoveryFetchVariants(headers);
    const maxAttempts = PLEX_DISCOVERY_CONSTANTS.MAX_DISCOVERY_ATTEMPTS;
    let response: Response | null = null;
    let lastError: unknown = null;
    let lastNonOkResponse: Response | null = null;
    let lastUrl = '';

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let retryScheduled = false;
        for (const variant of variants) {
            const controller = new AbortController();
            const timeoutId = setTimeout(
                () => controller.abort(),
                PLEX_DISCOVERY_CONSTANTS.DISCOVERY_TIMEOUT_MS
            );
            try {
                lastUrl = variant.url;
                onAttemptUrl(lastUrl);
                const init: RequestInit = {
                    method: 'GET',
                    signal: controller.signal,
                };
                if (variant.headers) {
                    init.headers = variant.headers;
                }
                response = await fetch(variant.url, init);
            } catch (error) {
                lastError = error;
                continue;
            } finally {
                clearTimeout(timeoutId);
            }

            const receivedResponse = response;

            if (receivedResponse.status === 429 && attempt < maxAttempts - 1) {
                await new Promise((resolve) => setTimeout(resolve, getDiscoveryRateLimitDelayMs(receivedResponse)));
                response = null;
                retryScheduled = true;
                break;
            }

            if (receivedResponse.status >= 500 && receivedResponse.status <= 599) {
                lastNonOkResponse = receivedResponse;
                lastError = new Error(`Request failed with status ${receivedResponse.status}`);
                response = null;
                continue;
            }

            break;
        }

        if (response) {
            break;
        }
        if (retryScheduled) {
            continue;
        }
        if (lastNonOkResponse && attempt < maxAttempts - 1) {
            await new Promise((resolve) => {
                setTimeout(resolve, PLEX_DISCOVERY_CONSTANTS.DISCOVERY_RETRY_BACKOFF_MS);
            });
        }
    }

    if (!response) {
        if (lastNonOkResponse) {
            handleResponseError(lastNonOkResponse);
        }
        const message = redactSensitiveTokens(
            lastError instanceof Error
                ? lastError.message
                : 'unknown error'
        );
        throw new PlexApiError(
            AppErrorCode.SERVER_UNREACHABLE,
            `Failed to discover servers: ${message} (last url: ${redactDiscoveryUrl(lastUrl) || 'unknown'})`,
            undefined,
            true,
            lastError
        );
    }
    if (!response.ok) {
        handleResponseError(response);
    }

    return response;
}
