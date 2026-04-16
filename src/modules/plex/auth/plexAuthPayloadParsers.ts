import type { PlexAuthToken, PlexPinRequest, PlexHomeUser } from './interfaces';
import { AppErrorCode } from '../../lifecycle/types';
import { PlexApiError } from './plexAuthTransport';
import { parseHomeUsersPayloadData } from './plexHomeUsersPayloadParser';
import { parseSwitchPayloadData } from './plexSwitchPayloadParser';

export type PlexResponsePayload =
    | { kind: 'json'; data: unknown }
    | { kind: 'text'; data: string }
    | { kind: 'empty' };

const PREFERRED_SUBTITLE_LANGUAGE_KEYS = [
    'preferredSubtitleLanguage',
    'subtitleLanguage',
    'preferredSubtitleLanguageCode',
    'subtitleLanguageCode',
] as const;

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

export function parseHomeUsersPayload(payload: PlexResponsePayload): PlexHomeUser[] {
    if (payload.kind === 'empty') {
        return [];
    }
    return parseHomeUsersPayloadData(payload.data);
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
    return parseSwitchPayloadData(payload.data);
}

function coerceLanguageValue(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function extractPreferredSubtitleLanguage(data: Record<string, unknown>): string | null {
    return (
        extractPreferredSubtitleLanguageFromRecord(data) ??
        extractPreferredSubtitleLanguageFromSettings(data['settings'])
    );
}

function extractPreferredSubtitleLanguageFromRecord(
    record: Record<string, unknown>
): string | null {
    for (const key of PREFERRED_SUBTITLE_LANGUAGE_KEYS) {
        const value = coerceLanguageValue(record[key]);
        if (value) {
            return value;
        }
    }

    return null;
}

function extractPreferredSubtitleLanguageFromSettings(settings: unknown): string | null {
    if (!settings || typeof settings !== 'object') {
        return null;
    }
    return extractPreferredSubtitleLanguageFromRecord(settings as Record<string, unknown>);
}
