import type {
    PlexMediaFile,
    PlexMediaPart,
    RawMediaFile,
    RawMediaPart,
    RawStream,
} from '../types';
import { parseStream } from './streamParser';
import {
    parseArrayOrEmpty,
    parseFiniteNumberOrDefault,
    parseOptionalString,
    parseRequiredObject,
    parseRequiredString,
    parseRequiredStringLike,
    parseStringOrDefault,
} from './parserValidation';

export function parseMediaFiles(mediaFiles: unknown): PlexMediaFile[] {
    return parseArrayOrEmpty<unknown>(mediaFiles, 'media file list').map((mediaFile, index) =>
        parseMediaFile(parseRequiredObject<RawMediaFile>(mediaFile, `media file list[${index}]`))
    );
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
        id: parseRequiredStringLike(data.id, 'media file', 'id'),
        duration: parseFiniteNumberOrDefault(data.duration, 'media file', 'duration'),
        bitrate: parseFiniteNumberOrDefault(data.bitrate, 'media file', 'bitrate'),
        width: parseFiniteNumberOrDefault(data.width, 'media file', 'width'),
        height: parseFiniteNumberOrDefault(data.height, 'media file', 'height'),
        aspectRatio: parseFiniteNumberOrDefault(data.aspectRatio, 'media file', 'aspectRatio'),
        videoCodec: normalizedValues.videoCodec,
        audioCodec: normalizedValues.audioCodec,
        audioChannels: parseFiniteNumberOrDefault(data.audioChannels, 'media file', 'audioChannels'),
        container: normalizedValues.container,
        videoResolution: parseStringOrDefault(data.videoResolution, 'media file', 'videoResolution'),
    };
}

function parseMediaPart(data: RawMediaPart): PlexMediaPart {
    const part: PlexMediaPart = {
        id: parseRequiredStringLike(data.id, 'media part', 'id'),
        key: parseRequiredString(data.key, 'media part', 'key'),
        duration: parseFiniteNumberOrDefault(data.duration, 'media part', 'duration'),
        file: parseStringOrDefault(data.file, 'media part', 'file'),
        size: parseFiniteNumberOrDefault(data.size, 'media part', 'size'),
        container: parseStringOrDefault(data.container, 'media part', 'container'),
        streams: parseArrayOrEmpty<unknown>(data.Stream, 'media part streams').map((stream, index) =>
            parseStream(parseRequiredObject<RawStream>(stream, `media part streams[${index}]`))
        ),
    };

    const videoProfile = parseOptionalString(data.videoProfile, 'media part', 'videoProfile');
    if (videoProfile !== undefined) {
        part.videoProfile = videoProfile;
    }

    const audioProfile = parseOptionalString(data.audioProfile, 'media part', 'audioProfile');
    if (audioProfile !== undefined) {
        part.audioProfile = audioProfile;
    }

    return part;
}

function parseMediaParts(parts: unknown): PlexMediaPart[] {
    return parseArrayOrEmpty<unknown>(parts, 'media file parts').map((part, index) =>
        parseMediaPart(parseRequiredObject<RawMediaPart>(part, `media file parts[${index}]`))
    );
}

function normalizeMediaFileValues(data: RawMediaFile): {
    videoCodec: string;
    audioCodec: string;
    container: string;
} {
    return {
        videoCodec: parseStringOrDefault(data.videoCodec, 'media file', 'videoCodec').toLowerCase(),
        audioCodec: parseStringOrDefault(data.audioCodec, 'media file', 'audioCodec').toLowerCase(),
        container: parseStringOrDefault(data.container, 'media file', 'container').toLowerCase(),
    };
}
