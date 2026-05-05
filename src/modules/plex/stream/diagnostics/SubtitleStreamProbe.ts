import { redactSensitiveTokens, redactUrlForLog } from '../../../../utils/redact';
import { fetchWithTimeout } from '../../shared/fetchWithTimeout';
import {
    buildSubtitleStreamProbeRequestContext,
    readSubtitleProbeSample,
    type SubtitleStreamProbeReadResult,
    type SubtitleStreamProbeRequestContext,
} from './SubtitleStreamProbeSupport';

export const SUBTITLE_STREAM_PROBE_TIMEOUT_MS = 8000;
export const SUBTITLE_STREAM_PROBE_MAX_SAMPLE_CHARS = 2048;

export type SubtitleStreamProbeEvent = 'subtitle_stream_probe' | 'subtitle_stream_probe_error';

export type SubtitleStreamProbeLogger = (
    event: SubtitleStreamProbeEvent,
    context: Record<string, unknown>
) => void;

export interface SubtitleStreamProbeOptions {
    itemKey: string;
    subtitleStreamId: string;
    subtitleStreamKey?: string;
    codec?: string;
    language?: string;
}

export interface SubtitleStreamProbeDeps {
    serverUri: string | null;
    getAuthHeaders: () => Record<string, string>;
    logDebug: SubtitleStreamProbeLogger;
}

function buildSubtitleProbeSuccessContext(
    options: SubtitleStreamProbeOptions,
    requestContext: SubtitleStreamProbeRequestContext,
    response: Response,
    sampleResult: SubtitleStreamProbeReadResult
): Record<string, unknown> {
    return {
        itemKey: options.itemKey,
        subtitleStreamId: options.subtitleStreamId,
        subtitleStreamKey:
            typeof options.subtitleStreamKey === 'string'
                ? redactSensitiveTokens(options.subtitleStreamKey)
                : null,
        codec: options.codec ?? null,
        language: options.language ?? null,
        urlSource: requestContext.urlSource,
        authMode: requestContext.authMode,
        url: requestContext.redactedUrl,
        trackSrcQueryAuthExample: requestContext.redactedTrackSrcQueryAuth,
        originHost: requestContext.baseUrl.host,
        originIsPlexDirect: requestContext.baseUrl.hostname.endsWith('.plex.direct'),
        responseType: response.type,
        redirected: response.redirected,
        finalUrl: redactUrlForLog(response.url),
        ok: response.ok,
        status: response.status,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        contentDisposition: response.headers.get('content-disposition'),
        accessControlAllowOrigin: response.headers.get('access-control-allow-origin'),
        accessControlExposeHeaders: response.headers.get('access-control-expose-headers'),
        acceptRanges: response.headers.get('accept-ranges'),
        contentRange: response.headers.get('content-range'),
        ...sampleResult,
    };
}

function buildSubtitleProbeErrorContext(
    options: SubtitleStreamProbeOptions,
    requestContext: SubtitleStreamProbeRequestContext,
    error: unknown
): Record<string, unknown> {
    return {
        itemKey: options.itemKey,
        subtitleStreamId: options.subtitleStreamId,
        subtitleStreamKey:
            typeof options.subtitleStreamKey === 'string'
                ? redactSensitiveTokens(options.subtitleStreamKey)
                : null,
        codec: options.codec ?? null,
        language: options.language ?? null,
        urlSource: requestContext.urlSource,
        authMode: requestContext.authMode,
        url: requestContext.redactedUrl,
        error: error instanceof Error ? error.message : String(error),
    };
}

export async function probeSubtitleStreamDelivery(
    options: SubtitleStreamProbeOptions,
    deps: SubtitleStreamProbeDeps
): Promise<void> {
    if (!deps.serverUri) {
        return;
    }

    const requestContext = buildSubtitleStreamProbeRequestContext({
        authHeaders: deps.getAuthHeaders(),
        serverUri: deps.serverUri,
        subtitleStreamId: options.subtitleStreamId,
        ...(typeof options.subtitleStreamKey === 'string'
            ? { subtitleStreamKey: options.subtitleStreamKey }
            : {}),
    });

    try {
        const response = await fetchWithTimeout({
            url: requestContext.baseUrl.toString(),
            init: {
                method: 'GET',
                headers: requestContext.headers,
                cache: 'no-store',
                mode: 'cors',
                credentials: 'omit',
            },
            timeoutMs: SUBTITLE_STREAM_PROBE_TIMEOUT_MS,
        });
        const sampleResult = await readSubtitleProbeSample(
            response,
            options.codec,
            SUBTITLE_STREAM_PROBE_MAX_SAMPLE_CHARS
        );
        deps.logDebug(
            'subtitle_stream_probe',
            buildSubtitleProbeSuccessContext(options, requestContext, response, sampleResult)
        );
    } catch (error) {
        deps.logDebug(
            'subtitle_stream_probe_error',
            buildSubtitleProbeErrorContext(options, requestContext, error)
        );
    }
}
