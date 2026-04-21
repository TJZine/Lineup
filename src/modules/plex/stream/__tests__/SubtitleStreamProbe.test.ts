/**
 * @fileoverview Unit tests for subtitle stream probe helpers.
 */

import {
    probeSubtitleStreamDelivery,
    SUBTITLE_STREAM_PROBE_TIMEOUT_MS,
} from '../SubtitleStreamProbe';

describe('SubtitleStreamProbe', () => {
    let mockFetch: jest.Mock;

    beforeEach(() => {
        mockFetch = jest.fn().mockResolvedValue({ ok: true });
        global.fetch = mockFetch;
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.resetAllMocks();
    });

    it('keeps subtitle debug probe request options and timeout unchanged', async () => {
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
        const logDebug = jest.fn();

        mockFetch.mockResolvedValue(
            new Response('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nTest', {
                status: 200,
                headers: { 'content-type': 'text/vtt' },
            })
        );

        await probeSubtitleStreamDelivery(
            {
                itemKey: '12345',
                subtitleStreamId: 'sub-1',
                subtitleStreamKey: '/library/streams/sub-1',
                codec: 'srt',
                language: 'English',
            },
            {
                serverUri: 'http://192.168.1.100:32400',
                getAuthHeaders: () => ({
                    'X-Plex-Token': 'mock-token',
                    'X-Plex-Client-Identifier': 'test-client-id',
                }),
                logDebug,
            }
        );

        expect(mockFetch).toHaveBeenCalledWith(
            'http://192.168.1.100:32400/library/streams/sub-1',
            expect.objectContaining({
                method: 'GET',
                cache: 'no-store',
                mode: 'cors',
                credentials: 'omit',
                headers: expect.objectContaining({
                    'X-Plex-Token': 'mock-token',
                    'X-Plex-Client-Identifier': 'test-client-id',
                    Accept: 'text/vtt, text/plain, */*',
                }),
                signal: expect.any(AbortSignal),
            })
        );
        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), SUBTITLE_STREAM_PROBE_TIMEOUT_MS);
        expect(logDebug).toHaveBeenCalledWith(
            'subtitle_stream_probe',
            expect.objectContaining({
                subtitleStreamId: 'sub-1',
                urlSource: 'key',
            })
        );
    });

    it('falls back to the server-relative debug probe URL for foreign absolute subtitle keys', async () => {
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
        const logDebug = jest.fn();

        mockFetch.mockResolvedValue(
            new Response('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nTest', {
                status: 200,
                headers: { 'content-type': 'text/vtt' },
            })
        );

        await probeSubtitleStreamDelivery(
            {
                itemKey: '12345',
                subtitleStreamId: 'sub-foreign',
                subtitleStreamKey: 'https://malicious.example/library/streams/sub-foreign',
                codec: 'srt',
                language: 'English',
            },
            {
                serverUri: 'http://192.168.1.100:32400',
                getAuthHeaders: () => ({
                    'X-Plex-Token': 'mock-token',
                    'X-Plex-Client-Identifier': 'test-client-id',
                }),
                logDebug,
            }
        );

        expect(mockFetch).not.toHaveBeenCalledWith(
            'https://malicious.example/library/streams/sub-foreign',
            expect.anything()
        );
        expect(mockFetch).toHaveBeenCalledWith(
            'http://192.168.1.100:32400/library/streams/sub-foreign',
            expect.objectContaining({
                method: 'GET',
                cache: 'no-store',
                mode: 'cors',
                credentials: 'omit',
                headers: expect.objectContaining({
                    'X-Plex-Token': 'mock-token',
                    'X-Plex-Client-Identifier': 'test-client-id',
                    Accept: 'text/vtt, text/plain, */*',
                }),
                signal: expect.any(AbortSignal),
            })
        );
        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), SUBTITLE_STREAM_PROBE_TIMEOUT_MS);
        expect(logDebug).toHaveBeenCalledWith(
            'subtitle_stream_probe',
            expect.objectContaining({
                subtitleStreamId: 'sub-foreign',
                urlSource: 'id_fallback',
            })
        );
    });
});
