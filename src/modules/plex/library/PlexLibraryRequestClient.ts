import { AppErrorCode } from '../../../types/app-errors';
import { redactSensitiveTokens, redactUrlForLog } from '../../../utils/redact';
import { fetchWithTimeout } from '../shared/fetchWithTimeout';
import type { PlexLibraryConfig, PlexLibraryRequestIntent } from './interfaces';
import { PLEX_LIBRARY_CONSTANTS } from './constants';
import { PlexLibraryError } from './PlexLibraryError';
import {
    buildFetchRequestInit,
    classifyFetchError,
    classifyFetchResponse,
} from './PlexLibraryFetchPolicy';

const INTERACTIVE_REQUEST_POLICY = {
    timeoutMs: 5000,
    timeoutRetryDelays: [1000] as const,
} as const;

export type PlexLibraryRequestProfile = 'default' | 'interactive';

type PlexLibraryLogger = NonNullable<PlexLibraryConfig['logger']>;

interface PlexLibraryRequestPolicy {
    timeoutMs: number;
    timeoutRetryDelays: readonly number[];
    maxTimeoutRetries: number;
}

interface PlexLibraryRequestClientDeps {
    config: PlexLibraryConfig;
    logger: PlexLibraryLogger;
    emitAuthExpired: () => void;
}

export const resolveRequestProfileForIntent = (
    intent: PlexLibraryRequestIntent | undefined
): PlexLibraryRequestProfile => (intent === 'preview' ? 'interactive' : 'default');

function resolveRequestPolicy(profile: PlexLibraryRequestProfile = 'default'): PlexLibraryRequestPolicy {
    if (profile === 'interactive') {
        return {
            timeoutMs: INTERACTIVE_REQUEST_POLICY.timeoutMs,
            timeoutRetryDelays: INTERACTIVE_REQUEST_POLICY.timeoutRetryDelays,
            maxTimeoutRetries: INTERACTIVE_REQUEST_POLICY.timeoutRetryDelays.length,
        };
    }
    return {
        timeoutMs: PLEX_LIBRARY_CONSTANTS.REQUEST_TIMEOUT_MS,
        timeoutRetryDelays: PLEX_LIBRARY_CONSTANTS.TIMEOUT_RETRY_DELAYS,
        maxTimeoutRetries: PLEX_LIBRARY_CONSTANTS.MAX_TIMEOUT_RETRIES,
    };
}

export class PlexLibraryRequestClient {
    private readonly _config: PlexLibraryConfig;
    private readonly _logger: PlexLibraryLogger;
    private readonly _emitAuthExpired: () => void;

    constructor(deps: PlexLibraryRequestClientDeps) {
        this._config = deps.config;
        this._logger = deps.logger;
        this._emitAuthExpired = deps.emitAuthExpired;
    }

