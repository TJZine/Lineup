import { fnv1a32Uint } from '../../../utils/hash';
import type { ChannelConfig } from './types';

type ChannelSeedField = 'shuffleSeed' | 'phaseSeed';

const CHANNEL_SEED_SUFFIX_BY_FIELD: Record<ChannelSeedField, 'shuffle' | 'phase'> = {
    shuffleSeed: 'shuffle',
    phaseSeed: 'phase',
};

export function isValidChannelSeed(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

export function buildDefaultChannelSeed(channelId: string, field: ChannelSeedField): number {
    return fnv1a32Uint(`${channelId}:${CHANNEL_SEED_SUFFIX_BY_FIELD[field]}`);
}

export function resolveChannelSeed(channelId: string, field: ChannelSeedField, value: unknown): number {
    return isValidChannelSeed(value) ? value : buildDefaultChannelSeed(channelId, field);
}

export function applyChannelSeedDefaults(
    channel: Pick<ChannelConfig, 'id' | 'shuffleSeed' | 'phaseSeed'>
): void {
    channel.shuffleSeed = resolveChannelSeed(channel.id, 'shuffleSeed', channel.shuffleSeed);
    channel.phaseSeed = resolveChannelSeed(channel.id, 'phaseSeed', channel.phaseSeed);
}
