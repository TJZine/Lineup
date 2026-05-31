import {
    applyXPlexTokenQueryParamFromHeaders,
    readXPlexTokenFromHeaders,
    tryBuildPlexServerUrlFromKey,
} from '../../shared/plexUrl';

export type PlexSubtitleProbeUrlSource = 'key' | 'id_fallback';

export interface PlexSubtitleProbeTarget {
    id: string;
    key?: string | undefined;
}

export interface PlexSubtitleProbeTransportContext {
    serverUri: string | null;
    resolvedBaseUrl?: string | undefined;
    authHeaders: Record<string, string>;
    itemKey?: string | undefined;
}

export interface PlexSubtitleProbeResolvedUrl {
    baseUrl: URL;
    urlSource: PlexSubtitleProbeUrlSource;
}

export interface PlexSubtitleProbeRequest {
    cacheKey: string;
    headers: Record<string, string>;
    url: URL;
    urlSource: PlexSubtitleProbeUrlSource;
}

export function resolvePlexSubtitleProbeBaseUrl(options: {
    context: Pick<PlexSubtitleProbeTransportContext, 'serverUri' | 'resolvedBaseUrl'>;
    target: PlexSubtitleProbeTarget;
}): PlexSubtitleProbeResolvedUrl | null {
    const baseUri = options.context.resolvedBaseUrl ?? options.context.serverUri ?? null;
    if (!baseUri) {
        return null;
    }

    try {
        const { target } = options;
        if (typeof target.key === 'string' && target.key.length > 0) {
            const normalized = tryBuildPlexServerUrlFromKey(baseUri, target.key);
            if (normalized) {
                return { baseUrl: normalized, urlSource: 'key' };
            }
        }

        return {
            baseUrl: new URL(`/library/streams/${encodeURIComponent(target.id)}`, baseUri),
            urlSource: 'id_fallback',
        };
    } catch {
        return null;
    }
}

export function buildPlexSubtitleProbeCacheKey(options: {
    context: PlexSubtitleProbeTransportContext;
    fallbackItemKey: string | null;
    target: Pick<PlexSubtitleProbeTarget, 'id'>;
}): string | null {
    const effectiveBaseUri = options.context.resolvedBaseUrl ?? options.context.serverUri ?? null;
    if (!effectiveBaseUri) {
        return null;
    }

    try {
        const transportKey = new URL(effectiveBaseUri).origin;
        const itemKey = options.context.itemKey ?? options.fallbackItemKey ?? 'global';
        const token = readXPlexTokenFromHeaders(options.context.authHeaders);
        const accountKey = token ? hashForCacheKeyScope(token) : 'anonymous';
        return `${transportKey}::${accountKey}::${itemKey}::${options.target.id}`;
    } catch {
        return null;
    }
}

export function buildPlexSubtitleProbeRequest(options: {
    context: PlexSubtitleProbeTransportContext;
    fallbackItemKey: string | null;
    target: PlexSubtitleProbeTarget;
}): PlexSubtitleProbeRequest | null {
    const resolved = resolvePlexSubtitleProbeBaseUrl({
        context: options.context,
        target: options.target,
    });
    const cacheKey = buildPlexSubtitleProbeCacheKey({
        context: options.context,
        fallbackItemKey: options.fallbackItemKey,
        target: options.target,
    });
    if (!resolved || !cacheKey) {
        return null;
    }

    const url = new URL(resolved.baseUrl.toString());
    applyXPlexTokenQueryParamFromHeaders(url.searchParams, options.context.authHeaders);

    return {
        cacheKey,
        headers: { Accept: 'text/vtt, text/plain, */*' },
        url,
        urlSource: resolved.urlSource,
    };
}

function hashForCacheKeyScope(value: string): string {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }
    return (hash >>> 0).toString(16);
}
