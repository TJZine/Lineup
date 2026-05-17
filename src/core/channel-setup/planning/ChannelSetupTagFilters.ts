import type { PlexTagDirectoryItem } from '../../../modules/plex/library';
import type {
    ChannelSetupFacetCountRecoveryFamily,
    ChannelSetupTagFilterType,
} from './ChannelSetupFacetFamilies';

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
    family: ChannelSetupFacetCountRecoveryFamily,
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
        const query = extractFastKeyQuery(fastKey);
        if (query === null) {
            return {};
        }
        return parseFastKeyQuery(query);
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

function parseFastKeyQuery(query: string): Record<string, string | number> {
    const result: Record<string, string | number> = {};
    const params = new URLSearchParams(query);
    for (const entry of params.entries()) {
        const normalizedEntry = normalizeFastKeyEntry(...entry);
        if (!normalizedEntry) {
            continue;
        }
        applyFastKeyFilter(result, normalizedEntry.key, normalizedEntry.value);
    }
    return result;
}

function normalizeFastKeyEntry(rawKey: string, rawValue: string): { key: ChannelSetupFastKeyParam; value: string } | null {
    if (!rawKey || rawValue === '') {
        return null;
    }
    const key = rawKey.trim();
    const value = rawValue.trim();
    if (!value || /token/i.test(key)) {
        return null;
    }
    const parsedKey = parseFastKeyParam(key);
    return parsedKey === null ? null : { key: parsedKey, value };
}

function parseFastKeyParam(rawKey: string): ChannelSetupFastKeyParam | null {
    const lowerKey = rawKey.toLowerCase();
    if (lowerKey.startsWith('x-plex-') || lowerKey.startsWith('x-plex-container-')) {
        return null;
    }
    return CHANNEL_SETUP_FAST_KEY_ALLOW_LIST.has(lowerKey as ChannelSetupFastKeyParam)
        ? (lowerKey as ChannelSetupFastKeyParam)
        : null;
}

function applyFastKeyFilter(result: Record<string, string | number>, key: ChannelSetupFastKeyParam, value: string): void {
    if (key !== 'type') {
        result[key] = value;
        return;
    }

    if (!/^\d+$/.test(value)) {
        return;
    }

    const parsedType = Number(value);
    if (Number.isInteger(parsedType)) {
        result.type = parsedType;
    }
}
