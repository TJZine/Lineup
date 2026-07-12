import type { StartupPhase } from './InitializationCoordinator';
import { readStartupAbortReason, throwIfStartupAborted } from './InitializationAbort';

type StartupQueuedWaiter = {
    phase: StartupPhase;
    consumed: boolean;
    resolve: () => void;
    reject: (err: unknown) => void;
    onAbort?: (() => void) | undefined;
    signal?: AbortSignal | null | undefined;
    preferredSignalOwner: boolean;
};

export type StartupQueuedWork = {
    phase: StartupPhase;
    signal?: AbortSignal | null | undefined;
};

export class InitializationStartupQueue {
    private _queuedPhase: StartupPhase | null = null;
    private _waiters: StartupQueuedWaiter[] = [];

    get queuedPhase(): StartupPhase | null {
        return this._queuedPhase;
    }

    queue(
        phase: StartupPhase,
        signal: AbortSignal | null | undefined,
        preferredSignalOwner = false
    ): Promise<void> {
        throwIfStartupAborted(signal);
        this._queuedPhase = this._queuedPhase === null
            ? phase
            : (Math.min(this._queuedPhase, phase) as StartupPhase);

        return new Promise((resolve, reject) => {
            const waiter: StartupQueuedWaiter = {
                phase, consumed: false, resolve, reject, preferredSignalOwner,
            };
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

    consumeQueuedWork(): StartupQueuedWork | null {
        const phase = this._queuedPhase;
        if (phase === null) {
            return null;
        }

        const samePhaseWaiters = this._waiters.filter(
            (waiter) => !waiter.consumed && waiter.phase === phase
        );
        const owner = samePhaseWaiters.find((waiter) => waiter.signal && waiter.preferredSignalOwner)
            ?? samePhaseWaiters[0];
        this._waiters.forEach((waiter) => {
            if (!waiter.consumed) {
                waiter.consumed = true;
            }
        });
        this._recomputeQueuedPhase();

        return { phase, signal: owner?.signal };
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
                if (caughtError === undefined) {
                    waiter.resolve();
                } else {
                    waiter.reject(caughtError);
                }
            } catch {
                // Ignore waiter failures.
            }
        }
    }

    private _recomputeQueuedPhase(): void {
        const pendingPhases = this._waiters
            .filter((waiter) => !waiter.consumed)
            .map((waiter) => waiter.phase);
        this._queuedPhase = pendingPhases.length === 0
            ? null
            : (Math.min(...pendingPhases) as StartupPhase);
    }
}
