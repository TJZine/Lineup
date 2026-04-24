import type {
    SubtitleFallbackResult,
    SubtitleFallbackTransientReason,
    SubtitleFallbackUnsupportedReason,
    SubtitleTrack,
} from './types';
import { looksLikeHtml, normalizeSubtitleToVtt } from './subtitleConversion';
import { fetchWithTimeout } from '../plex/shared/fetchWithTimeout';
import {
    buildPlexSubtitleFetchAttempts,
    buildPlexSubtitleTranscodeUrl,
    type PlexSubtitleFallbackContext,
} from '../plex/stream/plexSubtitleFallbackPolicy';
import { redactSensitiveTokens } from '../../utils/redact';

export type SubtitleFallbackPipelineContext = PlexSubtitleFallbackContext;

interface SubtitleFallbackLogger {
    (event: string, contextFactory: () => Record<string, unknown>): void;
}

export interface FetchSubtitleFallbackVttArgs {
    track: SubtitleTrack;
    initialUrl: URL;
    context: SubtitleFallbackPipelineContext;
    signal: AbortSignal;
    isCurrentLoad: () => boolean;
    deriveLanHttpUrl: (original: URL) => URL | null;
    logDebug: SubtitleFallbackLogger;
    createXhr?: () => XMLHttpRequest;
}

type SubtitleFallbackFailure = Exclude<SubtitleFallbackResult, { kind: 'success' }>;
type SubtitleFetchTextResult = { kind: 'success'; text: string } | SubtitleFallbackFailure;

function staleFailure(): SubtitleFallbackFailure {
    return { kind: 'stale' };
}

function unsupportedFailure(
    reason: SubtitleFallbackUnsupportedReason,
    status?: number
): SubtitleFallbackFailure {
    return status === undefined
        ? { kind: 'unsupported', reason }
        : { kind: 'unsupported', reason, status };
}

function transientFailure(
    reason: SubtitleFallbackTransientReason,
    status?: number
): SubtitleFallbackFailure {
    return status === undefined
        ? { kind: 'transient', reason }
        : { kind: 'transient', reason, status };
}

function classifyStatusFailure(status: number): SubtitleFallbackFailure {
    if (status === 401) {
        return { kind: 'auth', reason: 'unauthorized', status: 401 };
    }
    if (status === 403) {
        return { kind: 'auth', reason: 'forbidden', status: 403 };
    }
    if (status === 404) {
        return unsupportedFailure('not_found', status);
    }
    if (status === 408) {
        return transientFailure('timeout', status);
    }
    if (status === 429 || status >= 500) {
        return transientFailure('server_error', status);
    }
    return unsupportedFailure('client_error', status);
}

function classifyExceptionFailure(
    error: unknown,
    signal: AbortSignal,
    isCurrentLoad: () => boolean
): SubtitleFallbackFailure {
    if (!isCurrentLoad() || signal.aborted) {
        return staleFailure();
    }
    if (error instanceof Error && error.name === 'AbortError') {
        return transientFailure('timeout');
    }
    return transientFailure('network_error');
}

