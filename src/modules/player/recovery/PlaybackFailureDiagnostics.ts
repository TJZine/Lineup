import type { StreamDecision, StreamRequest } from '../../plex/stream';
import { getSubtitleStreamServerDecision } from '../../plex/stream/diagnostics/UniversalTranscodeDecisionClient';
import type { RecoveryReloadFailureContext } from './PlaybackReloadController';
import type { StreamDescriptor } from '../core/types';

type PlaybackFailureDescriptorSummary = {
    protocol: StreamDescriptor['protocol'];
    mimeType: string;
    isLive: boolean;
    durationMs: number;
    audioCodecs: string[];
    subtitleFormats: string[];
    localExtractionSuppression: {
        trackId: string;
        reason: string;
        confirmation: string;
    } | null;
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
        localExtractionSuppression: descriptor.subtitleContext?.localExtractionSuppression
            ? { ...descriptor.subtitleContext.localExtractionSuppression }
            : null,
    };
}

export function summarizePlaybackFailureReloadAttempt(
    failure: RecoveryReloadFailureContext
): Record<string, unknown> {
    return {
        failureStage: failure.failureStage,
        priorStreamLikelyUnloaded: failure.priorStreamLikelyUnloaded,
        clampedOffset: failure.clampedOffset,
        request: summarizeStreamRequest(failure.attemptedRequest),
        decision: summarizePlaybackFailureDecision(failure.attemptedDecision),
        descriptor: summarizePlaybackFailureDescriptor(failure.attemptedDescriptor),
        manifestProbe: { runtime: 'not_run' },
    };
}

function summarizeStreamRequest(request: StreamRequest | null): Record<string, unknown> | null {
    if (!request) {
        return null;
    }
    return {
        itemKey: request.itemKey,
        startOffsetMs: request.startOffsetMs,
        directPlay: request.directPlay,
        audioStreamId: request.audioStreamId ?? null,
        subtitleStreamId: request.subtitleStreamId ?? null,
        subtitleMode: request.subtitleMode ?? null,
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
    return getSubtitleStreamServerDecision(decision.serverDecision, subtitleStreamId);
}
