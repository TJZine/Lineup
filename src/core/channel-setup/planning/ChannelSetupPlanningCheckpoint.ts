import { createAbortError } from './ChannelSetupFacetSnapshotAbort';

export const CHANNEL_SETUP_PLANNING_ITERATION_BUDGET = 128;

export class ChannelSetupPlanningIterationCheckpoint {
    private _iterations = 0;

    constructor(private readonly _checkpoint: () => Promise<void>) {}

    afterIteration(): Promise<void> | null {
        this._iterations += 1;
        if (this._iterations < CHANNEL_SETUP_PLANNING_ITERATION_BUDGET) {
            return null;
        }
        this._iterations = 0;
        return this._checkpoint();
    }
}

export function yieldForChannelSetupPlanning(signal: AbortSignal | null): Promise<void> {
    if (signal?.aborted) {
        return Promise.reject(createAbortError('scan_library_items'));
    }

    return new Promise<void>((resolve, reject) => {
        const onAbort = (): void => {
            clearTimeout(timerId);
            reject(createAbortError('scan_library_items'));
        };
        const timerId = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, 0);
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}
