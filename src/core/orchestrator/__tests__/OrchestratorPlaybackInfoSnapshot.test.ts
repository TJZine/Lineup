import { AppOrchestrator } from '../../../Orchestrator';
import type { StreamDescriptor } from '../../../modules/player';
import type { StreamDecision } from '../../../modules/plex/stream';
import type { ScheduledProgram } from '../../../modules/scheduler/scheduler';
import type { OrchestratorPlaybackStateAccessors } from '../runtime/OrchestratorPlaybackStateAccessors';
import {
    createPlaybackInfoSnapshot,
    type OrchestratorPlaybackInfoSnapshotAccessors,
} from '../runtime/OrchestratorPlaybackInfoSnapshot';

const createProgram = (): ScheduledProgram => ({
    item: {
        ratingKey: 'item-1',
        title: 'Episode',
        fullTitle: 'Show - Episode',
        type: 'episode',
    },
    scheduledStartTime: 100,
    scheduledEndTime: 200,
    elapsedMs: 25,
    remainingMs: 75,
} as ScheduledProgram);

const createDecision = (): StreamDecision => ({
    playbackUrl: 'http://test/stream.m3u8',
    protocol: 'hls',
    isDirectPlay: false,
    isTranscoding: true,
    container: 'mpegts',
    videoCodec: 'h264',
    audioCodec: 'aac',
    subtitleDelivery: 'sidecar',
    bitrate: 2500,
    width: 1280,
    height: 720,
    sessionId: 'session-1',
    mediaIndex: 0,
    partIndex: 0,
    partKey: '/library/parts/1/1/file.mkv',
    selectedAudioStream: {
        id: 'audio-1',
        streamType: 2,
        codec: 'aac',
        channels: 2,
        language: 'en',
        title: 'English',
        default: true,
    },
    selectedSubtitleStream: {
        id: 'subtitle-1',
        streamType: 3,
        codec: 'srt',
        language: 'es',
        title: 'Spanish',
        format: 'srt',
        default: false,
    },
    directPlay: { allowed: false, reasons: ['video codec'] },
    audioFallback: { fromCodec: 'truehd', toCodec: 'aac', reason: 'compatibility' },
    source: {
        container: 'mkv',
        videoCodec: 'hevc',
        audioCodec: 'truehd',
        width: 1920,
        height: 1080,
        bitrate: 8000,
    },
    transcodeRequest: {
        sessionId: 'session-1',
        startOffsetMs: 10_000,
        startOffsetSeconds: 10,
        maxBitrate: 12000,
        maxBitrateReason: 'explicit',
        transcodeCompatMode: false,
        transcodeQuality: null,
        audioStreamId: 'audio-1',
    },
    serverDecision: {
        fetchedAt: 123,
        videoDecision: 'transcode',
        audioDecision: 'transcode',
        subtitleDecision: 'copy',
    },
});

const createDescriptor = (): StreamDescriptor => ({
    protocol: 'hls',
    mimeType: 'application/vnd.apple.mpegurl',
} as StreamDescriptor);

const createAccessors = (
    overrides: Partial<{
        program: ScheduledProgram | null;
        decision: StreamDecision | null;
        descriptor: StreamDescriptor | null;
        channel: OrchestratorPlaybackInfoSnapshotAccessors['getCurrentChannel'] extends () => infer T ? T : never;
    }> = {}
): OrchestratorPlaybackInfoSnapshotAccessors => {
    const playback: OrchestratorPlaybackStateAccessors = {
        getCurrentProgramForPlayback: () => overrides.program ?? null,
        setCurrentProgramForPlayback: jest.fn(),
        getCurrentStreamDescriptor: () => overrides.descriptor ?? null,
        setCurrentStreamDescriptor: jest.fn(),
        getCurrentStreamDecision: () => overrides.decision ?? null,
        setCurrentStreamDecision: jest.fn(),
        getPendingNowPlayingChannelId: () => null,
        setPendingNowPlayingChannelId: jest.fn(),
        getShouldAutoShowInfoBannerOnNextPlay: () => false,
        setShouldAutoShowInfoBannerOnNextPlay: jest.fn(),
    };

    return {
        playback,
        getCurrentChannel: () => overrides.channel ?? null,
    };
};

