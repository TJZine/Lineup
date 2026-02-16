export const flushPromises = async (rounds: number = 2): Promise<void> => {
    // Two microtask ticks is a pragmatic default for many "await one promise chain" situations.
    // If a test starts under-flushing due to additional microtask layers, prefer awaiting the
    // specific async boundary (or adjust the helper locally) rather than guessing tick counts.
    for (let i = 0; i < rounds; i++) {
        await Promise.resolve();
    }
};

export type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
};

export const createDeferred = <T>(): Deferred<T> => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};
