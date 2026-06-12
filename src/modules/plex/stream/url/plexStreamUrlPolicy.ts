import type { TranscodeQualityOption } from '../../../../config/transcodeQuality';
import { DEFAULT_HLS_OPTIONS } from '../policy/constants';
import type { HlsOptions } from '../contracts/types';
import type {
    DolbyVisionDecoderProfile,
    PlaybackCapabilityProfile,
} from '../capabilities/PlaybackCapabilityProfile';
import { isCapabilityAdvertisable } from '../capabilities/PlaybackCapabilityProfile';
import {
    applyXPlexQueryParamsFromHeaders,
} from '../../shared/plexUrl';

interface PlexSelectedConnectionSnapshot {
    uri: string;
    local: boolean;
    relay: boolean;
}

interface PlexClientCapabilityPolicyInput {
    profile: PlaybackCapabilityProfile;
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

const PLEX_CLIENT_PROTOCOLS = 'http-live-streaming,http-mp4-streaming,http-streaming-video';
const PLEX_BASE_AUDIO_DECODERS = [
    'mp3',
    'aac{bitrate:800000}',
    'ac3{bitrate:800000}',
    'eac3{bitrate:800000}',
];
const PLEX_DTS_AUDIO_DECODERS = [
    'dts{bitrate:1536000}',
    'dca{bitrate:1536000}',
    'dca-ma{bitrate:1536000}',
];

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
    const videoDecoders = buildPlexVideoDecoders(input);
    const audioDecoders = buildPlexAudioDecoders(isCapabilityAdvertisable(input.profile.audio.dtsPassthrough));

    return serializePlexClientCapabilities(videoDecoders, audioDecoders);
}

export function buildPlexTranscodeStartUrl(input: PlexTranscodeUrlPolicyInput): {
    url: string;
    compatMode: boolean;
    startOffsetMs: number;
    startOffsetSeconds: number;
    maxBitrate?: number;
    maxBitrateReason: 'none' | 'explicit' | 'quality' | 'explicit_quality';
} {
    const metadataPath = input.metadataPath.trim();
    if (metadataPath.length === 0) {
        throw new TypeError('Plex transcode metadataPath must be a non-empty string');
    }

    let baseUrl: URL;
    try {
        baseUrl = new URL(input.baseUri);
    } catch {
        throw new TypeError('Plex transcode baseUri must be a valid absolute URL');
    }

    const sessionId = input.options.sessionId ?? '';
    const explicitMaxBitrate = normalizePositiveInteger(input.options.maxBitrate);
    const startOffsetMs = normalizeNonNegativeInteger(input.options.startOffsetMs);
    const startOffsetSeconds = Math.floor(startOffsetMs / 1000);
    const subtitleSize = normalizeFiniteNumber(input.options.subtitleSize, DEFAULT_HLS_OPTIONS.subtitleSize);
    const audioBoost = normalizeFiniteNumber(input.options.audioBoost, DEFAULT_HLS_OPTIONS.audioBoost);
    const mediaIndex = normalizeNonNegativeInteger(input.options.mediaIndex);
    const partIndex = normalizeNonNegativeInteger(input.options.partIndex);
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
    const normalizedQualityMaxBitrate = normalizePositiveInteger(qualityMaxBitrate);
    const maxBitrate = resolveMaxVideoBitrate({
        explicitMaxBitrate,
        qualityMaxBitrate: normalizedQualityMaxBitrate,
    });
    const location = classifyPlexTranscodeLocation({
        baseUri: baseUrl.toString(),
        selectedConnection: input.selectedConnection,
        relayConnectionUri: input.relayConnectionUri,
    });

    const params = new URLSearchParams();
    params.set('path', metadataPath);
    params.set('mediaIndex', String(mediaIndex));
    params.set('partIndex', String(partIndex));
    params.set('protocol', 'hls');
    params.set('offset', String(startOffsetSeconds));
    applyPlexSessionQueryParams(params, sessionId);
    if (typeof input.options.audioStreamId === 'string' && input.options.audioStreamId.length > 0) {
        params.set('audioStreamID', input.options.audioStreamId);
    }

    applyTranscodeModeParams(params, {
        compatMode: input.compatMode,
        subtitleSize,
        audioBoost,
        maxBitrate: maxBitrate.value,
        shouldApplyQualityOverride,
        videoResolution: input.quality?.videoResolution,
        location,
        subtitle: subtitleParams,
    });

    applyXPlexQueryParamsFromHeaders(params, input.authHeaders);
    // Computed capabilities intentionally override header values so transcode policy can hide DV/prefer HDR10.
    params.set('X-Plex-Client-Capabilities', input.clientCapabilities);
    ensurePlexClientProfileName(params, input.forcedProfileName);
    applyDefaultIdentityParams(params, input.defaultIdentityParams);

    const url = new URL('/video/:/transcode/universal/start.m3u8', baseUrl);
    url.search = params.toString();
    return {
        url: url.toString(),
        compatMode: input.compatMode,
        startOffsetMs,
        startOffsetSeconds,
        ...(typeof maxBitrate.value === 'number' ? { maxBitrate: maxBitrate.value } : {}),
        maxBitrateReason: maxBitrate.reason,
    };
}

