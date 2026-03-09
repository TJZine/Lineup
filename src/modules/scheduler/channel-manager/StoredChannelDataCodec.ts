import type { StoredChannelData } from './types';

function isValidStoredShape(value: unknown): value is Partial<StoredChannelData> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    const record = value as Record<string, unknown>;
    return Array.isArray(record.channels) && Array.isArray(record.channelOrder);
}

export function decodeStoredChannelData(raw: string): Partial<StoredChannelData> | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }

    if (!isValidStoredShape(parsed)) {
        return null;
    }

    return parsed;
}

export function encodeStoredChannelData(data: StoredChannelData): string {
    return JSON.stringify(data);
}
