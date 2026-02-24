import type { ResolvedContentItem } from '../channel-manager/types';

export function getBlockGroupKey(item: ResolvedContentItem): string {
    return item.showThumb ?? item.showTitle ?? item.ratingKey;
}

export function applyBlockPlaybackMode(options: {
    items: ResolvedContentItem[];
    seed: number;
    blockSize: number;
    shuffleKeys: (keys: string[], seed: number) => string[];
}): ResolvedContentItem[] {
    const { items, seed, blockSize, shuffleKeys } = options;

    const groups = new Map<string, ResolvedContentItem[]>();
    for (const item of items) {
        const key = getBlockGroupKey(item);
        const list = groups.get(key);
        if (list) {
            list.push(item);
        } else {
            groups.set(key, [item]);
        }
    }

    const keys = shuffleKeys(Array.from(groups.keys()), seed);
    const queues = keys.map((key) => ({
        key,
        items: groups.get(key) ?? [],
        offset: 0,
    }));

    const result: ResolvedContentItem[] = [];
    while (queues.length > 0) {
        for (let index = 0; index < queues.length; index++) {
            const queue = queues[index];
            if (!queue) continue;

            const endExclusive = Math.min(queue.items.length, queue.offset + blockSize);
            for (let i = queue.offset; i < endExclusive; i++) {
                const item = queue.items[i];
                if (item) result.push(item);
            }
            queue.offset = endExclusive;
            if (queue.offset >= queue.items.length) {
                queues.splice(index, 1);
                index--;
            }
        }
    }

    return result;
}