function resolveMaxVideoBitrate(input: {
    explicitMaxBitrate: number | undefined;
    qualityMaxBitrate: number | undefined;
}): {
    value?: number;
    reason: 'none' | 'explicit' | 'quality' | 'explicit_quality';
} {
    const { explicitMaxBitrate, qualityMaxBitrate } = input;
    if (typeof explicitMaxBitrate === 'number' && typeof qualityMaxBitrate === 'number') {
        return {
            value: Math.min(explicitMaxBitrate, qualityMaxBitrate),
            reason: 'explicit_quality',
        };
    }
    if (typeof explicitMaxBitrate === 'number') {
        return { value: explicitMaxBitrate, reason: 'explicit' };
    }
    if (typeof qualityMaxBitrate === 'number') {
        return { value: qualityMaxBitrate, reason: 'quality' };
    }
    return { reason: 'none' };
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

function normalizeFiniteNumber(value: number | undefined, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }
    return value;
}

function applyTranscodeModeParams(
    params: URLSearchParams,
    input: {
        compatMode: boolean;
        subtitleSize: number;
        audioBoost: number;
        maxBitrate: number | undefined;
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
        applyMaxVideoBitrateParam(params, input.maxBitrate);
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
    applyMaxVideoBitrateParam(params, input.maxBitrate);
    applyQualityResolutionParams(params, input.shouldApplyQualityOverride, input.videoResolution);
    applyLocationParam(params, input.location);
    applySubtitleParams(params, input.subtitle);
}

function applyMaxVideoBitrateParam(
    params: URLSearchParams,
    maxBitrate: number | undefined
): void {
    if (typeof maxBitrate !== 'number') {
        return;
    }

    params.set('maxVideoBitrate', String(maxBitrate));
}

function buildPlexVideoDecoders(input: PlexClientCapabilityPolicyInput): string[] {
    const profile = input.profile;
    return [
        `h264{profile:high&level:${profile.display.is4K ? '51' : '42'}}`,
        ...buildPlexHevcVideoDecoders(input),
        ...(isCapabilityAdvertisable(profile.video.vp9) ? ['vp9'] : []),
        ...(isCapabilityAdvertisable(profile.video.av1) ? ['av1'] : []),
    ];
}

function buildPlexHevcVideoDecoders(input: PlexClientCapabilityPolicyInput): string[] {
    const profile = input.profile;
    const hasHevcMain = isCapabilityAdvertisable(profile.video.hevcMain);
    const hasHevcMain10 = isCapabilityAdvertisable(profile.video.hevcMain10);
    const dolbyVisionDecoders = buildPlexDolbyVisionVideoDecoders(input);
    if (!hasHevcMain && !hasHevcMain10) {
        return dolbyVisionDecoders;
    }

    const hevcLevel = profile.display.is4K ? '150' : '120';
    return [
        ...(hasHevcMain10 ? [`hevc{profile:main10&level:${hevcLevel}}`] : []),
        `hevc{profile:main&level:${hevcLevel}}`,
        ...dolbyVisionDecoders,
    ];
}

function buildPlexDolbyVisionVideoDecoders(input: PlexClientCapabilityPolicyInput): string[] {
    if (input.hideDolbyVision === true) {
        return [];
    }

    const supportedProfiles: DolbyVisionDecoderProfile[] = ['dvhe.05', 'dvhe.08'];
    return supportedProfiles
        .filter((profile) => isCapabilityAdvertisable(input.profile.video.dolbyVision.profiles[profile]))
        .map((profile) => `hevc{profile:${profile}}`);
}

function buildPlexAudioDecoders(dtsPassthroughEnabled: boolean): string[] {
    return [
        ...PLEX_BASE_AUDIO_DECODERS,
        ...(dtsPassthroughEnabled ? PLEX_DTS_AUDIO_DECODERS : []),
    ];
}

function serializePlexClientCapabilities(videoDecoders: string[], audioDecoders: string[]): string {
    return `protocols=${PLEX_CLIENT_PROTOCOLS};videoDecoders=${videoDecoders.join(',')};audioDecoders=${audioDecoders.join(',')}`;
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