export async function fetchSubtitleFallbackVtt({
    track,
    initialUrl,
    context,
    signal,
    isCurrentLoad,
    deriveLanHttpUrl,
    logDebug,
    createXhr = (): XMLHttpRequest => new XMLHttpRequest(),
}: FetchSubtitleFallbackVttArgs): Promise<SubtitleFallbackResult> {
    let lastAttempt = 'init';
    let lastAttemptUrl = initialUrl.toString();
    let lastFailure: SubtitleFallbackFailure | null = null;

    const baseAcceptHeader = { Accept: 'text/vtt, text/plain, */*' };
    const attempts = buildPlexSubtitleFetchAttempts(initialUrl, context.authHeaders);

    let raw: string | null = null;
    for (const attempt of attempts) {
        lastAttempt = attempt.name;
        lastAttemptUrl = attempt.url.toString();
        const result = await fetchSubtitleTextWithFallbacks({
            url: attempt.url,
            headers: attempt.headers,
            signal,
            trackId: track.id,
            isCurrentLoad,
            deriveLanHttpUrl,
            logDebug,
            createXhr,
        });
        if (result.kind === 'stale') return result;
        if (result.kind === 'success') {
            raw = result.text;
            break;
        }
        lastFailure = result;
    }

    if (!raw) {
        const formats: Array<'srt' | 'vtt'> = ['srt', 'vtt'];
        for (const format of formats) {
            const transcodeUrl = buildPlexSubtitleTranscodeUrl(track.id, context, format);
            if (!transcodeUrl) continue;
            lastAttempt = `universal_subtitles_${format}`;
            lastAttemptUrl = transcodeUrl.toString();
            const result = await fetchSubtitleTextWithFallbacks({
                url: transcodeUrl,
                headers: baseAcceptHeader,
                signal,
                trackId: track.id,
                isCurrentLoad,
                deriveLanHttpUrl,
                logDebug,
                createXhr,
            });
            if (result.kind === 'stale') {
                return result;
            }
            if (result.kind === 'success') {
                raw = result.text;
                break;
            }
            lastFailure = result;
        }
    }

    if (!raw) return lastFailure ?? unsupportedFailure('client_error');
    if (looksLikeHtml(raw)) {
        logDebug('subtitle_fetch_error', () => ({
            id: track.id,
            error: 'html_response',
            attempt: lastAttempt,
            url: redactSensitiveTokens(lastAttemptUrl),
        }));
        return unsupportedFailure('invalid_source');
    }

    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const converted = normalizeSubtitleToVtt(raw);
    const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
    logDebug('subtitle_conversion_result', () => ({
        id: track.id,
        format: converted.format,
        bytes: converted.vtt.length,
        durationMs: Math.max(0, Math.round(end - start)),
        success: true,
    }));

    return {
        kind: 'success',
        vtt: converted.vtt,
    };
}

interface FetchSubtitleTextWithFallbacksArgs {
    url: URL;
    headers: Record<string, string>;
    signal: AbortSignal;
    trackId: string;
    isCurrentLoad: () => boolean;
    deriveLanHttpUrl: (original: URL) => URL | null;
    logDebug: SubtitleFallbackLogger;
    createXhr: () => XMLHttpRequest;
}

async function fetchSubtitleTextWithFallbacks({
    url,
    headers,
    signal,
    trackId,
    isCurrentLoad,
    deriveLanHttpUrl,
    logDebug,
    createXhr,
}: FetchSubtitleTextWithFallbacksArgs): Promise<SubtitleFetchTextResult> {
    const urlsToTry: Array<{ variant: 'primary' | 'lan_http'; url: URL }> = [{ variant: 'primary', url }];
    const lanHttp = deriveLanHttpUrl(url);
    if (lanHttp && lanHttp.toString() !== url.toString()) {
        urlsToTry.push({ variant: 'lan_http', url: lanHttp });
    }

    let lastFailure: SubtitleFallbackFailure | null = null;
    for (const entry of urlsToTry) {
        const suffix = entry.variant === 'lan_http' ? '_lan_http' : '';
        try {
            const response = await fetchWithTimeout({
                url: entry.url.toString(),
                init: { headers },
                timeoutMs: 10_000,
                upstreamSignal: signal,
            });
            if (!isCurrentLoad()) return staleFailure();
            if (!response.ok) {
                let bodyText = '';
                let bodySample: string | null = null;
                let contentType: string | null = null;
                try {
                    contentType = response.headers.get('content-type');
                    bodyText = await response.text();
                } catch {
                    // ignore
                }
                if (!isCurrentLoad()) return staleFailure();
                bodySample = bodyText.length > 0 ? bodyText.slice(0, 200) : null;
                logDebug('subtitle_fetch_error', () => ({
                    id: trackId,
                    status: response.status,
                    attempt: `subtitle_text_fetch_status${suffix}`,
                    url: redactSensitiveTokens(entry.url.toString()),
                    ...(contentType ? { contentType } : {}),
                    ...(bodySample ? { bodySample } : {}),
                }));
                lastFailure = classifyStatusFailure(response.status);
            } else {
                const text = await response.text();
                if (!isCurrentLoad()) return staleFailure();
                return { kind: 'success', text };
            }
        } catch (error) {
            const failure = classifyExceptionFailure(error, signal, isCurrentLoad);
            if (failure.kind === 'stale') return failure;
            const message = error instanceof Error ? error.message : String(error);
            logDebug('subtitle_fetch_error', () => ({
                id: trackId,
                error: message,
                attempt: `subtitle_text_fetch_failed${suffix}`,
                url: redactSensitiveTokens(entry.url.toString()),
            }));

            const xhrResult = await xhrGetText({
                url: entry.url.toString(),
                headers,
                signal,
                trackId,
                isCurrentLoad,
                logDebug,
                createXhr,
            });
            if (xhrResult.kind === 'stale') {
                return xhrResult;
            }
            if (xhrResult.kind === 'success') {
                return xhrResult;
            }
            lastFailure = xhrResult;
        }
    }

    return lastFailure ?? unsupportedFailure('client_error');
}

