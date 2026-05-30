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
    PlexHomeUser,
    PlexPinRequest,
    PlexAuthState,
    PlexDeviceKey,
    StoredAuthData,
} from './interfaces';
import {
    PlexApiError,
    buildRequestHeaders,
    createPlexServiceError,
    fetchWithRetry,
} from './plexAuthTransport';
import {
    parsePinResponse,
    parseUserResponse,
} from './plexAuthPayloadParsers';
import { AppErrorCode } from '../../../types/app-errors';
import { fetchWithTimeout } from '../shared/fetchWithTimeout';
import { PlexHomeProfileClient } from './plexHomeProfileClient';
import { isAbortLikeError } from '../../../utils/errors';
import {
    clonePlexAuthToken,
    normalizePlexAuthTokenDates,
} from './plexAuthTokenOwnership';

// Re-export for consumers
export { PlexApiError } from './plexAuthTransport';

function throwIfAborted(signal: AbortSignal | null | undefined): void {
    if (!signal?.aborted) {
        return;
    }
    throw signal.reason ?? new DOMException('Aborted', 'AbortError');
}

/**
 * Plex Authentication implementation.
 * Handles PIN-based OAuth flow, token storage, and credential lifecycle.
 * @implements {IPlexAuth}
 */
export class PlexAuth implements IPlexAuth {
    private _state: PlexAuthState;
    private _emitter: EventEmitter<PlexAuthEvents>;
    private readonly _homeProfileClient: PlexHomeProfileClient;
    private _credentialsEpoch = 0;

    constructor(config: PlexAuthConfig) {
        this._emitter = new EventEmitter<PlexAuthEvents>();
        this._homeProfileClient = new PlexHomeProfileClient({
            config,
            validateAccountToken: (token): Promise<boolean> => this.validateToken(token),
        });
        this._state = {
            config,
            accountToken: null,
            activeToken: null,
            activeUserId: null,
            isValidated: false,
            pendingPin: null,
        };
    }


