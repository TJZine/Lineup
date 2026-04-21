import {
    detectSubtitleTextContentFormat,
    type SubtitleTextContentFormat,
} from '../../../shared/subtitleTextFormatDetection';
import { redactUrlForLog } from '../../../utils/redact';
import { applyXPlexTokenQueryParam, tryBuildPlexServerUrlFromKey } from '../shared/plexUrl';

export type SubtitleTextFormat = SubtitleTextContentFormat;
export type SubtitleProbeUrlSource = 'key' | 'id_fallback';

export interface SubtitleStreamProbeRequestInput {
    authHeaders: Record<string, string>;
    serverUri: string;
    subtitleStreamId: string;
    subtitleStreamKey?: string;
}

export interface SubtitleStreamProbeRequestContext {
    authMode: 'header';
    baseUrl: URL;
    headers: Record<string, string>;
    redactedTrackSrcQueryAuth: string | null;
    redactedUrl: string;
    urlSource: SubtitleProbeUrlSource;
}

export interface SubtitleStreamProbeReadResult {
    detected: SubtitleTextFormat;
    looksLikeHtml: boolean;
    sampleCapped: boolean;
    sampleLength: number;
}

function detectSubtitleCodecFormat(codec?: string): SubtitleTextFormat {
    const normalized = (codec ?? '').toLowerCase();
    if (normalized === 'vtt' || normalized === 'webvtt') {
        return 'webvtt';
    }
    if (normalized === 'srt' || normalized === 'subrip') {
        return 'srt';
    }
    return 'unknown';
}

function resolveSubtitleProbeBaseUrl(input: SubtitleStreamProbeRequestInput): {
    baseUrl: URL;
    urlSource: SubtitleProbeUrlSource;
} {
    if (typeof input.subtitleStreamKey === 'string' && input.subtitleStreamKey.length > 0) {
        const normalized = tryBuildPlexServerUrlFromKey(input.serverUri, input.subtitleStreamKey);
        if (normalized) {
            return { baseUrl: normalized, urlSource: 'key' };
        }
    }

    return {
        baseUrl: new URL(`/library/streams/${encodeURIComponent(input.subtitleStreamId)}`, input.serverUri),
        urlSource: 'id_fallback',
    };
}

function readTokenFromHeaders(headers: Record<string, string>): string | null {
    const token = headers['X-Plex-Token'];
    return typeof token === 'string' && token.length > 0 ? token : null;
}

function buildRedactedTrackSrcQueryAuth(baseUrl: URL, token: string | null): string | null {
    if (!token) {
        return null;
    }

    try {
        const url = new URL(baseUrl.toString());
        applyXPlexTokenQueryParam(url.searchParams, token);
        return redactUrlForLog(url.toString());
    } catch {
        return null;
    }
}

export function buildSubtitleStreamProbeRequestContext(
    input: SubtitleStreamProbeRequestInput
): SubtitleStreamProbeRequestContext {
    const { baseUrl, urlSource } = resolveSubtitleProbeBaseUrl(input);

    return {
        authMode: 'header',
        baseUrl,
        headers: {
            Accept: 'text/vtt, text/plain, */*',
            ...input.authHeaders,
        },
        redactedTrackSrcQueryAuth: buildRedactedTrackSrcQueryAuth(
            baseUrl,
            readTokenFromHeaders(input.authHeaders)
        ),
        redactedUrl: redactUrlForLog(baseUrl.toString()),
        urlSource,
    };
}

async function readSubtitleProbeSampleFromStream(
    response: Response,
    maxSampleChars: number
): Promise<SubtitleStreamProbeReadResult | null> {
    const reader = response.body?.getReader?.();
    if (!reader) {
        return null;
    }

    const decoder = new TextDecoder('utf-8');
    let sample = '';
    let sampleCapped = false;

    try {
        while (sample.length < maxSampleChars) {
            const { value, done } = await reader.read();
            if (done) {
                break;
            }
            if (!value) {
                continue;
            }

            const chunk = decoder.decode(value, { stream: true });
            const remaining = maxSampleChars - sample.length;
            if (chunk.length > remaining) {
                sample += chunk.slice(0, remaining);
                sampleCapped = true;
                break;
            }
            sample += chunk;
        }

        if (sample.length < maxSampleChars) {
            const flushed = decoder.decode();
            if (flushed.length > 0) {
                const remaining = maxSampleChars - sample.length;
                sample += flushed.slice(0, remaining);
                if (flushed.length > remaining) {
                    sampleCapped = true;
                }
            }
        }
    } finally {
        try {
            await reader.cancel();
        } catch {
            // Ignore cancel errors.
        }
    }

    return {
        detected: detectSubtitleTextContentFormat(sample),
        looksLikeHtml: sample.replace(/^\uFEFF/, '').trimStart().startsWith('<'),
        sampleCapped,
        sampleLength: sample.length,
    };
}

export async function readSubtitleProbeSample(
    response: Response,
    codec: string | undefined,
    maxSampleChars: number
): Promise<SubtitleStreamProbeReadResult> {
    try {
        const streamedResult = await readSubtitleProbeSampleFromStream(response, maxSampleChars);
        if (streamedResult) {
            return streamedResult;
        }
    } catch {
        // Ignore read errors; still log status/headers.
    }

    return {
        detected: detectSubtitleCodecFormat(codec),
        looksLikeHtml: false,
        sampleCapped: false,
        sampleLength: 0,
    };
}
