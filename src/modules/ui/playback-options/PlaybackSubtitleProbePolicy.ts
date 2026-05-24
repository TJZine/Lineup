import type {
    StreamDescriptor,
    SubtitleExtractabilityProbeResult,
    SubtitleTrack,
} from '../../player/types';
import { fetchWithTimeout } from '../../plex/shared/fetchWithTimeout';
import type { FetchWithTimeoutArgs } from '../../plex/shared/fetchWithTimeout';
import {
    buildPlexSubtitleProbeCacheKey,
    buildPlexSubtitleProbeRequest,
} from '../../plex/stream/policy/plexSubtitleProbePolicy';

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
        return buildPlexSubtitleProbeCacheKey({
            context,
            fallbackItemKey,
            target: { id: trackId },
        }) ?? 'invalid-probe-cache-key';
    }

    buildSubtitleProbeUrl(track: SubtitleTrack, context: SubtitleProbeContext): URL | null {
        const request = buildPlexSubtitleProbeRequest({
            context,
            fallbackItemKey: null,
            target: { id: track.id, key: track.key },
        });
        return request?.url ?? null;
    }

    async probeTextSubtitleExtractability(args: {
        track: SubtitleTrack;
        context: SubtitleProbeContext | null | undefined;
        fallbackItemKey: string | null;
    }): Promise<SubtitleExtractabilityProbeResult> {
        const { track, context, fallbackItemKey } = args;
        if (!context) return 'unknown';

        const request = buildPlexSubtitleProbeRequest({
            context,
            fallbackItemKey,
            target: { id: track.id, key: track.key },
        });
        if (!request) return 'unknown';

        const cacheKey = request.cacheKey;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        const startMs = Date.now();
        try {
            let response = await this.fetchWithTimeout({
                url: request.url.toString(),
                init: {
                    method: 'HEAD',
                    headers: request.headers,
                },
                timeoutMs: SUBTITLE_PROBE_TOTAL_TIMEOUT_MS,
            });
            let methodFallbackExhausted = false;

            if (!response.ok && (response.status === 405 || response.status === 501)) {
                const elapsedMs = Date.now() - startMs;
                const remainingMs = Math.max(0, SUBTITLE_PROBE_TOTAL_TIMEOUT_MS - elapsedMs);
                const fallbackTimeoutMs = Math.max(50, remainingMs);

                response = await this.fetchWithTimeout({
                    url: request.url.toString(),
                    init: {
                        method: 'GET',
                        headers: request.headers,
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