    /**
     * Initiate Plex OAuth flow by requesting a PIN code.
     * @returns PIN request containing code for user display (length varies)
     * @throws {PlexApiError} On connection failure or rate limiting
     */
    public async requestPin(options?: { signal?: AbortSignal | null }): Promise<PlexPinRequest> {
        throwIfAborted(options?.signal);
        const url = PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL +
            PLEX_AUTH_CONSTANTS.PIN_ENDPOINT;
        const headers = buildRequestHeaders(this._state.config);

        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: headers,
            ...(options?.signal ? { signal: options.signal } : {}),
        });
        throwIfAborted(options?.signal);

        const data = await response.json();
        const pin = parsePinResponse(data, this._state.config.clientIdentifier);
        throwIfAborted(options?.signal);
        this._state.pendingPin = pin;
        return pin;
    }

    /**
     * Check if user has claimed the PIN via the Plex auth app.
     * @param pinId - PIN ID from requestPin()
     * @returns Updated PIN request with authToken if claimed
     * @throws {PlexApiError} If PIN doesn't exist or on connection failure
     */
    public async checkPinStatus(
        pinId: number,
        options?: { signal?: AbortSignal | null }
    ): Promise<PlexPinRequest> {
        throwIfAborted(options?.signal);
        const url = PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL +
            PLEX_AUTH_CONSTANTS.PIN_ENDPOINT + '/' + String(pinId);
        const headers = buildRequestHeaders(this._state.config);

        const response = await fetchWithRetry(url, {
            method: 'GET',
            headers: headers,
            ...(options?.signal ? { signal: options.signal } : {}),
        });
        throwIfAborted(options?.signal);

        const data = await response.json();
        const pin = parsePinResponse(data, this._state.config.clientIdentifier);

        if (pin.authToken !== null) {
            throwIfAborted(options?.signal);
            const userToken = await this._fetchUserProfile(pin.authToken, options?.signal ?? null);
            throwIfAborted(options?.signal);
            this.storeCredentials({
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
    public async pollForPin(
        pinId: number,
        options?: { signal?: AbortSignal | null }
    ): Promise<PlexPinRequest> {
        const startTime = Date.now();
        const timeout = PLEX_AUTH_CONSTANTS.PIN_TIMEOUT_MS;
        const interval = PLEX_AUTH_CONSTANTS.PIN_POLL_INTERVAL_MS;
        let lastRetryableError: PlexApiError | null = null;

        throwIfAborted(options?.signal);
        while (Date.now() - startTime < timeout) {
            try {
                throwIfAborted(options?.signal);
                const pin = await this.checkPinStatus(pinId, options);
                if (pin.authToken !== null) {
                    return pin;
                }
                lastRetryableError = null;
            } catch (error) {
                if (error instanceof PlexApiError) {
                    if (!error.retryable) {
                        throw error;
                    }
                    lastRetryableError = error;
                } else {
                    throw error;
                }
            }
            await this._sleep(interval, options?.signal ?? null);
        }

        if (lastRetryableError) {
            throw lastRetryableError;
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


    /**
     * Verify a token is still valid by calling Plex API.
     * Returns false only for explicit auth-invalid responses (401/403);
     * service, transport, timeout, and malformed success failures throw.
     */
    public async validateToken(
        token: string,
        options?: { signal?: AbortSignal | null }
    ): Promise<boolean> {
        throwIfAborted(options?.signal);
        const url = PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL + PLEX_AUTH_CONSTANTS.USER_ENDPOINT;
        const headers = buildRequestHeaders(this._state.config, token);

        try {
            const response = await fetchWithTimeout({
                url,
                init: {
                    method: 'GET',
                    headers: headers,
                    ...(options?.signal ? { signal: options.signal } : {}),
                },
                timeoutMs: PLEX_AUTH_CONSTANTS.TOKEN_VALIDATION_TIMEOUT_MS,
            });
            throwIfAborted(options?.signal);

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
                const userToken = parseUserResponse(data, token);
                throwIfAborted(options?.signal);
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
                throw createPlexServiceError(response.status);
            }
            throw new PlexApiError(
                AppErrorCode.SERVER_UNREACHABLE,
                `Token validation failed (${response.status})`,
                response.status,
                false
            );
        } catch (error) {
            if (options?.signal?.aborted && isAbortLikeError(error)) {
                throw error;
            }
            if (isAbortLikeError(error)) {
                throw new PlexApiError(
                    AppErrorCode.NETWORK_TIMEOUT,
                    'Token validation timed out',
                    undefined,
                    true,
                    error
                );
            }
            if (error instanceof PlexApiError) {
                throw error;
            }
            throw new PlexApiError(
                AppErrorCode.SERVER_UNREACHABLE,
                'Network error during token validation',
                undefined,
                true,
                error
            );
        }
    }

    /**
     * Get stored credentials from localStorage.
     * @returns Explicit stored-read classification
     */
    public readStoredCredentialsAndClearCorruption(): PlexStoredCredentialsReadResult {
        return this._readStoredCredentials();
    }

    /**
     * Store credentials to localStorage.
     * @param auth - Auth data to store
     */
    public storeCredentials(auth: PlexAuthData): void {
        const stored: StoredAuthData = {
            version: PLEX_AUTH_CONSTANTS.STORAGE_VERSION,
            data: auth,
        };
        if (!safeLocalStorageSet(PLEX_AUTH_CONSTANTS.STORAGE_KEY, JSON.stringify(stored))) {
            // Storage can be blocked or quota-limited; keep the token in-memory for this session.
        }
        this._state.accountToken = clonePlexAuthToken(auth.accountToken);
        this._state.activeToken = clonePlexAuthToken(auth.activeToken);
        this._state.activeUserId = auth.activeUserId;
        this._state.isValidated = true;
        this._emitter.emit('authChange', true);
    }

    /**
     * Clear credentials from localStorage.
     */
    public clearCredentials(): void {
        this._credentialsEpoch += 1;
        if (!safeLocalStorageRemove(PLEX_AUTH_CONSTANTS.STORAGE_KEY)) {
            // localStorage can be blocked/unavailable; clearing in-memory state is still sufficient.
        }
        this._state.accountToken = null;
        this._state.activeToken = null;
        this._state.activeUserId = null;
        this._state.isValidated = false;
        this._state.pendingPin = null;
        this._emitter.emit('authChange', false);
    }


    public isAuthenticated(): boolean {
        return this._state.activeToken !== null;
    }

    public getCurrentUser(): PlexAuthToken | null {
        return clonePlexAuthToken(this._state.activeToken);
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

        return this._homeProfileClient.getHomeUsers(this._state.accountToken.token, options);
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
        const parsed = await this._homeProfileClient.requestHomeUserSwitch({
            userId,
            accountToken: accountToken.token,
            pin: options?.pin,
            signal: options?.signal ?? null,
        });
        const userToken = await this._fetchUserProfile(parsed.authToken, options?.signal ?? null);

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

        const stored = this.readStoredCredentialsAndClearCorruption();
        const persisted = stored.kind === 'available' ? stored.credentials : null;
        const selectedServerByUserId = {
            ...(persisted?.selectedServerByUserId ?? {}),
        };
        if (!selectedServerByUserId[scopedUserId]) {
            selectedServerByUserId[scopedUserId] = { serverId: null, serverUri: null };
        }

        this.storeCredentials({
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
        const stored = this.readStoredCredentialsAndClearCorruption();
        const persisted = stored.kind === 'available' ? stored.credentials : null;
        const selectedServerByUserId = {
            ...(persisted?.selectedServerByUserId ?? {}),
        };
        if (!selectedServerByUserId[toUserId]) {
            selectedServerByUserId[toUserId] = { serverId: null, serverUri: null };
        }
        this.storeCredentials({
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


    private async _fetchUserProfile(
        token: string,
        signal: AbortSignal | null = null
    ): Promise<PlexAuthToken> {
        throwIfAborted(signal);
        const url = PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL + PLEX_AUTH_CONSTANTS.USER_ENDPOINT;
        const headers = buildRequestHeaders(this._state.config, token);
        const response = await fetchWithRetry(url, {
            method: 'GET',
            headers: headers,
            ...(signal ? { signal } : {}),
        });
        throwIfAborted(signal);
        const data = await response.json();
        const user = parseUserResponse(data, token);
        throwIfAborted(signal);
        return user;
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

        const accountToken = normalizePlexAuthTokenDates(data.accountToken);
        const activeToken = normalizePlexAuthTokenDates(data.activeToken);
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

    private _sleep(ms: number, signal: AbortSignal | null = null): Promise<void> {
        throwIfAborted(signal);
        return new Promise(function (resolve, reject) {
            let timeoutId: ReturnType<typeof setTimeout>;
            const cleanup = (): void => {
                clearTimeout(timeoutId);
                if (signal) {
                    signal.removeEventListener('abort', onAbort);
                }
            };
            const onAbort = (): void => {
                cleanup();
                reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
            };
            timeoutId = setTimeout(() => {
                cleanup();
                resolve();
            }, ms);
            if (!signal) {
                return;
            }
            signal.addEventListener('abort', onAbort, { once: true });
            if (signal.aborted) {
                onAbort();
            }
        });
    }
}
