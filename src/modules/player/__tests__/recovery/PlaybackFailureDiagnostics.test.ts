import {
    summarizePlaybackFailureDecision,
    summarizePlaybackFailureDescriptor,
    summarizePlaybackFailureReloadAttempt,
} from '../../recovery/PlaybackFailureDiagnostics';
import type { StreamDecision, StreamRequest } from '../../../plex/stream';
import type { RecoveryReloadFailureContext } from '../../recovery/PlaybackReloadController';
import type { StreamDescriptor } from '../../core/types';

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

    it('summarizes requested burn-in suppression and leaves runtime manifest probes out of product diagnostics', () => {
        const descriptor = {
            protocol: 'hls',
            mimeType: 'application/vnd.apple.mpegurl',
            isLive: false,
            durationMs: 60_000,
            audioTracks: [],
            subtitleTracks: [{ format: 'srt' }],
            subtitleContext: {
                serverUri: 'http://example.com',
                authHeaders: {},
                localExtractionSuppression: {
                    trackId: 'sub-1',
                    reason: 'server_burn_in_requested',
                    confirmation: 'unconfirmed',
                },
            },
        } as unknown as StreamDescriptor;
        const request: StreamRequest = {
            itemKey: 'item-1',
            startOffsetMs: 12_000,
            directPlay: false,
            subtitleStreamId: 'sub-1',
            subtitleMode: 'burn',
        };

        expect(summarizePlaybackFailureDescriptor(descriptor)).toEqual(expect.objectContaining({
            localExtractionSuppression: {
                trackId: 'sub-1',
                reason: 'server_burn_in_requested',
                confirmation: 'unconfirmed',
            },
        }));
        expect(summarizePlaybackFailureReloadAttempt({
            failureStage: 'load',
            priorStreamLikelyUnloaded: true,
            clampedOffset: 12_000,
            attemptedRequest: request,
            attemptedDecision: makeDecision({
                subtitleBurnIn: {
                    requested: true,
                    confirmed: false,
                    reason: 'requested',
                    subtitleStreamId: 'sub-1',
                    subtitleMode: 'burn',
                },
            }),
            attemptedDescriptor: descriptor,
        } as RecoveryReloadFailureContext)).toEqual(expect.objectContaining({
            request: expect.objectContaining({
                subtitleStreamId: 'sub-1',
                subtitleMode: 'burn',
            }),
            manifestProbe: { runtime: 'not_run' },
        }));
    });
});
