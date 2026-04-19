import type { PlexMediaItem, RawMediaItem } from './types';
import { parseMediaFiles } from './mediaFileParser';
import { toPlexDate } from './mediaItemDetailsParser';
import { mapMediaType } from './mediaTypeParser';

export function buildBaseMediaItem(data: RawMediaItem): PlexMediaItem {
    return {
        ...buildMediaIdentity(data),
        ...buildMediaMetadata(data),
    };
}

function buildMediaIdentity(data: RawMediaItem): Pick<PlexMediaItem, 'ratingKey' | 'key' | 'type' | 'title' | 'sortTitle'> {
    return {
        ratingKey: data.ratingKey,
        key: data.key,
        type: mapMediaType(data.type),
        title: data.title,
        sortTitle: data.titleSort ?? data.title,
    };
}

function buildMediaMetadata(
    data: RawMediaItem
): Pick<PlexMediaItem, 'summary' | 'year' | 'durationMs' | 'addedAt' | 'updatedAt' | 'thumb' | 'art' | 'viewOffset' | 'viewCount' | 'media'> {
    return {
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
