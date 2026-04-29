import type { IShuffleGenerator } from './interfaces';
import { createMulberry32 } from '../shared/prng';

export class ShuffleGenerator implements IShuffleGenerator {
    public shuffle<T>(items: T[], seed: number): T[] {
        if (items.length <= 1) {
            return [...items];
        }

        const result = [...items];
        const random = createMulberry32(seed);

        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            const temp = result[i];
            result[i] = result[j] as T;
            result[j] = temp as T;
        }

        return result;
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
