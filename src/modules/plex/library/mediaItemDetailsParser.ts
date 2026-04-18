import type { PlexMediaItem, RawMediaItem } from './types';
import { parseArrayOrEmpty, parseRequiredObject } from './parserValidation';

const UNIX_TIMESTAMP_MS = 1000;

export function applyMediaItemDetails(item: PlexMediaItem, data: RawMediaItem): void {
    assignOptionalMediaMetadata(item, data);
    assignMediaCredits(item, data);
    assignClearLogo(item, data);
    assignEpisodeMetadata(item, data);
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

    const roles = parseArrayOrEmpty<unknown>(
        data.Role,
        'media item roles'
    )
        .map((entry, index) => parseRequiredObject<{ tag?: string; role?: string | null; thumb?: string | null }>(
            entry,
            `media item roles[${index}]`
        ))
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

export function toPlexDate(value: number | undefined): Date {
    return typeof value === 'number' ? new Date(value * UNIX_TIMESTAMP_MS) : new Date(0);
}

function toPlexDateOrUndefined(value: number | undefined): Date | undefined {
    return typeof value === 'number' ? toPlexDate(value) : undefined;
}

function collectTagNames(tags: unknown): string[] {
    return parseArrayOrEmpty<unknown>(tags, 'media item tags')
        .map((tag, index) => parseRequiredObject<{ tag?: string }>(tag, `media item tags[${index}]`))
        .map((tag) => tag.tag)
        .filter((tag): tag is string => Boolean(tag));
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
