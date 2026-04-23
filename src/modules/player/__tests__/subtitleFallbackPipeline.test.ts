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

        expect(result).toContain('WEBVTT');
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

    it('retries a derived LAN http subtitle url when the primary request fails', async () => {
        const fetchMock = globalThis.fetch as jest.Mock;
        const deriveLanHttpUrl = jest.fn(
            () => new URL('http://192.168.50.19:32400/library/streams/1?X-Plex-Token=token')
        );
        fetchMock
            .mockResolvedValueOnce(createResponse('nope', { ok: false, status: 500 }))
            .mockResolvedValueOnce(createResponse(`1
00:00:00,000 --> 00:00:01,000
Hello`));

        const result = await fetchSubtitleFallbackVtt({
            track: createTrack(),
            initialUrl: new URL('https://relay.plex.tv/library/streams/1?X-Plex-Token=token'),
            context: {
                serverUri: 'https://relay.plex.tv',
                authHeaders: { 'X-Plex-Token': 'token' },
            },
            signal: new AbortController().signal,
            isCurrentLoad: () => true,
            deriveLanHttpUrl,
            logDebug: jest.fn(),
        });

        expect(result).toContain('WEBVTT');
        expect(deriveLanHttpUrl).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[1]?.[0]).toBe('http://192.168.50.19:32400/library/streams/1?X-Plex-Token=token');
    });

    it('rejects html subtitle responses and logs the html_response branch', async () => {
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

        expect(result).toBeNull();
        expect(logDebug).toHaveBeenCalledWith(
            'subtitle_fetch_error',
            expect.any(Function)
        );
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

    it('short-circuits to null when the load is stale after a fetch attempt', async () => {
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

        await expect(resultPromise).resolves.toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
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

        expect(result).toContain('WEBVTT');
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

        expect(result).toContain('WEBVTT');
    });
});
