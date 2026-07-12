import {
    detectSubtitleTextContentFormat,
    type SubtitleTextContentFormat,
} from '../../../../shared/subtitleTextFormatDetection';
import { redactUrlForLog } from '../../../../utils/redact';
import { readAbortSignalReason } from '../../../../utils/abortSignalReason';
import {
    cancelAndReleaseResponseReader,
    readResponseBodyChunkWithAbort,
} from '../../shared/boundedResponseText';
import { applyXPlexTokenQueryParam, readXPlexTokenFromHeaders } from '../../shared/plexUrl';
import {
    resolvePlexSubtitleProbeBaseUrl,
    type PlexSubtitleProbeUrlSource,
} from '../policy/plexSubtitleProbePolicy';

export type SubtitleTextFormat = SubtitleTextContentFormat;
export type SubtitleProbeUrlSource = PlexSubtitleProbeUrlSource;

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
    const resolved = resolvePlexSubtitleProbeBaseUrl({
        context: {
            serverUri: input.serverUri,
        },
        target: {
            id: input.subtitleStreamId,
            key: input.subtitleStreamKey,
        },
    });
    if (!resolved) {
        throw new TypeError('Invalid subtitle probe URL context');
    }
    return resolved;
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
            ...input.authHeaders,
            Accept: 'text/vtt, text/plain, */*',
        },
        redactedTrackSrcQueryAuth: buildRedactedTrackSrcQueryAuth(
            baseUrl,
            readXPlexTokenFromHeaders(input.authHeaders)
        ),
        redactedUrl: redactUrlForLog(baseUrl.toString()),
        urlSource,
    };
}

async function readSubtitleProbeSampleFromStream(
    response: Response,
    maxSampleChars: number,
    signal: AbortSignal | null
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
            if (signal?.aborted) {
                throw readAbortSignalReason(signal);
            }
            const { value, done } = signal
                ? await readResponseBodyChunkWithAbort(reader, signal)
                : await reader.read();
            if (done) {
                break;
            }
            if (!value) {
                continue;
            }

            const remaining = maxSampleChars - sample.length;
            const maxBytesForRemainingCharacters = remaining * 4;
            const boundedValue = value.byteLength > maxBytesForRemainingCharacters
                ? value.subarray(0, maxBytesForRemainingCharacters)
                : value;
            const chunk = decoder.decode(boundedValue, { stream: true });
            if (chunk.length > remaining) {
                sample += chunk.slice(0, remaining);
                sampleCapped = true;
                break;
            }
            sample += chunk;
            if (boundedValue.byteLength < value.byteLength) {
                sampleCapped = true;
                break;
            }
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
        cancelAndReleaseResponseReader(reader);
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
    maxSampleChars: number,
    signal: AbortSignal | null = null
): Promise<SubtitleStreamProbeReadResult> {
    try {
        const streamedResult = await readSubtitleProbeSampleFromStream(
            response,
            maxSampleChars,
            signal
        );
        if (streamedResult && streamedResult.sampleLength > 0) {
            return streamedResult;
        }
    } catch {
        if (signal?.aborted) {
            throw readAbortSignalReason(signal);
        }
        // Ignore read errors; still log status/headers.
    }

    return {
        detected: detectSubtitleCodecFormat(codec),
        looksLikeHtml: false,
        sampleCapped: false,
        sampleLength: 0,
    };
}
