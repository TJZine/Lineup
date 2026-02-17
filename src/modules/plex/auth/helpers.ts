/**
 * @fileoverview Helper functions for Plex Authentication module.
 * Pure functions for HTTP requests, parsing, and client ID management.
 * @module modules/plex/auth/helpers
 * @version 1.0.0
 */

import { PLEX_AUTH_CONSTANTS } from './constants';
import { PlexAuthConfig, PlexAuthToken, PlexPinRequest, PlexHomeUser } from './interfaces';
import { AppErrorCode } from '../../lifecycle/types';

/**
 * Error class for Plex API errors.
 */
export class PlexApiError extends Error {
    public readonly code: AppErrorCode;
    public readonly httpStatus: number | undefined;
    public readonly retryable: boolean;

    constructor(
        code: AppErrorCode,
        message: string,
        httpStatus?: number,
        retryable: boolean = false
    ) {
        super(message);
        this.name = 'PlexApiError';
        this.code = code;
        this.httpStatus = httpStatus;
        this.retryable = retryable;
    }
}

// ============================================
// Client ID Management
// ============================================

/**
 * Generate a UUID v4.
 * Uses crypto.randomUUID() when available (modern browsers, webOS 6.0+),
 * falls back to Math.random() implementation for older environments.
 * @returns UUID string
 */
function generateUUID(): string {
    // Use native crypto.randomUUID if available (modern browsers, webOS 6.0+)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // Fallback: Simple UUID v4 implementation for ES2018
    const hex = '0123456789abcdef';
    let uuid = '';
    for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) {
            uuid += '-';
        } else if (i === 14) {
            uuid += '4';
        } else if (i === 19) {
            uuid += hex[(Math.random() * 4) | 8];
        } else {
            uuid += hex[(Math.random() * 16) | 0];
        }
    }
    return uuid;
}

/**
 * Get or generate persistent client identifier.
 * @returns Client identifier string
 */
export function getOrCreateClientId(): string {
    try {
        const stored = localStorage.getItem(PLEX_AUTH_CONSTANTS.CLIENT_ID_KEY);
        if (stored) {
            return stored;
        }
        const newId = generateUUID();
        try {
            localStorage.setItem(PLEX_AUTH_CONSTANTS.CLIENT_ID_KEY, newId);
        } catch {
            // Best-effort; return ephemeral ID if storage is blocked.
        }
        return newId;
    } catch {
        // Storage may be blocked (webOS/privacy mode); fall back to ephemeral ID.
        return generateUUID();
    }
}

// ============================================
// Header Building
// ============================================

/**
 * Build request headers for Plex API calls.
 * @param config - Plex auth configuration
 * @param token - Optional auth token
 * @param options - Optional additional headers
 * @returns Headers object
 */
export function buildRequestHeaders(
    config: PlexAuthConfig,
    token?: string,
    options?: { platformVersion?: string; deviceName?: string }
): Record<string, string> {
    const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Plex-Client-Identifier': config.clientIdentifier,
        'X-Plex-Product': config.product,
        'X-Plex-Version': config.version,
        'X-Plex-Platform': config.platform,
        'X-Plex-Device': config.device,
    };
    if (token) {
        headers['X-Plex-Token'] = token;
    }
    if (options?.platformVersion) {
        headers['X-Plex-Platform-Version'] = options.platformVersion;
    }
    if (options?.deviceName) {
        headers['X-Plex-Device-Name'] = options.deviceName;
    }
    return headers;
}

// ============================================
// Response Parsing
// ============================================

/**
 * Read plex.tv response as JSON when possible, otherwise text.
 */
