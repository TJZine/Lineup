export const flushPromises = async (rounds: number = 2): Promise<void> => {
    // Two microtask ticks is a pragmatic default for many "await one promise chain" situations.
    // If a test starts under-flushing due to additional microtask layers, prefer awaiting the
    // specific async boundary (or adjust the helper locally) rather than guessing tick counts.
    for (let i = 0; i < rounds; i++) {
        await Promise.resolve();
    }
};

/**
 * Use in real-timer integration tests when a condition may become observable
 * only after both promise chains and one queued macrotask turn complete.
 *
 * Do not use this helper in fake-timer tests; prefer flushPromisesAndTimers()
 * or advanceTimersUntil() there.
 */
export const flushPromisesAndMacrotask = async (promiseRounds: number = 2): Promise<void> => {
    await flushPromises(promiseRounds);
    await new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, 0);
    });
    await flushPromises(promiseRounds);
};

export const flushPromisesAndTimers = async (
    promiseRounds: number = 2,
    timerPasses: number = 1
): Promise<void> => {
    for (let i = 0; i < timerPasses; i++) {
        await flushPromises(promiseRounds);
        await jest.advanceTimersByTimeAsync(0);
    }
    await flushPromises(promiseRounds);
};

export const advanceTimersUntil = async (
    assertNow: () => void,
    options: { stepMs?: number; timeoutMs?: number } = {}
): Promise<void> => {
    const stepMs = options.stepMs ?? 25;
    const timeoutMs = options.timeoutMs ?? 5000;
    if (stepMs <= 0) {
        throw new Error(`advanceTimersUntil requires stepMs > 0 (received ${stepMs}).`);
    }
    if (timeoutMs <= 0) {
        throw new Error(`advanceTimersUntil requires timeoutMs > 0 (received ${timeoutMs}).`);
    }

    const maxPasses = Math.ceil(timeoutMs / stepMs);
    let lastError: unknown = null;
    for (let pass = 0; pass <= maxPasses; pass++) {
        try {
            assertNow();
            return;
        } catch (error: unknown) {
            lastError = error;
        }
        await jest.advanceTimersByTimeAsync(stepMs);
        await flushPromises();
    }

    const reason = lastError instanceof Error ? ` Last assertion: ${lastError.message}` : '';
    throw new Error(`advanceTimersUntil timed out after ${timeoutMs}ms.${reason}`);
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
