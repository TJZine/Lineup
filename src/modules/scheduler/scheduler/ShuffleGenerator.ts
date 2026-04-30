import type { IShuffleGenerator } from './interfaces';
import { shuffleWithSeed } from '../shared/prng';

export class ShuffleGenerator implements IShuffleGenerator {
    public shuffle<T>(items: T[], seed: number): T[] {
        return shuffleWithSeed(items, seed);
    }

    public shuffleIndices(count: number, seed: number): number[] {
        const indices: number[] = [];
        for (let i = 0; i < count; i++) {
            indices.push(i);
        }
        return this.shuffle(indices, seed);
    }

    public generateSeed(channelId: string, anchorTime: number): number {
        let hash = 0;

        for (let i = 0; i < channelId.length; i++) {
            const char = channelId.charCodeAt(i);
            hash = ((hash << 5) - hash + char) | 0;
        }

        hash = hash ^ (anchorTime | 0);
        hash = hash ^ ((anchorTime / 0x100000000) | 0);

        return Math.abs(hash);
    }
}
