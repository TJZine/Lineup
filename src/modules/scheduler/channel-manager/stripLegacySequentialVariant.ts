type StrippedLegacySequentialVariant<T> =
    T extends (...args: any[]) => unknown ? T :
    T extends readonly unknown[] ? T :
    T extends object ? Omit<T, 'isSequentialVariant'> : T;

export function stripLegacySequentialVariant<T>(
    channel: T
): { channel: StrippedLegacySequentialVariant<T>; didMutate: boolean } {
    if (!channel || typeof channel !== 'object' || Array.isArray(channel)) {
        return { channel: channel as StrippedLegacySequentialVariant<T>, didMutate: false };
    }

    const record = channel as T & Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(record, 'isSequentialVariant')) {
        return { channel: channel as StrippedLegacySequentialVariant<T>, didMutate: false };
    }

    const sanitized = (({
        isSequentialVariant: _legacySequentialVariant,
        ...rest
    }): Record<string, unknown> => rest)(record);

    return {
        channel: sanitized as StrippedLegacySequentialVariant<T>,
        didMutate: true,
    };
}
