import type { PlexAuthToken, PlexPinRequest, PlexHomeUser } from './interfaces';
import { AppErrorCode } from '../../lifecycle/types';
import { PlexApiError } from './plexAuthTransport';

export type PlexResponsePayload =
    | { kind: 'json'; data: unknown }
    | { kind: 'text'; data: string }
    | { kind: 'empty' };

const SWITCH_TOKEN_KEYS = ['authToken', 'authenticationToken', 'token'] as const;

/**
 * Read plex.tv response as JSON when possible, otherwise text.
 */
export async function readPlexResponse(response: Response): Promise<PlexResponsePayload> {
    const contentType =
        response.headers && typeof response.headers.get === 'function'
            ? response.headers.get('Content-Type') || ''
            : '';

    const text = await response.text();
    const trimmed = text.trim();

    if (trimmed.length === 0) {
        return { kind: 'empty' };
    }

    // plex.tv occasionally returns JSON payloads with a mismatched content-type.
    if (contentType.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            return { kind: 'json', data: JSON.parse(trimmed) };
        } catch {
            throw new PlexApiError(
                AppErrorCode.PARSE_ERROR,
                'Unable to parse Plex response JSON payload',
                undefined,
                false
            );
        }
    }

    return { kind: 'text', data: text };
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

function parseHomeUsersFromUnknown(payload: unknown): PlexHomeUser[] {
    if (!payload) return [];

    if (typeof payload === 'string') {
        const text = payload.trim();
        if (!text) return [];
        if (text.startsWith('{') || text.startsWith('[')) {
            try {
                return parseHomeUsersFromUnknown(JSON.parse(text));
            } catch {
                throw new PlexApiError(
                    AppErrorCode.PARSE_ERROR,
                    'Unable to parse Plex Home users JSON payload',
                    undefined,
                    false
                );
            }
        }
        if (text.startsWith('<')) {
            const xmlUsers = parseHomeUsersXml(text);
            if (xmlUsers.length > 0) {
                return xmlUsers;
            }
            if (isStructurallyValidXml(text)) {
                return [];
            }
            return parseHomeUsersXmlFallback(text);
        }
        return [];
    }

    if (typeof payload === 'object') {
        return dedupeHomeUsersById(
            collectHomeUserCandidates(payload)
                .map(parseHomeUserRecord)
                .filter((user): user is PlexHomeUser => user !== null)
        );
    }

    return [];
}

export function parseHomeUsersPayload(payload: PlexResponsePayload): PlexHomeUser[] {
    if (payload.kind === 'empty') return [];
    if (payload.kind === 'json') {
        return parseHomeUsersFromUnknown(payload.data);
    }
    return parseHomeUsersFromUnknown(payload.data);
}

function isStructurallyValidXml(payload: string): boolean {
    if (typeof DOMParser !== 'function') return false;
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(payload, 'application/xml');
        return doc.getElementsByTagName('parsererror').length === 0;
    } catch {
        return false;
    }
}

function parseSwitchResponseFromUnknown(payload: unknown): { authToken: string } {
    if (payload && typeof payload === 'object') {
        const obj = payload as Record<string, unknown>;
        const direct = getRecordStringValue(obj, SWITCH_TOKEN_KEYS);
        if (direct) {
            return { authToken: direct };
        }
    }

    if (typeof payload === 'string') {
        const text = payload.trim();
        if (text.startsWith('{') || text.startsWith('[')) {
            try {
                return parseSwitchResponseFromUnknown(JSON.parse(text));
            } catch {
                throw new PlexApiError(
                    AppErrorCode.PARSE_ERROR,
                    'Unable to parse Plex Home switch JSON payload',
                    undefined,
                    false
                );
            }
        }
        if (text.startsWith('<')) {
            const token = parseSwitchTokenXml(text);
            if (token) {
                return { authToken: token };
            }
        }
    }

    throw new PlexApiError(
        AppErrorCode.PARSE_ERROR,
        'Plex Home switch response did not include auth token',
        undefined,
        false
    );
}

export function parseSwitchResponsePayload(payload: PlexResponsePayload): { authToken: string } {
    if (payload.kind === 'empty') {
        throw new PlexApiError(
            AppErrorCode.PARSE_ERROR,
            'Plex Home switch response was empty',
            undefined,
            false
        );
    }
    return parseSwitchResponseFromUnknown(payload.data);
}

function parseHomeUsersXml(payload: string): PlexHomeUser[] {
    if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(payload, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length === 0) {
            const users = dedupeHomeUsersById(
                getXmlUserNodes(doc)
                    .map((node) => parseHomeUserAttributes(getXmlNodeAttributes(node)))
                    .filter((user): user is PlexHomeUser => user !== null)
            );
            if (users.length > 0) {
                return users;
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

    return dedupeHomeUsersById(users);
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
            const candidates = [
                doc.documentElement,
                doc.getElementsByTagName('User')[0],
                doc.getElementsByTagName('HomeUser')[0],
            ];
            for (const candidate of candidates) {
                const token = getXmlTokenValue(candidate);
                if (token) {
                    return token;
                }
            }
        }
    }

    return getTokenFromXmlText(payload);
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

function dedupeHomeUsersById(users: PlexHomeUser[]): PlexHomeUser[] {
    const deduped = new Map<string, PlexHomeUser>();
    for (const user of users) {
        if (!deduped.has(user.id)) {
            deduped.set(user.id, user);
        }
    }
    return Array.from(deduped.values());
}

function getRecordStringValue(record: Record<string, unknown>, keys: readonly string[]): string | null {
    const value = getRecordValue(record, Array.from(keys));
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function getXmlTokenValue(node: Element | null | undefined): string | null {
    if (!node) {
        return null;
    }

    const attrToken = getRecordStringValue(getXmlNodeAttributes(node), SWITCH_TOKEN_KEYS);
    if (attrToken) {
        return attrToken;
    }

    for (const key of SWITCH_TOKEN_KEYS) {
        const child = node.getElementsByTagName(key)[0];
        const value = child?.textContent?.trim();
        if (value) {
            return value;
        }
    }

    return null;
}

function getTokenFromXmlText(payload: string): string | null {
    for (const key of SWITCH_TOKEN_KEYS) {
        const escapedKey = escapeRegExp(key);
        const attrMatch = payload.match(new RegExp(`${escapedKey}=["']([^"']+)["']`, 'i'));
        if (attrMatch?.[1]) {
            return attrMatch[1];
        }

        const nodeMatch = payload.match(new RegExp(`<${escapedKey}>([^<]+)</${escapedKey}>`, 'i'));
        if (nodeMatch?.[1]) {
            return nodeMatch[1];
        }
    }

    return null;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
