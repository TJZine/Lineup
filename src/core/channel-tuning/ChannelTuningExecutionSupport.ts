import type { ChannelConfig } from '../../modules/scheduler/channel-manager';

export function buildChannelTransitionPrefix(channel: ChannelConfig): string {
    const hasNumber = typeof channel.number === 'number' && Number.isFinite(channel.number);
    const hasName = typeof channel.name === 'string' && channel.name.length > 0;
    if (hasNumber && hasName) return `${channel.number} ${channel.name}`;
    if (hasName) return channel.name;
    if (hasNumber) return `${channel.number}`;
    return '';
}

export function captureSyncError(operation: () => void): unknown | null {
    try {
        operation();
        return null;
    } catch (error: unknown) {
        return error;
    }
}

export async function captureAsyncError(
    operation: () => Promise<void>
): Promise<unknown | null> {
    try {
        await operation();
        return null;
    } catch (error: unknown) {
        return error;
    }
}
