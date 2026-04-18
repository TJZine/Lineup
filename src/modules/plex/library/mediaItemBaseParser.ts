import type { PlexMediaItem, RawMediaItem } from './types';
import { parseMediaFiles } from './mediaFileParser';
import { toPlexDate } from './mediaItemDetailsParser';
import { mapMediaType } from './mediaTypeParser';

export function buildBaseMediaItem(data: RawMediaItem): PlexMediaItem {
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
