export function createMulberry32(seed: number): () => number {
    let state = seed;
    return function (): number {
        let t = (state += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function shuffleWithSeed<T>(items: T[], seed: number): T[] {
    if (!Number.isFinite(seed)) {
        throw new Error('Seed must be a finite number');
    }

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
