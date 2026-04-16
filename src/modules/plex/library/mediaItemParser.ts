import type {
    PlexMediaFile,
    PlexMediaItem,
    PlexMediaPart,
    PlexMediaType,
    RawMediaFile,
    RawMediaItem,
    RawMediaPart,
} from './types';
import { parseStream } from './streamParser';

const UNIX_TIMESTAMP_MS = 1000;

export function parseMediaItem(data: RawMediaItem): PlexMediaItem {
    const item = buildBaseMediaItem(data);

    assignOptionalMediaMetadata(item, data);
    assignMediaCredits(item, data);
    assignClearLogo(item, data);
    assignEpisodeMetadata(item, data);

    return item;
}

export function mapMediaType(type: string): PlexMediaType {
    switch (type) {
        case 'movie':
            return 'movie';
        case 'show':
            return 'show';
        case 'episode':
            return 'episode';
        case 'track':
            return 'track';
        case 'clip':
            return 'clip';
        default:
            return 'movie';
    }
}

function parseMediaFile(data: RawMediaFile): PlexMediaFile {
    return {
        ...buildBaseMediaFile(data),
        parts: parseMediaParts(data.Part),
    };
}

function buildBaseMediaItem(data: RawMediaItem): PlexMediaItem {
    return {
        ratingKey: data.ratingKey,
        key: data.key,
        type: mapMediaType(data.type),
        title: data.title,
        sortTitle: data.titleSort ?? data.title,
        summary: data.summary ?? '',
        year: data.year ?? 0,
        durationMs: data.duration ?? 0,
        addedAt: toPlexDate(data.addedAt),
        updatedAt: toPlexDate(data.updatedAt),
        thumb: data.thumb ?? null,
        art: data.art ?? null,
        viewOffset: data.viewOffset ?? 0,
        viewCount: data.viewCount ?? 0,
        media: parseMediaFiles(data.Media),
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

function parseMediaFiles(mediaFiles: RawMediaFile[] | undefined): PlexMediaFile[] {
    return (mediaFiles ?? []).map(parseMediaFile);
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

function assignOptionalMediaMetadata(item: PlexMediaItem, data: RawMediaItem): void {
    assignOptional(item, 'originalTitle', data.originalTitle);
    assignOptional(item, 'banner', data.banner ?? null, data.banner !== undefined);
    assignOptional(item, 'rating', data.rating);
    assignOptional(item, 'audienceRating', data.audienceRating);
    assignOptional(item, 'contentRating', data.contentRating);
    assignOptional(item, 'lastViewedAt', toPlexDateOrUndefined(data.lastViewedAt));
}

function assignMediaCredits(item: PlexMediaItem, data: RawMediaItem): void {
    const genres = collectTagNames(data.Genre);
    if (genres.length > 0) {
        item.genres = genres;
    }

    const directors = collectTagNames(data.Director);
    if (directors.length > 0) {
        item.directors = directors;
    }

    const roles = (data.Role ?? [])
        .map((entry) => ({
            name: entry.tag?.trim() ?? '',
            role: entry.role?.trim() ?? null,
            thumb: entry.thumb ?? null,
        }))
        .filter((entry) => entry.name.length > 0);

    if (roles.length > 0) {
        item.actorRoles = roles;
        item.actors = roles.map((role) => role.name);
    }

    const studios = collectTagNames(data.Studio);
    if (studios.length > 0) {
        item.studios = studios;
    }
}

function assignClearLogo(item: PlexMediaItem, data: RawMediaItem): void {
    if (!Array.isArray(data.Image)) {
        return;
    }

    const entry = data.Image.find(
        (image) => image && image.type === 'clearLogo' && typeof image.url === 'string' && image.url.length > 0
    );

    if (entry?.url) {
        item.clearLogo = entry.url;
    }
}

function assignEpisodeMetadata(item: PlexMediaItem, data: RawMediaItem): void {
    assignOptional(item, 'grandparentTitle', data.grandparentTitle);
    assignOptional(item, 'parentTitle', data.parentTitle);
    assignOptional(item, 'grandparentThumb', data.grandparentThumb ?? null, data.grandparentThumb !== undefined);
    assignOptional(item, 'parentThumb', data.parentThumb ?? null, data.parentThumb !== undefined);
    assignOptional(item, 'grandparentRatingKey', data.grandparentRatingKey);
    assignOptional(item, 'parentRatingKey', data.parentRatingKey);
    assignOptional(item, 'seasonNumber', data.parentIndex);
    assignOptional(item, 'episodeNumber', data.index);
}

function collectTagNames(tags: Array<{ tag?: string }> | undefined): string[] {
    return (tags ?? []).map((tag) => tag.tag).filter((tag): tag is string => Boolean(tag));
}

function assignOptional<K extends keyof PlexMediaItem>(
    item: PlexMediaItem,
    key: K,
    value: PlexMediaItem[K] | undefined,
    condition = value !== undefined
): void {
    if (condition) {
        item[key] = value as PlexMediaItem[K];
    }
}

function toPlexDate(value: number | undefined): Date {
    return typeof value === 'number' ? new Date(value * UNIX_TIMESTAMP_MS) : new Date(0);
}

function toPlexDateOrUndefined(value: number | undefined): Date | undefined {
    return typeof value === 'number' ? toPlexDate(value) : undefined;
}
