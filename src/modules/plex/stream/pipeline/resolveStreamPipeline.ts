import { AppErrorCode } from '../../../../types/app-errors';
import type { Hdr10FallbackMode } from '../../../settings/PlaybackSettingsStore';
import type { PlaybackCapabilityProfile } from '../capabilities/PlaybackCapabilityProfile';
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

export interface TranscodeUrlResolution {
    url: string;
    startOffsetMs: number;
    startOffsetSeconds: number;
    maxBitrate?: number;
    maxBitrateReason: NonNullable<StreamDecision['transcodeRequest']>['maxBitrateReason'];
    transcodeCompatMode: boolean;
    transcodeQuality: NonNullable<StreamDecision['transcodeRequest']>['transcodeQuality'];
}

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
    capabilityProfile: PlaybackCapabilityProfile;
    hdr10FallbackMode: Hdr10FallbackMode;
    createError: CreateResolverError;
    buildDirectPlayUrl: (
        partKey: string,
        sessionId: string,
        directPlayAudioStreamId?: string,
        applyHdr10Fallback?: boolean
    ) => string;
    getTranscodeUrl: (itemKey: string, options: HlsOptions) => string | TranscodeUrlResolution;
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
    capabilityProfile,
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

    const requestedTranscodeBitrate = normalizePositiveInteger(request.maxBitrate);
    const selectedMedia = request.subtitleStreamId
        ? selectBestMediaWithSubtitleStream(item.media, request.subtitleStreamId, requestedTranscodeBitrate)
        : selectBestMedia(item.media, requestedTranscodeBitrate);

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
        videoStream,
        audioCodecOverride: requestedAudioStream?.codec ?? null,
        capabilityProfile,
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
                videoStream,
                audioCodecOverride: audioStream.codec,
                capabilityProfile,
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
    const subtitleBurnInReason = getSubtitleBurnInReason(request.subtitleMode ?? 'none', subtitleStream);
    const shouldBurnInSubtitles = subtitleBurnInReason !== 'none';
    const allowDirectPlay =
        directDecision.canDirect &&
        request.directPlay !== false &&
        !forceTranscodeForHdr10Fallback &&
        !shouldBurnInSubtitles;

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
        const options: HlsOptions = {
            sessionId,
            mediaIndex,
            partIndex,
            startOffsetMs: request.startOffsetMs ?? 0,
            ...(typeof requestedTranscodeBitrate === 'number' ? { maxBitrate: requestedTranscodeBitrate } : {}),
        };
        if (shouldForceAudioStreamId && audioStream?.id) {
            options.audioStreamId = audioStream.id;
        }
        if (shouldBurnInSubtitles && subtitleStream?.id) {
            options.subtitleStreamId = subtitleStream.id;
            options.subtitleMode = 'burn';
            burnInEnabled = true;
        }
        if (applyHdr10Fallback) {
            options.hideDolbyVision = true;
        }
        const transcodeUrl = normalizeTranscodeUrlResolution(
            getTranscodeUrl(request.itemKey, options),
            options
        );
        playbackUrl = transcodeUrl.url;
        protocol = 'hls';
        isTranscoding = true;
        container = 'mpegts';
        videoCodec = 'h264';
        audioCodec = 'aac';

        const bitrateRequest = typeof transcodeUrl.maxBitrate === 'number'
            ? {
                maxBitrate: transcodeUrl.maxBitrate,
                maxBitrateReason: transcodeUrl.maxBitrateReason as Exclude<
                    NonNullable<StreamDecision['transcodeRequest']>['maxBitrateReason'],
                    'none'
                >,
            }
            : { maxBitrateReason: 'none' as const };
        const transcodeRequestBase = {
            sessionId,
            startOffsetMs: transcodeUrl.startOffsetMs,
            startOffsetSeconds: transcodeUrl.startOffsetSeconds,
            ...bitrateRequest,
            transcodeCompatMode: transcodeUrl.transcodeCompatMode,
            transcodeQuality: transcodeUrl.transcodeQuality,
            mediaIndex,
            partIndex,
            ...(options.hideDolbyVision === true ? { hideDolbyVision: true as const } : {}),
            ...(typeof options.audioStreamId === 'string' ? { audioStreamId: options.audioStreamId } : {}),
        } satisfies Omit<NonNullable<StreamDecision['transcodeRequest']>, 'subtitleStreamId' | 'subtitleMode'>;
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
    const hdr10FallbackInfo = hdrCompatibilityDecision.isDolbyVision || applyHdr10Fallback
        ? {
            mode: hdr10FallbackMode,
            applied: applyHdr10Fallback,
            reason: hdrCompatibilityDecision.fallbackReason,
            debugWhy: hdrCompatibilityDecision.fallbackDebugWhy,
            hideDolbyVision: applyHdr10Fallback,
            forcedHls: forceTranscodeForHdr10Fallback,
        } satisfies NonNullable<StreamDecision['hdr10Fallback']>
        : null;
    const subtitleBurnInInfo = shouldBurnInSubtitles
        ? {
            requested: true,
            confirmed: false,
            reason: subtitleBurnInReason,
            ...(subtitleStream?.id ? { subtitleStreamId: subtitleStream.id } : {}),
            subtitleMode: request.subtitleMode ?? 'none',
        } satisfies NonNullable<StreamDecision['subtitleBurnIn']>
        : null;
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
        bitrate: isTranscoding ? (transcodeRequestInfo?.maxBitrate ?? media.bitrate) : media.bitrate,
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
                    ...(forceTranscodeForHdr10Fallback
                        ? [`hdr10_fallback_${hdrCompatibilityDecision.fallbackReason}`]
                        : []),
                    ...(shouldBurnInSubtitles ? [`subtitle_burn_in_${subtitleBurnInReason}`] : []),
                    ...directDecision.reasons,
                ],
        },
        ...(hdr10FallbackInfo ? { hdr10Fallback: hdr10FallbackInfo } : {}),
        ...(subtitleBurnInInfo ? { subtitleBurnIn: subtitleBurnInInfo } : {}),
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
        hdrFallbackReason:
            hdrCompatibilityDecision.fallbackReason === 'none'
                ? null
                : hdrCompatibilityDecision.fallbackReason,
    };
}

