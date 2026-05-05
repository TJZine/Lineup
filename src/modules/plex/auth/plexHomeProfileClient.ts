import { AppErrorCode } from '../../../types/app-errors';
import { PLEX_AUTH_CONSTANTS } from './constants';
import type { PlexAuthConfig, PlexHomeUser } from './interfaces';
import {
    readPlexResponse,
    parseHomeUsersPayload,
    parseSwitchResponsePayload,
} from './plexAuthPayloadParsers';
import { buildRequestHeaders, PlexApiError } from './plexAuthTransport';
import {
    createPlexHomeNetworkError,
    requestFirstSupportedHomeEndpoint,
    requestFirstSupportedHomeEndpointOrThrowReachabilityError,
} from './plexHomeEndpointClient';

interface PlexHomeProfileClientOptions {
    config: PlexAuthConfig;
    validateAccountToken: (token: string) => Promise<boolean>;
}

interface SwitchHomeUserOptions {
    userId: string;
    accountToken: string;
    pin?: string | null | undefined;
    signal?: AbortSignal | null;
}

export class PlexHomeProfileClient {
    private readonly _config: PlexAuthConfig;
    private readonly _validateAccountToken: (token: string) => Promise<boolean>;

    constructor(options: PlexHomeProfileClientOptions) {
        this._config = options.config;
        this._validateAccountToken = options.validateAccountToken;
    }

    public async getHomeUsers(
        accountToken: string,
        options?: { signal?: AbortSignal | null }
    ): Promise<PlexHomeUser[]> {
        const headers = buildRequestHeaders(this._config, accountToken);
        const endpoints = [
            PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL + PLEX_AUTH_CONSTANTS.HOME_USERS_ENDPOINT,
            PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL_V1 + PLEX_AUTH_CONSTANTS.HOME_USERS_ENDPOINT,
        ];

        let nextEndpointIndex = 0;
        let sawSuccessfulResponse = false;
        let lastError: PlexApiError | null = null;
        const init: RequestInit = {
            method: 'GET',
            headers,
        };

        while (nextEndpointIndex < endpoints.length) {
            const result = await requestFirstSupportedHomeEndpointOrThrowReachabilityError(
                endpoints.slice(nextEndpointIndex),
                init,
                options?.signal ?? null,
                'Failed to fetch Plex Home users'
            );

            if (result.kind === 'unsupported') {
                break;
            }

            const endpointIndex = nextEndpointIndex + result.endpointIndex;
            const response = result.response;

            if (response.status === 401) {
                throw new PlexApiError(
                    AppErrorCode.AUTH_REQUIRED,
                    'Unauthorized: account authentication required',
                    401,
                    false
                );
            }
            if (response.status === 403) {
                throw new PlexApiError(
                    AppErrorCode.AUTH_INVALID,
                    'Forbidden: account access denied',
                    403,
                    false
                );
            }
            if (!response.ok) {
                lastError = new PlexApiError(
                    AppErrorCode.SERVER_UNREACHABLE,
                    `Failed to fetch Plex Home users (status ${response.status})`,
                    response.status,
                    response.status >= 500
                );
                break;
            }

            const payload = await readPlexResponse(response);
            const users = parseHomeUsersPayload(payload);
            sawSuccessfulResponse = true;
            if (users.length > 0) {
                return users;
            }

            if (endpointIndex < endpoints.length - 1) {
                nextEndpointIndex = endpointIndex + 1;
                continue;
            }
            return [];
        }

        if (sawSuccessfulResponse) {
            return [];
        }

        if (lastError) {
            throw lastError;
        }

        return [];
    }

