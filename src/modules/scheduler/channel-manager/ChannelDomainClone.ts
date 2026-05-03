import type {
    ChannelConfig,
    ChannelContentSource,
    ContentFilter,
    ManualContentItem,
} from './types';

export function cloneChannelForOwnership(channel: ChannelConfig): ChannelConfig {
    return {
        ...channel,
        contentSource: cloneContentSource(channel.contentSource),
        ...(channel.contentFilters ? { contentFilters: cloneContentFilters(channel.contentFilters) } : {}),
    };
}

export function cloneContentFilters(filters: ContentFilter[]): ContentFilter[] {
    return filters.map((filter) => ({ ...filter }));
}

export function cloneContentSource(source: ChannelContentSource): ChannelContentSource {
    switch (source.type) {
        case 'library':
            return {
                ...source,
                ...(source.libraryFilter ? { libraryFilter: { ...source.libraryFilter } } : {}),
            };
        case 'manual':
            return {
                ...source,
                items: source.items.map(cloneManualContentItem),
            };
        case 'mixed':
            return {
                ...source,
                sources: source.sources.map(cloneContentSource),
            };
        case 'show':
            return {
                ...source,
                ...(source.seasonFilter ? { seasonFilter: [...source.seasonFilter] } : {}),
            };
        case 'collection':
        case 'playlist':
            return { ...source };
    }
}

function cloneManualContentItem(item: ManualContentItem): ManualContentItem {
    return { ...item };
}
