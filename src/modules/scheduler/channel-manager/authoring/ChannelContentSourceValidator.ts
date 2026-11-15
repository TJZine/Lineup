import type { ChannelContentSource, CollectionContentSource } from '../contracts/types';

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
            entry >= 0
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

const COLLECTION_LIBRARY_METADATA_KEYS = ['libraryId', 'libraryType', 'libraryName'] as const;

export type CollectionLibraryMetadata = Required<Pick<
    CollectionContentSource,
    'libraryId' | 'libraryType' | 'libraryName'
>>;

export function hasCollectionLibraryMetadata(source: unknown): boolean {
    return isPlainRecord(source)
        && COLLECTION_LIBRARY_METADATA_KEYS.some((key) => Object.prototype.hasOwnProperty.call(source, key));
}

export function getCompleteCollectionLibraryMetadata(source: unknown): CollectionLibraryMetadata | undefined {
    if (!isPlainRecord(source)) return undefined;
    if (!COLLECTION_LIBRARY_METADATA_KEYS.every((key) => Object.prototype.hasOwnProperty.call(source, key))) {
        return undefined;
    }

    const libraryId = source['libraryId'];
    const libraryType = source['libraryType'];
    const libraryName = source['libraryName'];
    if (!isValidIdString(libraryId) || (libraryType !== 'movie' && libraryType !== 'show')
        || !isNonEmptyString(libraryName)) {
        return undefined;
    }
    return { libraryId, libraryType, libraryName };
}

export function containsMalformedCollectionLibraryMetadata(source: unknown): boolean {
    return containsMalformedCollectionLibraryMetadataAtDepth(source, 0);
}

function containsMalformedCollectionLibraryMetadataAtDepth(source: unknown, depth: number): boolean {
    if (depth > MAX_CONTENT_SOURCE_DEPTH || !isPlainRecord(source)) return false;
    if (source['type'] === 'collection') {
        return hasCollectionLibraryMetadata(source) && getCompleteCollectionLibraryMetadata(source) === undefined;
    }
    if (source['type'] === 'mixed' && Array.isArray(source['sources'])) {
        return source['sources'].some((child) => containsMalformedCollectionLibraryMetadataAtDepth(child, depth + 1));
    }
    return false;
}

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

    if (!Object.prototype.hasOwnProperty.call(CONTENT_SOURCE_VALIDATORS, src.type)) {
        return false;
    }

    const validator = CONTENT_SOURCE_VALIDATORS[src.type as ContentSourceType];
    return typeof validator === 'function' ? validator(src, depth) : false;
}

const EXACT_SOURCE_KEYS: Record<ChannelContentSource['type'], readonly string[]> = {
    library: ['type', 'libraryId', 'libraryType', 'includeWatched', 'libraryFilter'],
    collection: ['type', 'collectionKey', 'collectionName', ...COLLECTION_LIBRARY_METADATA_KEYS],
    show: ['type', 'showKey', 'showName', 'seasonFilter'],
    playlist: ['type', 'playlistKey', 'playlistName'],
    manual: ['type', 'items'],
    mixed: ['type', 'sources', 'mixMode'],
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype: unknown = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
    return Object.keys(record).every((key) => keys.includes(key));
}

/** Authored candidates are exact; stored legacy records retain the tolerant decoder above. */
export function isExactAuthoredContentSource(source: unknown): source is ChannelContentSource {
    if (!isValidContentSource(source) || !isPlainRecord(source)
        || !hasOnlyKeys(source, EXACT_SOURCE_KEYS[source.type])) return false;
    switch (source.type) {
        case 'library': {
            const filter = source.libraryFilter;
            return filter === undefined || (isPlainRecord(filter)
                && Object.values(filter).every((value) => typeof value === 'string'
                    || (typeof value === 'number' && Number.isFinite(value))));
        }
        case 'collection':
            return !hasCollectionLibraryMetadata(source) || getCompleteCollectionLibraryMetadata(source) !== undefined;
        case 'manual':
            return source.items.every((item) => isPlainRecord(item)
                && hasOnlyKeys(item, ['ratingKey', 'title', 'durationMs']));
        case 'mixed':
            return source.sources.every(isExactAuthoredContentSource);
        default:
            return true;
    }
}