    async fetchWithRetry<T>(
        url: string,
        options: RequestInit = {},
        requestProfile: PlexLibraryRequestProfile = 'default'
    ): Promise<T | null> {
        const requestPolicy = resolveRequestPolicy(requestProfile);
        let timeoutRetries = 0;
        let serverErrorRetried = false;
        let rateLimitRetries = 0;

        while (true) {
            let externalAborted = false;
            const externalSignal = options.signal ?? null;
            try {
                const onExternalAbort = (): void => {
                    externalAborted = true;
                };
                if (externalSignal) {
                    if (externalSignal.aborted) {
                        externalAborted = true;
                    }
                    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
                }

                let response: Response;
                try {
                    response = await fetchWithTimeout({
                        url,
                        init: buildFetchRequestInit(url, options, this._config.getAuthHeaders()),
                        timeoutMs: requestPolicy.timeoutMs,
                        upstreamSignal: externalSignal,
                    });
                } finally {
                    externalSignal?.removeEventListener('abort', onExternalAbort);
                }

                const responseOutcome = await classifyFetchResponse<T>(
                    response,
                    url,
                    this._logger,
                    redactUrlForLog
                );

                switch (responseOutcome.kind) {
                    case 'success':
                        return responseOutcome.data;
                    case 'authExpired':
                        this._emitAuthExpired();
                        throw new PlexLibraryError(
                            AppErrorCode.AUTH_EXPIRED,
                            'Authentication expired',
                            401
                        );
                    case 'accessDenied':
                        throw new PlexLibraryError(
                            AppErrorCode.ACCESS_DENIED,
                            `Access denied: profile does not have permission for this resource (403)`,
                            403
                        );
                    case 'rateLimited':
                        if (rateLimitRetries >= requestPolicy.maxTimeoutRetries) {
                            throw new PlexLibraryError(
                                AppErrorCode.RATE_LIMITED,
                                'Rate limited after max retries',
                                429
                            );
                        }
                        rateLimitRetries++;
                        await this._delay(responseOutcome.retryAfterMs);
                        continue;
                    case 'notFound':
                        this._logger.warn(`[PlexLibrary] 404 Not Found: ${redactUrlForLog(url)}`);
                        return null;
                    case 'serverError':
                        if (!serverErrorRetried) {
                            serverErrorRetried = true;
                            this._logger.warn(`[PlexLibrary] Server error ${responseOutcome.status}, retrying after 2s...`);
                            await this._delay(PLEX_LIBRARY_CONSTANTS.SERVER_ERROR_RETRY_DELAY);
                            continue;
                        }
                        throw new PlexLibraryError(
                            AppErrorCode.SERVER_ERROR,
                            `HTTP ${responseOutcome.status}`,
                            responseOutcome.status
                        );
                    case 'httpError':
                        throw new PlexLibraryError(
                            AppErrorCode.SERVER_ERROR,
                            `HTTP ${responseOutcome.status}`,
                            responseOutcome.status
                        );
                }
            } catch (error) {
                const errorOutcome = classifyFetchError(error, externalAborted, options.signal ?? null);

                switch (errorOutcome.kind) {
                    case 'externalAbort':
                        throw errorOutcome.error;
                    case 'timeout':
                        if (timeoutRetries < requestPolicy.maxTimeoutRetries) {
                            const delay =
                                requestPolicy.timeoutRetryDelays[timeoutRetries]
                                ?? requestPolicy.timeoutRetryDelays[requestPolicy.timeoutRetryDelays.length - 1]
                                ?? 4000;
                            this._logger.warn(`[PlexLibrary] Network timeout, retry ${timeoutRetries + 1}/${requestPolicy.maxTimeoutRetries} after ${delay}ms`);
                            timeoutRetries++;
                            await this._delay(delay);
                            continue;
                        }
                        throw new PlexLibraryError(
                            AppErrorCode.NETWORK_TIMEOUT,
                            'Network timeout after max retries',
                            undefined,
                            {
                                cause: errorOutcome.error,
                                context: { url: redactUrlForLog(url) },
                            }
                        );
                    case 'authOrAccessDenied':
                    case 'libraryError':
                        throw errorOutcome.error;
                    case 'networkFailure':
                        this._config.onServerUnreachable?.();
                        throw new PlexLibraryError(
                            AppErrorCode.SERVER_UNREACHABLE,
                            redactSensitiveTokens(errorOutcome.error.message),
                            undefined,
                            {
                                cause: errorOutcome.error,
                                context: { url: redactUrlForLog(url) },
                            }
                        );
                    case 'unknown':
                        this._config.onServerUnreachable?.();
                        throw new PlexLibraryError(
                            AppErrorCode.SERVER_UNREACHABLE,
                            errorOutcome.error instanceof Error
                                ? redactSensitiveTokens(errorOutcome.error.message)
                                : 'Unknown error',
                            undefined,
                            {
                                cause: errorOutcome.error,
                                context: { url: redactUrlForLog(url) },
                            }
                        );
                }
            }
        }
    }

    private _delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
