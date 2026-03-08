/**
 * @fileoverview Plex URL utilities for stream resolution.
 * @module modules/plex/stream/plexUrl
 */

export function buildPlexUrlFromKey(baseUri: string, keyOrPath: string): URL {
    const baseUrl = new URL(baseUri);
    const parsedPart = new URL(keyOrPath, baseUrl.origin);
    const normalizedPartKey = `${parsedPart.pathname}${parsedPart.search}`;
    return new URL(
        normalizedPartKey.startsWith('/') ? normalizedPartKey : `/${normalizedPartKey}`,
        baseUrl.origin
    );
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
