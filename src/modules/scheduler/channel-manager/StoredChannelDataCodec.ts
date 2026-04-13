import type { StoredChannelData } from './types';

function isValidStoredShape(value: unknown): value is Partial<StoredChannelData> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    const record = value as Record<string, unknown>;
    return Array.isArray(record.channels) && Array.isArray(record.channelOrder);
}

function stripLegacySequentialVariant(
    channel: unknown
): { channel: unknown; didMutate: boolean } {
    if (!channel || typeof channel !== 'object' || Array.isArray(channel)) {
        return { channel, didMutate: false };
    }

    const record = channel as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(record, 'isSequentialVariant')) {
        return { channel, didMutate: false };
    }

    const { isSequentialVariant, ...rest } = record;
    void isSequentialVariant;
    return { channel: rest, didMutate: true };
}

function sanitizeStoredChannels(channels: unknown): { channels: unknown[]; didMutate: boolean } {
    if (!Array.isArray(channels)) {
        return { channels: [], didMutate: false };
    }
    let didMutate = false;
    const sanitized = channels.map((channel) => {
        const result = stripLegacySequentialVariant(channel);
        didMutate = didMutate || result.didMutate;
        return result.channel;
    });
    return { channels: sanitized, didMutate };
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
    const { channels, didMutate } = sanitizeStoredChannels(data.channels);
    if (!didMutate) {
        return JSON.stringify(data);
    }
    return JSON.stringify({
        ...data,
        channels: channels as StoredChannelData['channels'],
    });
}
