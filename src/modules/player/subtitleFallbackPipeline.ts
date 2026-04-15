import type { SubtitleTrack } from './types';
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

export async function fetchSubtitleFallbackVtt({
    track,
    initialUrl,
    context,
    signal,
    isCurrentLoad,
    deriveLanHttpUrl,
    logDebug,
    createXhr = (): XMLHttpRequest => new XMLHttpRequest(),
}: FetchSubtitleFallbackVttArgs): Promise<string | null> {
    let lastAttempt = 'init';
    let lastAttemptUrl = initialUrl.toString();

    const baseAcceptHeader = { Accept: 'text/vtt, text/plain, */*' };
    const attempts = buildPlexSubtitleFetchAttempts(initialUrl, context.authHeaders);

    let raw: string | null = null;
    for (const attempt of attempts) {
        lastAttempt = attempt.name;
        lastAttemptUrl = attempt.url.toString();
        raw = await fetchSubtitleTextWithFallbacks({
            url: attempt.url,
            headers: attempt.headers,
            signal,
            trackId: track.id,
            isCurrentLoad,
            deriveLanHttpUrl,
            logDebug,
            createXhr,
        });
        if (!isCurrentLoad()) return null;
        if (raw) break;
    }

    if (!raw) {
        const formats: Array<'srt' | 'vtt'> = ['srt', 'vtt'];
        for (const format of formats) {
            const transcodeUrl = buildPlexSubtitleTranscodeUrl(track.id, context, format);
            if (!transcodeUrl) continue;
            lastAttempt = `universal_subtitles_${format}`;
            lastAttemptUrl = transcodeUrl.toString();
            try {
                raw = await fetchSubtitleTextWithFallbacks({
                    url: transcodeUrl,
                    headers: baseAcceptHeader,
                    signal,
                    trackId: track.id,
                    isCurrentLoad,
                    deriveLanHttpUrl,
                    logDebug,
                    createXhr,
                });
                if (raw) {
                    break;
                }
            } catch (error) {
                if (!isCurrentLoad()) return null;
                const message = error instanceof Error ? error.message : String(error);
                logDebug('subtitle_fetch_error', () => ({
                    id: track.id,
                    error: message,
                    attempt: 'subtitle_text_fetch_exception',
                    url: redactSensitiveTokens(transcodeUrl.toString()),
                }));
            }
        }
    }

    if (!raw) return null;
    if (looksLikeHtml(raw)) {
        logDebug('subtitle_fetch_error', () => ({
            id: track.id,
            error: 'html_response',
            attempt: lastAttempt,
            url: redactSensitiveTokens(lastAttemptUrl),
        }));
        return null;
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

    return converted.vtt;
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
}: FetchSubtitleTextWithFallbacksArgs): Promise<string | null> {
    const urlsToTry: Array<{ variant: 'primary' | 'lan_http'; url: URL }> = [{ variant: 'primary', url }];
    const lanHttp = deriveLanHttpUrl(url);
    if (lanHttp && lanHttp.toString() !== url.toString()) {
        urlsToTry.push({ variant: 'lan_http', url: lanHttp });
    }

    for (const entry of urlsToTry) {
        const suffix = entry.variant === 'lan_http' ? '_lan_http' : '';
        try {
            const response = await fetchWithTimeout({
                url: entry.url.toString(),
                init: { headers },
                timeoutMs: 10_000,
                upstreamSignal: signal,
            });
            if (!isCurrentLoad()) return null;
            if (!response.ok) {
                let bodySample: string | null = null;
                let contentType: string | null = null;
                try {
                    contentType = response.headers.get('content-type');
                    bodySample = (await response.text()).slice(0, 200);
                } catch {
                    // ignore
                }
                logDebug('subtitle_fetch_error', () => ({
                    id: trackId,
                    status: response.status,
                    attempt: `subtitle_text_fetch_status${suffix}`,
                    url: redactSensitiveTokens(entry.url.toString()),
                    ...(contentType ? { contentType } : {}),
                    ...(bodySample ? { bodySample } : {}),
                }));
            } else {
                return await response.text();
            }
        } catch (error) {
            if (!isCurrentLoad()) return null;
            const message = error instanceof Error ? error.message : String(error);
            logDebug('subtitle_fetch_error', () => ({
                id: trackId,
                error: message,
                attempt: `subtitle_text_fetch_failed${suffix}`,
                url: redactSensitiveTokens(entry.url.toString()),
            }));

            const xhrText = await xhrGetText({
                url: entry.url.toString(),
                headers,
                signal,
                trackId,
                isCurrentLoad,
                logDebug,
                createXhr,
            });
            if (xhrText) {
                return xhrText;
            }
        }
    }

    return null;
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
}: XhrGetTextArgs): Promise<string | null> {
    return new Promise((resolve) => {
        let xhr: XMLHttpRequest | null = null;
        let settled = false;
        const finish = (value: string | null): void => {
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
            finish(null);
        };

        if (signal.aborted) {
            finish(null);
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
                    finish(null);
                    return;
                }
                logDebug('subtitle_fetch_error', () => ({
                    id: trackId,
                    attempt: 'subtitle_text_xhr_error',
                    status: xhrRef.status,
                    readyState: xhrRef.readyState,
                    url: redactSensitiveTokens(url),
                }));
                finish(null);
            };
            xhr.ontimeout = (): void => {
                if (!isCurrentLoad()) {
                    finish(null);
                    return;
                }
                logDebug('subtitle_fetch_error', () => ({
                    id: trackId,
                    attempt: 'subtitle_text_xhr_timeout',
                    status: xhrRef.status,
                    readyState: xhrRef.readyState,
                    url: redactSensitiveTokens(url),
                }));
                finish(null);
            };
            xhr.onabort = (): void => {
                finish(null);
            };
            xhr.onload = (): void => {
                if (!isCurrentLoad()) {
                    finish(null);
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
                    finish(null);
                    return;
                }
                finish(typeof xhrRef.responseText === 'string' ? xhrRef.responseText : null);
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
            finish(null);
        }
    });
}
