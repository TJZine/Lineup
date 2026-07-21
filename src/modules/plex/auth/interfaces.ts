import { IDisposable } from '../../../utils/interfaces';

/**
 * Public JWK used for JWT-based Plex auth (Ed25519).
 * Only required for the JWT flow.
 */
export interface PlexPublicJwk {
    kty: 'OKP';
    crv: 'Ed25519';
    x: string;
    alg: 'EdDSA';
    use?: 'sig';
    kid?: string;
}

/**
 * Device key metadata for JWT-based auth.
 */
export interface PlexDeviceKey {
    kid: string;
    publicJwk: PlexPublicJwk;
    /** Base64url-encoded Ed25519 private key (store securely when possible) */
    privateKey: string;
    createdAt: Date;
}

export interface PlexAuthConfig {
    /** Unique app instance ID resolved/persisted at config assembly (constructor does not re-resolve) */
    clientIdentifier: string;
    product: string;
    version: string;
    platform: string;
    platformVersion: string;
    device: string;
    deviceName: string;
}
export interface PlexPinRequest {
    /** Plex-assigned PIN ID for polling */
    id: number;
    /** PIN code for user to enter (length varies by flow) */
    code: string;
    /** PIN expiration time (typically 5 minutes) */
    expiresAt: Date;
    /** Populated when user claims the PIN - null until then */
    authToken: string | null;
    /** Client identifier used when requesting this PIN */
    clientIdentifier: string;
}

export interface PlexHomeUser {
    id: string;
    title: string;
    thumb: string | null;
    admin: boolean;
    protected: boolean;
    restricted?: boolean;
}

export interface PlexAuthToken {
    token: string;
    userId: string;
    username: string;
    email: string;
    thumb: string;
    /**
     * Token expiration time (if known).
     * Plex tokens may be short-lived (e.g., JWTs); treat `null` as "unknown".
     */
    expiresAt: Date | null;
    issuedAt: Date;
    /** Preferred subtitle language (if provided by Plex user profile) */
    preferredSubtitleLanguage?: string | null;
}

export interface PlexAuthDataV2 {
    /** Token used for plex.tv Home endpoints (account/admin) */
    accountToken: PlexAuthToken;
    /** Token used for PMS/library/stream requests (active profile) */
    activeToken: PlexAuthToken;
    /** Last-selected server per profile */
    selectedServerByUserId: Record<string, { serverId: string | null; serverUri: string | null }>;
    /** Convenience: active user id */
    activeUserId: string;
    /** Device key metadata for JWT flow (optional) */
    deviceKey?: PlexDeviceKey | null;
}

export type PlexAuthData = PlexAuthDataV2;

export type PlexStoredCredentialsReadCorruptionReason =
    | 'invalid-json'
    | 'invalid-shape'
    | 'unsupported-version';

export type PlexStoredCredentialsReadResult =
    | { kind: 'missing' }
    | { kind: 'available'; credentials: PlexAuthData }
    | { kind: 'corrupted'; reason: PlexStoredCredentialsReadCorruptionReason };

/** Owner-bound continuation proof for one successful stored-credential validation. */
export interface PlexAuthValidationGuard {
    readonly signal: AbortSignal;
    assertCurrent(): void;
}

export type PlexStoredCredentialsValidationResult =
    | { kind: 'missing'; guard: PlexAuthValidationGuard }
    | { kind: 'corrupted'; reason: PlexStoredCredentialsReadCorruptionReason; guard: PlexAuthValidationGuard }
    | { kind: 'invalid'; guard: PlexAuthValidationGuard }
    | { kind: 'active_valid'; guard: PlexAuthValidationGuard }
    | { kind: 'account_fallback_valid'; guard: PlexAuthValidationGuard };

export interface PlexAuthState {
    config: PlexAuthConfig;
    accountToken: PlexAuthToken | null;
    activeToken: PlexAuthToken | null;
    /** Active profile identity key used for per-profile storage scoping */
    activeUserId: string | null;
    isValidated: boolean;
    pendingPin: PlexPinRequest | null;
}

