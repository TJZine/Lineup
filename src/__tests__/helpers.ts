export const flushPromises = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
};
