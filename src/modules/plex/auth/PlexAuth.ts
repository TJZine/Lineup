/**
 * @fileoverview Plex Authentication implementation.
 * Handles PIN-based OAuth flow, token storage, and credential management.
 * @module modules/plex/auth/PlexAuth
 * @version 1.1.0
 */

import { EventEmitter } from '../../../utils/EventEmitter';
import { IDisposable } from '../../../utils/interfaces';
import {
    safeLocalStorageGet,
    safeLocalStorageRemove,
    safeLocalStorageSet,
} from '../../../utils/storage';
import { PLEX_AUTH_CONSTANTS } from './constants';
import {
    IPlexAuth,
    PlexAuthConfig,
    PlexAuthEvents,
    PlexAuthToken,
    PlexAuthData,
    PlexStoredCredentialsReadResult,
    PlexStoredCredentialsReadCorruptionReason,
    PlexHomeUser,
    PlexPinRequest,
    PlexAuthState,
    PlexDeviceKey,
    StoredAuthData,
} from './interfaces';
import {
    PlexApiError,
    buildRequestHeaders,
    fetchWithRetry,
} from './plexAuthTransport';
import {
    readPlexResponse,
    parsePinResponse,
    parseUserResponse,
    parseHomeUsersPayload,
    parseSwitchResponsePayload,
} from './plexAuthPayloadParsers';
import { AppErrorCode } from '../../lifecycle/types';
import { fetchWithTimeout } from '../shared/fetchWithTimeout';

// Re-export for consumers
export { PlexApiError } from './plexAuthTransport';
export { AppErrorCode } from '../../lifecycle/types';

/**
 * Plex Authentication implementation.
 * Handles PIN-based OAuth flow, token storage, and credential lifecycle.
 * @implements {IPlexAuth}
 */
export class PlexAuth implements IPlexAuth {
    private _state: PlexAuthState;
    private _emitter: EventEmitter<PlexAuthEvents>;
    private _credentialsEpoch = 0;
    private _bootStoredCredentialsCorruption: {
        kind: 'corrupted';
        reason: PlexStoredCredentialsReadCorruptionReason;
    } | null = null;

    private isValidUserPayload(payload: unknown): payload is Record<string, unknown> {
        if (typeof payload !== 'object' || payload === null) return false;
        const data = payload as Record<string, unknown>;
        const id = data['id'];
        const username = data['username'];
        const email = data['email'];
        const hasValidId = typeof id === 'string' || typeof id === 'number';
        return hasValidId && typeof username === 'string' && typeof email === 'string';
    }

    /**
     * Create a new PlexAuth instance.
     * @param config - Plex API client identification config
     */
    constructor(config: PlexAuthConfig) {
        this._emitter = new EventEmitter<PlexAuthEvents>();
        this._state = {
            config,
            accountToken: null,
            activeToken: null,
            activeUserId: null,
            isValidated: false,
            pendingPin: null,
        };
        this._loadStoredCredentials();
    }

    // ========================================
    // PIN-based OAuth flow
    // ========================================

