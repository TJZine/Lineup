import type { StreamDecision } from '../plex/stream';
import type { StreamDescriptor } from './types';

type PlaybackFailureDescriptorSummary = {
    protocol: StreamDescriptor['protocol'];
    mimeType: string;
    isLive: boolean;
    durationMs: number;
    audioCodecs: string[];
    subtitleFormats: string[];
};

type PlaybackFailureDecisionSummary = {
    protocol: StreamDecision['protocol'];
    isDirectPlay: boolean;
    isTranscoding: boolean;
    container: string;
    videoCodec: string;
    audioCodec: string;
    subtitleDelivery: StreamDecision['subtitleDelivery'];
    subtitleBurnIn: {
        requested: boolean;
        confirmed: boolean | null;
        reason: string;
        subtitleStreamId: string | null;
    } | null;
    serverDecision: {
        videoDecision: string | null;
        audioDecision: string | null;
        subtitleDecision: string | null;
        selectedSubtitleDecision: string | null;
        decisionCode: string | null;
    } | null;
    width: number;
    height: number;
    bitrate: number;
    directPlay: {
        allowed: boolean;
        reasons: string[];
    } | null;
    source: {
        container: string;
        videoCodec: string;
        audioCodec: string;
        width: number;
        height: number;
        bitrate: number;
        hdr?: string;
        dynamicRange?: string;
        doviPresent?: boolean;
        doviProfile?: string;
    } | null;
    selectedAudio: {
        codec: string | null;
        channels: number | null;
        language: string | null;
        default: boolean | null;
    } | null;
    selectedSubtitle: {
        codec: string | null;
        format: string | null;
        language: string | null;
        default: boolean | null;
    } | null;
};

export function summarizePlaybackFailureDescriptor(
    descriptor: StreamDescriptor | null
): PlaybackFailureDescriptorSummary | null {
    if (!descriptor) {
        return null;
    }

    return {
        protocol: descriptor.protocol,
        mimeType: descriptor.mimeType,
        isLive: descriptor.isLive,
        durationMs: descriptor.durationMs,
        audioCodecs: [...new Set((descriptor.audioTracks ?? []).map((track) => track.codec).filter(Boolean))],
        subtitleFormats: [...new Set((descriptor.subtitleTracks ?? []).map((track) => track.format).filter(Boolean))],
    };
}

export function summarizePlaybackFailureDecision(
    decision: StreamDecision | null
): PlaybackFailureDecisionSummary | null {
    if (!decision) {
        return null;
    }

    return {
        protocol: decision.protocol,
        isDirectPlay: decision.isDirectPlay,
        isTranscoding: decision.isTranscoding,
        container: decision.container,
        videoCodec: decision.videoCodec,
        audioCodec: decision.audioCodec,
        subtitleDelivery: decision.subtitleDelivery,
        subtitleBurnIn: decision.subtitleBurnIn
            ? {
                requested: decision.subtitleBurnIn.requested,
                confirmed: decision.subtitleBurnIn.confirmed ?? null,
                reason: decision.subtitleBurnIn.reason,
                subtitleStreamId: decision.subtitleBurnIn.subtitleStreamId ?? null,
            }
            : null,
        serverDecision: decision.serverDecision
            ? {
                videoDecision: decision.serverDecision.videoDecision ?? null,
                audioDecision: decision.serverDecision.audioDecision ?? null,
                subtitleDecision: decision.serverDecision.subtitleDecision ?? null,
                selectedSubtitleDecision: getSelectedSubtitleServerDecision(decision),
                decisionCode: decision.serverDecision.decisionCode ?? null,
            }
            : null,
        width: decision.width,
        height: decision.height,
        bitrate: decision.bitrate,
        directPlay: decision.directPlay
            ? {
                allowed: decision.directPlay.allowed,
                reasons: [...decision.directPlay.reasons],
            }
            : null,
        source: decision.source
            ? {
                container: decision.source.container,
                videoCodec: decision.source.videoCodec,
                audioCodec: decision.source.audioCodec,
                width: decision.source.width,
                height: decision.source.height,
                bitrate: decision.source.bitrate,
                ...(decision.source.hdr !== undefined ? { hdr: decision.source.hdr } : {}),
                ...(decision.source.dynamicRange !== undefined ? { dynamicRange: decision.source.dynamicRange } : {}),
                ...(decision.source.doviPresent !== undefined ? { doviPresent: decision.source.doviPresent } : {}),
                ...(decision.source.doviProfile !== undefined ? { doviProfile: decision.source.doviProfile } : {}),
            }
            : null,
        selectedAudio: decision.selectedAudioStream
            ? {
                codec: decision.selectedAudioStream.codec ?? null,
                channels: decision.selectedAudioStream.channels ?? null,
                language: decision.selectedAudioStream.language ?? null,
                default: decision.selectedAudioStream.default ?? null,
            }
            : null,
        selectedSubtitle: decision.selectedSubtitleStream
            ? {
                codec: decision.selectedSubtitleStream.codec ?? null,
                format: decision.selectedSubtitleStream.format ?? null,
                language: decision.selectedSubtitleStream.language ?? null,
                default: decision.selectedSubtitleStream.default ?? null,
            }
            : null,
    };
}

function getSelectedSubtitleServerDecision(decision: StreamDecision): string | null {
    const subtitleStreamId = decision.subtitleBurnIn?.subtitleStreamId ?? decision.selectedSubtitleStream?.id ?? null;
    if (!subtitleStreamId) {
        return null;
    }
    const streamDecision = decision.serverDecision?.streams?.find((stream) =>
        stream.streamType === 3 &&
        stream.id === subtitleStreamId
    );
    return streamDecision?.decision ?? null;
}