export interface StoredAuthData {
    version: number;
    data: PlexAuthData;
}
export interface PlexAuthEvents {
    authChange: boolean;
    profileChange: { fromUserId: string | null; toUserId: string };
}

/**
 * Signal-aware auth methods rethrow caller-triggered abort reasons so explicit cancellation
 * remains distinguishable from typed Plex API failures.
 */
export interface IPlexAuth {
    requestPin(options?: { signal?: AbortSignal | null }): Promise<PlexPinRequest>;

    checkPinStatus(pinId: number, options?: { signal?: AbortSignal | null }): Promise<PlexPinRequest>;

    cancelPin(pinId: number): Promise<void>;

    pollForPin(pinId: number, options?: { signal?: AbortSignal | null }): Promise<PlexPinRequest>;

    /**
     * Verify a token is still valid by calling Plex API.
     * @param token - Plex auth token to validate
     * @returns true for valid token; false only for explicit auth-invalid (401/403) outcomes
     * @throws PlexApiError for timeout, service/network failures, and malformed success payloads
     */
    validateToken(token: string, options?: { signal?: AbortSignal | null }): Promise<boolean>;

    /**
     * Validate and conditionally commit the current stored credentials as one auth-owned operation.
     * The returned opaque guard remains current only until a newer credential authority starts.
     */
    validateStoredCredentials(options?: {
        signal?: AbortSignal | null;
    }): Promise<PlexStoredCredentialsValidationResult>;

    /**
     * Read-only cloud probe used to classify a PMS authorization rejection without
     * acquiring or mutating credential authority.
     */
    probeCurrentCredentialValidity(options?: {
        signal?: AbortSignal | null;
    }): Promise<PlexCurrentCredentialValidity>;

    /**
     * Fetch Plex Home profiles using the account token.
     * @returns [] only when Plex Home is unsupported or no profiles are available
     * @throws PlexApiError AUTH_REQUIRED/AUTH_INVALID for explicit credential failures
     * @throws PlexApiError PARSE_ERROR when Plex returns a malformed success payload
     */
    getHomeUsers(options?: { signal?: AbortSignal | null }): Promise<PlexHomeUser[]>;

    /**
     * Switch the active Plex Home profile.
     * @throws PlexApiError AUTH_REQUIRED/AUTH_INVALID for credential failures
     * @throws PlexApiError AUTH_FAILED when the supplied PIN is incorrect
     * @throws PlexApiError RESOURCE_NOT_FOUND when Plex Home switching is unavailable
     */
    switchHomeUser(userId: string, options?: { pin?: string | null; signal?: AbortSignal | null }): Promise<void>;

    getActiveUserId(): string | null;

    getAccountUserId(): string | null;

    /** Starts credential authority even when no account exists; committed success survives listener re-entry. */
    logoutActiveUser(): Promise<void>;

    /**
     * Get stored credentials from localStorage.
     * This is a synchronous local storage read/cleanup operation.
     * @returns Explicit stored-read classification
     */
    readStoredCredentialsAndClearCorruption(): PlexStoredCredentialsReadResult;

    /**
     * Persist credentials to localStorage and update in-memory auth state synchronously.
     */
    storeCredentials(auth: PlexAuthData, options?: { emitAuthChange?: boolean }): void;

    /**
     * Clear persisted credentials and in-memory auth state synchronously.
     */
    clearCredentials(): void;

    isAuthenticated(): boolean;

    getCurrentUser(): PlexAuthToken | null;

    getAuthHeaders(): Record<string, string>;
    on(event: 'authChange', handler: (isAuthenticated: boolean) => void): IDisposable;
    on(
        event: 'profileChange',
        handler: (payload: { fromUserId: string | null; toUserId: string }) => void
    ): IDisposable;
}

export type PlexCurrentCredentialValidity =
    | { kind: 'active_valid' }
    | { kind: 'managed_profile_invalid'; accountValid: true }
    | { kind: 'account_expired' }
    | { kind: 'superseded' };
