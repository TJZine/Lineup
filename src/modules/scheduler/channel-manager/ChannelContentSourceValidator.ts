import type { ChannelContentSource } from './types';

const MAX_CONTENT_SOURCE_DEPTH = 25;

export function isValidContentSource(source: unknown, depth: number = 0): source is ChannelContentSource {
    // Guard against excessive nesting in corrupted storage (mixed sources can be recursive).
    // JSON cannot represent cyclic references, so a depth limit is sufficient here.
    if (depth > MAX_CONTENT_SOURCE_DEPTH) {
        return false;
    }
    if (!source || typeof source !== 'object') {
        return false;
    }
    const src = source as Record<string, unknown> & { type?: unknown };
    const type = src.type;
    if (typeof type !== 'string') {
        return false;
    }

    const isNonEmptyString = (value: unknown): value is string =>
        typeof value === 'string' && value.length > 0;

    const isValidIdString = (value: unknown): value is string =>
        isNonEmptyString(value) && value !== 'undefined';

    const isValidSeasonFilter = (value: unknown): boolean => {
        if (value === undefined) {
            return true;
        }
        if (!Array.isArray(value)) {
            return false;
        }
        return value.every((entry) => typeof entry === 'number' && Number.isFinite(entry) && Number.isInteger(entry) && entry > 0);
    };

    const isValidManualItem = (item: unknown): boolean => {
        if (!item || typeof item !== 'object') {
            return false;
        }
        const obj = item as Record<string, unknown>;
        const ratingKey = obj['ratingKey'];
        const title = obj['title'];
        const durationMs = obj['durationMs'];

        return (
            typeof ratingKey === 'string' &&
            ratingKey.length > 0 &&
            ratingKey !== 'undefined' &&
            typeof title === 'string' &&
            title.length > 0 &&
            typeof durationMs === 'number' &&
            Number.isFinite(durationMs) &&
            durationMs > 0
        );
    };

    switch (type) {
        case 'library': {
            const libraryId = src['libraryId'];
            const libraryType = src['libraryType'];
            const includeWatched = src['includeWatched'];
            const libraryFilter = src['libraryFilter'];

            return (
                isValidIdString(libraryId) &&
                (libraryType === 'movie' || libraryType === 'show') &&
                typeof includeWatched === 'boolean' &&
                (libraryFilter === undefined ||
                    (libraryFilter !== null && typeof libraryFilter === 'object' && !Array.isArray(libraryFilter)))
            );
        }
        case 'collection':
            return (
                isValidIdString(src['collectionKey']) &&
                isNonEmptyString(src['collectionName'])
            );
        case 'show':
            return (
                isValidIdString(src['showKey']) &&
                isNonEmptyString(src['showName']) &&
                isValidSeasonFilter(src['seasonFilter'])
            );
        case 'playlist':
            return (
                isValidIdString(src['playlistKey']) &&
                isNonEmptyString(src['playlistName'])
            );
        case 'manual':
            return (
                Array.isArray(src['items']) &&
                (src['items'] as unknown[]).length > 0 &&
                (src['items'] as unknown[]).every((item) => isValidManualItem(item))
            );
        case 'mixed':
            return (
                (src['mixMode'] === 'interleave' || src['mixMode'] === 'sequential') &&
                Array.isArray(src['sources']) &&
                (src['sources'] as unknown[]).length > 0 &&
                (src['sources'] as unknown[]).every((s) => isValidContentSource(s, depth + 1))
            );
        default:
            return false;
    }
}
