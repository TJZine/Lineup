export const flushPromises = async (): Promise<void> => {
    // Two microtask ticks is a pragmatic default for many "await one promise chain" situations.
    // If a test starts under-flushing due to additional microtask layers, prefer awaiting the
    // specific async boundary (or adjust the helper locally) rather than guessing tick counts.
    await Promise.resolve();
    await Promise.resolve();
};