    public async requestHomeUserSwitch(options: SwitchHomeUserOptions): Promise<{ authToken: string }> {
        const { userId, accountToken } = options;
        const headers = buildRequestHeaders(this._config, accountToken);
        const pinValue = options.pin && options.pin.trim().length > 0 ? options.pin.trim() : null;
        const endpoints = [
            this._buildSwitchUrl(PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL, userId, pinValue),
            this._buildSwitchUrl(PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL_V1, userId, pinValue),
        ];

        let lastError: PlexApiError | null = null;
        let response: Response | null = null;
        let nextEndpointIndex = 0;
        const init: RequestInit = {
            method: 'POST',
            headers,
        };

        while (nextEndpointIndex < endpoints.length) {
            let pinValidationFailure: unknown = null;
            try {
                const result = await requestFirstSupportedHomeEndpoint(
                    endpoints.slice(nextEndpointIndex),
                    init,
                    options.signal ?? null
                );
                if (result.kind === 'unsupported') {
                    response = null;
                    break;
                }

                response = result.response;

                if (response.status === 401 || response.status === 403) {
                    await this._throwSwitchCredentialError(
                        response.status,
                        accountToken,
                        pinValue,
                        (error) => {
                            pinValidationFailure = error;
                        }
                    );
                }
                if (response.status === 429) {
                    throw new PlexApiError(
                        AppErrorCode.RATE_LIMITED,
                        'Rate limited by Plex API',
                        429,
                        true
                    );
                }
                if (!response.ok) {
                    lastError = new PlexApiError(
                        AppErrorCode.SERVER_UNREACHABLE,
                        `Failed to switch Plex Home user (status ${response.status})`,
                        response.status,
                        response.status >= 500
                    );
                    response = null;
                    break;
                }

                break;
            } catch (error) {
                if (options.signal?.aborted) {
                    throw error;
                }
                if (error === pinValidationFailure) {
                    throw error;
                }
                if (error instanceof PlexApiError) {
                    if (
                        error.code === AppErrorCode.AUTH_REQUIRED ||
                        error.code === AppErrorCode.AUTH_INVALID ||
                        error.code === AppErrorCode.AUTH_FAILED ||
                        error.code === AppErrorCode.PARSE_ERROR ||
                        error.code === AppErrorCode.RATE_LIMITED
                    ) {
                        throw error;
                    }
                }
                if (error instanceof PlexApiError) {
                    lastError = error;
                    break;
                } else {
                    lastError = createPlexHomeNetworkError(
                        'Failed to switch Plex Home user',
                        error
                    );
                    break;
                }
            }
        }

        if (!response) {
            if (lastError) {
                throw lastError;
            }
            throw new PlexApiError(
                AppErrorCode.RESOURCE_NOT_FOUND,
                'Plex Home switching not supported',
                undefined,
                false
            );
        }

        const payload = await readPlexResponse(response);
        return parseSwitchResponsePayload(payload);
    }

    private _buildSwitchUrl(base: string, userId: string, pinValue: string | null): string {
        const url = new URL(
            `${base}${PLEX_AUTH_CONSTANTS.HOME_USERS_ENDPOINT}/${encodeURIComponent(userId)}/switch`
        );
        if (pinValue) {
            url.searchParams.set('pin', pinValue);
        }
        return url.toString();
    }

    private async _throwSwitchCredentialError(
        status: 401 | 403,
        accountToken: string,
        pinValue: string | null,
        onValidationFailure: (error: unknown) => void
    ): Promise<never> {
        if (pinValue) {
            let stillValid = false;
            try {
                stillValid = await this._validateAccountToken(accountToken);
            } catch (error) {
                onValidationFailure(error);
                throw error;
            }
            if (stillValid) {
                throw new PlexApiError(
                    AppErrorCode.AUTH_FAILED,
                    'Incorrect PIN',
                    status,
                    false
                );
            }
        }

        if (status === 401) {
            throw new PlexApiError(
                AppErrorCode.AUTH_REQUIRED,
                'Unauthorized: account token is not valid for profile switching',
                401,
                false
            );
        }

        throw new PlexApiError(
            AppErrorCode.AUTH_INVALID,
            'Forbidden: account token is not valid for profile switching',
            403,
            false
        );
    }
}
