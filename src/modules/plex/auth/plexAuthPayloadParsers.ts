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
    data: unknown,
    fallbackClientId: string
): PlexPinRequest {
    const payload = requireRecord(data, 'PIN response');
    const id = requireFiniteNumber(payload['id'], 'PIN response id');
    const code = requireNonEmptyString(payload['code'], 'PIN response code');
    const expiresAt = requireDate(payload['expiresAt'], 'PIN response expiresAt');
    const authToken = readNullableString(payload['authToken'], 'PIN response authToken');
    const clientIdentifier = readOptionalString(payload['clientIdentifier']) ?? fallbackClientId;

    return {
        id,
        code,
        expiresAt,
        authToken,
        clientIdentifier,
    };
}

/**
 * Parse user response from Plex API.
 * @param data - Raw API response
 * @param token - Auth token
 * @returns Parsed auth token
 */
export function parseUserResponse(
    data: unknown,
    token: string
): PlexAuthToken {
    const payload = requireRecord(data, 'User response');
    const userId = requireUserId(payload['id'], 'Plex user id');
    const username = requireNonEmptyString(payload['username'], 'Plex username');
    const email = requireNonEmptyString(payload['email'], 'Plex user email');
    const thumbValue = payload['thumb'];
    const thumb = typeof thumbValue === 'string' ? thumbValue : '';
    const preferredSubtitleLanguage = extractPreferredSubtitleLanguage(payload);

    return {
        token: token,
        userId,
        username,
        email,
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

function requireRecord(value: unknown, label: string): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }

    throw new PlexApiError(
        AppErrorCode.PARSE_ERROR,
        `${label} was not an object`,
        undefined,
        false
    );
}

function requireFiniteNumber(value: unknown, label: string): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    throw new PlexApiError(
        AppErrorCode.PARSE_ERROR,
        `${label} was missing or invalid`,
        undefined,
        false
    );
}

function requireNonEmptyString(value: unknown, label: string): string {
    if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
    }

    throw new PlexApiError(
        AppErrorCode.PARSE_ERROR,
        `${label} was missing or invalid`,
        undefined,
        false
    );
}

function requireUserId(value: unknown, label: string): string {
    if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }

    throw new PlexApiError(
        AppErrorCode.PARSE_ERROR,
        `${label} was missing or invalid`,
        undefined,
        false
    );
}

function requireDate(value: unknown, label: string): Date {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new PlexApiError(
            AppErrorCode.PARSE_ERROR,
            `${label} was missing or invalid`,
            undefined,
            false
        );
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new PlexApiError(
            AppErrorCode.PARSE_ERROR,
            `${label} was missing or invalid`,
            undefined,
            false
        );
    }

    return parsed;
}

function readNullableString(value: unknown, label: string): string | null {
    if (value === undefined || value === null) {
        return null;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    throw new PlexApiError(
        AppErrorCode.PARSE_ERROR,
        `${label} was invalid`,
        undefined,
        false
    );
}

function readOptionalString(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
