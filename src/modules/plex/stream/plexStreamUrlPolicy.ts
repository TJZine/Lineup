import type { TranscodeQualityOption } from '../../../config/transcodeQuality';
import { DEFAULT_HLS_OPTIONS } from './constants';
import type { HlsOptions } from './types';
import {
    applyXPlexQueryParamsFromHeaders,
} from '../shared/plexUrl';

interface PlexSelectedConnectionSnapshot {
    uri: string;
    local: boolean;
    relay: boolean;
}

interface PlexClientCapabilityPolicyInput {
    is4K: boolean;
    canPlayMimeType: (mime: string) => boolean;
    chromeMajor: number | null;
    isWebOs: boolean;
    dtsPassthroughEnabled: boolean;
    hideDolbyVision: boolean;
}

interface PlexTranscodeUrlPolicyInput {
    baseUri: string;
    metadataPath: string;
    options: HlsOptions;
    compatMode: boolean;
    quality: TranscodeQualityOption | null;
    selectedConnection: PlexSelectedConnectionSnapshot | null;
    relayConnectionUri: string | null;
    clientCapabilities: string;
    authHeaders: Record<string, string>;
    forcedProfileName: string | null;
    defaultIdentityParams: Record<string, string>;
}

export function buildPlexMetadataPath(itemKey: string | null | undefined): string | null {
    const normalizedItemKey = (itemKey ?? '')
        .trim()
        .replace(/^\/+/, '')
        .replace(/^library\/metadata\/+/i, '')
        .trim();

    return normalizedItemKey.length > 0 ? `/library/metadata/${normalizedItemKey}` : null;
}

export function applyPlexSessionQueryParams(
    params: URLSearchParams,
    sessionId: string | null | undefined
): void {
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
        return;
    }
    params.set('session', sessionId);
    params.set('X-Plex-Session-Identifier', sessionId);
}

export function ensurePlexClientProfileName(
    params: URLSearchParams,
    profileName: string | null | undefined = null
): void {
    const trimmedProfileName = typeof profileName === 'string' ? profileName.trim() : '';
    if (trimmedProfileName.length > 0) {
        params.set('X-Plex-Client-Profile-Name', trimmedProfileName);
        return;
    }
    if (!params.has('X-Plex-Client-Profile-Name')) {
        params.set('X-Plex-Client-Profile-Name', 'HTML TV App');
    }
}

export function classifyPlexTranscodeLocation(input: {
    baseUri: string;
    selectedConnection: PlexSelectedConnectionSnapshot | null;
    relayConnectionUri: string | null;
}): 'lan' | 'wan' | null {
    const selectedConn = input.selectedConnection;
    if (selectedConn) {
        if (selectedConn.relay) {
            return 'wan';
        }
        return selectedConn.local ? 'lan' : 'wan';
    }

    const relayOrigin = parseOrigin(input.relayConnectionUri);
    const baseOrigin = parseOrigin(input.baseUri);
    if (relayOrigin && baseOrigin && relayOrigin === baseOrigin) {
        return 'wan';
    }

    return null;
}

