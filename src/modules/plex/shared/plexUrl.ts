/**
 * @fileoverview Plex URL utilities for shared stream and trust-boundary policy.
 * @module modules/plex/shared/plexUrl
 */

export const PLEX_SERVER_KEY_PREFIXES = ['/library/', '/video/', '/:/'] as const;
export const PLEX_CLOUD_TRUSTED_ORIGINS = ['https://plex.tv', 'https://clients.plex.tv'] as const;

function parseUrlLike(value: string): URL | null {
    try {
        return new URL(value);
    } catch {
        try {
            return new URL(value, 'http://placeholder.invalid');
        } catch {
            return null;
        }
    }
}

function isAbsoluteHttpUrl(value: string): boolean {
    return /^https?:\/\//i.test(value.trim());
}

export function isLikelyPlexServerKeyPath(keyOrUrl: string): boolean {
    if (typeof keyOrUrl !== 'string' || keyOrUrl.trim().length === 0) {
        return false;
    }
    const trimmed = keyOrUrl.trim();
    if (isAbsoluteHttpUrl(trimmed)) {
        return false;
    }
    const parsed = parseUrlLike(trimmed);
    if (!parsed) {
        return false;
    }
    return PLEX_SERVER_KEY_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix));
}

export type PlexUrlOriginClassification =
    | 'server-relative'
    | 'server-absolute'
    | 'foreign-absolute'
    | 'invalid';

export function classifyPlexUrlOrigin(baseUri: string, keyOrUrl: string): PlexUrlOriginClassification {
    if (typeof keyOrUrl !== 'string' || keyOrUrl.trim().length === 0) {
        return 'invalid';
    }
    let baseOrigin: string;
    try {
        baseOrigin = new URL(baseUri).origin;
    } catch {
        return 'invalid';
    }

    const trimmed = keyOrUrl.trim();
    const parsed = parseUrlLike(trimmed);
    if (!parsed) {
        return 'invalid';
    }

    const hasKnownPrefix = PLEX_SERVER_KEY_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix));
    if (!hasKnownPrefix) {
        return isAbsoluteHttpUrl(trimmed) ? 'foreign-absolute' : 'invalid';
    }

    if (!isAbsoluteHttpUrl(trimmed)) {
        return 'server-relative';
    }

    return parsed.origin === baseOrigin ? 'server-absolute' : 'foreign-absolute';
}

export function buildPlexUrlFromKey(baseUri: string, keyOrPath: string): URL {
    const baseUrl = new URL(baseUri);
    const parsedPart = new URL(keyOrPath, baseUrl.origin);
    const normalizedPartKey = `${parsedPart.pathname}${parsedPart.search}`;
    return new URL(
        normalizedPartKey.startsWith('/') ? normalizedPartKey : `/${normalizedPartKey}`,
        baseUrl.origin
    );
}

export function tryBuildPlexServerUrlFromKey(baseUri: string, keyOrUrl: string): URL | null {
    const classification = classifyPlexUrlOrigin(baseUri, keyOrUrl);
    if (classification !== 'server-relative' && classification !== 'server-absolute') {
        return null;
    }
    return buildPlexUrlFromKey(baseUri, keyOrUrl);
}

export function applyXPlexTokenQueryParam(params: URLSearchParams, token: string | null): void {
    if (typeof token !== 'string' || token.length === 0) {
        return;
    }
    params.set('X-Plex-Token', token);
}

export function applyXPlexTokenQueryParamIfTrusted(
    url: URL,
    token: string | null,
    trustedOrigins: readonly string[]
): void {
    if (!trustedOrigins.includes(url.origin)) {
        return;
    }
    applyXPlexTokenQueryParam(url.searchParams, token);
}

export function applyXPlexQueryParamsFromHeaders(
    params: URLSearchParams,
    headers: Record<string, unknown>
): void {
    for (const [key, value] of Object.entries(headers)) {
        if (!key.startsWith('X-Plex-')) {
            continue;
        }
        if (typeof value !== 'string' || value.length === 0) {
            continue;
        }
        params.set(key, value);
    }
}
