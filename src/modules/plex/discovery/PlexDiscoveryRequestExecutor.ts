import { AppErrorCode } from '../../../types/app-errors';
import { PlexApiError } from '../auth/plexAuthTransport';
import { redactSensitiveTokens } from '../../../utils/redact';
import { PLEX_DISCOVERY_CONSTANTS } from './constants';
import { buildDiscoveryFetchVariants, type DiscoveryFetchVariant } from './PlexDiscoveryFetchVariants';
import { readAbortReason, throwIfAborted, throwIfCallerAbort } from './PlexDiscoveryAbort';
import {
    getDiscoveryRateLimitDelayMs,
    handleResponseError,
    redactDiscoveryUrl,
} from './PlexDiscoveryResponsePolicy';

type DiscoveryAttemptOutcome =
    | { kind: 'response'; response: Response; lastUrl: string }
    | { kind: 'rateLimited'; response: Response; delayMs: number; lastUrl: string }
    | { kind: 'retryableServerFailure'; response: Response; error: Error; lastUrl: string }
    | { kind: 'exhaustedWithError'; error: unknown; lastUrl: string };

export async function fetchDiscoveryResponse(
    headers: Record<string, string>,
    onAttemptUrl: (url: string) => void,
    options?: { signal?: AbortSignal | null }
): Promise<Response> {
    const variants = buildDiscoveryFetchVariants(headers);
    const maxAttempts = PLEX_DISCOVERY_CONSTANTS.MAX_DISCOVERY_ATTEMPTS;
    let response: Response | null = null;
    let lastError: unknown = null;
    let lastNonOkResponse: Response | null = null;
    let lastUrl = '';

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        throwIfAborted(options?.signal ?? null);
        const outcome = await fetchDiscoveryAttempt(
            variants,
            onAttemptUrl,
            attempt < maxAttempts - 1,
            options?.signal ?? null
        );
        lastUrl = outcome.lastUrl || lastUrl;

        switch (outcome.kind) {
            case 'response':
                response = outcome.response;
                break;
            case 'rateLimited':
                await delay(outcome.delayMs, options?.signal ?? null);
                continue;
            case 'retryableServerFailure':
                lastNonOkResponse = outcome.response;
                lastError = outcome.error;
                if (attempt < maxAttempts - 1) {
                    await delay(PLEX_DISCOVERY_CONSTANTS.DISCOVERY_RETRY_BACKOFF_MS, options?.signal ?? null);
                }
                continue;
            case 'exhaustedWithError':
                lastError = outcome.error;
                continue;
        }

        break;
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

async function fetchDiscoveryAttempt(
    variants: DiscoveryFetchVariant[],
    onAttemptUrl: (url: string) => void,
    canRetryRateLimit: boolean,
    signal: AbortSignal | null
): Promise<DiscoveryAttemptOutcome> {
    let lastError: unknown = null;
    let lastNonOkResponse: Response | null = null;
    let lastUrl = '';

    for (const variant of variants) {
        lastUrl = variant.url;
        onAttemptUrl(lastUrl);

        let receivedResponse: Response;
        try {
            receivedResponse = await fetchDiscoveryVariant(variant, signal);
        } catch (error) {
            throwIfCallerAbort(error, signal);
            lastError = error;
            continue;
        }

        if (receivedResponse.status === 429 && canRetryRateLimit) {
            return {
                kind: 'rateLimited',
                response: receivedResponse,
                delayMs: getDiscoveryRateLimitDelayMs(receivedResponse),
                lastUrl,
            };
        }

        if (receivedResponse.status >= 500 && receivedResponse.status <= 599) {
            lastNonOkResponse = receivedResponse;
            lastError = new Error(`Request failed with status ${receivedResponse.status}`);
            continue;
        }

        return { kind: 'response', response: receivedResponse, lastUrl };
    }

    if (lastNonOkResponse) {
        return {
            kind: 'retryableServerFailure',
            response: lastNonOkResponse,
            error: lastError instanceof Error
                ? lastError
                : new Error(`Request failed with status ${lastNonOkResponse.status}`),
            lastUrl,
        };
    }

    return { kind: 'exhaustedWithError', error: lastError, lastUrl };
}

async function fetchDiscoveryVariant(variant: DiscoveryFetchVariant, upstreamSignal: AbortSignal | null): Promise<Response> {
    const controller = new AbortController();
    const abortFromUpstream = (): void => {
        controller.abort(upstreamSignal?.reason);
    };
    const timeoutId = setTimeout(
        () => controller.abort(),
        PLEX_DISCOVERY_CONSTANTS.DISCOVERY_TIMEOUT_MS
    );
    try {
        if (upstreamSignal) {
            if (upstreamSignal.aborted) {
                abortFromUpstream();
            } else {
                upstreamSignal.addEventListener('abort', abortFromUpstream, { once: true });
            }
        }
        const init: RequestInit = {
            method: 'GET',
            signal: controller.signal,
        };
        if (variant.headers) {
            init.headers = variant.headers;
        }
        return await fetch(variant.url, init);
    } finally {
        upstreamSignal?.removeEventListener('abort', abortFromUpstream);
        clearTimeout(timeoutId);
    }
}

function delay(ms: number, signal: AbortSignal | null): Promise<void> {
    if (!signal) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
    if (signal.aborted) {
        return Promise.reject(readAbortReason(signal));
    }
    return new Promise((resolve, reject) => {
        const onAbort = (): void => {
            clearTimeout(timeoutId);
            reject(readAbortReason(signal));
        };
        const timeoutId = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        signal.addEventListener('abort', onAbort, { once: true });
    });
}
