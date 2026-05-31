import { buildPlaybackSummary } from '../playbackSummary';

describe('buildPlaybackSummary', () => {
    it('labels HLS sessions without PMS decision evidence separately from transcode', () => {
        const summary = buildPlaybackSummary({
            stream: {
                protocol: 'hls',
                isDirectPlay: false,
                isTranscoding: true,
                videoCodec: 'h264',
                audioCodec: 'aac',
            },
        });

        expect(summary.tag).toBe('HLS Session • H.264/AAC');
    });

    it('labels PMS copy/remux decisions without audio or video transcode as direct stream', () => {
        const summary = buildPlaybackSummary({
            stream: {
                isDirectPlay: false,
                isTranscoding: true,
                videoCodec: 'h264',
                audioCodec: 'aac',
                serverDecision: {
                    videoDecision: 'copy',
                    audioDecision: 'copy',
                },
            },
        });

        expect(summary.tag).toBe('Direct Stream • H.264/AAC');
    });

    it('keeps incomplete PMS decisions labeled as HLS sessions', () => {
        const summary = buildPlaybackSummary({
            stream: {
                protocol: 'hls',
                isDirectPlay: false,
                isTranscoding: true,
                videoCodec: 'h264',
                audioCodec: 'aac',
                serverDecision: {
                    decisionCode: '1000',
                    decisionText: 'Decision fetched without A/V fields',
                },
            },
        });

        expect(summary.tag).toBe('HLS Session • H.264/AAC');
    });

    it('keeps one-sided PMS video copy decisions labeled as HLS sessions', () => {
        const summary = buildPlaybackSummary({
            stream: {
                protocol: 'hls',
                isDirectPlay: false,
                isTranscoding: true,
                videoCodec: 'h264',
                audioCodec: 'aac',
                serverDecision: {
                    videoDecision: 'copy',
                },
            },
        });

        expect(summary.tag).toBe('HLS Session • H.264/AAC');
    });

    it('keeps one-sided PMS audio copy decisions labeled as HLS sessions', () => {
        const summary = buildPlaybackSummary({
            stream: {
                protocol: 'hls',
                isDirectPlay: false,
                isTranscoding: true,
                videoCodec: 'h264',
                audioCodec: 'aac',
                serverDecision: {
                    audioDecision: 'copy',
                },
            },
        });

        expect(summary.tag).toBe('HLS Session • H.264/AAC');
    });

    it('keeps audio transcode without video decision evidence labeled as an HLS session', () => {
        const summary = buildPlaybackSummary({
            stream: {
                protocol: 'hls',
                isDirectPlay: false,
                isTranscoding: true,
                videoCodec: 'h264',
                audioCodec: 'aac',
                serverDecision: {
                    audioDecision: 'transcode',
                },
            },
        });

        expect(summary.tag).toBe('HLS Session • H.264/AAC');
    });

    it('labels PMS audio-only transcode decisions as audio transcode', () => {
        const summary = buildPlaybackSummary({
            stream: {
                isDirectPlay: false,
                isTranscoding: true,
                videoCodec: 'h264',
                audioCodec: 'aac',
                serverDecision: {
                    videoDecision: 'copy',
                    audioDecision: 'transcode',
                },
            },
        });

        expect(summary.tag).toBe('Audio Transcode • H.264/AAC');
    });

    it('labels PMS video transcode decisions as video transcode', () => {
        const summary = buildPlaybackSummary({
            stream: {
                isDirectPlay: false,
                isTranscoding: true,
                videoCodec: 'h264',
                audioCodec: 'aac',
                serverDecision: {
                    videoDecision: 'transcode',
                    audioDecision: 'copy',
                },
            },
        });

        expect(summary.tag).toBe('Video Transcode • H.264/AAC');
    });

    it('labels confirmed subtitle burn-in as video transcode', () => {
        const summary = buildPlaybackSummary({
            stream: {
                isDirectPlay: false,
                isTranscoding: true,
                videoCodec: 'h264',
                audioCodec: 'aac',
                subtitleBurnIn: {
                    confirmed: true,
                },
                serverDecision: {
                    videoDecision: 'copy',
                    audioDecision: 'copy',
                },
            },
        });

        expect(summary.tag).toBe('Video Transcode • H.264/AAC');
    });

    it('labels matching selected subtitle stream burn evidence as video transcode', () => {
        const summary = buildPlaybackSummary({
            stream: {
                isDirectPlay: false,
                isTranscoding: true,
                videoCodec: 'h264',
                audioCodec: 'aac',
                selectedSubtitle: {
                    id: 'sub-1',
                },
                serverDecision: {
                    videoDecision: 'copy',
                    audioDecision: 'copy',
                    streams: [
                        { id: 'sub-1', streamType: 3, decision: 'burn' },
                    ],
                },
            },
        });

        expect(summary.tag).toBe('Video Transcode • H.264/AAC');
    });

    it('does not label broad subtitle decision burn as video transcode without confirmation evidence', () => {
        const summary = buildPlaybackSummary({
            stream: {
                isDirectPlay: false,
                isTranscoding: true,
                videoCodec: 'h264',
                audioCodec: 'aac',
                serverDecision: {
                    videoDecision: 'copy',
                    audioDecision: 'copy',
                    subtitleDecision: 'burn',
                },
            },
        });

        expect(summary.tag).toBe('Direct Stream • H.264/AAC');
    });

    it('omits resolution when height is missing', () => {
        const summary = buildPlaybackSummary({
            stream: {
                isDirectPlay: true,
                isTranscoding: false,
                container: 'mp4',
                videoCodec: 'h264',
                audioCodec: 'aac',
                width: 1920,
            },
        });

        expect(summary.tag).toBe('Direct Play • H.264/AAC');
        expect(summary.details).toContain('Video: H.264');
    });

    it('uses height for resolution labels', () => {
        const summary = buildPlaybackSummary({
            stream: {
                isDirectPlay: true,
                isTranscoding: false,
                container: 'mp4',
                videoCodec: 'h264',
                audioCodec: 'aac',
                width: 1920,
                height: 1080,
            },
        });

        expect(summary.tag).toBe('Direct Play • H.264/AAC • 1080p');
        expect(summary.details).toContain('Video: H.264 • 1080p');
    });

    it('prefers override resolution when provided', () => {
        const summary = buildPlaybackSummary(
            {
                stream: {
                    isDirectPlay: true,
                    isTranscoding: false,
                    container: 'mp4',
                    videoCodec: 'h264',
                    audioCodec: 'aac',
                    width: 1920,
                    height: 1080,
                },
            },
            { resolutionOverride: '4K' }
        );

        expect(summary.tag).toBe('Direct Play • H.264/AAC • 4K');
        expect(summary.details).toContain('Video: H.264 • 4K');
    });

    it('ignores empty string override', () => {
        const summary = buildPlaybackSummary(
            {
                stream: {
                    isDirectPlay: true,
                    isTranscoding: false,
                    videoCodec: 'h264',
                    audioCodec: 'aac',
                    height: 1080,
                },
            },
            { resolutionOverride: '' }
        );

        expect(summary.tag).toBe('Direct Play • H.264/AAC • 1080p');
    });

    it('ignores whitespace-only override', () => {
        const summary = buildPlaybackSummary(
            {
                stream: {
                    isDirectPlay: true,
                    isTranscoding: false,
                    videoCodec: 'h264',
                    audioCodec: 'aac',
                    height: 1080,
                },
            },
            { resolutionOverride: '   ' }
        );

        expect(summary.tag).toBe('Direct Play • H.264/AAC • 1080p');
    });
});
