import { readAbortReason } from './PlexDiscoveryAbort';

export class PlexDiscoverySharedRequest<T> {
    private _waiterCount = 0;

    constructor(
        readonly promise: Promise<T>,
        private readonly _abortController: AbortController,
        private readonly _onAllWaitersCanceled: () => void
    ) {}

    awaitSnapshot<TSnapshot>(
        signal: AbortSignal | null,
        createSnapshot: (value: T) => TSnapshot
    ): Promise<TSnapshot> {
        this._waiterCount++;
        let settled = false;
        const releaseWaiter = (): void => {
            if (settled) {
                return;
            }
            settled = true;
            this._waiterCount = Math.max(0, this._waiterCount - 1);
        };

        if (!signal) {
            return this.promise.then(
                (value) => {
                    releaseWaiter();
                    return createSnapshot(value);
                },
                (error: unknown) => {
                    releaseWaiter();
                    throw error;
                }
            );
        }

        if (signal.aborted) {
            releaseWaiter();
            return Promise.reject(readAbortReason(signal));
        }

        return new Promise((resolve, reject) => {
            const onAbort = (): void => {
                signal.removeEventListener('abort', onAbort);
                releaseWaiter();
                if (this._waiterCount === 0 && !this._abortController.signal.aborted) {
                    this._abortController.abort(readAbortReason(signal));
                    this._onAllWaitersCanceled();
                }
                reject(readAbortReason(signal));
            };

            signal.addEventListener('abort', onAbort, { once: true });
            this.promise.then(
                (value) => {
                    signal.removeEventListener('abort', onAbort);
                    releaseWaiter();
                    resolve(createSnapshot(value));
                },
                (error: unknown) => {
                    signal.removeEventListener('abort', onAbort);
                    releaseWaiter();
                    reject(error);
                }
            );
        });
    }
}
