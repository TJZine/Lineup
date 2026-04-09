import type { SubtitleTrack } from './types';
import { looksLikeHtml, normalizeSubtitleToVtt } from './subtitleConversion';
import { fetchWithTimeout } from '../plex/shared/fetchWithTimeout';
import {
    applyXPlexQueryParamsFromHeaders,
    applyXPlexTokenQueryParam,
} from '../plex/shared/plexUrl';
import { redactSensitiveTokens } from '../../utils/redact';

export interface SubtitleFallbackPipelineContext {
    serverUri: string | null;
    authHeaders: Record<string, string>;
    itemKey?: string | undefined;
    mediaIndex?: number | undefined;
    partIndex?: number | undefined;
    sessionId?: string | undefined;
}

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
    createXhr = () => new XMLHttpRequest(),
}: FetchSubtitleFallbackVttArgs): Promise<string | null> {
    let lastAttempt = 'init';
    let lastAttemptUrl = initialUrl.toString();

    const tokenFromHeaders = getAuthTokenFromHeaders(context.authHeaders);
    const baseAcceptHeader = { Accept: 'text/vtt, text/plain, */*' };
    const attempts: Array<{
        name: 'query' | 'header' | 'query_download' | 'header_download';
        url: URL;
        headers: Record<string, string>;
    }> = [{ name: 'query', url: initialUrl, headers: baseAcceptHeader }];

    if (tokenFromHeaders) {
        const headerUrl = new URL(initialUrl.toString());
        headerUrl.searchParams.delete('X-Plex-Token');
        attempts.push({
            name: 'header',
            url: headerUrl,
            headers: { ...baseAcceptHeader, 'X-Plex-Token': tokenFromHeaders },
        });

        const queryDownloadUrl = new URL(initialUrl.toString());
        if (!queryDownloadUrl.searchParams.has('download')) {
            queryDownloadUrl.searchParams.set('download', '1');
        }
        attempts.push({ name: 'query_download', url: queryDownloadUrl, headers: baseAcceptHeader });

        const headerDownloadUrl = new URL(headerUrl.toString());
        if (!headerDownloadUrl.searchParams.has('download')) {
            headerDownloadUrl.searchParams.set('download', '1');
        }
        attempts.push({
            name: 'header_download',
            url: headerDownloadUrl,
            headers: { ...baseAcceptHeader, 'X-Plex-Token': tokenFromHeaders },
        });
    }

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
        const paths = getSubtitleTranscodePaths(context);
        const formats: Array<'srt' | 'vtt'> = ['srt', 'vtt'];
        for (const path of paths) {
            for (const format of formats) {
                const transcodeUrl = buildSubtitleTranscodeUrl(track, tokenFromHeaders, context, path, format);
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
            if (raw) break;
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
            const response = await fetchWithTimeout(
                entry.url.toString(),
                { headers },
                10_000,
                signal
            );
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

function buildSubtitleTranscodeUrl(
    track: SubtitleTrack,
    token: string | null,
    context: SubtitleFallbackPipelineContext,
    path: string,
    format: 'srt' | 'vtt'
): URL | null {
    try {
        const baseUri = context.serverUri ?? null;
        if (!baseUri || !path) return null;

        const url = new URL('/video/:/transcode/universal/subtitles', baseUri);
        url.searchParams.set('path', path);
        url.searchParams.set('mediaIndex', String(context.mediaIndex ?? 0));
        url.searchParams.set('partIndex', String(context.partIndex ?? 0));
        url.searchParams.set('subtitleStreamID', track.id);
        url.searchParams.set('format', format);
        url.searchParams.set('download', '1');

        if (context.sessionId) {
            url.searchParams.set('X-Plex-Session-Identifier', context.sessionId);
            url.searchParams.set('session', context.sessionId);
        }

        applyXPlexTokenQueryParam(url.searchParams, token);
        applyXPlexQueryParamsFromHeaders(url.searchParams, context.authHeaders);
        if (!url.searchParams.has('X-Plex-Client-Profile-Name')) {
            url.searchParams.set('X-Plex-Client-Profile-Name', 'HTML TV App');
        }

        return url;
    } catch {
        return null;
    }
}

function getSubtitleTranscodePaths(context: SubtitleFallbackPipelineContext): string[] {
    const itemKey = context.itemKey ?? null;
    if (!itemKey) return [];
    return [`/library/metadata/${itemKey}`];
}

function getAuthTokenFromHeaders(headers: Record<string, string>): string | null {
    const token = headers['X-Plex-Token'];
    return typeof token === 'string' && token.length > 0 ? token : null;
}
