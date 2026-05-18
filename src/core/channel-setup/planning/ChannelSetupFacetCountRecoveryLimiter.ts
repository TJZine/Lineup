import type { FacetCountRecoveryLimiter } from './ChannelSetupFacetCountRecoveryWorker';

export function createFacetCountRecoveryLimiter(maxConcurrency: number): FacetCountRecoveryLimiter {
    const pending: Array<() => void> = [];
    let active = 0;

    const release = (): void => {
        active--;
        const next = pending.shift();
        next?.();
    };

    return <T>(task: () => Promise<T>): Promise<T> => new Promise<T>((resolve, reject) => {
        const run = (): void => {
            active++;
            void Promise.resolve().then(task).then(resolve, reject).finally(release);
        };
        if (active < maxConcurrency) {
            run();
            return;
        }
        pending.push(run);
    });
}