export async function readPlexResponse(
    response: Response
): Promise<{ json?: unknown; text?: string }> {
    const contentType =
        response.headers && typeof response.headers.get === 'function'
            ? response.headers.get('Content-Type') || ''
            : '';
    try {
        // Prefer JSON parsing when server indicates JSON.
        if (contentType.includes('json') && typeof response.json === 'function') {
            try {
                return { json: await response.json() };
            } catch {
                // Fall through to text parsing.
            }
        }

        const text = await response.text();
        const trimmed = text.trim();

        // Robustness: plex.tv sometimes returns JSON with a non-JSON content-type.
        if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.length > 0) {
            try {
                return { json: JSON.parse(trimmed) };
            } catch {
                // Keep as text.
            }
        }

        return { text };
    } catch {
        return {};
    }
}

/**
 * Parse PIN response from Plex API.
 * @param data - Raw API response
 * @param fallbackClientId - Client ID for fallback
 * @returns Parsed PIN request
 */
export function parsePinResponse(
    data: Record<string, unknown>,
    fallbackClientId: string
): PlexPinRequest {
    const expiresAtValue = data['expiresAt'];
    const expiresAt = typeof expiresAtValue === 'string'
        ? new Date(expiresAtValue)
        : new Date();

    const authTokenValue = data['authToken'];
    const authToken = typeof authTokenValue === 'string' ? authTokenValue : null;

    const clientIdValue = data['clientIdentifier'];
    const clientIdentifier = typeof clientIdValue === 'string'
        ? clientIdValue
        : fallbackClientId;

    return {
        id: Number(data['id']),
        code: String(data['code']),
        expiresAt: expiresAt,
        authToken: authToken,
        clientIdentifier: clientIdentifier,
    };
}

/**
 * Parse user response from Plex API.
 * @param data - Raw API response
 * @param token - Auth token
 * @returns Parsed auth token
 */
export function parseUserResponse(
    data: Record<string, unknown>,
    token: string
): PlexAuthToken {
    const thumbValue = data['thumb'];
    const thumb = typeof thumbValue === 'string' ? thumbValue : '';
    const preferredSubtitleLanguage = extractPreferredSubtitleLanguage(data);

    return {
        token: token,
        userId: String(data['id']),
        username: String(data['username']),
        email: String(data['email']),
        thumb: thumb,
        expiresAt: null,
        issuedAt: new Date(),
        preferredSubtitleLanguage: preferredSubtitleLanguage,
    };
}

function coerceBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === '1' || normalized === 'true' || normalized === 'yes';
    }
    return false;
}

/**
 * Parse Plex Home users payload (JSON or XML) into PlexHomeUser list.
 */
export function parseHomeUsers(payload: unknown): PlexHomeUser[] {
    if (!payload) return [];

    if (typeof payload === 'string') {
        const text = payload.trim();
        if (!text) return [];
        if (text.startsWith('{') || text.startsWith('[')) {
            try {
                return parseHomeUsers(JSON.parse(text));
            } catch {
                // Fall through to XML parser.
            }
        }
        const xmlUsers = parseHomeUsersXml(text);
        if (xmlUsers.length > 0) {
            return xmlUsers;
        }
    }

    if (typeof payload === 'object') {
        const candidates = collectHomeUserCandidates(payload);
        if (candidates.length > 0) {
            const users = candidates
                .map((record) => parseHomeUserRecord(record))
                .filter((user): user is PlexHomeUser => user !== null);
            const deduped = new Map<string, PlexHomeUser>();
            for (const user of users) {
                if (!deduped.has(user.id)) {
                    deduped.set(user.id, user);
                }
            }
            return Array.from(deduped.values());
        }
    }

    return [];
}

/**
 * Parse home switch response to extract auth token.
 */
export function parseSwitchResponse(payload: unknown): { authToken: string } {
    if (!payload) {
        throw new PlexApiError(
            AppErrorCode.SERVER_UNREACHABLE,
            'Empty response from Plex Home switch',
            undefined,
            false
        );
    }

    if (typeof payload === 'string') {
        const token = parseSwitchTokenXml(payload);
        if (token) {
            return { authToken: token };
        }
    }

    if (typeof payload === 'object') {
        const data = payload as Record<string, unknown>;
        const authToken =
            (typeof data['authToken'] === 'string' ? data['authToken'] : null) ??
            (typeof data['authenticationToken'] === 'string' ? data['authenticationToken'] : null) ??
            (typeof data['token'] === 'string' ? data['token'] : null);
        if (authToken) {
            return { authToken };
        }
    }

    throw new PlexApiError(
        AppErrorCode.SERVER_UNREACHABLE,
        'Unable to parse Plex Home switch response',
        undefined,
        false
    );
}