export function buildPlexClientCapabilities(input: PlexClientCapabilityPolicyInput): string {
    const h264Level = input.is4K ? '51' : '42';

    const supportsHevcMain =
        input.canPlayMimeType('video/mp4; codecs="hvc1.1.6.L93.B0"') ||
        input.canPlayMimeType('video/mp4; codecs="hev1.1.6.L93.B0"') ||
        (input.isWebOs && input.chromeMajor !== null && input.chromeMajor >= 94);

    const supportsHevcMain10 =
        input.canPlayMimeType('video/mp4; codecs="hvc1.2.4.L93.B0"') ||
        input.canPlayMimeType('video/mp4; codecs="hev1.2.4.L93.B0"') ||
        input.canPlayMimeType('video/mp4; codecs="hvc1.2.4.L150.B0"') ||
        input.canPlayMimeType('video/mp4; codecs="hev1.2.4.L150.B0"') ||
        (input.isWebOs && input.chromeMajor !== null && input.chromeMajor >= 94);

    const supportsHevc = supportsHevcMain || supportsHevcMain10;
    const supportsDolbyVision =
        input.canPlayMimeType('video/mp4; codecs="dvh1.05.06"') ||
        input.canPlayMimeType('video/mp4; codecs="dvh1.08.06"');
    const supportsVp9 =
        input.canPlayMimeType('video/webm; codecs="vp9"') ||
        input.canPlayMimeType('video/mp4; codecs="vp09.00.10.08"');
    const supportsAv1 =
        input.canPlayMimeType('video/mp4; codecs="av01.0.05M.08"') ||
        input.canPlayMimeType('video/webm; codecs="av01.0.05M.08"');

    const videoDecoders: string[] = [`h264{profile:high&level:${h264Level}}`];
    if (supportsHevc) {
        const hevcLevel = input.is4K ? '150' : '120';
        if (supportsHevcMain10) {
            videoDecoders.push(`hevc{profile:main10&level:${hevcLevel}}`);
        }
        videoDecoders.push(`hevc{profile:main&level:${hevcLevel}}`);
        if (supportsDolbyVision && input.hideDolbyVision !== true) {
            videoDecoders.push('hevc{profile:dvhe.05}');
            videoDecoders.push('hevc{profile:dvhe.08}');
        }
    }
    if (supportsVp9) {
        videoDecoders.push('vp9');
    }
    if (supportsAv1) {
        videoDecoders.push('av1');
    }

    const audioDecoders: string[] = [
        'mp3',
        'aac{bitrate:800000}',
        'ac3{bitrate:800000}',
        'eac3{bitrate:800000}',
    ];

    if (input.dtsPassthroughEnabled) {
        audioDecoders.push('dts{bitrate:1536000}');
        audioDecoders.push('dca{bitrate:1536000}');
        audioDecoders.push('dca-ma{bitrate:1536000}');
    }

    return `protocols=http-live-streaming,http-mp4-streaming,http-streaming-video;videoDecoders=${videoDecoders.join(',')};audioDecoders=${audioDecoders.join(',')}`;
}

export function buildPlexTranscodeStartUrl(input: PlexTranscodeUrlPolicyInput): {
    url: string;
    compatMode: boolean;
} {
    const sessionId = input.options.sessionId ?? '';
    const maxBitrate = typeof input.options.maxBitrate === 'number'
        ? input.options.maxBitrate
        : DEFAULT_HLS_OPTIONS.maxBitrate;
    const subtitleSize = typeof input.options.subtitleSize === 'number'
        ? input.options.subtitleSize
        : DEFAULT_HLS_OPTIONS.subtitleSize;
    const audioBoost = typeof input.options.audioBoost === 'number'
        ? input.options.audioBoost
        : DEFAULT_HLS_OPTIONS.audioBoost;
    const mediaIndex = typeof input.options.mediaIndex === 'number' ? input.options.mediaIndex : 0;
    const partIndex = typeof input.options.partIndex === 'number' ? input.options.partIndex : 0;
    const subtitleStreamId = input.options.subtitleStreamId;
    const burnInEnabled =
        input.options.subtitleMode === 'burn' &&
        typeof subtitleStreamId === 'string' &&
        subtitleStreamId.length > 0;
    const subtitleParams = burnInEnabled
        ? { burnInEnabled: true as const, subtitleStreamId }
        : { burnInEnabled: false as const };

    const shouldApplyQualityOverride = Boolean(input.quality && input.quality.storageValue.length > 0);
    const qualityMaxBitrate = shouldApplyQualityOverride ? input.quality?.maxVideoBitrateKbps : undefined;
    const effectiveMaxBitrate = typeof qualityMaxBitrate === 'number'
        ? Math.min(maxBitrate, Math.max(1, Math.floor(qualityMaxBitrate)))
        : maxBitrate;
    const location = classifyPlexTranscodeLocation({
        baseUri: input.baseUri,
        selectedConnection: input.selectedConnection,
        relayConnectionUri: input.relayConnectionUri,
    });

    const params = new URLSearchParams();
    params.set('path', input.metadataPath);
    params.set('mediaIndex', String(mediaIndex));
    params.set('partIndex', String(partIndex));
    params.set('protocol', 'hls');
    params.set('offset', '0');
    applyPlexSessionQueryParams(params, sessionId);
    if (typeof input.options.audioStreamId === 'string' && input.options.audioStreamId.length > 0) {
        params.set('audioStreamID', input.options.audioStreamId);
    }

    applyTranscodeModeParams(params, {
        compatMode: input.compatMode,
        subtitleSize,
        audioBoost,
        effectiveMaxBitrate,
        shouldApplyQualityOverride,
        videoResolution: input.quality?.videoResolution,
        location,
        subtitle: subtitleParams,
    });

    applyXPlexQueryParamsFromHeaders(params, input.authHeaders);
    params.set('X-Plex-Client-Capabilities', input.clientCapabilities);
    ensurePlexClientProfileName(params, input.forcedProfileName);
    applyDefaultIdentityParams(params, input.defaultIdentityParams);

    const url = new URL('/video/:/transcode/universal/start.m3u8', input.baseUri);
    url.search = params.toString();
    return {
        url: url.toString(),
        compatMode: input.compatMode,
    };
}

