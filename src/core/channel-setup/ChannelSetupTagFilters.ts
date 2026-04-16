import type { PlexTagDirectoryItem } from '../../modules/plex/library';

export function buildChannelSetupTagFilter(
    tag: PlexTagDirectoryItem,
    type: 'actor' | 'studio'
): Record<string, string | number> {
    if (tag.fastKey) {
        const parsed = parseChannelSetupTagFastKeyFilters(tag.fastKey);
        const hasActor = typeof parsed.actor === 'string' && parsed.actor.length > 0;
        const hasStudio = typeof parsed.studio === 'string' && parsed.studio.length > 0;
        if ((type === 'actor' && hasActor) || (type === 'studio' && hasStudio)) {
            return parsed;
        }
    }
    return { [type]: tag.key };
}

export function buildChannelSetupFacetCountFilter(
    tag: PlexTagDirectoryItem,
    family: 'genre' | 'director' | 'year' | 'actor' | 'studio',
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
        const allowList = new Set(['actor', 'studio', 'type']);
        const queryStart = fastKey.indexOf('?');
        const hashIndex = fastKey.indexOf('#');
        if (queryStart === -1 || (hashIndex !== -1 && queryStart > hashIndex)) {
            return result;
        }
        const query = fastKey.slice(queryStart + 1, hashIndex === -1 ? undefined : hashIndex);
        const params = new URLSearchParams(query);
        for (const [rawKey, value] of params.entries()) {
            if (!rawKey || value === '') continue;
            const key = rawKey.trim();
            const lowerKey = key.toLowerCase();
            if (/token/i.test(key)) continue;
            if (lowerKey.startsWith('x-plex-') || lowerKey.startsWith('x-plex-container-')) continue;
            if (!allowList.has(lowerKey)) continue;
            const trimmed = value.trim();
            if (!trimmed) continue;
            if (lowerKey === 'type') {
                const parsedType = Number.parseInt(trimmed, 10);
                if (Number.isFinite(parsedType)) {
                    result.type = parsedType;
                }
                continue;
            }
            if (lowerKey === 'actor') {
                result.actor = trimmed;
            }
            if (lowerKey === 'studio') {
                result.studio = trimmed;
            }
        }
        return result;
    } catch {
        return {};
    }
}
