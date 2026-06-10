import {
    applyServerDecisionToStreamDecision,
    getSubtitleStreamServerDecision,
    isSubtitleBurnConfirmedByServerDecision,
    UniversalTranscodeDecisionClient,
} from '../diagnostics/UniversalTranscodeDecisionClient';
import type { HlsOptions, StreamDecision } from '../contracts/types';

function createResponse(overrides: Partial<Response> & { bodyText?: string } = {}): Response {
    return {
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(overrides.bodyText ?? ''),
        ...overrides,
    } as unknown as Response;
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

    it('uses the lightweight attribute parser when DOMParser reports malformed XML', async () => {
        mockFetch.mockResolvedValue(createResponse({
            bodyText:
                '<MediaContainer decisionCode="2000" decisionText="Fallback">' +
                '<TranscodeSession><Stream id="sub-1" streamType="3" decision="burn"></MediaContainer>',
        }));

        const result = await createClient().fetchDecision('/library/metadata/123', createTranscodeRequest());

        expect(result).toMatchObject({
            decisionCode: '2000',
            decisionText: 'Fallback',
            streams: [
                {
                    id: 'sub-1',
                    streamType: 3,
                    decision: 'burn',
                },
            ],
        });
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
