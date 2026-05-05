import type { AppShellPlaybackInfoSnapshot } from '../runtime/AppShellRuntimeContracts';
import { formatAppDiagnosticsPlaybackInfo } from '../diagnostics/AppDiagnosticsPlaybackInfoFormatter';

const createSnapshot = (
    elapsedMs: number,
    remainingMs: number
): AppShellPlaybackInfoSnapshot => ({
    channel: { id: 'channel-1', number: 1, name: 'Test Channel' },
    program: {
        itemKey: 'item-1',
        title: 'Test Program',
        fullTitle: 'Test Program',
        type: 'episode',
        scheduledStartTime: 0,
        scheduledEndTime: 120_000,
        elapsedMs,
        remainingMs,
    },
    stream: null,
});

const createTranscodeSnapshot = (): AppShellPlaybackInfoSnapshot => ({
    ...createSnapshot(65_000, 3_725_000),
    stream: {
        protocol: 'hls',
        mimeType: 'application/vnd.apple.mpegurl',
        isDirectPlay: false,
        isTranscoding: true,
        container: 'mpegts',
        videoCodec: 'h264',
        audioCodec: 'aac',
        subtitleDelivery: 'burn',
        bitrate: 8_000,
        width: 1920,
        height: 1080,
        sessionId: 'session-1',
        selectedAudio: {
            id: 'audio-1',
            codec: 'aac',
            channels: 2,
            language: 'eng',
        },
        selectedSubtitle: {
            id: 'subtitle-1',
            codec: 'srt',
            language: 'eng',
        },
        directPlay: {
            allowed: false,
            reasons: ['unsupported_audio_codec:truehd'],
        },
        audioFallback: {
            fromCodec: 'truehd',
            toCodec: 'aac',
            reason: 'unsupported_audio_codec',
        },
        source: {
            container: 'mkv',
            videoCodec: 'hevc',
            audioCodec: 'truehd',
            width: 3840,
            height: 2160,
            bitrate: 65_000,
        },
        transcodeRequest: {
            sessionId: 'session-1',
            maxBitrate: 20_000,
            audioStreamId: 'audio-1',
        },
        serverDecision: {
            videoDecision: 'transcode',
            audioDecision: 'transcode',
            subtitleDecision: 'burn',
            decisionText: 'server selected transcode',
        },
    },
});

describe('formatAppDiagnosticsPlaybackInfo', () => {
    it('formats non-finite playback durations as unknown', () => {
        const formatted = formatAppDiagnosticsPlaybackInfo(
            createSnapshot(Number.NaN, Number.POSITIVE_INFINITY)
        );

        expect(formatted.summary).toContain('elapsed unknown / remaining unknown');
        expect(formatted.display).not.toContain('NaN');
        expect(formatted.display).not.toContain('Infinity');
    });

    it('formats finite playback durations as clock values', () => {
        const formatted = formatAppDiagnosticsPlaybackInfo(
            createSnapshot(65_000, 3_725_000)
        );

        expect(formatted.summary).toContain('elapsed 1:05 / remaining 1:02:05');
    });

    it('keeps display, summary, and raw JSON boundaries stable', () => {
        const snapshot = createTranscodeSnapshot();
        const formatted = formatAppDiagnosticsPlaybackInfo(snapshot);
        const expectedRawJson = JSON.stringify(snapshot, null, 2);

        expect(formatted.rawJson).toBe(expectedRawJson);
        expect(formatted.display).toContain('RAW\n------------------------------------------------------------');
        expect(formatted.display).toContain(expectedRawJson);
        expect(formatted.summary).toContain('REQUEST (Lineup -> PMS)');
        expect(formatted.summary).not.toContain('RAW');
        expect(formatted.summary).not.toContain(expectedRawJson);
    });
});
