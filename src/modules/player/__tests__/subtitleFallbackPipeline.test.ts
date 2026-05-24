import { fetchSubtitleFallbackVtt } from '../subtitleFallbackPipeline';
import type { SubtitleTrack } from '../types';

function createTrack(overrides: Partial<SubtitleTrack> = {}): SubtitleTrack {
    return {
        id: 'sub-1',
        label: 'English',
        languageCode: 'en',
        language: 'English',
        codec: 'srt',
        format: 'srt',
        key: '/library/streams/1',
        default: false,
        forced: false,
        isTextCandidate: true,
        fetchableViaKey: true,
        ...overrides,
    };
}

function createResponse(
    body: string,
    init?: { ok?: boolean; status?: number; contentType?: string | null }
): {
    ok: boolean;
    status: number;
    headers: { get: (name: string) => string | null };
    text: () => Promise<string>;
} {
    return {
        ok: init?.ok ?? true,
        status: init?.status ?? 200,
        headers: {
            get: (name: string): string | null => (name.toLowerCase() === 'content-type' ? init?.contentType ?? null : null),
        },
        text: async (): Promise<string> => body,
    };
}

describe('fetchSubtitleFallbackVtt', () => {
    let originalFetch: typeof globalThis.fetch | undefined;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
        Object.defineProperty(globalThis, 'fetch', {
            value: jest.fn(),
            configurable: true,
            writable: true,
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (originalFetch) {
            globalThis.fetch = originalFetch;
        } else {
            delete (globalThis as { fetch?: unknown }).fetch;
        }
    });

    it('fetches subtitle text with query auth before falling back to header auth', async () => {
        const fetchMock = globalThis.fetch as jest.Mock;
        fetchMock
            .mockResolvedValueOnce(createResponse('not ready', { ok: false, status: 501 }))
            .mockResolvedValueOnce(createResponse(`1
00:00:00,000 --> 00:00:01,000
Hello`));

        const result = await fetchSubtitleFallbackVtt({
            track: createTrack(),
            initialUrl: new URL('http://example.com/library/streams/1?X-Plex-Token=token'),
            context: {
                serverUri: 'http://example.com',
                authHeaders: {
                    'X-Plex-Token': 'token',
                    'X-Plex-Client-Identifier': 'client-1',
                },
            },
            signal: new AbortController().signal,
            isCurrentLoad: () => true,
            deriveLanHttpUrl: () => null,
            logDebug: jest.fn(),
        });

        expect(result).toMatchObject({
            kind: 'success',
            vtt: expect.stringContaining('WEBVTT'),
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0]?.[0]).toBe('http://example.com/library/streams/1?X-Plex-Token=token');
        expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
            Accept: 'text/vtt, text/plain, */*',
        });
        expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual({
            Accept: 'text/vtt, text/plain, */*',
            'X-Plex-Token': 'token',
        });
    });

    it('retries a derived LAN http subtitle url for a non-token request when the primary request fails', async () => {
        const fetchMock = globalThis.fetch as jest.Mock;
        const deriveLanHttpUrl = jest.fn(
            () => new URL('http://192.168.50.19:32400/library/streams/1')
        );
        fetchMock
            .mockResolvedValueOnce(createResponse('nope', { ok: false, status: 500 }))
            .mockResolvedValueOnce(createResponse(`1
00:00:00,000 --> 00:00:01,000
Hello`));

        const result = await fetchSubtitleFallbackVtt({
            track: createTrack(),
            initialUrl: new URL('https://10-0-0-1.plex.direct:32400/library/streams/1'),
            context: {
                serverUri: 'https://10-0-0-1.plex.direct:32400',
                authHeaders: {},
            },
            signal: new AbortController().signal,
            isCurrentLoad: () => true,
            deriveLanHttpUrl,
            logDebug: jest.fn(),
        });

        expect(result).toMatchObject({
            kind: 'success',
            vtt: expect.stringContaining('WEBVTT'),
        });
        expect(deriveLanHttpUrl).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[1]?.[0]).toBe('http://192.168.50.19:32400/library/streams/1');
    });

    it('does not retry token-bearing HTTPS subtitle requests over LAN http and continues secure header attempts', async () => {
        const fetchMock = globalThis.fetch as jest.Mock;
        const deriveLanHttpUrl = jest.fn(
            (url: URL) => new URL(`http://192.168.50.19:32400${url.pathname}${url.search}`)
        );
        fetchMock
            .mockResolvedValueOnce(createResponse('nope', { ok: false, status: 500 }))
            .mockResolvedValueOnce(createResponse(`1
00:00:00,000 --> 00:00:01,000
Hello`));

        const result = await fetchSubtitleFallbackVtt({
            track: createTrack(),
            initialUrl: new URL('https://10-0-0-1.plex.direct:32400/library/streams/1?X-Plex-Token=token'),
            context: {
                serverUri: 'https://10-0-0-1.plex.direct:32400',
                authHeaders: { 'X-Plex-Token': 'token' },
            },
            signal: new AbortController().signal,
            isCurrentLoad: () => true,
            deriveLanHttpUrl,
            logDebug: jest.fn(),
        });

        expect(result).toMatchObject({
            kind: 'success',
            vtt: expect.stringContaining('WEBVTT'),
        });
        expect(deriveLanHttpUrl).toHaveBeenCalledTimes(2);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
            'https://10-0-0-1.plex.direct:32400/library/streams/1?X-Plex-Token=token',
            'https://10-0-0-1.plex.direct:32400/library/streams/1',
        ]);
        expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual({
            Accept: 'text/vtt, text/plain, */*',
            'X-Plex-Token': 'token',
        });
    });

    it('does not retry token-bearing universal subtitle extraction urls over LAN http', async () => {
        const fetchMock = globalThis.fetch as jest.Mock;
        const deriveLanHttpUrl = jest.fn(
            (url: URL) => new URL(`http://192.168.50.19:32400${url.pathname}${url.search}`)
        );
        fetchMock
            .mockResolvedValueOnce(createResponse('bad', { ok: false, status: 501 }))
            .mockResolvedValueOnce(createResponse('bad', { ok: false, status: 501 }))
            .mockResolvedValueOnce(createResponse('bad', { ok: false, status: 501 }))
            .mockResolvedValueOnce(createResponse('bad', { ok: false, status: 501 }))
            .mockResolvedValueOnce(createResponse('bad', { ok: false, status: 500 }))
            .mockResolvedValueOnce(createResponse(`1
00:00:00,000 --> 00:00:01,000
Hello`));

        const result = await fetchSubtitleFallbackVtt({
            track: createTrack(),
            initialUrl: new URL('https://10-0-0-1.plex.direct:32400/library/streams/1?X-Plex-Token=token'),
            context: {
                serverUri: 'https://10-0-0-1.plex.direct:32400',
                resolvedBaseUrl: 'https://10-0-0-1.plex.direct:32400',
                authHeaders: {
                    'X-Plex-Token': 'token',
                    'X-Plex-Client-Identifier': 'client-1',
                },
                itemKey: '999',
                sessionId: 'sess-1',
            },
            signal: new AbortController().signal,
            isCurrentLoad: () => true,
            deriveLanHttpUrl,
            logDebug: jest.fn(),
        });

        expect(result).toMatchObject({
            kind: 'success',
            vtt: expect.stringContaining('WEBVTT'),
        });
        expect(fetchMock).toHaveBeenCalledTimes(6);
        for (const call of fetchMock.mock.calls) {
            expect(String(call[0])).toMatch(/^https:/);
        }
        const universalUrls = fetchMock.mock.calls
            .map((call) => new URL(String(call[0])))
            .filter((url) => url.pathname === '/video/:/transcode/universal/subtitles');
        expect(universalUrls).toHaveLength(2);
        expect(universalUrls[0]?.searchParams.get('format')).toBe('srt');
        expect(universalUrls[1]?.searchParams.get('format')).toBe('vtt');
    });

    it('classifies html subtitle responses as unsupported', async () => {
        const fetchMock = globalThis.fetch as jest.Mock;
        const logDebug = jest.fn();
        fetchMock.mockResolvedValueOnce(
            createResponse('<!DOCTYPE html><html><body>not a subtitle</body></html>', {
                contentType: 'text/html',
            })
        );

        const result = await fetchSubtitleFallbackVtt({
            track: createTrack(),
            initialUrl: new URL('http://example.com/library/streams/1?X-Plex-Token=token'),
            context: {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
            },
            signal: new AbortController().signal,
            isCurrentLoad: () => true,
            deriveLanHttpUrl: () => null,
            logDebug,
        });

        expect(result).toEqual({
            kind: 'unsupported',
            reason: 'invalid_source',
        });
        const htmlResponseLog = logDebug.mock.calls
            .map((call) => call[1]())
            .find((entry) => entry.error === 'html_response');
        expect(htmlResponseLog).toEqual(
            expect.objectContaining({
                id: 'sub-1',
                error: 'html_response',
                attempt: 'query',
            })
        );
    });

    it('redacts fetch error response samples before logging', async () => {
        const fetchMock = globalThis.fetch as jest.Mock;
        const logDebug = jest.fn();
        const dirtyBody =
            'error http://10.0.0.2:32400/library/streams/1?X-Plex-Token=secret /Users/tristan/subtitles/movie.srt';
        fetchMock
            .mockResolvedValueOnce(createResponse(dirtyBody, { ok: false, status: 500, contentType: 'text/plain' }))
            .mockResolvedValueOnce(createResponse(`1
00:00:00,000 --> 00:00:01,000
Hello`));

        const result = await fetchSubtitleFallbackVtt({
            track: createTrack(),
            initialUrl: new URL('http://example.com/library/streams/1?X-Plex-Token=token'),
            context: {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
            },
            signal: new AbortController().signal,
            isCurrentLoad: () => true,
            deriveLanHttpUrl: () => null,
            logDebug,
        });

        expect(result).toMatchObject({ kind: 'success' });
        const fetchStatusLog = logDebug.mock.calls
            .map((call) => call[1]())
            .find((entry) => entry.attempt === 'subtitle_text_fetch_status');
        expect(fetchStatusLog).toEqual(
            expect.objectContaining({
                bodySample: expect.stringContaining('[REDACTED_URL]'),
            })
        );
        expect(fetchStatusLog.bodySample).toContain('[REDACTED_PATH]');
        expect(fetchStatusLog.bodySample).not.toContain('10.0.0.2');
        expect(fetchStatusLog.bodySample).not.toContain('secret');
        expect(fetchStatusLog.bodySample).not.toContain('/Users/tristan');
    });

    it('returns stale when the load is no longer current after a fetch attempt', async () => {
        const fetchMock = globalThis.fetch as jest.Mock;
        fetchMock.mockResolvedValueOnce(createResponse(`1
00:00:00,000 --> 00:00:01,000
Hello`));

        let currentLoad = true;
        const resultPromise = fetchSubtitleFallbackVtt({
            track: createTrack(),
            initialUrl: new URL('http://example.com/library/streams/1?X-Plex-Token=token'),
            context: {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
            },
            signal: new AbortController().signal,
            isCurrentLoad: () => currentLoad,
            deriveLanHttpUrl: () => null,
            logDebug: jest.fn(),
        });
        currentLoad = false;

        await expect(resultPromise).resolves.toEqual({ kind: 'stale' });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns stale when a successful subtitle response becomes stale while reading the body', async () => {
        const fetchMock = globalThis.fetch as jest.Mock;
        let resolveBody: (body: string) => void = () => {
            throw new Error('subtitle body resolver was not captured');
        };
        let notifyBodyReadStarted: () => void = () => undefined;
        const bodyReadStarted = new Promise<void>((resolve) => {
            notifyBodyReadStarted = resolve;
        });
        fetchMock.mockResolvedValueOnce({
            ...createResponse(''),
            text: () => new Promise<string>((resolve) => {
                resolveBody = resolve;
                notifyBodyReadStarted();
            }),
        });

        let currentLoad = true;
        const resultPromise = fetchSubtitleFallbackVtt({
            track: createTrack(),
            initialUrl: new URL('http://example.com/library/streams/1?X-Plex-Token=token'),
            context: {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
            },
            signal: new AbortController().signal,
            isCurrentLoad: () => currentLoad,
            deriveLanHttpUrl: () => null,
            logDebug: jest.fn(),
        });

        await bodyReadStarted;
        currentLoad = false;
        resolveBody(`1
00:00:00,000 --> 00:00:01,000
Old`);

        await expect(resultPromise).resolves.toEqual({ kind: 'stale' });
    });

    it('returns stale when an error subtitle response becomes stale while reading the body', async () => {
        const fetchMock = globalThis.fetch as jest.Mock;
        const logDebug = jest.fn();
        let resolveBody: (body: string) => void = () => {
            throw new Error('subtitle body resolver was not captured');
        };
        let notifyBodyReadStarted: () => void = () => undefined;
        const bodyReadStarted = new Promise<void>((resolve) => {
            notifyBodyReadStarted = resolve;
        });
        fetchMock.mockResolvedValueOnce({
            ...createResponse('', { ok: false, status: 403, contentType: 'text/plain' }),
            text: () => new Promise<string>((resolve) => {
                resolveBody = resolve;
                notifyBodyReadStarted();
            }),
        });

        let currentLoad = true;
        const resultPromise = fetchSubtitleFallbackVtt({
            track: createTrack(),
            initialUrl: new URL('http://example.com/library/streams/1?X-Plex-Token=token'),
            context: {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
            },
            signal: new AbortController().signal,
            isCurrentLoad: () => currentLoad,
            deriveLanHttpUrl: () => null,
            logDebug,
        });

        await bodyReadStarted;
        currentLoad = false;
        resolveBody('denied');

        await expect(resultPromise).resolves.toEqual({ kind: 'stale' });
        expect(logDebug).not.toHaveBeenCalledWith('subtitle_fetch_error', expect.any(Function));
    });

    it('classifies auth failures distinctly from unsupported failures', async () => {
        const fetchMock = globalThis.fetch as jest.Mock;
        fetchMock
            .mockResolvedValueOnce(createResponse('denied', { ok: false, status: 403 }))
            .mockResolvedValueOnce(createResponse('denied', { ok: false, status: 403 }))
            .mockResolvedValueOnce(createResponse('denied', { ok: false, status: 403 }))
            .mockResolvedValueOnce(createResponse('denied', { ok: false, status: 403 }))
            .mockResolvedValueOnce(createResponse('denied', { ok: false, status: 403 }))
            .mockResolvedValueOnce(createResponse('denied', { ok: false, status: 403 }));

        const result = await fetchSubtitleFallbackVtt({
            track: createTrack(),
            initialUrl: new URL('http://example.com/library/streams/1?X-Plex-Token=token'),
            context: {
                serverUri: 'http://example.com',
                authHeaders: {
                    'X-Plex-Token': 'token',
                    'X-Plex-Client-Identifier': 'client-1',
                },
                itemKey: '999',
                sessionId: 'sess-1',
            },
            signal: new AbortController().signal,
            isCurrentLoad: () => true,
            deriveLanHttpUrl: () => null,
            logDebug: jest.fn(),
        });

        expect(result).toEqual({
            kind: 'auth',
            reason: 'forbidden',
            status: 403,
        });
    });

    it('classifies server failures distinctly from permanent unsupported failures', async () => {
        const fetchMock = globalThis.fetch as jest.Mock;
        fetchMock
            .mockResolvedValueOnce(createResponse('bad', { ok: false, status: 500 }))
            .mockResolvedValueOnce(createResponse('bad', { ok: false, status: 500 }))
            .mockResolvedValueOnce(createResponse('bad', { ok: false, status: 500 }))
            .mockResolvedValueOnce(createResponse('bad', { ok: false, status: 500 }))
            .mockResolvedValueOnce(createResponse('bad', { ok: false, status: 500 }))
            .mockResolvedValueOnce(createResponse('bad', { ok: false, status: 500 }));

        const result = await fetchSubtitleFallbackVtt({
            track: createTrack(),
            initialUrl: new URL('http://example.com/library/streams/1?X-Plex-Token=token'),
            context: {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
                itemKey: '999',
                sessionId: 'sess-1',
            },
            signal: new AbortController().signal,
            isCurrentLoad: () => true,
            deriveLanHttpUrl: () => null,
            logDebug: jest.fn(),
        });

        expect(result).toEqual({
            kind: 'transient',
            reason: 'server_error',
            status: 500,
        });
    });

    it('classifies HTTP request timeout status as a timeout transient failure', async () => {
        const fetchMock = globalThis.fetch as jest.Mock;
        fetchMock.mockResolvedValue(createResponse('timeout', { ok: false, status: 408 }));

        const result = await fetchSubtitleFallbackVtt({
            track: createTrack(),
            initialUrl: new URL('http://example.com/library/streams/1?X-Plex-Token=token'),
            context: {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
                itemKey: '999',
                sessionId: 'sess-1',
            },
            signal: new AbortController().signal,
            isCurrentLoad: () => true,
            deriveLanHttpUrl: () => null,
            logDebug: jest.fn(),
        });

        expect(result).toEqual({
            kind: 'transient',
            reason: 'timeout',
            status: 408,
        });
    });

    it('falls back to the universal subtitles endpoint when stream fetch attempts fail', async () => {
        const fetchMock = globalThis.fetch as jest.Mock;
        fetchMock
            .mockResolvedValueOnce(createResponse('bad', { ok: false, status: 501 }))
            .mockResolvedValueOnce(createResponse('bad', { ok: false, status: 501 }))
            .mockResolvedValueOnce(createResponse('bad', { ok: false, status: 501 }))
            .mockResolvedValueOnce(createResponse('bad', { ok: false, status: 501 }))
            .mockResolvedValueOnce(createResponse(`1
00:00:00,000 --> 00:00:01,000
Hello`));

        const result = await fetchSubtitleFallbackVtt({
            track: createTrack(),
            initialUrl: new URL('http://example.com/library/streams/1?X-Plex-Token=token'),
            context: {
                serverUri: 'http://192.168.1.20:32400',
                resolvedBaseUrl: 'https://relay.plex.tv',
                authHeaders: {
                    'X-Plex-Token': 'token',
                    'X-Plex-Client-Identifier': 'client-1',
                },
                itemKey: '999',
                sessionId: 'sess-1',
            },
            signal: new AbortController().signal,
            isCurrentLoad: () => true,
            deriveLanHttpUrl: () => null,
            logDebug: jest.fn(),
        });

        expect(result).toMatchObject({
            kind: 'success',
            vtt: expect.stringContaining('WEBVTT'),
        });
        expect(fetchMock).toHaveBeenCalledTimes(5);

        const transcodeUrl = new URL(String(fetchMock.mock.calls[4]?.[0]));
        expect(transcodeUrl.origin).toBe('https://relay.plex.tv');
        expect(transcodeUrl.pathname).toBe('/video/:/transcode/universal/subtitles');
        expect(transcodeUrl.searchParams.get('path')).toBe('/library/metadata/999');
        expect(transcodeUrl.searchParams.get('subtitleStreamID')).toBe('sub-1');
        expect(transcodeUrl.searchParams.get('format')).toBe('srt');
        expect(transcodeUrl.searchParams.get('X-Plex-Client-Identifier')).toBe('client-1');
        expect(transcodeUrl.searchParams.get('X-Plex-Session-Identifier')).toBe('sess-1');
    });

    it('falls back to XHR when the transcode fetch throws', async () => {
        const fetchMock = globalThis.fetch as jest.Mock;
        fetchMock
            .mockResolvedValueOnce(createResponse('bad', { ok: false, status: 501 }))
            .mockResolvedValueOnce(createResponse('bad', { ok: false, status: 501 }))
            .mockResolvedValueOnce(createResponse('bad', { ok: false, status: 501 }))
            .mockResolvedValueOnce(createResponse('bad', { ok: false, status: 501 }))
            .mockRejectedValueOnce(new TypeError('Failed to fetch'));

        class MockXhr {
            status = 200;
            responseText = `1
00:00:00,000 --> 00:00:01,000
Hello`;
            timeout = 0;
            onerror: null | (() => void) = null;
            ontimeout: null | (() => void) = null;
            onload: null | (() => void) = null;
            open = jest.fn();
            setRequestHeader = jest.fn();
            overrideMimeType = jest.fn();
            abort = jest.fn();
            send = jest.fn(() => {
                void Promise.resolve().then(() => this.onload?.());
            });
        }

        const result = await fetchSubtitleFallbackVtt({
            track: createTrack(),
            initialUrl: new URL('http://example.com/library/streams/1?X-Plex-Token=token'),
            context: {
                serverUri: 'http://example.com',
                authHeaders: {
                    'X-Plex-Token': 'token',
                    'X-Plex-Client-Identifier': 'client-1',
                },
                itemKey: '999',
                sessionId: 'sess-1',
            },
            signal: new AbortController().signal,
            isCurrentLoad: () => true,
            deriveLanHttpUrl: () => null,
            logDebug: jest.fn(),
            createXhr: () => new MockXhr() as unknown as XMLHttpRequest,
        });

        expect(result).toMatchObject({
            kind: 'success',
            vtt: expect.stringContaining('WEBVTT'),
        });
    });

    it('redacts XHR error response samples before logging', async () => {
        const fetchMock = globalThis.fetch as jest.Mock;
        const logDebug = jest.fn();
        fetchMock
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(createResponse(`1
00:00:00,000 --> 00:00:01,000
Hello`));

        class MockXhr {
            status = 500;
            responseText =
                'error http://10.0.0.2:32400/library/streams/1?X-Plex-Token=secret /Users/tristan/subtitles/movie.srt';
            readyState = 4;
            timeout = 0;
            onerror: null | (() => void) = null;
            ontimeout: null | (() => void) = null;
            onabort: null | (() => void) = null;
            onload: null | (() => void) = null;
            open = jest.fn();
            setRequestHeader = jest.fn();
            overrideMimeType = jest.fn();
            abort = jest.fn();
            send = jest.fn(() => {
                void Promise.resolve().then(() => this.onload?.());
            });
        }

        const result = await fetchSubtitleFallbackVtt({
            track: createTrack(),
            initialUrl: new URL('http://example.com/library/streams/1?X-Plex-Token=token'),
            context: {
                serverUri: 'http://example.com',
                authHeaders: { 'X-Plex-Token': 'token' },
            },
            signal: new AbortController().signal,
            isCurrentLoad: () => true,
            deriveLanHttpUrl: () => null,
            logDebug,
            createXhr: () => new MockXhr() as unknown as XMLHttpRequest,
        });

        expect(result).toMatchObject({ kind: 'success' });
        const xhrStatusLog = logDebug.mock.calls
            .map((call) => call[1]())
            .find((entry) => entry.attempt === 'subtitle_text_xhr_status');
        expect(xhrStatusLog).toEqual(
            expect.objectContaining({
                bodySample: expect.stringContaining('[REDACTED_URL]'),
            })
        );
        expect(xhrStatusLog.bodySample).toContain('[REDACTED_PATH]');
        expect(xhrStatusLog.bodySample).not.toContain('10.0.0.2');
        expect(xhrStatusLog.bodySample).not.toContain('secret');
        expect(xhrStatusLog.bodySample).not.toContain('/Users/tristan');
    });

    it('keeps XHR retry on the secure URL and does not use LAN http for token-bearing requests', async () => {
        const fetchMock = globalThis.fetch as jest.Mock;
        const openedUrls: string[] = [];
        const deriveLanHttpUrl = jest.fn(
            (url: URL) => new URL(`http://192.168.50.19:32400${url.pathname}${url.search}`)
        );
        fetchMock
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(createResponse(`1
00:00:00,000 --> 00:00:01,000
Hello`));

        class MockXhr {
            status = 0;
            responseText = '';
            readyState = 4;
            timeout = 0;
            onerror: null | (() => void) = null;
            ontimeout: null | (() => void) = null;
            onabort: null | (() => void) = null;
            onload: null | (() => void) = null;
            open = jest.fn((_method: string, url: string) => {
                openedUrls.push(url);
            });
            setRequestHeader = jest.fn();
            overrideMimeType = jest.fn();
            abort = jest.fn();
            send = jest.fn(() => {
                void Promise.resolve().then(() => this.onerror?.());
            });
        }

        const result = await fetchSubtitleFallbackVtt({
            track: createTrack(),
            initialUrl: new URL('https://10-0-0-1.plex.direct:32400/library/streams/1?X-Plex-Token=token'),
            context: {
                serverUri: 'https://10-0-0-1.plex.direct:32400',
                authHeaders: { 'X-Plex-Token': 'token' },
            },
            signal: new AbortController().signal,
            isCurrentLoad: () => true,
            deriveLanHttpUrl,
            logDebug: jest.fn(),
            createXhr: () => new MockXhr() as unknown as XMLHttpRequest,
        });

        expect(result).toMatchObject({
            kind: 'success',
            vtt: expect.stringContaining('WEBVTT'),
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
            'https://10-0-0-1.plex.direct:32400/library/streams/1?X-Plex-Token=token',
            'https://10-0-0-1.plex.direct:32400/library/streams/1',
        ]);
        expect(openedUrls).toEqual([
            'https://10-0-0-1.plex.direct:32400/library/streams/1?X-Plex-Token=token',
        ]);
        expect(openedUrls.join(' ')).not.toContain('http://192.168.50.19');
    });
});
