import { AppErrorCode } from '../../../../types/app-errors';
import type { Hdr10FallbackMode } from '../../../settings/PlaybackSettingsStore';
import type { StreamResolverError } from '../contracts/interfaces';
import {
    getDirectPlayDecision,
    getHdrCompatibilityDecision,
    isTrueHdCodec,
    selectCompatibleAudioTrack,
    shouldForceTranscodeAudioStreamId,
} from '../policy/playbackCompatibilityPolicy';
import { getSubtitleDelivery, shouldRequestBurnInSubtitles } from '../policy/subtitleDeliveryPolicy';
import { selectBestMedia, selectBestMediaWithSubtitleStream } from '../policy/mediaSelectionPolicy';
import type {
    HlsOptions,
    PlexStreamMediaItem,
    PlexStream,
    StreamDecision,
    StreamRequest,
} from '../contracts/types';
import { PlexStreamErrorCode } from '../contracts/types';

type CreateResolverError = (
    code: PlexStreamErrorCode,
    message: string,
    recoverable: boolean,
    retryAfterMs?: number,
    stage?: StreamResolverError['stage']
) => StreamResolverError;

export interface ResolveStreamPipelineArgs {
    item: PlexStreamMediaItem;
    request: StreamRequest;
    sessionId: string;
    allowDirectPlayAudioFallback: boolean;
    dtsPassthroughEnabled: boolean;
    userAgent: string | null;
    hdr10FallbackMode: Hdr10FallbackMode;
    createError: CreateResolverError;
    buildDirectPlayUrl: (
        partKey: string,
        sessionId: string,
        directPlayAudioStreamId?: string,
        applyHdr10Fallback?: boolean
    ) => string;
    getTranscodeUrl: (itemKey: string, options: HlsOptions) => string;
}

export interface ResolveStreamPipelineResult {
    decision: StreamDecision;
    media: NonNullable<PlexStreamMediaItem['media'][number]>;
    part: NonNullable<NonNullable<PlexStreamMediaItem['media'][number]>['parts'][number]>;
    audioStream: PlexStream | null;
    videoStream: PlexStream | null;
    subtitleStream: PlexStream | null;
    availableAudioStreams: PlexStream[];
    availableSubtitleStreams: PlexStream[];
    forceHlsForDvNoHdr10BaseLayer: boolean;
    hdrFallbackReason: string | null;
}

