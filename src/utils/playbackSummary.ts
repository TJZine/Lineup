import { formatAudioCodec } from './mediaFormat';

export type PlaybackInfoSnapshotLike = {
    stream: {
        protocol?: string | undefined;
        isDirectPlay: boolean;
        isTranscoding: boolean;
        container?: string | undefined;
        videoCodec?: string | undefined;
        audioCodec?: string | undefined;
        width?: number | undefined;
        height?: number | undefined;
        selectedSubtitle?: {
            id: string;
        } | null | undefined;
        subtitleBurnIn?: {
            confirmed?: boolean | undefined;
        } | undefined;
        serverDecision?: {
            videoDecision?: string | undefined;
            audioDecision?: string | undefined;
            subtitleDecision?: string | undefined;
            decisionCode?: string | undefined;
            decisionText?: string | undefined;
            streams?: Array<{
                id?: string | undefined;
                streamType?: 1 | 2 | 3 | undefined;
                decision?: string | undefined;
            }> | undefined;
        } | undefined;
    } | null;
};

type PlaybackSummary = {
    summary: string | null;
    tag: string | null;
    details: string[];
};

export function buildPlaybackSummary(
    snapshot: PlaybackInfoSnapshotLike | null | undefined,
    options?: { resolutionOverride?: string | null }
): PlaybackSummary {
    const stream = snapshot?.stream;
    if (!stream) {
        return { summary: null, tag: null, details: [] };
    }

    const overrideResolution = options?.resolutionOverride?.trim() || null;
    const mode = summarizePlaybackMode(stream);
    const video = formatVideoCodec(stream.videoCodec);
    const audio = formatAudioCodec(stream.audioCodec);
    const resolution = overrideResolution || formatResolution(stream.width, stream.height);
    const codecLine = video && audio ? `${video}/${audio}` : (video || audio || '');

    const parts = [mode];
    if (codecLine) parts.push(codecLine);
    if (resolution) parts.push(resolution);

    const details: string[] = [];
    if (video || resolution) {
        details.push(`Video: ${[video, resolution].filter(Boolean).join(' • ')}`);
    }
    if (audio) {
        details.push(`Audio: ${audio}`);
    }
    if (stream.container) {
        details.push(`Container: ${stream.container.toUpperCase()}`);
    }

    return {
        summary: parts.length > 0 ? `Playback: ${parts.join(' • ')}` : null,
        tag: parts.length > 0 ? parts.join(' • ') : null,
        details,
    };
}

function summarizePlaybackMode(stream: NonNullable<PlaybackInfoSnapshotLike['stream']>): string {
    if (stream.isDirectPlay) {
        return 'Direct Play';
    }

    const serverDecision = stream.serverDecision;
    if (hasConfirmedSubtitleBurn(stream)) {
        return 'Video Transcode';
    }
    if (isDecision(serverDecision?.videoDecision, 'transcode')) {
        return 'Video Transcode';
    }
    if (
        hasCopyOrRemuxDecision(serverDecision?.videoDecision) &&
        isDecision(serverDecision?.audioDecision, 'transcode')
    ) {
        return 'Audio Transcode';
    }
    if (
        hasCopyOrRemuxDecision(serverDecision?.videoDecision) &&
        hasCopyOrRemuxDecision(serverDecision?.audioDecision)
    ) {
        return 'Direct Stream';
    }
    if (stream.isTranscoding || stream.protocol?.toLowerCase() === 'hls') {
        return 'HLS Session';
    }
    return 'Direct Stream';
}

function hasConfirmedSubtitleBurn(stream: NonNullable<PlaybackInfoSnapshotLike['stream']>): boolean {
    if (stream.subtitleBurnIn?.confirmed === true) {
        return true;
    }

    const selectedSubtitleId = stream.selectedSubtitle?.id;
    if (!selectedSubtitleId) {
        return false;
    }

    return stream.serverDecision?.streams?.some((decision) =>
        decision.streamType === 3 &&
        decision.id === selectedSubtitleId &&
        isDecision(decision.decision, 'burn')
    ) ?? false;
}

function isDecision(value: string | undefined, expected: string): boolean {
    return value?.trim().toLowerCase() === expected;
}

function hasCopyOrRemuxDecision(value: string | undefined): boolean {
    const normalized = value?.trim().toLowerCase();
    return (
        normalized === 'copy' ||
        normalized === 'remux' ||
        normalized === 'directstream' ||
        normalized === 'direct_stream'
    );
}

function formatVideoCodec(codec?: string): string | null {
    if (!codec) return null;
    const normalized = codec.trim().toLowerCase();
    switch (normalized) {
        case 'h264':
            return 'H.264';
        case 'h265':
        case 'hevc':
            return 'HEVC';
        case 'av1':
            return 'AV1';
        case 'mpeg2video':
            return 'MPEG-2';
        default:
            return normalized.toUpperCase();
    }
}

function formatResolution(_width?: number, height?: number): string | null {
    const resolvedHeight = Number.isFinite(height) ? Math.max(0, height ?? 0) : 0;
    if (!resolvedHeight) return null;
    const target = resolvedHeight;
    if (target >= 2160) return '4K';
    if (target >= 1440) return '1440p';
    if (target >= 1080) return '1080p';
    if (target >= 720) return '720p';
    if (target >= 480) return '480p';
    return `${Math.round(target)}p`;
}
