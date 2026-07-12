import { readStartupAbortReason } from './InitializationAbort';

export class InitializationQuarantinedError extends Error {
    constructor() {
        super('Ordinary startup is unavailable during selected-server recovery.');
        this.name = 'InitializationQuarantinedError';
    }
}

export type InitializationStartupLease = Readonly<{
    signal: AbortSignal;
    track(startup: Promise<void>): Promise<void>;
}>;

export class InitializationQuarantineAuthority {
    private _admissionOpen = true;
    private readonly _controllers = new Set<AbortController>();
    private readonly _settlements = new Set<Promise<void>>();

    begin(callerSignal?: AbortSignal | null): InitializationStartupLease | null {
        if (!this._admissionOpen) return null;
        const controller = new AbortController();
        const forwardCallerAbort = (): void => {
            if (callerSignal) controller.abort(readStartupAbortReason(callerSignal));
        };
        callerSignal?.addEventListener('abort', forwardCallerAbort, { once: true });
        if (callerSignal?.aborted) forwardCallerAbort();
        this._controllers.add(controller);
        return Object.freeze({
            signal: controller.signal,
            track: (startup: Promise<void>): Promise<void> => {
                const settlement = startup.then(() => undefined, () => undefined);
                this._settlements.add(settlement);
                void settlement.finally(() => {
                    this._settlements.delete(settlement);
                    this._controllers.delete(controller);
                    callerSignal?.removeEventListener('abort', forwardCallerAbort);
                });
                return startup;
            },
        });
    }

    async prepare(): Promise<void> {
        this._admissionOpen = false;
        for (const controller of this._controllers) {
            controller.abort(new InitializationQuarantinedError());
        }
        await Promise.all([...this._settlements]);
    }

    release(): void {
        this._admissionOpen = true;
    }
}