function normalizeResolvedCodec(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

export function resolveStreamPipeline({
    item,
    request,
    sessionId,
    allowDirectPlayAudioFallback,
    dtsPassthroughEnabled,
    userAgent,
    hdr10FallbackMode,
    createError,
    buildDirectPlayUrl,
    getTranscodeUrl,
}: ResolveStreamPipelineArgs): ResolveStreamPipelineResult {
    if (request.subtitleMode === 'burn' && !request.subtitleStreamId) {
        throw createError(
            PlexStreamErrorCode.SUBTITLE_STREAM_NOT_FOUND,
            'Subtitle stream id is required for burn-in',
            true,
            undefined,
            'media_selection'
        );
    }

    const selectedMedia = request.subtitleStreamId
        ? selectBestMediaWithSubtitleStream(item.media, request.subtitleStreamId, request.maxBitrate)
        : selectBestMedia(item.media, request.maxBitrate);

    if (request.subtitleStreamId && !selectedMedia) {
        throw createError(
            PlexStreamErrorCode.SUBTITLE_STREAM_NOT_FOUND,
            `Subtitle stream not found: ${request.subtitleStreamId}`,
            true,
            undefined,
            'media_selection'
        );
    }
    if (!selectedMedia) {
        throw createError(
            AppErrorCode.PLAYBACK_FORMAT_UNSUPPORTED,
            'No compatible media version found',
            false
        );
    }

    const { media, mediaIndex, partIndex } = selectedMedia;
    const part = media.parts[partIndex];
    if (!part) {
        throw createError(
            AppErrorCode.PLAYBACK_SOURCE_NOT_FOUND,
            'No media parts available',
            false
        );
    }

    const videoStream = part.streams.find((stream) => stream.streamType === 1) ?? null;
    const subtitleStream = request.subtitleStreamId
        ? (part.streams.find(
            (stream) => stream.streamType === 3 && stream.id === request.subtitleStreamId
        ) ?? null)
        : null;

    if (request.subtitleMode === 'burn' && request.subtitleStreamId && !subtitleStream) {
        throw createError(
            PlexStreamErrorCode.SUBTITLE_STREAM_NOT_FOUND,
            `Subtitle stream not found for burn-in: ${request.subtitleStreamId}`,
            true,
            undefined,
            'burn_in_selected_part'
        );
    }

    const availableSubtitleStreams = part.streams.filter((stream) => stream.streamType === 3);
    const availableAudioStreams = part.streams.filter((stream) => stream.streamType === 2);
    const requestedAudioStream =
        typeof request.audioStreamId === 'string'
            ? availableAudioStreams.find((stream) => stream.id === request.audioStreamId) ?? null
            : null;
    const resolvedTranscodeBitrate =
        typeof request.maxBitrate === 'number' ? request.maxBitrate : 20000;
    const audioStream = selectCompatibleAudioTrack(part.streams, request.audioStreamId);
    const shouldForceAudioStreamId = shouldForceTranscodeAudioStreamId(part.streams, request.audioStreamId);
    const defaultAudio = findDefaultOrFirstStream(part.streams, 2);
    const audioFallbackInfo =
        defaultAudio &&
        audioStream &&
        isTrueHdCodec(defaultAudio.codec) &&
        !isTrueHdCodec(audioStream.codec)
            ? {
                fromCodec: (defaultAudio.codec || 'unknown').toLowerCase(),
                toCodec: (audioStream.codec || 'unknown').toLowerCase(),
                reason: 'TrueHD cannot be decoded on webOS',
            }
            : null;

    let directDecision = getDirectPlayDecision({
        media,
        audioCodecOverride: requestedAudioStream?.codec ?? null,
        dtsPassthroughEnabled,
        userAgent,
    });

    let directPlayAudioStreamId: string | undefined = requestedAudioStream?.id;
    if (
        !requestedAudioStream &&
        allowDirectPlayAudioFallback &&
        defaultAudio &&
        isTrueHdCodec(defaultAudio.codec) &&
        audioStream &&
        audioStream.id &&
        !isTrueHdCodec(audioStream.codec)
    ) {
        const nonAudioReasons = directDecision.reasons.filter(
            (reason) => !reason.startsWith('unsupported_audio_codec:') && reason !== 'dts_passthrough_disabled'
        );
        if (nonAudioReasons.length === 0) {
            const overridden = getDirectPlayDecision({
                media,
                audioCodecOverride: audioStream.codec,
                dtsPassthroughEnabled,
                userAgent,
            });
            if (overridden.canDirect) {
                directDecision = overridden;
                directPlayAudioStreamId = audioStream.id;
            }
        }
    }

    const hdrCompatibilityDecision = getHdrCompatibilityDecision({
        media,
        videoStream,
        hdr10FallbackMode,
    });
    const applyHdr10Fallback = hdrCompatibilityDecision.applyHdr10Fallback;
    const forceTranscodeForHdr10Fallback = hdrCompatibilityDecision.forceTranscodeForHdr10Fallback;
    const forceHlsForDvNoHdr10BaseLayer = hdrCompatibilityDecision.forceHlsForDvNoHdr10BaseLayer;
    const allowDirectPlay =
        directDecision.canDirect &&
        request.directPlay !== false &&
        !forceTranscodeForHdr10Fallback &&
        !forceHlsForDvNoHdr10BaseLayer;

    let playbackUrl: string;
    let protocol: 'hls' | 'http';
    let isTranscoding = false;
    let container: string;
    let videoCodec: string;
    let audioCodec: string;
    let transcodeRequestInfo: StreamDecision['transcodeRequest'] | null = null;
    let burnInEnabled = false;

    if (allowDirectPlay) {
        playbackUrl = buildDirectPlayUrl(part.key, sessionId, directPlayAudioStreamId, applyHdr10Fallback);
        protocol = 'http';
        container = media.container;
        videoCodec = media.videoCodec;
        audioCodec = normalizeResolvedCodec((requestedAudioStream ?? audioStream)?.codec ?? media.audioCodec);
    } else {
        const options: HlsOptions = { maxBitrate: resolvedTranscodeBitrate, sessionId, mediaIndex, partIndex };
        if (shouldForceAudioStreamId && audioStream?.id) {
            options.audioStreamId = audioStream.id;
        }
        const shouldBurnIn = shouldRequestBurnInSubtitles({
            requestSubtitleMode: request.subtitleMode ?? 'none',
            subtitle: subtitleStream,
        });
        if (shouldBurnIn && subtitleStream?.id) {
            options.subtitleStreamId = subtitleStream.id;
            options.subtitleMode = 'burn';
            burnInEnabled = true;
        }
        if (applyHdr10Fallback) {
            options.hideDolbyVision = true;
        }
        playbackUrl = getTranscodeUrl(request.itemKey, options);
        protocol = 'hls';
        isTranscoding = true;
        container = 'mpegts';
        videoCodec = 'h264';
        audioCodec = 'aac';

        const transcodeRequestBase: {
            sessionId: string;
            maxBitrate: number;
            mediaIndex: number;
            partIndex: number;
            audioStreamId?: string;
            hideDolbyVision?: true;
        } = {
            sessionId,
            maxBitrate: resolvedTranscodeBitrate,
            mediaIndex,
            partIndex,
        };
        if (options.hideDolbyVision === true) {
            transcodeRequestBase.hideDolbyVision = true;
        }
        if (typeof options.audioStreamId === 'string') {
            transcodeRequestBase.audioStreamId = options.audioStreamId;
        }
        transcodeRequestInfo = burnInEnabled && typeof options.subtitleStreamId === 'string'
            ? {
                ...transcodeRequestBase,
                subtitleStreamId: options.subtitleStreamId,
                subtitleMode: 'burn',
            }
            : transcodeRequestBase;
    }

    const subtitleDelivery =
        burnInEnabled && subtitleStream ? 'burn' : getSubtitleDelivery(subtitleStream, isTranscoding);
    const resolvedBaseUrl = ((): string | undefined => {
        try {
            return new URL(playbackUrl).origin;
        } catch {
            return undefined;
        }
    })();

    const decision: StreamDecision = {
        playbackUrl,
        ...(resolvedBaseUrl ? { resolvedBaseUrl } : {}),
        protocol,
        isDirectPlay: !isTranscoding,
        isTranscoding,
        container,
        videoCodec,
        audioCodec,
        subtitleDelivery,
        sessionId,
        mediaIndex,
        partIndex,
        partKey: part.key,
        selectedAudioStream: audioStream,
        selectedSubtitleStream: subtitleStream,
        availableAudioStreams,
        availableSubtitleStreams,
        width: media.width,
        height: media.height,
        bitrate: isTranscoding ? resolvedTranscodeBitrate : media.bitrate,
        source: {
            container: media.container,
            videoCodec: media.videoCodec,
            audioCodec: media.audioCodec,
            width: media.width,
            height: media.height,
            bitrate: media.bitrate,
            ...(videoStream?.hdr?.trim() ? { hdr: videoStream.hdr.trim() } : {}),
            ...(videoStream?.dynamicRange ? { dynamicRange: videoStream.dynamicRange } : {}),
            ...(typeof videoStream?.doviPresent === 'boolean' ? { doviPresent: videoStream.doviPresent } : {}),
            ...(videoStream?.doviProfile ? { doviProfile: videoStream.doviProfile } : {}),
        },
        directPlay: {
            allowed: allowDirectPlay,
            reasons: allowDirectPlay
                ? []
                : [
                    ...(request.directPlay === false ? ['direct_play_disabled_by_request'] : []),
                    ...(applyHdr10Fallback && !allowDirectPlay
                        ? [`hdr10_fallback_${hdrCompatibilityDecision.fallbackReason}`]
                        : []),
                    ...(forceHlsForDvNoHdr10BaseLayer ? ['dv_profile_no_hdr10_base_layer'] : []),
                    ...directDecision.reasons,
                ],
        },
    };

    if (audioFallbackInfo) {
        decision.audioFallback = audioFallbackInfo;
    }
    if (transcodeRequestInfo) {
        decision.transcodeRequest = transcodeRequestInfo;
    }

    return {
        decision,
        media,
        part,
        audioStream,
        videoStream,
        subtitleStream,
        availableAudioStreams,
        availableSubtitleStreams,
        forceHlsForDvNoHdr10BaseLayer,
        hdrFallbackReason: hdrCompatibilityDecision.fallbackReason ?? null,
    };
}

function findDefaultOrFirstStream(streams: PlexStream[], streamType: number): PlexStream | null {
    const ofType = streams.filter((stream) => stream.streamType === streamType);
    const defaultStream = ofType.find((stream) => stream.default);
    return defaultStream || ofType[0] || null;
}
