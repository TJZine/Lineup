import { EventEmitter } from '../../../utils/EventEmitter';
import { IDisposable } from '../../../utils/interfaces';
import { safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from '../../../utils/storage';
import { AppErrorCode } from '../../../types/app-errors';
import { isAbortLikeError } from '../../../utils/errors';
import { readAbortSignalReason } from '../../../utils/abortSignalReason';
import { PLEX_AUTH_CONSTANTS } from './constants';
import type {
    IPlexAuth,
    PlexAuthConfig,
    PlexAuthEvents,
    PlexAuthToken,
    PlexAuthData,
    PlexStoredCredentialsReadResult,
    PlexStoredCredentialsValidationResult,
    PlexCurrentCredentialValidity,
    PlexAuthValidationGuard,
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
    type ParseUserResponseOptions,
} from './plexAuthPayloadParsers';
import { fetchWithTimeout } from '../shared/fetchWithTimeout';
import { PlexHomeProfileClient } from './plexHomeProfileClient';
import { clonePlexAuthToken, normalizePlexAuthTokenDates } from './plexAuthTokenOwnership';
import { PlexAuthOperationSupersededError } from './plexAuthErrors';
import {
    reconstructAccountFallbackCredentials,
    reconstructActiveValidCredentials,
} from './plexStoredCredentialsValidation';

export { PlexApiError } from './plexAuthTransport';

function throwIfAborted(signal: AbortSignal | null | undefined): void {
    if (signal?.aborted) throw readAbortSignalReason(signal);
}

interface AuthOperation {
    readonly id: number;
    readonly controller: AbortController;
    terminal: boolean;
    pinId: number | null;
}

type TokenValidationOutcome =
    | { kind: 'valid'; response: Response }
    | { kind: 'invalid' };

/** Plex credential, PIN, token-validation, and profile lifecycle owner. */
export class PlexAuth implements IPlexAuth {
    private _state: PlexAuthState;
    private readonly _emitter = new EventEmitter<PlexAuthEvents>();
    private readonly _homeProfileClient: PlexHomeProfileClient;
    private _operationId = 0;
    private _currentOperation: AuthOperation | null = null;
    private _pollOperation: AuthOperation | null = null;

    constructor(config: PlexAuthConfig) {
        this._homeProfileClient = new PlexHomeProfileClient({
            config,
            classifyAccountToken: (token, options): Promise<boolean> => this._classifyToken(token, options?.signal ?? null)
                .then((result) => result !== null),
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

    public async requestPin(options?: { signal?: AbortSignal | null }): Promise<PlexPinRequest> {
        const operation = this._beginOperation();
        const signal = options?.signal ?? null;
        try {
            this._observe(operation, signal);
            const response = await fetchWithRetry(
                PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL + PLEX_AUTH_CONSTANTS.PIN_ENDPOINT,
                {
                    method: 'POST',
                    headers: buildRequestHeaders(this._state.config),
                    ...(signal ? { signal } : {}),
                }
            );
            this._observe(operation, signal);
            const pin = parsePinResponse(await response.json(), this._state.config.clientIdentifier);
            this._observe(operation, signal);
            operation.pinId = pin.id;
            this._state.pendingPin = pin;
            return pin;
        } catch (error) {
            this._observe(operation, signal, error);
            throw error;
        }
    }

    public async checkPinStatus(
        pinId: number,
        options?: { signal?: AbortSignal | null }
    ): Promise<PlexPinRequest> {
        const operation = this._pollOperation ?? this._beginOperation();
        operation.pinId = pinId;
        this._pollOperation = null;
        return this._checkPinStatus(pinId, operation, options?.signal ?? null);
    }

    public async pollForPin(
        pinId: number,
        options?: { signal?: AbortSignal | null }
    ): Promise<PlexPinRequest> {
        const operation = this._beginOperation();
        operation.pinId = pinId;
        const signal = options?.signal ?? null;
        this._observe(operation, signal);
        const startTime = Date.now();
        let lastRetryableError: PlexApiError | null = null;
        while (Date.now() - startTime < PLEX_AUTH_CONSTANTS.PIN_TIMEOUT_MS) {
            try {
                this._pollOperation = operation;
                const pendingCheck = this.checkPinStatus(pinId, options);
                this._pollOperation = null;
                const pin = await pendingCheck;
                if (pin.authToken !== null) return pin;
                lastRetryableError = null;
            } catch (error) {
                this._observe(operation, signal);
                if (!(error instanceof PlexApiError) || !error.retryable) throw error;
                lastRetryableError = error;
            }
            await this._sleep(PLEX_AUTH_CONSTANTS.PIN_POLL_INTERVAL_MS, signal);
            this._observe(operation, signal);
        }
        if (lastRetryableError) throw lastRetryableError;
        throw new PlexApiError(
            AppErrorCode.AUTH_REQUIRED,
            'PIN polling timeout exceeded',
            undefined,
            false
        );
    }

    public async cancelPin(pinId: number): Promise<void> {
        this._supersedeMatchingPinOperation(pinId);
        if (this._state.pendingPin?.id === pinId) this._state.pendingPin = null;
        try {
            await fetchWithRetry(
                PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL + PLEX_AUTH_CONSTANTS.PIN_ENDPOINT + '/' + String(pinId),
                { method: 'DELETE', headers: buildRequestHeaders(this._state.config) }
            );
        } catch {
            // Best-effort cancellation.
        }
    }

    public async validateToken(
        token: string,
        options?: { signal?: AbortSignal | null }
    ): Promise<boolean> {
        const operation = this._beginOperation();
        const signal = options?.signal ?? null;
        this._observe(operation, signal);
        const userToken = await this._classifyTokenForOperation(token, operation, signal);
        if (!userToken) return false;
        this._observe(operation, signal);
        const isAccountToken = this._state.accountToken?.token === token;
        const isActiveToken = this._state.activeToken?.token === token;
        if (isAccountToken) {
            this._state.accountToken = userToken;
            if (isActiveToken || !this._state.activeToken) {
                this._state.activeToken = userToken;
                this._state.activeUserId = userToken.userId;
            }
        } else {
            this._state.activeToken = userToken;
            this._state.activeUserId = userToken.userId;
            if (!this._state.accountToken) this._state.accountToken = userToken;
        }
        this._state.isValidated = true;
        operation.terminal = true;
        return true;
    }

    public async validateStoredCredentials(options?: {
        signal?: AbortSignal | null;
    }): Promise<PlexStoredCredentialsValidationResult> {
        const operation = this._beginOperation();
        const signal = options?.signal ?? null;
        this._observe(operation, signal);
        const guard = this._createGuard(operation);
        const storedRead = this._readStoredCredentials();
        if (storedRead.kind === 'missing') return { kind: 'missing', guard };
        if (storedRead.kind === 'corrupted') return { ...storedRead, guard };
        const stored = storedRead.credentials;
        const managedProfileFallback = stored.activeToken.token !== stored.accountToken.token
            ? {
                usernameFallback: stored.activeToken.username,
                emailFallback: stored.activeToken.email,
            }
            : undefined;
        const activeToken = await this._classifyTokenForOperation(
            stored.activeToken.token,
            operation,
            signal,
            managedProfileFallback
        );
        if (activeToken) {
            this._commitCredentials(
                operation,
                reconstructActiveValidCredentials(stored, activeToken),
                true,
                true
            );
            return { kind: 'active_valid', guard };
        }
        const accountToken = await this._classifyTokenForOperation(
            stored.accountToken.token,
            operation,
            signal
        );
        if (!accountToken) return { kind: 'invalid', guard };
        this._commitCredentials(
            operation,
            reconstructAccountFallbackCredentials(stored, accountToken),
            true,
            true
        );
        return { kind: 'account_fallback_valid', guard };
    }

    public async probeCurrentCredentialValidity(options?: {
        signal?: AbortSignal | null;
    }): Promise<PlexCurrentCredentialValidity> {
        const signal = options?.signal ?? null;
        throwIfAborted(signal);
        const observedOperationId = this._operationId;
        const activeToken = this._state.activeToken?.token ?? null;
        const accountToken = this._state.accountToken?.token ?? null;
        const isCurrent = (): boolean =>
            observedOperationId === this._operationId
            && activeToken === (this._state.activeToken?.token ?? null)
            && accountToken === (this._state.accountToken?.token ?? null);

        if (!activeToken || !accountToken) {
            return isCurrent() ? { kind: 'account_expired' } : { kind: 'superseded' };
        }

        const activeValid = await this._probeTokenValidity(activeToken, signal);
        if (!isCurrent()) return { kind: 'superseded' };
        if (activeValid) return { kind: 'active_valid' };
        if (activeToken === accountToken) return { kind: 'account_expired' };

        const accountValid = await this._probeTokenValidity(accountToken, signal);
        if (!isCurrent()) return { kind: 'superseded' };
        return accountValid
            ? { kind: 'managed_profile_invalid', accountValid: true }
            : { kind: 'account_expired' };
    }

    public readStoredCredentialsAndClearCorruption(): PlexStoredCredentialsReadResult {
        return this._readStoredCredentials();
    }

    public storeCredentials(auth: PlexAuthData, options?: { emitAuthChange?: boolean }): void {
        const operation = this._beginOperation();
        this._commitCredentials(operation, auth, options?.emitAuthChange !== false, false);
    }

    public clearCredentials(): void {
        this._beginOperation();
        safeLocalStorageRemove(PLEX_AUTH_CONSTANTS.STORAGE_KEY);
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

    public getAuthHeaders(): Record<string, string> {
        return buildRequestHeaders(this._state.config, this._state.activeToken?.token, {
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
        const operation = this._beginOperation();
        const signal = options?.signal ?? null;
        this._observe(operation, signal);
        const accountToken = this._state.accountToken;
        if (!accountToken) {
            throw new PlexApiError(
                AppErrorCode.AUTH_REQUIRED,
                'Plex account token not available',
                undefined,
                false
            );
        }
        try {
            const parsed = await this._homeProfileClient.requestHomeUserSwitch({
                userId,
                accountToken: accountToken.token,
                pin: options?.pin,
                signal,
            });
            this._observe(operation, signal);
            const userToken = await this._fetchUserProfile(parsed.authToken, signal, {
                usernameFallback: userId,
                emailFallback: accountToken.email,
            });
            this._observe(operation, signal);
            const scopedUserId = userId.trim() || userToken.userId;
            const fromUserId = this.getActiveUserId();
            this._commitCredentials(operation, {
                accountToken,
                activeToken: userToken,
                activeUserId: scopedUserId,
                selectedServerByUserId: {
                    [scopedUserId]: { serverId: null, serverUri: null },
                },
            }, true, true);
            if (fromUserId !== scopedUserId && this._isCurrent(operation)) {
                this._emitter.emit('profileChange', { fromUserId, toUserId: scopedUserId });
            }
        } catch (error) {
            if (operation.terminal) return;
            this._observe(operation, signal, error);
        }
    }

    public getActiveUserId(): string | null {
        return this._state.activeUserId ?? this._state.activeToken?.userId ?? null;
    }

    public getAccountUserId(): string | null {
        return this._state.accountToken?.userId ?? null;
    }

    public async logoutActiveUser(): Promise<void> {
        const operation = this._beginOperation();
        const accountToken = this._state.accountToken;
        if (!accountToken) return;
        const fromUserId = this.getActiveUserId();
        const toUserId = accountToken.userId;
        this._commitCredentials(operation, {
            accountToken,
            activeToken: accountToken,
            activeUserId: toUserId,
            selectedServerByUserId: { [toUserId]: { serverId: null, serverUri: null } },
        }, true, true);
        if (fromUserId !== toUserId && this._isCurrent(operation)) {
            this._emitter.emit('profileChange', { fromUserId, toUserId });
        }
    }

    public on(event: 'authChange', handler: (value: boolean) => void): IDisposable;
    public on(
        event: 'profileChange',
        handler: (value: { fromUserId: string | null; toUserId: string }) => void
    ): IDisposable;
    public on(
        event: keyof PlexAuthEvents,
        handler: ((value: boolean) => void) | ((value: { fromUserId: string | null; toUserId: string }) => void)
    ): IDisposable {
        return this._emitter.on(event, handler as (value: unknown) => void);
    }

    private _beginOperation(): AuthOperation {
        const superseded = new PlexAuthOperationSupersededError();
        this._currentOperation?.controller.abort(superseded);
        const operation = {
            id: ++this._operationId,
            controller: new AbortController(),
            terminal: false,
            pinId: null,
        };
        this._currentOperation = operation;
        return operation;
    }

    private _supersedeMatchingPinOperation(pinId: number): void {
        const operation = this._currentOperation;
        if (!operation || operation.pinId !== pinId) return;
        operation.controller.abort(new PlexAuthOperationSupersededError());
        if (this._pollOperation === operation) this._pollOperation = null;
        if (this._currentOperation === operation) this._currentOperation = null;
    }

    private _isCurrent(operation: AuthOperation): boolean {
        return this._currentOperation === operation;
    }

    private _observe(
        operation: AuthOperation,
        signal: AbortSignal | null,
        error?: unknown
    ): void {
        throwIfAborted(signal);
        if (!this._isCurrent(operation)) throw new PlexAuthOperationSupersededError();
        if (error !== undefined) throw error;
    }

    private _createGuard(operation: AuthOperation): PlexAuthValidationGuard {
        return {
            signal: operation.controller.signal,
            assertCurrent: (): void => {
                if (!this._isCurrent(operation)) throw new PlexAuthOperationSupersededError();
            },
        };
    }

    private async _checkPinStatus(
        pinId: number,
        operation: AuthOperation,
        signal: AbortSignal | null
    ): Promise<PlexPinRequest> {
        try {
            this._observe(operation, signal);
            const response = await fetchWithRetry(
                PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL + PLEX_AUTH_CONSTANTS.PIN_ENDPOINT + '/' + String(pinId),
                {
                    method: 'GET',
                    headers: buildRequestHeaders(this._state.config),
                    ...(signal ? { signal } : {}),
                }
            );
            this._observe(operation, signal);
            const pin = parsePinResponse(await response.json(), this._state.config.clientIdentifier);
            this._observe(operation, signal);
            if (pin.authToken === null) return pin;
            const userToken = await this._fetchUserProfile(pin.authToken, signal);
            this._observe(operation, signal);
            this._commitCredentials(operation, {
                accountToken: userToken,
                activeToken: userToken,
                activeUserId: userToken.userId,
                selectedServerByUserId: {
                    [userToken.userId]: { serverId: null, serverUri: null },
                },
            }, true, true);
            return pin;
        } catch (error) {
            this._observe(operation, signal, error);
            throw error;
        }
    }

    private async _classifyTokenForOperation(
        token: string,
        operation: AuthOperation,
        signal: AbortSignal | null,
        fallback?: ParseUserResponseOptions
    ): Promise<PlexAuthToken | null> {
        try {
            const result = await this._classifyToken(token, signal, fallback);
            this._observe(operation, signal);
            return result;
        } catch (error) {
            this._observe(operation, signal, error);
            throw error;
        }
    }

    private async _classifyToken(
        token: string,
        signal: AbortSignal | null,
        fallback?: ParseUserResponseOptions
    ): Promise<PlexAuthToken | null> {
        const outcome = await this._requestTokenValidation(token, signal);
        if (outcome.kind === 'invalid') return null;

        let data: unknown;
        try {
            data = await outcome.response.json();
        } catch {
            if (signal?.aborted) throw readAbortSignalReason(signal);
            throw new PlexApiError(
                AppErrorCode.PARSE_ERROR,
                'Failed to parse token validation response',
                outcome.response.status,
                false
            );
        }

        throwIfAborted(signal);
        return parseUserResponse(data, token, fallback);
    }

    private async _probeTokenValidity(
        token: string,
        signal: AbortSignal | null
    ): Promise<boolean> {
        return (await this._requestTokenValidation(token, signal)).kind === 'valid';
    }

    private async _requestTokenValidation(
        token: string,
        signal: AbortSignal | null
    ): Promise<TokenValidationOutcome> {
        throwIfAborted(signal);
        try {
            const response = await fetchWithTimeout({
                url: PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL + PLEX_AUTH_CONSTANTS.USER_ENDPOINT,
                init: {
                    method: 'GET',
                    headers: buildRequestHeaders(this._state.config, token),
                    ...(signal ? { signal } : {}),
                },
                timeoutMs: PLEX_AUTH_CONSTANTS.TOKEN_VALIDATION_TIMEOUT_MS,
            });
            throwIfAborted(signal);
            if (response.status === 200) return { kind: 'valid', response };
            if (response.status === 401 || response.status === 403) {
                return { kind: 'invalid' };
            }
            if (response.status === 429) {
                throw new PlexApiError(AppErrorCode.RATE_LIMITED, 'Rate limited during token validation', 429, true);
            }
            if (response.status >= 500) throw createPlexServiceError(response.status);
            throw new PlexApiError(
                AppErrorCode.SERVER_UNREACHABLE,
                `Token validation failed (${response.status})`,
                response.status,
                false
            );
        } catch (error) {
            if (signal?.aborted) throw readAbortSignalReason(signal);
            if (isAbortLikeError(error)) {
                throw new PlexApiError(
                    AppErrorCode.NETWORK_TIMEOUT,
                    'Token validation timed out',
                    undefined,
                    true,
                    error
                );
            }
            if (error instanceof PlexApiError) throw error;
            throw new PlexApiError(
                AppErrorCode.SERVER_UNREACHABLE,
                'Network error during token validation',
                undefined,
                true,
                error
            );
        }
    }

    private _commitCredentials(
        operation: AuthOperation,
        auth: PlexAuthData,
        emitAuthChange: boolean,
        mergeLatestMetadata: boolean
    ): void {
        this._observe(operation, null);
        const credentials = mergeLatestMetadata ? this._mergeLatestMetadata(auth) : auth;
        const stored: StoredAuthData = {
            version: PLEX_AUTH_CONSTANTS.STORAGE_VERSION,
            data: credentials,
        };
        safeLocalStorageSet(PLEX_AUTH_CONSTANTS.STORAGE_KEY, JSON.stringify(stored));
        this._state.accountToken = clonePlexAuthToken(credentials.accountToken);
        this._state.activeToken = clonePlexAuthToken(credentials.activeToken);
        this._state.activeUserId = credentials.activeUserId;
        this._state.isValidated = true;
        operation.terminal = true;
        if (emitAuthChange) this._emitter.emit('authChange', true);
    }

    private _mergeLatestMetadata(auth: PlexAuthData): PlexAuthData {
        const stored = this._readStoredCredentials();
        const persisted = stored.kind === 'available' ? stored.credentials : null;
        const selectedServerByUserId = {
            ...auth.selectedServerByUserId,
            ...(persisted?.selectedServerByUserId ?? {}),
        };
        selectedServerByUserId[auth.activeUserId] ??= { serverId: null, serverUri: null };
        return {
            ...auth,
            selectedServerByUserId,
            deviceKey: persisted?.deviceKey ?? auth.deviceKey ?? null,
        };
    }

    private async _fetchUserProfile(
        token: string,
        signal: AbortSignal | null,
        fallback?: { usernameFallback?: string | null; emailFallback?: string | null }
    ): Promise<PlexAuthToken> {
        throwIfAborted(signal);
        const response = await fetchWithRetry(
            PLEX_AUTH_CONSTANTS.PLEX_TV_BASE_URL + PLEX_AUTH_CONSTANTS.USER_ENDPOINT,
            {
                method: 'GET',
                headers: buildRequestHeaders(this._state.config, token),
                ...(signal ? { signal } : {}),
            }
        );
        throwIfAborted(signal);
        const user = parseUserResponse(await response.json(), token, fallback);
        throwIfAborted(signal);
        return user;
    }

    private _readStoredCredentials(): PlexStoredCredentialsReadResult {
        try {
            const stored = safeLocalStorageGet(PLEX_AUTH_CONSTANTS.STORAGE_KEY);
            if (!stored) return { kind: 'missing' };
            let parsed: unknown;
            try {
                parsed = JSON.parse(stored);
            } catch {
                this._clearCorruptedStoredCredentials();
                return { kind: 'corrupted', reason: 'invalid-json' };
            }
            const result = this._parseStoredAuthData(parsed);
            if (result.kind === 'corrupted') this._clearCorruptedStoredCredentials();
            return result;
        } catch {
            return { kind: 'missing' };
        }
    }

    private _parseStoredAuthData(parsed: unknown): PlexStoredCredentialsReadResult {
        if (!parsed || typeof parsed !== 'object') return { kind: 'corrupted', reason: 'invalid-shape' };
        const payload = parsed as Record<string, unknown>;
        if (typeof payload.version !== 'number') return { kind: 'corrupted', reason: 'invalid-shape' };
        if (payload.version !== PLEX_AUTH_CONSTANTS.STORAGE_VERSION) {
            return { kind: 'corrupted', reason: 'unsupported-version' };
        }
        const data = payload.data as PlexAuthData | null | undefined;
        if (!data || typeof data !== 'object') return { kind: 'corrupted', reason: 'invalid-shape' };
        const accountToken = normalizePlexAuthTokenDates(data.accountToken);
        const activeToken = normalizePlexAuthTokenDates(data.activeToken);
        if (!accountToken || !activeToken) return { kind: 'corrupted', reason: 'invalid-shape' };
        const activeUserId = typeof data.activeUserId === 'string' && data.activeUserId.length > 0
            ? data.activeUserId
            : activeToken.userId;
        return {
            kind: 'available',
            credentials: {
                accountToken,
                activeToken,
                activeUserId,
                selectedServerByUserId: this._normalizeSelectedServerMap(
                    data.selectedServerByUserId,
                    activeUserId
                ),
                deviceKey: this._normalizeDeviceKey(data.deviceKey),
            },
        };
    }

    private _clearCorruptedStoredCredentials(): void {
        safeLocalStorageRemove(PLEX_AUTH_CONSTANTS.STORAGE_KEY);
    }

    private _normalizeDeviceKey(deviceKey: unknown): PlexDeviceKey | null {
        if (!deviceKey || typeof deviceKey !== 'object') return null;
        const candidate = deviceKey as Partial<PlexDeviceKey> & { createdAt?: unknown; publicJwk?: unknown };
        const publicJwk = candidate.publicJwk as Record<string, unknown> | null | undefined;
        const createdAt = new Date(candidate.createdAt as string | number | Date);
        if (
            typeof candidate.kid !== 'string' || !candidate.kid ||
            typeof candidate.privateKey !== 'string' || !candidate.privateKey ||
            !publicJwk || publicJwk.kty !== 'OKP' || publicJwk.crv !== 'Ed25519' ||
            typeof publicJwk.x !== 'string' || publicJwk.alg !== 'EdDSA' ||
            Number.isNaN(createdAt.getTime())
        ) return null;
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
    ): PlexAuthData['selectedServerByUserId'] {
        const out: PlexAuthData['selectedServerByUserId'] = {};
        if (map && typeof map === 'object') {
            for (const [userId, value] of Object.entries(map)) {
                if (!userId) continue;
                const record = value as { serverId?: unknown; serverUri?: unknown } | null;
                out[userId] = {
                    serverId: typeof record?.serverId === 'string' ? record.serverId : null,
                    serverUri: typeof record?.serverUri === 'string' ? record.serverUri : null,
                };
            }
        }
        out[activeUserId] ??= { serverId: null, serverUri: null };
        return out;
    }

    private _sleep(ms: number, signal: AbortSignal | null): Promise<void> {
        throwIfAborted(signal);
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                signal?.removeEventListener('abort', onAbort);
                resolve();
            }, ms);
            const onAbort = (): void => {
                clearTimeout(timeoutId);
                reject(signal ? readAbortSignalReason(signal) : undefined);
            };
            signal?.addEventListener('abort', onAbort, { once: true });
            if (signal?.aborted) onAbort();
        });
    }
}
