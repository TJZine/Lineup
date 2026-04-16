import type { ChannelContentSource } from './types';

const MAX_CONTENT_SOURCE_DEPTH = 25;
type ContentSourceRecord = Record<string, unknown> & { type?: unknown };
type ContentSourceType = ChannelContentSource['type'];
type ContentSourceValidator = (source: ContentSourceRecord, depth: number) => boolean;

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
    return value.every(
        (entry) =>
            typeof entry === 'number' &&
            Number.isFinite(entry) &&
            Number.isInteger(entry) &&
            entry > 0
    );
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

const isValidLibrarySource = (source: Record<string, unknown>): boolean => {
    const libraryId = source['libraryId'];
    const libraryType = source['libraryType'];
    const includeWatched = source['includeWatched'];
    const libraryFilter = source['libraryFilter'];

    return (
        isValidIdString(libraryId) &&
        (libraryType === 'movie' || libraryType === 'show') &&
        typeof includeWatched === 'boolean' &&
        (libraryFilter === undefined ||
            (libraryFilter !== null && typeof libraryFilter === 'object' && !Array.isArray(libraryFilter)))
    );
};

const isValidCollectionSource = (source: Record<string, unknown>): boolean =>
    isValidIdString(source['collectionKey']) && isNonEmptyString(source['collectionName']);

const isValidShowSource = (source: Record<string, unknown>): boolean =>
    isValidIdString(source['showKey']) &&
    isNonEmptyString(source['showName']) &&
    isValidSeasonFilter(source['seasonFilter']);

const isValidPlaylistSource = (source: Record<string, unknown>): boolean =>
    isValidIdString(source['playlistKey']) && isNonEmptyString(source['playlistName']);

const isValidManualSource = (source: Record<string, unknown>): boolean =>
    Array.isArray(source['items']) &&
    (source['items'] as unknown[]).length > 0 &&
    (source['items'] as unknown[]).every((item) => isValidManualItem(item));

const isValidMixedSource = (source: ContentSourceRecord, depth: number): boolean =>
    (source['mixMode'] === 'interleave' || source['mixMode'] === 'sequential') &&
    Array.isArray(source['sources']) &&
    (source['sources'] as unknown[]).length > 0 &&
    (source['sources'] as unknown[]).every((entry) => isValidContentSource(entry, depth + 1));

const CONTENT_SOURCE_VALIDATORS: Record<ContentSourceType, ContentSourceValidator> = {
    library: (source) => isValidLibrarySource(source),
    collection: (source) => isValidCollectionSource(source),
    show: (source) => isValidShowSource(source),
    playlist: (source) => isValidPlaylistSource(source),
    manual: (source) => isValidManualSource(source),
    mixed: isValidMixedSource,
};

export function isValidContentSource(source: unknown, depth: number = 0): source is ChannelContentSource {
    // Guard against excessive nesting in corrupted storage (mixed sources can be recursive).
    // JSON cannot represent cyclic references, so a depth limit is sufficient here.
    if (depth > MAX_CONTENT_SOURCE_DEPTH) {
        return false;
    }
    if (!source || typeof source !== 'object') {
        return false;
    }
    const src = source as ContentSourceRecord;
    if (typeof src.type !== 'string') {
        return false;
    }

    const validator = CONTENT_SOURCE_VALIDATORS[src.type as ContentSourceType];
    return validator ? validator(src, depth) : false;
}
