import {
    buildSubtitleStreamProbeRequestContext,
    readSubtitleProbeSample,
} from '../diagnostics/SubtitleStreamProbeSupport';
import { PLEX_TOKEN_HEADER } from '../../shared/plexUrl';

describe('SubtitleStreamProbeSupport', () => {
    it('builds a redacted request context for direct subtitle stream keys', () => {
        const context = buildSubtitleStreamProbeRequestContext({
            authHeaders: {
                [PLEX_TOKEN_HEADER]: 'secret-token',
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
                [PLEX_TOKEN_HEADER]: 'secret-token',
                'X-Plex-Client-Identifier': 'test-client',
            })
        );
        expect(context.redactedTrackSrcQueryAuth).toContain('REDACTED');
    });

    it('keeps the probe Accept header authoritative over incoming auth headers', () => {
        const context = buildSubtitleStreamProbeRequestContext({
            authHeaders: {
                Accept: 'application/json',
                [PLEX_TOKEN_HEADER]: 'secret-token',
            },
            serverUri: 'http://192.168.1.100:32400',
            subtitleStreamId: 'sub-1',
        });

        expect(context.headers.Accept).toBe('text/vtt, text/plain, */*');
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

    it('does not classify non-timestamp arrow text as SRT', async () => {
        const result = await readSubtitleProbeSample(
            new Response('caption --> pending review', {
                status: 200,
                headers: { 'content-type': 'text/plain' },
            }),
            'unknown',
            2048
        );

        expect(result.detected).toBe('unknown');
    });

    it('falls back to codec detection when the streamed sample is empty', async () => {
        const result = await readSubtitleProbeSample(
            new Response('', {
                status: 200,
                headers: { 'content-type': 'text/plain' },
            }),
            'srt',
            2048
        );

        expect(result).toEqual(
            expect.objectContaining({
                detected: 'srt',
                sampleLength: 0,
            })
        );
    });

    it('flushes split utf-8 characters before returning the sample', async () => {
        const encoder = new TextEncoder();
        const firstChunk = encoder.encode('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\ncaf');
        const finalChar = encoder.encode('é');
        const stream = new ReadableStream<Uint8Array>({
            start(controller): void {
                controller.enqueue(firstChunk);
                controller.enqueue(finalChar.slice(0, 1));
                controller.enqueue(finalChar.slice(1));
                controller.close();
            },
        });

        const result = await readSubtitleProbeSample(
            new Response(stream, {
                status: 200,
                headers: { 'content-type': 'text/vtt' },
            }),
            'vtt',
            2048
        );

        expect(result.detected).toBe('webvtt');
        expect(result.sampleLength).toBeGreaterThan('WEBVTT\n\n00:00:00.000 --> 00:00:01.000\ncaf'.length);
    });
});