function normalizeTranscodeUrlResolution(
    result: string | TranscodeUrlResolution,
    options: HlsOptions
): TranscodeUrlResolution {
    if (typeof result !== 'string') {
        return result;
    }

    const startOffsetMs = normalizeNonNegativeInteger(options.startOffsetMs);
    const startOffsetSeconds = Math.floor(startOffsetMs / 1000);
    const maxBitrate = normalizePositiveInteger(options.maxBitrate);
    return {
        url: result,
        startOffsetMs,
        startOffsetSeconds,
        ...(typeof maxBitrate === 'number' ? { maxBitrate } : {}),
        maxBitrateReason: typeof maxBitrate === 'number' ? 'explicit' : 'none',
        transcodeCompatMode: options.transcodeCompatMode ?? false,
        transcodeQuality: options.transcodeQuality ?? null,
    };
}

function normalizePositiveInteger(value: number | undefined): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
    }
    const normalized = Math.floor(value);
    return normalized > 0 ? normalized : undefined;
}

function normalizeNonNegativeInteger(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.floor(value));
}

function getSubtitleBurnInReason(
    requestSubtitleMode: 'none' | 'burn',
    subtitle: PlexStream | null
): NonNullable<StreamDecision['subtitleBurnIn']>['reason'] {
    if (!shouldRequestBurnInSubtitles({ requestSubtitleMode, subtitle })) {
        return 'none';
    }
    return requestSubtitleMode === 'burn' ? 'requested' : 'format_required';
}

function findDefaultOrFirstStream(streams: PlexStream[], streamType: number): PlexStream | null {
    const ofType = streams.filter((stream) => stream.streamType === streamType);
    const defaultStream = ofType.find((stream) => stream.default);
    return defaultStream || ofType[0] || null;
}
