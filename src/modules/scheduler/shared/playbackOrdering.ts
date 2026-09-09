import type { ResolvedContentItem } from '../channel-manager/contracts/types';
import { applyBlockPlaybackMode } from './blockPlayback';

export type SharedPlaybackOrderingMode = 'sequential' | 'shuffle' | 'block';

export function applyPlaybackOrdering(options: {
    items: ResolvedContentItem[];
    mode: SharedPlaybackOrderingMode;
    seed: number;
    blockSize: number | undefined;
    shuffleItems: <T>(items: T[], seed: number) => T[];
}): ResolvedContentItem[] {
    const { items, mode, seed, blockSize, shuffleItems } = options;

    switch (mode) {
        case 'sequential':
            return normalizeScheduledIndexes(items);
        case 'shuffle':
            // Plex response order is not stable across reads. A seeded shuffle
            // needs a stable input order to preserve the schedule on relaunch.
            return normalizeScheduledIndexes(shuffleItems([...items].sort(compareContentIdentity), seed));
        case 'block':
            return normalizeScheduledIndexes(
                applyBlockPlaybackMode({
                    items,
                    seed,
                    blockSize: normalizeBlockSize(blockSize),
                    shuffleKeys: shuffleItems,
                })
            );
        default:
            return assertNeverSharedPlaybackOrderingMode(mode);
    }
}

function compareContentIdentity(a: ResolvedContentItem, b: ResolvedContentItem): number {
    return a.ratingKey < b.ratingKey ? -1 : a.ratingKey > b.ratingKey ? 1 : 0;
}

function normalizeScheduledIndexes(items: ResolvedContentItem[]): ResolvedContentItem[] {
    return items.map((item, index) => ({
        ...item,
        scheduledIndex: index,
    }));
}

function normalizeBlockSize(blockSize: number | undefined): number {
    const normalizedBlockSize =
        typeof blockSize === 'number' && Number.isFinite(blockSize)
            ? blockSize
            : 3;
    return Math.max(1, Math.floor(normalizedBlockSize));
}

function assertNeverSharedPlaybackOrderingMode(mode: never): never {
    throw new Error(`Unknown shared playback ordering mode: ${String(mode)}`);
}
