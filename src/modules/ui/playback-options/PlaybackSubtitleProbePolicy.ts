import type {
    StreamDescriptor,
    SubtitleExtractabilityProbeResult,
    SubtitleTrack,
} from '../../player/types';
import { fetchWithTimeout } from '../../plex/shared/fetchWithTimeout';
import type { FetchWithTimeoutArgs } from '../../plex/shared/fetchWithTimeout';
import {
    applyXPlexTokenQueryParamFromHeaders,
    buildPlexUrlFromKey,
    readXPlexTokenFromHeaders,
    tryBuildPlexServerUrlFromKey,
} from '../../plex/shared/plexUrl';

export const SUBTITLE_PROBE_TOTAL_TIMEOUT_MS = 400;

type SubtitleProbeCacheValue = 'supported' | 'unsupported';

type SubtitleProbeContext = NonNullable<StreamDescriptor['subtitleContext']>;

export interface PlaybackSubtitleProbePolicyDeps {
    fetchWithTimeout?: (args: FetchWithTimeoutArgs) => Promise<Response>;
}

export class PlaybackSubtitleProbePolicy {
    private readonly fetchWithTimeout: (args: FetchWithTimeoutArgs) => Promise<Response>;
    private readonly cache: Map<string, SubtitleProbeCacheValue> = new Map();

    constructor(deps: PlaybackSubtitleProbePolicyDeps = {}) {
        this.fetchWithTimeout = deps.fetchWithTimeout ?? fetchWithTimeout;
    }

    clearCache(): void {
        this.cache.clear();
    }

    getProbeCacheKey(
        trackId: string,
        context: SubtitleProbeContext,
        fallbackItemKey: string | null
    ): string {
        const itemKey = context.itemKey ?? fallbackItemKey ?? 'global';
        const serverKey = context.serverUri ?? 'unknown-server';
        const token = readXPlexTokenFromHeaders(context.authHeaders);
        const accountKey = token ? this.hashForCacheKeyScope(token) : 'anonymous';
        return `${serverKey}::${accountKey}::${itemKey}::${trackId}`;
    }

    buildSubtitleProbeUrl(track: SubtitleTrack, context: SubtitleProbeContext): URL | null {
        const baseUri = context.serverUri ?? null;
        if (!baseUri) return null;
        try {
            let url: URL;
            if (track.key) {
                const isAbsoluteHttpUrl = /^https?:\/\//i.test(track.key);
                if (isAbsoluteHttpUrl) {
                    const normalized = tryBuildPlexServerUrlFromKey(baseUri, track.key);
                    if (!normalized) {
                        url = new URL(`/library/streams/${encodeURIComponent(track.id)}`, baseUri);
                    } else {
                        url = normalized;
                    }
                } else {
                    url = buildPlexUrlFromKey(baseUri, track.key);
                }
            } else {
                url = new URL(`/library/streams/${encodeURIComponent(track.id)}`, baseUri);
            }
            applyXPlexTokenQueryParamFromHeaders(url.searchParams, context.authHeaders);
            return url;
        } catch {
            return null;
        }
    }

    async probeTextSubtitleExtractability(args: {
        track: SubtitleTrack;
        context: SubtitleProbeContext | null | undefined;
        fallbackItemKey: string | null;
    }): Promise<SubtitleExtractabilityProbeResult> {
        const { track, context, fallbackItemKey } = args;
        if (!context) return 'unknown';

        const cacheKey = this.getProbeCacheKey(track.id, context, fallbackItemKey);
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        const url = this.buildSubtitleProbeUrl(track, context);
        if (!url) return 'unknown';

        const startMs = Date.now();
        try {
            let response = await this.fetchWithTimeout({
                url: url.toString(),
                init: {
                    method: 'HEAD',
                    headers: { Accept: 'text/vtt, text/plain, */*' },
                },
                timeoutMs: SUBTITLE_PROBE_TOTAL_TIMEOUT_MS,
            });
            let methodFallbackExhausted = false;

            if (!response.ok && (response.status === 405 || response.status === 501)) {
                const elapsedMs = Date.now() - startMs;
                const remainingMs = Math.max(0, SUBTITLE_PROBE_TOTAL_TIMEOUT_MS - elapsedMs);
                const fallbackTimeoutMs = Math.max(50, remainingMs);

                response = await this.fetchWithTimeout({
                    url: url.toString(),
                    init: {
                        method: 'GET',
                        headers: { Accept: 'text/vtt, text/plain, */*' },
                    },
                    timeoutMs: fallbackTimeoutMs,
                });
                methodFallbackExhausted = true;
            }

            if (response.ok) {
                this.cache.set(cacheKey, 'supported');
                return 'supported';
            }

            const decision = this.classifySubtitleProbeStatus(
                response.status,
                methodFallbackExhausted
            );
            if (decision === 'unsupported') {
                this.cache.set(cacheKey, 'unsupported');
            }
            return decision;
        } catch {
            return 'transient_failure';
        }
    }

    private hashForCacheKeyScope(value: string): string {
        let hash = 0;
        for (let index = 0; index < value.length; index += 1) {
            hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
        }
        return (hash >>> 0).toString(16);
    }

    private classifySubtitleProbeStatus(
        status: number,
        methodFallbackExhausted = false
    ): SubtitleExtractabilityProbeResult {
        if (status === 401 || status === 403) {
            return 'auth_failure';
        }
        if (status === 501 && methodFallbackExhausted) {
            return 'unsupported';
        }
        if (status === 408 || status === 429 || status >= 500) {
            return 'transient_failure';
        }
        return 'unsupported';
    }
}