function applyTranscodeModeParams(
    params: URLSearchParams,
    input: {
        compatMode: boolean;
        subtitleSize: number;
        audioBoost: number;
        effectiveMaxBitrate: number;
        shouldApplyQualityOverride: boolean;
        videoResolution: string | undefined;
        location: 'lan' | 'wan' | null;
        subtitle:
            | { burnInEnabled: true; subtitleStreamId: string }
            | { burnInEnabled: false };
    }
): void {
    if (!input.compatMode) {
        params.set('fastSeek', '1');
        params.set('directPlay', '0');
        params.set('directStream', '1');
        params.set('directStreamAudio', '1');
        params.set('subtitleSize', String(input.subtitleSize));
        params.set('audioBoost', String(input.audioBoost));
        params.set('maxVideoBitrate', String(input.effectiveMaxBitrate));
        applyQualityResolutionParams(params, input.shouldApplyQualityOverride, input.videoResolution);
        applyLocationParam(params, input.location);
        params.set('addDebugOverlay', '0');
        params.set('autoAdjustQuality', '0');
        params.set('mediaBufferSize', '102400');
        applySubtitleParams(params, input.subtitle);
        params.set('Accept-Language', 'en');
        return;
    }

    params.set('directPlay', '0');
    params.set('directStream', '1');
    params.set('maxVideoBitrate', String(input.effectiveMaxBitrate));
    applyQualityResolutionParams(params, input.shouldApplyQualityOverride, input.videoResolution);
    applyLocationParam(params, input.location);
    applySubtitleParams(params, input.subtitle);
}

function applyQualityResolutionParams(
    params: URLSearchParams,
    shouldApplyQualityOverride: boolean,
    videoResolution: string | undefined
): void {
    if (!shouldApplyQualityOverride || !videoResolution) {
        return;
    }

    params.set('videoQuality', '100');
    params.set('videoResolution', videoResolution);
}

function applyLocationParam(params: URLSearchParams, location: 'lan' | 'wan' | null): void {
    if (location) {
        params.set('location', location);
    }
}

function applySubtitleParams(
    params: URLSearchParams,
    input:
        | { burnInEnabled: true; subtitleStreamId: string }
        | { burnInEnabled: false }
): void {
    if (input.burnInEnabled) {
        params.set('subtitles', 'burn');
        params.set('subtitleStreamID', input.subtitleStreamId);
        return;
    }

    params.set('subtitles', 'none');
    params.set('subtitleStreamID', '0');
    params.set('subtitleFormat', 'none');
}

function applyDefaultIdentityParams(
    params: URLSearchParams,
    defaults: Record<string, string>
): void {
    for (const [key, value] of Object.entries(defaults)) {
        if (!params.has(key)) {
            params.set(key, value);
        }
    }
}

function parseOrigin(uri: string | null): string | null {
    try {
        return uri ? new URL(uri).origin : null;
    } catch {
        return null;
    }
}
