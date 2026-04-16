import { AppErrorCode } from '../../lifecycle/types';
import { PlexApiError } from './plexAuthTransport';

const SWITCH_TOKEN_KEYS = ['authToken', 'authenticationToken', 'token'] as const;

type SwitchPayloadResult = { authToken: string };

export function parseSwitchPayloadData(payload: unknown): SwitchPayloadResult {
    const token = findSwitchTokenInPayload(payload, new WeakSet<object>());
    if (token) {
        return { authToken: token };
    }

    if (typeof payload === 'string') {
        return parseSwitchPayloadText(payload);
    }

    throw new PlexApiError(
        AppErrorCode.PARSE_ERROR,
        'Plex Home switch response did not include auth token',
        undefined,
        false
    );
}

function parseSwitchPayloadText(payload: string): SwitchPayloadResult {
    const text = payload.trim();

    if (text.startsWith('{') || text.startsWith('[')) {
        try {
            return parseSwitchPayloadData(JSON.parse(text));
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

    throw new PlexApiError(
        AppErrorCode.PARSE_ERROR,
        'Plex Home switch response did not include auth token',
        undefined,
        false
    );
}

function parseSwitchTokenXml(payload: string): string | null {
    return parseSwitchTokenDocument(payload) ?? parseSwitchTokenText(payload);
}

function parseSwitchTokenDocument(payload: string): string | null {
    if (typeof DOMParser === 'undefined') {
        return null;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(payload, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
        return null;
    }

    const candidates = [
        doc.documentElement,
        doc.getElementsByTagName('User')[0],
        doc.getElementsByTagName('HomeUser')[0],
    ];

    for (const candidate of candidates) {
        const token = readTokenFromXmlNode(candidate);
        if (token) {
            return token;
        }
    }

    return null;
}

function readTokenFromXmlNode(node: Element | null | undefined): string | null {
    if (!node) {
        return null;
    }

    const attrToken = findSwitchToken(readXmlNodeAttributes(node));
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

function parseSwitchTokenText(payload: string): string | null {
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

function findSwitchToken(record: Record<string, unknown>): string | null {
    const normalizedKeys = new Set(SWITCH_TOKEN_KEYS.map((key) => key.toLowerCase()));

    for (const [key, value] of Object.entries(record)) {
        if (!normalizedKeys.has(key.toLowerCase()) || typeof value !== 'string') {
            continue;
        }

        const trimmed = value.trim();
        if (trimmed.length > 0) {
            return trimmed;
        }
    }

    return null;
}

function findSwitchTokenInPayload(
    payload: unknown,
    seen: WeakSet<object>
): string | null {
    if (!payload) {
        return null;
    }

    if (Array.isArray(payload)) {
        for (const entry of payload) {
            const token = findSwitchTokenInPayload(entry, seen);
            if (token) {
                return token;
            }
        }
        return null;
    }

    if (typeof payload !== 'object') {
        return null;
    }

    if (seen.has(payload)) {
        return null;
    }
    seen.add(payload);

    const record = payload as Record<string, unknown>;
    const direct = findSwitchToken(record);
    if (direct) {
        return direct;
    }

    for (const value of Object.values(record)) {
        const nested = findSwitchTokenInPayload(value, seen);
        if (nested) {
            return nested;
        }
    }

    return null;
}

function readXmlNodeAttributes(node: Element): Record<string, unknown> {
    return Object.fromEntries(
        Array.from(node.attributes, (attribute) => [attribute.name, attribute.value] as const)
    );
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