    /**
     * Initiate Plex OAuth flow by requesting a PIN code.
     * @returns PIN request containing code for user display (length varies)
     * @throws {PlexApiError} On connection failure or rate limiting
     */
    public async requestPin(): Promise<PlexPinRequest> {
        const url = PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL +
            PLEX_AUTH_CONSTANTS.PIN_ENDPOINT;
        const headers = buildRequestHeaders(this._state.config);

        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: headers,
        });

        const data = await response.json();
        const pin = parsePinResponse(data, this._state.config.clientIdentifier);
        this._state.pendingPin = pin;
        return pin;
    }

    /**
     * Check if user has claimed the PIN via the Plex auth app.
     * @param pinId - PIN ID from requestPin()
     * @returns Updated PIN request with authToken if claimed
     * @throws {PlexApiError} If PIN doesn't exist or on connection failure
     */
    public async checkPinStatus(pinId: number): Promise<PlexPinRequest> {
        const url = PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL +
            PLEX_AUTH_CONSTANTS.PIN_ENDPOINT + '/' + String(pinId);
        const headers = buildRequestHeaders(this._state.config);

        const response = await fetchWithRetry(url, {
            method: 'GET',
            headers: headers,
        });

        const data = await response.json();
        const pin = parsePinResponse(data, this._state.config.clientIdentifier);

        if (pin.authToken !== null) {
            const userToken = await this._fetchUserProfile(pin.authToken);
            await this.storeCredentials({
                accountToken: userToken,
                activeToken: userToken,
                activeUserId: userToken.userId,
                selectedServerByUserId: {
                    [userToken.userId]: { serverId: null, serverUri: null },
                },
            });
        }
        return pin;
    }

    /**
     * Poll for PIN status until claimed or timeout.
     * @param pinId - PIN ID from requestPin()
     * @returns Updated PIN request with authToken when claimed
     * @throws {PlexApiError} If PIN expires or on connection failure
     */
    public async pollForPin(pinId: number): Promise<PlexPinRequest> {
        const startTime = Date.now();
        const timeout = PLEX_AUTH_CONSTANTS.PIN_TIMEOUT_MS;
        const interval = PLEX_AUTH_CONSTANTS.PIN_POLL_INTERVAL_MS;

        while (Date.now() - startTime < timeout) {
            try {
                const pin = await this.checkPinStatus(pinId);
                if (pin.authToken !== null) {
                    return pin;
                }
            } catch (error) {
                if (error instanceof PlexApiError && !error.retryable) {
                    throw error;
                }
                // Transient/network error: continue polling.
            }
            await this._sleep(interval);
        }

        throw new PlexApiError(
            AppErrorCode.AUTH_REQUIRED,
            'PIN polling timeout exceeded',
            undefined,
            false
        );
    }

    /**
     * Cancel an active PIN request.
     * @param pinId - PIN ID to cancel
     */
    public async cancelPin(pinId: number): Promise<void> {
        const url = PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL +
            PLEX_AUTH_CONSTANTS.PIN_ENDPOINT + '/' + String(pinId);
        const headers = buildRequestHeaders(this._state.config);

        try {
            await fetchWithRetry(url, { method: 'DELETE', headers: headers });
        } catch {
            // Ignore errors on cancel
        }

        if (this._state.pendingPin && this._state.pendingPin.id === pinId) {
            this._state.pendingPin = null;
        }
    }

    // ========================================
    // Token management
    // ========================================

    /**
     * Verify a token is still valid by calling Plex API.
     * Returns false only for explicit auth-invalid responses and timeout.
     * @param token - Plex auth token to validate
     * @returns true if token is valid, false otherwise
     */
    public async validateToken(token: string): Promise<boolean> {
        const url = PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL + PLEX_AUTH_CONSTANTS.USER_ENDPOINT;
        const headers = buildRequestHeaders(this._state.config, token);

        try {
            const response = await fetchWithTimeout({
                url,
                init: { method: 'GET', headers: headers },
                timeoutMs: PLEX_AUTH_CONSTANTS.TOKEN_VALIDATION_TIMEOUT_MS,
            });

            if (response.status === 200) {
                let data: unknown;
                try {
                    data = await response.json();
                } catch {
                    throw new PlexApiError(
                        AppErrorCode.PARSE_ERROR,
                        'Failed to parse token validation response',
                        response.status,
                        false
                    );
                }
                if (!this.isValidUserPayload(data)) {
                    throw new PlexApiError(
                        AppErrorCode.PARSE_ERROR,
                        'Token validation response payload is missing required fields',
                        response.status,
                        false
                    );
                }
                const userToken = parseUserResponse(data, token);
                const isAccountToken = this._state.accountToken?.token === token;
                const isActiveToken = this._state.activeToken?.token === token;
                if (isAccountToken) {
                    this._state.accountToken = userToken;
                    if (isActiveToken || !this._state.activeToken) {
                        this._state.activeToken = userToken;
                    }
                } else {
                    this._state.activeToken = userToken;
                    if (!this._state.accountToken) {
                        this._state.accountToken = userToken;
                    }
                }
                this._state.isValidated = true;
                return true;
            }
            if (response.status === 401 || response.status === 403) {
                return false;
            }
            if (response.status === 429) {
                throw new PlexApiError(
                    AppErrorCode.RATE_LIMITED,
                    'Rate limited during token validation',
                    429,
                    true
                );
            }
            if (response.status >= 500) {
                throw new PlexApiError(
                    AppErrorCode.SERVER_UNREACHABLE,
                    `Token validation service failure (${response.status})`,
                    response.status,
                    true
                );
            }
            throw new PlexApiError(
                AppErrorCode.SERVER_UNREACHABLE,
                `Token validation failed (${response.status})`,
                response.status,
                false
            );
        } catch (error) {
            // Return false only on timeout (AbortError); throw on network errors
            if (error instanceof Error && error.name === 'AbortError') {
                return false;
            }
            if (error instanceof PlexApiError) {
                throw error;
            }
            throw new PlexApiError(
                AppErrorCode.SERVER_UNREACHABLE,
                'Network error during token validation',
                undefined,
                true
            );
        }
    }

    /**
     * Get stored credentials from localStorage.
     * @returns Explicit stored-read classification
     */
    public async readStoredCredentialsAndClearCorruption(): Promise<PlexStoredCredentialsReadResult> {
        const result = this._readStoredCredentials();
        if (result.kind === 'available') {
            this._bootStoredCredentialsCorruption = null;
            return result;
        }
        if (result.kind === 'missing' && this._bootStoredCredentialsCorruption) {
            const bootCorruption = this._bootStoredCredentialsCorruption;
            this._bootStoredCredentialsCorruption = null;
            return bootCorruption;
        }
        return result;
    }

    /**
     * Store credentials to localStorage.
     * @param auth - Auth data to store
     */
    public async storeCredentials(auth: PlexAuthData): Promise<void> {
        const stored: StoredAuthData = {
            version: PLEX_AUTH_CONSTANTS.STORAGE_VERSION,
            data: auth,
        };
        if (!safeLocalStorageSet(PLEX_AUTH_CONSTANTS.STORAGE_KEY, JSON.stringify(stored))) {
            // Storage can be blocked or quota-limited; keep the token in-memory for this session.
        }
        this._state.accountToken = auth.accountToken;
        this._state.activeToken = auth.activeToken;
        this._state.activeUserId = auth.activeUserId;
        this._state.isValidated = true;
        this._bootStoredCredentialsCorruption = null;
        this._emitter.emit('authChange', true);
    }

    /**
     * Clear credentials from localStorage.
     */
    public async clearCredentials(): Promise<void> {
        this._credentialsEpoch += 1;
        if (!safeLocalStorageRemove(PLEX_AUTH_CONSTANTS.STORAGE_KEY)) {
            // localStorage can be blocked/unavailable; clearing in-memory state is still sufficient.
        }
        this._state.accountToken = null;
        this._state.activeToken = null;
        this._state.activeUserId = null;
        this._state.isValidated = false;
        this._state.pendingPin = null;
        this._bootStoredCredentialsCorruption = null;
        this._emitter.emit('authChange', false);
    }

    // ========================================
    // Convenience methods
    // ========================================

    /** Check if currently authenticated. */
    public isAuthenticated(): boolean {
        return this._state.activeToken !== null;
    }

    /** Get current user token. */
    public getCurrentUser(): PlexAuthToken | null {
        return this._state.activeToken;
    }

    /**
     * Generate headers required for all Plex API requests.
     * @returns Object containing all required Plex headers
     */
    public getAuthHeaders(): Record<string, string> {
        const token = this._state.activeToken
            ? this._state.activeToken.token
            : undefined;
        return buildRequestHeaders(this._state.config, token, {
            platformVersion: this._state.config.platformVersion,
            deviceName: this._state.config.deviceName,
        });
    }

    public async getHomeUsers(options?: { signal?: AbortSignal | null }): Promise<PlexHomeUser[]> {
        if (!this._state.accountToken) {
            throw new PlexApiError(
                AppErrorCode.AUTH_REQUIRED,
                'Plex account token not available',
                undefined,
                false
            );
        }

        const headers = buildRequestHeaders(this._state.config, this._state.accountToken.token);
        // Keep v2-first with v1 fallback: some plex.tv variants return a 200 payload from v2
        // with no usable Home users. Existing tests cover this fallback behavior.
        // Revisit removing v1 only after capturing production traces proving v2 responses are
        // consistently complete for webOS targets.
        const endpoints = [
            PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL + PLEX_AUTH_CONSTANTS.HOME_USERS_ENDPOINT,
            PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL_V1 + PLEX_AUTH_CONSTANTS.HOME_USERS_ENDPOINT,
        ];

        let lastError: unknown = null;
        let sawSuccessfulResponse = false;
        for (let index = 0; index < endpoints.length; index++) {
            const url = endpoints[index];
            if (!url) {
                continue;
            }
            try {
                const init: RequestInit = {
                    method: 'GET',
                    headers: headers,
                };
                const response = await fetchWithTimeout({
                    url,
                    init,
                    timeoutMs: PLEX_AUTH_CONSTANTS.REQUEST_TIMEOUT_MS,
                    upstreamSignal: options?.signal ?? null,
                });

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
                if (response.status === 404 || response.status === 405) {
                    lastError = null;
                    continue;
                }
                if (!response.ok) {
                    throw new PlexApiError(
                        AppErrorCode.SERVER_UNREACHABLE,
                        `Failed to fetch Plex Home users (status ${response.status})`,
                        response.status,
                        response.status >= 500
                    );
                }

                const payload = await readPlexResponse(response);
                const users = parseHomeUsersPayload(payload);
                sawSuccessfulResponse = true;
                if (users.length > 0) {
                    return users;
                }

                // Some plex.tv variants return a 200 body on v2 that lacks Home users.
                // Try v1 before concluding there are no profiles.
                if (index < endpoints.length - 1) {
                    continue;
                }
                return [];
            } catch (error) {
                if (error instanceof PlexApiError) {
                    // For auth errors, bail immediately.
                    if (error.code === AppErrorCode.AUTH_REQUIRED || error.code === AppErrorCode.AUTH_INVALID) {
                        throw error;
                    }
                    if (error.code === AppErrorCode.PARSE_ERROR) {
                        throw error;
                    }
                }
                lastError = error;
            }
        }

        if (sawSuccessfulResponse) {
            return [];
        }

        if (lastError) {
            if (lastError instanceof PlexApiError) {
                throw lastError;
            }
            throw new PlexApiError(
                AppErrorCode.SERVER_UNREACHABLE,
                'Failed to fetch Plex Home users',
                undefined,
                true
            );
        }

        return [];
    }

    public async switchHomeUser(
        userId: string,
        options?: { pin?: string | null; signal?: AbortSignal | null }
    ): Promise<void> {
        if (!this._state.accountToken) {
            throw new PlexApiError(
                AppErrorCode.AUTH_REQUIRED,
                'Plex account token not available',
                undefined,
                false
            );
        }

        const epoch = this._credentialsEpoch;
        const accountToken = this._state.accountToken;
        const headers = buildRequestHeaders(this._state.config, accountToken.token);
        const pinValue = options?.pin && options.pin.trim().length > 0 ? options.pin.trim() : null;

        const buildUrl = (base: string): string => {
            const url = new URL(
                `${base}${PLEX_AUTH_CONSTANTS.HOME_USERS_ENDPOINT}/${encodeURIComponent(userId)}/switch`
            );
            if (pinValue) {
                url.searchParams.set('pin', pinValue);
            }
            return url.toString();
        };

        const endpoints = [
            buildUrl(PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL),
            buildUrl(PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL_V1),
        ];

        let lastError: unknown = null;
        let response: Response | null = null;
        for (const url of endpoints) {
            try {
                const init: RequestInit = {
                    method: 'POST',
                    headers: headers,
                };
                response = await fetchWithTimeout({
                    url,
                    init,
                    timeoutMs: PLEX_AUTH_CONSTANTS.REQUEST_TIMEOUT_MS,
                    upstreamSignal: options?.signal ?? null,
                });

                if (response.status === 401) {
                    if (pinValue) {
                        const stillValid = await this.validateToken(accountToken.token);
                        if (stillValid) {
                            throw new PlexApiError(
                                AppErrorCode.AUTH_FAILED,
                                'Incorrect PIN',
                                401,
                                false
                            );
                        }
                    }
                    throw new PlexApiError(
                        AppErrorCode.AUTH_REQUIRED,
                        'Unauthorized: account token is not valid for profile switching',
                        401,
                        false
                    );
                }
                if (response.status === 403) {
                    if (pinValue) {
                        const stillValid = await this.validateToken(accountToken.token);
                        if (stillValid) {
                            throw new PlexApiError(
                                AppErrorCode.AUTH_FAILED,
                                'Incorrect PIN',
                                403,
                                false
                            );
                        }
                    }
                    throw new PlexApiError(
                        AppErrorCode.AUTH_INVALID,
                        'Forbidden: account token is not valid for profile switching',
                        403,
                        false
                    );
                }
                if (response.status === 404 || response.status === 405) {
                    lastError = null;
                    response = null;
                    continue;
                }
                if (!response.ok) {
                    throw new PlexApiError(
                        AppErrorCode.SERVER_UNREACHABLE,
                        `Failed to switch Plex Home user (status ${response.status})`,
                        response.status,
                        response.status >= 500
                    );
                }

                break;
            } catch (error) {
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
                    if (pinValue && error.code === AppErrorCode.SERVER_UNREACHABLE) {
                        throw error;
                    }
                }
                lastError = error;
            }
        }

        if (!response) {
            if (lastError instanceof PlexApiError) {
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
        const parsed = parseSwitchResponsePayload(payload);
        const userToken = await this._fetchUserProfile(parsed.authToken);

        if (
            this._credentialsEpoch !== epoch ||
            this._state.accountToken === null ||
            this._state.accountToken.token !== accountToken.token
        ) {
            throw new PlexApiError(
                AppErrorCode.AUTH_REQUIRED,
                'Authentication changed during profile switch',
                undefined,
                false
            );
        }

        const scopedUserId = userId.trim().length > 0 ? userId.trim() : userToken.userId;
        const fromUserId = this._state.activeUserId ?? this._state.activeToken?.userId ?? null;
        this._state.activeToken = userToken;
        this._state.activeUserId = scopedUserId;
        this._state.isValidated = true;

        const stored = await this.readStoredCredentialsAndClearCorruption();
        const persisted = stored.kind === 'available' ? stored.credentials : null;
        const selectedServerByUserId = {
            ...(persisted?.selectedServerByUserId ?? {}),
        };
        if (!selectedServerByUserId[scopedUserId]) {
            selectedServerByUserId[scopedUserId] = { serverId: null, serverUri: null };
        }

        await this.storeCredentials({
            accountToken: accountToken,
            activeToken: userToken,
            activeUserId: scopedUserId,
            selectedServerByUserId,
            deviceKey: persisted?.deviceKey ?? null,
        });

        if (fromUserId !== scopedUserId) {
            this._emitter.emit('profileChange', { fromUserId, toUserId: scopedUserId });
        }
    }

    public getActiveUserId(): string | null {
        return this._state.activeUserId ?? this._state.activeToken?.userId ?? null;
    }

    public getAccountUserId(): string | null {
        return this._state.accountToken?.userId ?? null;
    }

    public async logoutActiveUser(): Promise<void> {
        if (!this._state.accountToken) {
            return;
        }
        const fromUserId = this._state.activeUserId ?? this._state.activeToken?.userId ?? null;
        const toUserId = this._state.accountToken.userId;
        const stored = await this.readStoredCredentialsAndClearCorruption();
        const persisted = stored.kind === 'available' ? stored.credentials : null;
        const selectedServerByUserId = {
            ...(persisted?.selectedServerByUserId ?? {}),
        };
        if (!selectedServerByUserId[toUserId]) {
            selectedServerByUserId[toUserId] = { serverId: null, serverUri: null };
        }
        await this.storeCredentials({
            accountToken: this._state.accountToken,
            activeToken: this._state.accountToken,
            activeUserId: toUserId,
            selectedServerByUserId,
            deviceKey: persisted?.deviceKey ?? null,
        });
        if (fromUserId !== toUserId) {
            this._emitter.emit('profileChange', { fromUserId, toUserId });
        }
    }

    // ========================================
    // Event handling
    // ========================================

    /**
     * Register handler for auth change events.
     * @param event - Event name ('authChange')
     * @param handler - Handler function
     * @returns Disposable to remove handler
     */
    public on(
        event: 'authChange',
        handler: (isAuthenticated: boolean) => void
    ): IDisposable;
    public on(
        event: 'profileChange',
        handler: (payload: { fromUserId: string | null; toUserId: string }) => void
    ): IDisposable;
    public on(
        event: 'authChange' | 'profileChange',
        handler: ((isAuthenticated: boolean) => void) | ((payload: { fromUserId: string | null; toUserId: string }) => void)
    ): IDisposable {
        return this._emitter.on(event, handler as (payload: unknown) => void);
    }

    // ========================================
    // Private helpers
    // ========================================

    private async _fetchUserProfile(token: string): Promise<PlexAuthToken> {
        const url = PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL + PLEX_AUTH_CONSTANTS.USER_ENDPOINT;
        const headers = buildRequestHeaders(this._state.config, token);
        const response = await fetchWithRetry(url, { method: 'GET', headers: headers });
        const data = await response.json();
        return parseUserResponse(data, token);
    }

    private _loadStoredCredentials(): void {
        const result = this._readStoredCredentials();
        if (result.kind === 'corrupted') {
            this._bootStoredCredentialsCorruption = result;
            return;
        }
        if (result.kind !== 'available') {
            return;
        }
        this._state.accountToken = result.credentials.accountToken;
        this._state.activeToken = result.credentials.activeToken;
        this._state.activeUserId = result.credentials.activeUserId;
        this._state.isValidated = false;
    }

    /**
     * Parse stored auth data, converting date strings back to Date objects.
     * @param parsed - The parsed JSON from storage
     * @returns Parsed credentials or corruption reason
     */
    private _parseStoredAuthData(parsed: unknown):
        | { kind: 'available'; credentials: PlexAuthData }
        | { kind: 'corrupted'; reason: 'invalid-shape' | 'unsupported-version' } {
        if (!parsed || typeof parsed !== 'object') {
            return { kind: 'corrupted', reason: 'invalid-shape' };
        }
        const payload = parsed as Record<string, unknown>;

        if (typeof payload.version !== 'number') {
            return { kind: 'corrupted', reason: 'invalid-shape' };
        }
        if (payload.version !== PLEX_AUTH_CONSTANTS.STORAGE_VERSION) {
            return { kind: 'corrupted', reason: 'unsupported-version' };
        }
        if (!('data' in payload)) {
            return { kind: 'corrupted', reason: 'invalid-shape' };
        }
        const data = payload.data as PlexAuthData | null | undefined;

        if (!data || typeof data !== 'object') {
            return { kind: 'corrupted', reason: 'invalid-shape' };
        }

        const accountToken = this._normalizeTokenDates(data.accountToken);
        const activeToken = this._normalizeTokenDates(data.activeToken);
        if (!accountToken || !activeToken) {
            return { kind: 'corrupted', reason: 'invalid-shape' };
        }

        const activeUserId = typeof data.activeUserId === 'string' && data.activeUserId.length > 0
            ? data.activeUserId
            : activeToken.userId;

        const selectedServerByUserId = this._normalizeSelectedServerMap(
            data.selectedServerByUserId,
            activeUserId
        );
        const deviceKey = this._normalizeDeviceKey(data.deviceKey);

        return {
            kind: 'available',
            credentials: {
                accountToken,
                activeToken,
                selectedServerByUserId,
                activeUserId,
                deviceKey,
            },
        };
    }

    private _readStoredCredentials(): PlexStoredCredentialsReadResult {
        try {
            const stored = safeLocalStorageGet(PLEX_AUTH_CONSTANTS.STORAGE_KEY);
            if (!stored) {
                return { kind: 'missing' };
            }
            let parsed: unknown;
            try {
                parsed = JSON.parse(stored);
            } catch {
                this._clearCorruptedStoredCredentials();
                return { kind: 'corrupted', reason: 'invalid-json' };
            }
            const result = this._parseStoredAuthData(parsed);
            if (result.kind === 'corrupted') {
                this._clearCorruptedStoredCredentials();
                return result;
            }
            return result;
        } catch {
            return { kind: 'missing' };
        }
    }

    private _clearCorruptedStoredCredentials(): void {
        if (!safeLocalStorageRemove(PLEX_AUTH_CONSTANTS.STORAGE_KEY)) {
            // localStorage can be blocked/unavailable; clearing will be retried on future reads.
        }
    }

    private _normalizeTokenDates(token: PlexAuthToken | null | undefined): PlexAuthToken | null {
        if (!token) return null;
        const issuedAt = new Date(token.issuedAt);
        if (isNaN(issuedAt.getTime())) {
            return null;
        }
        let expiresAt: Date | null = null;
        if (token.expiresAt !== null && typeof token.expiresAt !== 'undefined') {
            const converted = new Date(token.expiresAt);
            if (isNaN(converted.getTime())) {
                return null;
            }
            expiresAt = converted;
        }

        return {
            ...token,
            issuedAt,
            expiresAt,
        };
    }

    private _normalizeDeviceKey(deviceKey: unknown): PlexDeviceKey | null {
        if (!deviceKey || typeof deviceKey !== 'object') {
            return null;
        }

        const candidate = deviceKey as Partial<PlexDeviceKey> & {
            createdAt?: unknown;
            publicJwk?: unknown;
        };

        if (typeof candidate.kid !== 'string' || candidate.kid.length === 0) {
            return null;
        }

        if (typeof candidate.privateKey !== 'string' || candidate.privateKey.length === 0) {
            return null;
        }

        if (!candidate.publicJwk || typeof candidate.publicJwk !== 'object') {
            return null;
        }

        const publicJwk = candidate.publicJwk as unknown as Record<string, unknown>;
        if (
            publicJwk.kty !== 'OKP' ||
            publicJwk.crv !== 'Ed25519' ||
            typeof publicJwk.x !== 'string' ||
            publicJwk.alg !== 'EdDSA'
        ) {
            return null;
        }

        const createdAt = new Date(candidate.createdAt as string | number | Date);
        if (Number.isNaN(createdAt.getTime())) {
            return null;
        }

        return {
            kid: candidate.kid,
            privateKey: candidate.privateKey,
            createdAt,
            publicJwk: {
                kty: 'OKP',
                crv: 'Ed25519',
                x: publicJwk.x,
                alg: 'EdDSA',
                ...(publicJwk.use === 'sig' ? { use: 'sig' as const } : {}),
                ...(typeof publicJwk.kid === 'string' ? { kid: publicJwk.kid } : {}),
            },
        };
    }

    private _normalizeSelectedServerMap(
        map: PlexAuthData['selectedServerByUserId'] | null | undefined,
        activeUserId: string
    ): Record<string, { serverId: string | null; serverUri: string | null }> {
        const out: Record<string, { serverId: string | null; serverUri: string | null }> = {};
        if (map && typeof map === 'object') {
            for (const [userId, value] of Object.entries(map)) {
                if (!userId) continue;
                if (!value || typeof value !== 'object') {
                    out[userId] = { serverId: null, serverUri: null };
                    continue;
                }
                const record = value as { serverId?: unknown; serverUri?: unknown };
                out[userId] = {
                    serverId: typeof record.serverId === 'string' ? record.serverId : null,
                    serverUri: typeof record.serverUri === 'string' ? record.serverUri : null,
                };
            }
        }
        if (!out[activeUserId]) {
            out[activeUserId] = { serverId: null, serverUri: null };
        }
        return out;
    }

    private _sleep(ms: number): Promise<void> {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }
}