interface XhrGetTextArgs {
    url: string;
    headers: Record<string, string>;
    signal: AbortSignal;
    trackId: string;
    isCurrentLoad: () => boolean;
    logDebug: SubtitleFallbackLogger;
    createXhr: () => XMLHttpRequest;
}

function xhrGetText({
    url,
    headers,
    signal,
    trackId,
    isCurrentLoad,
    logDebug,
    createXhr,
}: XhrGetTextArgs): Promise<SubtitleFetchTextResult> {
    return new Promise((resolve) => {
        let xhr: XMLHttpRequest | null = null;
        let settled = false;
        const finish = (value: SubtitleFetchTextResult): void => {
            if (settled) return;
            settled = true;
            signal.removeEventListener('abort', onAbort);
            resolve(value);
        };

        const onAbort = (): void => {
            try {
                xhr?.abort();
            } catch {
                // ignore
            }
            finish(staleFailure());
        };

        if (signal.aborted) {
            finish(staleFailure());
            return;
        }

        try {
            xhr = createXhr();
            const xhrRef = xhr;
            xhr.open('GET', url, true);
            for (const [key, value] of Object.entries(headers)) {
                try {
                    xhr.setRequestHeader(key, value);
                } catch {
                    // ignore restricted headers
                }
            }
            try {
                xhr.overrideMimeType('text/plain; charset=utf-8');
            } catch {
                // ignore
            }

            signal.addEventListener('abort', onAbort, { once: true });
            xhr.onerror = (): void => {
                if (!isCurrentLoad()) {
                    finish(staleFailure());
                    return;
                }
                logDebug('subtitle_fetch_error', () => ({
                    id: trackId,
                    attempt: 'subtitle_text_xhr_error',
                    status: xhrRef.status,
                    readyState: xhrRef.readyState,
                    url: redactSensitiveTokens(url),
                }));
                finish(transientFailure('network_error'));
            };
            xhr.ontimeout = (): void => {
                if (!isCurrentLoad()) {
                    finish(staleFailure());
                    return;
                }
                logDebug('subtitle_fetch_error', () => ({
                    id: trackId,
                    attempt: 'subtitle_text_xhr_timeout',
                    status: xhrRef.status,
                    readyState: xhrRef.readyState,
                    url: redactSensitiveTokens(url),
                }));
                finish(transientFailure('timeout'));
            };
            xhr.onabort = (): void => {
                finish(signal.aborted || !isCurrentLoad() ? staleFailure() : transientFailure('timeout'));
            };
            xhr.onload = (): void => {
                if (!isCurrentLoad()) {
                    finish(staleFailure());
                    return;
                }
                if (xhrRef.status < 200 || xhrRef.status >= 300) {
                    const bodySample =
                        typeof xhrRef.responseText === 'string' && xhrRef.responseText.length > 0
                            ? xhrRef.responseText.slice(0, 200)
                            : null;
                    logDebug('subtitle_fetch_error', () => ({
                        id: trackId,
                        status: xhrRef.status,
                        attempt: 'subtitle_text_xhr_status',
                        url: redactSensitiveTokens(url),
                        ...(bodySample ? { bodySample } : {}),
                    }));
                    finish(classifyStatusFailure(xhrRef.status));
                    return;
                }
                finish({
                    kind: 'success',
                    text: typeof xhrRef.responseText === 'string' ? xhrRef.responseText : '',
                });
            };

            xhr.timeout = 10000;
            xhr.send();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logDebug('subtitle_fetch_error', () => ({
                id: trackId,
                attempt: 'subtitle_text_xhr_exception',
                error: message,
                url: redactSensitiveTokens(url),
            }));
            finish(classifyExceptionFailure(error, signal, isCurrentLoad));
        }
    });
}
