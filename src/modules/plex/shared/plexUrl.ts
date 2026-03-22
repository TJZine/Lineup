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

export function isLikelyPlexServerKeyPath(keyOrUrl: string): boolean {
    if (typeof keyOrUrl !== 'string' || keyOrUrl.trim().length === 0) {
        return false;
    }
    const parsed = parseUrlLike(keyOrUrl.trim());
    if (!parsed) {
        return false;
    }
    return PLEX_SERVER_KEY_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix));
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
    if (!isLikelyPlexServerKeyPath(keyOrUrl)) {
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
