import type { PreparedPlaybackStream } from '../../modules/player';

export function makePreparedPlaybackStream(
    url = 'https://example.invalid/stream.m3u8'
): PreparedPlaybackStream {
    return {
        decision: {
            playbackUrl: url,
            protocol: 'hls',
            isDirectPlay: true,
            isTranscoding: false,
            container: 'mpegts',
            videoCodec: 'h264',
            audioCodec: 'aac',
            subtitleDelivery: 'none',
            sessionId: 'test-session',
            mediaIndex: 0,
            partIndex: 0,
            partKey: '/library/parts/test/file.mkv',
            selectedAudioStream: null,
            selectedSubtitleStream: null,
            width: 1920,
            height: 1080,
            bitrate: 8_000,
        },
        descriptor: {
            url,
            protocol: 'hls',
            mimeType: 'application/vnd.apple.mpegurl',
            startPositionMs: 0,
            mediaMetadata: { title: 'Test Item', durationMs: 60_000 },
            subtitleTracks: [],
            audioTracks: [],
            durationMs: 60_000,
            isLive: false,
        },
    } satisfies PreparedPlaybackStream;
}
