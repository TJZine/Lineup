import { summarizePlaybackFailureDecision } from '../PlaybackFailureDiagnostics';
import type { StreamDecision } from '../../plex/stream';

const makeDecision = (overrides: Partial<StreamDecision> = {}): StreamDecision => ({
    playbackUrl: 'http://test/stream.m3u8',
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
    selectedSubtitleStream: {
        id: 'sub-1',
        codec: 'srt',
        format: 'srt',
        language: 'English',
        default: true,
    },
    width: 1920,
    height: 1080,
    bitrate: 8000,
    availableSubtitleStreams: [],
    availableAudioStreams: [],
    serverDecision: {
        fetchedAt: 1,
        streams: [
            { id: 'sub-1', streamType: 2, decision: 'copy' },
            { id: 'sub-1', streamType: 3, decision: 'burn' },
        ],
    },
    ...overrides,
} as StreamDecision);

describe('PlaybackFailureDiagnostics', () => {
    it('summarizes the selected subtitle server decision from Plex diagnostics evidence', () => {
        const summary = summarizePlaybackFailureDecision(makeDecision());

        expect(summary?.serverDecision?.selectedSubtitleDecision).toBe('burn');
    });
});
