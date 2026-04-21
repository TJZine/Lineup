import type { PlexTagDirectoryItem } from '../../modules/plex/library';

type ChannelSetupTagFilterType = 'actor' | 'studio';
type ChannelSetupFacetCountFamily = 'genre' | 'director' | 'year' | ChannelSetupTagFilterType;
type ChannelSetupFastKeyParam = ChannelSetupTagFilterType | 'type';

const CHANNEL_SETUP_FAST_KEY_ALLOW_LIST = new Set<ChannelSetupFastKeyParam>(['actor', 'studio', 'type']);

export function buildChannelSetupTagFilter(
    tag: PlexTagDirectoryItem,
    type: ChannelSetupTagFilterType
): Record<string, string | number> {
    if (tag.fastKey) {
        const parsed = parseChannelSetupTagFastKeyFilters(tag.fastKey);
        if (hasRequestedTagValue(parsed, type)) {
            return parsed;
        }
    }
    return { [type]: tag.key };
}

export function buildChannelSetupFacetCountFilter(
    tag: PlexTagDirectoryItem,
    family: ChannelSetupFacetCountFamily,
    mediaType: number
): Record<string, string | number> {
    if (family === 'actor' || family === 'studio') {
        return {
            ...buildChannelSetupTagFilter(tag, family),
            type: mediaType,
        };
    }
    return {
        type: mediaType,
        [family]: tag.title,
    };
}

export function parseChannelSetupTagFastKeyFilters(fastKey: string): Record<string, string | number> {
    try {
        const result: Record<string, string | number> = {};
        const query = extractFastKeyQuery(fastKey);
        if (query === null) {
            return result;
        }
        const params = new URLSearchParams(query);
        for (const [rawKey, value] of params.entries()) {
            if (!rawKey || value === '') {
                continue;
            }
            const key = rawKey.trim();
            const lowerKey = key.toLowerCase();
            const trimmed = value.trim();
            if (shouldSkipFastKeyEntry(key, lowerKey, trimmed)) {
                continue;
            }
            applyFastKeyFilter(result, lowerKey as ChannelSetupFastKeyParam, trimmed);
        }
        return result;
    } catch {
        return {};
    }
}

function extractFastKeyQuery(fastKey: string): string | null {
    const queryStart = fastKey.indexOf('?');
    const hashIndex = fastKey.indexOf('#');
    if (queryStart === -1 || (hashIndex !== -1 && queryStart > hashIndex)) {
        return null;
    }
    return fastKey.slice(queryStart + 1, hashIndex === -1 ? undefined : hashIndex);
}

function hasRequestedTagValue(
    parsed: Record<string, string | number>,
    type: ChannelSetupTagFilterType
): boolean {
    const requestedValue = parsed[type];
    return typeof requestedValue === 'string' && requestedValue.length > 0;
}

function shouldSkipFastKeyEntry(key: string, lowerKey: string, trimmedValue: string): boolean {
    if (!trimmedValue) {
        return true;
    }
    if (/token/i.test(key)) {
        return true;
    }
    if (lowerKey.startsWith('x-plex-') || lowerKey.startsWith('x-plex-container-')) {
        return true;
    }
    return !CHANNEL_SETUP_FAST_KEY_ALLOW_LIST.has(lowerKey as ChannelSetupFastKeyParam);
}

function applyFastKeyFilter(
    result: Record<string, string | number>,
    key: ChannelSetupFastKeyParam,
    value: string
): void {
    if (key === 'type') {
        const parsedType = Number.parseInt(value, 10);
        if (Number.isFinite(parsedType)) {
            result.type = parsedType;
        }
        return;
    }

    result[key] = value;
}