describe('Orchestrator playback info snapshot', () => {
    it('projects channel, program, stream decision, and selected audio/subtitle fields', () => {
        const snapshot = createPlaybackInfoSnapshot(
            createAccessors({
                channel: { id: 'channel-1', number: 12, name: 'News' },
                program: createProgram(),
                decision: createDecision(),
                descriptor: createDescriptor(),
            })
        );

        expect(snapshot).toEqual({
            channel: { id: 'channel-1', number: 12, name: 'News' },
            program: {
                itemKey: 'item-1',
                title: 'Episode',
                fullTitle: 'Show - Episode',
                type: 'episode',
                scheduledStartTime: 100,
                scheduledEndTime: 200,
                elapsedMs: 25,
                remainingMs: 75,
            },
            stream: expect.objectContaining({
                protocol: 'hls',
                mimeType: 'application/vnd.apple.mpegurl',
                isDirectPlay: false,
                isTranscoding: true,
                selectedAudio: {
                    id: 'audio-1',
                    codec: 'aac',
                    channels: 2,
                    language: 'en',
                    title: 'English',
                    default: true,
                },
                selectedSubtitle: {
                    id: 'subtitle-1',
                    codec: 'srt',
                    language: 'es',
                    title: 'Spanish',
                    format: 'srt',
                    default: false,
                },
                serverDecision: {
                    fetchedAt: 123,
                    videoDecision: 'transcode',
                    audioDecision: 'transcode',
                    subtitleDecision: 'copy',
                },
            }),
        });
    });

    it('returns a null stream unless both stream decision and descriptor are present', () => {
        expect(
            createPlaybackInfoSnapshot(
                createAccessors({
                    program: createProgram(),
                    decision: createDecision(),
                    descriptor: null,
                })
            ).stream
        ).toBeNull();

        expect(
            createPlaybackInfoSnapshot(
                createAccessors({
                    program: createProgram(),
                    decision: null,
                    descriptor: createDescriptor(),
                })
            ).stream
        ).toBeNull();
    });

    it('maps absent program and selected stream metadata to null', () => {
        const decision = createDecision();
        decision.selectedAudioStream = null;
        decision.selectedSubtitleStream = null;

        const snapshot = createPlaybackInfoSnapshot(
            createAccessors({
                program: null,
                decision,
                descriptor: createDescriptor(),
            })
        );

        expect(snapshot.program).toBeNull();
        expect(snapshot.stream).toEqual(
            expect.objectContaining({
                selectedAudio: null,
                selectedSubtitle: null,
            })
        );
    });

    it('refreshes server decision data only when playback state can support it', async () => {
        const orchestrator = new AppOrchestrator();
        const ensureServerDecisionForPlaybackInfoSnapshot = jest.fn().mockResolvedValue(undefined);

        Reflect.set(orchestrator as object, '_currentProgramForPlayback', createProgram());
        Reflect.set(orchestrator as object, '_currentStreamDecision', createDecision());
        Reflect.set(orchestrator as object, '_currentStreamDescriptor', createDescriptor());
        Reflect.set(orchestrator as object, '_plexStreamResolver', {});
        Reflect.set(orchestrator as object, '_nowPlayingDebugManager', {
            ensureServerDecisionForPlaybackInfoSnapshot,
        });

        await expect(orchestrator.refreshPlaybackInfoSnapshot()).resolves.toMatchObject({
            stream: expect.objectContaining({ sessionId: 'session-1' }),
        });
        expect(ensureServerDecisionForPlaybackInfoSnapshot).toHaveBeenCalledTimes(1);

        Reflect.set(orchestrator as object, '_currentStreamDecision', null);

        await expect(orchestrator.refreshPlaybackInfoSnapshot()).resolves.toMatchObject({
            stream: null,
        });
        expect(ensureServerDecisionForPlaybackInfoSnapshot).toHaveBeenCalledTimes(1);
    });
});
