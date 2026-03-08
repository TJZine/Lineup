import type { ChannelContentSource } from './types';

export function isValidContentSource(source: unknown, depth: number = 0): source is ChannelContentSource {
    // Guard against excessive nesting in corrupted storage (mixed sources can be recursive).
    // JSON cannot represent cyclic references, so a depth limit is sufficient here.
    if (depth > 25) {
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
        case 'library':
            return (
                typeof src['libraryId'] === 'string' &&
                (src['libraryId'] as string).length > 0 &&
                src['libraryId'] !== 'undefined'
            );
        case 'collection':
            return (
                typeof src['collectionKey'] === 'string' &&
                (src['collectionKey'] as string).length > 0 &&
                src['collectionKey'] !== 'undefined'
            );
        case 'show':
            return (
                typeof src['showKey'] === 'string' &&
                (src['showKey'] as string).length > 0 &&
                src['showKey'] !== 'undefined'
            );
        case 'playlist':
            return (
                typeof src['playlistKey'] === 'string' &&
                (src['playlistKey'] as string).length > 0 &&
                src['playlistKey'] !== 'undefined'
            );
        case 'manual':
            return (
                Array.isArray(src['items']) &&
                (src['items'] as unknown[]).length > 0 &&
                (src['items'] as unknown[]).every((item) => isValidManualItem(item))
            );
        case 'mixed':
            return (
                Array.isArray(src['sources']) &&
                (src['sources'] as unknown[]).length > 0 &&
                (src['sources'] as unknown[]).every((s) => isValidContentSource(s, depth + 1))
            );
        default:
            return false;
    }
}
