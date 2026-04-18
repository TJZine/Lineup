import type {
    PlexMediaFile,
    PlexMediaPart,
    RawMediaFile,
    RawMediaPart,
} from './types';
import { parseStream } from './streamParser';

export function parseMediaFiles(mediaFiles: RawMediaFile[] | undefined): PlexMediaFile[] {
    return (mediaFiles ?? []).map(parseMediaFile);
}

function parseMediaFile(data: RawMediaFile): PlexMediaFile {
    return {
        ...buildBaseMediaFile(data),
        parts: parseMediaParts(data.Part),
    };
}

function buildBaseMediaFile(data: RawMediaFile): Omit<PlexMediaFile, 'parts'> {
    const normalizedValues = normalizeMediaFileValues(data);

    return {
        id: String(data.id),
        duration: data.duration ?? 0,
        bitrate: data.bitrate ?? 0,
        width: data.width ?? 0,
        height: data.height ?? 0,
        aspectRatio: data.aspectRatio ?? 0,
        videoCodec: normalizedValues.videoCodec,
        audioCodec: normalizedValues.audioCodec,
        audioChannels: data.audioChannels ?? 0,
        container: normalizedValues.container,
        videoResolution: data.videoResolution ?? '',
    };
}

function parseMediaPart(data: RawMediaPart): PlexMediaPart {
    const part: PlexMediaPart = {
        id: String(data.id),
        key: data.key,
        duration: data.duration ?? 0,
        file: data.file ?? '',
        size: data.size ?? 0,
        container: data.container ?? '',
        streams: (data.Stream || []).map(parseStream),
    };

    if (data.videoProfile !== undefined) {
        part.videoProfile = data.videoProfile;
    }

    if (data.audioProfile !== undefined) {
        part.audioProfile = data.audioProfile;
    }

    return part;
}

function parseMediaParts(parts: RawMediaPart[] | undefined): PlexMediaPart[] {
    return (parts ?? []).map(parseMediaPart);
}

function normalizeMediaFileValues(data: RawMediaFile): {
    videoCodec: string;
    audioCodec: string;
    container: string;
} {
    return {
        videoCodec: (data.videoCodec ?? '').toLowerCase(),
        audioCodec: (data.audioCodec ?? '').toLowerCase(),
        container: (data.container ?? '').toLowerCase(),
    };
}