function parseHomeUsersXml(payload: string): PlexHomeUser[] {
    if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(payload, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length === 0) {
            const users = getXmlUserNodes(doc)
                .map((node) => parseHomeUserAttributes(getXmlNodeAttributes(node)))
                .filter((user): user is PlexHomeUser => user !== null);
            if (users.length > 0) {
                const deduped = new Map<string, PlexHomeUser>();
                for (const user of users) {
                    if (!deduped.has(user.id)) {
                        deduped.set(user.id, user);
                    }
                }
                return Array.from(deduped.values());
            }
        }
    }

    return parseHomeUsersXmlFallback(payload);
}

function parseHomeUsersXmlFallback(payload: string): PlexHomeUser[] {
    const matches = payload.match(/<(?:User|HomeUser|user|homeUser)\b[^>]*>/g) ?? [];
    const users: PlexHomeUser[] = [];

    for (const raw of matches) {
        const attrs: Record<string, unknown> = {};
        const attrRegex = /([:\w-]+)=["']([^"']*)["']/g;
        let match: RegExpExecArray | null = null;
        while ((match = attrRegex.exec(raw)) !== null) {
            const key = match[1];
            if (key) {
                attrs[key] = match[2] ?? '';
            }
        }
        const parsed = parseHomeUserAttributes(attrs);
        if (parsed) users.push(parsed);
    }

    return users;
}

function collectHomeUserCandidates(payload: unknown): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    const queue: unknown[] = [payload];
    const userKeys = new Set([
        'user',
        'users',
        'homeuser',
        'homeusers',
        'manageduser',
        'managedusers',
        'account',
        'accounts',
    ]);

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) continue;

        if (Array.isArray(current)) {
            for (const item of current) {
                if (item && typeof item === 'object') {
                    queue.push(item);
                }
            }
            continue;
        }

        if (typeof current !== 'object') continue;
        const record = current as Record<string, unknown>;

        if (looksLikeHomeUserRecord(record)) {
            out.push(record);
        }

        for (const [key, value] of Object.entries(record)) {
            if (!value) continue;

            if (Array.isArray(value)) {
                if (userKeys.has(key.toLowerCase())) {
                    for (const item of value) {
                        if (item && typeof item === 'object') {
                            out.push(item as Record<string, unknown>);
                        }
                    }
                    continue;
                } else {
                    for (const item of value) {
                        if (item && typeof item === 'object') {
                            queue.push(item);
                        }
                    }
                }
                continue;
            }

            if (typeof value === 'object') {
                if (userKeys.has(key.toLowerCase())) {
                    out.push(value as Record<string, unknown>);
                }
                queue.push(value);
            }
        }
    }

    return out;
}

function looksLikeHomeUserRecord(record: Record<string, unknown>): boolean {
    const id = getRecordValue(record, ['id', 'userid', 'uuid', 'key']);
    const title = getRecordValue(record, ['title', 'username', 'name']);
    const hasHomeSignals = [
        'admin',
        'isAdmin',
        'protected',
        'hasPassword',
        'pinProtected',
        'restricted',
        'home',
    ].some((key) => typeof getRecordValue(record, [key]) !== 'undefined');
    if (typeof id === 'undefined' || id === null) return false;
    if (String(id).trim().length === 0) return false;
    if (typeof title === 'undefined' || title === null) return false;
    if (String(title).trim().length === 0) return false;
    return hasHomeSignals;
}

