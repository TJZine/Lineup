import {
    applyServerDecisionToStreamDecision,
    getSubtitleStreamServerDecision,
    isSubtitleBurnConfirmedByServerDecision,
    UniversalTranscodeDecisionClient,
} from '../diagnostics/UniversalTranscodeDecisionClient';
import type { HlsOptions, StreamDecision } from '../contracts/types';

function createResponse(overrides: Partial<Response> & { bodyText?: string } = {}): Response {
    const status = overrides.status ?? (overrides.ok === false ? 500 : 200);
    return new Response(overrides.bodyText ?? '', { status });
}

function createTranscodeRequest(
    overrides: Partial<NonNullable<StreamDecision['transcodeRequest']>> = {}
): NonNullable<StreamDecision['transcodeRequest']> {
    return {
        sessionId: 'sess-1',
        startOffsetMs: 0,
        startOffsetSeconds: 0,
        maxBitrate: 8000,
        maxBitrateReason: 'explicit',
        transcodeCompatMode: false,
        transcodeQuality: null,
        ...overrides,
    } as NonNullable<StreamDecision['transcodeRequest']>;
}

describe('UniversalTranscodeDecisionClient', () => {
    let mockFetch: jest.Mock;
    let getAuthHeaders: jest.Mock<Record<string, string>, []>;
    let getTranscodeUrl: jest.Mock<string, [string, HlsOptions]>;
    let throwIfAuthFailure: jest.Mock<void, [Response]>;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-05-05T12:00:00Z'));
        mockFetch = jest.fn();
        global.fetch = mockFetch as unknown as typeof global.fetch;
        getAuthHeaders = jest.fn(() => ({ 'X-Plex-Token': 'token-1', Accept: 'application/json' }));
        getTranscodeUrl = jest.fn((itemKey: string, options: HlsOptions) => {
            const url = new URL(`http://plex.local/video/:/transcode/universal/start.m3u8`);
            url.searchParams.set('path', itemKey);
            url.searchParams.set('session', options.sessionId ?? '');
            url.searchParams.set('existingParam', 'preserved');
            return url.toString();
        });
        throwIfAuthFailure = jest.fn();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.resetAllMocks();
    });

    function createClient(): UniversalTranscodeDecisionClient {
        return new UniversalTranscodeDecisionClient({
            getAuthHeaders,
            getTranscodeUrl,
            throwIfAuthFailure,
        });
    }

    it('converts the transcode request, fetches the decision URL, and parses XML decisions', async () => {
        mockFetch.mockResolvedValue(createResponse({
            bodyText:
                '<MediaContainer decisionCode="1000" decisionText="Transcode">' +
                '<TranscodeSession videoDecision="copy" audioDecision="transcode" subtitleDecision="none">' +
                '<Stream id="sub-1" streamType="3" decision="burn" location="segments-video" />' +
                '</TranscodeSession>' +
                '</MediaContainer>',
        }));

        const request = createTranscodeRequest({
            sessionId: 'sess-1',
            startOffsetMs: 65_432,
            startOffsetSeconds: 65,
            maxBitrate: 20000,
            mediaIndex: 1,
            partIndex: 2,
            audioStreamId: 'audio-1',
            subtitleStreamId: 'sub-1',
            subtitleMode: 'burn',
            hideDolbyVision: true,
        });

        const result = await createClient().fetchDecision('/library/metadata/123', request);

        expect(getTranscodeUrl).toHaveBeenCalledWith('/library/metadata/123', {
            sessionId: 'sess-1',
            startOffsetMs: 65_432,
            maxBitrate: 20000,
            transcodeCompatMode: false,
            transcodeQuality: null,
            mediaIndex: 1,
            partIndex: 2,
            audioStreamId: 'audio-1',
            subtitleStreamId: 'sub-1',
            subtitleMode: 'burn',
            hideDolbyVision: true,
        });
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [fetchedUrl, requestOptions] = mockFetch.mock.calls[0]!;
        const parsedUrl = new URL(String(fetchedUrl));
        expect(parsedUrl.origin).toBe('http://plex.local');
        expect(parsedUrl.pathname).toBe('/video/:/transcode/universal/decision');
        expect(parsedUrl.searchParams.get('path')).toBe('/library/metadata/123');
        expect(parsedUrl.searchParams.get('session')).toBe('sess-1');
        expect(parsedUrl.searchParams.get('existingParam')).toBe('preserved');
        expect(requestOptions).toEqual(expect.objectContaining({
            method: 'GET',
            headers: { 'X-Plex-Token': 'token-1', Accept: 'application/json' },
        }));
        expect(throwIfAuthFailure).toHaveBeenCalledWith(expect.any(Object));
        expect(result).toMatchObject({
            fetchedAt: Date.parse('2026-05-05T12:00:00Z'),
            decisionCode: '1000',
            decisionText: 'Transcode',
            videoDecision: 'copy',
            audioDecision: 'transcode',
            subtitleDecision: 'none',
            streams: [
                {
                    id: 'sub-1',
                    streamType: 3,
                    decision: 'burn',
                },
            ],
        });
    });

    it('rejects malformed XML reported by DOMParser without using the lightweight fallback', async () => {
        mockFetch.mockResolvedValue(createResponse({
            bodyText:
                '<MediaContainer decisionCode="2000" decisionText="Fallback">' +
                '<TranscodeSession><Stream id="sub-1" streamType="3" decision="burn"></MediaContainer>',
        }));

        await expect(createClient().fetchDecision('/library/metadata/123', createTranscodeRequest()))
            .rejects.toThrow('Invalid universal transcode decision XML');
    });

    it.each([
        ['absent', undefined],
        ['non-callable', { parseFromString: jest.fn() }],
    ])('uses the complete lightweight parser when DOMParser is %s', async (_caseName, parserValue) => {
        const originalDomParser = globalThis.DOMParser;
        Object.defineProperty(globalThis, 'DOMParser', {
            configurable: true,
            writable: true,
            value: parserValue,
        });
        mockFetch.mockResolvedValue(createResponse({
            bodyText:
                '<?xml version="1.0" encoding="UTF-8"?>' +
                '<!-- PMS universal decision -->' +
                '<MediaContainer decisionCode="2000" decisionText="Fallback">' +
                '<TranscodeSession videoDecision="copy">' +
                '<Stream id="sub-1" streamType="3" decision="burn" />' +
                '</TranscodeSession></MediaContainer>',
        }));

        try {
            await expect(createClient().fetchDecision('/library/metadata/123', createTranscodeRequest()))
                .resolves.toMatchObject({
                    decisionCode: '2000',
                    decisionText: 'Fallback',
                    videoDecision: 'copy',
                    streams: [{ id: 'sub-1', streamType: 3, decision: 'burn' }],
                });
        } finally {
            Object.defineProperty(globalThis, 'DOMParser', {
                configurable: true,
                writable: true,
                value: originalDomParser,
            });
        }
    });

    it('uses the lightweight parser when DOM parsing throws before yielding a document', async () => {
        const originalDomParser = globalThis.DOMParser;
        Object.defineProperty(globalThis, 'DOMParser', {
            configurable: true,
            writable: true,
            value: class {
                parseFromString(): never {
                    throw new Error('DOM parsing is unavailable');
                }
            },
        });
        mockFetch.mockResolvedValue(createResponse({
            bodyText:
                '<MediaContainer generalDecisionCode="2000" generalDecisionText="Fallback">' +
                '<TranscodeSession><Stream id="sub-1" streamType="3" decision="burn"></Stream>' +
                '</TranscodeSession></MediaContainer>',
        }));

        try {
            await expect(createClient().fetchDecision('/library/metadata/123', createTranscodeRequest()))
                .resolves.toMatchObject({
                    decisionCode: '2000',
                    decisionText: 'Fallback',
                    streams: [{ id: 'sub-1', streamType: 3, decision: 'burn' }],
                });
        } finally {
            Object.defineProperty(globalThis, 'DOMParser', {
                configurable: true,
                writable: true,
                value: originalDomParser,
            });
        }
    });

    it.each([
        ['truncated container', '<MediaContainer><TranscodeSession /></MediaContain'],
        ['truncated transcode', '<MediaContainer><TranscodeSession><Stream id="sub-1" streamType="3" decision="burn" /></MediaContainer>'],
        ['truncated stream', '<MediaContainer><TranscodeSession><Stream id="sub-1" streamType="3" decision="burn"></TranscodeSession></MediaContainer>'],
        ['mismatched fragment', '<MediaContainer><TranscodeSession></Stream></TranscodeSession></MediaContainer>'],
        ['trailing malformed content', '<MediaContainer><TranscodeSession /></MediaContainer><broken'],
        [
            'non-whitespace text gap with false burn evidence',
            '<MediaContainer><TranscodeSession>rock & roll' +
            '<Stream id="sub-1" streamType="3" decision="burn" />' +
            '</TranscodeSession></MediaContainer>',
        ],
        [
            'mid-document XML declaration with false burn evidence',
            '<MediaContainer><TranscodeSession><?xml version="1.0"?>' +
            '<Stream id="sub-1" streamType="3" decision="burn" />' +
            '</TranscodeSession></MediaContainer>',
        ],
        [
            'mid-document processing instruction with false burn evidence',
            '<MediaContainer><TranscodeSession><?plex decision="continue"?>' +
            '<Stream id="sub-1" streamType="3" decision="burn" />' +
            '</TranscodeSession></MediaContainer>',
        ],
        [
            'invalid XML control character with false burn evidence',
            '<MediaContainer><TranscodeSession>\u0001' +
            '<Stream id="sub-1" streamType="3" decision="burn" />' +
            '</TranscodeSession></MediaContainer>',
        ],
    ])('rejects %s in the lightweight fallback', async (_caseName, bodyText) => {
        const originalDomParser = globalThis.DOMParser;
        Object.defineProperty(globalThis, 'DOMParser', {
            configurable: true,
            writable: true,
            value: undefined,
        });
        mockFetch.mockResolvedValue(createResponse({ bodyText }));

        try {
            await expect(createClient().fetchDecision('/library/metadata/123', createTranscodeRequest()))
                .rejects.toThrow('Invalid universal transcode decision XML');
        } finally {
            Object.defineProperty(globalThis, 'DOMParser', {
                configurable: true,
                writable: true,
                value: originalDomParser,
            });
        }
    });

    it('does not treat near-match fallback attributes or streams outside TranscodeSession as burn evidence', async () => {
        const originalDomParser = globalThis.DOMParser;
        Object.defineProperty(globalThis, 'DOMParser', {
            configurable: true,
            writable: true,
            value: undefined,
        });
        mockFetch.mockResolvedValue(createResponse({
            bodyText:
                '<MediaContainer decisionCodeExtra="2000">' +
                '<Stream id="sub-1" streamType="3" decision="burn" />' +
                '<TranscodeSession><Stream idExtra="sub-1" streamTypeExtra="3" decisionExtra="burn" /></TranscodeSession>' +
                '</MediaContainer>',
        }));

        try {
            await expect(createClient().fetchDecision('/library/metadata/123', createTranscodeRequest()))
                .resolves.toEqual({ fetchedAt: Date.parse('2026-05-05T12:00:00Z') });
        } finally {
            Object.defineProperty(globalThis, 'DOMParser', {
                configurable: true,
                writable: true,
                value: originalDomParser,
            });
        }
    });

    it.each(['absent', 'throwing'] as const)(
        'decodes fallback XML references with DOM-equivalent semantics when DOMParser is %s',
        async (fallbackMode) => {
            const originalDomParser = globalThis.DOMParser;
            const bodyText =
                '<MediaContainer decisionText="&amp;&lt;&gt;&quot;&apos;&#65;&#x1F4FA;">' +
                '<TranscodeSession><Stream id="sub&#45;1&amp;x" streamType="3" decision="burn" />' +
                '</TranscodeSession></MediaContainer>';
            mockFetch.mockImplementation(() => Promise.resolve(createResponse({ bodyText })));

            const domResult = await createClient().fetchDecision(
                '/library/metadata/123',
                createTranscodeRequest()
            );
            Object.defineProperty(globalThis, 'DOMParser', {
                configurable: true,
                writable: true,
                value: fallbackMode === 'absent'
                    ? undefined
                    : class {
                        parseFromString(): never {
                            throw new Error('DOM parsing is unavailable');
                        }
                    },
            });

            try {
                const fallbackResult = await createClient().fetchDecision(
                    '/library/metadata/123',
                    createTranscodeRequest()
                );
                expect(fallbackResult.decisionText).toBe('&<>"\'A📺');
                expect(fallbackResult.decisionText).toBe(domResult.decisionText);
                expect(fallbackResult.streams?.[0]?.id).toBe('sub-1&x');
                expect(fallbackResult.streams?.[0]?.id).toBe(domResult.streams?.[0]?.id);
            } finally {
                Object.defineProperty(globalThis, 'DOMParser', {
                    configurable: true,
                    writable: true,
                    value: originalDomParser,
                });
            }
        }
    );

    it.each([
        ['unknown entity', '&unknown;'],
        ['prototype-key entity', '&constructor;'],
        ['bare ampersand', 'rock & roll'],
        ['malformed hexadecimal reference', '&#xZZ;'],
        ['malformed decimal reference', '&#12x;'],
        ['forbidden null code point', '&#0;'],
        ['surrogate code point', '&#xD800;'],
        ['out-of-range code point', '&#x110000;'],
    ])('rejects %s in fallback attributes with the fixed sanitized error', async (_caseName, encodedValue) => {
        const originalDomParser = globalThis.DOMParser;
        Object.defineProperty(globalThis, 'DOMParser', {
            configurable: true,
            writable: true,
            value: undefined,
        });
        mockFetch.mockResolvedValue(createResponse({
            bodyText: `<MediaContainer decisionText="${encodedValue}"><TranscodeSession /></MediaContainer>`,
        }));

        try {
            await expect(createClient().fetchDecision('/library/metadata/123', createTranscodeRequest()))
                .rejects.toThrow('Invalid universal transcode decision XML');
        } finally {
            Object.defineProperty(globalThis, 'DOMParser', {
                configurable: true,
                writable: true,
                value: originalDomParser,
            });
        }
    });

    it('handles deeply nested fallback elements without recursive traversal failure', async () => {
        const originalDomParser = globalThis.DOMParser;
        Object.defineProperty(globalThis, 'DOMParser', {
            configurable: true,
            writable: true,
            value: undefined,
        });
        const depth = 6000;
        const bodyText = '<MediaContainer>' +
            '<Layer>'.repeat(depth) +
            '<TranscodeSession><Stream id="sub-1" streamType="3" decision="burn" /></TranscodeSession>' +
            '</Layer>'.repeat(depth) +
            '</MediaContainer>';
        expect(new TextEncoder().encode(bodyText).byteLength).toBeLessThan(1024 * 1024);
        mockFetch.mockResolvedValue(createResponse({ bodyText }));

        try {
            await expect(createClient().fetchDecision('/library/metadata/123', createTranscodeRequest()))
                .resolves.toMatchObject({
                    streams: [{ id: 'sub-1', streamType: 3, decision: 'burn' }],
                });
        } finally {
            Object.defineProperty(globalThis, 'DOMParser', {
                configurable: true,
                writable: true,
                value: originalDomParser,
            });
        }
    });

    it('passes auth failures through before non-ok handling', async () => {
        const response = createResponse({ ok: false, status: 401 });
        const authError = new Error('auth expired');
        mockFetch.mockResolvedValue(response);
        throwIfAuthFailure.mockImplementation(() => {
            throw authError;
        });

        await expect(createClient().fetchDecision('/library/metadata/123', createTranscodeRequest())).rejects.toBe(authError);
    });

    it('confirms burn only from the selected subtitle stream decision', () => {
        const request = createTranscodeRequest({
            sessionId: 'sess-1',
            maxBitrate: 8000,
            subtitleStreamId: 'sub-1',
            subtitleMode: 'burn',
        });

        expect(isSubtitleBurnConfirmedByServerDecision(request, {
            fetchedAt: 1,
            subtitleDecision: 'burn',
        })).toBe(false);
        expect(isSubtitleBurnConfirmedByServerDecision(request, {
            fetchedAt: 1,
            streams: [{ id: 'sub-2', streamType: 3, decision: 'burn' }],
        })).toBe(false);
        expect(isSubtitleBurnConfirmedByServerDecision(request, {
            fetchedAt: 1,
            streams: [{ id: 'sub-1', streamType: 3, decision: 'copy' }],
        })).toBe(false);
        expect(isSubtitleBurnConfirmedByServerDecision(request, {
            fetchedAt: 1,
            streams: [{ id: 'sub-1', streamType: 3, decision: 'burn' }],
        })).toBe(true);
    });

    it('returns the selected subtitle stream server decision only for subtitle streams', () => {
        expect(getSubtitleStreamServerDecision(null, 'sub-1')).toBeNull();
        expect(getSubtitleStreamServerDecision({
            fetchedAt: 1,
            streams: [
                { id: 'sub-1', streamType: 2, decision: 'copy' },
                { id: 'sub-2', streamType: 3, decision: 'burn' },
            ],
        }, 'sub-1')).toBeNull();
        expect(getSubtitleStreamServerDecision({
            fetchedAt: 1,
            streams: [
                { id: 'sub-1', streamType: 2, decision: 'copy' },
                { id: 'sub-1', streamType: 3, decision: 'burn' },
            ],
        }, 'sub-1')).toBe('burn');
    });

    it('applies server decision evidence to subtitle burn-in confirmation', () => {
        const decision = {
            playbackUrl: 'http://plex.local/stream.m3u8',
            protocol: 'hls',
            isDirectPlay: false,
            isTranscoding: true,
            container: 'mpegts',
            videoCodec: 'h264',
            audioCodec: 'aac',
            subtitleDelivery: 'burn',
            sessionId: 'sess-1',
            mediaIndex: 0,
            partIndex: 0,
            partKey: '/library/parts/1/1/file.mkv',
            selectedAudioStream: null,
            selectedSubtitleStream: null,
            width: 1920,
            height: 1080,
            bitrate: 8000,
            subtitleBurnIn: {
                requested: true,
                confirmed: false,
                reason: 'requested',
                subtitleStreamId: 'sub-1',
                subtitleMode: 'burn',
            },
            transcodeRequest: {
                sessionId: 'sess-1',
                startOffsetMs: 0,
                startOffsetSeconds: 0,
                maxBitrate: 8000,
                maxBitrateReason: 'explicit',
                subtitleStreamId: 'sub-1',
                subtitleMode: 'burn',
            },
        } as StreamDecision;

        applyServerDecisionToStreamDecision(decision, {
            fetchedAt: 1,
            videoDecision: 'copy',
            streams: [{ id: 'sub-1', streamType: 3, decision: 'burn' }],
        });

        expect(decision.serverDecision?.videoDecision).toBe('copy');
        expect(decision.subtitleBurnIn?.confirmed).toBe(true);
    });

    it('rejects non-ok decision responses', async () => {
        mockFetch.mockResolvedValue(createResponse({ ok: false, status: 500 }));

        await expect(createClient().fetchDecision('/library/metadata/123', createTranscodeRequest()))
            .rejects.toThrow('PMS decision request failed: 500');
    });

    it('keeps the four-second deadline active while reading the decision body', async () => {
        const cancel = jest.fn();
        mockFetch.mockResolvedValue(new Response(new ReadableStream<Uint8Array>({ cancel })));

        const request = createClient().fetchDecision(
            '/library/metadata/123',
            createTranscodeRequest()
        );
        const expectation = expect(request).rejects.toMatchObject({ name: 'AbortError' });
        await jest.advanceTimersByTimeAsync(4000);

        await expectation;
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('rejects oversized decision XML from content length and chunked bodies', async () => {
        const declaredCancel = jest.fn();
        mockFetch.mockResolvedValueOnce(new Response(
            new ReadableStream<Uint8Array>({ cancel: declaredCancel }),
            { headers: { 'content-length': String(1024 * 1024 + 1) } }
        ));

        await expect(createClient().fetchDecision(
            '/library/metadata/123',
            createTranscodeRequest()
        )).rejects.toThrow('1048576-byte limit');
        expect(declaredCancel).toHaveBeenCalledTimes(1);

        const chunkedCancel = jest.fn();
        mockFetch.mockResolvedValueOnce(new Response(new ReadableStream<Uint8Array>({
            start(controller): void {
                controller.enqueue(new Uint8Array(1024 * 1024));
                controller.enqueue(new Uint8Array(1));
            },
            cancel: chunkedCancel,
        })));

        await expect(createClient().fetchDecision(
            '/library/metadata/123',
            createTranscodeRequest()
        )).rejects.toThrow('1048576-byte limit');
        expect(chunkedCancel).toHaveBeenCalledTimes(1);
    });

    it('aborts the decision request after the configured timeout', async () => {
        mockFetch.mockImplementation((_url: string, options?: RequestInit) => new Promise((_resolve, reject) => {
            const signal = options?.signal;
            signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }));

        const request = createClient().fetchDecision('/library/metadata/123', createTranscodeRequest());
        jest.advanceTimersByTime(4001);

        await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    });
});
