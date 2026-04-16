export function stripLegacySequentialVariant<T>(
    channel: T
): { channel: T; didMutate: boolean } {
    if (!channel || typeof channel !== 'object' || Array.isArray(channel)) {
        return { channel, didMutate: false };
    }

    const record = channel as T & Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(record, 'isSequentialVariant')) {
        return { channel, didMutate: false };
    }

    const sanitized = (({ isSequentialVariant: _legacySequentialVariant, ...rest }) => rest)(record);

    return {
        channel: sanitized as T,
        didMutate: true,
    };
}