function parseHomeUserRecord(record: Record<string, unknown>): PlexHomeUser | null {
    return parseHomeUserAttributes(record);
}

function parseHomeUserAttributes(attrs: Record<string, unknown>): PlexHomeUser | null {
    const idValue = getRecordValue(attrs, ['id', 'userID', 'userId', 'userid', 'key']);
    const titleValue = getRecordValue(attrs, ['title', 'username', 'name']);
    const id = String(idValue ?? '').trim();
    const title = String(titleValue ?? '').trim();
    if (id.length === 0 || title.length === 0) {
        return null;
    }

    const thumbValue = getRecordValue(attrs, ['thumb', 'avatar', 'avatarUrl']);
    const thumb = typeof thumbValue === 'string' && thumbValue.trim().length > 0
        ? thumbValue
        : null;

    const restrictedValue = getRecordValue(attrs, ['restricted']);
    const protectedValue = getRecordValue(attrs, ['protected', 'hasPassword', 'pinProtected']);
    const adminValue = getRecordValue(attrs, ['admin', 'isAdmin']);

    const baseUser = {
        id,
        title,
        thumb,
        admin: coerceBoolean(adminValue),
        protected: coerceBoolean(protectedValue),
    };

    return {
        ...baseUser,
        ...(typeof restrictedValue === 'undefined' ? {} : { restricted: coerceBoolean(restrictedValue) }),
    };
}

function getRecordValue(record: Record<string, unknown>, keys: string[]): unknown {
    const normalized = new Set(keys.map((key) => key.toLowerCase()));
    for (const [key, value] of Object.entries(record)) {
        if (normalized.has(key.toLowerCase())) {
            return value;
        }
    }
    return undefined;
}

function getXmlUserNodes(doc: Document): Element[] {
    const names = ['User', 'HomeUser', 'user', 'homeUser'];
    const nodes: Element[] = [];
    for (const name of names) {
        nodes.push(...Array.from(doc.getElementsByTagName(name)));
    }
    return nodes;
}

function getXmlNodeAttributes(node: Element): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (let i = 0; i < node.attributes.length; i++) {
        const attr = node.attributes.item(i);
        if (!attr) continue;
        out[attr.name] = attr.value;
    }
    return out;
}

function parseSwitchTokenXml(payload: string): string | null {
    if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(payload, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length === 0) {
            const root = doc.documentElement;
            const attrToken = root?.getAttribute?.('authenticationToken');
            if (attrToken) return attrToken;
            const userNode = doc.getElementsByTagName('User')[0];
            if (userNode) {
                const userToken = userNode.getAttribute('authenticationToken');
                if (userToken) return userToken;
            }
        }
    }

    const attrMatch = payload.match(/authenticationToken="([^"]+)"/);
    if (attrMatch && attrMatch[1]) {
        return attrMatch[1];
    }
    const nodeMatch = payload.match(/<authenticationToken>([^<]+)<\/authenticationToken>/i);
    if (nodeMatch && nodeMatch[1]) {
        return nodeMatch[1];
    }
    return null;
}

function extractPreferredSubtitleLanguage(data: Record<string, unknown>): string | null {
    const direct = coerceLanguageValue(data['preferredSubtitleLanguage']) ??
        coerceLanguageValue(data['subtitleLanguage']) ??
        coerceLanguageValue(data['preferredSubtitleLanguageCode']) ??
        coerceLanguageValue(data['subtitleLanguageCode']);
    if (direct) return direct;

    const settings = data['settings'];
    if (settings && typeof settings === 'object') {
        const prefs = settings as Record<string, unknown>;
        return coerceLanguageValue(prefs['preferredSubtitleLanguage']) ??
            coerceLanguageValue(prefs['subtitleLanguage']) ??
            coerceLanguageValue(prefs['preferredSubtitleLanguageCode']) ??
            coerceLanguageValue(prefs['subtitleLanguageCode']);
    }

    return null;
}

