import type { StartupPhase } from './InitializationCoordinator';
import { readStartupAbortReason, throwIfStartupAborted } from './InitializationAbort';

type StartupQueuedWaiter = {
    phase: StartupPhase;
    resolve: () => void;
    reject: (err: unknown) => void;
    onAbort?: (() => void) | undefined;
    signal?: AbortSignal | null | undefined;
};

export class InitializationStartupQueue {
    private _queuedPhase: StartupPhase | null = null;
    private _waiters: StartupQueuedWaiter[] = [];

    get queuedPhase(): StartupPhase | null {
        return this._queuedPhase;
    }

    queue(phase: StartupPhase, signal: AbortSignal | null | undefined): Promise<void> {
        throwIfStartupAborted(signal);
        this._queuedPhase = this._queuedPhase === null
            ? phase
            : (Math.min(this._queuedPhase, phase) as StartupPhase);

        return new Promise((resolve, reject) => {
            const waiter: StartupQueuedWaiter = { phase, resolve, reject };
            if (signal) {
                waiter.onAbort = (): void => {
                    this._waiters = this._waiters.filter((queuedWaiter) => queuedWaiter !== waiter);
                    this._recomputeQueuedPhase();
                    reject(readStartupAbortReason(signal));
                };
                waiter.signal = signal;
                signal.addEventListener('abort', waiter.onAbort, { once: true });
            }
            this._waiters.push(waiter);
        });
    }

    consumeQueuedPhase(): StartupPhase | null {
        const phase = this._queuedPhase;
        this._queuedPhase = null;
        return phase;
    }

    settle(caughtError: unknown): void {
        this._queuedPhase = null;
        const waiters = this._waiters;
        this._waiters = [];
        for (const waiter of waiters) {
            try {
                if (waiter.signal && waiter.onAbort) {
                    waiter.signal.removeEventListener('abort', waiter.onAbort);
                }
                if (caughtError) {
                    waiter.reject(caughtError);
                } else {
                    waiter.resolve();
                }
            } catch {
                // Ignore waiter failures.
            }
        }
    }

    private _recomputeQueuedPhase(): void {
        this._queuedPhase = this._waiters.length === 0
            ? null
            : (Math.min(...this._waiters.map((waiter) => waiter.phase)) as StartupPhase);
    }
}
