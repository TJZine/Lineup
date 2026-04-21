import {
    buildSubtitleStreamProbeRequestContext,
    readSubtitleProbeSample,
} from '../SubtitleStreamProbeSupport';

describe('SubtitleStreamProbeSupport', () => {
    it('builds a redacted request context for direct subtitle stream keys', () => {
        const context = buildSubtitleStreamProbeRequestContext({
            authHeaders: {
                'X-Plex-Token': 'secret-token',
                'X-Plex-Client-Identifier': 'test-client',
            },
            serverUri: 'http://192.168.1.100:32400',
            subtitleStreamId: 'sub-1',
            subtitleStreamKey: '/library/streams/sub-1',
        });

        expect(context.urlSource).toBe('key');
        expect(context.baseUrl.toString()).toBe('http://192.168.1.100:32400/library/streams/sub-1');
        expect(context.headers).toEqual(
            expect.objectContaining({
                Accept: 'text/vtt, text/plain, */*',
                'X-Plex-Token': 'secret-token',
                'X-Plex-Client-Identifier': 'test-client',
            })
        );
        expect(context.redactedTrackSrcQueryAuth).toContain('REDACTED');
    });

    it('reads and classifies a streamed subtitle sample', async () => {
        const result = await readSubtitleProbeSample(
            new Response('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nTest', {
                status: 200,
                headers: { 'content-type': 'text/vtt' },
            }),
            'srt',
            2048
        );

        expect(result).toEqual(
            expect.objectContaining({
                detected: 'webvtt',
                looksLikeHtml: false,
                sampleCapped: false,
            })
        );
        expect(result.sampleLength).toBeGreaterThan(0);
    });
});