function coerceLanguageValue(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

// ============================================
// HTTP Helpers
// ============================================

/**
 * Sleep helper for delays.
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

/**
 * Fetch with a hard timeout and optional external AbortSignal.
 * Aborts when either the timeout elapses or the external signal aborts.
 *
 * Note: Avoid logging URL/init from callers; tokens may be present in headers.
 */
export async function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number,
    externalSignal?: AbortSignal | null
): Promise<Response> {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const onAbort = (): void => {
        try {
            controller.abort();
        } catch {
            // ignore
        }
    };

    if (externalSignal) {
        if (externalSignal.aborted) {
            onAbort();
        } else {
            externalSignal.addEventListener('abort', onAbort, { once: true });
        }
    }

    try {
        timeoutId = setTimeout(() => {
            onAbort();
        }, timeoutMs);
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        if (externalSignal) {
            try {
                externalSignal.removeEventListener('abort', onAbort);
            } catch {
                // ignore
            }
        }
    }
}

/**
 * Handle HTTP response status and throw appropriate errors.
 * @param response - Fetch response
 * @throws PlexApiError for error statuses
 */
function handleResponseStatus(response: Response): void {
    // Authentication errors - not retryable
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
    // Rate limiting - retryable
    if (response.status === 429) {
        throw new PlexApiError(
            AppErrorCode.RATE_LIMITED,
            'Rate limited by Plex API',
            429,
            true
        );
    }
    // Not found - not retryable
    if (response.status === 404) {
        throw new PlexApiError(
            AppErrorCode.RESOURCE_NOT_FOUND,
            'Resource not found',
            404,
            false
        );
    }
    // Server errors - retryable
    if (response.status >= 500) {
        throw new PlexApiError(
            AppErrorCode.SERVER_UNREACHABLE,
            'Server error: ' + String(response.status),
            response.status,
            true
        );
    }
}

/**
 * Create a network error.
 * @returns PlexApiError for network failures
 */
function createNetworkError(): PlexApiError {
    return new PlexApiError(
        AppErrorCode.SERVER_UNREACHABLE,
        'Network error',
        undefined,
        true
    );
}

/**
 * Fetch with retry logic and exponential backoff.
 * @param url - URL to fetch
 * @param options - Fetch options
 * @returns Response object
 * @throws PlexApiError on exhausted retries
 */
export async function fetchWithRetry(
    url: string,
    options: RequestInit
): Promise<Response> {
    let lastError: Error = new Error('Unknown error');
    let delay = PLEX_AUTH_CONSTANTS.RETRY_DELAY_MS;

    for (let attempt = 0; attempt < PLEX_AUTH_CONSTANTS.RETRY_ATTEMPTS; attempt++) {
        try {
            const controller = new AbortController();
            const externalSignal = options.signal ?? null;
            const onAbort = (): void => {
                try {
                    controller.abort();
                } catch {
                    // ignore
                }
            };

            if (externalSignal) {
                if (externalSignal.aborted) {
                    onAbort();
                } else {
                    externalSignal.addEventListener('abort', onAbort, { once: true });
                }
            }

            const timeoutId = setTimeout(() => onAbort(), PLEX_AUTH_CONSTANTS.REQUEST_TIMEOUT_MS);

            let response: Response;
            try {
                response = await fetch(url, { ...options, signal: controller.signal });
            } finally {
                clearTimeout(timeoutId);
                if (externalSignal) {
                    try {
                        externalSignal.removeEventListener('abort', onAbort);
                    } catch {
                        // ignore
                    }
                }
            }
            handleResponseStatus(response);
            return response;
        } catch (error) {
            if (error instanceof PlexApiError && !error.retryable) {
                throw error;
            }
            lastError = error instanceof PlexApiError ? error : createNetworkError();

            if (attempt < PLEX_AUTH_CONSTANTS.RETRY_ATTEMPTS - 1) {
                await sleep(delay);
                delay = delay * 2;
            }
        }
    }
    throw lastError;
}
