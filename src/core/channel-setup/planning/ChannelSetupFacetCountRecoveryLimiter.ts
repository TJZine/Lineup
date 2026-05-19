import type { FacetCountRecoveryLimiter } from './ChannelSetupFacetCountRecoveryWorker';

export function createFacetCountRecoveryLimiter(maxConcurrency: number): FacetCountRecoveryLimiter {
    const effectiveMaxConcurrency = Math.floor(maxConcurrency);
    if (!Number.isFinite(effectiveMaxConcurrency) || effectiveMaxConcurrency < 1) {
        throw new Error(
            `Channel setup facet count recovery limiter maxConcurrency must be at least 1; received ${maxConcurrency}`
        );
    }
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
        if (active < effectiveMaxConcurrency) {
            run();
            return;
        }
        pending.push(run);
    });
}
